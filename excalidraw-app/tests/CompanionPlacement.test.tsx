import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import ExcalidrawApp from "../App";

import { mockCompanionEditorGeometry } from "./helpers/companionGeometry";

const image = () =>
  screen.queryByRole("img", { name: "Your drawing companion" });
const home = () => image()!.parentElement!;

describe("Companion placement in the application editor", () => {
  let geometry: ReturnType<typeof mockCompanionEditorGeometry>;
  const observers = new Set<{
    callback: ResizeObserverCallback;
    targets: Set<Element>;
  }>();

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
    geometry = mockCompanionEditorGeometry();
    observers.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets = new Set<Element>();
        constructor(public callback: ResizeObserverCallback) {
          observers.add(this);
        }
        observe = (target: Element) => this.targets.add(target);
        unobserve = (target: Element) => this.targets.delete(target);
        disconnect = () => observers.delete(this);
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const resize = (width: number, height: number) => {
    Object.assign(geometry, { width, height });
    act(() => {
      window.h.app.setState({ width, height });
      window.h.app.refreshEditorInterface();
      fireEvent(window, new Event("resize"));
    });
  };

  const resizeControl = (target: Element) =>
    act(() => {
      for (const observer of observers) {
        if (observer.targets.has(target)) {
          observer.callback([], observer as unknown as ResizeObserver);
        }
      }
    });

  it("keeps its smaller phone character above navigation after editor resize", async () => {
    await render(<ExcalidrawApp />);
    expect(image()).toBeVisible();
    geometry.bottomBarHeight = 76;
    resize(390, 740);
    await waitFor(() => expect(getComputedStyle(home()).width).toBe("78px"));
    expect(Number.parseFloat(getComputedStyle(home()).bottom)).toBeGreaterThan(
      76,
    );
    expect(
      screen.getByRole("button", { name: "Hide companion" }),
    ).toBeVisible();

    resize(1280, 800);
    expect(getComputedStyle(home()).width).toBe("90px");
    const beforePan = home().getAttribute("style");
    act(() => window.h.app.setState({ scrollX: 200, scrollY: -300 }));
    expect(home().getAttribute("style")).toBe(beforePan);
    UI.createElement("rectangle", { x: 500, y: 400, width: 100, height: 80 });
    expect(window.h.app.getSceneElements()).toHaveLength(1);
  });

  it("gives footer controls priority when their measured height changes", async () => {
    await render(<ExcalidrawApp />);
    expect(Number.parseFloat(getComputedStyle(home()).bottom)).toBeGreaterThan(
      48,
    );
    geometry.bottomBarHeight = 118;
    resizeControl(screen.getByRole("contentinfo"));
    expect(Number.parseFloat(getComputedStyle(home()).bottom)).toBeGreaterThan(
      118,
    );
    expect(image()).toBeVisible();
  });

  it("suspends when controls leave no room and restores without changing the enabled preference or focus", async () => {
    await render(<ExcalidrawApp />);
    resize(390, 740);
    const menu = screen.getByTestId("main-menu-trigger");
    menu.focus();
    resize(390, 220);
    expect(image()).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
    fireEvent.click(menu);
    expect(
      screen.getByRole("menuitem", { name: "Hide companion" }),
    ).toBeVisible();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    const focused = document.activeElement;
    resize(390, 740);
    expect(image()).toBeVisible();
    expect(document.activeElement).toBe(focused);

    resize(390, 220);
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide companion" }));
    resize(390, 740);
    expect(image()).not.toBeInTheDocument();
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    expect(image()).toBeVisible();
  });

  it("moves inward for an open sidebar and suspends while a phone sidebar occupies the drawing", async () => {
    const { container } = await render(<ExcalidrawApp />);
    fireEvent.click(container.querySelector(".sidebar-trigger")!);
    await waitFor(() =>
      expect(Number.parseFloat(getComputedStyle(home()).right)).toBeGreaterThan(
        302,
      ),
    );
    act(() => window.h.app.updateScene({ appState: { openSidebar: null } }));
    expect(Number.parseFloat(getComputedStyle(home()).right)).toBeLessThan(302);

    resize(320, 640);
    expect(image()).toBeVisible();
    fireEvent.click(container.querySelector(".sidebar-trigger")!);
    await waitFor(() => expect(image()).not.toBeInTheDocument());
    act(() => window.h.app.updateScene({ appState: { openSidebar: null } }));
    expect(image()).toBeVisible();
  });
});
