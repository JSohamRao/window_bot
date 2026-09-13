import {
  getAnimationFramePaths,
  getDomainFramePaths,
  IDLE_FRAME,
  LEGACY_FALLBACK_FRAME,
  resolveAnimationFrames,
  type AnimationName
} from "./animations/thukunaAnimations";
import {
  AnimationController,
  type AnimationSnapshot
} from "./engine/AnimationController";
import { AssetManager } from "./engine/AssetManager";
import type { AssetPreloadReport } from "./engine/AssetManager";
import { DialogueController } from "./engine/DialogueController";
import { EventVisualController } from "./engine/EventVisualController";
import {
  InteractionController,
  type InteractionPoint
} from "./engine/InteractionController";
import {
  ThukunaController,
  type ThukunaSnapshot
} from "./engine/ThukunaController";
import type { DialogueCategory } from "./dialogue/thukunaDialogue";
import type { RareEventName } from "./config/rareEventConfig";
import { DevCommandController } from "./dev/DevCommandController";
import { createDevCommandPanel, type DevCommandPanel } from "./dev/DevCommandPanel";
import { ThukunaDevCommandRuntime } from "./dev/ThukunaDevCommandRuntime";
import { DEVELOPMENT_CONTROLS_ENABLED, type DevCommandId } from "./dev/devCommandRegistry";
import {
  DEFAULT_THUKUNA_SETTINGS,
  sanitizeThukunaSettings,
  type ThukunaSettings as SharedThukunaSettings
} from "../shared/settings";
import {
  SystemAwarenessController,
  type SystemAwarenessControllerSnapshot
} from "./engine/SystemAwarenessController";
import {
  ProductivityTimerController
} from "./engine/ProductivityTimerController";
import type { ProductivityTimerSnapshot } from "../shared/productivityTimer";

