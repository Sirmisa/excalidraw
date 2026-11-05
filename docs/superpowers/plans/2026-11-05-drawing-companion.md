# Drawing Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent, cheerful blob companion to the drawing app, with quiet random activities, sparse useful tips, and remembered visibility controls.

**Architecture:** Keep all companion behavior and UI app-owned. A timer-driven scheduler feeds an SVG/CSS view through a lifecycle hook; an app-root preference hook supplies the footer and main-menu controls. Mount through the existing footer tunnel so the companion follows the available canvas area, without changing the reusable editor API or scene data.

**Tech Stack:** Existing React 19, TypeScript, SCSS, SVG, Radix-backed Excalidraw dropdown components, Vitest 3, and Testing Library. No new dependencies.

**Spec:** [Approved design](../specs/2026-11-05-drawing-companion-design.md)

## Global Constraints

- The companion follows a fixed repertoire of randomly scheduled animations, independent of the user's actions or drawing content.
- Ship in `excalidraw-app`, enabled by default on non-phone layouts.
- Use SVG artwork and CSS animations for the first version.
- No sound, notifications, requests for attention, or care obligations.
- Activity duration is generally 8–15 seconds, followed by a fresh 45–90-second idle interval.
- Tips have a separate random 8–12-minute timer and stay visible for approximately eight seconds.
- Personality messages stay visible for approximately five seconds, appear at most once in three minutes, and have a 25% starting probability at eligible activity completions.
- One activity and one bubble at a time; no immediate repetition of an activity or tip.
- The complete animation footprint is around 80–96 CSS pixels wide.
- Stop timers and pause animations in a hidden owning document; resume idle with fresh intervals and no catch-up.
- Suppress the companion in Zen mode, phone layouts, modal editor dialogs, unavailable standard UI, and overlapping floating sidebars.
- Respect `prefers-reduced-motion` with static activity poses and no repeated movement.
- Store only a versioned object containing `enabled` and `tipsEnabled` in a dedicated app local-storage key. Both default to true.
- Use `app.ownerDocument`/`app.ownerWindow`, or a mounted node's `ownerDocument`/`defaultView`, for new browser APIs. Use `Merge<Base, Overrides>` when overriding type properties.
- No external services, new assets, animation libraries, or dependencies are required.
- Nothing is added to scene data, exports, collaboration payloads, or undo state.

## Review Focus

- Storage can throw on property access, contain malformed JSON, or contain an unknown version; drawing and session controls must continue working. Task 1 tests these cases.
- React Strict Mode, document changes, and rapid hide/show can duplicate timers or write stale preferences into another window; initialization and cleanup must stay local. Tasks 1 and 3 test these cases.
- A tip becoming due during a personality message must replace it without inheriting the earlier dismissal deadline. Task 2 tests this race.
- Menu keys and clicks, including Escape and hiding the focused trigger, must preserve keyboard usability without changing the canvas. Tasks 4 and 5 test these cases.
- Narrow layouts, RTL, long translations, and sidebar changes must keep the blob and bubbles within the available drawing area. Task 5 tests layout structure and includes real-browser geometry checks.

---

## File map and repository references

Create under `excalidraw-app/components/drawing-companion/`:

| File | Responsibility |
| --- | --- |
| `preferences.ts` | Preference types, versioned storage parsing and writing |
| `useCompanionPreferences.ts` | Readiness and session state bound to an owning window |
| `behavior.ts` | Activity/message IDs, timing constants, scheduler |
| `useCompanionBehavior.ts` | React lifecycle, document visibility, motion preference |
| `DrawingCompanionSprite.tsx` | Decorative SVG poses and props |
| `DrawingCompanionView.tsx` | Accessible trigger/menu and translated bubble |
| `DrawingCompanion.tsx` | Editor contexts, suppression rules, behavior/view composition |
| `DrawingCompanion.scss` | Scoped placement, artwork, keyframes, theme/motion styles |
| `preferences.test.ts`, `useCompanionPreferences.test.tsx` | Persistence and session behavior |
| `behavior.test.ts`, `useCompanionBehavior.test.tsx` | Scheduling and lifecycle |
| `DrawingCompanionView.test.tsx` | Deliberate menu interactions and passive text |

Modify `excalidraw-app/App.tsx`, `components/AppFooter.tsx`,
`components/AppMainMenu.tsx`, and `app_constants.ts`. Add English strings in
`packages/excalidraw/locales/en.json`. Create
`excalidraw-app/tests/DrawingCompanion.test.tsx` for editor integration.

