import { useCallback, useState } from "react";

import { activeConfirmDialogAtom } from "@excalidraw/excalidraw/components/ActiveConfirmDialog";
import { Excalidraw, Sidebar } from "@excalidraw/excalidraw";
import { overwriteConfirmStateAtom } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import {
  act,
  cleanup,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import { AppFooter } from "../components/AppFooter";
import { AppMainMenu } from "../components/AppMainMenu";
import { useCompanionPreferences } from "../components/drawing-companion/useCompanionPreferences";

const Host = ({
  suppressed = false,
  ui = true,
  docked = true,
  dir = "ltr",
}: {
  suppressed?: boolean;
  ui?: ExcalidrawProps["ui"];
  docked?: boolean;
  dir?: string;
}) => {
  const [owner, setOwner] = useState<Window | null>(null);
  const attach = useCallback(
    (node: HTMLDivElement | null) =>
      setOwner(node?.ownerDocument.defaultView ?? null),
    [],
  );
  const { preferences, ready, updatePreferences } =
    useCompanionPreferences(owner);
  return (
    <div ref={attach} dir={dir}>
      <Excalidraw ui={ui}>
        <AppFooter
          onChange={() => {}}
          companionPreferences={ready ? preferences : null}
          onCompanionPreferencesChange={updatePreferences}
          companionSuppressed={suppressed}
        />
        <AppMainMenu
          theme="light"
          isCollaborating={false}
          isCollabEnabled={false}
          onCollabDialogOpen={() => {}}
          refresh={() => {}}
          companionPreferences={ready ? preferences : null}
          onCompanionPreferencesChange={updatePreferences}
        />
        <Sidebar name="companion-test" docked={docked}>
          <div>Sidebar content</div>
        </Sidebar>
      </Excalidraw>
    </div>
  );
};
const trigger = () =>
  screen.queryByRole("button", { name: "Drawing companion" });
const choose = async (name: string) => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Drawing companion" }),
  );
  fireEvent.click(
    await screen.findByRole(
      name === "Drawing tips" ? "menuitemcheckbox" : "menuitem",
      { name },
    ),
  );
};
const restore = async () => {
  fireEvent.click(screen.getByTestId("main-menu-trigger"));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Show drawing companion" }),
  );
  await waitFor(() => expect(trigger()).toBeVisible());
};
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.mocked(window.matchMedia).mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }));
  localStorage.clear();
  mockBoundingClientRect({ width: 1600, height: 1000 });
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  cleanup();
  editorJotaiStore.set(overwriteConfirmStateAtom, { active: false });
  editorJotaiStore.set(activeConfirmDialogAtom, null);
  vi.useRealTimers();
  vi.restoreAllMocks();
  restoreOriginalGetBoundingClientRect();
});

it("hidden_companion_can_be_restored_from_main_menu", async () => {
  const { container } = await render(<Host />);
  await waitFor(() => expect(trigger()).toBeVisible());
  await choose("Hide drawing companion");
  expect(trigger()).toBeNull();
  expect(container.querySelector(".excalidraw")).toHaveFocus();
  await restore();
  expect(trigger()).toBeVisible();
  expect(
    JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION)!,
    ),
  ).toEqual({ version: 1, enabled: true, tipsEnabled: true });
});

it("disabled_tips_remain_disabled_after_restore", async () => {
  await render(<Host />);
  await choose("Drawing tips");
  await choose("Hide drawing companion");
  await restore();
  expect(
    JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION)!,
    ),
  ).toEqual({ version: 1, enabled: true, tipsEnabled: false });
  fireEvent.click(trigger()!);
  expect(
    await screen.findByRole("menuitemcheckbox", { name: "Drawing tips" }),
  ).not.toHaveClass("dropdown-menu-item--selected");
});

it("stays_out_of_embedded_editor_by_default", async () => {
  const { container } = await render(<Excalidraw />);
  expect(container.querySelector(".drawing-companion")).toBeNull();
  fireEvent.click(screen.getByTestId("main-menu-trigger"));
  expect(screen.queryByText("Show drawing companion")).toBeNull();
});

