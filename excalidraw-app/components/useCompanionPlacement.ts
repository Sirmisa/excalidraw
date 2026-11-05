import {
  useApp,
  useEditorInterface,
  useExcalidrawContainer,
} from "@excalidraw/excalidraw/components/App";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useLayoutEffect, useState } from "react";

import type { CSSProperties } from "react";

// Props stay inside the artwork. Bubbles grow above and to its left, within
// these limits, so every expression fits the same reserved home.
export const COMPANION_BUBBLE_WIDTH = 240;
export const COMPANION_BUBBLE_HEIGHT = 88;
const GAP = 12;
const SURFACES = "[data-viewport-ui], footer";

export const useCompanionPlacement = (active: boolean) => {
  const app = useApp();
  const { container } = useExcalidrawContainer();
  const { formFactor } = useEditorInterface();
  const { width, height, openSidebar } = useUIAppState();
  const [placement, setPlacement] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!active || !container || (formFactor === "phone" && openSidebar)) {
      setPlacement(null);
      return;
    }
    const ownerWindow = app.ownerWindow;
    const characterWidth = formFactor === "phone" ? 78 : 90;
    // Resolve the editor's env(safe-area-inset-*) variables to CSS pixels in
    // its own document. Custom-property values alone can remain unresolved env().
    const safeArea = app.ownerDocument.createElement("div");
    safeArea.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;" +
      "padding:var(--sat, 0px) var(--sar, 0px) var(--sab, 0px) var(--sal, 0px)";
    safeArea.setAttribute("aria-hidden", "true");
    container.append(safeArea);

    let surfaces: HTMLElement[] = [];
    const measure = () => {
      const safe = ownerWindow.getComputedStyle(safeArea);
      const inset = (value: string) => Number.parseFloat(value) || 0;
      // Hidden surfaces have no footprint. An unmeasurable bottom surface
      // must not be interpreted as reaching across the whole viewport.
      const measurableBottom = surfaces.some((surface) => {
        const rect = surface.getBoundingClientRect();
        return (
          surface.dataset.viewportUi === "bottom" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      const offsets = app.viewport.getOffsets({
        padding: GAP,
        ...(!measurableBottom && { bottom: GAP }),
      });
      const containerTop = container.getBoundingClientRect().top;
      for (const surface of surfaces) {
        if (surface.tagName === "FOOTER") {
          const rect = surface.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            offsets.bottom = Math.max(
              offsets.bottom ?? 0,
              height - (rect.top - containerTop) + GAP,
            );
          }
        }
      }
      const right = Math.max(
        offsets.right ?? 0,
        inset(safe.paddingRight) + GAP,
      );
      const bottom = Math.max(
        offsets.bottom ?? 0,
        inset(safe.paddingBottom) + GAP,
      );
      const left = Math.max(offsets.left ?? 0, inset(safe.paddingLeft) + GAP);
      const top = Math.max(offsets.top ?? 0, inset(safe.paddingTop) + GAP);
      const fits =
        width - left - right >= COMPANION_BUBBLE_WIDTH &&
        height - top - bottom >=
          (characterWidth * 120) / 140 + COMPANION_BUBBLE_HEIGHT + GAP;
      setPlacement((previous) => {
        if (!fits) {
          return previous === null ? previous : null;
        }
        return previous?.right === right &&
          previous.bottom === bottom &&
          previous.width === characterWidth
          ? previous
          : { right, bottom, width: characterWidth };
      });
    };
    const resizeObserver =
      typeof ownerWindow.ResizeObserver === "function"
        ? new ownerWindow.ResizeObserver(measure)
        : null;
    resizeObserver?.observe(container);
    const updateSurfaces = () => {
      const nextSurfaces = Array.from(
        container.querySelectorAll<HTMLElement>(SURFACES),
      );
      if (
        nextSurfaces.length === surfaces.length &&
        nextSurfaces.every((surface, index) => surface === surfaces[index])
      ) {
        return false;
      }
      for (const surface of surfaces) {
        resizeObserver?.unobserve(surface);
      }
      surfaces = nextSurfaces;
      for (const surface of surfaces) {
        resizeObserver?.observe(surface);
      }
      return true;
    };
    updateSurfaces();
    measure();
    // UI surfaces can mount after this host child (or change without a
    // viewport resize). Ignore decorative/expression mutations themselves.
    const mutationObserver = new ownerWindow.MutationObserver((mutations) => {
      const changed = updateSurfaces();
      if (
        changed ||
        mutations.some(
          (mutation) =>
            mutation.type === "attributes" &&
            (mutation.target === container ||
              surfaces.includes(mutation.target as HTMLElement)),
        )
      ) {
        measure();
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-viewport-ui"],
    });
    ownerWindow.addEventListener("resize", measure);
    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      ownerWindow.removeEventListener("resize", measure);
      safeArea.remove();
    };
  }, [active, app, container, width, height, formFactor, openSidebar]);

  return placement;
};
