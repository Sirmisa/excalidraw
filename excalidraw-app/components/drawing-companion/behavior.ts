export type CompanionActivity = "drawing" | "eating" | "drinking" | "sleeping" | "bathroom";
export type CompanionPose = "idle" | CompanionActivity;
export type CompanionTipId = "pan" | "shortcuts" | "group" | "undo";
export type CompanionBubble = { kind: "tip"; id: CompanionTipId } | { kind: "personality"; id: CompanionActivity };
export type CompanionSnapshot = { pose: CompanionPose; bubble: CompanionBubble | null };
export type CompanionClock = { now: () => number; setTimeout: (callback: () => void, delay: number) => number; clearTimeout: (id: number) => void };

export const IDLE_SNAPSHOT: Readonly<CompanionSnapshot> = Object.freeze({ pose: "idle", bubble: null });
export const COMPANION_TIMING = Object.freeze({
  idle: [45_000, 90_000] as const,
  activity: [8_000, 15_000] as const,
  tip: [480_000, 720_000] as const,
  tipLifetime: 8_000,
  personalityLifetime: 5_000,
  personalityCooldown: 180_000,
  personalityChance: 0.25,
});
const ACTIVITIES: readonly CompanionActivity[] = ["drawing", "eating", "drinking", "sleeping", "bathroom"];
const TIPS: readonly CompanionTipId[] = ["pan", "shortcuts", "group", "undo"];

export const createCompanionScheduler = ({ clock, random = Math.random, tipsEnabled, onChange }: {
  clock: CompanionClock;
  random?: () => number;
  tipsEnabled: boolean;
  onChange: (snapshot: CompanionSnapshot) => void;
}) => {
  let active = false;
  let disposed = false;
  let snapshot: CompanionSnapshot = IDLE_SNAPSHOT;
  let previousActivity: CompanionActivity | undefined;
  let previousTip: CompanionTipId | undefined;
  let lastPersonality = 0;
  let activityTimer: number | undefined;
  let tipTimer: number | undefined;
  let bubbleTimer: number | undefined;

  const emit = (patch: Partial<CompanionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    onChange({ ...snapshot, bubble: snapshot.bubble ? { ...snapshot.bubble } : null });
  };
  const cancel = (id: number | undefined) => { if (id !== undefined) { clock.clearTimeout(id); } };
  const interval = ([min, max]: readonly [number, number]) => min + Math.floor(random() * (max - min + 1));
  const choose = <T,>(items: readonly T[], previous: T | undefined): T => {
    const available = items.filter((item) => item !== previous);
    return available[Math.floor(random() * available.length)];
  };
  const showBubble = (bubble: CompanionBubble) => {
    cancel(bubbleTimer);
    emit({ bubble });
    bubbleTimer = clock.setTimeout(() => {
      bubbleTimer = undefined;
      emit({ bubble: null });
    }, bubble.kind === "tip" ? COMPANION_TIMING.tipLifetime : COMPANION_TIMING.personalityLifetime);
  };
  const scheduleActivity = () => {
    activityTimer = clock.setTimeout(() => {
      const activity = choose(ACTIVITIES, previousActivity);
      previousActivity = activity;
      emit({ pose: activity });
      activityTimer = clock.setTimeout(() => {
        emit({ pose: "idle" });
        if (snapshot.bubble?.kind !== "tip" && clock.now() - lastPersonality >= COMPANION_TIMING.personalityCooldown && random() < COMPANION_TIMING.personalityChance) {
          lastPersonality = clock.now();
          showBubble({ kind: "personality", id: activity });
        }
        scheduleActivity();
      }, interval(COMPANION_TIMING.activity));
    }, interval(COMPANION_TIMING.idle));
  };
  const scheduleTip = () => {
    tipTimer = clock.setTimeout(() => {
      previousTip = choose(TIPS, previousTip);
      showBubble({ kind: "tip", id: previousTip });
      scheduleTip();
    }, interval(COMPANION_TIMING.tip));
  };
  const reset = () => {
    cancel(activityTimer);
    cancel(tipTimer);
    cancel(bubbleTimer);
    activityTimer = tipTimer = bubbleTimer = undefined;
    emit(IDLE_SNAPSHOT);
  };
  return {
    setActive(next: boolean) {
      if (disposed || next === active) { return; }
      active = next;
      reset();
      if (active) {
        lastPersonality = clock.now();
        scheduleActivity();
        if (tipsEnabled) { scheduleTip(); }
      }
    },
    setTipsEnabled(enabled: boolean) {
      if (disposed || tipsEnabled === enabled) { return; }
      tipsEnabled = enabled;
      cancel(tipTimer);
      tipTimer = undefined;
      if (!enabled && snapshot.bubble?.kind === "tip") {
        cancel(bubbleTimer);
        bubbleTimer = undefined;
        emit({ bubble: null });
      }
      if (active && enabled) { scheduleTip(); }
    },
    dispose() {
      if (disposed) { return; }
      reset();
      active = false;
      disposed = true;
    },
  };
};
