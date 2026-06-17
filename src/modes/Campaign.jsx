import React, { useState, useMemo, useEffect, useRef } from "react";
import { RotateCcw, ChevronRight, Trophy, Share2 } from "lucide-react";
import { mulberry32, hashStr, seededShuffle, avg } from "../lib/rng.js";
import { load, save, wipeAll } from "../lib/storage.js";
import { Crest } from "../components/KitMark.jsx";
import { teamStrength } from "../lib/match.js";
import { shareText, campaignShare } from "../lib/share.js";
import {
  FORMATIONS, FORMATION_NAMES, emptyXI, rollSequence,
  buildLeague, simulateOtherResults, standings, playMyFixture, applyResult
} from "../lib/campaign.js";
import {
  buildKnockout, drawRound, playLeg, aggregate, resolveLevel, playFinal,
  ROUND_NAMES, NEXT_ROUND
} from "../lib/knockout.js";

const SAVE_KEY = "campaign:v1";
const MATCH_TICK_MS = 222; // 90 simulated minutes ≈ 20 seconds
const SHOOTOUT_TICK_MS = 750;


export default function Campaign({ data }) {
  const [camp, setCamp] = useState(() => load(SAVE_KEY, null));
  const persist = (c) => { setCamp(c); save(SAVE_KEY, c); };
  const reset = () => { save(SAVE_KEY, null); setCamp(null); };

  if (!camp) return <SetupScreen data={data} onStart={persist} />;
  if (camp.phase === "build") return <BuildScreen data={data} camp={camp} onUpdate={persist} onReset={reset} />;
  if (camp.phase === "league") return <LeagueScreen data={data} camp={camp} onUpdate={persist} onReset={reset} />;
  if (camp.phase === "leagueDone") return <LeagueDoneScreen camp={camp} onUpdate={persist} onReset={reset} />;
  if (camp.phase === "knockout") return <KnockoutScreen camp={camp} onUpdate={persist} onReset={reset} />;
  return <ChampionScreen camp={camp} onReset={reset} />;
}

/* ---------------- setup: choose formation ---------------- */
function SetupScreen({ data, onStart }) {
  const [fm, setFm] = useState("4-3-3");
  function begin() {
    const seed = "camp-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    onStart({
      phase: "build", seed, formation: fm,
      xi: emptyXI(fm), ptr: 0, rerolls: 4,
      seq: rollSequence(seed, data.squads)
    });
  }
  return (
    <div className="fade">
      <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>NEW CAMPAIGN</p>
      <h2 className="display chalk" style={{ fontSize: 26, margin: "6px 0 4px" }}>Pick your shape</h2>
      <p className="dim" style={{ fontSize: 13, margin: "0 0 4px" }}>
        Then roll eleven squads and sign one player from each into your XI. Four re-rolls if a squad doesn't fit.
      </p>
      <hr className="rule" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {FORMATION_NAMES.map((name) => (
            <button key={name} className={"seg" + (fm === name ? " on" : "")}
              style={{ padding: "14px 10px", fontSize: 18, fontWeight: 900 }}
              onClick={() => setFm(name)}>
              {name}
            </button>
          ))}
      </div>
      <button className="btn" style={{ width: "100%", padding: 16, fontSize: 16, marginTop: 16 }} onClick={begin}>
        Start drafting →
      </button>
    </div>
  );
}

