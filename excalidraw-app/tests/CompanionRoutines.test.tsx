import { vi } from "vitest";
import { Excalidraw } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { exportScene } from "@excalidraw/excalidraw/scene/export";
import { Keyboard, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";
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
import * as randomness from "../components/companionRandom";

import { mockCompanionEditorGeometry } from "./helpers/companionGeometry";

const transport = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  emit: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  default: () => ({
    id: "local-user",
    on: (event: string, listener: (...args: unknown[]) => unknown) =>
      transport.listeners.set(event, listener),
    once: (event: string, listener: (...args: unknown[]) => unknown) =>
      transport.listeners.set(event, listener),
    off: (event: string) => transport.listeners.delete(event),
    emit: transport.emit,
    close: () => {},
  }),
}));
vi.mock("../data/firebase", () => ({
  loadFromFirebase: async () => null,
  saveToFirebase: async () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({ loadedFiles: [], erroredFiles: [] }),
  saveFilesToFirebase: async () => ({
    savedFiles: [],
    erroredFiles: [],
  }),
}));

const advance = async (milliseconds: number) =>
  act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });

const restart = () => {
  fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
  fireEvent.click(screen.getByTestId("main-menu-trigger"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
};

describe("autonomous application Companion routines", () => {
  let reduced = false;
  let motion: EventTarget;
  let geometry: ReturnType<typeof mockCompanionEditorGeometry>;
  beforeEach(() => {
    window.localStorage.clear();
    geometry = mockCompanionEditorGeometry();
    reduced = false;
    motion = new EventTarget();
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      get matches() {
        return query === "(prefers-reduced-motion: reduce)" && reduced;
      },
      media: query,
      onchange: null,
      addEventListener: motion.addEventListener.bind(motion),
      removeEventListener: motion.removeEventListener.bind(motion),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.spyOn(randomness, "companionRandom").mockReturnValue(0);
  });
  afterEach(async () => {
    await act(async () => {});
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("starts idle, eats after 90 seconds, and returns idle after eight seconds", async () => {
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    restart();
    await advance(89_999);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    await advance(7_999);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    await advance(1);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
  });

  it("reaches all five routines without repeating the last one and freshly idles between them", async () => {
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    const samples = [0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0.6, 0, 0, 1, 0, 0];
    vi.mocked(randomness.companionRandom).mockImplementation(
      () => samples.shift() ?? 0,
    );
    restart();
    for (const prop of [
      "Cookie",
      "Cup",
      "Pillow",
      "Sketchbook",
      "Little door",
    ]) {
      await advance(89_999);
      expect(
        screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
          selector: "title",
        }),
      ).not.toBeInTheDocument();
      await advance(1);
      expect(screen.getByText(prop, { selector: "title" })).toBeInTheDocument();
      await advance(8_000);
      expect(
        screen.queryByText(prop, { selector: "title" }),
      ).not.toBeInTheDocument();
    }
  });

  it.each([
    [0.199999, "Cookie"],
    [0.2, "Cup"],
    [0.4, "Pillow"],
    [0.6, "Sketchbook"],
    [0.8, "Little door"],
  ] as const)(
    "uses equal first-choice ranges: sample %s selects %s",
    async (sample, prop) => {
      await render(<ExcalidrawApp />);
      vi.useFakeTimers();
      vi.mocked(randomness.companionRandom)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(sample)
        .mockReturnValue(0);
      restart();
      await advance(90_000);
      expect(screen.getByText(prop, { selector: "title" })).toBeInTheDocument();
      expect(
        screen.getAllByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
          selector: "title",
        }),
      ).toHaveLength(1);
    },
  );

  it("waits the upper idle bound and keeps a routine for the upper activity bound", async () => {
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    vi.mocked(randomness.companionRandom).mockReturnValue(1);
    restart();
    await advance(179_999);
    expect(
      screen.queryByText("Little door", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Little door", { selector: "title" }),
    ).toBeInTheDocument();
    await advance(13_999);
    expect(
      screen.getByText("Little door", { selector: "title" }),
    ).toBeInTheDocument();
    await advance(1);
    expect(
      screen.queryByText("Little door", { selector: "title" }),
    ).not.toBeInTheDocument();
  });

  it("discards active activity on hide and every suspension and resumes with a full idle interval", async () => {
    await render(<ExcalidrawApp />);
    const { app } = window.h;
    vi.useFakeTimers();
    restart();
    await advance(90_000);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    restart();
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(89_999);
    expect(
      screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
        selector: "title",
      }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText("Cup", { selector: "title" })).toBeInTheDocument();

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
      expect(
        screen.queryByRole("img", { name: "Your drawing companion" }),
      ).not.toBeInTheDocument();
      await advance(1_000_000);
      act(() =>
        app.updateScene({
          appState: {
            isLoading: false,
            zenModeEnabled: false,
            viewModeEnabled: false,
          },
        }),
      );
      await advance(89_999);
      expect(
        screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
          selector: "title",
        }),
      ).not.toBeInTheDocument();
      await advance(1);
      expect(
        screen.getByText(/Cookie|Cup/, { selector: "title" }),
      ).toBeInTheDocument();
    }

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    await advance(1_000_000);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    fireEvent(document, new Event("visibilitychange"));
    await advance(89_999);
    expect(
      screen.queryByText(/Cookie|Cup/, { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText(/Cookie|Cup/, { selector: "title" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    await act(async () => {});
    expect(
      screen.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
    await advance(1_000_000);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await act(async () => {});
    await advance(89_999);
    expect(
      screen.queryByText(/Cookie|Cup/, { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText(/Cookie|Cup/, { selector: "title" }),
    ).toBeInTheDocument();
  });

  it("cancels activity when the layout has no safe placement and starts a fresh idle after room returns", async () => {
    await render(<ExcalidrawApp />);
    const { app } = window.h;
    vi.useFakeTimers();
    restart();
    await advance(90_000);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    const resize = (width: number, height: number) => {
      geometry.width = width;
      geometry.height = height;
      act(() => {
        app.setState({ width, height });
        app.refreshEditorInterface();
        fireEvent(app.ownerWindow, new Event("resize"));
      });
    };
    resize(390, 220);
    expect(
      screen.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
    await advance(1_000_000);
    resize(390, 740);
    expect(
      screen.getByRole("img", { name: "Your drawing companion" }),
    ).toBeVisible();
    await advance(89_999);
    expect(
      screen.queryByText(/Cookie|Cup/, { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText("Cup", { selector: "title" })).toBeInTheDocument();
  });

  it("keeps the original still pose at reduced-motion startup and clears live activity without catch-up", async () => {
    reduced = true;
    await render(<ExcalidrawApp />);
    vi.useFakeTimers();
    restart();
    await advance(600_000);
    expect(
      screen.queryByText(/Cookie|Cup|Pillow|Sketchbook|Little door/, {
        selector: "title",
      }),
    ).not.toBeInTheDocument();
    const menu = screen.getByTestId("main-menu-trigger");
    menu.focus();
    act(() => {
      reduced = false;
      motion.dispatchEvent(new Event("change"));
    });
    await advance(89_999);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    act(() => {
      reduced = true;
      motion.dispatchEvent(new Event("change"));
    });
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    const image = screen.getByRole("img", { name: "Your drawing companion" });
    for (const node of image.querySelectorAll("svg *")) {
      const animation =
        image.ownerDocument.defaultView!.getComputedStyle(node).animation;
      expect(!animation || animation === "none").toBe(true);
    }
    expect(menu).toHaveFocus();
    await advance(600_000);
    act(() => {
      reduced = false;
      motion.dispatchEvent(new Event("change"));
    });
    await advance(89_999);
    expect(
      screen.queryByText(/Cookie|Cup/, { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText("Cup", { selector: "title" })).toBeInTheDocument();
  });

  it("keeps drawing, typing, selection, focus, history, saved data and exported SVG independent of routines", async () => {
    await render(<ExcalidrawApp />);
    const { app, history, store } = window.h;
    vi.useFakeTimers();
    restart();
    await advance(45_000);
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    UI.createElement("text", { x: 400, y: 200 });
    const editor = await getTextEditor();
    editor.focus();
    fireEvent.input(editor, { target: { value: "My drawing" } });
    const selection = app.state.selectedElementIds;
    await advance(44_999);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("My drawing");
    expect(app.state.selectedElementIds).toEqual(selection);
    fireEvent.input(editor, { target: { value: "My drawing continues" } });
    act(() => editor.blur());
    await act(async () => {});
    const saved = () =>
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local");
    const before = saved();
    const svg = () =>
      exportScene({
        type: "svg",
        data: {
          elements: app.getSceneElements(),
          appState: app.state,
          files: app.files,
        },
        config: { environment: app.renderEnvironment },
      });
    const exported = (await svg()).outerHTML;
    const undoLength = history.undoStack.length;
    const increments = vi.fn();
    const unsubscribe = store.onStoreIncrementEmitter.on(increments);
    await advance(8_000);
    await advance(90_000);
    expect(screen.getByText("Cup", { selector: "title" })).toBeInTheDocument();
    expect(saved()).toBe(before);
    expect((await svg()).outerHTML).toBe(exported);
    expect(history.undoStack).toHaveLength(undoLength);
    expect(increments).not.toHaveBeenCalled();
    unsubscribe();
    Keyboard.undo();
    expect(app.getSceneElements()).toHaveLength(1);
    Keyboard.redo();
    expect(app.getSceneElements()).toHaveLength(2);
    expect(app.getSceneElements()[1]).toEqual(
      expect.objectContaining({ type: "text", text: "My drawing continues" }),
    );
  });

  it("owns independent deadlines in an alternate document and cleans up Strict Mode unmount and remount", async () => {
    const application = await render(<ExcalidrawApp />);
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    mockCompanionEditorGeometry(ownerWindow);
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    Object.defineProperties(ownerWindow, {
      matchMedia: { value: window.matchMedia },
      requestAnimationFrame: {
        value: window.requestAnimationFrame.bind(window),
      },
      cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window) },
      ResizeObserver: { value: window.ResizeObserver },
      setTimeout: {
        value: (callback: TimerHandler, delay?: number) =>
          window.setTimeout(callback, delay),
      },
      clearTimeout: { value: (id: number) => window.clearTimeout(id) },
    });
    Object.defineProperty(ownerDocument, "fonts", { value: document.fonts });
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      { value: window.HTMLCanvasElement.prototype.getContext },
    );
    const ownedEditor = () => (
      <StrictMode>
        <Excalidraw ownerDocument={ownerDocument}>
          <Companion enabled onHide={() => {}} />
        </Excalidraw>
      </StrictMode>
    );
    let owned = await render(ownedEditor(), {
      container: mountNode,
      baseElement: ownerDocument.body,
    });
    vi.useFakeTimers();
    fireEvent.click(
      application.getByRole("button", { name: "Hide companion" }),
    );
    fireEvent.click(application.getByTestId("main-menu-trigger"));
    fireEvent.click(
      application.getByRole("menuitem", { name: "Show companion" }),
    );
    const setOwnedHidden = (hidden: boolean) => {
      Object.defineProperty(ownerDocument, "hidden", {
        configurable: true,
        value: hidden,
      });
      fireEvent(ownerDocument, new ownerWindow.Event("visibilitychange"));
    };
    setOwnedHidden(true);
    setOwnedHidden(false);
    await advance(45_000);
    // Suspending one owning document cannot restart the other instance.
    setOwnedHidden(true);
    await advance(45_000);
    expect(
      application.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    expect(
      owned.queryByRole("img", { name: "Your drawing companion" }),
    ).not.toBeInTheDocument();
    setOwnedHidden(false);
    await advance(89_999);
    expect(
      owned.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(owned.getAllByText("Cookie", { selector: "title" })).toHaveLength(1);
    owned.unmount();
    await advance(1_000_000);
    vi.useRealTimers();
    // A fresh mount has no previous Routine or obsolete deadline.
    const remountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(remountNode);
    owned = await render(ownedEditor(), {
      container: remountNode,
      baseElement: ownerDocument.body,
    });
    vi.useFakeTimers();
    setOwnedHidden(true);
    setOwnedHidden(false);
    await advance(89_999);
    expect(
      owned.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(owned.getAllByText("Cookie", { selector: "title" })).toHaveLength(1);
    owned.unmount();
    iframe.remove();
  });

  it("ignores collaborator arrivals and never broadcasts routine activity into an active drawing session", async () => {
    // Crypto and the socket are browser/service boundaries; the application,
    // collaboration pipeline, editor and Companion remain production code.
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(
      window.crypto,
      "subtle",
    );
    Object.defineProperty(window.crypto, "subtle", {
      configurable: true,
      value: {
        generateKey: async () => ({}),
        exportKey: async () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
        importKey: async () => ({}),
        encrypt: async (
          _algorithm: unknown,
          _key: unknown,
          data: ArrayBuffer,
        ) => data,
      },
    });
    transport.listeners.clear();
    transport.emit.mockClear();
    const rendered = await render(<ExcalidrawApp />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Live collaboration..." })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    await waitFor(() =>
      expect(transport.listeners.has("first-in-room")).toBe(true),
    );
    await act(async () => {
      await transport.listeners.get("first-in-room")!();
    });
    const sessionDialog = screen
      .getByRole("button", { name: "Stop session" })
      .closest('[role="dialog"]')!;
    fireEvent.keyDown(sessionDialog, { key: "Escape" });
    await act(async () => {});
    const { app, store, history } = window.h;
    vi.useFakeTimers();
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    await advance(20_001);
    const sceneMessages = () =>
      transport.emit.mock.calls
        .filter(([event]) => event === "server-broadcast")
        .map(([, , buffer]) => JSON.parse(new TextDecoder().decode(buffer)));
    expect(sceneMessages()).toContainEqual(
      expect.objectContaining({
        type: "SCENE_UPDATE",
        payload: { elements: [expect.objectContaining({ type: "rectangle" })] },
      }),
    );
    restart();
    const saved = serializeAsJSON(
      app.getSceneElements(),
      app.state,
      app.files,
      "local",
    );
    const undoLength = history.undoStack.length;
    transport.emit.mockClear();
    await advance(45_000);
    await act(async () => {
      transport.listeners.get("room-user-change")!([
        "local-user",
        "remote-user",
      ]);
    });
    expect(app.state.collaborators.size).toBe(2);
    const increments = vi.fn();
    const unsubscribe = store.onStoreIncrementEmitter.on(increments);
    await advance(44_999);
    expect(
      screen.queryByText("Cookie", { selector: "title" }),
    ).not.toBeInTheDocument();
    await advance(1);
    expect(
      screen.getByText("Cookie", { selector: "title" }),
    ).toBeInTheDocument();
    await advance(8_000);
    expect(sceneMessages()).toEqual([]);
    expect(increments).not.toHaveBeenCalled();
    expect(
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local"),
    ).toBe(saved);
    expect(history.undoStack).toHaveLength(undoLength);
    unsubscribe();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getAllByTitle("Live collaboration...")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
    await act(async () => {});
    rendered.unmount();
    window.history.replaceState({}, "", "/");
    if (cryptoDescriptor) {
      Object.defineProperty(window.crypto, "subtle", cryptoDescriptor);
    } else {
      Reflect.deleteProperty(window.crypto, "subtle");
    }
  });
});
