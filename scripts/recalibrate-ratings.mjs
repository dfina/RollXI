#!/usr/bin/env node
/*
  Roll XI global player-rating recalibration (absolute-v3).

  Purpose:
  - move the entire playable database onto one absolute strength scale;
  - lower the inflated floor inherited from earlier content batches;
  - widen within-squad dispersion while preserving the existing player hierarchy;
  - use compatible career-relative signals where legacy rows are too flat;
  - refuse to apply twice unless --force is explicitly supplied.

  Usage:
    node scripts/recalibrate-ratings.mjs
    node scripts/recalibrate-ratings.mjs --check
*/

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve("public/data");
const MODEL = "absolute-v3";
const args = new Set(process.argv.slice(2));

const stripAccents = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalise = (v) => stripAccents(v).toLowerCase().replace(/[.’'`-]/g, " ").replace(/\s+/g, " ").trim();
const startYear = (season) => Number(String(season || "").slice(0, 4));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / xs.length);
};

// A small set of legacy rows contained too little player-level signal for a
// hierarchy-preserving transform. These offsets are explicit gameplay review
// inputs, not claims of an external numerical rating.
const SIGNAL_OVERRIDES = new Map(Object.entries({
  "Hamrun Spartans|2025-26": {
    "Henry Bonello": 1, "Joseph Mbong": 3, "Ante Ćorić": 2.5, "Matías Ariel García": 2,
    "Saliou Thioune": 1.5, "Ognjen Bjeličić": -2, "Éder": -2, "N'Dri Koffi": -1.5,
    "Stijn Meijer": -1.5, "Rafael Compri": -0.5
  },
  "Aberdeen|2023-24": {
    "Bojan Miovski": 4, "Graeme Shinnie": 3, "Jamie McGrath": 2, "Connor Barron": 2,
    "Leighton Clarkson": 1.5, "Dante Polvara": 1, "Kelle Roos": 0, "Ryan Duncan": -2,
    "James McGarry": -2, "Slobodan Rubežić": -2.5, "Richard Jensen": -1.5, "Ester Sokler": -1
  },
  "Dinamo Zagreb|2023-24": {
    "Bruno Petković": 4, "Martin Baturina": 3.5, "Josip Mišić": 2.5, "Arijan Ademi": 2,
    "Gabriel Vidović": 1.5, "Dino Perić": 0.5, "Mahir Emreli": -2, "Mauro Perković": -2.5,
    "Takuro Kaneko": -1.5, "Sadegh Moharrami": -1, "Dario Špikić": -0.5
  },
  "KÍ Klaksvík|2023-24": {
    "Árni Frederiksberg": 4, "Jákup B. Andreasen": 3, "Páll A. Klettskarð": 2.5,
    "Hallur Hansson": 1.5, "Vegard Forren": 1, "René Shaki Joensen": 1,
    "Jonathan Johansson": 0, "Børge Petersen": -2.5, "Sivert Gussiås": -2,
    "Mads Boe Mikkelsen": -1.5, "Patrick da Silva": -1, "Jóannes Kalsø Danielsen": -0.5
  },
  "Ludogorets|2023-24": {
    "Claude Gonçalves": 3.5, "Jakub Piotrowski": 3, "Bernard Tekpetey": 2.5,
    "Anton Nedyalkov": 2, "Kwadwo Duah": 1.5, "Sergio Padt": 1, "Aslak Fonn Witry": 1,
    "Spas Delev": -2.5, "Dominik Yankov": -2, "Sonko Sundberg": -2,
    "Rwan Seco": -1.5, "Pedro Naressi": -1, "Dinis Almeida": -0.5
  },
  "Nordsjælland|2023-24": {
    "Marcus Ingvartsen": 4, "Andreas Schjelderup": 3, "Mohammed Diomande": 2.5,
    "Adamo Nagalo": 2, "Ibrahim Osman": 1.5, "Jeppe Tverskov": 1.5, "Conrad Harder": 1,
    "Kian Hansen": -1, "Martin Frese": -1.5, "Oliver Villadsen": -1,
    "Christian Rasmussen": -1, "Andreas Hansen": 0
  }
}));

async function loadAll() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  const shards = [];
  for (const item of index.shards) {
    const file = path.join(DATA, item.file);
    const json = JSON.parse(await readFile(file, "utf8"));
    shards.push({ file, json });
  }
  return shards;
}

function buildCareerIndex(shards) {
  const index = new Map();
  for (const { json } of shards) {
    for (const squad of json.squads || []) {
      const players = squad.players || [];
      if (!players.length) continue;
      const ratings = players.map((p) => Number(p.r)).filter(Number.isFinite);
      if (!ratings.length) continue;
      const squadMean = mean(ratings);
      for (const p of players) {
        const k = normalise(p.n);
        if (!k) continue;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push({
          club: squad.club, season: squad.season, year: startYear(squad.season),
          p: p.p, nat: p.nat, rating: Number(p.r), squadMean
        });
      }
    }
  }
  return index;
}

