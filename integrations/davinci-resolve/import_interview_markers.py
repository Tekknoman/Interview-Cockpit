#!/usr/bin/env python3
"""Import Interview Cockpit CSV as Resolve timeline markers. Python 3.8+.

No media is edited and no existing marker is deleted or overwritten.
Run without arguments for the optional Tkinter file-picker workflow.
"""
import argparse
import csv
import hashlib
import importlib
import io
import json
import os
import re
import sys
from datetime import datetime
from fractions import Fraction
from pathlib import Path

PREFIX = "interview-cockpit:"
COLORS = ("Blue", "Green", "Yellow", "Purple", "Pink")
REQUIRED = {"Typ", "Start ISO", "Ende ISO", "Bereich", "Fragen-ID",
            "Frage / Marker", "Aufnahmezeit", "Sync", "Notiz"}


def seconds(value):
    """Seconds or MM:SS[.mmm] / HH:MM:SS[.mmm], never a video timecode."""
    text = str(value).strip().replace(",", ".")
    if not text or text.startswith(("-", "−", "+")):
        raise ValueError("Zeit muss nichtnegativ sein: {!r}".format(value))
    parts = text.split(":")
    if len(parts) > 3:
        raise ValueError("Zeit als Sekunden, MM:SS oder HH:MM:SS angeben.")
    if any(not re.fullmatch(r"\d+(?:\.\d+)?", p) for p in parts):
        raise ValueError("Ungültige Zeit: {!r}".format(value))
    values = [Fraction(p) for p in parts]
    if len(parts) > 1 and (any(v >= 60 for v in values[1:]) or
                           any(v.denominator != 1 for v in values[:-1])):
        raise ValueError("Ungültige Minuten/Sekunden: {!r}".format(value))
    result = Fraction(0)
    for v in values:
        result = result * 60 + v
    return result


def rate(value):
    text = str(value).strip()
    match = re.fullmatch(r"(\d+(?:\.\d+)?(?:/\d+)?)(?:\s*(?:DF|NDF))?", text, re.I)
    if not match:
        raise ValueError("Unbekannte Timeline-Framerate: {!r}".format(value))
    result = Fraction(match.group(1))
    for displayed, exact in ((23.976, Fraction(24000, 1001)),
                             (29.97, Fraction(30000, 1001)),
                             (59.94, Fraction(60000, 1001))):
        if abs(float(result) - displayed) < 0.00001:
            result = exact
    if not 1 <= result <= 240:
        raise ValueError("Framerate muss zwischen 1 und 240 liegen.")
    return result


def frames(value, fps):
    exact = Fraction(value) * fps
    return (exact + Fraction(1, 2)).numerator // (exact + Fraction(1, 2)).denominator