it("saved_hidden_preferences_are_hydrated_before_showing", async () => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION,
    '{"version":1,"enabled":false,"tipsEnabled":false}',
  );
  await render(<Host />);
  expect(trigger()).toBeNull();
  await restore();
  expect(trigger()).toBeVisible();
  expect(
    JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION)!,
    ).tipsEnabled,
  ).toBe(false);
});

it("suppression_resets_without_catchup", async () => {
  const { rerender, container } = await render(<Host suppressed />);
  vi.useFakeTimers();
  rerender(<Host />);
  tick(45_000);
  expect(container.querySelector(".drawing-companion")).toHaveAttribute(
    "data-pose",
    "drawing",
  );
  rerender(<Host suppressed />);
  expect(trigger()).toBeNull();
  tick(1_200_000);
  rerender(<Host />);
  tick(44_999);
  expect(container.querySelector(".drawing-companion")).toHaveAttribute(
    "data-pose",
    "idle",
  );
  expect(container.querySelector(".drawing-companion__bubble")).toBeNull();
  tick(1);
  expect(container.querySelector(".drawing-companion")).toHaveAttribute(
    "data-pose",
    "drawing",
  );
});

it.each(["zen", "dialog", "error", "overwrite", "ui", "phone"])(
  "suppresses_%s_and_restarts_a_full_idle_interval",
  async (reason) => {
    const { rerender, container } = await render(<Host suppressed />);
    vi.useFakeTimers();
    rerender(<Host />);
    tick(44_000);
    act(() => {
      if (reason === "zen") {
        window.h.app.setState({ zenModeEnabled: true });
      }
      if (reason === "dialog") {
        window.h.app.setState({ openDialog: { name: "help" } });
      }
      if (reason === "error") {
        window.h.app.setState({ errorMessage: "Test error" });
      }
      if (reason === "overwrite") {
        editorJotaiStore.set(overwriteConfirmStateAtom, {
          active: true,
          title: "Overwrite?",
          description: "Test",
          actionLabel: "OK",
          color: "warning",
          onClose() {},
          onConfirm() {},
          onReject() {},
        });
      }
      if (reason === "phone") {
        mockBoundingClientRect({ width: 400, height: 700 });
        window.h.app.refreshEditorInterface();
        window.h.app.refresh();
      }
    });
    if (reason === "ui") {
      rerender(<Host ui={false} />);
    }
    expect(trigger()).toBeNull();
    expect(container.querySelector(".drawing-companion")).toBeNull();
    tick(1_200_000);
    act(() => {
      window.h.app.setState({
        zenModeEnabled: false,
        openDialog: null,
        errorMessage: null,
      });
      editorJotaiStore.set(overwriteConfirmStateAtom, { active: false });
      mockBoundingClientRect({ width: 1600, height: 1000 });
      window.h.app.refreshEditorInterface();
      window.h.app.refresh();
    });
    rerender(<Host />);
    tick(44_999);
    expect(container.querySelector(".drawing-companion")).toHaveAttribute(
      "data-pose",
      "idle",
    );
    tick(1);
    expect(container.querySelector(".drawing-companion")).toHaveAttribute(
      "data-pose",
      "drawing",
    );
  },
);

it("sidebar_uses_available_footer_area_and_suppresses_when_floating", async () => {
  const { rerender, container } = await render(<Host />);
  act(() => {
    window.h.app.refreshEditorInterface();
    window.h.app.setState({ openSidebar: { name: "companion-test" } });
  });
  await waitFor(() =>
    expect(container.querySelector(".sidebar--docked")).not.toBeNull(),
  );
  const companion = container.querySelector(".drawing-companion")!;
  expect(companion.closest("footer")?.parentElement).toHaveClass(
    "layer-ui__wrapper",
  );
  expect(companion.parentElement).toHaveClass("footer-center");
  rerender(<Host docked={false} />);
  expect(trigger()).toBeNull();
  rerender(<Host docked />);
  expect(trigger()).toBeVisible();
});

