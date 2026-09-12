import type { AnimationName } from "../animations/thukunaAnimations";
import type { AnimationController } from "../engine/AnimationController";
import type { InteractionController } from "../engine/InteractionController";
import type {
  DevelopmentForceOptions,
  ThukunaController,
  ThukunaSnapshot
} from "../engine/ThukunaController";
import type { AutonomousStateName } from "../states/PetState";
import type { ThukunaSettings } from "../../shared/settings";
import type {
  DevCommandExecution,
  DevCommandRuntime,
  DevCommandTraceEntry,
  DevCommandRejectionReason
} from "./DevCommandController";
import type { DevCommandDefinition, DevCommandId } from "./devCommandRegistry";

export interface ThukunaDevUiPort {
  toggleDiagnostics(): void;
  updateAutonomy(enabled: boolean): Promise<void>;
  resetPosition(): Promise<boolean>;
  getSettings(): ThukunaSettings;
  validateCommandAssets(command: DevCommandId): string | null;
}

const DEV_OVERRIDE: DevelopmentForceOptions = { bypassProductPolicy: true };

const accepted = (detail?: string): DevCommandExecution => ({
  accepted: true,
  reason: "NONE",
  ...(detail === undefined ? {} : { detail })
});

const rejected = (
  reason: DevCommandRejectionReason,
  detail?: string
): DevCommandExecution => ({
  accepted: false,
  reason,
  ...(detail === undefined ? {} : { detail })
});

const DEV_FORCE_COMMANDS = new Set<DevCommandId>([
  "IDLE", "CRAWL", "SPRINT", "JUMP", "JUMP_LEFT", "JUMP_RIGHT", "HOP",
  "FALL", "CLIMB_UP", "CLIMB_DOWN", "PERCH", "DROP", "WATCH", "CHASE",
  "SLEEP", "WAKE", "LAUGH", "ANGRY", "RAGE", "FALL_OVER",
  "CREEPY_FREEZE", "ZOOM_STARE", "CHAOS_RUN", "DOMAIN", "RESET_POSITION",
  "LAND"
]);

const appendTrace = (
  entries: DevCommandTraceEntry[],
  stage: DevCommandTraceEntry["stage"],
  detail?: string
): void => {
  entries.push({ stage, ...(detail === undefined ? {} : { detail }) });
};

export class ThukunaDevCommandRuntime implements DevCommandRuntime {
  public constructor(
    private readonly controller: ThukunaController,
    private readonly animation: AnimationController<AnimationName>,
    private readonly interactions: InteractionController,
    private readonly ui: ThukunaDevUiPort
  ) {}

  public getActualState() {
    return {
      state: this.controller.getSnapshot().state,
      animation: this.animation.getCurrentAnimation()
    };
  }

  public async execute(command: DevCommandDefinition): Promise<DevCommandExecution> {
    const entries: DevCommandTraceEntry[] = [];
    const initial = this.controller.getSnapshot();
    appendTrace(
      entries,
      "RUNTIME_ENTERED",
      `state=${initial.state ?? "NONE"}; rare=${initial.rareEvent.activeEvent ?? "NONE"}; power=${initial.powerPolicy.mode}; autonomy=${initial.autonomyPaused ? "PAUSED" : "RUN"}; rareSetting=${initial.settings.rareEventsEnabled}; drag=${initial.state === "DRAGGED"}`
    );

    const assetError = this.ui.validateCommandAssets(command.id);
    if (assetError !== null) {
      appendTrace(entries, "PRECONDITION_REJECTED", assetError);
      return {
        ...rejected("ASSET_VALIDATION_FAILED", assetError),
        devOverride: DEV_FORCE_COMMANDS.has(command.id),
        trace: entries
      };
    }

    const rejection = this.getHardPreconditionRejection(command.id, initial);
    if (rejection !== null) {
      appendTrace(entries, "PRECONDITION_REJECTED", rejection.reason);
      return {
        ...rejection,
        devOverride: DEV_FORCE_COMMANDS.has(command.id),
        trace: entries
      };
    }
    appendTrace(entries, "PRECONDITION_ACCEPTED");

    try {
      const execution = await this.executeAccepted(command, initial, entries);
      const actual = this.getActualState();
      appendTrace(entries, "IMMEDIATE_VERIFICATION", `state=${actual.state ?? "NONE"}; animation=${actual.animation ?? "NONE"}`);
      return {
        ...execution,
        devOverride: DEV_FORCE_COMMANDS.has(command.id),
        trace: entries
      };
    } catch (error: unknown) {
      const actual = this.getActualState();
      const message = error instanceof Error ? error.message : String(error);
      const detail = `${message}; state=${actual.state ?? "NONE"}; animation=${actual.animation ?? "NONE"}`;
      appendTrace(entries, "EXECUTION_ERROR", detail);
      return {
        ...rejected("EXECUTION_ERROR", detail),
        devOverride: DEV_FORCE_COMMANDS.has(command.id),
        trace: entries
      };
    }
  }

