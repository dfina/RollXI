import React, { useState, useMemo, useEffect } from "react";
import { Link2, Lightbulb, RotateCcw, Check, ArrowDown, Trophy } from "lucide-react";
import { load, save } from "../lib/storage.js";
import { todayKey, dayNumber } from "../lib/date.js";
import { Crest } from "../components/KitMark.jsx";
import {
  buildGraph, generatePuzzle, shortestPath, validateChain,
  sharedSquads, neighbours, linked
} from "../lib/chains.js";

export default function Chains({ data }) {
  const graph = useMemo(() => buildGraph(data.squads), [data]);
  const [mode, setMode] = useState("daily"); // daily | free
  const [freeSeed, setFreeSeed] = useState(0);

  const dateKey = todayKey();
  const dayNum = dayNumber(dateKey);
  const seed = mode === "daily" ? "rollxi-chain-" + dateKey : "rollxi-chainfree-" + freeSeed;
  const puzzle = useMemo(() => generatePuzzle(graph, seed, { minD: 3, maxD: 4 }), [graph, seed]);

  if (!puzzle) {
    return <div className="card fade" style={{ padding: 16 }}><p className="chalk">No chain available yet. Add more squads.</p></div>;
  }
  return (
    <ChainGame
      key={seed}
      graph={graph} data={data} puzzle={puzzle}
      mode={mode} dayNum={dayNum} dateKey={dateKey}
      onToggleMode={(m) => setMode(m)}
      onNewFree={() => { setMode("free"); setFreeSeed((n) => n + 1); }}
    />
  );
}

