# Pipeline drag-and-drop follow-up

## Behavior

- Drag a card by its grip into any status column, forward or backward.
- Status changes use the existing `/api/marketing` PATCH endpoint and the shared asset row.
- Cards show their project name, or “Not tied to a project.”
- The card title still opens the existing FE-voice drafting/edit form; the advance arrow remains available.
- Mouse, touch-hold, and keyboard sensors are supported. Keyboard: focus the grip, Space to pick up, arrows to choose a stage, Space to drop, Escape to cancel.
- Dropping outside a column or into the same column does not save.
- Moves optimistically update the board. Failed saves restore the original status and show an error.
- Moves do not assign a post date, change project association, publish content, or reorder cards within a column.

## QA inventory

- Mouse drag to an empty column and backward to a populated column.
- Column counts and readiness color change after drop; status survives fixture reload.
- Same-column drop, outside drop, and Escape cancellation do not call PATCH.
- Keyboard movement and cancellation.
- Touch drag using the grip; normal page scrolling outside the grip remains available.
- Project names, long project names, and unassigned labels render at desktop and narrow widths.
- Clicking title opens existing drafter; advance arrow and table still work.
- A failed PATCH restores the previous column and shows a visible message.
- Pending moves disable additional transitions to avoid conflicting saves.
- Strategy and Calendar read the updated status through their existing shared API.
- Build, type checks, existing marketing regression suite.

## Test scope

Browser checks use isolated API fixtures, not production writes. The Vercel preview remains protected; live database persistence is not claimed.

## Results

- Passed mouse moves forward to an empty column and backward; fixture status remained after page reload.
- Passed same-column, outside-column, and Escape cancellation with no PATCH.
- Passed keyboard column movement and CDP touch input (hold grip, move, release).
- Passed error rollback: simulated HTTP 500 restored the previous column and displayed a visible error.
- Passed pending-save lock, title-to-drafter editing, advance arrow, and table navigation.
- Passed project and unassigned labels; desktop and 390px-wide screenshots reviewed without page overflow.
- Passed cross-view checks: Calendar readiness and Strategy status reflect the moved asset.
- No browser page errors during these checks.