  private async executeAccepted(
    command: DevCommandDefinition,
    snapshot: ThukunaSnapshot,
    entries: DevCommandTraceEntry[]
  ): Promise<DevCommandExecution> {
    switch (command.id) {
      case "DIAGNOSTICS":
        this.ui.toggleDiagnostics();
        return accepted();
      case "IDLE":
        return this.forceState("IDLE", entries);
      case "CRAWL":
        return this.forceState("CRAWLING", entries);
      case "SLEEP":
        return this.forceState("SLEEPING", entries);
      case "LAUGH":
        return this.forceState("LAUGHING", entries);
      case "ANGRY":
        return this.forceState("ANGRY", entries);
      case "WAKE":
        appendTrace(entries, "CONTROLLER_REQUESTED", "forceWake");
        return this.fromBoolean(this.controller.forceWake(), entries);
      case "SPRINT":
        return this.forceRareEvent("SPRINT", entries);
      case "FALL_OVER":
        return this.forceRareEvent("FALL_OVER", entries);
      case "CREEPY_FREEZE":
        return this.forceRareEvent("CREEPY_FREEZE", entries);
      case "ZOOM_STARE":
        return this.forceRareEvent("ZOOM_STARE", entries);
      case "CHAOS_RUN":
        return this.forceRareEvent("CHAOS_RUN", entries);
      case "DOMAIN":
        return this.forceRareEvent("DOMAIN_EXPANSION", entries);
      case "JUMP":
      case "JUMP_LEFT":
      case "JUMP_RIGHT":
      case "HOP":
      case "FALL":
      case "CLIMB_UP":
      case "CLIMB_DOWN":
      case "PERCH":
      case "LAND":
        if (!this.prepareCanonicalReplacement(entries)) {
          return rejected("EXECUTION_REJECTED", "Canonical cleanup was rejected.");
        }
        appendTrace(entries, "CONTROLLER_REQUESTED", `forceLocomotion:${command.id}`);
        return this.fromBoolean(
          this.controller.forceLocomotion(command.id, DEV_OVERRIDE),
          entries
        );
      case "DROP":
        appendTrace(entries, "CONTROLLER_REQUESTED", "forceLocomotion:FALL");
        return this.fromBoolean(
          this.controller.forceLocomotion("FALL", DEV_OVERRIDE),
          entries
        );
      case "WATCH":
      case "CHASE": {
        if (!this.prepareCanonicalReplacement(entries)) {
          return rejected("EXECUTION_REJECTED", "Canonical cleanup was rejected.");
        }
        const state = command.id === "WATCH" ? "WATCHING_CURSOR" : "CHASE_MOUSE";
        appendTrace(entries, "CONTROLLER_REQUESTED", `forceCursorBehavior:${state}`);
        return this.fromBoolean(
          this.controller.forceCursorBehavior(state, DEV_OVERRIDE),
          entries
        );
      }
      case "RAGE":
        if (!this.prepareCanonicalReplacement(entries)) {
          return rejected("EXECUTION_REJECTED", "Canonical cleanup was rejected.");
        }
        appendTrace(entries, "CONTROLLER_REQUESTED", "beginInteractionReaction:RAGE");
        return this.fromBoolean(this.controller.beginInteractionReaction("RAGE"), entries);
      case "RESET_POSITION": {
        if (!this.prepareCanonicalReplacement(entries)) {
          return rejected("EXECUTION_REJECTED", "Canonical cleanup was rejected.");
        }
        appendTrace(entries, "CONTROLLER_REQUESTED", "PlatformService.resetWindowPosition");
        const reset = await this.ui.resetPosition();
        if (!reset) return rejected("RESET_UNAVAILABLE");
        this.controller.prepareForPositionReset();
        return accepted();
      }
      case "TOGGLE_AUTONOMY":
        await this.ui.updateAutonomy(snapshot.autonomyPaused);
        return accepted(snapshot.autonomyPaused ? "Autonomy enabled" : "Autonomy paused");
      case "PREVIEW_IDLE":
        return this.preview("idle");
      case "PREVIEW_BLINK":
        return this.preview("blink");
      case "PREVIEW_CRAWL":
        return this.preview("crawl");
      case "PREVIEW_LAUGH":
        return this.preview("laugh");
      case "PREVIEW_ANGRY":
        return this.preview("angry");
      case "PREVIEW_SLEEP":
        return this.preview("sleep");
      case "FACE_LEFT":
        this.animation.setDirection("left");
        return accepted();
      case "FACE_RIGHT":
        this.animation.setDirection("right");
        return accepted();
      case "TOGGLE_ANIMATION":
        if (this.animation.isPlaying()) this.animation.pause();
        else this.animation.resume();
        return accepted();
      case "SHOW_DIALOGUE":
        this.interactions.showRandomDialogue(performance.now());
        return accepted();
      case "HIDE_DIALOGUE":
        this.interactions.hideDialogue();
        return accepted();
      case "IRRITATION_UP": {
        const personality = this.controller.getPersonalitySnapshot();
        this.controller.setPersonalityValues({ irritation: personality.irritation + 10 });
        return accepted();
      }
      case "ENERGY_DOWN": {
        const personality = this.controller.getPersonalitySnapshot();
        this.controller.setPersonalityValues({ energy: personality.energy - 15 });
        return accepted();
      }
      case "BOREDOM_UP": {
        const personality = this.controller.getPersonalitySnapshot();
        this.controller.setPersonalityValues({ boredom: personality.boredom + 15 });
        return accepted();
      }
      case "CHAOS_UP": {
        const personality = this.controller.getPersonalitySnapshot();
        this.controller.setPersonalityValues({ chaos: personality.chaos + 15 });
        return accepted();
      }
      case "RESET_PERSONALITY":
        this.controller.resetPersonality();
        return accepted();
    }
  }

