# Interviewfragen als DaVinci Resolve Marker

`import_interview_markers.py` liest den **CSV-Export aus Interview Cockpit** und setzt Fragenmarker in der aktiven Resolve-Timeline. Der vollständige Fragetext, Themenbereich, Notiz und die Originalzeitstempel stehen in der Markernotiz. Bereiche erhalten unterschiedliche Farben; optionale Clip-Marker sind rot.

**Empfohlener Ablauf:** Aufnahmen zuerst auf einer ungeschnittenen Timeline bei normaler Geschwindigkeit ausrichten. Den Abspielkopf auf den Beginn des **ersten Sync-Tons** stellen. Das Script richtet die Fragen daran aus. Erst danach schneiden.

## Voraussetzungen

- DaVinci Resolve mit verfügbarer Python-Scripting-API, geöffnetem Projekt und aktiver Timeline. Blackmagic beschreibt diese API für **Resolve Studio**. Unterstützung in der kostenlosen Version nicht voraussetzen.
- Eine von eurer Resolve-Version unterstützte **64-Bit-Python-Installation ab Python 3.8**. Für den Dateidialog zusätzlich **Tkinter** in derselben Python-Installation. Keine pip-Pakete nötig.
- Bei externer Ausführung Scripting-Zugriff **Local** aktivieren, soweit von der installierten Version angeboten; kein Netzwerkzugriff erforderlich. Details stehen in Resolve unter **Help → Documentation → Developer/Scripting**, insbesondere `README.txt`.

Die Daten- und Markerlogik ist automatisiert getestet. **Ein echter Resolve-Import und die Dialoge wurden hier mangels installierter Resolve-Anwendung nicht ausgeführt.** Vor dem Schnitt einmal auf einer Kopie der Timeline prüfen. Die vorhandene Web-App wird durch dieses Zusatzscript nicht verändert.

## Installation im Resolve-Menü

Nur die Datei **`import_interview_markers.py`** in den benutzerspezifischen Ordner `Scripts/Utility` kopieren; fehlende Ordner anlegen:

| System | Ordner |
|---|---|
| Windows | `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility` |
| macOS | `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility` |
| Linux | `~/.local/share/DaVinciResolve/Fusion/Scripts/Utility` |

Resolve neu starten. Das Script erscheint unter **Workspace → Scripts → Utility → import_interview_markers**. Abweichende Installationen anhand der mitgelieferten Blackmagic-Dokumentation prüfen.

### Fragen importieren

1. Im Cockpit **Protokoll → CSV herunterladen** wählen, möglichst nach Interviewende.
2. In Resolve auf der **Edit-Seite** die richtige Timeline öffnen.
3. Script starten und CSV auswählen.
4. Falls mehrere vorhanden sind, den Sync-Punkt wählen, z. B. `sync-1`.
5. Den Abspielkopf auf den Beginn des **ersten Tons dieses Sync-Signals** stellen und im Dialog bestätigen. Auch ein manueller Klatsch-Sync ist möglich.
6. Entscheiden: **Fragenbereiche** bis zum Fragenende oder **einzelne Startmarker**. Optional zusätzliche Clip-Marker importieren.
7. Vorschau prüfen und den Import bestätigen. Das Ergebnis zeigt neue, doppelte, kollidierende und fehlgeschlagene Marker; Details stehen in der Resolve-Konsole.

Der Timeline-Start darf beispielsweise **01:00:00:00** sein. Das Script zieht den Startframe ab, da Resolve für Timeline-Marker relative Framepositionen erwartet. Die Timeline-Framerate wird aus Resolve gelesen.

Wenn kein Dialog erscheint: Resolve-Konsole auf Python-Fehler prüfen. Bei fehlendem Tkinter die passende Python-Installation ergänzen oder die folgende CLI-Variante nutzen. Die Verfügbarkeit des Script-Menüs allein bestätigt noch keinen API-Zugriff.

## Kommandozeile

### Am Sync-Ton des Abspielkopfes ausrichten

