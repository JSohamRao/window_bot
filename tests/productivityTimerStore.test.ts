import assert from "node:assert/strict";
import test from "node:test";
import {
  ProductivityTimerStore,
  isPersistedProductivityTimer,
  type ProductivityTimerFileIo
} from "../src/main/productivityTimer/ProductivityTimerStore";

class MemoryIo implements ProductivityTimerFileIo {
  public files = new Map<string, string>();
  public writes = 0;
  public async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return value;
  }
  public async ensureDirectory(): Promise<void> {}
  public async write(path: string, contents: string): Promise<void> {
    this.writes += 1; this.files.set(path, contents);
  }
  public async replace(source: string, destination: string): Promise<void> {
    const value = this.files.get(source);
    if (value === undefined) throw new Error("missing temporary file");
    this.files.set(destination, value); this.files.delete(source);
  }
  public async remove(path: string): Promise<void> { this.files.delete(path); }
}

const running = {
  version: 1, state: "running", timerId: "timer", durationMs: 60_000,
  kind: "focus", label: "Focus", startedAt: 1, deadlineAt: 60_001
} as const;

test("persisted timer validator accepts narrow lifecycle state only", () => {
  assert.equal(isPersistedProductivityTimer(running), true);
  assert.equal(isPersistedProductivityTimer({ ...running, kind: "unknown" }), false);
  assert.equal(isPersistedProductivityTimer({ ...running, durationMs: -1 }), false);
  assert.equal(isPersistedProductivityTimer({ ...running, timerId: "x".repeat(129) }), false);
});

test("timer store atomically writes and restores a running deadline", async () => {
  const io = new MemoryIo();
  const store = new ProductivityTimerStore("C:/data/timer.json", io);
  await store.save(running);
  assert.equal(io.files.has("C:/data/timer.json.tmp"), false);
  assert.deepEqual(await store.load(), running);
  assert.equal(store.getWriteCount(), 1);
});

test("timer store clear is recoverable as an empty timer state", async () => {
  const io = new MemoryIo();
  const store = new ProductivityTimerStore("C:/data/timer.json", io);
  await store.save(running);
  await store.clear();
  assert.equal(await store.load(), null);
  assert.equal(store.getClearCount(), 1);
});

test("invalid and malformed persistence fail closed without crashing", async () => {
  const io = new MemoryIo();
  const warnings: string[] = [];
  const store = new ProductivityTimerStore(
    "C:/data/timer.json", io, (message) => warnings.push(message)
  );
  io.files.set("C:/data/timer.json", "not json");
  assert.equal(await store.load(), null);
  io.files.set("C:/data/timer.json", JSON.stringify({ state: "running" }));
  assert.equal(await store.load(), null);
  assert.equal(warnings.length, 2);
});