function ChainGame({ graph, data, puzzle, mode, dayNum, dateKey, onToggleMode, onNewFree }) {
  const { start, goal, optimal } = puzzle;
  // chain is the list of confirmed names from start; we always keep start at [0]
  const [chain, setChain] = useState([start]);
  const [solved, setSolved] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [revealPath, setRevealPath] = useState(null);

  const tail = chain[chain.length - 1];
  const reachedGoal = tail === goal;

  // restore daily completion
  useEffect(() => {
    if (mode !== "daily") return;
    const done = load("chain:hist", {})[dateKey];
    if (done) { setChain(done.chain); setSolved(true); setUsedHint(done.hint); }
  }, [mode, dateKey]);

  // options: players linked to the current tail, not already used, excluding nothing
  // (goal appears here once it's directly linked to tail)
  const options = useMemo(() => {
    if (solved) return [];
    return neighbours(graph, tail, chain);
  }, [graph, tail, chain, solved]);

  // is the goal directly reachable from the tail now?
  const goalLinkable = !solved && linked(graph, tail, goal) && tail !== goal;

  function addPlayer(name) {
    const next = chain.concat([name]);
    setChain(next);
    if (name === goal) finish(next);
  }

  function finish(finalChain) {
    const res = validateChain(graph, finalChain);
    if (!res.ok) return;
    setSolved(true);
    if (mode === "daily") {
      const hist = load("chain:hist", {});
      hist[dateKey] = { chain: finalChain, steps: finalChain.length - 1, optimal, hint: usedHint };
      save("chain:hist", hist);
      const st = load("chain:streak", { streak: 0, best: 0, last: null });
      const y = new Date(dateKey + "T00:00:00"); y.setDate(y.getDate() - 1);
      const yk = y.toLocaleDateString("en-CA");
      st.streak = st.last === yk ? st.streak + 1 : 1;
      st.last = dateKey; st.best = Math.max(st.best, st.streak);
      save("chain:streak", st);
    }
  }

  function undo() { if (chain.length > 1 && !solved) setChain(chain.slice(0, -1)); }
  function reset() { if (!solved) setChain([start]); }
  function hint() {
    // suggest the next player on an optimal path from the current tail to goal
    const p = shortestPath(graph, tail, goal);
    if (p && p.length > 1) { setUsedHint(true); addPlayer(p[1]); }
  }
  function giveUp() {
    const p = shortestPath(graph, start, goal);
    setRevealPath(p);
  }

  const steps = chain.length - 1;
  const streak = load("chain:streak", { streak: 0 }).streak;

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>
          {mode === "daily" ? "DAILY CHAIN #" + dayNum : "FREE CHAIN"}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={"seg" + (mode === "daily" ? " on" : "")} style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => onToggleMode("daily")}>Daily</button>
          <button className={"seg" + (mode === "free" ? " on" : "")} style={{ padding: "5px 10px", fontSize: 11 }} onClick={onNewFree}>Free</button>
        </div>
      </div>

      {/* objective */}
      <div className="card" style={{ padding: 14, marginTop: 10 }}>
        <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: 0 }}>CONNECT THESE TWO · SHORTEST IS {optimal} LINKS</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginTop: 8, gap: 8 }}>
          <PlayerTag name={start} graph={graph} />
          <Link2 size={18} style={{ color: "var(--flame)", flexShrink: 0 }} />
          <PlayerTag name={goal} graph={graph} highlight />
        </div>
      </div>

      {/* the chain so far */}
      <div className="card" style={{ padding: 14, marginTop: 10 }}>
        <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: "0 0 8px" }}>YOUR CHAIN · {steps} {steps === 1 ? "LINK" : "LINKS"}</p>
        {chain.map((name, i) => (
          <div key={name}>
            <ChainRow name={name} graph={graph} squadById={data.squadById}
              prev={i > 0 ? chain[i - 1] : null} isStart={i === 0} isGoal={name === goal} />
            {i < chain.length - 1 && <Connector />}
          </div>
        ))}
        {!solved && !reachedGoal && (
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <ArrowDown size={16} className="dim" />
            <p className="dim tele" style={{ fontSize: 11, margin: "2px 0 0" }}>add a team-mate of {lastName(tail)}</p>
          </div>
        )}
      </div>

      {/* result */}
      {solved && (
        <div className="card fade" style={{ padding: 16, marginTop: 10, textAlign: "center", border: "2px solid var(--green)" }}>
          <Check size={24} style={{ color: "var(--green)" }} />
          <p className="display chalk" style={{ fontSize: 18, margin: "4px 0 2px" }}>Linked in {steps}!</p>
          <p className="dim tele" style={{ fontSize: 12, margin: 0 }}>
            {steps === optimal ? "The shortest possible chain." : "Shortest was " + optimal + "."}{usedHint ? " · hint used" : ""}
          </p>
          {mode === "daily" && <p className="tele amber" style={{ fontSize: 12, margin: "8px 0 0", fontWeight: 800 }}>🔥 streak {streak}</p>}
          <button className="btn" style={{ width: "100%", padding: 12, fontSize: 14, marginTop: 12 }} onClick={onNewFree}>
            Play a free chain →
          </button>
        </div>
      )}

      {/* picker */}
      {!solved && (
        <>
          {goalLinkable && (
            <button className="btn" style={{ width: "100%", padding: 13, fontSize: 14, marginTop: 10, background: "var(--green)" }}
              onClick={() => addPlayer(goal)}>
              Link straight to {lastName(goal)} ✓
            </button>
          )}
          <div className="card" style={{ padding: 12, marginTop: 10 }}>
            <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: "0 0 8px" }}>TEAM-MATES OF {lastName(tail).toUpperCase()}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto" }}>
              {options.map((p) => (
                <button key={p.name} className="opt" style={{ padding: "9px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
                  onClick={() => addPlayer(p.name)}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name} <span className="dim tele" style={{ fontSize: 10 }}>{p.nat}</span>
                  </span>
                  <span className="tele dim" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{(p.dp || []).join("/")}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="ghost" style={{ flex: 1, padding: 10, fontSize: 12, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 5 }} onClick={undo} disabled={chain.length <= 1}>
              <RotateCcw size={13} /> Undo
            </button>
            <button className="ghost" style={{ flex: 1, padding: 10, fontSize: 12, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 5 }} onClick={hint}>
              <Lightbulb size={13} /> Hint
            </button>
            <button className="ghost" style={{ flex: 1, padding: 10, fontSize: 12 }} onClick={giveUp}>Give up</button>
          </div>

          {revealPath && (
            <div className="card fade" style={{ padding: 12, marginTop: 10 }}>
              <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: "0 0 6px" }}>ONE SHORTEST CHAIN</p>
              {revealPath.map((n, i) => (
                <div key={n}>
                  <span className="chalk" style={{ fontSize: 13, fontWeight: 700 }}>{n}</span>
                  {i < revealPath.length - 1 && <div className="dim tele" style={{ fontSize: 11, margin: "1px 0 1px 10px" }}>↓ {linkLabel(graph, n, revealPath[i + 1], data.squadById)}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---- small pieces ---- */
function lastName(n) { const p = n.split(" "); return p[p.length - 1]; }

function PlayerTag({ name, graph, highlight }) {
  const p = graph.people[name];
  const sq = p.squads[0];
  return (
    <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
      <div className="display chalk" style={{ fontSize: 14, lineHeight: 1.1, color: highlight ? "var(--flame)" : "var(--ink)" }}>{name}</div>
      <div className="tele dim" style={{ fontSize: 10, marginTop: 2 }}>{p.nat} · {(p.dp || []).join("/")}</div>
    </div>
  );
}

function ChainRow({ name, graph, squadById, prev, isStart, isGoal }) {
  const p = graph.people[name];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: isStart ? "var(--ink)" : isGoal ? "var(--flame)" : "var(--green)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <span className="tele" style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{isStart ? "A" : isGoal ? "B" : "✓"}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="chalk" style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div className="tele dim" style={{ fontSize: 10 }}>{p.nat}</div>
      </div>
    </div>
  );
}

function Connector() {
  return <div style={{ marginLeft: 14, height: 14, borderLeft: "2px dotted var(--hair)" }} />;
}

function linkLabel(graph, a, b, squadById) {
  const sh = sharedSquads(graph, a, b, squadById);
  return sh.length ? sh[0].label : "team-mates";
}