Resolve muss laufen. Der Abspielkopf steht auf dem ersten Ton von `sync-1`:

```sh
python import_interview_markers.py --csv interview.csv --sync sync-1 --anchor-playhead
```

Dieser Aufruf zeigt **nur die Vorschau**. Zum tatsächlichen Setzen der Marker:

```sh
python import_interview_markers.py --csv interview.csv --sync sync-1 --anchor-playhead --apply
```

Unter Windows kann alternativ `py -3` statt `python` verwendet werden. Pfade mit Leerzeichen in Anführungszeichen setzen. Mit `--help` alle Optionen ansehen.

### Über Aufnahmezeit ausrichten

Wenn der Beginn der **Videodatei** genau 30 Sekunden nach dem Beginn der Timeline liegt:

```sh
python import_interview_markers.py --csv interview.csv --sync sync-1 --timeline-offset 00:30 --apply
```

Dieser Versatz bezeichnet den **Dateibeginn**, nicht die Position des Sync-Tons. Er wird mit der Videozeit des Sync-Punkts aus dem CSV kombiniert. Dafür muss der Videozeitcode beim Sync im Cockpit korrekt eingetragen sein.

### Vorschau ohne Resolve

Mit expliziter Framerate und Offset geht die Planung vollständig offline:

```sh
python import_interview_markers.py --csv examples/interview-beispiel.csv --fps 25 --timeline-offset 0 --dry-run --report marker-plan.json
```

Die Beispieldatei wurde mit dem echten Cockpit-Exporter erzeugt; ihre Zeiten und Inhalte sind Testdaten. Der erste Fragenmarker liegt hier bei **Frame 550**, sein Bereich ist **1500 Frames** lang. Die enthaltene Interviewpause wird dabei als laufende Aufnahmezeit berücksichtigt.

Weitere Optionen:

| Option | Wirkung |
|---|---|
| `--points` | Nur einzelne Startmarker, keine Bereiche |
| `--include-clips` | Auch die im Cockpit markierten Clip-Momente importieren |
| `--include-bookends` | Einstieg und Abschluss ebenfalls berücksichtigen, falls synchronisiert |
| `--report pfad.json` | Markerplan, Hinweise und Importzählung lokal speichern |
| `--fps 25` | Offline-Framerate; beim Live-Import darf sie nicht von der Timeline abweichen |

## Mehrere Aufnahme-Dateien und Sync-Punkte

Es gibt **keine automatische Erkennung**, welche Videodatei wo liegt. Bei mehreren Sync-Punkten wird deshalb eine explizite Auswahl verlangt. Im Dialog jeweils einen Aufnahmeabschnitt wählen, den Abspielkopf auf dessen Sync stellen und den Import für weitere Abschnitte wiederholen.

Alternativ eine Zuordnungsdatei verwenden:

```json
{
  "sync-1": {"timeline_sync": "00:12.000"},
  "sync-2": {"timeline_sync": "15:08.500"}
}
```

`timeline_sync` ist die Position des **Sync-Tons** in Sekunden seit dem Timeline-Beginn. Das ist **kein SMPTE-Timecode**. Bei einer Timeline mit Start `01:00:00:00` und einem Ton bei `01:00:12:00` wären bei 25 fps beispielsweise `00:12.000` einzutragen.

```sh
python import_interview_markers.py --csv interview.csv --mapping examples/sync-mapping.json --apply
```

Die Beispielwerte ersetzen. Mapping-Dateien können auch für mehrere Syncs innerhalb derselben Datei verwendet werden. Nach einer erneuten Synchronisation gehören die folgenden Fragen zum neuen Sync-Punkt.

## Zeitgenauigkeit und Grenzen

