import { useLayoutEffect, useRef, useState } from "react";

import type App from "@excalidraw/excalidraw/components/App";
import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

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
  app: Pick<App, "ownerWindow">,
  enabled: boolean,
  reducedMotion: boolean,
) => {
  const [routine, setRoutine] = useState<CompanionRoutine>("idle");
  const [text, setText] = useState<TranslationKeys | null>(null);
  const quietUntil = useRef<number | null>(null);

  // Remember performed activity within this mount, including interruptions.
  const previous = useRef<CompanionRoutine | null>(null);

  // Only host policies restart the schedule; editor activity is independent.
  useLayoutEffect(() => {
    const ownerWindow = app.ownerWindow;
    // Start only after mount, when the editor has its owning browser realm.
    quietUntil.current ??= ownerWindow.Date.now() + 600_000;
    setRoutine("idle");
    setText(null);
    if (!enabled) {
      return;
    }

    let deadline: number;
    let dismissal: number | undefined;
    const offerText = (selected: CompanionRoutine) => {
      const now = ownerWindow.Date.now();
      if (now < quietUntil.current! || companionRandom() >= 0.2) {
        return;
      }
      const tips = [
        "companion.tips.room",
        "companion.tips.sketch",
        "companion.tips.label",
      ] as const;
      const key =
        selected !== "idle" && companionRandom() < 0.5
          ? (`companion.remarks.${selected}` as const)
          : tips[
              Math.min(
                tips.length - 1,
                Math.floor(companionRandom() * tips.length),
              )
            ];
      quietUntil.current = now + 600_000;
      setText(key);
      dismissal = ownerWindow.setTimeout(() => setText(null), 5_000);
    };
    const scheduleIdle = () => {
      setRoutine("idle");
      deadline = ownerWindow.setTimeout(() => {
        // Still mode retains sparse opportunities for occasional text.
        if (reducedMotion) {
          offerText("idle");
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
        offerText(selected);
        deadline = ownerWindow.setTimeout(
          scheduleIdle,
          Math.round(8_000 + companionRandom() * 6_000),
        );
      }, Math.round(90_000 + companionRandom() * 90_000));
    };
    scheduleIdle();
    return () => {
      ownerWindow.clearTimeout(deadline);
      ownerWindow.clearTimeout(dismissal);
    };
  }, [app, enabled, reducedMotion]);

  return { routine, text };
};
