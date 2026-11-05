import { useApp } from "@excalidraw/excalidraw/components/App";
import { useLayoutEffect, useState } from "react";

import { STORAGE_KEYS } from "../app_constants";

import type { ReactNode } from "react";

/** Application chrome preference, kept outside scene and editor state. */
export const CompanionPreference = ({
  children,
}: {
  children: (
    enabled: boolean,
    onChange: (enabled: boolean) => void,
  ) => ReactNode;
}) => {
  const app = useApp();
  // Resolve storage in the editor's owning window before mounting the UI.
  const [enabled, setEnabled] = useState(false);

  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = app.ownerWindow.localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_COMPANION,
      );
    } catch {
      // Storage may be unavailable; the current session remains usable.
    }
    setEnabled(stored !== "hidden");
  }, [app]);

  return children(enabled, (nextEnabled) => {
    setEnabled(nextEnabled);
    try {
      app.ownerWindow.localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_COMPANION,
        nextEnabled ? "shown" : "hidden",
      );
    } catch {
      // An explicit choice still applies in memory when persistence fails.
    }
  });
};
