# Excalidraw

A virtual whiteboard for hand-drawn-style diagrams: an embeddable editor library, and the excalidraw.com app built on it.

## Canvas

**Scene**:
The full set of elements in one drawing, deleted ones included.
_Avoid_: canvas, document, board

**Element**:
One drawable item in a scene: a shape, line, arrow, text, image, frame or embed.
_Avoid_: shape, object, node

**Deleted element**:
An element marked as deleted but still kept in the scene, so undo and collaborators can still see it.
_Avoid_: removed element

**App state**:
Everything in the editor besides the elements: the active tool, zoom, scroll position, selection and theme.
_Avoid_: editor state, UI state

## Text

**Container**:
An element that can hold bound text: a rectangle, diamond, ellipse, sticky note or arrow. Not a frame.
_Avoid_: parent, wrapper

**Bound text**:
A text element attached to a container, which moves with it and wraps inside it. Text on an arrow is bound text, with the arrow as its container.
_Avoid_: label, arrow label, inner text

## Connections

**Linear element**:
A line or arrow, defined by a list of points.
_Avoid_: path, connector

**Binding**:
The link between an arrow's start or end and another element, so the arrow follows that element when it moves.
_Avoid_: connection, attachment, snapping

**Elbow arrow**:
An arrow made only of horizontal and vertical segments, routed automatically between its bindings.
_Avoid_: orthogonal arrow, connector

**Fixed segment**:
A segment of an elbow arrow that the user has moved by hand. Automatic routing leaves it in place.

## Organization

**Group**:
A set of elements that are selected and moved together. Groups can nest.

**Frame**:
An element that holds other elements and clips them to its edges. Not a container.
_Avoid_: artboard, section, container

**Library item**:
A saved set of elements that can be inserted into any scene.
_Avoid_: template, stencil, asset

## History & collaboration

**Capture**:
Whether a change to the scene is recorded for undo: immediately, eventually or never.
_Avoid_: record, commit

**Undo step**:
The set of changes that a single undo reverts.
_Avoid_: history entry, undo entry

**Collaboration room**:
A live, end-to-end encrypted session where several people edit one scene.
_Avoid_: session, live share

**Reconciliation**:
Combining local and remote versions of elements into one scene.
_Avoid_: merge, sync
