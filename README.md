# DFS Pro Optimizer

DraftKings NFL Classic and Showdown Captain Mode lineup builder using Node.js, Express and browser JavaScript. The existing Render start command remains `npm start`. Configure `SPORTSDATAIO_API_KEY` only in the server environment; never put it in browser code or commit it.

## Local use

Install dependencies with `npm install`, then run `npm start` (default port 3000, or use `PORT`). Run validation and browser-handler regression tests with `npm test`.

1. Download the DraftKings **NFL Classic** salaries CSV for the exact contest slate and import it. The standard Position, Name, ID, Roster Position, Salary, Game Info and TeamAbbrev columns are required. AvgPointsPerGame remains an optional fallback.
2. Optionally load SportsDataIO projections for the matching season/week. This updates projections without adding players to the imported slate.
3. Review injury statuses when provided in the CSV: OUT, IR, PUP, NFI and suspended players are excluded by default; questionable players remain available. Exclusions can be manually overridden. Blank status does not guarantee a player is active; status reflects only the imported file. Select locks/exclusions and choose **Minimum different players** (1–9, default 3), then generate up to 150 lineups. Every pair must differ by at least that many player identities; moving a player between WR and FLEX does not count. For example, 3 means any pair can share at most 6 of 9 players. Locked players count toward shared players. Higher settings can lower projected totals or produce fewer lineups; the app reports shortfalls rather than relaxing the rule.
4. Export the CSV and use DraftKings **Upload Lineups** for that same slate. This export creates lineups, rather than editing previously reserved entries.

Exports contain one lineup per row with headers `QB,RB,RB,WR,WR,WR,TE,FLEX,DST` and the imported DraftKings player IDs. Demo lineups cannot be exported. Every lineup must have nine unique players, valid positions, a salary at or below $50,000, players from at least two games, all locked players, and no excluded players. Importing duplicate players, Showdown or SuperFlex salaries, invalid game information or incomplete Classic pools reports an error. Changing locks, exclusions, salaries or projections clears previously generated lineups.

The imported file defines the slate. Use a fresh matching file when DraftKings changes its player pool; this app does not independently fetch live DraftKings contest eligibility or verify the contest associated with an uploaded file. Game Info is interpreted in America/New_York time; players whose scheduled games have started cannot be generated or exported. Late swap of existing entries is not supported.

The generator uses a deterministic, bounded beam search in a background Web Worker. It precomputes salary-aware estimates for remaining roster slots, reserves enough salary to finish, and ranks partial lineups by projected points plus an optimistic estimate for remaining slots. This keeps the interface responsive and avoids repeatedly sorting the full player pool. The Generate button is disabled during a search; changing the pool, locks, exclusions or projections cancels pending work so old results cannot replace current selections. Modern browser Web Worker support is required.

This remains a heuristic: the search width is bounded, so it can return fewer lineups than requested and does not guarantee a mathematical optimum or find every feasible lineup. The portfolio search selects diverse candidates and repeats the search with overlap constraints against accepted lineups, up to max(30, requested lineup count) rounds and a 15-second budget checked between rounds. Repeating the same inputs generally produces the same results; large searches can stop at the time budget. Diversity and player exposure are separate constraints; projections are not randomized. The UI reports when a search limit was applied. Results are validated on the main thread against the current pool and again before CSV export.

## Exposure and NFL stacks

- **Default max exposure** applies to players without an individual maximum. Set it to 60 for no more than six appearances in a ten-lineup set. It starts at 100% to preserve existing builds.
- Player **Min %** and **Max %** are optional overrides; blank minimum means 0, blank maximum uses the default. Minima round up and maxima round down to whole lineups. For example, 30–30% cannot be met in a three-lineup set. **Used** displays actual percentage and count after generation.
- A lock means 100% exposure and overrides the default maximum. An explicit player maximum below 100% conflicts with a lock and reports an error. An excluded player with positive minimum exposure also reports an error.
- **QB stack** requires at least one or two WR/TE teammates from the QB's game. **Opposing RB/WR/TE bring-back** requires at least one offensive player from the opposing team in that same game and can be enabled independently. **Avoid QB vs opposing DST** prevents selecting the QB's opposing defense. RBs and DST do not count as QB pass-catcher teammates.
- These are optional strategy rules, enforced alongside all NFL Classic legality rules and minimum player differences. They are checked during search, when results return, and again before CSV export. If a short set would violate exposure percentages using its actual size, the app reports an error rather than exporting it. A bounded search can still miss feasible portfolios; relax conflicting constraints or expand the eligible pool if needed.
- Changes to the lineup count, exposure overrides, or stack settings clear generated results. Loading a new salary file resets individual exposure overrides unless a matching saved preset is applied. Account presets can be reused across signed-in devices after cloud storage is configured.

## References

- [DraftKings NFL Classic rules](https://lp.draftkings.com/help/rules/nfl/classic)
- [DraftKings CSV upload instructions](https://support.draftkings.com/dk/en-us/how-do-i-upload-or-edit-multiple-lineups-at-once?id=kb_article_view&sysparm_article=KB0010800)

Tests exercise salary-cap boundaries, roster and FLEX assignment, duplicate players and lineup permutations, slate membership, import errors, start times across Eastern standard/daylight time, CSV parsing, generator behavior, selection invalidation, and the import/projection event handlers. Additional tests compare search scores against exhaustive enumeration on small pools (including non-$100 salaries), verify lock/FLEX and budget constraints, cancellation, and run the shipped worker scripts in a real background thread. The interface tests run JavaScript with a simulated DOM; they do not log into DraftKings or call the paid SportsDataIO service.

## Projection editing and saved settings

Edit player projections in the table; manual values persist when SportsDataIO data is refreshed and can be reset to the latest base projection. Named presets can store optimizer rules and matching-slate player overrides. Private account presets use Supabase Auth and PostgreSQL, with owner-only row-level security. Sign in on desktop and iPad, save to your account, then load that preset on the other device. Unsaved changes are not automatically overwritten. Browser presets and link/JSON snapshots are optional backups.

See [private settings setup](docs/cloud-settings.md) for the database migration, required Render environment values, authentication redirects, and privacy tests. Cloud controls remain explicitly disabled until that service is configured. The SportsDataIO key and existing Render start command are unchanged.

## NFL formats and game slates

Choose **Classic** with Main, Early, Late or a custom game slate, or choose **Showdown Captain Mode** for a single game. Import the exact official DK salary file for that contest. Changing a format or game-slate category clears the prior pool and lineups. The SportsDataIO catalog lists only supported DraftKings formats actually returned by the feed; direct CSV import remains available when coverage is limited.

Showdown uses 1 Captain and 5 FLEX players, a $50,000 cap, both teams and unique people across roles. Captain salary is read from its own CSV row and validated as 1.5× FLEX salary; projected Captain points are 1.5× base points. Captain and FLEX use separate imported DK IDs. Exposures and minimum player differences count people across roles. Existing Classic presets default to Classic, while new presets also save the format and slate category.

See [slate and format details](docs/slate-formats.md) for importing, validation and CSV export behavior.
