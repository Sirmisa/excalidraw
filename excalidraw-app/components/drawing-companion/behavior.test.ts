import { createCompanionScheduler } from "./behavior";

import type { CompanionSnapshot, CompanionClock } from "./behavior";

let scheduler: ReturnType<typeof createCompanionScheduler>;
let snapshots: CompanionSnapshot[];
let random = vi.fn(() => 0);
const clock: CompanionClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (id) => window.clearTimeout(id),
};
const latest = () => snapshots.at(-1)!;
const advance = (ms: number) => vi.advanceTimersByTime(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  snapshots = [];
  random = vi.fn(() => 0);
  scheduler = createCompanionScheduler({
    clock,
    random,
    tipsEnabled: true,
    onChange: (snapshot) => snapshots.push(snapshot),
  });
});
afterEach(() => {
  scheduler.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

it("idle_activity_idle_has_minimum_intervals_and_no_immediate_repeat", () => {
  scheduler.setActive(true);
  advance(44_999);
  expect(latest()).toEqual({ pose: "idle", bubble: null });
  advance(1);
  expect(latest().pose).toBe("drawing");
  advance(7_999);
  expect(latest().pose).toBe("drawing");
  advance(1);
  expect(latest().pose).toBe("idle");
  advance(45_000);
  expect(latest().pose).toBe("eating");
});

it("uses_maximum_activity_and_duration_bounds", () => {
  random.mockReturnValue(1 - Number.EPSILON);
  scheduler.setActive(true);
  advance(89_999);
  expect(latest().pose).toBe("idle");
  advance(1);
  expect(latest().pose).toBe("bathroom");
  advance(14_999);
  expect(latest().pose).toBe("bathroom");
  advance(1);
  expect(latest().pose).toBe("idle");
});

it.each([
  [0, 480_000],
  [1 - Number.EPSILON, 720_000],
])("tips_begin_after_480000_to_720000ms (%s)", (value, delay) => {
  random.mockReturnValue(value);
  scheduler.setActive(true);
  advance(delay - 1);
  expect(latest().bubble?.kind).not.toBe("tip");
  advance(1);
  expect(latest().bubble?.kind).toBe("tip");
});

it("tip_lives_for_8000ms", () => {
  scheduler.setActive(true);
  advance(480_000);
  expect(latest().bubble).toEqual({ kind: "tip", id: "pan" });
  advance(7_999);
  expect(latest().bubble?.kind).toBe("tip");
  advance(1);
  expect(latest().bubble).toBeNull();
});

it("personality_lives_for_5000ms", () => {
  scheduler.setActive(true);
  advance(212_000);
  expect(latest().bubble?.kind).toBe("personality");
  advance(4_999);
  expect(latest().bubble?.kind).toBe("personality");
  advance(1);
  expect(latest().bubble).toBeNull();
});

it("personality_requires_180000ms_cooldown_and_25_percent_chance", () => {
  scheduler.setActive(true);
  advance(159_000);
  expect(snapshots.every((s) => s.bubble === null)).toBe(true);
  advance(52_999);
  random.mockReturnValueOnce(0.25);
  advance(1);
  expect(latest().bubble).toBeNull();
  advance(53_000);
  expect(latest().bubble?.kind).toBe("personality");
  advance(159_000);
  expect(latest().bubble).toBeNull();
  advance(53_000);
  expect(latest().bubble?.kind).toBe("personality");
});

it("does_not_repeat_previous_tip", () => {
  scheduler.setActive(true);
  advance(480_000);
  expect(latest().bubble).toEqual({ kind: "tip", id: "pan" });
  advance(480_000);
  expect(latest().bubble).toEqual({ kind: "tip", id: "shortcuts" });
});

it("tip_replacement_gets_a_fresh_dismissal_deadline", () => {
  scheduler.setActive(true);
  // Minimum-length routines finish every 53s. Decline messages until 477s.
  advance(159_000);
  for (let i = 0; i < 5; i++) {
    advance(52_999);
    random.mockReturnValueOnce(0.5);
    advance(1);
  }
  advance(53_000);
  expect(latest().bubble?.kind).toBe("personality");
  advance(3_000);
  expect(latest().bubble?.kind).toBe("tip");
  advance(2_000);
  expect(latest().bubble?.kind).toBe("tip");
  advance(5_999);
  expect(latest().bubble?.kind).toBe("tip");
  advance(1);
  expect(latest().bubble).toBeNull();
});

it("skips_personality_while_a_tip_is_displayed", () => {
  scheduler.setActive(true);
  scheduler.setTipsEnabled(false);
  advance(48_000);
  scheduler.setTipsEnabled(true);
  advance(111_000);
  for (let i = 0; i < 6; i++) {
    advance(52_999);
    random.mockReturnValueOnce(0.5);
    advance(1);
  }
  advance(51_000);
  expect(latest().bubble).toEqual({ kind: "tip", id: "pan" });
  advance(2_000);
  expect(latest().pose).toBe("idle");
  expect(latest().bubble).toEqual({ kind: "tip", id: "pan" });
});

it("disabling_tips_keeps_activities_running", () => {
  scheduler.setActive(true);
  advance(480_000);
  scheduler.setTipsEnabled(false);
  expect(latest().bubble).toBeNull();
  advance(480_000);
  expect(snapshots.slice(-5).some((s) => s.pose !== "idle")).toBe(true);
  expect(latest().bubble?.kind).not.toBe("tip");
  scheduler.setTipsEnabled(true);
  advance(479_999);
  expect(latest().bubble?.kind).not.toBe("tip");
  advance(1);
  expect(latest().bubble?.kind).toBe("tip");
});

it("activation_is_idempotent_and_deactivation_resets_with_no_catchup", () => {
  scheduler.setActive(true);
  advance(20_000);
  scheduler.setActive(true);
  expect(vi.getTimerCount()).toBe(2);
  advance(25_000);
  expect(latest().pose).toBe("drawing");
  scheduler.setActive(false);
  expect(latest()).toEqual({ pose: "idle", bubble: null });
  const count = snapshots.length;
  advance(1_200_000);
  expect(snapshots).toHaveLength(count);
  scheduler.setActive(true);
  advance(44_999);
  expect(latest()).toEqual({ pose: "idle", bubble: null });
  scheduler.dispose();
  const disposedCount = snapshots.length;
  scheduler.setActive(true);
  advance(1_200_000);
  expect(snapshots).toHaveLength(disposedCount);
});
