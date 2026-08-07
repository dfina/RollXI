import { mulberry32, hashStr, clamp, avg } from "./rng.js";

/* ---- team strength from an XI of slot objects {grp, rating, name, dp} ---- */
export function teamStrength(slots) {
  const r = (g) => slots.filter((s) => s.grp === g).map((s) => s.rating);
  const gk = r("GK"), df = r("DF"), mf = r("MF"), fw = r("FW");
  const attack = 0.55 * avg(fw) + 0.35 * avg(mf) + 0.10 * avg(df);
  const defence = 0.35 * (gk[0] || 50) + 0.45 * avg(df) + 0.20 * avg(mf);
  const overall = Math.round(avg(slots.map((s) => s.rating)));
  return { attack, defence, overall };
}

/* Opponent rows carry a single 'rating'; expand to attack/defence around it
   so the same match maths works for both sides. */
export function oppStrength(rating) {
  return { attack: rating, defence: rating, overall: rating };
}

/* ---- expected goals (low-luck), then a seeded scoreline ----
   lambda grows with attack vs the other side's defence. */
function lambdaFor(att, oppDef) {
  return clamp(1.30 * Math.exp((att - oppDef) / 14), 0.12, 6.2);
}
function drawGoals(lam, rng) {
  // low-variance: expected value plus small triangular noise, floored at 0
  const noise = (rng() + rng() - 1) * 1.05;
  return Math.max(0, Math.round(lam + noise));
}

/* Deterministic 90-minute result between two strengths.
   seed makes a given fixture replay identically. */
export function playMatch(home, away, seed) {
  const rng = mulberry32(hashStr(seed));
  const lh = lambdaFor(home.attack, away.defence);
  const la = lambdaFor(away.attack, home.defence);
  const hg = drawGoals(lh, rng);
  const ag = drawGoals(la, rng);
  return { hg, ag };
}

/* Minute-by-minute goal timeline for the ticker, with scorer assignment.
   scorersHome/away: arrays of {name, weight}; picks weighted by attacking role. */
export function goalTimeline(hg, ag, scorersHome, scorersAway, seed) {
  const rng = mulberry32(hashStr(seed + "|timeline"));
  const events = [];
  const place = (n, side, pool) => {
    for (let i = 0; i < n; i++) {
      events.push({ minute: 1 + Math.floor(rng() * 90), side, scorer: pickScorer(pool, rng) });
    }
  };
  place(hg, "home", scorersHome);
  place(ag, "away", scorersAway);
  events.sort((a, b) => a.minute - b.minute);
  // de-dupe identical minutes by nudging
  let last = -1;
  for (const e of events) { if (e.minute <= last) e.minute = Math.min(90, last + 1); last = e.minute; }
  return events;
}

function pickScorer(pool, rng) {
  if (!pool || pool.length === 0) return null;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let t = rng() * total;
  for (const p of pool) { t -= p.weight; if (t <= 0) return p.name; }
  return pool[pool.length - 1].name;
}

/* Scorer weighting shared by the player's XI and full historical rosters.
   Detailed positions take precedence over broad groups so centre-forwards are
   more likely to score than wingers, attacking mids more than holding mids,
   and defenders only occasionally. Every listed player keeps a non-zero chance. */
const SCORER_WEIGHT_BY_POS = {
  ST: 12, CF: 12, SS: 10.5,
  LW: 8.5, RW: 8.5, FW: 8.5, F: 8.5, W: 8.5,
  AM: 6, RM: 4.5, LM: 4.5,
  CM: 3.5, MF: 3.5, M: 3.5,
  DM: 2.2,
  LWB: 1.7, RWB: 1.7,
  LB: 1.2, RB: 1.2,
  CB: 0.9, SW: 0.9, DF: 0.9, D: 0.9, B: 0.9,
  GK: 0.03
};
const SCORER_WEIGHT_BY_GROUP = { FW: 8.5, MF: 3.5, DF: 0.9, GK: 0.03 };

function scorerWeight(group, detailedPositions, rating) {
  const dps = Array.isArray(detailedPositions) ? detailedPositions : [];
  const posWeight = dps.reduce((best, pos) => Math.max(best, SCORER_WEIGHT_BY_POS[pos] || 0), 0)
    || SCORER_WEIGHT_BY_GROUP[group] || 1;
  const r = Number.isFinite(rating) ? rating : 75;
  // Rating is a secondary modifier: position should dominate, while elite
  // attackers still score a little more often than lower-rated squad players.
  return posWeight * (0.55 + clamp(r, 45, 100) / 100);
}

