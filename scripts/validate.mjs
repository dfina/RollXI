#!/usr/bin/env node
/*
  Roll XI data validator.

  Checks every pack in public/data/ for the failure modes that have actually
  bitten this project: duplicate IDs, P/O collisions, malformed squads,
  deprecated competition codes, index.json / disk drift, and clubs missing
  from the crest override map. Everything here was found by hand at least
  once before this script existed — see docs/CONTENT-TARGET.md section 3A
  and the point-4 findings it links to for the history.

  Run:  node scripts/validate.mjs
        node scripts/validate.mjs --json     machine-readable output

  Exit code is 0 if there are no ERROR-level findings, 1 otherwise.
  WARN-level findings do not fail the run — they need a human judgement call
  (see "club name variants" below) — but are always printed.

  Wire this into CI (see .github/workflows/validate.yml) so a bad pack never
  reaches main. It is also npm-scripted as `npm run validate`.
*/

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve("public/data");
const args = new Set(process.argv.slice(2));

const CANONICAL_COMPS = new Set(["EC", "UCL", "CWC", "FAIRS", "UEFA", "UEL", "CONFL", "ITC"]);
const DEPRECATED_ALIAS = { UECL: "CONFL", INT: "ITC" };
const DEAD_FIELDS = ["decoys", "tier", "conf", "honour"];

const errors = [];
const warnings = [];
const err = (msg, ctx) => errors.push({ msg, ...ctx });
const warn = (msg, ctx) => warnings.push({ msg, ...ctx });

/* ---------- load ---------- */

async function loadPacks() {
  const indexRaw = await readFile(path.join(DATA, "index.json"), "utf8");
  let index;
  try { index = JSON.parse(indexRaw); }
  catch (e) { err(`index.json is not valid JSON: ${e.message}`); return { index: null, packs: [] }; }

  const onDisk = (await readdir(DATA)).filter((f) => f.startsWith("pack-") && f.endsWith(".json"));
  const listed = index.packs.map((p) => p.file);

  for (const f of listed) {
    if (!onDisk.includes(f)) err(`index.json lists "${f}" but it does not exist on disk`);
  }
  for (const f of onDisk) {
    if (!listed.includes(f)) err(`"${f}" is on disk but not listed in index.json — it will never load`);
  }
  for (const p of index.packs) {
    if (!p.name) err(`index.json entry for "${p.file}" has no "name" field (loadData() reads "name", not "label" or anything else)`);
  }

  const packs = [];
  for (const f of listed) {
    if (!onDisk.includes(f)) continue;
    try {
      packs.push({ file: f, data: JSON.parse(await readFile(path.join(DATA, f), "utf8")) });
    } catch (e) {
      err(`"${f}" is not valid JSON: ${e.message}`);
    }
  }
  return { index, packs };
}

/* ---------- crest override map ---------- */

