import {
  formatProductivityTimerRemaining,
  type ProductivityTimerSnapshot
} from "../../shared/productivityTimer";

const timestamp = (value: number | null): string =>
  value === null ? "--" : new Date(value).toISOString();

export const formatProductivityTimerDiagnostics = (
  snapshot: ProductivityTimerSnapshot
): string => [
  "PRODUCTIVITY TIMER",
  `STATE ${snapshot.state.toUpperCase()} · ${formatProductivityTimerRemaining(snapshot.remainingMs)} REMAINING`,
  `KIND ${(snapshot.kind ?? "--").toUpperCase()} · ${snapshot.label ?? "--"}`,
  `DEADLINE ${timestamp(snapshot.deadlineAt)}`,
  `SCHEDULER ${snapshot.schedulerActive ? "ACTIVE" : "STOPPED"} · COMPLETION ${snapshot.completionPending ? "PENDING" : "CLEAR"}`
].join("\n");