Read these existing patterns before their associated tasks:

- `packages/excalidraw/components/footer/FooterCenter.tsx` and `.scss`:
  app-footer children are tunneled into the editor's footer.
- `excalidraw-app/index.scss`: the app already right-aligns `.footer-center`.
- `packages/excalidraw/components/LayerUI.tsx`: the containing wrapper shrinks
  when a docked sidebar fits; consume this placement instead of calculating a
  second sidebar offset.
- `packages/excalidraw/components/dropdownMenu/`: existing owner-document
  outside-click/Escape handling and nonmodal menus. Content prevents automatic
  return focus, so explicitly restore it when appropriate.
- `excalidraw-app/tests/MobileMenu.test.tsx` and
  `packages/excalidraw/tests/test-utils.ts`: async editor setup and dimensions.
- `packages/excalidraw/tests/hostAbstraction.test.tsx`: iframe-owning documents.

Use direct Testing Library `render`/`renderHook` for hook tests and the view
test harness; use the repository's async `render` helper for editor tests.
Do not introduce a separate test runner or browser harness.

### Task 1: Remember companion preferences safely

**Files:** Create `preferences.ts`, `useCompanionPreferences.ts`, and their two tests in the directory above. Modify `excalidraw-app/app_constants.ts`.

**Interfaces:**

- Export `CompanionPreferences = { enabled: boolean; tipsEnabled: boolean }` and `UpdateCompanionPreferences = (patch: Partial<CompanionPreferences>) => void`.
- `readCompanionPreferences(ownerWindow: Window): CompanionPreferences`.
- `writeCompanionPreferences(ownerWindow: Window, preferences: CompanionPreferences): void`.
- `useCompanionPreferences(ownerWindow: Window | null): { preferences: CompanionPreferences; ready: boolean; updatePreferences: UpdateCompanionPreferences }`.
- Add `STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION = "excalidraw-drawing-companion"`; stored schema is `{ version: 1, enabled: boolean, tipsEnabled: boolean }`.

- [ ] **Step 1: Prepare the existing toolchain.** At execution time, first follow `using-git-worktrees`; do not create a worktree during planning. This checkout has no `node_modules`. Check installed Node/Yarn against `package.json` (`yarn@1.22.22`, Node `>=18.0.0`), then run `yarn install --frozen-lockfile` in the execution checkout if dependencies are still absent. Expect exit 0 and no lockfile change; surface network failures instead of silently skipping verification.
- [ ] **Step 2: Write persistence and hook tests.** Test `defaults_when_missing_or_invalid`, `validates_fields_individually`, `survives_storage_getter_and_write_errors`, `does_not_write_before_hydration`, `keeps_session_changes_when_storage_fails`, and `does_not_copy_preferences_between_owning_windows`. Required assertions include:

  ```ts
  expect(readCompanionPreferences(ownerWindow)).toEqual({ enabled: true, tipsEnabled: true });
  // With stored { version: 1, enabled: false, tipsEnabled: "false" }:
  expect(readCompanionPreferences(ownerWindow)).toEqual({ enabled: false, tipsEnabled: true });
  // With stored version 99: both defaults. A throwing localStorage getter: no throw.
  // After updatePreferences({ enabled: false }) with setItem throwing:
  expect(result.current.preferences.enabled).toBe(false);
  expect(result.current.ready).toBe(true);
  ```

  Cover malformed JSON, JSON `null`/arrays/primitives, and Strict Mode remounts.
  Hook tests create an iframe-owned window, rerender with it, and assert its
  own saved values are read without receiving the previous window's state.
- [ ] **Step 3: Run the new tests and observe failure.** Run `yarn test:app --run excalidraw-app/components/drawing-companion/preferences.test.ts excalidraw-app/components/drawing-companion/useCompanionPreferences.test.tsx`. Expect missing companion modules/exports, not a toolchain failure.
- [ ] **Step 4: Implement storage and the hook.** Default each malformed boolean to true, reject unsupported versions, and catch errors including property access. Hydrate when the owning window is available; preserve current-session updates on write failure. Gate readiness and writes by the current window identity so a window switch cannot write previous values before hydration. Do not access storage at module scope or subscribe to cross-tab synchronization.
- [ ] **Step 5: Rerun the same test command.** Expect all new cases to pass.
- [ ] **Step 6: Commit only this task's files.** Message: `feat: remember drawing companion preferences`.

