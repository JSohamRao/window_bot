import { SYSTEM_AWARENESS_HISTORY_LIMIT } from "../../shared/systemAwareness";
import type { SystemAwarenessControllerSnapshot } from "../engine/SystemAwarenessController";

export const SYSTEM_TRANSITION_DISPLAY_LIMIT = 72;

const upper = (value: string): string => value.toUpperCase();

const formatTransition = (
  snapshot: SystemAwarenessControllerSnapshot
): string => {
  const transition = snapshot.awareness.lastTransition;
  if (transition === null) return "--";
  const value = `${upper(transition.kind)}: ${upper(transition.from)} -> ${upper(transition.to)}`;
  return value.length <= SYSTEM_TRANSITION_DISPLAY_LIMIT
    ? value
    : `${value.slice(0, SYSTEM_TRANSITION_DISPLAY_LIMIT - 3)}...`;
};

export const formatSystemAwarenessDiagnostics = (
  behaviorState: string | null,
  snapshot: SystemAwarenessControllerSnapshot
): string => {
  const awareness = snapshot.awareness;
  const status = snapshot.runtime.hardPaused
    ? `PAUSED (${snapshot.runtime.blockReason ?? "SYSTEM SAFETY"})`
    : "RUNNING";
  return [
    "SYSTEM AWARENESS",
    `Behavior State: ${upper(behaviorState ?? "NONE")} (THUKUNA FSM)`,
    `Session: ${upper(awareness.sessionState)}`,
    `User Activity: ${upper(awareness.activityState)}`,
    `Idle: ${Math.floor(awareness.idleSeconds)}s`,
    `Power: ${upper(awareness.powerSource)}`,
    `Awareness: ${status}`,
    `Idle Sampler: ${awareness.idleSamplerActive ? "ACTIVE" : "STOPPED"}`,
    `Listeners: ${awareness.listenerCount}`,
    `Last Transition: ${formatTransition(snapshot)}`,
    `History: ${snapshot.transitionHistory.length}/${SYSTEM_AWARENESS_HISTORY_LIMIT}`
  ].join("\n");
};