/* ---------------- build: roll squads, pick one player each ---------------- */
function BuildScreen({ data, camp, onUpdate, onReset }) {
  const placed = camp.xi.filter((s) => s.name).length;
  const done = placed === 11;
  const squad = !done ? data.squadById[camp.seq[camp.ptr]] : null;
  const [slotPick, setSlotPick] = useState(null); // { player, slots:[idx,...] }

  const openSlotLabels = useMemo(() => {
    const labels = [];
    camp.xi.forEach((s) => { if (!s.name && !labels.includes(s.label)) labels.push(s.label); });
    return labels;
  }, [camp]);

  const usedKeys = useMemo(() => new Set(camp.xi.filter((s) => s.name).map((s) => s.pickKey)), [camp]);

  function signPlayer(p) {
    const openSlots = playerOpenSlots(p, camp.xi);
    if (openSlots.length === 0) return;
    if (openSlots.length === 1) {
      // only one compatible slot — assign directly
      commitSlot(p, openSlots[0].i);
    } else {
      // multiple compatible open slots — let the user pick which
      setSlotPick({ player: p, slots: openSlots });
    }
  }

  function commitSlot(p, slotIdx) {
    const xi = camp.xi.map((s) => ({ ...s }));
    xi[slotIdx] = { ...xi[slotIdx], name: p.n, rating: p.r, dp: p.dp || [p.p], nat: p.nat, squadId: squad.id, pickKey: squad.id + "|" + p.n };
    const nowDone = xi.filter((s) => s.name).length === 11;
    setSlotPick(null);
    onUpdate({ ...camp, xi, ptr: nowDone ? camp.ptr : camp.ptr + 1 });
  }

  function reroll() {
    if (camp.rerolls <= 0 || camp.ptr + 1 >= camp.seq.length) return;
    onUpdate({ ...camp, ptr: camp.ptr + 1, rerolls: camp.rerolls - 1 });
  }

  function kickOffLeague() {
    const xi = camp.xi;
    const strength = teamStrength(xi);
    const you = {
      club: "Your XI", season: "All-Stars", kit: ["#1C1C1A", "#EFE7D3"], crest: null,
      xi, strength
    };
    const league = buildLeague(camp.seed, you, data.oppRows);
    onUpdate({ ...camp, phase: "league", you, league, matchday: 1, lastResult: null });
  }

  return (
    <div className="fade">
      {/* slot picker: shown when player has multiple open slots to choose from */}
      {slotPick && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div className="card fade" style={{ width: "100%", padding: 18, borderRadius: "16px 16px 0 0" }}>
            <p className="tele amber" style={{ fontSize: 11, letterSpacing: 1.5, margin: "0 0 4px", fontWeight: 800 }}>CHOOSE SLOT FOR {slotPick.player.n.toUpperCase()}</p>
            <p className="dim" style={{ fontSize: 12, margin: "0 0 12px" }}>This player can fill more than one compatible role in your tactic. Pick which slot to fill.</p>
            {slotPick.slots.map((s) => (
              <button key={s.i} className="opt" style={{ width: "100%", padding: "12px 14px", fontSize: 15, fontWeight: 700, marginBottom: 6 }}
                onClick={() => commitSlot(slotPick.player, s.i)}>
                {s.label}
              </button>
            ))}
            <button className="ghost" style={{ width: "100%", padding: 10, fontSize: 13, marginTop: 4 }}
              onClick={() => setSlotPick(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>DRAFT · {camp.formation}</p>
        <span className="tele chalk" style={{ fontSize: 12 }}>{placed}/11 signed</span>
      </div>

      <MiniPitch xi={camp.xi} formation={camp.formation} />

      {!done && squad && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Crest kit={squad.kit} crest={squad.crest} name={squad.club} size={26} />
              <div style={{ minWidth: 0 }}>
                <div className="display chalk" style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{squad.club}</div>
                <div className="tele dim" style={{ fontSize: 11 }}>{squad.season} · {squadContextLabel(squad)}</div>
              </div>
            </div>
            <button className="ghost" style={{ padding: "7px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={reroll} disabled={camp.rerolls <= 0}>
              <RotateCcw size={13} /> Re-roll ({camp.rerolls})
            </button>
          </div>
          <p className="dim tele" style={{ fontSize: 10, letterSpacing: 1, margin: "10px 0 6px" }}>
            SIGN ONE · OPEN ROLES: {openSlotLabels.join(" · ")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 240, overflowY: "auto" }}>
            {squad.players.slice().sort((a, b) => b.r - a.r).map((p) => {
              const compatibleOpenSlots = playerOpenSlots(p, camp.xi);
              const tacticLabels = playerTacticLabels(p, camp.xi, true);
              const lineOpen = compatibleOpenSlots.length > 0;
              const taken = usedKeys.has(squad.id + "|" + p.n);
              const dis = !lineOpen || taken;
              return (
                <button key={p.n} className="opt" disabled={dis}
                  style={{ padding: "9px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
                  onClick={() => signPlayer(p)}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.n} <span className="dim tele" style={{ fontSize: 10 }}>{tacticLabels.join("/") || "—"}</span>
                  </span>
                  <span className="tele" style={{ fontWeight: 800, flexShrink: 0, marginLeft: 8, color: lineOpen ? "var(--ink)" : "var(--dim)" }}>
                    {p.r}{taken ? " · picked" : !lineOpen ? " · full" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {done && (
        <div className="card" style={{ padding: 14, marginTop: 12, textAlign: "center" }}>
          <p className="tele dim" style={{ fontSize: 11, letterSpacing: 1.5, margin: 0 }}>SQUAD COMPLETE · OVERALL {teamStrength(camp.xi).overall}</p>
          <button className="btn" style={{ width: "100%", padding: 15, fontSize: 16, marginTop: 10 }} onClick={kickOffLeague}>
            Enter the league phase →
          </button>
        </div>
      )}

      <button className="ghost" style={{ width: "100%", padding: 10, fontSize: 12, marginTop: 12, color: "var(--flame)", borderColor: "var(--flame)" }}
        onClick={onReset}>
        ← Change formation / abandon draft
      </button>
    </div>
  );
}

/* ---------------- mini pitch shared by build + league ---------------- */
function MiniPitch({ xi, formation }) {
  const f = FORMATIONS[formation];
  return (
    <div style={{ position: "relative", height: 300, borderRadius: 8, overflow: "hidden", marginTop: 10,
      background: "#2E8B53", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 26px, rgba(0,0,0,.05) 26px 52px)", border: "1px solid rgba(0,0,0,.2)" }}>
      <div style={{ position: "absolute", inset: 7, border: "2px solid rgba(255,255,255,.5)", borderRadius: 4 }} />
      <div style={{ position: "absolute", left: 7, right: 7, top: "50%", height: 2, background: "rgba(255,255,255,.5)" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 58, height: 58, marginLeft: -29, marginTop: -29, border: "2px solid rgba(255,255,255,.5)", borderRadius: "50%" }} />
      {xi.map((s, i) => {
        const pos = f.xy[i];
        const filled = !!s.name;
        return (
          <div key={i} style={{ position: "absolute", left: pos[0] + "%", top: pos[1] + "%", transform: "translate(-50%,-50%)", textAlign: "center", width: 62 }}>
            <div style={{
              width: 38, height: 38, margin: "0 auto", borderRadius: "50%",
              background: filled ? "rgba(28,28,26,.92)" : "rgba(255,255,255,.18)",
              border: filled ? "2px solid #EFE7D3" : "2px dashed rgba(255,255,255,.6)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span className="tele" style={{ fontSize: 10, fontWeight: 800, color: filled ? "#EFE7D3" : "rgba(255,255,255,.85)" }}>
                {filled ? s.rating : s.label}
              </span>
            </div>
            {filled && (
              <div style={{ fontSize: 8.5, fontWeight: 800, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.7)", marginTop: 2, lineHeight: 1.05, overflow: "hidden" }}>
                {lastName(s.name)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function lastName(n) {
  const parts = n.split(" ");
  return parts[parts.length - 1];
}

/* ---------------- league hub: table + next fixture + ticker ---------------- */
function LeagueScreen({ data, camp, onUpdate, onReset }) {
  const [ticker, setTicker] = useState(null); // active match being played
  const league = camp.league;
  const me = league.teams.find((t) => t.isYou);
  const table = standings(league.teams);
  const myPos = table.findIndex((t) => t.isYou) + 1;
  const fixture = camp.matchday <= 8 ? league.myFixtures[camp.matchday - 1] : null;
  const leagueDone = camp.matchday > 8;

  function playNext() {
    const res = playMyFixture(league, camp.you, fixture);
    setTicker(res);
  }

  function finishMatch(res) {
    // apply my result + simulate others, advance matchday
    const lg = JSON.parse(JSON.stringify(league));
    const meT = lg.teams.find((t) => t.isYou);
    const opT = lg.teams.find((t) => t.id === res.opp.id);
    if (res.home) applyResult(meT, opT, res.hg, res.ag);
    else applyResult(opT, meT, res.hg, res.ag);
    lg.myFixtures[camp.matchday - 1].played = true;
    lg.myFixtures[camp.matchday - 1].hg = res.hg;
    lg.myFixtures[camp.matchday - 1].ag = res.ag;
    simulateOtherResults(lg, camp.matchday);
    const nextMd = camp.matchday + 1;
    const nowDone = nextMd > 8;
    const finalTable = standings(lg.teams);
    const pos = finalTable.findIndex((t) => t.isYou) + 1;
    setTicker(null);
    onUpdate({
      ...camp, league: lg, matchday: nextMd,
      phase: nowDone ? "leagueDone" : "league",
      finalPos: nowDone ? pos : undefined
    });
  }

  if (ticker) return <Ticker res={ticker} you={camp.you} matchday={camp.matchday} onDone={() => finishMatch(ticker)} />;

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>LEAGUE PHASE · MD {Math.min(camp.matchday, 8)}/8</p>
        <span className="tele chalk" style={{ fontSize: 12 }}>{myPos}{ord(myPos)} · {me.pts} pts</span>
      </div>

      {fixture && (
        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: 0 }}>MATCHDAY {camp.matchday} · {fixture.home ? "HOME" : "AWAY"}</p>
          <FixtureRow you={camp.you} opp={league.teams.find((t) => t.id === fixture.oppId)} home={fixture.home} />
          <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 10 }} onClick={playNext}>
            Reveal matchday {camp.matchday} →
          </button>
        </div>
      )}

      <Table table={table} currentOpponentId={fixture ? fixture.oppId : null} />

      <button className="ghost" style={{ width: "100%", padding: 11, fontSize: 12, marginTop: 14, color: "var(--flame)", borderColor: "var(--flame)" }} onClick={onReset}>
        Abandon campaign
      </button>
    </div>
  );
}

function FixtureRow({ you, opp, home }) {
  const left = home ? you : opp;
  const right = home ? opp : you;
  const tile = (t, you2) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
      {you2 ? <YouCrest /> : <Crest kit={t.kit} crest={t.crest} name={t.club} size={34} />}
      <span className="display chalk" style={{ fontSize: 12, textAlign: "center", lineHeight: 1.1 }}>{t.club}</span>
      <span className="tele dim" style={{ fontSize: 10 }}>{t.season || "All-Stars"} · {t.rating || (t.strength ? t.strength.overall : "")}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 2px" }}>
      {tile(left, home ? true : false)}
      <span className="display dim" style={{ fontSize: 13 }}>v</span>
      {tile(right, home ? false : true)}
    </div>
  );
}
function YouCrest({ size = 34 } = {}) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1C1C1A 60%,#E1492E 60%)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: Math.max(9, size * 0.32) }}>XI</span>;
}

function squadContextLabel(squad) {
  const comp = squad.euro && squad.euro.length > 0 ? squad.euro[0].comp : null;
  if (comp) return compLabel(comp);
  return squad.league === "ITA" ? "Serie A" : (squad.league || "");
}
function compLabel(comp) {
  const map = { EC: "EC", UCL: "UCL", UEL: "UEL", UEFA: "UEFA", UECL: "UECL", CONFL: "UECL", CWC: "CWC", INT: "INT", ITC: "INT" };
  return map[comp] || comp;
}

function opponentCompetitionLabel(team) {
  if (!team || team.isYou) return "";
  const list = team.comps || team.euro || [];
  const first = list && list.length ? list[0] : null;
  const comp = typeof first === "string" ? first : (first ? first.comp : null);
  return comp ? compLabel(comp) : "";
}

function TeamTickerName({ team, align = "left" }) {
  const isYou = team && (team.isYou || team.club === "Your XI");
  const label = opponentCompetitionLabel(team);
  const body = (
    <div style={{ minWidth: 0, textAlign: align === "right" ? "right" : "left" }}>
      <div className="display chalk" style={{ fontSize: 13, lineHeight: 1.08, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isYou ? "Your XI" : team.club}
      </div>
      {!isYou && (team.season || label) && (
        <div className="tele dim" style={{ fontSize: 9.5, marginTop: 2, lineHeight: 1 }}>
          {team.season || ""}{label ? " · " + label : ""}
        </div>
      )}
    </div>
  );
  const mark = isYou
    ? <YouCrest size={28} />
    : <Crest kit={team.kit || ["#1C1C1A", "#EFE7D3"]} crest={team.crest} name={team.club} size={28} />;
  return (
    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {align === "left" && mark}
      {body}
      {align === "right" && mark}
    </span>
  );
}

const DETAIL_TO_TACTIC = {
  GK: ["GK"],
  RB: ["RB"], RWB: ["RB", "RM"],
  LB: ["LB"], LWB: ["LB", "LM"],
  CB: ["CB"], SW: ["CB"], DF: ["RB", "CB", "LB"],
  DM: ["DM", "CM"], CM: ["CM"], AM: ["AM", "CM"], MF: ["DM", "CM", "AM", "LM", "RM", "LW", "RW"],
  RM: ["RM", "RW"], LM: ["LM", "LW"],
  RW: ["RW", "RM"], LW: ["LW", "LM"],
  SS: ["AM", "ST"], CF: ["ST"], ST: ["ST"], FW: ["ST", "LW", "RW"]
};

function playerPossibleTacticLabels(player) {
  const raw = (player.dp && player.dp.length ? player.dp : [player.p]).map((x) => String(x || "").toUpperCase());
  const labels = [];
  raw.forEach((code) => {
    (DETAIL_TO_TACTIC[code] || DETAIL_TO_TACTIC[player.p] || []).forEach((label) => {
      if (!labels.includes(label)) labels.push(label);
    });
  });
  return labels;
}

function playerTacticLabels(player, xi, openOnly = false) {
  const possible = new Set(playerPossibleTacticLabels(player));
  const labels = [];
  xi.forEach((slot) => {
    if (openOnly && slot.name) return;
    if (possible.has(slot.label) && !labels.includes(slot.label)) labels.push(slot.label);
  });
  return labels;
}

function playerOpenSlots(player, xi) {
  const possible = new Set(playerPossibleTacticLabels(player));
  return xi
    .map((slot, i) => ({ ...slot, i }))
    .filter((slot) => !slot.name && possible.has(slot.label));
}

function Table({ table, currentOpponentId }) {
  return (
    <div className="card" style={{ padding: "8px 0", marginTop: 12, overflow: "hidden" }}>
      <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: "2px 12px 6px" }}>LEAGUE TABLE · TOP 8 QUALIFY · 9-24 PLAY OFF</p>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {table.map((t, i) => {
          const rank = i + 1;
          const band = rank <= 8 ? "var(--green)" : rank <= 24 ? "var(--flame)" : "var(--dim)";
          const comp = t.comps && t.comps.length > 0 ? t.comps[0] : null;
          const isCurrentOpponent = currentOpponentId && t.id === currentOpponentId;
          return (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 12px",
              background: t.isYou ? "rgba(225,73,46,.12)" : isCurrentOpponent ? "rgba(14,122,67,.12)" : "transparent",
              borderLeft: "3px solid " + (t.isYou ? "var(--flame)" : isCurrentOpponent ? "var(--green)" : "transparent")
            }}>
              <span className="tele" style={{ width: 26, fontSize: 11, color: band, fontWeight: 800 }}>{rank}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: (t.isYou || isCurrentOpponent) ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.club}{" "}
                <span className="dim tele" style={{ fontSize: 9 }}>
                  {(t.season || "").slice(2)}{comp ? " · " + comp : ""}
                </span>
              </span>
              <span className="tele dim" style={{ fontSize: 10, width: 54, textAlign: "right" }}>{t.played}p {t.gf - t.ga >= 0 ? "+" : ""}{t.gf - t.ga}</span>
              <span className="tele" style={{ fontSize: 12, fontWeight: 800, width: 24, textAlign: "right" }}>{t.pts}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- match ticker: accelerated clock + goals ---------------- */
function Ticker({ res, you, matchday, onDone }) {
  const [minute, setMinute] = useState(0);
  const [shown, setShown] = useState([]);
  const [finished, setFinished] = useState(false);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) {
      setMinute(90); setShown(res.timeline); setFinished(true); return;
    }
    let m = 0;
    const id = setInterval(() => {
      m += 1;
      setMinute(m);
      setShown(res.timeline.filter((e) => e.minute <= m));
      if (m >= 90) { clearInterval(id); setFinished(true); }
    }, MATCH_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const myG = shown.filter((e) => e.mine).length;
  const opG = shown.filter((e) => !e.mine).length;
  const oppName = res.opp.club;

  return (
    <div className="fade" style={{ paddingTop: 8 }}>
      <p className="tele dim" style={{ fontSize: 11, letterSpacing: 1.5, textAlign: "center", margin: 0 }}>MATCHDAY {matchday} · {res.home ? "HOME" : "AWAY"}</p>
      <div className="card" style={{ padding: 16, marginTop: 8, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <TeamTickerName team={res.home ? { ...you, isYou: true, club: "Your XI" } : res.opp} align="right" />
          <span className="tele amber" style={{ fontSize: 36, fontWeight: 800, minWidth: 86 }}>
            {res.home ? myG : opG}-{res.home ? opG : myG}
          </span>
          <TeamTickerName team={res.home ? res.opp : { ...you, isYou: true, club: "Your XI" }} align="left" />
        </div>
        <div className="tele" style={{ fontSize: 14, marginTop: 8, color: finished ? "var(--flame)" : "var(--green)", fontWeight: 800 }}>
          {finished ? "FULL TIME" : minute + "'"}
        </div>
      </div>

      <div className="card" style={{ padding: "10px 14px", marginTop: 10, minHeight: 120 }}>
        {shown.length === 0 && <p className="tele dim" style={{ fontSize: 12, margin: 0 }}>Kick-off…</p>}
        {shown.map((e, i) => {
          const isLeft = e.mine ? res.home : !res.home;
          const fallback = e.mine ? "Your XI" : oppName;
          return (
            <p key={i} className="tele fade" style={{ fontSize: 12, margin: "5px 0", display: "flex", justifyContent: isLeft ? "flex-start" : "flex-end", gap: 8, color: e.mine ? "var(--green)" : "var(--ink2)" }}>
              {isLeft
                ? <span><b>{e.minute}'</b> ⚽ {e.scorer || fallback}</span>
                : <span style={{ textAlign: "right" }}>{e.scorer || fallback} ⚽ <b>{e.minute}'</b></span>}
            </p>
          );
        })}
      </div>
      {finished && (
        <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 10 }} onClick={onDone}>
          Continue →
        </button>
      )}
    </div>
  );
}

/* ---------------- league complete: show fate, build bracket ---------------- */
function LeagueDoneScreen({ camp, onUpdate, onReset }) {
  const table = standings(camp.league.teams);
  const pos = camp.finalPos || (table.findIndex((t) => t.isYou) + 1);
  const me = camp.league.teams.find((t) => t.isYou);
  const advances = pos <= 24;
  const fate = pos <= 8 ? "Top 8 — straight into the Round of 16." : pos <= 24 ? "9th–24th — into the knockout play-off." : "25th or lower — eliminated.";

  function toKnockout() {
    const ko = buildKnockout(table, camp.seed);
    // if you're top 8 there's no play-off for you; the PO round still happens for others.
    onUpdate({ ...camp, phase: "knockout", ko, koStage: "PO", koTies: ko.playoffTies, koAdvancers: ko.top8, activeTie: null });
  }

  return (
    <div className="fade">
      <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>LEAGUE PHASE COMPLETE</p>
      <div className="card" style={{ padding: 18, marginTop: 10, textAlign: "center" }}>
        <Trophy size={28} style={{ color: pos <= 8 ? "var(--green)" : pos <= 24 ? "var(--flame)" : "var(--dim)" }} />
        <div className="display chalk" style={{ fontSize: 30, margin: "6px 0 2px" }}>{pos}{ord(pos)}</div>
        <p className="tele dim" style={{ fontSize: 12, margin: 0 }}>{me.pts} pts · {me.gf}-{me.ga}</p>
        <p className="chalk" style={{ fontSize: 14, fontWeight: 700, margin: "10px 0 0" }}>{fate}</p>
      </div>
      {advances ? (
        <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 12 }} onClick={toKnockout}>
          Into the knockouts →
        </button>
      ) : (
        <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 12 }} onClick={onReset}>
          New campaign
        </button>
      )}
    </div>
  );
}

/* ---------------- knockout hub: play ties leg by leg ---------------- */
function KnockoutScreen({ camp, onUpdate, onReset }) {
  const [ticker, setTicker] = useState(null);  // { tie, legNo, res }
  const [shootout, setShootout] = useState(null); // { tie, resolution }
  const [etScreen, setEtScreen] = useState(null); // { tieId, rl } when ET settles a tie
  const ko = camp.ko;
  const you = camp.you;
  const stage = camp.koStage;
  const ties = camp.koTies || [];

  // find your tie this round (if any) and whether all ties are done
  const myTie = ties.find((t) => t.home.isYou || t.away.isYou);
  const allDone = ties.every((t) => t.done);

  function playLegOf(tieObj, legNo) {
    const res = playLeg(you, tieObj, legNo);
    setTicker({ tieId: tieObj.id, legNo, res });
  }

  function afterLeg() {
    const t = ticker;
    setTicker(null);
    const updTies = ties.map((x) => {
      if (x.id !== t.tieId) return x;
      const nx = { ...x };
      if (t.legNo === 1) nx.leg1 = t.res; else nx.leg2 = t.res;
      return nx;
    });
    onUpdate({ ...camp, koTies: updTies });
  }

  function resolveTie(tieObj) {
    // both legs played; compute aggregate, maybe ET/pens
    const agg = aggregate(tieObj);
    if (agg.level) {
      const rl = resolveLevel(you, tieObj);
      if (rl.pens) { setShootout({ tieId: tieObj.id, rl }); return; }
      // ET settled it — show animated ET before finalising
      setEtScreen({ tieId: tieObj.id, rl });
    } else {
      finalizeTie(tieObj, agg.homeGoals > agg.awayGoals ? tieObj.home.id : tieObj.away.id, null, null);
    }
  }

  function finalizeTie(tieObj, winnerId, et, pens) {
    const updTies = ties.map((x) => x.id === tieObj.id ? { ...x, winnerId, et: et || x.et, pens: pens || x.pens, done: true } : x);
    onUpdate({ ...camp, koTies: updTies });
    setShootout(null);
  }

  function advanceRound() {
    // collect winners, add to advancers, draw next round or play final or crown champion
    const winners = ties.map((t) => (t.winnerId === t.home.id ? t.home : t.away));
    if (stage === "PO") {
      const r16Field = ko.top8.concat(winners);
      const r16 = drawRound(ko, "R16", r16Field);
      onUpdate({ ...camp, koStage: "R16", koTies: r16, koAdvancers: r16Field });
      return;
    }
    if (stage === "SF") {
      // two winners -> final (single leg)
      onUpdate({ ...camp, koStage: "F", finalists: winners, koTies: [], finalResult: null });
      return;
    }
    // R16 -> QF -> SF
    const next = NEXT_ROUND[stage];
    const drawn = drawRound(ko, next, winners);
    onUpdate({ ...camp, koStage: next, koTies: drawn, koAdvancers: winners });
  }

  // ----- FINAL stage handled inline -----
  if (stage === "F") {
    return <FinalScreen camp={camp} you={you} onUpdate={onUpdate} onReset={onReset} />;
  }

  if (ticker) {
    const tieObj = ties.find((t) => t.id === ticker.tieId);
    return <TieLegTicker res={ticker.res} legNo={ticker.legNo} tieObj={tieObj} onDone={afterLeg} />;
  }
  if (etScreen) {
    const tieObj = ties.find((t) => t.id === etScreen.tieId);
    const rl = etScreen.rl;
    const agg = aggregate(tieObj);
    return <GenericTicker
      timeline={[]}
      hg={0} ag={0}
      leftName={tieObj.home.isYou ? "Your XI" : tieObj.home.club}
      rightName={tieObj.away.isYou ? "Your XI" : tieObj.away.club}
      leftTeam={tieObj.home}
      rightTeam={tieObj.away}
      title={ROUND_NAMES[stage].toUpperCase() + " · EXTRA TIME"}
      etTimeline={rl.et ? rl.et.timeline : []}
      scoreOffset={{ left: agg.homeGoals, right: agg.awayGoals }}
      pens={null}
      onDone={() => {
        finalizeTie(tieObj, rl.winnerId, rl.et, null);
        setEtScreen(null);
      }} />;
  }
  if (shootout) {
    const tieObj = ties.find((t) => t.id === shootout.tieId);
    return <ShootoutScreen tieObj={tieObj} rl={shootout.rl} onDone={() => finalizeTie(tieObj, shootout.rl.winnerId, shootout.rl.et, shootout.rl.pens)} />;
  }

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>{ROUND_NAMES[stage].toUpperCase()}</p>
        {myTie ? <span className="tele chalk" style={{ fontSize: 12 }}>{myTie.done ? (myTie.winnerId === "__you" ? "Through ✓" : "Out") : "Your tie"}</span>
               : <span className="tele dim" style={{ fontSize: 12 }}>Watching</span>}
      </div>

      {/* Your tie gets the spotlight card with leg controls */}
      {myTie && <SpotlightTie tieObj={myTie} you={you} onPlayLeg={playLegOf} onResolve={resolveTie} />}

      {/* The rest of the bracket: sim instantly */}
      <OtherTies ties={ties.filter((t) => !(t.home.isYou || t.away.isYou))} you={you} onUpdate={(updated) => {
        const merged = ties.map((t) => updated.find((u) => u.id === t.id) || t);
        onUpdate({ ...camp, koTies: merged });
      }} />

      {allDone && (
        <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 14 }} onClick={advanceRound}>
          {stage === "SF" ? "To the final →" : "Advance to " + ROUND_NAMES[NEXT_ROUND[stage]] + " →"}
        </button>
      )}
      <button className="ghost" style={{ width: "100%", padding: 10, fontSize: 12, marginTop: 10, color: "var(--flame)", borderColor: "var(--flame)" }} onClick={onReset}>
        Abandon campaign
      </button>
    </div>
  );
}

function SpotlightTie({ tieObj, you, onPlayLeg, onResolve }) {
  const need1 = !tieObj.leg1, need2 = tieObj.leg1 && !tieObj.leg2;
  const bothDone = tieObj.leg1 && tieObj.leg2;
  const agg = aggregate(tieObj);
  return (
    <div className="card" style={{ padding: 14, marginTop: 10, border: "2px solid var(--flame)" }}>
      <p className="tele" style={{ fontSize: 10, letterSpacing: 1.5, margin: 0, color: "var(--flame)", fontWeight: 800 }}>YOUR TIE</p>
      <TieHeader tieObj={tieObj} />
      <div className="tele" style={{ fontSize: 12, textAlign: "center", margin: "8px 0", color: "var(--ink2)" }}>
        {tieObj.leg1 && <span>Leg 1: {legScoreText(tieObj, 1)} </span>}
        {tieObj.leg2 && <span>· Leg 2: {legScoreText(tieObj, 2)} </span>}
        {bothDone && <div style={{ marginTop: 4, fontWeight: 800 }}>Aggregate {agg.homeGoals}-{agg.awayGoals}{tieObj.pens ? " · pens " + tieObj.pens.h + "-" + tieObj.pens.a : tieObj.et ? " (after extra time)" : ""}</div>}
      </div>
      {need1 && <button className="btn" style={{ width: "100%", padding: 13, fontSize: 14 }} onClick={() => onPlayLeg(tieObj, 1)}>Play first leg →</button>}
      {need2 && <button className="btn" style={{ width: "100%", padding: 13, fontSize: 14 }} onClick={() => onPlayLeg(tieObj, 2)}>Play second leg →</button>}
      {bothDone && !tieObj.done && <button className="btn" style={{ width: "100%", padding: 13, fontSize: 14 }} onClick={() => onResolve(tieObj)}>See the verdict →</button>}
      {tieObj.done && (
        <p className="display" style={{ textAlign: "center", fontSize: 15, margin: "6px 0 0", color: tieObj.winnerId === "__you" ? "var(--green)" : "var(--flame)" }}>
          {tieObj.winnerId === "__you" ? "You go through" : "You're out"}
        </p>
      )}
    </div>
  );
}

function OtherTies({ ties, you, onUpdate }) {
  function simAll() {
    const done = ties.map((t) => {
      const nt = JSON.parse(JSON.stringify(t));
      nt.leg1 = playLeg(you, nt, 1);
      nt.leg2 = playLeg(you, nt, 2);
      const agg = aggregate(nt);
      if (agg.level) {
        const rl = resolveLevel(you, nt);
        nt.winnerId = rl.winnerId; nt.et = rl.et; nt.pens = rl.pens;
      } else {
        nt.winnerId = agg.homeGoals > agg.awayGoals ? nt.home.id : nt.away.id;
      }
      nt.done = true;
      return nt;
    });
    onUpdate(done);
  }
  const pending = ties.filter((t) => !t.done).length;
  return (
    <div className="card" style={{ padding: "10px 12px", marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="tele dim" style={{ fontSize: 10, letterSpacing: 1.5, margin: 0 }}>ELSEWHERE IN THE DRAW</p>
        {pending > 0 && <button className="ghost" style={{ padding: "5px 9px", fontSize: 11 }} onClick={simAll}>Play {pending} ties</button>}
      </div>
      <div style={{ marginTop: 6 }}>
        {ties.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
            <span className="chalk" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: t.done && t.winnerId === t.home.id ? 800 : 500 }}>{t.home.club}</span>
            <span className="tele dim" style={{ fontSize: 10, padding: "0 8px" }}>
              {t.done ? aggText(t) : "—"}
            </span>
            <span className="chalk" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", fontWeight: t.done && t.winnerId === t.away.id ? 800 : 500 }}>{t.away.club}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalScreen({ camp, you, onUpdate, onReset }) {
  const [finalFlow, setFinalFlow] = useState(null); // { phase:"rt"|"et"|"pens", res }
  const [a, b] = camp.finalists;

  function play() {
    const res = playFinal(you, a, b);
    setFinalFlow({ phase: "rt", res });
  }
  function finishFinal(res) {
    onUpdate({ ...camp, phase: "champion", finalResult: res, championId: res.winnerId });
  }

  if (finalFlow) {
    const res = finalFlow.res;
    const leftName = a.isYou ? "Your XI" : a.club;
    const rightName = b.isYou ? "Your XI" : b.club;
    const levelAfterEt = res.et && (res.hg + res.et.hg === res.ag + res.et.ag);

    if (finalFlow.phase === "rt") {
      return <GenericTicker
        key="final-rt"
        timeline={res.timeline}
        hg={res.hg} ag={res.ag}
        leftName={leftName} rightName={rightName}
        leftTeam={a}
        rightTeam={b}
        title="THE FINAL"
        onDone={() => {
          if (res.hg === res.ag && res.et) setFinalFlow({ phase: "et", res });
          else finishFinal(res);
        }} />;
    }

    if (finalFlow.phase === "et") {
      return <GenericTicker
        key="final-et"
        timeline={[]}
        hg={0} ag={0}
        leftName={leftName} rightName={rightName}
        leftTeam={a}
        rightTeam={b}
        title="THE FINAL · EXTRA TIME"
        etTimeline={res.et ? res.et.timeline : []}
        scoreOffset={{ left: res.hg, right: res.ag }}
        onDone={() => {
          if (levelAfterEt && res.pens) setFinalFlow({ phase: "pens", res });
          else finishFinal(res);
        }} />;
    }

    if (finalFlow.phase === "pens") {
      return <ShootoutScreen tieObj={{ home: a, away: b }} rl={{ pens: res.pens }} onDone={() => finishFinal(res)} />;
    }
  }

  return (
    <div className="fade">
      <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800, textAlign: "center" }}>THE FINAL</p>
      <div className="card" style={{ padding: 18, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          <TeamBadge ref2={a} />
          <span className="display dim" style={{ fontSize: 16 }}>v</span>
          <TeamBadge ref2={b} />
        </div>
        <p className="dim tele" style={{ fontSize: 11, textAlign: "center", margin: "12px 0 0" }}>Single match · neutral venue · extra time and penalties if level</p>
      </div>
      <button className="btn" style={{ width: "100%", padding: 15, fontSize: 16, marginTop: 12 }} onClick={play}>Play the final →</button>
    </div>
  );
}

function TeamBadge({ ref2 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, maxWidth: 120 }}>
      {ref2.isYou ? <YouCrest /> : <Crest kit={ref2.kit} crest={ref2.crest} name={ref2.club} size={36} />}
      <span className="display chalk" style={{ fontSize: 13, textAlign: "center", lineHeight: 1.1 }}>{ref2.isYou ? "Your XI" : ref2.club}</span>
      <span className="tele dim" style={{ fontSize: 10 }}>{ref2.season || "All-Stars"}{opponentCompetitionLabel(ref2) ? " · " + opponentCompetitionLabel(ref2) : ""}</span>
    </div>
  );
}

/* ---------------- champion ---------------- */
function ChampionScreen({ camp, onReset }) {
  const champId = camp.championId;
  const youWon = champId === "__you";
  const fin = camp.finalResult;
  const champ = fin ? (fin.winnerId === fin.aId ? camp.finalists[0] : camp.finalists[1]) : null;
  const [shareMsg, setShareMsg] = useState(null);
  async function doShareCampaign() {
    const champName = champ ? champ.club : null;
    const status = await shareText("Roll XI", campaignShare(null, champName, youWon, camp.formation));
    if (status === "copied") setShareMsg("Copied!");
    else if (status === "shared") setShareMsg("Shared!");
    else if (status === "failed") setShareMsg("Couldn't share");
    if (status !== "cancelled") setTimeout(() => setShareMsg(null), 2000);
  }
  return (
    <div className="fade">
      <div className="card" style={{ padding: 22, marginTop: 10, textAlign: "center", border: youWon ? "2px solid var(--green)" : undefined }}>
        <Trophy size={40} style={{ color: "var(--gold)" }} />
        <div className="display chalk" style={{ fontSize: 26, margin: "8px 0 2px" }}>
          {youWon ? "YOU ARE CHAMPIONS" : (champ ? champ.club + " win it" : "Champions")}
        </div>
        {fin && (
          <p className="tele dim" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Final: {fin.hg}-{fin.ag}{fin.et ? " (ET " + (fin.hg + fin.et.hg) + "-" + (fin.ag + fin.et.ag) + ")" : ""}{fin.pens ? " · pens " + fin.pens.h + "-" + fin.pens.a : ""}
          </p>
        )}
        <p className="chalk" style={{ fontSize: 14, fontWeight: 700, margin: "12px 0 0" }}>
          {youWon ? "From eleven rolled squads to the top of Europe." : "Beaten on the biggest night. Go again?"}
        </p>
      </div>
      <button className="btn" style={{ width: "100%", padding: 13, fontSize: 14, marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }} onClick={doShareCampaign}>
        <Share2 size={15} /> {shareMsg || "Share result"}
      </button>
      <button className="ghost" style={{ width: "100%", padding: 13, fontSize: 14, marginTop: 8 }} onClick={onReset}>New campaign</button>
    </div>
  );
}

/* ---------------- tie + final headers and tickers ---------------- */
function TieHeader({ tieObj }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginTop: 8 }}>
      <TeamBadge ref2={tieObj.home} />
      <span className="display dim" style={{ fontSize: 13 }}>v</span>
      <TeamBadge ref2={tieObj.away} />
    </div>
  );
}
function legScoreText(t, legNo) {
  const leg = legNo === 1 ? t.leg1 : t.leg2;
  if (!leg) return "—";
  // leg.hg is host goals, leg.ag visitor; host of leg1 is away team, leg2 is home team
  return leg.hg + "-" + leg.ag;
}
function aggText(t) {
  const agg = aggregate(t);
  let s = agg.homeGoals + "-" + agg.awayGoals;
  if (t.pens) s += " p" + t.pens.h + "-" + t.pens.a;
  return s;
}

function TieLegTicker({ res, legNo, tieObj, onDone }) {
  const hostRef = legNo === 1 ? tieObj.away : tieObj.home;
  const visitRef = legNo === 1 ? tieObj.home : tieObj.away;
  return <GenericTicker timeline={res.timeline} hg={res.hg} ag={res.ag}
    leftName={hostRef.isYou ? "Your XI" : hostRef.club} rightName={visitRef.isYou ? "Your XI" : visitRef.club}
    leftTeam={hostRef}
    rightTeam={visitRef}
    title={"LEG " + legNo + " · " + (hostRef.isYou ? "HOME" : "AWAY")} onDone={onDone} />;
}
function FinalTicker({ res, a, b, you, onDone }) {
  return <GenericTicker timeline={res.timeline} hg={res.hg} ag={res.ag}
    leftName={a.isYou ? "Your XI" : a.club} rightName={b.isYou ? "Your XI" : b.club}
    leftTeam={a}
    rightTeam={b}
    title="THE FINAL"
    etTimeline={res.et ? res.et.timeline : null}
    pens={res.pens} onDone={onDone} />;
}

/* shared accelerated-clock ticker — handles regular time and optional ET continuation */
function GenericTicker({ timeline, hg, ag, leftName, rightName, leftTeam, rightTeam, title, extra, pens, etTimeline, scoreOffset, onDone }) {
  const allTimeline = React.useMemo(
    () => etTimeline ? [...timeline, ...etTimeline] : timeline,
    [timeline, etTimeline]
  );
  const maxMin = etTimeline ? 120 : 90;
  const clockStart = scoreOffset ? 90 : 0;
  const off = scoreOffset || { left: 0, right: 0 };
  const [minute, setMinute] = useState(clockStart);
  const [shown, setShown] = useState([]);
  const [finished, setFinished] = useState(false);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduce) { setMinute(maxMin); setShown(allTimeline); setFinished(true); return; }
    let m = clockStart;
    const id = setInterval(() => {
      m += 1;
      setMinute(m);
      setShown(allTimeline.filter((e) => e.minute <= m));
      if (m >= maxMin) { clearInterval(id); setFinished(true); }
    }, MATCH_TICK_MS);
    return () => clearInterval(id);
  }, [allTimeline, clockStart, maxMin, reduce]);
  const leftG = off.left + shown.filter((e) => e.side === "home").length;
  const rightG = off.right + shown.filter((e) => e.side === "away").length;
  const minLabel = finished
    ? (etTimeline ? "AET" : "FULL TIME")
    : (minute > 90 ? "ET " + (minute - 90) + "'" : minute + "'");
  const minColor = finished ? "var(--flame)" : (minute > 90 ? "var(--amber)" : "var(--green)");
  return (
    <div className="fade" style={{ paddingTop: 8 }}>
      <p className="tele dim" style={{ fontSize: 11, letterSpacing: 1.5, textAlign: "center", margin: 0 }}>{title}</p>
      <div className="card" style={{ padding: 16, marginTop: 8, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <TeamTickerName team={leftTeam || { club: leftName, isYou: leftName === "Your XI" }} align="right" />
          <span className="tele amber" style={{ fontSize: 34, fontWeight: 800, minWidth: 84 }}>{leftG}-{rightG}</span>
          <TeamTickerName team={rightTeam || { club: rightName, isYou: rightName === "Your XI" }} align="left" />
        </div>
        <div className="tele" style={{ fontSize: 14, marginTop: 8, color: minColor, fontWeight: 800 }}>
          {minLabel}
        </div>
        {finished && extra && <p className="tele dim" style={{ fontSize: 11, margin: "4px 0 0" }}>{extra}</p>}
        {finished && pens && <p className="tele" style={{ fontSize: 12, margin: "4px 0 0", fontWeight: 800, color: "var(--flame)" }}>Penalties {pens.h}-{pens.a}</p>}
      </div>
      <div className="card" style={{ padding: "10px 14px", marginTop: 10, minHeight: 110 }}>
        {shown.length === 0 && <p className="tele dim" style={{ fontSize: 12, margin: 0 }}>Kick-off…</p>}
        {shown.map((e, i) => (
          <p key={i} className="tele fade" style={{ fontSize: 12, margin: "5px 0", display: "flex", justifyContent: e.side === "home" ? "flex-start" : "flex-end", color: e.mine ? "var(--green)" : "var(--ink2)" }}>
            {e.side === "home" ? <span><b>{e.minute}'</b> ⚽ {e.scorer || leftName}</span> : <span style={{ textAlign: "right" }}>{e.scorer || rightName} ⚽ <b>{e.minute}'</b></span>}
          </p>
        ))}
      </div>
      {finished && <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 10 }} onClick={onDone}>Continue →</button>}
    </div>
  );
}

/* penalty shootout, kick by kick */
function ShootoutScreen({ tieObj, rl, onDone }) {
  const [n, setN] = useState(0);
  const kicks = rl.pens.kicks;
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduce) { setN(kicks.length); return; }
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= kicks.length) clearInterval(id); }, SHOOTOUT_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const shown = kicks.slice(0, n);
  const h = shown.filter((k) => k.team === "home" && k.scored).length;
  const a = shown.filter((k) => k.team === "away" && k.scored).length;
  return (
    <div className="fade" style={{ paddingTop: 8 }}>
      <p className="tele" style={{ fontSize: 11, letterSpacing: 1.5, textAlign: "center", margin: 0, color: "var(--flame)", fontWeight: 800 }}>PENALTY SHOOTOUT</p>
      <div className="card" style={{ padding: 16, marginTop: 8, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span className="display chalk" style={{ fontSize: 13, flex: 1, textAlign: "right" }}>{tieObj.home.isYou ? "Your XI" : tieObj.home.club}</span>
          <span className="tele amber" style={{ fontSize: 32, fontWeight: 800, minWidth: 78 }}>{h}-{a}</span>
          <span className="display chalk" style={{ fontSize: 13, flex: 1, textAlign: "left" }}>{tieObj.away.isYou ? "Your XI" : tieObj.away.club}</span>
        </div>
      </div>
      <div className="card" style={{ padding: "10px 14px", marginTop: 10, minHeight: 90 }}>
        {shown.map((k, i) => (
          <p key={i} className="tele fade" style={{ fontSize: 12, margin: "4px 0", display: "flex", justifyContent: k.team === "home" ? "flex-start" : "flex-end" }}>
            <span style={{ color: k.scored ? "var(--green)" : "var(--flame)" }}>
              {k.team === "home" ? "← " : ""}{k.scored ? "Scored" : "Missed"}{k.team === "away" ? " →" : ""}
            </span>
          </p>
        ))}
      </div>
      {n >= kicks.length && <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 10 }} onClick={onDone}>Continue →</button>}
    </div>
  );
}

function ord(n) { return n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"; }
