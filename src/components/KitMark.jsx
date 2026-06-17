import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { badgeFor } from "../lib/badges.js";
import { resolveClubCrestUrl } from "../lib/crestResolver.js";

/* Auto-fit: render the full text, then shrink font-size until it fits inside
   the box on up to two lines. Guarantees no truncation and no ellipsis. */
function AutoFitName({ text, maxFont, minFont, box }) {
  const ref = useRef(null);
  const [size, setSize] = useState(maxFont);
  useLayoutEffect(() => {
    setSize(maxFont);
  }, [text, maxFont]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let f = maxFont;
    // shrink until content fits the clamped height/width, or we hit the floor
    el.style.fontSize = f + "px";
    let guard = 0;
    while (guard++ < 60 && f > minFont && (el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5)) {
      f -= 0.5;
      el.style.fontSize = f + "px";
    }
    if (Math.abs(f - size) > 0.01) setSize(f);
  });
  return (
    <span ref={ref} style={{
      flex: "1 1 auto", minWidth: 0, maxHeight: box,
      fontWeight: 900, textTransform: "uppercase", color: "#141414",
      fontSize: size + "px", lineHeight: 1.04,
      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      wordBreak: "break-word"
    }}>{text}</span>
  );
}

/* ---- small logo-with-fallback (club crest OR competition/league badge) ---- */
function LogoMark({ url, colors, short, name, size, round, resolveClub = false }) {
  const [resolvedUrl, setResolvedUrl] = useState(url || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    if (url) {
      setResolvedUrl(url);
      return () => { active = false; };
    }
    setResolvedUrl(null);
    if (resolveClub && name) {
      resolveClubCrestUrl(name).then((next) => {
        if (active && next) setResolvedUrl(next);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [url, name, resolveClub]);

  if (resolvedUrl && !failed) {
    return (
      <img src={resolvedUrl} alt={(name || short) + " logo"} width={size} height={size}
        loading="lazy" decoding="async" referrerPolicy="no-referrer"
        style={{ objectFit: "contain", flexShrink: 0, display: "block" }}
        onError={() => setFailed(true)} />
    );
  }
  // monogram fallback: two-tone mark with the short code
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: round ? "50%" : "18%",
      background: "linear-gradient(135deg, " + colors[0] + " 60%, " + colors[1] + " 60%)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(6, size * 0.34), fontWeight: 900, lineHeight: 1,
      color: colors[1], border: "1px solid rgba(0,0,0,.18)",
      fontFamily: "ui-monospace,Menlo,Consolas,monospace"
    }}>{short.slice(0, 4)}</span>
  );
}

/* Club crest, used elsewhere in the UI (opponent panels, lists). */
export function Crest({ kit, crest, name, size = 28 }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return <LogoMark url={crest} colors={kit} short={initials} name={name} size={size} round={false} resolveClub={true} />;
}

/* ---- Panini-style player sticker ----
   - card fills the whole frame (no outer border)
   - photo (or kit+monogram fallback) on a club-colour backdrop
   - top-left: competition/league logo + season
   - bottom strip: player name (left) and club logo (right), no club name, no position
   Always prefers a real photo when player.photo is set. */
export function Sticker({ player, locked, width = 100 }) {
  const [failed, setFailed] = useState(false);
  const photoH = Math.round(width * 1.16);
  const initials = player.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const badge = badgeFor(player);
  const clubInitials = player.club.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  const nameStripH = Math.round(width * 0.3);

  return (
    <div style={{
      width, borderRadius: Math.round(width * 0.05), overflow: "hidden",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,.25)",
      opacity: locked ? 0.62 : 1,
      filter: locked ? "grayscale(0.5)" : "none"
    }}>
      {/* ---- photo / backdrop area ---- */}
      <div style={{
        position: "relative", width: "100%", height: photoH,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        background: locked
          ? "repeating-linear-gradient(45deg, #d9d2be 0 7px, #cfc7b0 7px 14px)"
          : "linear-gradient(165deg, " + player.kit[0] + " 58%, " + player.kit[1] + " 58%)"
      }}>
        {/* competition / league badge, top-left */}
        {!locked && (
          <div style={{
            position: "absolute", top: 5, left: 5, zIndex: 3,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            background: "rgba(255,255,255,.86)", borderRadius: 5, padding: "2px 4px"
          }}>
            <LogoMark url={badge.logo} colors={badge.colors} short={badge.short} name={badge.label}
              size={Math.round(width * 0.18)} round={false} />
            <span style={{ fontSize: Math.max(5, width * 0.065), fontWeight: 800, color: "#1c1c1c", lineHeight: 1, fontFamily: "ui-monospace,Menlo,monospace" }}>
              {badge.season}
            </span>
          </div>
        )}
        {/* the player image or fallback */}
        {locked ? (
          <span style={{ color: "rgba(60,60,60,.6)", fontSize: width * 0.3, fontWeight: 900 }}>?</span>
        ) : player.photo && !failed ? (
          <img src={player.photo} alt={player.name} width={width} height={photoH}
            style={{ objectFit: "cover", objectPosition: "top center" }} onError={() => setFailed(true)} />
        ) : (
          <span style={{ fontSize: width * 0.4, fontWeight: 900, color: "#0c0c0c", textShadow: "0 0 4px rgba(255,255,255,.55)" }}>
            {initials}
          </span>
        )}
      </div>

      {/* ---- name + club-logo strip ---- */}
      <div style={{
        minHeight: nameStripH, background: "#fff", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: Math.round(width * 0.055) + "px " + Math.round(width * 0.06) + "px", gap: Math.round(width * 0.06)
      }}>
        {locked ? (
          <span style={{ flex: "1 1 auto" }} />
        ) : (
          <AutoFitName text={player.name} maxFont={Math.max(8, width * 0.1)} minFont={6} box={Math.round(width * 0.1 * 2 * 1.04)} />
        )}
        {!locked && (
          <span style={{ flex: "0 0 auto", display: "inline-flex" }}>
            <LogoMark url={player.crest} colors={player.kit} short={clubInitials} name={player.club}
              size={Math.round(width * 0.22)} round={false} resolveClub={true} />
          </span>
        )}
      </div>
    </div>
  );
}
