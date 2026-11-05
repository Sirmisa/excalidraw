import { useLayoutEffect, useRef, useState } from "react";

import { companionRandom } from "./companionRandom";

const ROUTINES = [
  "eating",
  "drinking",
  "sleeping",
  "drawing",
  "bathroom",
] as const;
export type CompanionRoutine = "idle" | typeof ROUTINES[number];

export const useCompanionRoutines = (
  ownerWindow: Window,
  enabled: boolean,
  reducedMotion: boolean,
) => {
  const [routine, setRoutine] = useState<CompanionRoutine>("idle");

  // Remember performed activity within this mount, including interruptions.
  const previous = useRef<CompanionRoutine | null>(null);

  // Only host policies restart the schedule; editor activity is independent.
  useLayoutEffect(() => {
    setRoutine("idle");
    if (!enabled) {
      return;
    }

    let deadline: number;
    const scheduleIdle = () => {
      setRoutine("idle");
      deadline = ownerWindow.setTimeout(() => {
        // Still mode retains sparse opportunities for occasional text.
        if (reducedMotion) {
          scheduleIdle();
          return;
        }
        const choices = ROUTINES.filter(
          (choice) => choice !== previous.current,
        );
        const selected =
          choices[
            Math.min(
              choices.length - 1,
              Math.floor(companionRandom() * choices.length),
            )
          ];
        previous.current = selected;
        setRoutine(selected);
        deadline = ownerWindow.setTimeout(
          scheduleIdle,
          Math.round(8_000 + companionRandom() * 6_000),
        );
      }, Math.round(90_000 + companionRandom() * 90_000));
    };
    scheduleIdle();
    return () => ownerWindow.clearTimeout(deadline);
  }, [ownerWindow, enabled, reducedMotion]);

  return routine;
};