  private getHardPreconditionRejection(
    command: DevCommandId,
    snapshot: ThukunaSnapshot
  ): DevCommandExecution | null {
    if (snapshot.state === null) return rejected("NOT_STARTED");
    if (!snapshot.visible) return rejected("WINDOW_HIDDEN");
    if (
      snapshot.systemSafetyBlockReason !== null &&
      command !== "DIAGNOSTICS"
    ) {
      return rejected(
        snapshot.systemSafetyBlockReason,
        "System hard safety cannot be bypassed by developer commands."
      );
    }
    if (snapshot.state === "DRAGGED" && command !== "DIAGNOSTICS") {
      return rejected("DRAG_ACTIVE", "Release the active drag first.");
    }

    const capability = snapshot.platformCapabilities;
    const canMove = capability.supportsProgrammaticWindowMove;
    if (
      (command === "CRAWL" || command === "SPRINT" || command === "JUMP" ||
        command === "JUMP_LEFT" || command === "JUMP_RIGHT" || command === "HOP" ||
        command === "FALL" || command === "DROP" || command === "CHAOS_RUN" ||
        command === "LAND") &&
      !canMove
    ) return rejected("MOVEMENT_CAPABILITY_DISABLED");
    if (
      (command === "CLIMB_UP" || command === "CLIMB_DOWN") &&
      (!canMove || !capability.supportsEdgeClimbing)
    ) return rejected("MOVEMENT_CAPABILITY_DISABLED");
    if (command === "PERCH" && (!canMove || !capability.supportsPerching)) {
      return rejected("MOVEMENT_CAPABILITY_DISABLED");
    }
    if (
      (command === "WATCH" || command === "CHASE") &&
      !capability.supportsCursorScreenPosition
    ) return rejected("CURSOR_CAPABILITY_DISABLED");
    if (command === "CHASE" && !canMove) {
      return rejected("MOVEMENT_CAPABILITY_DISABLED");
    }
    if (command === "WAKE" && snapshot.state !== "SLEEPING") {
      return rejected("NOT_SLEEPING");
    }
    if (command === "DROP" && snapshot.state !== "PERCHED") {
      return rejected("NOT_PERCHED");
    }
    if (
      (command === "JUMP" || command === "JUMP_LEFT" ||
        command === "JUMP_RIGHT" || command === "HOP") &&
      !snapshot.grounded
    ) return rejected("NOT_GROUNDED");
    if (command === "FALL" && snapshot.grounded) {
      return rejected("NOT_ELEVATED", "Drag THUKUNA above the floor before forcing Fall.");
    }
    if (
      (command === "CLIMB_UP" || command === "CLIMB_DOWN" || command === "PERCH") &&
      !snapshot.nearLeftEdge && !snapshot.nearRightEdge
    ) return rejected("NOT_NEAR_EDGE");
    if (
      command === "RESET_POSITION" &&
      (!capability.supportsAbsoluteWindowPosition || !canMove)
    ) return rejected("RESET_UNAVAILABLE");
    if (command === "SHOW_DIALOGUE" && !this.ui.getSettings().dialogueEnabled) {
      return rejected("CURRENT_STATE_BLOCKED", "Dialogue is disabled in settings.");
    }
    return null;
  }

