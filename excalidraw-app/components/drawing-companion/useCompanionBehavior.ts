import { useEffect, useRef, useState } from "react";

import { createCompanionScheduler, IDLE_SNAPSHOT } from "./behavior";

import type { CompanionSnapshot } from "./behavior";

export const useCompanionBehavior = ({
  ownerDocument,
  ownerWindow,
  active,
  tipsEnabled,
}: {
  ownerDocument: Document;
  ownerWindow: Window;
  active: boolean;
  tipsEnabled: boolean;
}): {
  snapshot: CompanionSnapshot;
  reducedMotion: boolean;
  paused: boolean;
} => {
  const [state, setState] = useState({
    ownerDocument,
    ownerWindow,
    snapshot: IDLE_SNAPSHOT,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const schedulerRef = useRef<ReturnType<
    typeof createCompanionScheduler
  > | null>(null);
  const tipsEnabledRef = useRef(tipsEnabled);
  tipsEnabledRef.current = tipsEnabled;

  useEffect(() => {
    if (!active) {
      return;
    }
    const scheduler = createCompanionScheduler({
      clock: {
        now: () => ownerWindow.performance.now(),
        setTimeout: (callback, delay) =>
          ownerWindow.setTimeout(callback, delay),
        clearTimeout: (id) => ownerWindow.clearTimeout(id),
      },
      tipsEnabled: tipsEnabledRef.current,
      onChange: (snapshot) =>
        setState({ ownerDocument, ownerWindow, snapshot }),
    });
    schedulerRef.current = scheduler;
    const onVisibility = () => scheduler.setActive(!ownerDocument.hidden);
    const media = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(media.matches);
    onMotion();
    onVisibility();
    ownerDocument.addEventListener("visibilitychange", onVisibility);
    media.addEventListener("change", onMotion);
    return () => {
      ownerDocument.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onMotion);
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, [ownerDocument, ownerWindow, active]);

  useEffect(() => {
    schedulerRef.current?.setTipsEnabled(tipsEnabled);
  }, [tipsEnabled]);

  const paused = !active || ownerDocument.hidden;
  return {
    snapshot:
      paused ||
      state.ownerDocument !== ownerDocument ||
      state.ownerWindow !== ownerWindow
        ? IDLE_SNAPSHOT
        : state.snapshot,
    reducedMotion,
    paused,
  };
};