### Task 2: Schedule independent routines and occasional text

**Files:** Create `behavior.ts` and `behavior.test.ts`.

**Interfaces:**

- `CompanionActivity = "drawing" | "eating" | "drinking" | "sleeping" | "bathroom"`; `CompanionPose = "idle" | CompanionActivity`.
- `CompanionTipId = "pan" | "shortcuts" | "group" | "undo"`.
- `CompanionBubble = { kind: "tip"; id: CompanionTipId } | { kind: "personality"; id: CompanionActivity }`.
- `CompanionSnapshot = { pose: CompanionPose; bubble: CompanionBubble | null }`.
- `CompanionClock = { now: () => number; setTimeout: (callback: () => void, delay: number) => number; clearTimeout: (id: number) => void }`.
- `createCompanionScheduler(options: { clock: CompanionClock; random?: () => number; tipsEnabled: boolean; onChange: (snapshot: CompanionSnapshot) => void }): { setActive: (active: boolean) => void; setTipsEnabled: (enabled: boolean) => void; dispose: () => void }`.
- Export an immutable idle snapshot and timing constants for consumers/tests. Scheduler starts inactive and owns its timeouts; callbacks receive snapshots rather than mutable internal state.

- [ ] **Step 1: Write deterministic scheduler tests.** In `beforeEach`, use fake timers; bind a `CompanionClock` to the fake clock and collect snapshots through `onChange`. In `afterEach`, dispose the scheduler and restore real timers. Test minimum and maximum intervals using controlled random values 0 and `1 - Number.EPSILON`.

  ```ts
  // With random returning 0, after setActive(true):
  vi.advanceTimersByTime(44_999);
  expect(snapshots.at(-1)).toEqual({ pose: "idle", bubble: null });
  vi.advanceTimersByTime(1);
  expect(snapshots.at(-1)?.pose).toBe("drawing");
  vi.advanceTimersByTime(8_000);
  expect(snapshots.at(-1)?.pose).toBe("idle");
  vi.advanceTimersByTime(45_000);
  expect(snapshots.at(-1)?.pose).toBe("eating");
  ```

  Add named cases `tips_begin_after_480000_to_720000ms`,
  `tip_lives_for_8000ms`, `personality_lives_for_5000ms`,
  `personality_requires_180000ms_cooldown_and_25_percent_chance`,
  `does_not_repeat_previous_tip`, and `disabling_tips_keeps_activities_running`.
  Use finite random sequences when arranging message collisions. In
  `tip_replacement_gets_a_fresh_dismissal_deadline`, arrange a personality
  message less than five seconds before a tip, assert the tip is still present
  at that message's old dismissal time and gone at its own eight-second mark.
  Also test repeated `setActive(true)` is idempotent and inactive/disposed
  controllers emit no delayed changes.
- [ ] **Step 2: Run `yarn test:app --run excalidraw-app/components/drawing-companion/behavior.test.ts`.** Expect failure on the missing scheduler.
- [ ] **Step 3: Implement the scheduler.** Use inclusive integer timing ranges `[45000, 90000]`, `[8000, 15000]`, and `[480000, 720000]`. Uniformly choose an activity/tip excluding the previous one. Initialize the personality cooldown at activation, permit a message only after 180000ms and when `random() < 0.25`, and skip it while a tip is visible. Tip cadence is independent of activity transitions. Cancel the previous bubble's dismissal timeout when replacing it. Disabling tips removes a current tip and its timers, preserving personality/activity behavior; enabling tips starts a full new interval. Deactivation cancels all timers and resets idle; activation starts fresh intervals, with no catch-up. No scene or browser imports belong in this module.
- [ ] **Step 4: Rerun the scheduler tests.** Expect all cases to pass and no pending scheduler timers after disposal.
- [ ] **Step 5: Commit `behavior.ts` and its test.** Message: `feat: schedule independent companion routines`.

### Task 3: Bind behavior to its document and motion preferences

**Files:** Create `useCompanionBehavior.ts` and `useCompanionBehavior.test.tsx`.

**Interfaces:**

- Consume Task 2's scheduler and snapshot types.
- `useCompanionBehavior(options: { ownerDocument: Document; ownerWindow: Window; active: boolean; tipsEnabled: boolean }): { snapshot: CompanionSnapshot; reducedMotion: boolean; paused: boolean }`.
- `paused` is true when inactive or the owning document is hidden. Reduced motion changes presentation, not the activity/tip schedule.

