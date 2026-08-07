import { hashStr, mulberry32, seededShuffle, avg } from "./rng.js";
import { decadeOf } from "./date.js";

/* Stages that make a club-season opponent-eligible under the new schema.
   See docs/CONTENT-TARGET.md section 3 for why this replaced the old
   mutually-exclusive tierType "P"/"O" split: winners, runners-up and
   semi-finalists are a strict SUBSET of playable teams under the content
   target, so a club-season increasingly needs to be BOTH draftable and
   faceable — something tierType could never represent. */
const OPPONENT_STAGES = ["W", "RU", "SF"];

/* Build a lightweight opponent-shape row from a full roster. Used when a
   pickable squad's achievements also make it opponent-eligible (e.g. a
   drafted club that reached a UCL final). Synthesises the single `rating`
   number legacy stub rows always carried, as the average of every listed
   player's rating — the same averaging teamStrength() already uses for a
   full XI, just over the whole squad rather than 11 starters. Scorers are
   intentionally omitted (rosters don't curate a scorer list the way O-tier
   packs do); match.js already treats a missing scorers array as safe. */
function toStub(row) {
  return {
    id: row.id, club: row.club, season: row.season, country: row.country || null,
    rating: Math.round(avg(row.players.map((p) => p.r))),
    kit: row.kit, crest: row.crest || null,
    scorers: [],
    comps: (row.achievements || []).map((a) => a.comp)
  };
}

function isOpponentEligible(row) {
  if (Array.isArray(row.achievements)) {
    return row.achievements.some((a) => OPPONENT_STAGES.includes(a.stage));
  }
  // Legacy fallback for rows not yet migrated to achievements[]. As of
  // 2026-08-07 this is deliberately limited to 26 main-draw opponent rows in
  // pack-opponents-ucl-main-200001.json and pack-opponents-provisional.json;
  // see docs/CONTENT-TARGET.md sections 3C-3D.
  return row.tierType === "O";
}
function roleOf(row) {
  return row.role || (row.players && row.players.length ? "roster" : "stub");
}

/* Loads the pack manifest and merges all packs into one dataset.
   Rosters (role: "roster") contribute players and are draftable. Any
   club-season whose achievements include a final or semi-final ALSO
   contributes an opponent row, whether or not it's also a roster — see
   isOpponentEligible() above. Rows not yet migrated to the new schema fall
   back to the old tierType-based split so nothing regresses mid-migration. */
export async function loadData() {
  const idx = await fetch("data/index.json").then((r) => r.json());
  const packs = await Promise.all(
    idx.packs.map((p) => fetch("data/" + p.file).then((r) => r.json()))
  );
  const squads = [];   // draftable
  const oppRows = [];  // opponent-eligible (may overlap with squads now)
  for (const pack of packs) {
    for (const row of pack.squads || []) {
      const role = roleOf(row);
      if (role === "roster") squads.push(row);
      if (isOpponentEligible(row)) {
        oppRows.push(role === "roster" ? toStub(row) : row);
      }
    }
  }
  const squadById = {};
  squads.forEach((s) => { squadById[s.id] = s; });

  /* flat player-season list for Daily trivia and Chains */
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
  return { squads, oppRows, squadById, players, packNames: idx.packs.map((p) => p.name) };
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
