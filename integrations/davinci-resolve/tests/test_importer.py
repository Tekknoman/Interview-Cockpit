import csv
import importlib.util
import tempfile
import unittest
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cockpit_importer", ROOT / "import_interview_markers.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Timeline:
    def __init__(self, markers=None):
        self.markers = dict(markers or {})

    def GetMarkers(self):
        return self.markers.copy()

    def GetStartFrame(self):
        return 90000

    def GetCurrentTimecode(self):
        return "01:00:12:00"

    def AddMarker(self, frame, color, name, note, duration, custom):
        self.markers[frame] = dict(color=color, name=name, note=note,
                                   duration=duration, customData=custom)
        return True


class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.rows = mod.read_csv(ROOT / "examples/interview-beispiel.csv")
        self.fps = Fraction(25)

    def plan(self, **kwargs):
        return mod.plan_markers(self.rows, self.fps, {"sync-1": 300}, **kwargs)

    def test_matches_real_cockpit_export(self):
        self.assertEqual(mod.selected_sync(self.rows), "sync-1")
        planned, warnings = self.plan()
        self.assertEqual(len(planned), 2)
        self.assertEqual(planned[0]["frame"], 550)  # video sync at 12s, question 10s later
        self.assertEqual(planned[0]["duration"], 1500)  # 60 wall seconds, includes 20s pause
        self.assertEqual(planned[1]["frame"], 2050)
        self.assertEqual(warnings, [])

    def test_pause_is_not_subtracted_from_marker_range(self):
        q = next(r for r in self.rows if r["Typ"] == "question" and r["Fragen-ID"] == "q1")
        self.assertEqual(q["Aktive Dauer"], "00:40")
        self.assertEqual(self.plan()[0][0]["duration"], 60 * 25)

    def test_start_timecode_not_added_twice(self):
        self.assertEqual(mod.playhead_anchor(Timeline(), self.fps), 300)

    def test_drop_frame_and_fractional_rates(self):
        fps = mod.rate("29.97 DF")
        self.assertEqual(fps, Fraction(30000, 1001))
        self.assertEqual(mod.timecode_frames("01:00:00;00", fps), 107892)
        self.assertEqual(mod.timecode_frames("00:01:00;02", fps), 1800)
        self.assertEqual(mod.timecode_frames("00:10:00;00", fps), 17982)
        self.assertEqual(mod.timecode_frames("01:00:00;00", mod.rate("59.94")), 215784)
        with self.assertRaises(ValueError):
            mod.timecode_frames("00:01:00;00", fps)

    def test_subsecond_wall_precision(self):
        q = next(r for r in self.rows if r["Typ"] == "question" and r["Fragen-ID"] == "q1")
        q["_start"] = mod.iso("2026-11-16T12:00:20.120Z")
        self.assertEqual(self.plan()[0][0]["frame"], 553)

    def test_points_and_optional_clip_markers(self):
        planned, _ = self.plan(ranges=False, include_clips=True)
        self.assertEqual(len(planned), 3)
        self.assertTrue(all(p["duration"] == 1 for p in planned))
        self.assertEqual(planned[1]["color"], "Red")

    def test_existing_markers_never_overwritten(self):
        planned, _ = self.plan()
        timeline = Timeline({550: {"name": "Mein Marker", "customData": "anderes-script"}})
        counts, _ = mod.apply_markers(timeline, planned)
        self.assertEqual(counts["conflicts"], 1)
        self.assertEqual(counts["added"], 1)
        self.assertEqual(timeline.markers[550]["name"], "Mein Marker")

    def test_second_import_is_idempotent(self):
        timeline = Timeline()
        planned, _ = self.plan()
        self.assertEqual(mod.apply_markers(timeline, planned)[0]["added"], 2)
        self.assertEqual(mod.apply_markers(timeline, planned)[0]["duplicates"], 2)
        self.assertEqual(len(timeline.markers), 2)

    def test_api_failure_reported_without_false_success(self):
        timeline = Timeline()
        timeline.AddMarker = lambda *args: False
        counts, _ = mod.apply_markers(timeline, self.plan()[0])
        self.assertEqual(counts["failed"], 2)
        self.assertEqual(counts["added"], 0)

    def test_missing_sync_is_not_guessed(self):
        rows = [r for r in self.rows if r["Typ"] != "sync"]
        with self.assertRaises(ValueError):
            mod.selected_sync(rows)

    def test_unsynced_questions_are_skipped(self):
        q = next(r for r in self.rows if r["Typ"] == "question" and r["Fragen-ID"] == "q1")
        q["Sync"] = ""
        planned, warnings = self.plan()
        self.assertEqual(len(planned), 1)
        self.assertTrue(warnings)

    def test_multiple_syncs_require_selection_and_do_not_cross_ranges(self):
        extra = dict(next(r for r in self.rows if r["Typ"] == "sync"))
        extra.update({"Sync": "sync-2", "_start": mod.iso("2026-11-16T12:01:00Z")})
        self.rows.append(extra)
        with self.assertRaises(ValueError):
            mod.selected_sync(self.rows)
        self.assertEqual(mod.selected_sync(self.rows, "sync-1"), "sync-1")
        planned, warnings = self.plan()
        self.assertEqual(planned[0]["duration"], 1)
        self.assertTrue(any("Sync-Wechsel" in w for w in warnings))

    def test_negative_and_beyond_timeline_positions_skipped(self):
        planned, _ = mod.plan_markers(self.rows, self.fps, {"sync-1": -2000}, length=1000)
        self.assertEqual(planned, [])
        planned, warnings = self.plan(length=2100)
        self.assertEqual(planned[-1]["duration"], 50)
        self.assertTrue(any("gekürzt" in w for w in warnings))

    def test_bad_csv_rejected_and_excel_comma_csv_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.csv"
            path.write_text("a;b\n1;2", encoding="utf8")
            with self.assertRaises(ValueError):
                mod.read_csv(path)
            with path.open("w", encoding="utf-8-sig", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=sorted(mod.REQUIRED), delimiter=",")
                writer.writeheader()
                writer.writerow({k: self.rows[0][k] for k in mod.REQUIRED})
            self.assertEqual(len(mod.read_csv(path)), 1)

    def test_time_formats_and_rejection(self):
        self.assertEqual(mod.seconds("01:02:03.120"), Fraction(372312, 100))
        self.assertEqual(mod.frames(mod.seconds("0.5"), mod.rate("25")), 13)
        for value in ("-1", "00:99", "a", "01:00:00:00", "NaN"):
            with self.assertRaises(ValueError):
                mod.seconds(value)

    def test_offline_dry_run_report_without_resolve(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "plan.json"
            self.assertEqual(mod.cli(["--csv", str(ROOT / "examples/interview-beispiel.csv"),
                                      "--fps", "25", "--timeline-offset", "0", "--dry-run",
                                      "--report", str(report)]), 0)
            self.assertTrue(report.is_file())


if __name__ == "__main__":
    unittest.main()