function careerSignal(player, squad, careerIndex) {
  const year = startYear(squad.season);
  const matches = (careerIndex.get(normalise(player.n)) || []).filter((x) => {
    if (x.club === squad.club && x.season === squad.season) return false;
    if (Math.abs(x.year - year) > 10) return false;
    if (player.p && x.p && String(player.p).toUpperCase() !== String(x.p).toUpperCase()) return false;
    if (player.nat && x.nat && normalise(player.nat) !== normalise(x.nat)) return false;
    return Number.isFinite(x.rating) && Number.isFinite(x.squadMean);
  });
  if (!matches.length) return null;
  let num = 0, den = 0;
  for (const x of matches) {
    const w = 1 / (1 + Math.abs(x.year - year));
    num += (x.rating - x.squadMean) * w;
    den += w;
  }
  return clamp(num / den, -6, 6);
}

function targetTeamMean(oldMean) {
  // Earlier packs had a floor clustered around the mid/high 70s. This mapping
  // keeps relative team ordering but restores space for weak squads below 70
  // and prevents strong non-elite clubs from automatically living in the 80s.
  return clamp(67 + 0.80 * (oldMean - 67), 66, 82.5);
}

function lowerTailRequirement(squadMean) {
  if (squadMean < 70) return 5;
  if (squadMean < 72) return 3;
  if (squadMean < 75) return 1;
  return 0;
}

function spreadDominantTies(values, players) {
  const out = values.slice();
  const groups = new Map();
  out.forEach((rating, i) => {
    if (!groups.has(rating)) groups.set(rating, []);
    groups.get(rating).push(i);
  });
  for (const indices of groups.values()) {
    if (indices.length < 5) continue;
    // Exact legacy ties contain no defensible hierarchy. Apply only a small,
    // mean-neutral gameplay dispersion inside the tied tier. Name ordering is
    // used solely for deterministic reproducibility, not as a quality signal.
    const ordered = indices.slice().sort((a, b) => normalise(players[a].n).localeCompare(normalise(players[b].n), "en"));
    const offsets = ordered.map((_, j) => {
      const q = (j + 0.5) / ordered.length;
      if (q < 0.20) return -2;
      if (q < 0.40) return -1;
      if (q < 0.60) return 0;
      if (q < 0.80) return 1;
      return 2;
    });
    while (offsets.reduce((a, b) => a + b, 0) > 0) {
      const i = offsets.findIndex((x) => x > -2);
      offsets[i] -= 1;
    }
    while (offsets.reduce((a, b) => a + b, 0) < 0) {
      let i = offsets.length - 1;
      while (i >= 0 && offsets[i] >= 2) i--;
      offsets[i] += 1;
    }
    ordered.forEach((playerIndex, j) => { out[playerIndex] = clamp(out[playerIndex] + offsets[j], 62, 97); });
  }
  return out;
}

function enforceLowerTail(values, signals) {
  const out = values.slice();
  const currentMean = mean(out);
  const required = lowerTailRequirement(currentMean);
  if (!required) return out;
  const low = [...out.keys()].sort((a, b) => signals[a] - signals[b] || out[a] - out[b] || a - b);
  const high = [...out.keys()].sort((a, b) => signals[b] - signals[a] || out[b] - out[a] || a - b);
  let moved = 0;
  for (const i of low.slice(0, required)) {
    if (out[i] >= 70) {
      const d = out[i] - 69;
      out[i] -= d;
      moved += d;
    }
  }
  let cursor = 0;
  while (moved > 0 && cursor < high.length * 20) {
    const i = high[cursor % high.length];
    if (!low.slice(0, required).includes(i) && out[i] < 97) {
      out[i] += 1;
      moved -= 1;
    }
    cursor++;
  }
  return out;
}

