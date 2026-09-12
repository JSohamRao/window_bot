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
    "Process",
    "CPUSeconds",
    "WorkingSetMB",
    "PrivateMemoryMB",
]


def percent_change(initial: float, final: float) -> float | None:
    if initial == 0:
        return None
    return (final - initial) / initial * 100.0


def linear_slope(xs: list[float], ys: list[float]) -> float:
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / denominator


def memory_stats(values: list[float]) -> dict[str, Any]:
    initial = values[0]
    final = values[-1]
    return {
        "initial": initial,
        "min": min(values),
        "max": max(values),
        "median": statistics.median(values),
        "final": final,
        "change": final - initial,
        "percent_change": percent_change(initial, final),
        "positive_steps": sum(b > a for a, b in zip(values, values[1:])),
        "negative_steps": sum(b < a for a, b in zip(values, values[1:])),
        "flat_steps": sum(b == a for a, b in zip(values, values[1:])),
    }


def tail_stats(times: list[datetime], values: list[float], count: int = 20) -> dict[str, Any]:
    tail_times = times[-count:]
    tail_values = values[-count:]
    elapsed_minutes = [(value - tail_times[0]).total_seconds() / 60.0 for value in tail_times]
    return {
        "samples": len(tail_values),
        "initial": tail_values[0],
        "min": min(tail_values),
        "max": max(tail_values),
        "median": statistics.median(tail_values),
        "final": tail_values[-1],
        "change": tail_values[-1] - tail_values[0],
        "linear_slope_per_minute": linear_slope(elapsed_minutes, tail_values),
    }


