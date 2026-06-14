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

EC/UCL opponent index (pack-opponents-ec-ucl.json): 95 rows remaining
(all EC/UCL finalist seasons 1955-56 to 2003-04 still as tier-O opponents).

Finalists already promoted to pickable:
- Wave Fa: 2015-16 to 2025-26 (done)
- Wave Fb: 2004-05 to 2014-15 (done)
- Next: Wave Fc (1990s/early 2000s), Fd (1980s), Fe (1970s), Ff (1950s-60s)
