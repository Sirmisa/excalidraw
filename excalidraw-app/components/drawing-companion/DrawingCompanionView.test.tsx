import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Excalidraw, Footer } from "@excalidraw/excalidraw";

import { DrawingCompanionView } from "./DrawingCompanionView";

import type { CompanionSnapshot } from "./behavior";

const idle: CompanionSnapshot = { pose: "idle", bubble: null };
const onToggleTips = vi.fn();
const onHide = vi.fn();
const Harness = ({
  snapshot = idle,
  tipsEnabled = true,
}: {
  snapshot?: CompanionSnapshot;
  tipsEnabled?: boolean;
}) => (
  <Excalidraw>
    <Footer>
      <DrawingCompanionView
        snapshot={snapshot}
        reducedMotion={false}
        paused={false}
        tipsEnabled={tipsEnabled}
        onToggleTips={onToggleTips}
        onHide={onHide}
      />
    </Footer>
  </Excalidraw>
);
const trigger = () => screen.getByRole("button", { name: "Drawing companion" });
const open = async () => {
  fireEvent.click(trigger());
  await screen.findByRole("menu");
};
beforeEach(() => vi.clearAllMocks());

it("menu_opens_only_deliberately", async () => {
  const { rerender, container } = render(<Harness />);
  await screen.findByRole("button", { name: "Drawing companion" });
  expect(trigger()).toBeVisible();
  expect(screen.queryByRole("menu")).toBeNull();
  rerender(
    <Harness
      snapshot={{
        pose: "drinking",
        bubble: { kind: "personality", id: "drinking" },
      }}
    />,
  );
  expect(screen.queryByRole("menu")).toBeNull();
  const canvas = container.querySelector("canvas")!;
  for (const dismiss of [fireEvent.pointerDown, fireEvent.touchStart]) {
    await open();
    dismiss(canvas);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }
  await open();
});

it("escape_restores_trigger_focus", async () => {
  render(<Harness />);
  await screen.findByRole("button", { name: "Drawing companion" });
  trigger().focus();
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });
  const menu = await screen.findByRole("menu");
  const item = screen.getByRole("menuitemcheckbox", { name: "Drawing tips" });
  item.focus();
  fireEvent.keyDown(menu, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(trigger()).toHaveFocus();
});

it("settings_call_their_callbacks_without_changing_the_canvas", async () => {
  render(<Harness />);
  await screen.findByRole("button", { name: "Drawing companion" });
  await waitFor(() => expect(window.h.state.isLoading).toBe(false));
  const elements = window.h.elements;
  const selection = window.h.state.selectedElementIds;
  const tool = window.h.state.activeTool;
  await open();
  fireEvent.click(
    screen.getByRole("menuitemcheckbox", { name: "Drawing tips" }),
  );
  expect(onToggleTips).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await open();
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Hide drawing companion" }),
  );
  expect(onHide).toHaveBeenCalledTimes(1);
  expect(window.h.elements).toEqual(elements);
  expect(window.h.state.selectedElementIds).toEqual(selection);
  expect(window.h.state.activeTool).toEqual(tool);
});

it("automatic_bubbles_do_not_move_focus_or_announce_alerts", async () => {
  const { rerender, container } = render(<Harness />);
  await screen.findByRole("button", { name: "Drawing companion" });
  trigger().focus();
  rerender(
    <Harness snapshot={{ pose: "idle", bubble: { kind: "tip", id: "pan" } }} />,
  );
  expect(trigger()).toHaveFocus();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(container.querySelector(".drawing-companion [aria-live]")).toBeNull();
  expect(
    container.querySelectorAll(".drawing-companion svg[aria-hidden='true']")
      .length,
  ).toBeGreaterThan(0);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.getByText(/pan the canvas/)).toBeVisible();
});

it("tips_toggle_exposes_both_accessible_checked_states", async () => {
  const { rerender } = render(<Harness tipsEnabled />);
  await screen.findByRole("button", { name: "Drawing companion" });
  await open();
  fireEvent.click(
    screen.getByRole("menuitemcheckbox", {
      name: "Drawing tips",
      checked: true,
    }),
  );
  expect(onToggleTips).toHaveBeenCalledTimes(1);
  rerender(<Harness tipsEnabled={false} />);
  await open();
  expect(
    screen.getByRole("menuitemcheckbox", {
      name: "Drawing tips",
      checked: false,
    }),
  ).toBeVisible();
});