  private forceState(
    state: AutonomousStateName,
    entries: DevCommandTraceEntry[]
  ): DevCommandExecution {
    appendTrace(entries, "CONTROLLER_REQUESTED", `forceState:${state}`);
    return this.fromBoolean(this.controller.forceState(state, DEV_OVERRIDE), entries);
  }

  private forceRareEvent(
    event: "SPRINT" | "FALL_OVER" | "CREEPY_FREEZE" | "ZOOM_STARE" | "CHAOS_RUN" | "DOMAIN_EXPANSION",
    entries: DevCommandTraceEntry[]
  ): DevCommandExecution {
    if (!this.prepareCanonicalReplacement(entries)) {
      return rejected("EXECUTION_REJECTED", "Canonical cleanup was rejected.");
    }
    appendTrace(entries, "CONTROLLER_REQUESTED", `forceRareEvent:${event}`);
    const started = this.controller.forceRareEvent(event, DEV_OVERRIDE);
    if (started) appendTrace(entries, "EVENT_FORCE_STARTED", event);
    return this.fromBoolean(started, entries);
  }

  private prepareCanonicalReplacement(entries: DevCommandTraceEntry[]): boolean {
    const state = this.controller.getSnapshot().state;
    appendTrace(entries, "CLEANUP_STARTED", `state=${state ?? "NONE"}`);
    if (state !== null && state !== "IDLE" && state !== "DRAGGED") {
      if (!this.controller.forceState("IDLE", DEV_OVERRIDE)) return false;
    }
    const cleaned = this.controller.getSnapshot();
    appendTrace(
      entries,
      "CLEANUP_FINISHED",
      `state=${cleaned.state ?? "NONE"}; rare=${cleaned.rareEvent.activeEvent ?? "NONE"}`
    );
    return true;
  }

  private preview(animation: AnimationName): DevCommandExecution {
    this.animation.play(animation, { restart: true });
    return accepted();
  }

  private fromBoolean(
    value: boolean,
    entries: DevCommandTraceEntry[]
  ): DevCommandExecution {
    if (!value) return rejected("EXECUTION_REJECTED");
    const actual = this.getActualState();
    appendTrace(entries, "STATE_ENTERED", actual.state ?? "NONE");
    appendTrace(entries, "ANIMATION_SELECTED", actual.animation ?? "NONE");
    return accepted();
  }
}
