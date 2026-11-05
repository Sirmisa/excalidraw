import { Profiler, StrictMode } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { vi } from "vitest";
import {
  act,
  fireEvent,
  waitFor,
  render,
  screen,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";
import { AppMainMenu } from "../components/AppMainMenu";
import { Companion } from "../components/Companion";
import { CompanionPreference } from "../components/CompanionPreference";

import { mockCompanionEditorGeometry } from "./helpers/companionGeometry";
import { withOwnedEditor } from "./helpers/ownedEditor";

const preferenceKey = "excalidraw-companion";
const companion = () =>
  screen.queryByRole("img", { name: "Your drawing companion" });

const openMenu = async () => {
  await act(async () => {});
  await act(async () => {
    const trigger = screen.getByTestId("main-menu-trigger");
    if (trigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(trigger);
    }
  });
};

describe("Companion visibility preference", () => {
  beforeEach(() => {
    mockCompanionEditorGeometry();
    localStorage.removeItem(preferenceKey);
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
  afterEach(() => vi.restoreAllMocks());

  it("retains X and menu choices when the application is reopened", async () => {
    let application = await render(<ExcalidrawApp />);
    fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
    application.unmount();

    application = await render(<ExcalidrawApp />);
    expect(companion()).not.toBeInTheDocument();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
    expect(companion()).toBeVisible();
    application.unmount();

    application = await render(<ExcalidrawApp />);
    expect(companion()).toBeVisible();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide companion" }));
    application.unmount();

    await render(<ExcalidrawApp />);
    expect(companion()).not.toBeInTheDocument();
    await openMenu();
    expect(
      screen.getByRole("menuitem", { name: "Show companion" }),
    ).toBeVisible();
  });

  it.each([null, "shown", "invalid", "false", ""])(
    "defaults to visible for missing/invalid values and respects shown (%s)",
    async (stored) => {
      if (stored !== null) {
        localStorage.setItem(preferenceKey, stored);
      }
      const writes = vi.spyOn(localStorage, "setItem");
      await render(<ExcalidrawApp />);

      expect(companion()).toBeVisible();
      await openMenu();
      expect(
        screen.getByRole("menuitem", { name: "Hide companion" }),
      ).toBeVisible();
      expect(
        writes.mock.calls.filter(([key]) => key === preferenceKey),
      ).toEqual([]);
    },
  );

  it.each(["read", "write"])(
    "keeps hide and restore usable when storage %s fails",
    async (failure) => {
      const method = failure === "read" ? "getItem" : "setItem";
      const originalGet = localStorage.getItem.bind(localStorage);
      const originalSet = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, method).mockImplementation(
        (key: string, value?: string) => {
          if (key === preferenceKey) {
            throw new DOMException("Storage blocked or full");
          }
          return failure === "read"
            ? originalGet(key)
            : originalSet(key, value!);
        },
      );
      await render(<ExcalidrawApp />);

      expect(companion()).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
      expect(companion()).not.toBeInTheDocument();
      await openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));
      expect(companion()).toBeVisible();
      await openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "Hide companion" }));
      expect(companion()).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("keeps temporary suspension separate from remembered explicit choices", async () => {
    localStorage.setItem(preferenceKey, "shown");
    const writes = vi.spyOn(localStorage, "setItem");
    const application = await render(<ExcalidrawApp />);
    const { app } = window.h;
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
    const visibility = vi.spyOn(document, "hidden", "get");
    visibility.mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(companion()).not.toBeInTheDocument();
    visibility.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(companion()).toBeVisible();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    await waitFor(() => expect(companion()).not.toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(companion()).toBeVisible());
    expect(writes.mock.calls.filter(([key]) => key === preferenceKey)).toEqual(
      [],
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
    act(() => app.updateScene({ appState: { zenModeEnabled: true } }));
    act(() => app.updateScene({ appState: { zenModeEnabled: false } }));
    expect(companion()).not.toBeInTheDocument();
    application.unmount();
    await render(<ExcalidrawApp />);
    expect(companion()).not.toBeInTheDocument();
  });

  it("keeps saved and exported drawings separate from the visibility choice", async () => {
    await render(<ExcalidrawApp />);
    UI.createElement("rectangle", { x: 100, y: 100, width: 200, height: 100 });
    const { app, history } = window.h;
    const serialize = () => [
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "local"),
      serializeAsJSON(app.getSceneElements(), app.state, app.files, "database"),
    ];
    const before = serialize();
    const undoLength = history.undoStack.length;
    const writes = vi.spyOn(localStorage, "setItem");
    fireEvent.click(screen.getByRole("button", { name: "Hide companion" }));
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Show companion" }));

    expect(serialize()).toEqual(before);
    expect(history.undoStack).toHaveLength(undoLength);
    expect(writes.mock.calls.filter(([key]) => key === preferenceKey)).toEqual([
      [preferenceKey, "hidden"],
      [preferenceKey, "shown"],
    ]);
    expect(before.join("")).not.toMatch(/companion/i);
  });

  it.each([false, true])(
    "uses its mounted editor window, including unavailable storage (%s)",
    async (blocked) => {
      localStorage.setItem(preferenceKey, "shown");
      await withOwnedEditor(
        document,
        async ({ ownerDocument, ownerWindow, renderOwned }) => {
          const stored = new Map([[preferenceKey, "hidden"]]);
          const ownedStorage: Storage = {
            get length() {
              return stored.size;
            },
            clear: () => stored.clear(),
            key: (index) => Array.from(stored.keys())[index] ?? null,
            getItem: (key) => stored.get(key) ?? null,
            setItem: (key, value) => {
              stored.set(key, value);
            },
            removeItem: (key) => {
              stored.delete(key);
            },
          };
          Object.defineProperties(ownerWindow, {
            localStorage: {
              get: () => {
                if (blocked) {
                  throw new ownerWindow.DOMException("Storage unavailable");
                }
                return ownedStorage;
              },
            },
          });

          const application = await renderOwned(
            <StrictMode>
              <Excalidraw ownerDocument={ownerDocument}>
                <CompanionPreference>
                  {(enabled, onChange) => (
                    <>
                      <AppMainMenu
                        companionEnabled={enabled}
                        onToggleCompanion={() => onChange(!enabled)}
                        onCollabDialogOpen={() => {}}
                        isCollaborating={false}
                        isCollabEnabled={false}
                        theme="light"
                        refresh={() => {}}
                      />
                      <Companion
                        enabled={enabled}
                        onHide={() => onChange(false)}
                      />
                    </>
                  )}
                </CompanionPreference>
              </Excalidraw>
            </StrictMode>,
          );
          const image = () =>
            application.queryByRole("img", { name: "Your drawing companion" });
          if (blocked) {
            expect(image()).toBeVisible();
            fireEvent.click(
              application.getByRole("button", { name: "Hide companion" }),
            );
          }
          expect(image()).not.toBeInTheDocument();
          fireEvent.click(application.getByTestId("main-menu-trigger"));
          fireEvent.click(
            application.getByRole("menuitem", { name: "Show companion" }),
          );
          expect(image()).toBeVisible();
          if (!blocked) {
            expect(stored.get(preferenceKey)).toBe("shown");
          }
          fireEvent.click(
            application.getByRole("button", { name: "Hide companion" }),
          );
          expect(image()).not.toBeInTheDocument();
          expect(localStorage.getItem(preferenceKey)).toBe("shown");
          expect([...stored]).toEqual([[preferenceKey, "hidden"]]);
        },
      );
    },
  );

  it("respects a stored hidden choice before presenting the Companion", async () => {
    localStorage.setItem(preferenceKey, "hidden");
    const presentations: boolean[] = [];
    await render(
      <Profiler
        id="application"
        onRender={() => presentations.push(!!companion())}
      >
        <ExcalidrawApp />
      </Profiler>,
    );

    expect(companion()).not.toBeInTheDocument();
    expect(presentations).not.toContain(true);
    await openMenu();
    expect(
      screen.getByRole("menuitem", { name: "Show companion" }),
    ).toBeVisible();
  });
});