/* Scorer weights for the player's XI. */
export function scorerPoolFromXI(slots) {
  return slots
    .filter((s) => s && s.name)
    .map((s) => ({ name: s.name, weight: scorerWeight(s.grp, s.dp, s.rating) }));
}

/* Full-roster scorer pool for a pickable historical club-season.
   Player rows use {n,p,dp,r}; every roster member is retained. */
export function scorerPoolFromRoster(players) {
  return (players || [])
    .filter((p) => p && p.n)
    .map((p) => ({ name: p.n, weight: scorerWeight(p.p, p.dp, p.r) }));
}

/* Opponent scorer source. If the opponent is also a pickable squad, always
   derive scorers from that full roster, even for a saved campaign whose
   opponent row predates this behaviour. Otherwise preserve the curated legacy
   scorer list used by stub-only opponents. */
export function scorerPoolFromOpponent(ref, squadById = null) {
  const roster = ref && squadById ? squadById[ref.id] : null;
  if (roster && Array.isArray(roster.players) && roster.players.length) {
    return scorerPoolFromRoster(roster.players);
  }
  return (ref && Array.isArray(ref.scorers) ? ref.scorers : [])
    .map((s) => typeof s === "string" ? { name: s, weight: 1 } : s)
    .filter((s) => s && s.name && Number.isFinite(s.weight) && s.weight > 0);
}

/* ---- extra time + penalties (used by A3 knockouts; defined here now) ---- */
export function extraTime(home, away, seed) {
  const rng = mulberry32(hashStr(seed + "|et"));
  const lh = lambdaFor(home.attack, away.defence) * 0.42;
  const la = lambdaFor(away.attack, home.defence) * 0.42;
  return { hg: drawGoals(lh, rng), ag: drawGoals(la, rng) };
}
export function penalties(home, away, seed, homeTakers = [], awayTakers = []) {
  const rng = mulberry32(hashStr(seed + "|pens"));
  const pConv = (s) => clamp(0.74 + (s.attack - 80) / 120, 0.6, 0.9);
  const ph = pConv(home), pa = pConv(away);
  const kicks = [];
  let h = 0, a = 0;
  let hTaken = 0, aTaken = 0;
  // best-of-5: alternate kicks, stop as soon as one side cannot be caught
  for (let i = 0; i < 10; i++) {
    const homeTurn = i % 2 === 0;
    if (homeTurn) {
      const s = rng() < ph; if (s) h++; hTaken++;
      kicks.push({ team: "home", scored: s, round: hTaken, kicker: takerFor(homeTakers, hTaken) });
    } else {
      const s = rng() < pa; if (s) a++; aTaken++;
      kicks.push({ team: "away", scored: s, round: aTaken, kicker: takerFor(awayTakers, aTaken) });
    }
    const hLeft = 5 - hTaken, aLeft = 5 - aTaken;
    if (h > a + aLeft || a > h + hLeft) break;          // result already settled
    if (hTaken === 5 && aTaken === 5) break;             // all ten taken
  }
  // sudden death (paired rounds) if still level after five each
  let round = Math.max(hTaken, aTaken);
  while (h === a && round < 30) {
    round++;
    const hs = rng() < ph; if (hs) h++; kicks.push({ team: "home", scored: hs, round, kicker: takerFor(homeTakers, round) });
    const as = rng() < pa; if (as) a++; kicks.push({ team: "away", scored: as, round, kicker: takerFor(awayTakers, round) });
  }
  return { h, a, kicks, winner: h > a ? "home" : "away" };
}

function takerFor(list, round) {
  if (!list || list.length === 0) return null;
  return list[(Math.max(1, round) - 1) % list.length] || null;
}

export function penaltyTakersFromXI(slots) {
  const posWeight = { FW: 4, MF: 3, DF: 2, GK: 1 };
  return slots
    .filter((s) => s && s.name)
    .slice()
    .sort((a, b) => {
      const aw = posWeight[a.grp] || 0;
      const bw = posWeight[b.grp] || 0;
      if (bw !== aw) return bw - aw;
      return (b.rating || 0) - (a.rating || 0);
    })
    .map((s) => s.name);
}
