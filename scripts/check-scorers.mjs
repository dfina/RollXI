import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadData } from "../src/lib/data.js";
import { scorerPoolFromOpponent, penaltyTakersFromOpponent } from "../src/lib/match.js";
import { playMyFixture } from "../src/lib/campaign.js";
import { playLeg, resolveLevel } from "../src/lib/knockout.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^data\//, "public/data/");
  const text = await fs.readFile(path.join(ROOT, rel), "utf8");
  return { json: async () => JSON.parse(text) };
};

function fail(message) {
  console.error("SCORER POOL CHECK FAILED: " + message);
  process.exitCode = 1;
}

const data = await loadData();
const overlaps = data.oppRows.filter((opp) => data.squadById[opp.id]);
if (!overlaps.length) fail("no pickable Campaign opponents found");

for (const opp of overlaps) {
  const roster = data.squadById[opp.id];
  const pool = scorerPoolFromOpponent(opp, data.squadById);
  const rosterNames = new Set(roster.players.map((p) => p.n));
  const poolNames = new Set(pool.map((p) => p.name));

  if (pool.length !== roster.players.length) {
    fail(`${opp.id}: scorer pool has ${pool.length} players, roster has ${roster.players.length}`);
  }
  for (const name of rosterNames) {
    if (!poolNames.has(name)) fail(`${opp.id}: roster player missing from scorer pool: ${name}`);
  }
  if (pool.some((p) => !Number.isFinite(p.weight) || p.weight <= 0)) {
    fail(`${opp.id}: scorer pool contains a non-positive or invalid weight`);
  }
}

// Saved campaigns created before this feature can contain an empty scorer list.
// A live roster lookup must still restore the complete scorer pool.
if (overlaps.length) {
  const opp = overlaps[0];
  const recovered = scorerPoolFromOpponent({ ...opp, scorers: [] }, data.squadById);
  if (recovered.length !== data.squadById[opp.id].players.length) {
    fail(`${opp.id}: old saved-campaign scorer data was not recovered from the live roster`);
  }
}

// Stub-only historical opponents keep their curated names as an equal-weight fallback.
const stubOnly = data.oppRows.find((opp) => !data.squadById[opp.id] && Array.isArray(opp.scorers) && opp.scorers.length);
if (stubOnly) {
  const fallback = scorerPoolFromOpponent(stubOnly, data.squadById);
  if (!fallback.length || fallback.some((p) => p.weight !== 1)) {
    fail(`${stubOnly.id}: stub scorer fallback changed unexpectedly`);
  }
}


// Playable opponents must also expose real penalty takers, so shootout rows
// can display names instead of the generic Scored/Missed fallback.
if (overlaps.length) {
  const opp = overlaps[0];
  const rosterNames = new Set(data.squadById[opp.id].players.map((p) => p.n));
  const takers = penaltyTakersFromOpponent(opp, data.squadById);
  if (takers.length !== data.squadById[opp.id].players.length) {
    fail(`${opp.id}: penalty taker pool has ${takers.length} players, roster has ${data.squadById[opp.id].players.length}`);
  }
  for (const name of takers) {
    if (!rosterNames.has(name)) fail(`${opp.id}: penalty taker not found in playable roster: ${name}`);
  }

  const xi = [
    { name: "Shootout GK", grp: "GK", dp: ["GK"], rating: 80 },
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Shootout DF ${i}`, grp: "DF", dp: ["CB"], rating: 80 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Shootout MF ${i}`, grp: "MF", dp: ["CM"], rating: 80 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Shootout FW ${i}`, grp: "FW", dp: ["CF"], rating: 80 }))
  ];
  const you = { xi, strength: { attack: 80, defence: 80, overall: 80 } };
  let checkedShootout = false;
  for (let i = 0; i < 400 && !checkedShootout; i++) {
    const tie = {
      id: `shootout-name-check-${i}`,
      home: { id: "__you", club: "Your XI", isYou: true, rating: 80 },
      away: { ...opp, isYou: false },
      leg1: { hg: 0, ag: 0 },
      leg2: { hg: 0, ag: 0 }
    };
    const rl = resolveLevel(you, tie, data.squadById);
    if (!rl.pens) continue;
    const opponentKicks = rl.pens.kicks.filter((k) => k.team === "away");
    if (!opponentKicks.length || opponentKicks.some((k) => !k.kicker || !rosterNames.has(k.kicker))) {
      fail(`${opp.id}: knockout shootout did not name playable-opponent penalty takers from its roster`);
    }
    checkedShootout = true;
  }
  if (!checkedShootout) fail(`${opp.id}: could not generate a penalty shootout for the name integration check`);
}

// Functional league + knockout integration check. Find a simulated opponent goal
// and verify the named scorer belongs to that opponent's complete pickable roster.
if (overlaps.length) {
  const opp = overlaps[0];
  const names = new Set(data.squadById[opp.id].players.map((p) => p.n));
  const xi = [
    { name: "Test GK", grp: "GK", dp: ["GK"], rating: 80 },
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Test DF ${i}`, grp: "DF", dp: ["CB"], rating: 80 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Test MF ${i}`, grp: "MF", dp: ["CM"], rating: 80 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Test FW ${i}`, grp: "FW", dp: ["CF"], rating: 80 }))
  ];
  const you = { xi, strength: { attack: 80, defence: 80, overall: 80 } };

  let leagueScorer = null;
  for (let i = 0; i < 200 && !leagueScorer; i++) {
    const league = { seed: `scorer-check-${i}`, teams: [{ id: "__you", isYou: true }, opp] };
    const res = playMyFixture(league, you, { oppId: opp.id, matchday: 1, home: true }, data.squadById);
    leagueScorer = res.timeline.find((e) => !e.mine)?.scorer || null;
  }
  if (!leagueScorer || !names.has(leagueScorer)) {
    fail(`${opp.id}: league simulation did not resolve an opponent scorer from the pickable roster`);
  }

  let knockoutScorer = null;
  for (let i = 0; i < 200 && !knockoutScorer; i++) {
    const tie = { id: `scorer-ko-${i}`, home: { id: "__you", isYou: true, rating: 80 }, away: { ...opp, isYou: false } };
    const res = playLeg(you, tie, 1, data.squadById);
    knockoutScorer = res.timeline.find((e) => !e.mine)?.scorer || null;
  }
  if (!knockoutScorer || !names.has(knockoutScorer)) {
    fail(`${opp.id}: knockout simulation did not resolve an opponent scorer from the pickable roster`);
  }
}

if (!process.exitCode) {
  console.log(`Scorer pools OK: ${overlaps.length} pickable Campaign opponents use their full rosters.`);
}
