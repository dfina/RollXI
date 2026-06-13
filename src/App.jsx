import React, { useEffect, useState } from "react";
import { Home, Dice5, BookOpen, Trophy, Link2 } from "lucide-react";
import { loadData } from "./lib/data.js";
import { load, storageAvailable } from "./lib/storage.js";
import { todayKey, dayNumber } from "./lib/date.js";
import Daily from "./modes/Daily.jsx";
import Album from "./modes/Album.jsx";
import Campaign from "./modes/Campaign.jsx";
import Chains from "./modes/Chains.jsx";

const TABS = [
  ["home", "Home", Home],
  ["daily", "Daily", Dice5],
  ["album", "Album", BookOpen],
  ["campaign", "Campaign", Trophy],
  ["chains", "Chains", Link2]
];

export default function App() {
  const [view, setView] = useState("home");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e)));
  }, []);

  const dateKey = todayKey();
  const dailyDone = !!data && Object.keys(load("daily:" + dateKey, { answers: {} }).answers).length >= 6;
  const albumGot = data ? load("album", []).length : 0;

  function HomeView() {
    return (
      <div className="fade">
        <div style={{ padding: "6px 2px 0" }}>
          <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0, fontWeight: 800 }}>EUROPEAN NIGHTS · 1960-2026</p>
          <h1 className="display chalk" style={{ fontSize: 40, lineHeight: 0.98, margin: "6px 0 10px" }}>
            Collect.<br />Draft.<br />Conquer Europe.
          </h1>
          <p className="dim" style={{ fontSize: 13, margin: 0, maxWidth: 360 }}>
            Daily stickers for the album, a Champions League campaign with your hand-built XI,
            and chains through six decades of squads.
          </p>
          <hr className="rule" />
        </div>

        <button className="btn" style={{ width: "100%", padding: "16px 14px", fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => setView("daily")}>
          <span>Daily #{dayNumber(dateKey)}</span>
          <span className="tele" style={{ fontSize: 13, opacity: 0.92 }}>{dailyDone ? "Done · see results →" : "6 stickers up →"}</span>
        </button>
        <button className="ghost" style={{ width: "100%", padding: "14px", fontSize: 14, marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => setView("album")}>
          <span>Sticker album</span>
          <span className="tele dim" style={{ fontSize: 12 }}>{albumGot}/{data ? data.players.length : 0} →</span>
        </button>
        <button className="ghost" style={{ width: "100%", padding: "14px", fontSize: 14, marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => setView("campaign")}>
          <span>Campaign</span>
          <span className="tele dim" style={{ fontSize: 12 }}>chunk A2 →</span>
        </button>

        <p className="dim tele" style={{ fontSize: 11, marginTop: 18, textAlign: "center" }}>
          v0.3 · {data ? data.squads.length : 0} pickable squads · {data ? data.players.length : 0} players · opponent index pending
        </p>
        {!storageAvailable() && (
          <p className="tele" style={{ fontSize: 11, marginTop: 6, textAlign: "center", color: "var(--flame)" }}>
            Storage unavailable: progress lasts this session only.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "14px 14px 84px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px 12px" }}>
        <button onClick={() => setView("home")} aria-label="Home"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <span className="display chalk" style={{ fontSize: 22 }}>ROLL <span className="amber">XI</span></span>
        </button>
        <span className="tele dim" style={{ fontSize: 11 }}>{dateKey}</span>
      </header>

      {err && <p style={{ color: "var(--flame)", fontSize: 13 }}>Data failed to load: {err}</p>}
      {!data && !err && <p className="tele dim" style={{ textAlign: "center", marginTop: 40, fontSize: 13 }}>Loading the squads…</p>}
      {data && (
        view === "home" ? <HomeView /> :
        view === "daily" ? <Daily data={data} onAlbum={() => setView("album")} /> :
        view === "album" ? <Album data={data} /> :
        view === "campaign" ? <Campaign data={data} /> : <Chains />
      )}

      <nav className="navbar" aria-label="Main">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} className={"navbtn" + (view === id ? " on" : "")} onClick={() => setView(id)} aria-label={label}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