it("menus_do_not_change_the_scene_or_history", async () => {
  await render(<Host />);
  const first = API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  });
  const second = API.createElement({
    type: "rectangle",
    x: 300,
    y: 100,
    width: 100,
    height: 100,
  });
  API.setElements([first, second]);
  API.setAppState({
    selectedElementIds: { [first.id]: true, [second.id]: true },
  });
  const elements = JSON.parse(JSON.stringify(window.h.elements));
  const history = [...window.h.history.undoStack];
  const selection = { ...window.h.state.selectedElementIds };
  const tool = window.h.state.activeTool;
  await choose("Drawing tips");
  await choose("Hide drawing companion");
  await restore();
  fireEvent.keyDown(trigger()!, { key: "ArrowDown" });
  const item = await screen.findByRole("menuitemcheckbox", {
    name: "Drawing tips",
  });
  item.focus();
  fireEvent.keyDown(item, { key: "g", ctrlKey: true });
  fireEvent.keyDown(item, { key: "Escape" });
  expect(trigger()).toHaveFocus();
  expect(window.h.elements).toEqual(elements);
  expect(window.h.history.undoStack).toEqual(history);
  expect(window.h.state.selectedElementIds).toEqual(selection);
  expect(window.h.state.activeTool).toEqual(tool);
});

it("rtl_bubbles_stay_inside_the_passive_absolute_footer_child", async () => {
  const { rerender, container } = await render(<Host suppressed dir="rtl" />);
  vi.useFakeTimers();
  rerender(<Host dir="rtl" />);
  tick(480_000);
  const companion = container.querySelector(".drawing-companion")!;
  const bubble = companion.querySelector(".drawing-companion__bubble")!;
  expect(bubble).toBeVisible();
  expect(bubble.querySelector("button, a, [tabindex], [aria-live]")).toBeNull();
  expect(companion.parentElement).toHaveClass("footer-center");
  expect(companion.parentElement?.children).toHaveLength(2);
});

it("clear_canvas_modal_suppresses_and_restarts_fresh_timers", async () => {
  const { rerender, container } = await render(<Host suppressed />);
  vi.useFakeTimers();
  rerender(<Host />);
  tick(44_000);
  await act(async () => {
    editorJotaiStore.set(activeConfirmDialogAtom, "clearCanvas");
  });
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(container.querySelector(".drawing-companion")).toBeNull();
  tick(1_200_000);
  await act(async () => {
    editorJotaiStore.set(activeConfirmDialogAtom, null);
  });
  tick(44_999);
  expect(container.querySelector(".drawing-companion")).toHaveAttribute(
    "data-pose",
    "idle",
  );
  tick(1);
  expect(container.querySelector(".drawing-companion")).toHaveAttribute(
    "data-pose",
    "drawing",
  );
});

it.each(["Reset library", "Remove", "Rename or publish"])(
  "docked_library_modal_%s_suppresses_and_restarts_fresh_timers",
  async (action) => {
    const { rerender, container } = await render(<Host suppressed />);
    act(() => {
      window.h.app.refreshEditorInterface();
      window.h.app.setState({ defaultSidebarDockedPreference: true });
    });
    await act(() =>
      window.h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "companion-modal-item",
            status: "unpublished",
            created: 1,
            elements: [API.createElement({ type: "rectangle" })],
          },
        ],
        openLibraryMenu: true,
      }),
    );
    await waitFor(() =>
      expect(container.querySelector(".library-unit__dragger")).not.toBeNull(),
    );
    if (action !== "Reset library") {
      fireEvent.click(container.querySelector(".library-unit__dragger")!, {
        shiftKey: true,
      });
    }
    vi.useFakeTimers();
    rerender(<Host />);
    expect(trigger()).toBeVisible();
    tick(44_000);
    fireEvent.click(
      container.querySelector(
        ".library-menu-dropdown-container .dropdown-menu-button",
      )!,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: action }));
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(container.querySelector(".drawing-companion")).toBeNull();
    tick(1_200_000);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name:
            action === "Rename or publish" ? "Save name(s) and exit" : "Cancel",
        }),
      );
    });
    tick(44_999);
    expect(container.querySelector(".drawing-companion")).toHaveAttribute(
      "data-pose",
      "idle",
    );
    tick(1);
    expect(container.querySelector(".drawing-companion")).toHaveAttribute(
      "data-pose",
      "drawing",
    );
  },
);
