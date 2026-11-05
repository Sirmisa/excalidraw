# Drawing companion

Date: 2026-11-05
Status: Approved by the user on 2026-11-05; ready for implementation planning.

## Intent

Give someone working in Excalidraw a cheerful sense of company. A small,
happy blob with two eyes behaves like a fellow worker with its own rhythm:
usually quietly present, sometimes playful, and occasionally helpful.

Eating, drinking, sleeping, drawing, and taking bathroom breaks gently model
everyday self-care. They never become instructions, obligations, or prompts
that require the user to stop drawing.

## Agreed decisions

- The companion follows a fixed repertoire of randomly scheduled animations,
  independent of the user's actions or drawing content.
- Most of its time is spent idle. It occasionally displays short personality
  messages and useful drawing tips.
- Placement is option A from the mockups: a small, free-standing companion
  above the bottom-right controls, without a surrounding panel or platform.
- Use SVG artwork and CSS animations for the first version.
- No sound, notifications, requests for attention, or care obligations.
- Offer a small menu to hide the companion or disable tips, remembering these
  preferences locally.
- Start with an activity roughly every 45–90 seconds and a drawing tip every
  8–12 minutes. These are tuning values, not user-facing promises.

The user approved the behavior proposal, placement, rendering approach, and
this written design.

## Goals, non-goals, and anti-goals

### Goals

- Feel companionable even when completely ignored.
- Give the blob a recognizable, happy personality through movement and props.
- Keep the drawing workspace usable and responsive.
- Make the feature easy to hide and easy to restore.
- Keep behavior local, predictable to maintain, and inexpensive to run.

### Non-goals for this version

- AI conversation, artwork analysis, or responses to drawing tools and gestures.
- A virtual pet economy, hunger meters, achievements, or tasks.
- Custom characters, names, colors, dragging, or roaming across the canvas.
- Scheduling real-world reminders or inferring the user's needs.
- Collaboration presence or sharing the blob's state with other participants.
- A reusable public companion API for embedded Excalidraw instances.

### Anti-goals

- Stealing focus, blocking work with a dialog, or demanding acknowledgement.
- Guilt, distress, negative reactions to being ignored, or prescriptive advice.
- Saving the companion into drawings, exports, undo history, or shared scenes.
- Persistent animation work in a hidden browser tab.

## Approaches considered

1. **SVG plus CSS animations — selected.** Simple, code-native shapes give the
   blob breathing, blinking, squashing, and animated props. Crisp at different
   sizes, easy to tune, and requires no animation dependency. Less suitable for
   elaborate frame-by-frame acting, which this first version does not need.
2. **Illustrated sprite sheet.** Supports richer acting and hand-drawn frames,
   at the cost of creating and maintaining more artwork, loading raster assets,
   and making movement changes harder.

The user selected SVG and CSS after both approaches were presented.

## First-version scope and builder calls

The following details are proposed by the designer, rather than additional
requirements stated by the user. They make the first version concrete and
can be adjusted during review.

- Ship in `excalidraw-app`, enabled by default on non-phone layouts. Phone
  layouts omit the companion for this first version because controls already
  compete for limited space; retain its preferences when changing layout.
- Keep the reusable editor package free of a default companion. App-level
  components may consume existing editor contexts without introducing a new
  public API.
- Use the mockup's soft lavender as the initial color, with adequate eye and
  outline contrast in both editor themes. No name or customization screen.
- Keep the complete animation footprint around 80–96 CSS pixels wide. Reserve
  space inside it for props; tips may extend above and to its left.
- Activity duration is generally 8–15 seconds, followed by a fresh 45–90-second
  idle interval. Only one activity runs at a time; do not repeat the immediately
  previous activity.
- Tips stay visible for approximately eight seconds. Personality messages stay
  visible for approximately five seconds and appear at most once in three
  minutes. Messages never queue or stack.
- Disable tips independently of the companion; disabling tips still allows
  occasional personality messages. Hiding the companion disables both.
- Do not add a separate general pause setting. Hiding it and the platform's
  reduced-motion preference cover the first version's controls.

## Character and animation repertoire

The character is a rounded, slightly irregular blob with two expressive eyes.
Its default expression is content. Props provide enough context to recognize
an action without adding a permanent mouth, limbs, or detailed anatomy.

| State | Presentation | Exit |
| --- | --- | --- |
| Idle | Slow, subtle breathing and occasional blinks | Scheduled activity |
| Drawing | Small pencil and paper; a restrained scribbling movement | Return to idle |
| Eating | Small snack moves toward the face; a little happy squash | Return to idle |
| Drinking | Cup lifts and tilts in a short sipping sequence | Return to idle |
| Sleeping | Eyes close; a small drifting sleep mark | Wake and return to idle |
| Bathroom break | Blob briefly retreats behind a small door or privacy sign | Reappear and return to idle |

The bathroom action is playful and discreet, with no explicit bodily imagery.
The sleep action is one random vignette, not an inference that the user is idle.
All temporary props are removed when the activity ends.

Clicking the companion opens its small settings menu; it does not trigger an
activity. There is no need to feed it, wake it, or bring it back from a break.

## Scheduling and text

Use a small explicit state machine with idle and the five activity states.
Keep its catalog and timing constants separate from the SVG rendering. Pick
uniformly from activities other than the immediately previous one; more
elaborate weighting is unnecessary for this version.

Start in idle, schedule an activity after a random 45–90-second interval, then
return to idle after the activity's duration. Never depend on scene changes,
pointer events, selected tools, or collaboration messages to choose behavior.