- [ ] **Step 1: Write hook lifecycle tests.** Use direct `renderHook`, fake timers, and a controllable `matchMedia` object with a `change` listener. Test `pauses_and_resumes_without_catchup`, `reduced_motion_changes_keep_the_schedule`, `strict_mode_leaves_one_scheduler`, `rapid_suppression_clears_old_callbacks`, and `uses_only_the_owning_document_and_window`.

  ```ts
  // After hiding the owning document and dispatching its visibilitychange:
  expect(result.current.paused).toBe(true);
  expect(result.current.snapshot).toEqual({ pose: "idle", bubble: null });
  // Advance 20 minutes, show the document: no immediate action or bubble.
  expect(result.current.snapshot).toEqual({ pose: "idle", bubble: null });
  // Reduced-motion change updates the returned presentation flag:
  expect(result.current.reducedMotion).toBe(true);
  ```

  An iframe-window test spies on its `setTimeout`, `clearTimeout`, and
  `matchMedia`; top-window visibility/media events must not affect the hook.
  After unmount, assert registered visibility/media handlers are removed and
  every timeout created by this hook was cleared or already completed.
- [ ] **Step 2: Run `yarn test:app --run excalidraw-app/components/drawing-companion/useCompanionBehavior.test.tsx`.** Expect failure on the missing hook.
- [ ] **Step 3: Implement the hook.** Adapt the supplied owning window to `CompanionClock`, using its `performance.now()` for elapsed time. Subscribe to its document's `visibilitychange` and its `(prefers-reduced-motion: reduce)` media query. Create/dispose one scheduler per active document/window lifetime; update tips without restarting activities. Remove all subscriptions on suppression or unmount. Keep a hidden document subscribed for its return-to-visible event, but stop all scheduler timers. Never install global event listeners or animation-frame loops.
- [ ] **Step 4: Rerun hook and scheduler tests.** Run `yarn test:app --run excalidraw-app/components/drawing-companion/behavior.test.ts excalidraw-app/components/drawing-companion/useCompanionBehavior.test.tsx`; expect all cases to pass.
- [ ] **Step 5: Commit this task's files.** Message: `feat: respect companion visibility and reduced motion`.

### Task 4: Render the blob, its props, and its deliberate controls

**Files:** Create `DrawingCompanionSprite.tsx`, `DrawingCompanionView.tsx`, `DrawingCompanion.scss`, and `DrawingCompanionView.test.tsx`. Modify `packages/excalidraw/locales/en.json`.

**Interfaces:**

- `DrawingCompanionSprite({ pose }: { pose: CompanionPose }): React.JSX.Element` renders decorative SVG artwork, without timers or settings.
- `DrawingCompanionView({ snapshot, reducedMotion, paused, tipsEnabled, onToggleTips, onHide }: { snapshot: CompanionSnapshot; reducedMotion: boolean; paused: boolean; tipsEnabled: boolean; onToggleTips: () => void; onHide: () => void }): React.JSX.Element`.
- Root class `.drawing-companion`; expose `data-pose`, `data-paused`, and `data-reduced-motion` for styling and checks.
- Add `drawingCompanion` locale keys: `label`, `show`, `hide`, `tipsEnabled`, `tipLabel`, `tips.{pan,shortcuts,group,undo}`, and `messages.{drawing,eating,drinking,sleeping,bathroom}`.

- [ ] **Step 1: Write view interaction tests.** Mount the view in an `<Excalidraw><Footer>…</Footer></Excalidraw>` harness so existing dropdown contexts are real. Supply snapshots directly; do not test timer progression here. Test `menu_opens_only_deliberately`, `escape_restores_trigger_focus`, `settings_call_their_callbacks`, and `automatic_bubbles_do_not_move_focus_or_announce_alerts`.

  ```ts
  expect(screen.getByRole("button", { name: "Drawing companion" })).toBeVisible();
  // After keyboard opening and Escape:
  expect(screen.getByRole("button", { name: "Drawing companion" })).toHaveFocus();
  // After changing the supplied snapshot to a tip:
  expect(screen.queryByRole("alert")).toBeNull();
  expect(container.querySelector(".drawing-companion [aria-live]")).toBeNull();
  expect(previouslyFocusedElement).toHaveFocus();
  ```

  Assert the tip toggle and hide action call their callbacks once. Open the
  menu again after outside pointer/touch dismissal. Compare the editor scene,
  selection, and active tool before/after keyboard navigation and menu clicks.
