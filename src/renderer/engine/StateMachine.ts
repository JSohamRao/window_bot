export interface State<StateName extends string, Context> {
  readonly name: StateName;
  readonly durationMs: number | null;
  enter(context: Context): void;
  update(context: Context, deltaTimeMs: number): void;
  exit(context: Context): void;
}

export interface StateMachineSnapshot<StateName extends string> {
  state: StateName | null;
  previousState: StateName | null;
  elapsedMs: number;
  durationMs: number | null;
}

type TransitionLogger<StateName extends string> = (
  previous: StateName | null,
  next: StateName
) => void;

export class StateMachine<StateName extends string, Context> {
  private currentState: State<StateName, Context> | null = null;
  private previousStateName: StateName | null = null;
  private elapsedMs = 0;

  public constructor(
    states: readonly State<StateName, Context>[],
    private readonly transitionLogger?: TransitionLogger<StateName>
  ) {
    this.states = new Map(states.map((state) => [state.name, state]));
    if (this.states.size !== states.length) {
      throw new Error("State names must be unique.");
    }
  }

  private readonly states: ReadonlyMap<StateName, State<StateName, Context>>;

  public start(name: StateName, context: Context): void {
    if (this.currentState !== null) {
      throw new Error("StateMachine has already been started.");
    }
    this.enterState(name, context);
  }

  public transition(name: StateName, context: Context): boolean {
    if (this.currentState?.name === name) {
      return false;
    }

    const previous = this.currentState;
    previous?.exit(context);
    this.previousStateName = previous?.name ?? null;
    this.enterState(name, context);
    return true;
  }

  public restart(context: Context): void {
    if (this.currentState === null) {
      throw new Error("StateMachine has not been started.");
    }
    const state = this.currentState;
    state.exit(context);
    this.previousStateName = state.name;
    this.enterState(state.name, context);
  }

  public update(context: Context, deltaTimeMs: number): void {
    if (this.currentState === null) {
      return;
    }
    const safeDelta = this.advanceElapsed(deltaTimeMs);
    this.currentState.update(context, safeDelta);
  }

  public advanceElapsed(deltaTimeMs: number): number {
    const safeDelta = Number.isFinite(deltaTimeMs) ? Math.max(deltaTimeMs, 0) : 0;
    this.elapsedMs += safeDelta;
    return safeDelta;
  }

  public getCurrentState(): StateName | null {
    return this.currentState?.name ?? null;
  }

  public getElapsedMs(): number {
    return this.elapsedMs;
  }

  public getSnapshot(): StateMachineSnapshot<StateName> {
    return {
      state: this.currentState?.name ?? null,
      previousState: this.previousStateName,
      elapsedMs: this.elapsedMs,
      durationMs: this.currentState?.durationMs ?? null
    };
  }

  private enterState(name: StateName, context: Context): void {
    const nextState = this.states.get(name);
    if (nextState === undefined) {
      throw new Error(`Unknown state: ${name}`);
    }

    const previousName = this.previousStateName;
    this.currentState = nextState;
    this.elapsedMs = 0;
    this.transitionLogger?.(previousName, name);
    nextState.enter(context);
  }
}
