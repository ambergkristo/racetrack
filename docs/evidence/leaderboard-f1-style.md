# Leaderboard F1 Style

## Layout Change

- The public Leaderboard was changed from a table-style rendering to a row-based timing board.
- Each racer now renders as a horizontal strip instead of a constrained table row.
- Every strip is laid out as:
- position
- car badge
- racer name block
- best lap
- live lap
- laps
- The board container now uses a fixed eight-row grid so all 8 racers stay visible together without scrolling.

## Typography Increase

- Position is now the most prominent number on each row with a much larger display treatment.
- Racer name size was increased substantially and now dominates the center of the row.
- Best-lap, live-lap, and laps values were increased to readable display-sized timing text.
- Secondary metadata under the driver name was reduced so it no longer competes with the primary timing hierarchy.

## Hierarchy Improvement

- Position is the strongest visual element.
- Car number is isolated into a compact badge for fast scanning.
- Racer name is the second-strongest element and anchors the center of the row.
- Timing values are grouped into consistent right-side stacks for quick comparison.
- The leader row now gets stronger highlighting, and alternating row treatment improves scanability from distance.
- The top status strip was reduced to the required `state`, `flag`, and `countdown` KPIs to free more space for the timing rows.

## 8 Racer Fit

- The Leaderboard board now reserves an eight-row grid and removes scroll behavior from the public timing stack.
- This keeps all 8 racers visible at once and uses the panel height much more efficiently than the previous compact table layout.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