def timecode_frames(text, fps):
    """Resolve playhead TC -> absolute frame counter, including 29.97/59.94 DF."""
    match = re.fullmatch(r"(\d+):(\d{2}):(\d{2})([:;])(\d{2,3})", str(text))
    if not match:
        raise ValueError("Nicht unterstützter Timeline-Timecode: {!r}".format(text))
    h, m, s, delimiter, f = match.groups()
    h, m, s, f = map(int, (h, m, s, f))
    nominal = round(float(fps))
    if m >= 60 or s >= 60 or f >= nominal:
        raise ValueError("Ungültiger Timeline-Timecode: " + str(text))
    result = ((h * 60 + m) * 60 + s) * nominal + f
    if delimiter == ";":
        if fps not in (Fraction(30000, 1001), Fraction(60000, 1001)):
            raise ValueError("Drop-Frame wird nur für 29.97/59.94 unterstützt.")
        drop = 2 if nominal == 30 else 4
        if m % 10 and s == 0 and f < drop:
            raise ValueError("Dieser Timecode ist ein ausgelassenes Drop-Frame-Label.")
        minutes = h * 60 + m
        result -= drop * (minutes - minutes // 10)
    return result


def iso(text):
    dt = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("CSV-Zeitstempel benötigt eine Zeitzone: " + text)
    return dt


def difference(a, b):
    delta = a - b
    return Fraction((delta.days * 86400 + delta.seconds) * 1000000 + delta.microseconds, 1000000)


def read_csv(path):
    data = Path(path).read_text(encoding="utf-8-sig")
    if len(data) > 20 * 1024 * 1024:
        raise ValueError("CSV ist grösser als 20 MB.")
    # Cockpit exports ';'. Also accept an Excel-resaved comma/tab CSV.
    first_line = data.splitlines()[0] if data else ""
    delimiter = max((";", ",", "\t"), key=first_line.count)
    reader = csv.DictReader(io.StringIO(data), delimiter=delimiter)
    if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
        raise ValueError("Kein Interview-Cockpit-CSV. Fehlende Spalten: " +
                         ", ".join(sorted(REQUIRED - set(reader.fieldnames or []))))
    rows = []
    for line, raw in enumerate(reader, 2):
        if None in raw or any(v is None for v in raw.values()):
            raise ValueError("CSV-Zeile {}: beschädigte Spaltenstruktur.".format(line))
        row = dict(raw)
        row["_line"] = line
        try:
            row["_start"] = iso(row["Start ISO"])
            row["_end"] = iso(row["Ende ISO"]) if row["Ende ISO"] else None
            if row["_end"] and row["_end"] < row["_start"]:
                raise ValueError("Ende liegt vor dem Beginn.")
        except ValueError as exc:
            raise ValueError("CSV-Zeile {}: {}".format(line, exc)) from exc
        rows.append(row)
    return rows


def sync_points(rows):
    points = {}
    for row in rows:
        if row["Typ"] == "sync" and row["Sync"]:
            key = row["Sync"]
            if key in points:
                raise ValueError("Doppelter Sync-Punkt: " + key)
            points[key] = row
    return points


def selected_sync(rows, requested=None):
    points = sync_points(rows)
    if requested:
        if requested not in points:
            raise ValueError("Sync-Punkt nicht vorhanden: " + requested)
        return requested
    if len(points) != 1:
        raise ValueError("Genau einen Sync mit --sync wählen. Vorhanden: " +
                         (", ".join(points) or "keiner"))
    return next(iter(points))


def plan_markers(rows, fps, anchors, ranges=True, include_clips=False,
                 include_bookends=False, length=None):
    """anchors maps sync ID to the exact sync position in relative timeline frames.

    Wall timestamps preserve pauses and millisecond precision. Never use the
    pausable Interviewzeit / Aktive Dauer to position or size a marker.
    """
    syncs = sync_points(rows)
    if not anchors or set(anchors) - set(syncs):
        raise ValueError("Jeder Anker muss auf einen vorhandenen Sync-Punkt verweisen.")
    ordered_syncs = sorted(syncs.values(), key=lambda r: r["_start"])
    sections = list(dict.fromkeys(r["Bereich"] for r in rows if r["Typ"] == "question"
                                  and r["Fragen-ID"] not in ("__intro", "__outro")))
    planned, warnings = [], []
    for row in rows:
        kind, qid, sync_id = row["Typ"], row["Fragen-ID"], row["Sync"]
        if kind != "question" and not (kind == "marker" and include_clips):
            continue
        if qid in ("__intro", "__outro") and kind == "question" and not include_bookends:
            continue
        if sync_id not in anchors:
            warnings.append("Zeile {} übersprungen: {} (kein gewählter Sync-Anker).".format(
                row["_line"], qid or row["Frage / Marker"]))
            continue
        sync = syncs[sync_id]
        at = anchors[sync_id] + frames(difference(row["_start"], sync["_start"]), fps)
        if at < 0 or (length is not None and at >= length):
            warnings.append("Zeile {} ausserhalb der Timeline, übersprungen.".format(row["_line"]))
            continue
        duration = 1
        next_sync = next((s for s in ordered_syncs if s["_start"] > row["_start"]), None)
        if kind == "question" and ranges and row["_end"]:
            if next_sync and row["_end"] > next_sync["_start"]:
                warnings.append("{} überquert einen Sync-Wechsel: nur Startmarker.".format(qid))
            else:
                duration = max(1, frames(difference(row["_end"], row["_start"]), fps))
                if length is not None and at + duration > length:
                    duration = length - at
                    warnings.append("{} am Timeline-Ende gekürzt.".format(qid))
        color = "Red" if kind == "marker" else COLORS[sections.index(row["Bereich"]) % len(COLORS)] if row["Bereich"] in sections else "Blue"
        number = re.fullmatch(r"q(\d+)", qid)
        prefix = "Frage " + number.group(1) if number and kind == "question" else qid if kind == "question" else "Clip"
        text = row["Frage / Marker"]
        name = "{} · {}".format(prefix, text)[:150]
        note = "{}\nBereich: {}\nID: {}\nBeginn: {}\nEnde: {}\nSync: {}\nNotiz: {}".format(
            text, row["Bereich"], qid, row["Start ISO"], row["Ende ISO"] or "offen", sync_id, row["Notiz"])
        identity = "|".join((kind, qid, row["Start ISO"], sync_id))
        custom = PREFIX + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:32]
        planned.append({"frame": at, "duration": duration, "color": color,
                        "name": name, "note": note, "customData": custom})
    return planned, warnings


