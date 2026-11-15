# DFS Pro Optimizer

DraftKings NFL Classic lineup builder using Node.js, Express and browser JavaScript. The existing Render start command remains `npm start`. Configure `SPORTSDATAIO_API_KEY` only in the server environment; never put it in browser code or commit it.

## Local use

Install dependencies with `npm install`, then run `npm start` (default port 3000, or use `PORT`). Run validation and browser-handler regression tests with `npm test`.

1. Download the DraftKings **NFL Classic** salaries CSV for the exact contest slate and import it. The standard Position, Name, ID, Roster Position, Salary, Game Info and TeamAbbrev columns are required. AvgPointsPerGame remains an optional fallback.
2. Optionally load SportsDataIO projections for the matching season/week. This updates projections without adding players to the imported slate.
3. Review injury statuses when provided in the CSV: OUT, IR, PUP, NFI and suspended players are excluded by default; questionable players remain available. Exclusions can be manually overridden. Blank status does not guarantee a player is active; status reflects only the imported file. Select locks/exclusions and choose **Minimum different players** (1–9, default 3), then generate up to 150 lineups. Every pair must differ by at least that many player identities; moving a player between WR and FLEX does not count. For example, 3 means any pair can share at most 6 of 9 players. Locked players count toward shared players. Higher settings can lower projected totals or produce fewer lineups; the app reports shortfalls rather than relaxing the rule.
4. Export the CSV and use DraftKings **Upload Lineups** for that same slate. This export creates lineups, rather than editing previously reserved entries.

Exports contain one lineup per row with headers `QB,RB,RB,WR,WR,WR,TE,FLEX,DST` and the imported DraftKings player IDs. Demo lineups cannot be exported. Every lineup must have nine unique players, valid positions, a salary at or below $50,000, players from at least two games, all locked players, and no excluded players. Importing duplicate players, Showdown or SuperFlex salaries, invalid game information or incomplete Classic pools reports an error. Changing locks, exclusions, salaries or projections clears previously generated lineups.

The imported file defines the slate. Use a fresh matching file when DraftKings changes its player pool; this app does not independently fetch live DraftKings contest eligibility or verify the contest associated with an uploaded file. Game Info is interpreted in America/New_York time; players whose scheduled games have started cannot be generated or exported. Late swap of existing entries is not supported.

The generator uses a deterministic, bounded beam search in a background Web Worker. It precomputes salary-aware estimates for remaining roster slots, reserves enough salary to finish, and ranks partial lineups by projected points plus an optimistic estimate for remaining slots. This keeps the interface responsive and avoids repeatedly sorting the full player pool. The Generate button is disabled during a search; changing the pool, locks, exclusions or projections cancels pending work so old results cannot replace current selections. Modern browser Web Worker support is required.

This remains a heuristic: the search width is bounded, so it can return fewer lineups than requested and does not guarantee a mathematical optimum or find every feasible lineup. The portfolio search selects diverse candidates and repeats the search with overlap constraints against accepted lineups, up to 30 rounds and a 15-second budget checked between rounds. Repeating the same inputs generally produces the same results; large searches can stop at the time budget. Diversity does not impose a player exposure percentage or randomize projections. The UI reports when a search limit was applied. Results are validated on the main thread against the current pool and again before CSV export.

## References

- [DraftKings NFL Classic rules](https://lp.draftkings.com/help/rules/nfl/classic)
- [DraftKings CSV upload instructions](https://support.draftkings.com/dk/en-us/how-do-i-upload-or-edit-multiple-lineups-at-once?id=kb_article_view&sysparm_article=KB0010800)

Tests exercise salary-cap boundaries, roster and FLEX assignment, duplicate players and lineup permutations, slate membership, import errors, start times across Eastern standard/daylight time, CSV parsing, generator behavior, selection invalidation, and the import/projection event handlers. Additional tests compare search scores against exhaustive enumeration on small pools (including non-$100 salaries), verify lock/FLEX and budget constraints, cancellation, and run the shipped worker scripts in a real background thread. The interface tests run JavaScript with a simulated DOM; they do not log into DraftKings or call the paid SportsDataIO service.
