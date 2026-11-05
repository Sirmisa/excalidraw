import { render } from "@excalidraw/excalidraw/tests/test-utils";

import { mockCompanionEditorGeometry } from "./companionGeometry";

import type { ReactElement } from "react";

/** Supply jsdom's missing browser boundaries in a separate editor realm. */
export const withOwnedEditor = async (
  hostDocument: Document,
  run: (fixture: {
    ownerDocument: Document;
    ownerWindow: Window & typeof globalThis;
    renderOwned: (ui: ReactElement) => ReturnType<typeof render>;
  }) => Promise<void>,
) => {
  const hostWindow = hostDocument.defaultView!;
  const iframe = hostDocument.createElement("iframe");
  hostDocument.body.append(iframe);
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
  const mounted: Awaited<ReturnType<typeof render>>[] = [];
  try {
    mockCompanionEditorGeometry(ownerWindow);
    Object.defineProperties(ownerWindow, {
      matchMedia: { configurable: true, value: hostWindow.matchMedia },
      requestAnimationFrame: {
        value: hostWindow.requestAnimationFrame.bind(hostWindow),
      },
      cancelAnimationFrame: {
        value: hostWindow.cancelAnimationFrame.bind(hostWindow),
      },
      ResizeObserver: { value: hostWindow.ResizeObserver },
    });
    Object.defineProperty(ownerDocument, "fonts", {
      value: hostDocument.fonts,
    });
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value: hostWindow.HTMLCanvasElement.prototype.getContext,
      },
    );
    await run({
      ownerDocument,
      ownerWindow,
      renderOwned: async (ui) => {
        const container = ownerDocument.createElement("div");
        ownerDocument.body.append(container);
        const rendered = await render(ui, {
          container,
          baseElement: ownerDocument.body,
        });
        mounted.push(rendered);
        return rendered;
      },
    });
  } finally {
    try {
      for (const rendered of mounted) {
        rendered.unmount();
      }
    } finally {
      iframe.remove();
    }
  }
};