def apply_markers(timeline, planned):
    existing = timeline.GetMarkers() or {}
    occupied = {int(float(k)): v for k, v in existing.items()}
    identities = {v.get("customData") for v in existing.values() if v.get("customData")}
    counts = {"added": 0, "duplicates": 0, "conflicts": 0, "failed": 0}
    details = []
    for marker in planned:
        frame, identity = marker["frame"], marker["customData"]
        if identity in identities:
            counts["duplicates"] += 1
            details.append("Bereits importiert: " + marker["name"])
            continue
        if frame in occupied:
            counts["conflicts"] += 1
            details.append("Frame {} belegt, nicht überschrieben: {}".format(frame, marker["name"]))
            continue
        try:
            ok = timeline.AddMarker(frame, marker["color"], marker["name"],
                                    marker["note"], marker["duration"], identity)
        except Exception as exc:
            ok = False
            details.append("API-Fehler bei {}: {}".format(marker["name"], exc))
        if ok:
            counts["added"] += 1
            identities.add(identity)
            occupied[frame] = marker
        else:
            counts["failed"] += 1
            details.append("Nicht angelegt: " + marker["name"])
    return counts, details


def connect_resolve():
    injected = globals().get("resolve")
    if injected is not None:
        return injected
    paths = [os.environ.get("RESOLVE_SCRIPT_API", ""),
             "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting",
             str(Path(os.environ.get("PROGRAMDATA", "C:/ProgramData")) /
                 "Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting"),
             "/opt/resolve/Developer/Scripting", "/home/resolve/Developer/Scripting"]
    for path in paths:
        modules = Path(path) / "Modules"
        if path and modules.is_dir() and str(modules) not in sys.path:
            sys.path.append(str(modules))
    try:
        api = importlib.import_module("DaVinciResolveScript")
        app = api.scriptapp("Resolve")
    except Exception as exc:
        raise RuntimeError("Resolve-Scripting nicht erreichbar. Resolve starten und die mitgelieferte "
                           "Developer/Scripting/README.txt sowie Python-/Scripting-Einstellungen prüfen. "
                           "Details: " + str(exc)) from exc
    if app is None:
        raise RuntimeError("Kein Zugriff auf Resolve. Projekt öffnen; Scripting-Freigabe und Studio-Unterstützung prüfen.")
    return app


def timeline_context():
    app = connect_resolve()
    manager = app.GetProjectManager()
    project = manager.GetCurrentProject() if manager else None
    timeline = project.GetCurrentTimeline() if project else None
    if timeline is None:
        raise RuntimeError("In Resolve ein Projekt mit einer Timeline öffnen.")
    fps = rate(timeline.GetSetting("timelineFrameRate") or project.GetSetting("timelineFrameRate"))
    return timeline, fps