- [ ] **Step 2: Run `yarn test:app --run excalidraw-app/components/drawing-companion/DrawingCompanionView.test.tsx`.** Expect failure on missing view/artwork.
- [ ] **Step 3: Implement the sprite, view, styles, and text.** Use existing `DropdownMenu` trigger/content/items; maintain controlled menu-open state locally, restore trigger focus after Escape, and stop companion pointer/key events from reaching drawing handlers while allowing Radix menu handling. Do not trigger activities from clicks. Hide all decorative SVGs from assistive technology. Use a closed-eye sleep pose and a discreet door/privacy-sign bathroom pose. Render lavender artwork with theme-aware outlines; no emoji props in the finished version. Use scoped CSS keyframes for breathing, blinking, drawing, sipping, eating, and sleep marks. Paused/reduced-motion rules disable every repeating animation/transition; static props still identify activities. Bubbles have no live region, actions, or pointer interception. Use existing translation and `getShortcutKey` conventions after checking current shortcuts. Copy should describe the blob's own routine and contain no instructions to take care of it.
- [ ] **Step 4: Rerun view tests.** Expect all interaction cases to pass. Review each explicit pose by rendering it in the development app when Task 5 mounts the feature; do not add a permanent pose selector or production debug controls.
- [ ] **Step 5: Commit the view, sprite, SCSS, test, and locale changes.** Message: `feat: draw the animated blob companion and controls`.

### Task 5: Mount the companion in the app and verify the whole feature

**Files:** Create `DrawingCompanion.tsx` and `excalidraw-app/tests/DrawingCompanion.test.tsx`. Modify `excalidraw-app/App.tsx`, `components/AppFooter.tsx`, `components/AppMainMenu.tsx`, and `DrawingCompanion.scss`.

**Interfaces:**

- `DrawingCompanion({ preferences, onPreferencesChange, suppressed = false }: { preferences: CompanionPreferences; onPreferencesChange: UpdateCompanionPreferences; suppressed?: boolean }): React.JSX.Element | null` consumes Tasks 3 and 4.
- Extend `AppFooter` props with `companionPreferences: CompanionPreferences | null`, `onCompanionPreferencesChange: UpdateCompanionPreferences`, and `companionSuppressed: boolean`.
- Extend `AppMainMenu` props with `companionPreferences: CompanionPreferences | null` and `onCompanionPreferencesChange: UpdateCompanionPreferences`.
- `null` preferences mean hydration is pending: omit the companion and disable the main-menu visibility control until ready.

- [ ] **Step 1: Write editor integration tests.** Use the existing async editor render helper with a small host component that attaches a root ref, calls Task 1's preference hook, and mounts the actual `AppFooter` and `AppMainMenu`. Reuse their public props rather than loading app networking/collaboration initialization. Test `hidden_companion_can_be_restored_from_main_menu`, `disabled_tips_remain_disabled_after_restore`, `stays_out_of_embedded_editor_by_default`, `suppression_resets_without_catchup`, `sidebar_uses_available_footer_area`, and `menus_do_not_change_the_scene`.

  ```ts
  // Hidden via the companion menu, restored via the main menu:
  expect(screen.queryByRole("button", { name: "Drawing companion" })).toBeNull();
  // Select "Show drawing companion" in the app menu:
  expect(screen.getByRole("button", { name: "Drawing companion" })).toBeVisible();
  // Suppressed layouts never render a trigger or a bubble:
  expect(container.querySelector(".drawing-companion")).toBeNull();
  expect(h.elements).toEqual(elementsBeforeInteraction);
  expect(h.history.undoStack).toEqual(historyBeforeInteraction);
  ```

  Cover phone dimensions, Zen mode, unavailable default UI, `openDialog`,
  editor errors, overwrite confirmation, and the explicit app-level
  `suppressed` prop. After closing each, require a full new idle interval.
  For docked sidebars assert the root is inside the footer's adjusted wrapper;
  for an overlapping floating sidebar assert suppression. Add long-text/RTL
  cases asserting the bubble is passive and does not add a footer flex item
  that displaces help/zoom controls. Real geometry is checked below.
