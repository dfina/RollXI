#!/usr/bin/env node
/*
  Roll XI coverage report.

  Reads public/data/coverage-target.json (the goal) and every pack listed in
  public/data/index.json (the reality), then prints what is left to build.

  Run:  node scripts/coverage.mjs
        node scripts/coverage.mjs --json     machine-readable output
        node scripts/coverage.mjs --next     just the single next recommended pack

  This script is the reason the roadmap cannot go stale. Never hand-maintain a
  list of "what's done" in prose: run this instead.
*/

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve("public/data");
const args = new Set(process.argv.slice(2));

/* ---------- season helpers ---------- */

// "1998-99" -> 1998 ; "1995" -> 1995 ; "1955-58" -> 1955
const startYear = (s) => parseInt(String(s).slice(0, 4), 10);

// Build the list of season strings between two bounds, in the same style as the
// bounds themselves. Single-year style ("1995") is used for the Intertoto Cup.
function expandSeasons(from, to, exclude = []) {
  const singleYear = !String(from).includes("-");
  const out = [];
  for (let y = startYear(from); y <= startYear(to); y++) {
    const label = singleYear ? String(y) : `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    if (!exclude.includes(label)) out.push(label);
  }
  return out;
}

/* ---------- load ---------- */

async function loadPacks() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  const listed = new Set(index.packs.map((p) => p.file));

  const onDisk = (await readdir(DATA)).filter(
    (f) => f.startsWith("pack-") && f.endsWith(".json")
  );
  const unlisted = onDisk.filter((f) => !listed.has(f));
  const missing = [...listed].filter((f) => !onDisk.includes(f));

  const rows = [];
  for (const file of listed) {
    if (!onDisk.includes(file)) continue;
    const pack = JSON.parse(await readFile(path.join(DATA, file), "utf8"));
    for (const s of pack.squads || []) rows.push({ ...s, _file: file });
  }
  return { rows, unlisted, missing };
}

/* ---------- normalise a squad row into (comp, season, role) facts ----------
   Works with BOTH the current schema (tierType P/O + euro[] + comps[]) and the
   target schema (role + achievements[]), so the report keeps working through
   the migration. */

const ALIAS = { UECL: "CONFL", INT: "ITC" };
const canon = (c) => ALIAS[c] || c;

function factsFor(row) {
  const hasPlayers = Array.isArray(row.players) && row.players.length > 0;
  const role = row.role || (hasPlayers ? "roster" : "stub");

  const entries = [];
  if (Array.isArray(row.achievements)) {
    for (const a of row.achievements) {
      entries.push({ comp: canon(a.comp), season: a.season || row.season, stage: a.stage || "MAIN" });
    }
  } else {
    for (const e of row.euro || []) {
      entries.push({ comp: canon(e.comp), season: e.season || row.season, stage: e.stage || "MAIN" });
    }
    for (const c of row.comps || []) {
      entries.push({ comp: canon(c), season: row.season, stage: "MAIN" });
    }
  }
  return { role, league: row.league || null, season: row.season, entries };
}

/* ---------- report ---------- */

async function main() {
  const target = JSON.parse(await readFile(path.join(DATA, "coverage-target.json"), "utf8"));
  const { rows, unlisted, missing } = await loadPacks();

  // actual[compOrLeague][season] = { roster: n, stub: n }
  const actual = {};
  const bump = (key, season, role) => {
    actual[key] ??= {};
    actual[key][season] ??= { roster: 0, stub: 0 };
    actual[key][season][role]++;
  };

  for (const row of rows) {
    const f = factsFor(row);
    if (f.league) bump("league:" + f.league, f.season, f.role);
    for (const e of f.entries) bump("comp:" + e.comp, e.season, f.role);
  }

  const report = [];
  for (const scope of [...target.scopes].sort((a, b) => a.priority - b.priority)) {
    const seasons = scope.seasons
      ? scope.seasons
      : expandSeasons(scope.seasonFrom, scope.seasonTo, scope.excludeSeasons || []);
    const keys =
      scope.kind === "domestic"
        ? ["league:" + scope.league]
        : (scope.comps || []).map((c) => "comp:" + canon(c));

    const started = [];
    const empty = [];
    for (const season of seasons) {
      const rosters = keys.reduce((n, k) => n + (actual[k]?.[season]?.roster || 0), 0);
      const stubs = keys.reduce((n, k) => n + (actual[k]?.[season]?.stub || 0), 0);
      if (rosters + stubs === 0) empty.push(season);
      else started.push({ season, rosters, stubs });
    }
    report.push({
      id: scope.id,
      label: scope.label,
      priority: scope.priority,
      editionsInScope: seasons.length,
      editionsStarted: started.length,
      editionsUntouched: empty.length,
      rostersBuilt: started.reduce((n, s) => n + s.rosters, 0),
      stubsBuilt: started.reduce((n, s) => n + s.stubs, 0),
      nextUntouchedSeason: empty[empty.length - 1] || null,
      untouchedSeasons: empty,
      completenessKnown: scope.expectedPerEdition != null
    });
  }

  if (args.has("--json")) {
    console.log(JSON.stringify({ report, unlistedPacks: unlisted, missingPacks: missing }, null, 2));
    return;
  }

  const next = report.find((r) => r.editionsUntouched > 0);
  if (args.has("--next")) {
    console.log(next ? `${next.label} — ${next.nextUntouchedSeason}` : "Target complete.");
    return;
  }

  console.log("\nROLL XI — CONTENT COVERAGE\n" + "=".repeat(64));
  console.log(`target v${target.version} (updated ${target.updated})`);
  console.log(`${rows.length} club-season rows across ${new Set(rows.map((r) => r._file)).size} packs\n`);

  for (const r of report) {
    const pct = Math.round((100 * r.editionsStarted) / r.editionsInScope);
    const bar = "#".repeat(Math.round(pct / 5)).padEnd(20, ".");
    console.log(`${r.label}`);
    console.log(`  [${bar}] ${pct}%  ${r.editionsStarted}/${r.editionsInScope} editions touched`);
    console.log(`  ${r.rostersBuilt} rosters, ${r.stubsBuilt} stubs`);
    if (!r.completenessKnown) {
      console.log(`  !! DEPTH UNVERIFIED - "touched" only means >=1 row exists for that edition.`);
      console.log(`     Set expectedPerEdition in coverage-target.json to track real completeness.`);
    }
    if (r.nextUntouchedSeason) console.log(`  next gap: ${r.nextUntouchedSeason}`);
    console.log();
  }

  if (next) {
    console.log("-".repeat(64));
    console.log(`NEXT PACK TO BUILD:  ${next.label} ${next.nextUntouchedSeason}`);
    console.log("See docs/CONTENT-TARGET.md section 7 for the build recipe.");
  } else {
    console.log("Target complete.");
  }

  if (unlisted.length) console.log(`\nWARNING: on disk but not in index.json: ${unlisted.join(", ")}`);
  if (missing.length) console.log(`\nWARNING: in index.json but not on disk: ${missing.join(", ")}`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
