import { STORAGE_KEYS } from "../../app_constants";

export type CompanionPreferences = { enabled: boolean; tipsEnabled: boolean };
export type UpdateCompanionPreferences = (patch: Partial<CompanionPreferences>) => void;

export const DEFAULT_COMPANION_PREFERENCES: Readonly<CompanionPreferences> = Object.freeze({ enabled: true, tipsEnabled: true });

export const readCompanionPreferences = (ownerWindow: Window): CompanionPreferences => {
  try {
    const value: unknown = JSON.parse(ownerWindow.localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION) ?? "null");
    if (value && typeof value === "object" && !Array.isArray(value) && "version" in value && value.version === 1) {
      return {
        enabled: "enabled" in value && typeof value.enabled === "boolean" ? value.enabled : true,
        tipsEnabled: "tipsEnabled" in value && typeof value.tipsEnabled === "boolean" ? value.tipsEnabled : true,
      };
    }
  } catch {
    // Storage is optional; the drawing app must still work without it.
  }
  return { ...DEFAULT_COMPANION_PREFERENCES };
};

export const writeCompanionPreferences = (ownerWindow: Window, preferences: CompanionPreferences): void => {
  try {
    ownerWindow.localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION, JSON.stringify({ version: 1, enabled: preferences.enabled, tipsEnabled: preferences.tipsEnabled }));
  } catch {
    // Keep current-session choices even when persistence is unavailable.
  }
};