const requireElement = <ElementType extends Element>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Required renderer element was not found: ${selector}`);
  }
  return element;
};

const petCanvas = requireElement<HTMLElement>("#pet-canvas");
const petStage = requireElement<HTMLElement>("#pet-stage");
const directionLayer = requireElement<HTMLElement>("#direction-layer");
const motionLayer = requireElement<HTMLElement>("#motion-layer");
const interactionLayer = requireElement<HTMLElement>("#interaction-layer");
const eventLayer = requireElement<HTMLElement>("#event-layer");
const locomotionVisualLayer = requireElement<HTMLElement>("#locomotion-visual-layer");
const frameLayer = requireElement<HTMLElement>("#frame-layer");
const thukuna = requireElement<HTMLImageElement>("#thukuna");
const dialogueBubble = requireElement<HTMLOutputElement>("#dialogue-bubble");
const debugOverlay = requireElement<HTMLOutputElement>("#animation-debug");

console.info("[THUKUNA] Renderer initialized.");

let draggingPointerId: number | null = null;
let pendingDragPoint: ScreenPoint | null = null;
let dragFrame: number | null = null;
let thukunaController: ThukunaController | null = null;
let interactionController: InteractionController | null = null;
let dialogueController: DialogueController | null = null;
let animationController: AnimationController<AnimationName> | null = null;
let devCommandController: DevCommandController | null = null;
let devCommandPanel: DevCommandPanel | null = null;
let systemAwarenessController: SystemAwarenessController | null = null;
let productivityTimerController: ProductivityTimerController | null = null;
let currentSettings: SharedThukunaSettings = { ...DEFAULT_THUKUNA_SETTINGS };
let runtimeVisible = true;
const bridgeUnsubscribers: Array<() => void> = [];

const pointFromEvent = (event: PointerEvent): ScreenPoint => ({
  screenX: event.screenX,
  screenY: event.screenY
});

const interactionPointFromEvent = (event: PointerEvent): InteractionPoint => ({
  x: event.screenX,
  y: event.screenY
});

const sendPendingDragPoint = (): void => {
  dragFrame = null;
  if (pendingDragPoint === null) {
    return;
  }

  window.thukunaWindow.moveDrag(pendingDragPoint);
  pendingDragPoint = null;
};

const finishPointer = (event: PointerEvent, cancelled = false): void => {
  if (event.pointerId !== draggingPointerId) {
    return;
  }

  const wasDragging = interactionController?.isDragging() ?? false;
  if (wasDragging) {
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
    }
    pendingDragPoint = pointFromEvent(event);
    sendPendingDragPoint();
    window.thukunaWindow.endDrag();
    document.body.classList.remove("is-dragging");
  }

  const pointerId = draggingPointerId;
  draggingPointerId = null;
  pendingDragPoint = null;
  dragFrame = null;

  const point = interactionPointFromEvent(event);
  if (cancelled) {
    interactionController?.pointerCancel(point, performance.now());
  } else {
    interactionController?.pointerUp(point, performance.now());
  }

  if (petStage.hasPointerCapture(pointerId)) {
    petStage.releasePointerCapture(pointerId);
  }
};

petStage.addEventListener("pointerdown", (event) => {
  petStage.focus({ preventScroll: true });
  if (
    latestSystemAwarenessSnapshot?.runtime.hardPaused === true ||
    draggingPointerId !== null ||
    !interactionController?.pointerDown(
      event.button,
      interactionPointFromEvent(event),
      performance.now()
    )
  ) {
    return;
  }

  draggingPointerId = event.pointerId;
  petStage.setPointerCapture(event.pointerId);
});

petStage.addEventListener("pointermove", (event) => {
  if (event.pointerId !== draggingPointerId) {
    return;
  }

  const currentPoint = pointFromEvent(event);
  const result = interactionController?.pointerMove(
    interactionPointFromEvent(event),
    performance.now()
  );
  if (result?.dragStarted && result.dragOrigin !== null) {
    event.preventDefault();
    document.body.classList.add("is-dragging");
    window.thukunaWindow.startDrag({
      screenX: result.dragOrigin.x,
      screenY: result.dragOrigin.y
    });
  }

  if (!result?.dragging) {
    return;
  }
  pendingDragPoint = currentPoint;
  if (dragFrame === null) {
    dragFrame = requestAnimationFrame(sendPendingDragPoint);
  }
});

petStage.addEventListener("pointerup", (event) => finishPointer(event));
petStage.addEventListener("pointercancel", (event) =>
  finishPointer(event, true)
);
petStage.addEventListener("lostpointercapture", (event) =>
  finishPointer(event, true)
);

let latestAnimationSnapshot: AnimationSnapshot<AnimationName> | null = null;
let latestThukunaSnapshot: ThukunaSnapshot | null = null;
let latestSystemAwarenessSnapshot: SystemAwarenessControllerSnapshot | null = null;
let latestProductivityTimerSnapshot: ProductivityTimerSnapshot | null = null;

const seconds = (milliseconds: number): string =>
  `${(milliseconds / 1000).toFixed(1)}s`;

const DOMAIN_FRAME_OFFSETS: Partial<Record<AnimationName, number>> = {
  domain_charge: 0,
  domain_expand: 8,
  domain_peak: 12,
  domain_collapse: 15,
  domain_recover: 18
};

const renderDebugOverlay = (): void => {
  const animation = latestAnimationSnapshot;
  const behavior = latestThukunaSnapshot;
  const interaction = interactionController?.getSnapshot(performance.now());
  if (animation === null || behavior === null || interaction === undefined) {
    return;
  }

  const stateDuration =
    behavior.stateDurationMs === null ? "--" : seconds(behavior.stateDurationMs);
  const dev = devCommandController?.getTelemetry();
  const commandResult = dev?.result;
  if (dev !== undefined) devCommandPanel?.update(dev);
  if (latestSystemAwarenessSnapshot !== null) {
    devCommandPanel?.updateSystemAwareness(
      behavior.state,
      latestSystemAwarenessSnapshot
    );
  }
  if (latestProductivityTimerSnapshot !== null) {
    devCommandPanel?.updateProductivityTimer(latestProductivityTimerSnapshot);
  }
  const domainActive = behavior.state === "DOMAIN_EXPANSION";
  const domainFrameOffset = animation.animation === null
    ? undefined
    : DOMAIN_FRAME_OFFSETS[animation.animation];
  const domainFrame = domainActive && domainFrameOffset !== undefined
    ? domainFrameOffset + animation.frameIndex + 1
    : 0;
  const domainStage = domainActive &&
      behavior.stateElapsedMs >= 450 &&
      behavior.stateElapsedMs < 700
    ? "DIALOGUE"
    : behavior.eventVisual.phase;
  const eventTransform = debugOverlay.hidden
    ? "--"
    : getComputedStyle(eventLayer).transform;
  debugOverlay.textContent = [
    `LAST KEY: ${dev?.lastKey ?? "--"}`,
    `LAST COMMAND: ${dev?.lastCommand ?? "--"}`,
    `COMMAND RESULT: ${commandResult === null || commandResult === undefined ? "--" : commandResult.accepted ? "ACCEPTED" : "REJECTED"}`,
    `REJECTION: ${commandResult?.reason ?? "--"}${commandResult?.detail === undefined ? "" : ` (${commandResult.detail})`}`,
    `SOURCE: ${commandResult?.source ?? "--"}  DEV OVERRIDE:${commandResult?.devOverride ? "YES" : "NO"}`,
    `REQUEST: ${commandResult?.requestedState ?? "--"} / ${commandResult?.requestedAnimation ?? "--"}`,
    `TRACE: ${commandResult?.trace.map((entry) => entry.stage).join(">") ?? "--"}`,
    `STATE: ${behavior.state ?? "none"}  ${seconds(behavior.stateElapsedMs)}/${stateDuration}`,
    `ANIMATION: ${animation.animation ?? "none"}  ${animation.playing ? "PLAY" : "PAUSE"}`,
    `FRAME: ${animation.frameCount === 0 ? 0 : animation.frameIndex + 1}/${animation.frameCount}  SCALE: ${animation.frameScale.toFixed(3)}`,
    `ANCHOR: ${animation.anchor}  DIR: ${animation.direction.toUpperCase()}`,
    `MOVE: ${behavior.movementMode}/${behavior.locomotion.action}  ${Math.round(behavior.movementSpeedPxPerSecond)}px/s`,
    `LOCO: ${behavior.locomotion.phase}  SIDE:${behavior.locomotion.direction.toUpperCase()}`,
    `VELOCITY: ${behavior.velocityX.toFixed(1)},${behavior.velocityY.toFixed(1)}  GROUND: ${behavior.grounded}`,
    `WINDOW: ${window.outerWidth}x${window.outerHeight} @ ${behavior.windowX},${behavior.windowY}`,
    `STAGE: ${petStage.offsetWidth}x${petStage.offsetHeight}`,
    `PLATFORM: ${behavior.platformCapabilities.platform.toUpperCase()}/${behavior.platformCapabilities.displayServer.toUpperCase()}`,
    `CAP MOVE:${behavior.platformCapabilities.supportsProgrammaticWindowMove ? "Y" : "N"} CURSOR:${behavior.platformCapabilities.supportsCursorScreenPosition ? "Y" : "N"}`,
    `CAP CLIMB:${behavior.platformCapabilities.supportsEdgeClimbing ? "Y" : "N"} PERCH:${behavior.platformCapabilities.supportsPerching ? "Y" : "N"}`,
    `MODE: ${behavior.powerPolicy.mode}  AUTO:${behavior.autonomyPaused ? "PAUSED" : "RUN"}`,
    `SESSION: ${behavior.systemAwareness.sessionState.toUpperCase()}  USER: ${behavior.systemAwareness.activityState.toUpperCase()}  IDLE:${behavior.systemAwareness.idleSeconds}s`,
    `POWER: ${behavior.systemAwareness.powerSource.toUpperCase()}  AWARENESS:${behavior.systemRuntimeContext.hardPaused ? "PAUSED" : "RUNNING"}`,
    `EFFECTIVE POLICY: ${behavior.powerPolicy.mode}+${behavior.systemRuntimeContext.effectivePolicyLabel}`,
    `SYSTEM LAST: ${behavior.systemAwareness.lastTransition === null ? "--" : `${behavior.systemAwareness.lastTransition.kind}:${behavior.systemAwareness.lastTransition.from}->${behavior.systemAwareness.lastTransition.to}`}`,
    `IDLE SAMPLER: ${behavior.systemAwareness.idleSamplerActive ? "ACTIVE" : "STOPPED"}  LISTENERS:${behavior.systemAwareness.listenerCount}  HISTORY:${latestSystemAwarenessSnapshot?.transitionHistory.length ?? 0}`,
    `EDGE LEFT:${behavior.nearLeftEdge ? "Y" : "N"} RIGHT:${behavior.nearRightEdge ? "Y" : "N"}`,
    `CURSOR DX:${behavior.cursor.horizontalDeltaPx === null ? "--" : Math.round(behavior.cursor.horizontalDeltaPx)} DY:${behavior.cursor.verticalDeltaPx == null ? "--" : Math.round(behavior.cursor.verticalDeltaPx)}`,
    `CURSOR SAME:${behavior.cursor.sameDisplay ? "Y" : "N"} MODE:${behavior.cursor.mode} PLAN:${behavior.cursorPlan}`,
    `CURSOR Q I:${behavior.cursor.queryCounts.IDLE} W:${behavior.cursor.queryCounts.WATCH} C:${behavior.cursor.queryCounts.CHASE}`,
    `RARE: ${behavior.rareEvent.activeEvent ?? "NONE"}  OVERRIDE:${behavior.interactionOverride ? "Y" : "N"}`,
    `DOMAIN ACTIVE:${domainActive ? "YES" : "NO"} ${Math.round(behavior.stateElapsedMs)}ms STAGE:${domainStage}`,
    `DOMAIN FRAME:${domainFrame}/20 EVENT TRANSFORM:${eventTransform}`,
    `EVENT ACT:${behavior.eventVisual.activationCount} CLEAN:${behavior.eventVisual.cleanupCount}`,
    `CLICKS:${interaction.clickCount} RAGE:${behavior.rageActive ? "Y" : "N"} DIALOGUE:${interaction.dialogue.active ? "Y" : "N"}`
  ].join("\n");
};

const updateAnimationSnapshot = (
  snapshot: AnimationSnapshot<AnimationName>
): void => {
  latestAnimationSnapshot = snapshot;
  document.body.classList.toggle("animation-paused", !snapshot.playing);
  renderDebugOverlay();
};

const updateThukunaSnapshot = (snapshot: ThukunaSnapshot): void => {
  latestThukunaSnapshot = snapshot;
  productivityTimerController?.notifyReactionOpportunity();
  renderDebugOverlay();
};

const installDebugControls = (
  animationController: AnimationController<AnimationName>,
  controller: ThukunaController,
  interactions: InteractionController,
  assetReport: AssetPreloadReport
): () => void => {
  const domainPaths = getDomainFramePaths();
  const loadedAssets = new Set(assetReport.loaded);
  const domainAssetError = domainPaths.length !== 20
    ? `Domain manifest has ${domainPaths.length}/20 frames.`
    : domainPaths.find((path) => !loadedAssets.has(path)) === undefined
      ? null
      : `Domain asset unavailable: ${domainPaths.find((path) => !loadedAssets.has(path))}`;
  const runtime = new ThukunaDevCommandRuntime(
    controller,
    animationController,
    interactions,
    {
      toggleDiagnostics: () => {
        debugOverlay.hidden = !debugOverlay.hidden;
        devCommandPanel?.setVisible(!debugOverlay.hidden);
        controller.setDebugLogging(!debugOverlay.hidden);
        latestAnimationSnapshot = animationController.getSnapshot();
        latestThukunaSnapshot = controller.getSnapshot();
      },
      updateAutonomy: async (enabled) => {
        const settings = await window.thukunaWindow.updateSetting("autonomyEnabled", enabled);
        currentSettings = sanitizeThukunaSettings(settings);
        controller.applySettings(currentSettings);
      },
      resetPosition: () => window.thukunaWindow.resetPosition(),
      getSettings: () => currentSettings,
      validateCommandAssets: (command: DevCommandId) =>
        command === "DOMAIN" ? domainAssetError : null
    }
  );
  const devControls = new DevCommandController(runtime, (telemetry) => {
    devCommandPanel?.update(telemetry);
    renderDebugOverlay();
  });
  devCommandController = devControls;
  if (DEVELOPMENT_CONTROLS_ENABLED) {
    devCommandPanel = createDevCommandPanel(petCanvas, devControls, {
      startFiveSecondTimer: () => {
        void productivityTimerController?.startPreset("development-5-seconds");
      },
      startTenSecondTimer: () => {
        void productivityTimerController?.startPreset("development-10-seconds");
      }
    });
  }
  const keyHandler = (event: KeyboardEvent): void => {
    void devControls.handleKey(event);
  };
  window.addEventListener("keydown", keyHandler);
  return () => {
    window.removeEventListener("keydown", keyHandler);
    devCommandPanel?.destroy();
    devCommandPanel = null;
    if (devCommandController === devControls) devCommandController = null;
  };
};

const initializeAnimationEngine = async (): Promise<void> => {
  const [settings, capabilities] = await Promise.all([
    window.thukunaWindow.getSettings(),
    window.thukunaWindow.getPlatformCapabilities()
  ]);
  currentSettings = sanitizeThukunaSettings(settings);
  const assetManager = new AssetManager(IDLE_FRAME, LEGACY_FALLBACK_FRAME);
  const report = await assetManager.preload(getAnimationFramePaths());
  console.info(`[THUKUNA] Preloaded ${report.loaded.length} sprite asset(s).`);
  if (report.failed.length > 0) {
    console.warn(
      `[THUKUNA] ${report.failed.length} sprite(s) failed to preload; idle fallback will be used.`,
      report.failed
    );
  }

  animationController = new AnimationController<AnimationName>(
    thukuna,
    directionLayer,
    motionLayer,
    interactionLayer,
    resolveAnimationFrames((path) => assetManager.resolve(path)),
    "right",
    updateAnimationSnapshot,
    frameLayer
  );
  const eventVisualController = new EventVisualController(eventLayer);

  thukunaController = new ThukunaController(
    animationController,
    {
      moveBy: (deltaX, deltaY = 0) =>
        window.thukunaWindow.moveBy(deltaX, deltaY),
      getPosition: () => window.thukunaWindow.getPosition()
    },
    () => ({ x: window.screenX, y: window.screenY }),
    updateThukunaSnapshot,
    undefined,
    { getCursorPosition: () => window.thukunaWindow.getCursorPosition() },
    eventVisualController,
    locomotionVisualLayer,
    capabilities
  );
  const dialogue = new DialogueController(dialogueBubble);
  dialogueController = dialogue;
  const rareDialogueCategories: Readonly<Record<RareEventName, DialogueCategory>> = {
    SPRINT: "sprint",
    FALL_OVER: "fall",
    CREEPY_FREEZE: "freeze",
    ZOOM_STARE: "zoom",
    CHAOS_RUN: "chaos",
    DOMAIN_EXPANSION: "domain"
  };
  thukunaController.setMouseDialogueHandler(() => {
    dialogue.show("mouse", performance.now());
  });
  thukunaController.setRareEventDialogueHandler((event, bypassCooldown) => {
    dialogue.show(rareDialogueCategories[event], performance.now(), {
      bypassCooldown,
      replace: bypassCooldown,
      preferredLine:
        event === "DOMAIN_EXPANSION" ? "DOMAIN EXPANSION." : undefined
    });
  });
  interactionController = new InteractionController(
    thukunaController,
    dialogue,
    undefined,
    renderDebugOverlay
  );
  thukunaController.setInteractionUpdate((timestamp) =>
    interactionController?.update(timestamp)
  );
  const applySettings = (settings: SharedThukunaSettings): void => {
    currentSettings = sanitizeThukunaSettings(settings);
    document.body.classList.toggle("low-power-mode", currentSettings.lowPowerMode);
    dialogueController?.setEnabled(
      runtimeVisible &&
      currentSettings.dialogueEnabled &&
      latestSystemAwarenessSnapshot?.runtime.hardPaused !== true
    );
    thukunaController?.applySettings(currentSettings);
    renderDebugOverlay();
  };
  const applyVisibility = (visible: boolean): void => {
    runtimeVisible = visible;
    document.body.classList.toggle("hidden-mode", !visible);
    if (!visible) {
      if (dragFrame !== null) cancelAnimationFrame(dragFrame);
      if (draggingPointerId !== null || interactionController?.hasPointerSession()) {
        window.thukunaWindow.endDrag();
        interactionController?.cancelPointerSession(performance.now());
      }
      draggingPointerId = null;
      pendingDragPoint = null;
      dragFrame = null;
      document.body.classList.remove("is-dragging");
    }
    thukunaController?.setRuntimeVisible(visible);
    dialogueController?.setEnabled(
      visible &&
      currentSettings.dialogueEnabled &&
      latestSystemAwarenessSnapshot?.runtime.hardPaused !== true
    );
    if (!visible) animationController?.pause();
    renderDebugOverlay();
  };
  bridgeUnsubscribers.push(
    window.thukunaWindow.onSettingsChanged(applySettings),
    window.thukunaWindow.onVisibilityChanged(applyVisibility),
    window.thukunaWindow.onResetPositionRequested(() => {
      thukunaController?.prepareForPositionReset();
    })
  );
  applySettings(currentSettings);
  systemAwarenessController = new SystemAwarenessController(
    window.thukunaWindow,
    (snapshot) => {
      latestSystemAwarenessSnapshot = snapshot;
      if (snapshot.runtime.hardPaused) {
        if (dragFrame !== null) cancelAnimationFrame(dragFrame);
        if (draggingPointerId !== null || interactionController?.hasPointerSession()) {
          window.thukunaWindow.endDrag();
          interactionController?.cancelPointerSession(performance.now());
        }
        draggingPointerId = null;
        pendingDragPoint = null;
        dragFrame = null;
        document.body.classList.remove("is-dragging");
      }
      thukunaController?.applySystemAwareness(snapshot.awareness);
      productivityTimerController?.setSystemSessionState(
        snapshot.awareness.sessionState
      );
      dialogueController?.setEnabled(
        runtimeVisible &&
        currentSettings.dialogueEnabled &&
        !snapshot.runtime.hardPaused
      );
      renderDebugOverlay();
    }
  );
  await systemAwarenessController.start();
  bridgeUnsubscribers.push(() => systemAwarenessController?.dispose());
  productivityTimerController = new ProductivityTimerController(
    window.thukunaWindow,
    (snapshot) => {
      latestProductivityTimerSnapshot = snapshot;
      devCommandPanel?.updateProductivityTimer(snapshot);
      renderDebugOverlay();
    },
    (snapshot) => {
      if (thukunaController?.reactToTimerCompletion() !== true) return false;
      dialogueController?.show("timer", performance.now(), {
        bypassCooldown: true,
        replace: true,
        preferredLine: snapshot.kind === "focus"
          ? "Focus session complete!"
          : "Timer done!"
      });
      return true;
    }
  );
  productivityTimerController.setSystemSessionState(
    latestSystemAwarenessSnapshot?.awareness.sessionState ?? "active"
  );
  await productivityTimerController.start();
  bridgeUnsubscribers.push(() => productivityTimerController?.dispose());
  bridgeUnsubscribers.push(installDebugControls(
    animationController,
    thukunaController,
    interactionController,
    report
  ));
  thukunaController.start();
  petCanvas.classList.add("is-ready");

  window.addEventListener(
    "beforeunload",
    () => {
      thukunaController?.destroy();
      systemAwarenessController?.dispose();
      systemAwarenessController = null;
      productivityTimerController?.dispose();
      productivityTimerController = null;
      thukunaController?.setMouseDialogueHandler(null);
      thukunaController?.setRareEventDialogueHandler(null);
      interactionController?.hideDialogue();
      for (const unsubscribe of bridgeUnsubscribers.splice(0)) unsubscribe();
      animationController?.destroy();
    },
    { once: true }
  );
};

void initializeAnimationEngine().catch((error) => {
  console.error("[THUKUNA] Animation engine initialization failed.", error);
  thukuna.src = LEGACY_FALLBACK_FRAME;
  petCanvas.classList.add("is-ready");
});
