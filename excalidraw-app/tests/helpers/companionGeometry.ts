import { vi } from "vitest";

/** Browser layout boundary for application Companion tests; unrelated nodes
 * retain jsdom's normal geometry rather than masquerading as editor-sized UI. */
export const mockCompanionEditorGeometry = (
  ownerWindow: Window & typeof globalThis = window,
) => {
  const geometry = { width: 1280, height: 800, bottomBarHeight: 48 };
  const original = ownerWindow.HTMLElement.prototype.getBoundingClientRect;
  const rect = (left: number, top: number, width: number, height: number) =>
    new ownerWindow.DOMRect(left, top, width, height);
  vi.spyOn(
    ownerWindow.HTMLElement.prototype,
    "getBoundingClientRect",
  ).mockImplementation(function (this: HTMLElement) {
    const { width, height, bottomBarHeight } = geometry;
    if (this.classList.contains("excalidraw")) {
      return rect(0, 0, width, height);
    }
    if (this.dataset.viewportUi === "bottom" || this.tagName === "FOOTER") {
      return rect(0, height - bottomBarHeight, width, bottomBarHeight);
    }
    if (this.dataset.viewportUi === "top") {
      return rect(0, 0, width, 64);
    }
    if (this.dataset.viewportUiName === "sidebar") {
      return rect(width - 302, 0, 302, height);
    }
    return original.call(this);
  });
  return geometry;
};
