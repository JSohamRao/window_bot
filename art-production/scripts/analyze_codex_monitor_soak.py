from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


EXPECTED_HEADER = [
    "Time",
    "PID",
    "CPUSeconds",
    "WorkingSetMB",
    "PrivateMemoryMB",
    "ProcessCount",
    "SessionId",
    "StartTime",
    "InitialPID",
    "PathMatch",
    "AccessStatus",
]


def slope_per_minute(times: list[datetime], values: list[float]) -> float:
    xs = [(value - times[0]).total_seconds() / 60.0 for value in times]
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(values)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values)) / denominator


def series_stats(times: list[datetime], values: list[float]) -> dict[str, Any]:
    initial = values[0]
    final = values[-1]
    return {
        "initial": initial,
        "min": min(values),
        "max": max(values),
        "median": statistics.median(values),
        "final": final,
        "change": final - initial,
        "percent_change": ((final - initial) / initial * 100.0) if initial else None,
        "positive_steps": sum(b > a for a, b in zip(values, values[1:])),
        "negative_steps": sum(b < a for a, b in zip(values, values[1:])),
        "flat_steps": sum(b == a for a, b in zip(values, values[1:])),
        "linear_slope_per_minute": slope_per_minute(times, values),
    }


def parse_optional_float(value: str) -> float | None:
    if value == "":
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("non-finite value")
    return result


