import { useCallback, useEffect, useState } from "react";

import { DEFAULT_COMPANION_PREFERENCES, readCompanionPreferences, writeCompanionPreferences } from "./preferences";

import type { CompanionPreferences, UpdateCompanionPreferences } from "./preferences";

export const useCompanionPreferences = (ownerWindow: Window | null): {
  preferences: CompanionPreferences;
  ready: boolean;
  updatePreferences: UpdateCompanionPreferences;
} => {
  const [state, setState] = useState({ ownerWindow: null as Window | null, preferences: { ...DEFAULT_COMPANION_PREFERENCES }, dirty: false });

  useEffect(() => {
    setState({ ownerWindow, preferences: ownerWindow ? readCompanionPreferences(ownerWindow) : { ...DEFAULT_COMPANION_PREFERENCES }, dirty: false });
  }, [ownerWindow]);

  useEffect(() => {
    if (ownerWindow && state.ownerWindow === ownerWindow && state.dirty) {
      writeCompanionPreferences(ownerWindow, state.preferences);
    }
  }, [ownerWindow, state]);

  const updatePreferences = useCallback<UpdateCompanionPreferences>((patch) => {
    setState((current) => ownerWindow && current.ownerWindow === ownerWindow ? { ...current, preferences: { ...current.preferences, ...patch }, dirty: true } : current);
  }, [ownerWindow]);

  const ready = !!ownerWindow && state.ownerWindow === ownerWindow;
  return { preferences: ready ? state.preferences : DEFAULT_COMPANION_PREFERENCES, ready, updatePreferences };
};