def parse_csv(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    malformed: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    missing_timestamp_count = 0

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        for line_number, fields in enumerate(reader, start=2):
            if len(fields) != len(EXPECTED_HEADER):
                malformed.append({"line": line_number, "reason": "field_count", "fields": fields})
                continue
            raw = dict(zip(EXPECTED_HEADER, fields))
            if not raw["Time"].strip():
                missing_timestamp_count += 1
                malformed.append({"line": line_number, "reason": "missing_timestamp", "fields": fields})
                continue
            try:
                parsed = {
                    "line": line_number,
                    "time_text": raw["Time"],
                    "time": datetime.fromisoformat(raw["Time"]),
                    "pid": int(raw["PID"]),
                    "process": raw["Process"],
                    "cpu": float(raw["CPUSeconds"]),
                    "ws": float(raw["WorkingSetMB"]),
                    "private": float(raw["PrivateMemoryMB"]),
                }
                if not all(math.isfinite(parsed[key]) for key in ("cpu", "ws", "private")):
                    raise ValueError("non-finite metric")
                rows.append(parsed)
            except (TypeError, ValueError) as error:
                malformed.append({"line": line_number, "reason": str(error), "fields": fields})

    exact_row_counts = Counter(
        (row["time_text"], row["pid"], row["process"], row["cpu"], row["ws"], row["private"])
        for row in rows
    )
    duplicate_row_count = sum(count - 1 for count in exact_row_counts.values() if count > 1)
    duplicate_time_pid_count = sum(
        count - 1
        for count in Counter((row["time_text"], row["pid"]) for row in rows).values()
        if count > 1
    )
    quality = {
        "header": header,
        "header_correct": header == EXPECTED_HEADER,
        "malformed_row_count": len(malformed),
        "malformed_rows": malformed,
        "missing_timestamp_count": missing_timestamp_count,
        "duplicate_row_count": duplicate_row_count,
        "duplicate_time_pid_count": duplicate_time_pid_count,
    }
    return rows, quality


def make_sample_rounds(rows: list[dict[str, Any]], tolerance_seconds: float = 2.0) -> list[dict[str, Any]]:
    rounds: list[list[dict[str, Any]]] = []
    for row in sorted(rows, key=lambda item: item["time"]):
        if not rounds or (row["time"] - rounds[-1][0]["time"]).total_seconds() > tolerance_seconds:
            rounds.append([row])
        else:
            rounds[-1].append(row)

    result = []
    for index, round_rows in enumerate(rounds):
        timestamp = min(row["time"] for row in round_rows)
        result.append(
            {
                "index": index,
                "time": timestamp,
                "time_text": timestamp.isoformat(timespec="milliseconds"),
                "rows": round_rows,
                "pids": sorted(row["pid"] for row in round_rows),
                "process_count": len(round_rows),
                "total_ws": sum(row["ws"] for row in round_rows),
                "total_private": sum(row["private"] for row in round_rows),
                "total_cpu": sum(row["cpu"] for row in round_rows),
            }
        )
    return result


def analyze(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    rows, quality = parse_csv(path)
    if not rows:
        raise RuntimeError("CSV has no valid measurement rows")

    rows_by_pid: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        rows_by_pid[row["pid"]].append(row)
    for pid_rows in rows_by_pid.values():
        pid_rows.sort(key=lambda item: item["time"])

    per_pid: dict[str, Any] = {}
    for pid, pid_rows in sorted(rows_by_pid.items()):
        cpu_intervals = []
        negative_cpu_deltas = 0
        for previous, current in zip(pid_rows, pid_rows[1:]):
            elapsed = (current["time"] - previous["time"]).total_seconds()
            delta = current["cpu"] - previous["cpu"]
            if delta < -1e-9:
                negative_cpu_deltas += 1
            utilization = delta / elapsed * 100.0 if elapsed > 0 else None
            cpu_intervals.append(
                {
                    "start": previous["time_text"],
                    "end": current["time_text"],
                    "elapsed_seconds": elapsed,
                    "cpu_delta_seconds": delta,
                    "single_core_utilization_percent": utilization,
                }
            )
        elapsed_total = (pid_rows[-1]["time"] - pid_rows[0]["time"]).total_seconds()
        valid_utils = [
            item["single_core_utilization_percent"]
            for item in cpu_intervals
            if item["single_core_utilization_percent"] is not None and item["cpu_delta_seconds"] >= 0
        ]
        per_pid[str(pid)] = {
            "process": pid_rows[0]["process"],
            "samples": len(pid_rows),
            "first_timestamp": pid_rows[0]["time_text"],
            "last_timestamp": pid_rows[-1]["time_text"],
            "elapsed_seconds": elapsed_total,
            "cpu_initial_seconds": pid_rows[0]["cpu"],
            "cpu_final_seconds": pid_rows[-1]["cpu"],
            "cpu_consumed_seconds": pid_rows[-1]["cpu"] - pid_rows[0]["cpu"],
            "cpu_avg_single_core_percent": (
                (pid_rows[-1]["cpu"] - pid_rows[0]["cpu"]) / elapsed_total * 100.0
                if elapsed_total > 0
                else None
            ),
            "cpu_median_interval_single_core_percent": statistics.median(valid_utils) if valid_utils else None,
            "cpu_peak_single_core_percent": max(valid_utils) if valid_utils else None,
            "cpu_active_interval_count": sum(value > 0 for value in valid_utils),
            "cpu_first_ten_interval_avg_percent": statistics.fmean(valid_utils[:10]) if valid_utils else None,
            "cpu_last_ten_interval_avg_percent": statistics.fmean(valid_utils[-10:]) if valid_utils else None,
            "cpu_peak_interval": max(
                (item for item in cpu_intervals if item["single_core_utilization_percent"] is not None),
                key=lambda item: item["single_core_utilization_percent"],
                default=None,
            ),
            "negative_cpu_delta_count": negative_cpu_deltas,
            "working_set_mb": memory_stats([row["ws"] for row in pid_rows]),
            "private_memory_mb": memory_stats([row["private"] for row in pid_rows]),
        }

    rounds = make_sample_rounds(rows)
    interval_seconds = [
        (current["time"] - previous["time"]).total_seconds()
        for previous, current in zip(rounds, rounds[1:])
    ]
    expected_interval = statistics.median(interval_seconds) if interval_seconds else None
    long_gap_threshold = expected_interval * 1.5 if expected_interval is not None else None
    long_gaps = [gap for gap in interval_seconds if long_gap_threshold is not None and gap > long_gap_threshold]

    first_pid_set = set(rounds[0]["pids"])
    births = []
    deaths = []
    previous_set = first_pid_set
    for sample_round in rounds[1:]:
        current_set = set(sample_round["pids"])
        births.extend(sorted(current_set - previous_set))
        deaths.extend(sorted(previous_set - current_set))
        previous_set = current_set

    elapsed_axis = [(sample_round["time"] - rounds[0]["time"]).total_seconds() for sample_round in rounds]
    total_ws = [sample_round["total_ws"] for sample_round in rounds]
    total_private = [sample_round["total_private"] for sample_round in rounds]
    total_cpu_interval_util = []
    total_cpu_intervals = []
    for previous, current in zip(rounds, rounds[1:]):
        elapsed = (current["time"] - previous["time"]).total_seconds()
        delta = current["total_cpu"] - previous["total_cpu"]
        utilization = delta / elapsed * 100.0 if elapsed > 0 else 0.0
        total_cpu_interval_util.append(utilization)
        total_cpu_intervals.append(
            {
                "start": previous["time_text"],
                "end": current["time_text"],
                "elapsed_seconds": elapsed,
                "cpu_delta_seconds": delta,
                "single_core_utilization_percent": utilization,
            }
        )

    same_pid_set_all_rounds = all(set(sample_round["pids"]) == first_pid_set for sample_round in rounds)
    expected_rounds = 60
    result = {
        "source": {
            "path": str(path),
            "file_size_bytes": path.stat().st_size,
        },
        "quality": {
            **quality,
            "valid_row_count": len(rows),
            "sample_round_count": len(rounds),
            "expected_sample_round_count": expected_rounds,
            "empty_sample_round_count": max(0, expected_rounds - len(rounds)),
            "first_timestamp": min(row["time"] for row in rows).isoformat(timespec="milliseconds"),
            "last_timestamp": max(row["time"] for row in rows).isoformat(timespec="milliseconds"),
            "elapsed_seconds": (max(row["time"] for row in rows) - min(row["time"] for row in rows)).total_seconds(),
            "sampling_interval_seconds": {
                "expected_from_script": 30.0,
                "average": statistics.fmean(interval_seconds) if interval_seconds else None,
                "median": statistics.median(interval_seconds) if interval_seconds else None,
                "min": min(interval_seconds) if interval_seconds else None,
                "max": max(interval_seconds) if interval_seconds else None,
            },
            "long_gap_threshold_seconds": long_gap_threshold,
            "long_gap_count": len(long_gaps),
            "long_gaps_seconds": long_gaps,
            "rounds_with_duplicate_pid": sum(
                len(sample_round["pids"]) != len(set(sample_round["pids"])) for sample_round in rounds
            ),
        },
        "topology": {
            "unique_pids": sorted(rows_by_pid),
            "process_count_min": min(sample_round["process_count"] for sample_round in rounds),
            "process_count_max": max(sample_round["process_count"] for sample_round in rounds),
            "process_count_values": sorted(set(sample_round["process_count"] for sample_round in rounds)),
            "same_pid_set_all_rounds": same_pid_set_all_rounds,
            "births_after_first_sample": births,
            "deaths_before_last_sample": deaths,
            "negative_cpu_delta_count": sum(item["negative_cpu_delta_count"] for item in per_pid.values()),
        },
        "per_pid": per_pid,
        "totals": {
            "working_set_mb": memory_stats(total_ws),
            "private_memory_mb": memory_stats(total_private),
            "working_set_last_20_samples": tail_stats([r["time"] for r in rounds], total_ws),
            "private_memory_last_20_samples": tail_stats([r["time"] for r in rounds], total_private),
            "working_set_linear_slope_mb_per_minute": linear_slope(elapsed_axis, total_ws) * 60.0,
            "private_memory_linear_slope_mb_per_minute": linear_slope(elapsed_axis, total_private) * 60.0,
            "cpu_initial_seconds": rounds[0]["total_cpu"],
            "cpu_final_seconds": rounds[-1]["total_cpu"],
            "cpu_consumed_seconds": rounds[-1]["total_cpu"] - rounds[0]["total_cpu"],
            "cpu_avg_single_core_percent": (
                (rounds[-1]["total_cpu"] - rounds[0]["total_cpu"])
                / (rounds[-1]["time"] - rounds[0]["time"]).total_seconds()
                * 100.0
            ),
            "cpu_peak_single_core_percent": max(total_cpu_interval_util) if total_cpu_interval_util else None,
            "cpu_median_interval_single_core_percent": (
                statistics.median(total_cpu_interval_util) if total_cpu_interval_util else None
            ),
            "cpu_first_ten_interval_avg_percent": (
                statistics.fmean(total_cpu_interval_util[:10]) if total_cpu_interval_util else None
            ),
            "cpu_last_ten_interval_avg_percent": (
                statistics.fmean(total_cpu_interval_util[-10:]) if total_cpu_interval_util else None
            ),
            "cpu_peak_interval": max(
                total_cpu_intervals,
                key=lambda item: item["single_core_utilization_percent"],
                default=None,
            ),
        },
    }
    return result, rounds


def make_plots(rounds: list[dict[str, Any]], output_dir: Path) -> list[str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    output_dir.mkdir(parents=True, exist_ok=True)
    elapsed_minutes = [(sample_round["time"] - rounds[0]["time"]).total_seconds() / 60.0 for sample_round in rounds]
    plot_specs = [
        ("total-working-set.png", "Total Electron working set", "Working set (MB)", [r["total_ws"] for r in rounds]),
        ("total-private-memory.png", "Total Electron private memory", "Private memory (MB)", [r["total_private"] for r in rounds]),
        ("process-count.png", "Electron process count", "Processes", [r["process_count"] for r in rounds]),
    ]
    written = []
    for filename, title, ylabel, values in plot_specs:
        fig, ax = plt.subplots(figsize=(9, 4.5), dpi=140)
        ax.plot(elapsed_minutes, values, color="#8B1E2D", linewidth=1.8)
        ax.set_title(title)
        ax.set_xlabel("Elapsed time (minutes)")
        ax.set_ylabel(ylabel)
        ax.grid(True, alpha=0.25)
        fig.tight_layout()
        target = output_dir / filename
        fig.savefig(target)
        plt.close(fig)
        written.append(str(target))

    cpu_minutes = []
    cpu_util = []
    for previous, current in zip(rounds, rounds[1:]):
        elapsed = (current["time"] - previous["time"]).total_seconds()
        delta = current["total_cpu"] - previous["total_cpu"]
        cpu_minutes.append((current["time"] - rounds[0]["time"]).total_seconds() / 60.0)
        cpu_util.append(delta / elapsed * 100.0 if elapsed > 0 else 0.0)
    fig, ax = plt.subplots(figsize=(9, 4.5), dpi=140)
    ax.plot(cpu_minutes, cpu_util, color="#8B1E2D", linewidth=1.4)
    ax.set_title("Total Electron CPU activity")
    ax.set_xlabel("Elapsed time (minutes)")
    ax.set_ylabel("Approx. single-core utilization (%)")
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    target = output_dir / "total-cpu-activity.png"
    fig.savefig(target)
    plt.close(fig)
    written.append(str(target))
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path)
    parser.add_argument("--plots", dest="plots_path", type=Path)
    args = parser.parse_args()

    result, rounds = analyze(args.csv_path)
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if args.plots_path:
        result["plots"] = make_plots(rounds, args.plots_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
