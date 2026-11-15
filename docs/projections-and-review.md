# Projection CSV imports and lineup review

## Import projections

Import the official DK salary file for the selected slate first. Expand **Import your own projections (CSV)** under Slate & Data. Download Projection Template creates one base-point row per person using current DK IDs, names, teams and positions. Edit Projection, then import the file.

Supported projection column names are Projection, Projected Points, Projected Fantasy Points, Proj, FPTS and FantasyPointsDraftKings (case/spacing/punctuation insensitive). Use ID, DK ID, DraftKings ID, Player ID, or Name + ID for exact DK slate-ID matching. ID means a DraftKings slate ID, not a provider's career ID. If the file contains another provider's ID column, select **Name + Team (ignore other provider IDs)**. Name/Team matching normalizes common team aliases, accents, punctuation and suffixes; Position/Pos is optional to disambiguate names. It never uses fuzzy guesses. Ambiguous players require a DK ID.

Rows outside the active pool are counted as unmatched, not added. Matched rows must have finite projections from -1000 to 1000 base points; blank, nonnumeric and conflicting duplicate values fail before any changes are applied. Zero and negative values are preserved. Agreeing duplicate rows are combined. The file limit is 2 MB. Salary, player ID, position, eligibility, locks and exposure rules are never changed by a projection import. Name matching cannot verify the projection file's week, so choose data for the active slate.

**Keep hand-edited projections** defaults on. It preserves manual values and replaces earlier CSV imports. Uncheck it to replace hand edits too. The result reports updated people, preserved hand edits, unmatched rows and combined duplicates. No updates means the existing lineup set remains available. Applied changes cancel pending generation and clear old lineups and review data; rerun generation with the updated values. If data/settings change while a file is read, the old import is rejected.

### Showdown values

The default **Base player points** accepts ordinary unmultiplied forecasts: 20 base points sets FLEX to 20 and Captain to 30. If the source already contains Captain-adjusted values, choose **Slot-adjusted** and provide a role-specific DK ID or a Roster Position/Slot column. A CPT value of 30 is divided once to 20 base points. A file with both roles must agree on the same base projection. Exposures and import matching count one person across both roles.

The player table marks imported overrides **Projection CSV** and typed changes **Manual**. Both survive SportsDataIO refreshes. Reset removes the override and restores the latest loaded SportsDataIO/base average. Private and backup presets retain imported values, their source markers and the correct Showdown multipliers. Existing presets without source markers are treated as manual edits. No database schema changes are needed.

## Review lineups

The review dashboard updates from the currently generated set and clears when that set becomes stale. It shows:

- Average salary and unused budget, the projected-point range, minimum player difference, and the number of lineups with QB/WR/TE stacks or opposing bring-backs.
- A sortable overview of each lineup's salary, remaining cap, points and QB stacks. Sorting the overview does not change the optimizer's lineup IDs or DK export order.
- An inspector with actual roster slots, player names, teams, salaries, projections and the selected QBs' teammate/opponent details.
- Searchable exposures with actual appearance counts/percentages and configured minimum/maximums. Showdown separates Captain/FLEX appearance counts while retaining the combined person-level percentage.
- Team exposures counted once per lineup containing that team, not once per teammate.
- Two-lineup comparison showing shared players, players unique to each lineup, and side-by-side slot details. Showdown Captain changes are displayed separately and do not count as changing a person.

Current validation reruns on review, including roster legality, cap, slate/time, exposure, stack and diversity checks. A game that starts after generation can invalidate the set; export also revalidates it. Projected points are the active projections, not realized scores or win probabilities. Single-lineup sets do not invent a minimum-difference or overlap statistic.

## Verification

`npm test` includes projection matching and atomic-failure cases, multiplier behavior, duplicates, zero/negative values, manual protection, saved-preset source restoration, review totals/comparisons, UI selectors and stale-state clearing. Tests include both NFL formats and a real worker. The user's 514-player Classic salary file is replayed locally with synthetic uploaded forecasts and its original pregame test clock; every ID/salary is compared before and after import. A 150-lineup Showdown fixture checks review performance and combined role exposure. Visual iPad/browser behavior and a real user Showdown file remain manual acceptance checks.