- Die bevorzugte **Abspielkopf-Methode** verwendet die ISO-Zeitstempel relativ zum gewählten Sync-Ereignis. Sie erhält die Millisekunden aus dem CSV und rundet erst beim Umrechnen auf Timeline-Frames.
- **Interviewzeit** und **Aktive Dauer** werden für die Markerposition nicht verwendet, weil sie explizite Pausen auslassen. Fragenbereiche verwenden die tatsächliche Differenz zwischen Beginn und Ende, einschliesslich Pausen.
- Der CSV-Export zeigt Aufnahmezeiten in ganzen Sekunden. Die Methode mit `--timeline-offset` kann deshalb bei einem Sync-Versatz mit Bruchteilen einer Sekunde ungenauer sein. Für den besten Abgleich die Abspielkopf-Methode wählen.
- Unterstützt werden unter anderem 23.976, 24, 25, 29.97, 30, 50, 59.94 und 60 fps. Für Playhead-Timecodes werden 29.97/59.94 Drop-Frame mit Semikolon unterstützt. Bei ungewöhnlichen Frameraten oder abweichender Timecode-Darstellung bricht das Script verständlich ab.
- Fragen **vor dem ersten Sync**, nicht gewählte Aufnahmeabschnitte und Positionen ausserhalb der Timeline werden mit Hinweis übersprungen. Es werden keine Zuordnungen geraten.
- Überquert eine Frage einen neuen Sync-Punkt, wird nur ein **Startmarker** angelegt. Das Script spannt keinen Bereich über möglicherweise verschiedene Aufnahmedateien. Offene Fragen ohne Endzeit erhalten ebenfalls einen Startmarker.
- Retiming, Zeitlupe, variable Drift der Aufnahmegeräte und bereits herausgeschnittene Passagen werden nicht automatisch erkannt. Pro durchgehendem Abschnitt bei normaler Geschwindigkeit importieren; nach Bedarf mehrere Anker verwenden.
- Script und App synchronisieren nicht das Audio selbst. Die Genauigkeit des beim Schnitt gewählten Signals bleibt entscheidend.

## Bestehende Marker und erneuter Import

Vorhandene Timeline-Marker werden nie gelöscht oder überschrieben. Eine interne `customData`-Kennung erkennt bereits importierte Einträge; ein erneuter Import desselben CSV erzeugt dadurch keine Duplikate. Bei einem belegten Frame wird der neue Marker mit Hinweis übersprungen. Marker werden nicht heimlich um einen Frame verschoben.

Nach einer nachträglichen Korrektur des Ankers gelten bestehende importierte Marker weiterhin als bereits vorhanden. Soll ihre Position geändert werden, zuerst die betreffenden Marker in Resolve gezielt entfernen und dann erneut importieren. Nicht pauschal alle Timeline-Marker löschen. Die Vorschau kann vorab jederzeit ohne Änderung der Timeline ausgeführt werden.

## Entwicklung und Tests

Vom Repository-Hauptordner:

```sh
python3 -m unittest discover -s integrations/davinci-resolve/tests -v
```

Tests prüfen den tatsächlichen CSV-Exporter, Zeitanker, Pausen, Nicht-Null-Starttimecodes, Drop-Frame, Markerbereiche, Sync-Wechsel, Duplikate, belegte Frames und API-Fehler. Resolve wird dabei durch eine kleine Testimplementierung der verwendeten Methoden ersetzt. Das ersetzt keinen Praxistest in Resolve. Die GitHub Action führt diese Tests zusätzlich zu den Web-App-Tests aus.

## API-Grundlage

Massgeblich ist die von Blackmagic mit eurer Resolve-Version ausgelieferte **`Developer/Scripting/README.txt`**, insbesondere `Timeline.AddMarker`, `GetMarkers`, `GetStartFrame`, `GetEndFrame` und `GetCurrentTimecode`. Die dokumentierte Markerposition ist ein Offset zum Timeline-Beginn.

Für die Entwicklung wurde die als Blackmagic-Originaltext gekennzeichnete, öffentlich gespiegelte Referenz gelesen (Stand des Dokuments: 8. Mai 2026): https://github.com/tmoroney/auto-subs/blob/main/.agents/skills/davinci-resolve-fusion/references/resolve-api.txt

Keine eigenen Zugangsdaten und keine Netzwerkübertragung der Interviewdateien erforderlich.
