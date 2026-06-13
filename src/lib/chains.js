import { mulberry32, hashStr, seededShuffle } from "./rng.js";

/* ---- build the link graph from the pickable squads ----
   A "person" is identified by name (may appear in several squads).
   Two people are linked if they shared any club-season. We also record,
   for any linked pair, WHICH squads connect them (for showing the link). */
export function buildGraph(squads) {
  const people = {};        // name -> { name, squads:[{id,club,season}], nat, dp, rating(max) }
  const adj = {};           // name -> Set(name)
  const linkSquads = {};    // "a||b" (sorted) -> Set(squadId)

  squads.forEach((s) => {
    s.players.forEach((p) => {
      if (!people[p.n]) people[p.n] = { name: p.n, squads: [], nat: p.nat, dp: p.dp || [p.p], rating: p.r };
      people[p.n].squads.push({ id: s.id, club: s.club, season: s.season });
      people[p.n].rating = Math.max(people[p.n].rating, p.r);
      if (!adj[p.n]) adj[p.n] = new Set();
    });
  });

  squads.forEach((s) => {
    const ps = s.players.map((p) => p.n);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        adj[ps[i]].add(ps[j]); adj[ps[j]].add(ps[i]);
        const key = [ps[i], ps[j]].sort().join("||");
        if (!linkSquads[key]) linkSquads[key] = new Set();
        linkSquads[key].add(s.id);
      }
    }
  });

  return { people, adj, linkSquads, names: Object.keys(people) };
}

export function linked(graph, a, b) {
  return graph.adj[a] && graph.adj[a].has(b);
}
/* the club-seasons that connect two linked people, as display strings */
export function sharedSquads(graph, a, b, squadById) {
  const key = [a, b].sort().join("||");
  const ids = graph.linkSquads[key];
  if (!ids) return [];
  return [...ids].map((id) => {
    const s = squadById[id];
    return { id, label: s.club + " " + s.season };
  });
}

/* BFS shortest path length (number of links) between two people, -1 if none */
export function distance(graph, start, goal) {
  if (start === goal) return 0;
  const q = [[start, 0]]; const v = new Set([start]);
  while (q.length) {
    const [x, d] = q.shift();
    for (const y of graph.adj[x]) {
      if (y === goal) return d + 1;
      if (!v.has(y)) { v.add(y); q.push([y, d + 1]); }
    }
  }
  return -1;
}

/* one shortest path (list of names start..goal), or null */
export function shortestPath(graph, start, goal) {
  if (start === goal) return [start];
  const prev = { [start]: null }; const q = [start];
  while (q.length) {
    const x = q.shift();
    for (const y of graph.adj[x]) {
      if (!(y in prev)) {
        prev[y] = x;
        if (y === goal) {
          const path = [y]; let c = x;
          while (c !== null) { path.push(c); c = prev[c]; }
          return path.reverse();
        }
        q.push(y);
      }
    }
  }
  return null;
}

/* ---- generate a solvable puzzle ----
   Pick a seeded start with enough reach, then a goal at target distance
   (prefer 3, accept 2-4). Guarantees start and goal are connected. */
export function generatePuzzle(graph, seed, opts = {}) {
  const minD = opts.minD || 3, maxD = opts.maxD || 4;
  const rng = mulberry32(hashStr(seed + "|chain"));
  // candidate starts: people with a decent number of links, shuffled
  const starts = seededShuffle(
    graph.names.filter((n) => graph.adj[n].size >= 4),
    rng
  );
  for (const start of starts) {
    // BFS to collect distances from start
    const dist = { [start]: 0 }; const q = [start];
    while (q.length) {
      const x = q.shift();
      for (const y of graph.adj[x]) if (!(y in dist)) { dist[y] = dist[x] + 1; q.push(y); }
    }
    const goals = seededShuffle(
      Object.keys(dist).filter((n) => dist[n] >= minD && dist[n] <= maxD),
      rng
    );
    if (goals.length) {
      const goal = goals[0];
      return { start, goal, optimal: dist[goal] };
    }
  }
  // fallback: any pair at distance >= 2
  for (const start of starts) {
    for (const goal of seededShuffle(graph.names, rng)) {
      const d = distance(graph, start, goal);
      if (d >= 2) return { start, goal, optimal: d };
    }
  }
  return null;
}

/* validate a user's chain: array of names start..goal, each consecutive pair linked,
   no repeats. Returns {ok, brokenAt} */
export function validateChain(graph, chain) {
  if (chain.length < 2) return { ok: false, brokenAt: -1 };
  const seen = new Set();
  for (let i = 0; i < chain.length; i++) {
    if (seen.has(chain[i])) return { ok: false, brokenAt: i };
    seen.add(chain[i]);
    if (i > 0 && !linked(graph, chain[i - 1], chain[i])) return { ok: false, brokenAt: i };
  }
  return { ok: true, brokenAt: -1 };
}

/* people linked to `name` not already used, for the picker, sorted by rating */
export function neighbours(graph, name, used) {
  const u = new Set(used);
  return [...graph.adj[name]]
    .filter((n) => !u.has(n))
    .map((n) => graph.people[n])
    .sort((a, b) => b.rating - a.rating);
}