function stripAccents(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normaliseClub(v) {
  return stripAccents(v).toLowerCase().replace(/&/g, "and").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

async function loadCrestOverrideKeys() {
  const src = await readFile(path.resolve("src/lib/crestResolver.js"), "utf8");
  const block = src.split("CREST_PAGE_OVERRIDES = {")[1]?.split("\n};")[0] || "";
  const keys = new Set([...block.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]));
  return keys;
}

/* ---------- checks ---------- */

async function main() {
  const { packs } = await loadPacks();
  const crestKeys = await loadCrestOverrideKeys();

  const idOwner = new Map();          // id -> file
  const pRows = [];                   // {id, club, season, file, row}
  const oRows = [];
  const clubNamesByNorm = new Map();  // normalised -> Set(literal names)

  for (const { file, data } of packs) {
    for (const row of data.squads || []) {
      // duplicate IDs, globally, across all packs
      if (row.id) {
        if (idOwner.has(row.id)) {
          err(`duplicate id "${row.id}" in ${file} (first seen in ${idOwner.get(row.id)})`);
        } else {
          idOwner.set(row.id, file);
        }
      } else {
        err(`squad with no "id" in ${file} (club: ${row.club || "?"}, season: ${row.season || "?"})`);
      }

      const isO = row.tierType === "O";
      (isO ? oRows : pRows).push({ id: row.id, club: row.club, season: row.season, file, row });

      // club name tracking for the near-duplicate check
      if (row.club) {
        const n = normaliseClub(row.club);
        if (!clubNamesByNorm.has(n)) clubNamesByNorm.set(n, new Set());
        clubNamesByNorm.get(n).add(row.club);
      }

      // role/achievements shape (the schema introduced 2026-08-07 — see
      // docs/CONTENT-TARGET.md section 3). role must always be present now;
      // achievements is optional (absence means "not yet migrated", which
      // falls back to tierType at runtime — see src/lib/data.js) but if
      // present every entry must use canonical comp codes and stage values.
      const CANONICAL_STAGES = new Set(["W", "RU", "SF", "QF", "R16", "GROUP", "MAIN"]);
      if (row.role !== "roster" && row.role !== "stub") {
        err(`${row.id} in ${file} has no valid "role" (must be "roster" or "stub", got ${JSON.stringify(row.role)})`);
      } else if (isO && row.role !== "stub") {
        err(`${row.id} in ${file} is tierType "O" but role is "${row.role}" — an opponent-only row can't be role "roster"`);
      } else if (!isO && row.role !== "roster") {
        err(`${row.id} in ${file} has players but role is "${row.role}" — a row with a roster must be role "roster"`);
      }
      for (const a of row.achievements || []) {
        if (!CANONICAL_COMPS.has(a.comp)) err(`${row.id} in ${file} has an achievement with unknown comp "${a.comp}"`);
        if (!CANONICAL_STAGES.has(a.stage)) err(`${row.id} in ${file} has an achievement with unknown stage "${a.stage}"`);
      }

      // roster shape (P-tier only)
      if (!isO) {
        const players = row.players || [];
        if (players.length < 11) {
          err(`${row.id || row.club + " " + row.season} in ${file} has only ${players.length} players (minimum 11)`);
        }
        if (!players.some((p) => p.p === "GK")) {
          err(`${row.id || row.club + " " + row.season} in ${file} has no goalkeeper`);
        }
        if (players.length > 0 && (players.length < 12 || players.length > 20)) {
          warn(`${row.id} in ${file} has ${players.length} players — house standard is 16, outside 12-20 is worth a second look`);
        }
      }

      // competition codes
      const codes = [
        ...(row.euro || []).map((e) => e.comp),
        ...(row.comps || [])
      ];
      for (const c of codes) {
        if (DEPRECATED_ALIAS[c]) {
          err(`${row.id} in ${file} uses deprecated competition code "${c}" — should be "${DEPRECATED_ALIAS[c]}"`);
        } else if (c && !CANONICAL_COMPS.has(c)) {
          err(`${row.id} in ${file} uses unknown competition code "${c}"`);
        }
      }

      // dead fields resurfacing
      for (const f of DEAD_FIELDS) {
        if (f in row) warn(`${row.id} in ${file} carries dead field "${f}" (not read anywhere in src/ as of the 2026-08-07 audit) — confirm it's still meant to be dead before adding more`);
      }

      // crest override coverage
      if (row.club) {
        const n = normaliseClub(row.club);
        if (!crestKeys.has(n)) {
          warn(`"${row.club}" (in ${row.id || file}) has no entry in CREST_PAGE_OVERRIDES — falls back to live Wikipedia search, which is fine but unverified`);
        }
      }
    }
  }

  // P/O collision — a club-season must not be both pickable and opponent-only
  const pKey = new Set(pRows.map((r) => r.club + "|" + r.season));
  for (const r of oRows) {
    if (pKey.has(r.club + "|" + r.season)) {
      err(`"${r.club}" ${r.season} exists as BOTH a pickable (P) squad and an opponent-only (O) row — draws could pick you as your own opponent`);
    }
  }

  // near-duplicate club names — same club, different literal spelling.
  // WARN, not ERROR: needs a human to pick the canonical spelling, and some
  // near-matches (e.g. "Dundee" vs "Dundee United") are different clubs.
  // Two independent signals, either is enough to flag: whole-word containment
  // ("Porto" inside "FC Porto") and edit-distance similarity (catches accent/
  // spelling drift like "Bayern Munich" vs "Bayern München" that containment
  // alone misses).
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
  const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  const containsWhole = (a, b) => ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);

  const normList = [...clubNamesByNorm.keys()];
  const reported = new Set();
  for (let i = 0; i < normList.length; i++) {
    const a = normList[i];
    if (reported.has(a)) continue;
    for (let j = i + 1; j < normList.length; j++) {
      const b = normList[j];
      if (reported.has(b) || a === b) continue;
      const bothLongEnough = a.length >= 5 && b.length >= 5;
      if (containsWhole(a, b) || (bothLongEnough && similarity(a, b) > 0.82)) {
        const names = [...clubNamesByNorm.get(a), ...clubNamesByNorm.get(b)];
        warn(`possible same-club spelling variants: ${names.map((n) => `"${n}"`).join(" / ")} — confirm same club before merging, some near-matches are genuinely different clubs`);
        reported.add(a); reported.add(b);
      }
    }
  }

  if (args.has("--json")) {
    console.log(JSON.stringify({ errors, warnings }, null, 2));
  } else {
    console.log("\nROLL XI — DATA VALIDATION\n" + "=".repeat(64));
    console.log(`${packs.length} packs checked\n`);

    if (errors.length) {
      console.log(`ERRORS (${errors.length}) — must fix:\n`);
      errors.forEach((e) => console.log("  ✗ " + e.msg));
      console.log();
    } else {
      console.log("No errors.\n");
    }

    if (warnings.length) {
      console.log(`WARNINGS (${warnings.length}) — review, doesn't block:\n`);
      warnings.forEach((w) => console.log("  ! " + w.msg));
      console.log();
    }
  }

  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