def playhead_anchor(timeline, fps):
    # AddMarker uses offsets relative to timeline start, NOT absolute timecode frames.
    return timecode_frames(timeline.GetCurrentTimecode(), fps) - int(timeline.GetStartFrame())


def summary(planned, warnings, fps):
    text = ["{} Marker geplant · {:.6g} fps".format(len(planned), float(fps)), ""]
    for m in planned[:15]:
        text.append("Frame {:>7} · {:>6} Frames · {}".format(m["frame"], m["duration"], m["name"][:85]))
    if len(planned) > 15:
        text.append("… und {} weitere".format(len(planned) - 15))
    if warnings:
        text.extend(["", "Hinweise ({})".format(len(warnings)), *warnings[:15]])
    return "\n".join(text)


def gui():
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox, simpledialog
        root = tk.Tk()
        root.withdraw()
    except Exception as exc:
        raise RuntimeError("Für den Dateidialog benötigt diese Python-Installation Tkinter. "
                           "Alternativ das Script mit --csv und --help über die Kommandozeile nutzen. " + str(exc)) from exc
    try:
        filename = filedialog.askopenfilename(parent=root, title="Interview-Cockpit-CSV auswählen",
                                              filetypes=[("CSV", "*.csv"), ("Alle Dateien", "*")])
        if not filename:
            return
        rows = read_csv(filename)
        available = list(sync_points(rows))
        if not available:
            raise ValueError("Das CSV enthält keinen Sync-Punkt. Im Cockpit synchronisieren und CSV erneut exportieren.")
        chosen = available[0] if len(available) == 1 else simpledialog.askstring(
            "Aufnahme wählen", "Welcher Sync-Punkt gehört zum Ton unter dem Abspielkopf?\n" +
            ", ".join(available), initialvalue=available[0], parent=root)
        if not chosen:
            return
        chosen = selected_sync(rows, chosen.strip())
        if not messagebox.askokcancel("Sync-Ton ausrichten",
                "In der Edit-Seite den Abspielkopf exakt auf den Beginn des ERSTEN Sync-Tons "
                "von {} stellen. Danach hier OK. Nur dieser Aufnahmeabschnitt wird importiert.\n\n"
                "Timeline-Starttimecode darf z. B. 01:00:00:00 sein.".format(chosen), parent=root):
            return
        timeline, fps = timeline_context()
        ranges = messagebox.askyesno("Fragenbereiche", "Fragen als Bereich bis zum Fragenende markieren?\n"
                                    "Nein = einzelner Startmarker pro Frage.", parent=root)
        clips = messagebox.askyesno("Clip-Marker", "Zusätzlich die im Cockpit gesetzten Clip-Marker importieren?", parent=root)
        planned, warnings = plan_markers(rows, fps, {chosen: playhead_anchor(timeline, fps)},
                                         ranges=ranges, include_clips=clips,
                                         length=int(timeline.GetEndFrame()) - int(timeline.GetStartFrame()))
        if not planned:
            raise ValueError(summary(planned, warnings, fps) + "\nKeine importierbaren Fragen gefunden.")
        preview = "Timeline: " + str(timeline.GetName()) + "\n\n" + summary(planned, warnings, fps)
        print(preview)
        if not messagebox.askyesno("Marker-Vorschau", preview +
                "\n\nMarker jetzt in der aktiven Timeline anlegen? Bestehende Marker bleiben erhalten.", parent=root):
            return
        counts, details = apply_markers(timeline, planned)
        result = "Neu: {added}\nBereits vorhanden: {duplicates}\nBelegte Frames: {conflicts}\nFehlgeschlagen: {failed}".format(**counts)
        print(result + "\n" + "\n".join(details))
        (messagebox.showwarning if counts["conflicts"] or counts["failed"] else messagebox.showinfo)("Import abgeschlossen", result + "\n\nDetails stehen in der Resolve-Konsole.", parent=root)
    except Exception as exc:
        print("Interview-Cockpit: " + str(exc), file=sys.stderr)
        messagebox.showerror("Interview-Cockpit-Import", str(exc), parent=root)
    finally:
        root.destroy()


