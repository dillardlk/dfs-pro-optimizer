# NFL formats and slate selection

The app supports DraftKings full-game **NFL Classic** and **NFL Showdown Captain Mode**. Tiers, SuperFlex, halftime/in-game Showdown and other sports are not supported by these roster engines.

## Main, Early, Late and custom Classic slates

Choose Classic, then Main, Early, Late, or Other/custom. Early checks that all imported kickoffs are before 4 PM Eastern; Late checks 4 PM Eastern or later. Main/custom accept the games in the official file subject to Classic legality checks. These are import categories, not invented DraftKings draft groups: selecting a category does not turn Main-slate IDs into valid Early/Late-slate IDs. Each contest needs its matching DK download. The importer rejects a broad file that crosses the selected Early/Late window instead of silently filtering it into another slate.

Load Available Slates fetches the existing SportsDataIO weekly endpoint and lists only DraftKings, $50,000 slates with exactly the supported roster slots. Removed slates and incompatible roster formats are omitted. Displayed names, game counts and Eastern start times come from the feed. Selecting a provider slate clears the player pool and checks the imported file's format, game count and kickoff; matchup teams are also checked for named Showdown games. If provider player IDs and salaries are present, every imported ID/salary must match. Some subscriptions return metadata without players: the import then explicitly reports that eligibility relies on the official CSV, rather than claiming ID verification. The direct CSV option works when the feed lacks a Main/Early/Late slate.

## Showdown Captain Mode

- Exactly six different people from one game: one Captain (CPT), five FLEX, and at least one player from each team.
- The cap stays $50,000. QBs, RBs, WRs, TEs, kickers and DST can occupy eligible Showdown slots.
- The full DK salaries file must contain separate CPT and FLEX rows/IDs for each player. Both IDs are preserved. The Captain salary is already priced in the file: the app validates it as 1.5 times FLEX and does not multiply it again.
- FLEX averages are base points. Captain projections use 1.5 times base points. Editing a projection in either role updates both role options proportionately; loading SportsDataIO uses the same multiplier, and Reset restores current base forecasts/averages.
- A person cannot appear in both CPT and FLEX in one lineup. Locking a role fixes that person's role; selecting the other role's lock replaces the first lock. Excluding a person or changing exposure limits applies across both roles. If either role has an unavailable injury status, the person is excluded by default in both roles.
- Exposure counts a person across both roles, including locks, minimums and global/player maximums. A 60% cap in ten lineups allows at most six appearances combined, not six as Captain plus six as FLEX.
- Minimum different players counts people. Merely rotating Captain among the same six people does not meet a one-player difference rule. Captain role still forms part of lineup identity and affects salary and projected points.
- Optional stack and opposing-DST rules apply to **every selected QB**. Showdown does not require a QB, so these settings do not force a QB into a lineup.
- Export uses `CPT,FLEX,FLEX,FLEX,FLEX,FLEX` and exactly the corresponding role-specific imported DK IDs. Demo entries cannot be exported.

Changing format or slate category clears the old pool and generated results. Uploading a file for another format reports an error; rows are not silently dropped or reinterpreted. Imports and projection requests that become stale while selections change cannot overwrite the new pool.

## Saved settings

New account/browser/file/link presets carry contest format and game-slate category. Older presets default to Classic/Main. Player fingerprints include Showdown role information and never apply a Classic pool's edits to a Showdown file. Saved manual Showdown projections use base points and are restored with the correct role multiplier. Loading a preset changes the UI context before waiting for the matching file. Manually changing context discards pending overrides for the old context. No database schema change or extra auth setup is required.

## Validation

Automated tests cover both engines, role pricing/scoring, duplicate-person prevention, both-team and single-game requirements, exposure aggregation, role locks, minimums and diversity, saved presets, multi-QB stacking, real worker dispatch, slate metadata verification and UI transitions. A small Showdown search is compared with exhaustive legal Captain/FLEX combinations. Classic regression tests retain the original roster and cap checks. The uploaded real Classic CSV is replayed with its original pregame test clock. Showdown files are currently tested with fixtures matching the official CSV schema; an actual user Showdown salaries export is still needed for a real-file acceptance check. No live DK contest entry is submitted by these tests.

Rules: [DraftKings NFL Classic](https://lp.draftkings.com/help/rules/nfl/classic), [NFL Showdown Captain Mode](https://www.draftkings.com/help/rules/nfl/showdown-captain-mode), [SportsDataIO slate fields](https://sportsdata.io/developers/data-dictionary/nfl).