- [ ] **Step 2: Run `yarn test:app --run excalidraw-app/tests/DrawingCompanion.test.tsx`.** Expect failure on the missing wrapper or new app-menu control.
- [ ] **Step 3: Integrate app state and placement.** Attach a stable callback ref to `ExcalidrawWrapper`'s existing outer div in `App.tsx`; derive its owning window and call `useCompanionPreferences`. Pass hydrated preferences and the updater to both app components. Read the existing share-dialog atom value and pass `companionSuppressed = shareDialogState.isOpen || !!latestShareableLink || !!errorMessage` into the footer. In the wrapper consume `useApp`, `useUIAppState`, `useEditorInterface`, and the existing editor-store sidebar/overwrite-confirm atoms. Its active predicate requires preferences enabled, non-phone layout, `app.isDefaultUIEnabled()`, no Zen/dialog/error/overwrite confirmation/app suppression, and no overlapping floating sidebar. Derive docking the same way as `LayerUI`: an open sidebar counts as docked only when its atom is true and `editorInterface.canFitSidebar`.
- [ ] **Step 4: Position and connect controls.** Mount the wrapper as a separate child of app `<Footer>` so its absolute position is relative to the existing positioned footer, not the encrypted/debug icon container. Use `position: absolute; inset-inline-end: 1rem; bottom: calc(100% + 0.5rem)` and a 96px footprint; do not add another positioned ancestor. Set `pointer-events: none` on the root/bubble with sufficient scoped specificity to override footer-child rules; enable interaction only on the trigger/menu using `var(--ui-pointerEvents)`. Keep bubble width within the viewport on non-phone sizes using logical properties and wrapping. Do not change shared footer CSS. Hide calls `{ enabled: false }`; the tips action toggles only `tipsEnabled`. Add an app main-menu item beside existing preferences to show/hide the companion, with a selected/check indicator. When hiding removes the focused trigger, return focus to the editor container deliberately. Close an open companion menu on suppression.
- [ ] **Step 5: Run focused regression tests.** Run `yarn test:app --run excalidraw-app/components/drawing-companion excalidraw-app/tests/DrawingCompanion.test.tsx excalidraw-app/tests/MobileMenu.test.tsx packages/excalidraw/components/dropdownMenu/DropdownMenu.test.tsx packages/excalidraw/components/Sidebar/Sidebar.test.tsx`. Expect exit 0, with all listed suites passing. Run `yarn test:typecheck` and expect exit 0. Run `yarn exec eslint --max-warnings=0 --ext .ts,.tsx excalidraw-app/components/drawing-companion excalidraw-app/tests/DrawingCompanion.test.tsx excalidraw-app/components/AppFooter.tsx excalidraw-app/components/AppMainMenu.tsx excalidraw-app/App.tsx excalidraw-app/app_constants.ts` and `yarn exec prettier --check excalidraw-app/components/drawing-companion excalidraw-app/tests/DrawingCompanion.test.tsx excalidraw-app/components/AppFooter.tsx excalidraw-app/components/AppMainMenu.tsx excalidraw-app/App.tsx excalidraw-app/app_constants.ts packages/excalidraw/locales/en.json`; expect exit 0. Report unrelated pre-existing failures separately rather than widening the change.
- [ ] **Step 6: Perform the browser acceptance pass.** Run `yarn start` using a persistent process and its printed URL. Inspect every pose, theme, and long bubble on desktop/tablet, RTL, both sidebar layouts, Zen mode, dialogs, and reduced motion. Use temporary local/devtools state control or a temporary test harness to inspect long-interval states, then remove it. Check the footprint stays within 96px, the bubble rectangle fits the available viewport, footer control rectangles remain unchanged with/without the companion, and clicking through a bubble reaches the canvas. Hide the tab, return after several minutes, and verify idle resumes without queued messages. Never claim visual verification from jsdom alone.
- [ ] **Step 7: Commit the integrated feature.** Run `git diff --check`, inspect the staged file list, and commit only the remaining companion integration changes with message `feat: add the drawing companion to the workspace`. Keep `.superpowers/` mockups out of implementation commits. Request a whole-change review through the selected execution workflow before claiming completion; resolve substantive findings and rerun affected checks.

## Self-review and execution handoff

Spec coverage: Task 1 covers persistence; Task 2 covers independent routines,
timing, messages, and priority; Task 3 covers owning-document lifecycle and
motion; Task 4 covers artwork, text, accessibility, and intentional controls;
Task 5 covers app-only placement, restoration, suppression, and acceptance.
Every Review Focus condition has a named test or browser check above.

No production code or dependencies have been changed during planning. Review
this plan before execution. Recommended execution is **Native**: the five
tasks share interfaces and touch one feature, so implementing them in this
session with one independent whole-change review avoids repeated context
setup while preserving a final review gate.