def analyze(path: Path) -> dict[str, Any]:
    malformed = []
    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        for line_number, fields in enumerate(reader, start=2):
            if len(fields) != len(EXPECTED_HEADER):
                malformed.append({"line": line_number, "reason": "field_count"})
                continue
            raw = dict(zip(EXPECTED_HEADER, fields))
            try:
                row = {
                    "line": line_number,
                    "time": datetime.fromisoformat(raw["Time"]),
                    "time_text": raw["Time"],
                    "pid": int(raw["PID"]),
                    "cpu": parse_optional_float(raw["CPUSeconds"]),
                    "ws": parse_optional_float(raw["WorkingSetMB"]),
                    "private": parse_optional_float(raw["PrivateMemoryMB"]),
                    "process_count": int(raw["ProcessCount"]),
                    "session_id": int(raw["SessionId"]),
                    "start_time": raw["StartTime"],
                    "initial_pid": raw["InitialPID"],
                    "path_match": raw["PathMatch"],
                    "access_status": raw["AccessStatus"],
                }
                if row["ws"] is None or row["private"] is None:
                    raise ValueError("missing memory metric")
                rows.append(row)
            except (TypeError, ValueError) as error:
                malformed.append({"line": line_number, "reason": str(error)})

    if not rows:
        raise RuntimeError("No valid monitor rows")

    rows_by_time: dict[datetime, list[dict[str, Any]]] = defaultdict(list)
    rows_by_pid: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        rows_by_time[row["time"]].append(row)
        rows_by_pid[row["pid"]].append(row)
    times = sorted(rows_by_time)
    for pid_rows in rows_by_pid.values():
        pid_rows.sort(key=lambda row: row["time"])

    intervals = [(b - a).total_seconds() for a, b in zip(times, times[1:])]
    initial_pids = set(row["pid"] for row in rows_by_time[times[0]])
    births = []
    deaths = []
    previous_pids = initial_pids
    for sample_time in times[1:]:
        current_pids = set(row["pid"] for row in rows_by_time[sample_time])
        births.extend(sorted(current_pids - previous_pids))
        deaths.extend(sorted(previous_pids - current_pids))
        previous_pids = current_pids

    per_pid = {}
    for pid, pid_rows in sorted(rows_by_pid.items()):
        pid_times = [row["time"] for row in pid_rows]
        cpu_rows = [row for row in pid_rows if row["cpu"] is not None]
        cpu_result = None
        if len(cpu_rows) == len(pid_rows) and len(cpu_rows) > 1:
            cpu_intervals = []
            for previous, current in zip(cpu_rows, cpu_rows[1:]):
                elapsed = (current["time"] - previous["time"]).total_seconds()
                delta = current["cpu"] - previous["cpu"]
                cpu_intervals.append(
                    {
                        "elapsed_seconds": elapsed,
                        "delta_seconds": delta,
                        "single_core_percent": delta / elapsed * 100.0 if elapsed else None,
                    }
                )
            elapsed = (cpu_rows[-1]["time"] - cpu_rows[0]["time"]).total_seconds()
            cpu_result = {
                "initial_seconds": cpu_rows[0]["cpu"],
                "final_seconds": cpu_rows[-1]["cpu"],
                "consumed_seconds": cpu_rows[-1]["cpu"] - cpu_rows[0]["cpu"],
                "average_single_core_percent": (
                    (cpu_rows[-1]["cpu"] - cpu_rows[0]["cpu"]) / elapsed * 100.0 if elapsed else None
                ),
                "peak_single_core_percent": max(item["single_core_percent"] for item in cpu_intervals),
                "negative_delta_count": sum(item["delta_seconds"] < 0 for item in cpu_intervals),
            }
        per_pid[str(pid)] = {
            "samples": len(pid_rows),
            "access_statuses": sorted(set(row["access_status"] for row in pid_rows)),
            "path_match_values": sorted(set(row["path_match"] for row in pid_rows)),
            "initial_pid_values": sorted(set(row["initial_pid"] for row in pid_rows)),
            "start_time_values": sorted(set(row["start_time"] for row in pid_rows)),
            "working_set_mb": series_stats(pid_times, [row["ws"] for row in pid_rows]),
            "private_memory_mb": series_stats(pid_times, [row["private"] for row in pid_rows]),
            "cpu": cpu_result,
        }

    total_ws = [sum(row["ws"] for row in rows_by_time[sample_time]) for sample_time in times]
    total_private = [sum(row["private"] for row in rows_by_time[sample_time]) for sample_time in times]

    fully_accessible_pids = sorted(
        pid for pid, pid_rows in rows_by_pid.items() if all(row["cpu"] is not None for row in pid_rows)
    )
    accessible_cpu_totals = [
        sum(row["cpu"] for row in rows_by_time[sample_time] if row["pid"] in fully_accessible_pids)
        for sample_time in times
    ]
    accessible_cpu_intervals = []
    for index, (previous_time, current_time) in enumerate(zip(times, times[1:])):
        elapsed = (current_time - previous_time).total_seconds()
        delta = accessible_cpu_totals[index + 1] - accessible_cpu_totals[index]
        accessible_cpu_intervals.append(delta / elapsed * 100.0 if elapsed else None)

    duplicate_keys = sorted(key for key in rows[0] if key != "line")
    exact_duplicates = sum(
        count - 1
        for count in Counter(tuple(row.get(key) for key in duplicate_keys) for row in rows).values()
        if count > 1
    )
    process_counts = [next(iter({row["process_count"] for row in rows_by_time[t]})) for t in times]
    tail_count = min(10, len(times))

    return {
        "source": {"path": str(path), "file_size_bytes": path.stat().st_size},
        "quality": {
            "header": header,
            "header_correct": header == EXPECTED_HEADER,
            "valid_row_count": len(rows),
            "malformed_row_count": len(malformed),
            "malformed_rows": malformed,
            "exact_duplicate_row_count": exact_duplicates,
            "sample_round_count": len(times),
            "first_timestamp": times[0].isoformat(timespec="milliseconds"),
            "last_timestamp": times[-1].isoformat(timespec="milliseconds"),
            "elapsed_seconds": (times[-1] - times[0]).total_seconds(),
            "interval_seconds": {
                "average": statistics.fmean(intervals),
                "median": statistics.median(intervals),
                "min": min(intervals),
                "max": max(intervals),
                "long_gap_count": sum(value > 45.0 for value in intervals),
            },
            "access_status_counts": Counter(row["access_status"] for row in rows),
            "rows_with_cpu": sum(row["cpu"] is not None for row in rows),
            "rows_without_cpu": sum(row["cpu"] is None for row in rows),
        },
        "topology": {
            "unique_pids": sorted(rows_by_pid),
            "process_count_min": min(process_counts),
            "process_count_max": max(process_counts),
            "same_pid_set_all_rounds": all(
                set(row["pid"] for row in rows_by_time[t]) == initial_pids for t in times
            ),
            "births_after_first_sample": births,
            "deaths_before_last_sample": deaths,
            "session_ids": sorted(set(row["session_id"] for row in rows)),
        },
        "per_pid": per_pid,
        "totals": {
            "working_set_mb": series_stats(times, total_ws),
            "private_memory_mb": series_stats(times, total_private),
            "working_set_last_ten": series_stats(times[-tail_count:], total_ws[-tail_count:]),
            "private_memory_last_ten": series_stats(times[-tail_count:], total_private[-tail_count:]),
            "fully_accessible_cpu_pids": fully_accessible_pids,
            "cpu_coverage_pid_count": len(fully_accessible_pids),
            "cpu_total_pid_count": len(rows_by_pid),
            "accessible_cpu_initial_seconds": accessible_cpu_totals[0],
            "accessible_cpu_final_seconds": accessible_cpu_totals[-1],
            "accessible_cpu_consumed_seconds": accessible_cpu_totals[-1] - accessible_cpu_totals[0],
            "accessible_cpu_average_single_core_percent": (
                (accessible_cpu_totals[-1] - accessible_cpu_totals[0])
                / (times[-1] - times[0]).total_seconds()
                * 100.0
            ),
            "accessible_cpu_peak_single_core_percent": max(accessible_cpu_intervals),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path)
    args = parser.parse_args()
    result = analyze(args.csv_path)
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