Drawing tips have a separate random 8–12-minute timer. Select them from a
small curated catalog of accurate, general Excalidraw guidance. Do not repeat
the previous tip immediately. Existing contextual hints remain in place.
Reuse the project's shortcut formatting and translation conventions.

Examples of tip topics: holding Space to pan, opening keyboard shortcuts,
grouping selected elements, and undoing a change. Verify the exact wording
against the current app before adding a tip. Do not invent tool behavior.

Personality messages are short observations about the blob's own activity,
such as “A tiny snack break.” or “Working on my masterpiece.” They are not
instructions to eat, drink, sleep, or leave the desk. At the end of an activity,
there is a modest random chance of a message if its three-minute cooldown has
elapsed; use a 25% starting probability.

A tip takes priority over a personality message. Replace a personality bubble
when a tip becomes due; skip personality messages while a tip is displayed.
Only one bubble is visible. A bubble disappears automatically and is not an
alert or a live region. Tips are not tied to the start of an activity.

## Placement and interaction

Anchor the companion within the editor's available interface area above the
bottom-right controls. Account for a docked sidebar, rather than anchoring to
the outer browser window. Do not move it as the canvas pans or zooms.

The existing app footer injection is the starting integration point. Inspect
the footer tunnel and layout before choosing the final anchor, since the
current app footer content occupies the footer's center region. Use an
app-owned positioning wrapper and existing editor contexts; avoid changing
core layout behavior for other editor consumers.

The transparent positioning area and speech bubble must allow pointer events
through to the canvas. Only the visible companion button and its settings
controls are interactive. Opening and operating its menu must not trigger
canvas gestures or drawing shortcuts. Use the project's existing accessible
menu patterns, keyboard focus behavior, and Escape handling.

Its menu contains a tips toggle and a hide action. Add a persistent companion
visibility toggle to the app's main menu so it can be restored after hiding.
Opening a menu is always deliberate; automatic text and animation never move
focus. Avoid extra settings buttons visible beside the blob at rest.

Suppress the companion, bubbles, and timers in Zen mode, when the standard
editor interface is unavailable, and while a modal editor dialog is open.
For a floating sidebar that covers its area, suppress it until there is room;
for a docked sidebar, anchor within the remaining canvas area. On reappearance,
start fresh timers with no missed-activity catch-up.

## Persistence, lifecycle, and accessibility

Store only a versioned object containing `enabled` and `tipsEnabled` in a
dedicated app local-storage key. Both default to true. Validate stored values;
malformed or unavailable storage falls back to defaults and does not prevent
drawing. Preference changes work for the current session if persistence fails.

Do not persist activity state, random sequences, timers, or message history.
Nothing is added to scene data, exports, collaboration payloads, or undo state.

Use the mounted node's `ownerDocument` and `defaultView`, or `app.ownerDocument`
and `app.ownerWindow`, for timers, storage, visibility events, and media queries.
Follow the repository's `Merge<Base, Overrides>` convention if overriding a
type's properties.

When the owning document is hidden, stop timers, hide any bubble, and pause
CSS animations. On return, resume idle with fresh intervals; do not burst
through missed actions or tips. Apply the same reset when the companion is
hidden, suppressed, or unmounted, and remove every timer and subscription.

Respect `prefers-reduced-motion`: keep a still idle character, remove repeated
blinks, breathing, and prop movements, and represent scheduled activities with
static poses/props without animated transitions. Observe preference changes
through the owning window. Occasional text can still appear under the normal
cadence. The companion button and menu have localized accessible names;
decorative SVGs are hidden from the accessibility tree. Focus styling remains
visible, and automatic text is never announced as an interruption.

Add new strings to the established English locale and use the existing
translation fallback for other languages. No external services, new assets,
animation libraries, or dependencies are required.

## Implementation boundaries

Likely touch points, to confirm during planning:

- A new app-owned companion component, SVG artwork, and scoped SCSS under
  `excalidraw-app/components/`.
- A small behavior catalog/scheduler and preference helper in the app.
- `excalidraw-app/components/AppFooter.tsx` and, if needed, the app composition
  in `excalidraw-app/App.tsx` for mounting and passing interface visibility.
- `excalidraw-app/components/AppMainMenu.tsx` for restoring visibility.
- `excalidraw-app/app_constants.ts` for a dedicated storage key.
- `packages/excalidraw/locales/en.json` for text and accessible labels.

The builder may settle component names, file organization, exact SVG paths,
individual keyframes, menu primitives, the precise anchoring mechanism, and
test organization without another product decision. These choices must
preserve the behavior and scope above.

## Verification and acceptance

Use focused behavior tests with controlled randomness and fake timers for:

- Idle → activity → idle, interval bounds, and no immediate activity repeat.
- Tip cadence, auto-dismissal, cooldowns, and bubble priority.
- Disabling tips and hiding/restoring the companion, including saved and
  malformed preferences and unavailable storage.
- Cleanup, document visibility, suppression, and reduced-motion changes.

Verify the mounted menu's keyboard operation and that companion interactions
do not initiate canvas gestures or change scene data. Run the relevant
existing tests, type checks, lint, and formatting checks for touched files.

Manually inspect idle and every activity in light and dark themes, with a
docked and floating sidebar, at supported non-phone sizes, and in Zen mode
and dialogs. Confirm that tips fit, props do not escape their small footprint,
and the bottom controls remain usable. The current checkout has no installed
dependencies; planning must account for installing the existing locked
dependencies before running automated app checks.

Acceptance: the user can leave the companion entirely alone while drawing,
occasionally notice its independent routines, read a useful tip without
acknowledging it, and hide or restore it without affecting their artwork.
