import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";

import { useCompanionBehavior } from "./useCompanionBehavior";

const idle = { pose: "idle", bubble: null };
let motion: MediaQueryList;
let listeners: Set<() => void>;
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const visibility = (owner: Document, hidden: boolean) =>
  act(() => {
    Object.defineProperty(owner, "hidden", {
      configurable: true,
      value: hidden,
    });
    owner.dispatchEvent(new Event("visibilitychange"));
  });
const options = () => ({
  ownerDocument: document,
  ownerWindow: window,
  active: true,
  tipsEnabled: true,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  listeners = new Set();
  motion = {
    matches: false,
    addEventListener: (_event: string, callback: () => void) =>
      listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) =>
      listeners.delete(callback),
  } as unknown as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockReturnValue(motion);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("pauses_and_resumes_without_catchup", () => {
  const { result, unmount } = renderHook(() => useCompanionBehavior(options()));
  tick(45_000);
  expect(result.current.snapshot.pose).toBe("drawing");
  visibility(document, true);
  expect(result.current.paused).toBe(true);
  expect(result.current.snapshot).toEqual(idle);
  expect(vi.getTimerCount()).toBe(0);
  tick(1_200_000);
  visibility(document, false);
  expect(result.current.paused).toBe(false);
  expect(result.current.snapshot).toEqual(idle);
  tick(44_999);
  expect(result.current.snapshot).toEqual(idle);
  tick(1);
  expect(result.current.snapshot.pose).not.toBe("idle");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
});

it("reduced_motion_changes_keep_the_schedule", () => {
  const { result, unmount } = renderHook(() => useCompanionBehavior(options()));
  tick(30_000);
  act(() => {
    Object.defineProperty(motion, "matches", { value: true });
    listeners.forEach((callback) => callback());
  });
  expect(result.current.reducedMotion).toBe(true);
  tick(15_000);
  expect(result.current.snapshot.pose).toBe("drawing");
  unmount();
});

it("strict_mode_leaves_one_scheduler", () => {
  const { result, unmount } = renderHook(
    () => useCompanionBehavior(options()),
    { wrapper: StrictMode },
  );
  expect(vi.getTimerCount()).toBe(2);
  expect(listeners.size).toBe(1);
  tick(45_000);
  expect(result.current.snapshot.pose).toBe("drawing");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
});

it("rapid_suppression_clears_old_callbacks", () => {
  const { result, rerender, unmount } = renderHook(
    ({ active }) => useCompanionBehavior({ ...options(), active }),
    { initialProps: { active: true } },
  );
  tick(44_000);
  rerender({ active: false });
  expect(result.current.paused).toBe(true);
  expect(listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  rerender({ active: true });
  tick(1_000);
  expect(result.current.snapshot).toEqual(idle);
  rerender({ active: false });
  rerender({ active: true });
  tick(44_999);
  expect(result.current.snapshot).toEqual(idle);
  tick(1);
  expect(result.current.snapshot.pose).toBe("drawing");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("tips_changes_do_not_restart_activities", () => {
  const { result, rerender, unmount } = renderHook(
    ({ tipsEnabled }) => useCompanionBehavior({ ...options(), tipsEnabled }),
    { initialProps: { tipsEnabled: true } },
  );
  tick(40_000);
  rerender({ tipsEnabled: false });
  tick(5_000);
  expect(result.current.snapshot.pose).toBe("drawing");
  expect(vi.getTimerCount()).toBe(1);
  unmount();
});

it("uses_only_the_owning_document_and_window", () => {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const owner = iframe.contentWindow!;
  const ownerDoc = owner.document;
  Object.defineProperty(ownerDoc, "hidden", {
    configurable: true,
    value: false,
  });
  const setTimeoutSpy = vi.spyOn(owner, "setTimeout");
  const clearTimeoutSpy = vi.spyOn(owner, "clearTimeout");
  const mediaSpy = vi.fn(() => motion);
  Object.defineProperty(owner, "matchMedia", { value: mediaSpy });
  const removeListener = vi.spyOn(ownerDoc, "removeEventListener");
  const { result, rerender, unmount } = renderHook(
    ({ ownerDocument, ownerWindow }) =>
      useCompanionBehavior({
        ownerDocument,
        ownerWindow,
        active: true,
        tipsEnabled: true,
      }),
    { initialProps: { ownerDocument: document, ownerWindow: window } },
  );
  rerender({ ownerDocument: ownerDoc, ownerWindow: owner });
  expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  expect(mediaSpy).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  visibility(document, true);
  expect(result.current.paused).toBe(false);
  visibility(ownerDoc, true);
  expect(result.current.paused).toBe(true);
  expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  visibility(ownerDoc, false);
  expect(result.current.snapshot).toEqual(idle);
  unmount();
  expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
  expect(removeListener).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
  expect(listeners.size).toBe(0);
  iframe.remove();
});
