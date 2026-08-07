import { hashStr, mulberry32, seededShuffle, avg } from "./rng.js";
import { scorerPoolFromRoster } from "./match.js";
import { decadeOf } from "./date.js";

/* Stages that make a club-season opponent-eligible. Depth and opponent
   eligibility are independent: a full roster can also be faced in Campaign
   when it reached a European final or semi-final. */
const OPPONENT_STAGES = ["W", "RU", "SF"];

/* Build a lightweight opponent-shape row from a full roster. The opponent
   scorer pool is always derived from the FULL playable roster so overlapping
   pickable/opponent club-seasons never fall back to an abbreviated list. */
function toStub(row) {
  return {
    id: row.id, club: row.club, season: row.season, country: row.country || null,
    rating: Math.round(avg(row.players.map((p) => p.r))),
    kit: row.kit, crest: row.crest || null,
    scorers: scorerPoolFromRoster(row.players),
    comps: [...new Set((row.achievements || []).map((a) => a.comp))]
  };
}

function isOpponentEligible(row) {
  return (row.achievements || []).some((a) => OPPONENT_STAGES.includes(a.stage));
}

/* Loads the stable decade-shard manifest and merges all club-seasons into one
   dataset. File boundaries are storage concerns only: each club-season exists
   exactly once, in the shard matching the season start year. */
export async function loadData() {
  const idx = await fetch("data/index.json").then((r) => r.json());
  const shards = await Promise.all(
    idx.shards.map((shard) => fetch("data/" + shard.file).then((r) => r.json()))
  );
  const squads = [];   // draftable
  const oppRows = [];  // opponent-eligible (may overlap with squads)
  for (const shard of shards) {
    for (const row of shard.squads || []) {
      if (row.role === "roster") squads.push(row);
      if (isOpponentEligible(row)) {
        oppRows.push(row.role === "roster" ? toStub(row) : row);
      }
    }
  }
  const squadById = {};
  squads.forEach((s) => { squadById[s.id] = s; });

  /* Flat player-season list for Daily trivia and Chains. */
  const players = [];
  squads.forEach((s) => {
    s.players.forEach((p) => {
      players.push({
        name: p.n, pos: p.p, dp: p.dp && p.dp.length ? p.dp : [p.p], rating: p.r, nat: p.nat,
        photo: p.photo || null, seasonPhoto: p.seasonPhoto || p.clubSeasonPhoto || null, canonicalPhoto: p.canonicalPhoto || null,
        squadId: s.id, club: s.club, season: s.season,
        league: s.league, country: s.country || null, euro: s.euro || null,
        kit: s.kit, crest: s.crest || null,
        decade: decadeOf(s.season),
        key: s.id + "|" + p.n
      });
    });
  });
  return { squads, oppRows, squadById, players, shardNames: idx.shards.map((s) => s.name) };
}

export function rarityOf(rating) {
  if (rating >= 93) return { id: "legend", label: "Legend", color: "var(--gold)" };
  if (rating >= 87) return { id: "star", label: "Star", color: "var(--silver)" };
  if (rating >= 80) return { id: "first", label: "First XI", color: "var(--gold)" };
  return { id: "squad", label: "Squad", color: "var(--silver)" };
}

/* Daily set: n distinct player-seasons (no repeated player name), seeded by date. */
export function dailySet(dateKey, players, n) {
  const rng = mulberry32(hashStr("rollxi-daily-" + dateKey));
  const order = seededShuffle(players, rng);
  const out = [];
  const seen = new Set();
  for (const p of order) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

/* Three distractor names: same nationality first, then same decade, then anyone.
   Never the answer's own name; no duplicate names among options. */
export function distractorsFor(answer, players, rng) {
  const used = new Set([answer.name]);
  const pickFrom = (pool, want, out) => {
    for (const p of seededShuffle(pool, rng)) {
      if (out.length >= want) break;
      if (used.has(p.name)) continue;
      used.add(p.name); out.push(p.name);
    }
  };
  const out = [];
  pickFrom(players.filter((p) => p.nat === answer.nat), 3, out);
  if (out.length < 3) pickFrom(players.filter((p) => p.decade === answer.decade), 3, out);
  if (out.length < 3) pickFrom(players, 3, out);
  return out;
}