function recalibrateSquad(squad, careerIndex) {
  const players = squad.players || [];
  const oldRatings = players.map((p) => Number(p.r));
  const oldMean = mean(oldRatings);
  const oldRange = Math.max(...oldRatings) - Math.min(...oldRatings);
  const target = targetTeamMean(oldMean);
  const manual = SIGNAL_OVERRIDES.get(`${squad.club}|${squad.season}`) || {};

  let signals = players.map((p) => {
    if (Object.prototype.hasOwnProperty.call(manual, p.n)) return Number(manual[p.n]);
    const existing = Number(p.r) - oldMean;
    const career = careerSignal(p, squad, careerIndex);
    if (oldRange <= 2) return career ?? existing;
    if (oldRange <= 4) return 0.60 * existing + 0.40 * (career ?? existing);
    return 0.90 * existing + 0.10 * (career ?? existing);
  });

  const signalMean = mean(signals);
  signals = signals.map((x) => x - signalMean);
  const signalRange = Math.max(...signals) - Math.min(...signals);
  const signalSd = sd(signals);
  let spread = 1;
  if (signalRange > 0) spread = Math.max(spread, 10 / signalRange);
  if (signalSd > 0) spread = Math.max(spread, 2.5 / signalSd);
  spread = Math.min(spread, 3.5);

  let ratings = signals.map((signal) => Math.round(clamp(target + signal * spread, 62, 97)));
  const shift = Math.round(target - mean(ratings));
  ratings = ratings.map((r) => clamp(r + shift, 62, 97));
  ratings = spreadDominantTies(ratings, players);
  ratings = enforceLowerTail(ratings, signals);

  players.forEach((p, i) => { p.r = ratings[i]; });
  return { oldMean, newMean: mean(ratings), min: Math.min(...ratings), max: Math.max(...ratings), sd: sd(ratings) };
}

function ratingIssues(squad) {
  const ratings = (squad.players || []).map((p) => Number(p.r)).filter(Number.isFinite);
  if (ratings.length < 12) return [];
  const m = mean(ratings), lo = Math.min(...ratings), hi = Math.max(...ratings), sigma = sd(ratings);
  const issues = [];
  if (hi - lo < 6) issues.push(`range ${lo}-${hi}`);
  if (sigma < 2) issues.push(`SD ${sigma.toFixed(2)}`);
  if (new Set(ratings).size < 5) issues.push(`only ${new Set(ratings).size} distinct ratings`);
  const mode = Math.max(...[...new Map(ratings.map((r) => [r, ratings.filter((x) => x === r).length])).values()]);
  if (mode / ratings.length > 0.40) issues.push(`${mode}/${ratings.length} players share one rating`);
  if (m < 75 && lo >= 70) issues.push(`mean ${m.toFixed(2)} with no sub-70 player`);
  return issues;
}

async function main() {
  const shards = await loadAll();
  if (args.has("--check")) {
    const issues = [];
    let rosters = 0;
    for (const { json } of shards) {
      for (const squad of json.squads || []) {
        if (!(squad.players || []).length) continue;
        rosters++;
        const found = ratingIssues(squad);
        if (found.length) issues.push(`${squad.club} ${squad.season}: ${found.join(", ")}`);
      }
    }
    if (issues.length) {
      console.error(`Rating distribution check failed for ${issues.length}/${rosters} rosters:`);
      issues.forEach((x) => console.error(`  - ${x}`));
      process.exit(1);
    }
    console.log(`Rating distribution OK: ${rosters} playable rosters satisfy absolute-v3 spread/lower-tail rules.`);
    return;
  }

  const already = shards.every(({ json }) => json.meta?.ratingModel === MODEL);
  if (already && !args.has("--force")) {
    console.log(`All shards already use ${MODEL}; nothing changed.`);
    return;
  }

  const careerIndex = buildCareerIndex(shards);
  let rosters = 0, players = 0;
  const allBefore = [], allAfter = [];
  for (const { json } of shards) {
    for (const squad of json.squads || []) {
      if (!(squad.players || []).length) continue;
      const before = squad.players.map((p) => Number(p.r)).filter(Number.isFinite);
      allBefore.push(...before);
      recalibrateSquad(squad, careerIndex);
      const after = squad.players.map((p) => Number(p.r)).filter(Number.isFinite);
      allAfter.push(...after);
      rosters++;
      players += after.length;
    }
    json.meta = { ...json.meta, ratingModel: MODEL };
  }

  const issues = [];
  for (const { json } of shards) {
    for (const squad of json.squads || []) {
      const found = ratingIssues(squad);
      if (found.length) issues.push(`${squad.club} ${squad.season}: ${found.join(", ")}`);
    }
  }
  if (issues.length) throw new Error(`Post-recalibration rating gate failed:\n${issues.join("\n")}`);

  for (const { file, json } of shards) await writeFile(file, JSON.stringify(json, null, 2) + "\n");
  const pct = (xs, f) => 100 * xs.filter(f).length / xs.length;
  console.log(`Applied ${MODEL} to ${rosters} playable rosters / ${players} player-season ratings.`);
  console.log(`Mean ${mean(allBefore).toFixed(2)} -> ${mean(allAfter).toFixed(2)}; below 70 ${pct(allBefore, (r) => r < 70).toFixed(1)}% -> ${pct(allAfter, (r) => r < 70).toFixed(1)}%.`);
  console.log(`Range ${Math.min(...allAfter)}-${Math.max(...allAfter)}. All global distribution gates passed.`);
}

main().catch((e) => { console.error(e.stack || e.message || String(e)); process.exit(1); });
