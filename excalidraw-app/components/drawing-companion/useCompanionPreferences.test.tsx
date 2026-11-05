import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";

import { STORAGE_KEYS } from "../../app_constants";

import { useCompanionPreferences } from "./useCompanionPreferences";

const key = STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION;
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("does_not_write_before_hydration", () => {
  const write = vi.spyOn(Storage.prototype, "setItem");
  const { result, rerender } = renderHook(
    ({ owner }) => useCompanionPreferences(owner),
    { initialProps: { owner: null as Window | null }, wrapper: StrictMode },
  );
  expect(result.current.ready).toBe(false);
  expect(write).not.toHaveBeenCalled();
  localStorage.setItem(
    key,
    '{"version":1,"enabled":false,"tipsEnabled":false}',
  );
  write.mockClear();
  rerender({ owner: window });
  expect(result.current.ready).toBe(true);
  expect(result.current.preferences).toEqual({
    enabled: false,
    tipsEnabled: false,
  });
  expect(write).not.toHaveBeenCalled();
});

it("keeps_session_changes_when_storage_fails", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  const { result, unmount } = renderHook(
    () => useCompanionPreferences(window),
    { wrapper: StrictMode },
  );
  act(() => result.current.updatePreferences({ enabled: false }));
  expect(result.current.preferences).toEqual({
    enabled: false,
    tipsEnabled: true,
  });
  expect(result.current.ready).toBe(true);
  unmount();
});

it("does_not_copy_preferences_between_owning_windows", () => {
  localStorage.setItem(
    key,
    '{"version":1,"enabled":false,"tipsEnabled":false}',
  );
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const owner = iframe.contentWindow!;
  const values = new Map([
    [key, '{"version":1,"enabled":true,"tipsEnabled":false}'],
  ]);
  const storage = {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
  };
  Object.defineProperty(owner, "localStorage", {
    configurable: true,
    value: storage,
  });
  const { result, rerender, unmount } = renderHook(
    ({ owner }) => useCompanionPreferences(owner),
    { initialProps: { owner: window }, wrapper: StrictMode },
  );
  expect(result.current.preferences.enabled).toBe(false);
  rerender({ owner });
  expect(result.current.preferences).toEqual({
    enabled: true,
    tipsEnabled: false,
  });
  expect(values.get(key)).toBe(
    '{"version":1,"enabled":true,"tipsEnabled":false}',
  );
  act(() => result.current.updatePreferences({ tipsEnabled: true }));
  expect(JSON.parse(values.get(key)!)).toEqual({
    version: 1,
    enabled: true,
    tipsEnabled: true,
  });
  expect(JSON.parse(localStorage.getItem(key)!).enabled).toBe(false);
  unmount();
  iframe.remove();
});
