# Roll XI — build scripts

These are the canonical verified roll-of-honour data sources for all three
European competition strands. They live here so they survive across chat sessions
(previously they only existed in /tmp and were lost between conversations).

They have NO effect on the running app — Vite ignores this folder entirely.
The app reads only `public/data/*.json`.

## Files

### build-ec.js
European Cup / Champions League (1955-56 to 2025-26, 71 editions).
Contains `const ROLL = [...]` where each entry is:
  [season, winner, runnerUp, sfA, sfB]

Usage in new sessions (extract the ROLL array for scripting):
  $(sed -n '/^const ROLL = \[/,/^\];/p' /home/claude/roll-xi-app/_build/build-ec.js)

### build-cwc.js
Cup Winners' Cup (1960-61 to 1998-99, 39 editions).
Contains `const ROLL = [...]` where each entry is:
  [season, winner, runnerUp, wCountry, ruCountry, wScorer, ruScorer]

Usage:
  const ROLL = require('/home/claude/roll-xi-app/_build/build-cwc.js');
  — or via sed as above.

### build-fairs-uefa.js
Fairs Cup (1955-1971) + UEFA Cup (1971-2009) + Europa League (2009-2025).
Exports: { FAIRS, UEFA, UEL } — all same schema as CWC ROLL entries.

Usage:
  const { FAIRS, UEFA, UEL } = require('/home/claude/roll-xi-app/_build/build-fairs-uefa.js');

## What's covered and what's next

GLOBAL O/P DE-DUP SWEEP (14 Jun 2026): the mandated promotion-completeness step
(remove promoted club-seasons from tier-O) had never run across Waves 1a-1g/Fa/Fb.
168 club-seasons were sitting in BOTH tiers. Swept:
- pack-opponents-ec-ucl.json: 284 -> 96 rows (188 pickable-overlaps removed).
- pack-opponents-provisional.json: 48 -> 1 row (retired as placeholder; B-series indexes
  have landed; only Man City 2018-19, unique + not in any verified index, kept).
- CWC / UEFA indexes untouched (no promotion waves there yet; zero overlap).
O/P overlap asserted 0 afterwards.

EC/UCL opponent index now 96 tier-O rows: the W+RU finalists 1955-56..2003-04 not yet
built, plus a handful of un-built semi-finalists (e.g. AS Monaco 2016-17).

Finalists already promoted to pickable:
- Wave Fa: 2015-16 to 2025-26 (done)
- Wave Fb: 2004-05 to 2014-15 (done)
- Wave Fc: 1990-91 to 2003-04 (DONE) — all 13 editions 1991-92..2003-04 have both finalists pickable (25 rosters built this wave; Red Star 1990-91 built earlier as template; Marseille 1990-91 RU and Man Utd 1998-99 W pickable via seed). Each web-verified per edition; every promoted club-season removed from EC/UCL tier-O in the same pass; O/P overlap = 0, P/P dups = 0.
- Wave Fd: 1980-81 to 1989-90 (DONE) — all 10 editions, both finalists web-verified per edition (final match sheets), 20 rosters built, removed from EC/UCL tier-O; O/P overlap = 0, P/P dups = 0. Steaua/Benfica carry conf C on squad depth.
- Wave Fe: 1970-71 to 1979-80 (DONE) — all 10 editions, 18 rosters built (2 already pickable), web-verified per edition, O/P overlap = 0.
- Wave Ff: 1955-56 to 1969-70 (DONE) — all 15 editions, 29 rosters built (Inter 1964-65 already pickable), web-verified per edition. EC/UCL tier-O index is now ZERO.
- B4 (DONE): Conference League (2021-22 to 2025-26, W+RU) + Intertoto 1995-2005 (W+RU per final) + Intertoto 2006-2008 (outright winners only). 77 tier-O rows in pack-opponents-confl-itc.json.
- Next: C-series Serie A backbone, or CWC/UEFA promotion waves.
