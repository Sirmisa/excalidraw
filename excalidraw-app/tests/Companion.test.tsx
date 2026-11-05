import { Excalidraw } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { Keyboard, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { vi } from "vitest";
import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";
import { Companion } from "../components/Companion";

describe("application Companion", () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  it("starts idle and can be hidden and restored from the application menu", async () => {
    await render(<ExcalidrawApp />);

    expect(
      screen.getByRole("img", { name: "Your drawing companion" }),
    ).toBeVisible();
    const hide = screen.getByRole("button", { name: "Hide companion" });
    hide.focus();
    fireEvent.click(hide);

    expect(
      screen.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
    const menu = screen.getByTestId("main-menu-trigger");
    expect(menu).toHaveFocus();
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    expect(
      screen.getByRole("img", { name: "Your drawing companion" }),
    ).toBeVisible();
  });

  it("does not add the application Companion to the reusable editor", async () => {
    await render(<Excalidraw />);
    expect(
      screen.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
  });

  it("suspends for editing modes and loading without changing the explicit menu preference", async () => {
    await render(<ExcalidrawApp />);
    const { app } = window.h;
    const companion = () =>
      screen.queryByRole("img", { name: "Your drawing companion" });

    for (const mode of [
      "isLoading",
      "zenModeEnabled",
      "viewModeEnabled",
    ] as const) {
      act(() =>
        app.updateScene({
          appState: {
            isLoading: mode === "isLoading",
            zenModeEnabled: mode === "zenModeEnabled",
            viewModeEnabled: mode === "viewModeEnabled",
          },
        }),
      );
      expect(companion()).not.toBeInTheDocument();
      act(() =>
        app.updateScene({
          appState: {
            isLoading: false,
            zenModeEnabled: false,
            viewModeEnabled: false,
          },
        }),
      );
      expect(companion()).toBeVisible();
    }

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(companion()).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide companion" }));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(companion()).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    await waitFor(() => expect(companion()).toBeVisible());
  });

  it("uses a still pose for startup and live reduced-motion changes without moving focus", async () => {
    const media = new EventTarget();
    let reduced = true;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      media: query,
      get matches() {
        return query === "(prefers-reduced-motion: reduce)" && reduced;
      },
      addEventListener: media.addEventListener.bind(media),
      removeEventListener: media.removeEventListener.bind(media),
      dispatchEvent: media.dispatchEvent.bind(media),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    await render(<ExcalidrawApp />);
    const image = screen.getByRole("img", { name: "Your drawing companion" });
    const animations = () =>
      Array.from(image.querySelectorAll("svg *"))
        .map(
          (node) =>
            image.ownerDocument.defaultView!.getComputedStyle(node).animation,
        )
        .filter((animation) => animation && animation !== "none");
    const menu = screen.getByTestId("main-menu-trigger");
    menu.focus();
    expect(animations()).toHaveLength(0);
    act(() => {
      reduced = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(animations()).toHaveLength(2);
    act(() => {
      reduced = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(animations()).toHaveLength(0);
    expect(menu).toHaveFocus();
    expect(screen.getByRole("img", { name: "Your drawing companion" })).toBe(
      image,
    );
  });

  it("suspends for editor and application modals and resumes without moving focus", async () => {
    await render(<ExcalidrawApp />);
    const { app } = window.h;
    const companion = () =>
      screen.queryByRole("img", { name: "Your drawing companion" });
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    await waitFor(() => expect(companion()).not.toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(companion()).toBeVisible());

    fireEvent.click(
      screen.getAllByRole("button", { name: "Live collaboration..." })[0],
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    await waitFor(() => expect(companion()).not.toBeInTheDocument());
    const focused = app.ownerDocument.activeElement;
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(companion()).toBeVisible());
    expect(
      screen.getByRole("button", { name: "Hide companion" }),
    ).not.toHaveFocus();
    expect(focused).not.toBe(
      screen.getByRole("button", { name: "Hide companion" }),
    );
  });

  it("keeps drawing, text, undo and saved scene content separate while theme and language update", async () => {
    await render(<ExcalidrawApp />);
    const { app } = window.h;
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    const text = UI.createElement("text", { x: 400, y: 200 });
    await UI.editText(text, "My drawing");
    const scene = () =>
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local");
    const saved = scene();
    const historyLength = window.h.history.undoStack.length;

    fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    const image = screen.getByRole("img", { name: "Your drawing companion" });
    expect(scene()).toBe(saved);
    expect(window.h.history.undoStack).toHaveLength(historyLength);

    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("radio", { name: /dark mode/i }));
    await waitFor(() => expect(app.state.theme).toBe("dark"));
    expect(screen.getByRole("img", { name: "Your drawing companion" })).toBe(
      image,
    );
    const language = screen.getByRole("combobox", { name: /select language/i });
    fireEvent.change(language, { target: { value: "fr-FR" } });
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveValue("fr-FR"),
    );
    // New keys use the established English fallback until translated.
    expect(
      screen.getByRole("button", { name: "Hide companion" }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "Your drawing companion" })).toBe(
      image,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /select language/i }),
      ).toHaveValue("en"),
    );
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    expect(scene()).toBe(saved);

    Keyboard.undo();
    expect(app.getSceneElements()).toHaveLength(1);
    Keyboard.redo();
    expect(app.getSceneElements()).toHaveLength(2);
    expect(app.getSceneElements()).toEqual([
      expect.objectContaining({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      }),
      expect.objectContaining({ type: "text", text: "My drawing" }),
    ]);
  });

  it("uses its mounted document and window and cleans up after Strict Mode unmount", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    const motion = Object.assign(new ownerWindow.EventTarget(), {
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    const addMotion = vi.spyOn(motion, "addEventListener");
    const removeMotion = vi.spyOn(motion, "removeEventListener");
    const addVisibility = vi.spyOn(ownerDocument, "addEventListener");
    const removeVisibility = vi.spyOn(ownerDocument, "removeEventListener");
    const ownedMatchMedia = vi.fn(() => motion as MediaQueryList);
    Object.defineProperties(ownerWindow, {
      matchMedia: { value: ownedMatchMedia },
      requestAnimationFrame: {
        value: window.requestAnimationFrame.bind(window),
      },
      cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window) },
      ResizeObserver: { value: window.ResizeObserver },
    });
    Object.defineProperty(ownerDocument, "fonts", { value: document.fonts });
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value: window.HTMLCanvasElement.prototype.getContext,
      },
    );
    const rendered = await render(
      <StrictMode>
        <Excalidraw ownerDocument={ownerDocument}>
          <Companion enabled onHide={() => {}} />
        </Excalidraw>
      </StrictMode>,
      {
        container: mountNode,
        baseElement: ownerDocument.body,
      },
    );
    const image = rendered.getByRole("img", { name: "Your drawing companion" });
    expect(image.ownerDocument).toBe(ownerDocument);
    expect(ownedMatchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
    expect(window.matchMedia).not.toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(image).toBeVisible();
    Object.defineProperty(ownerDocument, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(ownerDocument, new ownerWindow.Event("visibilitychange"));
    expect(
      rendered.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
    Object.defineProperty(ownerDocument, "hidden", {
      configurable: true,
      value: false,
    });
    fireEvent(ownerDocument, new ownerWindow.Event("visibilitychange"));
    expect(
      rendered.getAllByRole("img", { name: "Your drawing companion" }),
    ).toHaveLength(1);

    rendered.unmount();
    for (const [event, listener] of addMotion.mock.calls) {
      expect(removeMotion).toHaveBeenCalledWith(event, listener);
    }
    for (const [event, listener] of addVisibility.mock.calls.filter(
      ([event]) => event === "visibilitychange",
    )) {
      expect(removeVisibility).toHaveBeenCalledWith(event, listener);
    }
    iframe.remove();
  });
});