def cli(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--sync", help="z. B. sync-1; bei mehreren Syncs explizit wählen")
    anchor = parser.add_mutually_exclusive_group(required=True)
    anchor.add_argument("--anchor-playhead", action="store_true", help="Abspielkopf steht auf dem ersten Sync-Ton")
    anchor.add_argument("--timeline-offset", help="Start der Videodatei ab Timeline-Beginn, als Sekunden/MM:SS/HH:MM:SS")
    anchor.add_argument("--mapping", type=Path, help="JSON mit timeline_sync pro Sync-ID")
    parser.add_argument("--fps", help="Framerate für Offline-Vorschau; bei Live-Import muss sie zur Timeline passen")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Marker wirklich anlegen; ohne diese Option nur Vorschau")
    mode.add_argument("--dry-run", action="store_true", help="Nur Vorschau, keine Marker anlegen")
    parser.add_argument("--points", action="store_true", help="Startmarker statt Fragenbereiche")
    parser.add_argument("--include-clips", action="store_true")
    parser.add_argument("--include-bookends", action="store_true", help="Auch Einstieg und Abschluss markieren")
    parser.add_argument("--report", type=Path, help="Plan und Importergebnis als JSON speichern")
    args = parser.parse_args(argv)
    rows = read_csv(args.csv)
    timeline, length = None, None
    if args.apply or args.anchor_playhead or not args.fps:
        timeline, fps = timeline_context()
        length = int(timeline.GetEndFrame()) - int(timeline.GetStartFrame())
        if args.fps and rate(args.fps) != fps:
            raise ValueError("--fps stimmt nicht mit der aktiven Timeline überein.")
    else:
        fps = rate(args.fps)
    if args.mapping:
        if args.sync:
            raise ValueError("--sync nicht mit --mapping kombinieren.")
        mapping = json.loads(args.mapping.read_text(encoding="utf-8-sig"))
        if not isinstance(mapping, dict) or not mapping:
            raise ValueError("Mapping muss ein nichtleeres JSON-Objekt sein.")
        anchors = {key: frames(seconds(value["timeline_sync"]), fps) for key, value in mapping.items()}
    else:
        chosen = selected_sync(rows, args.sync)
        if args.anchor_playhead:
            anchors = {chosen: playhead_anchor(timeline, fps)}
        else:
            sync = sync_points(rows)[chosen]
            if not sync["Aufnahmezeit"]:
                raise ValueError("Sync benötigt eine Aufnahmezeit im CSV.")
            anchors = {chosen: frames(seconds(args.timeline_offset) + seconds(sync["Aufnahmezeit"]), fps)}
    planned, warnings = plan_markers(rows, fps, anchors, ranges=not args.points,
                                     include_clips=args.include_clips,
                                     include_bookends=args.include_bookends, length=length)
    print(summary(planned, warnings, fps))
    result = None
    if args.apply:
        if not planned:
            raise ValueError("Keine importierbaren Marker; Timeline unverändert.")
        result, details = apply_markers(timeline, planned)
        print(json.dumps(result, ensure_ascii=False))
        print("\n".join(details))
    else:
        print("\nNur Vorschau. Zum Import --apply ergänzen.")
    if args.report:
        args.report.write_text(json.dumps({"fps": str(fps), "markers": planned,
                                          "warnings": warnings, "result": result},
                                         ensure_ascii=False, indent=2), encoding="utf-8")
    return 2 if result and (result["failed"] or result["conflicts"]) else 0


if __name__ == "__main__":
    if any(arg in ("--csv", "--help", "-h") or arg.startswith("--csv=") for arg in sys.argv[1:]):
        try:
            sys.exit(cli())
        except Exception as error:
            print("Import fehlgeschlagen: " + str(error), file=sys.stderr)
            sys.exit(1)
    else:
        try:
            gui()
        except Exception as error:
            print(str(error), file=sys.stderr)
