/* Share helper: uses the native share sheet on mobile (navigator.share),
   falls back to clipboard, then to a manual-select prompt. Returns a status
   string the UI can show: "shared" | "copied" | "failed". */
export async function shareText(title, text) {
  // Web Share API (best on phones)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      // user cancelled or share failed; fall through to copy
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  // Clipboard
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return "copied";
    } catch (e2) {
      return "failed";
    }
  }
}

const BASE = "https://claude.ai"; /* placeholder; replaced by the live URL when known */

/* ---- result formatters (spoiler-free where it matters) ---- */
export function dailyTriviaShare(dayNum, score, total) {
  const blocks = "🟩".repeat(score) + "⬜".repeat(Math.max(0, total - score));
  return "Roll XI · Daily Trivia #" + dayNum + "\n" + blocks + "  " + score + "/" + total + "\nGuess the players, fill the album.";
}

export function chainShare(dayNum, steps, optimal, usedHint) {
  const star = steps === optimal ? "🎯" : "🔗";
  return "Roll XI · Daily Chain #" + dayNum + "\n" + star + " linked in " + steps + (steps === optimal ? " (shortest!)" : " · best " + optimal) + (usedHint ? " · hint" : "") + "\nConnect the players through shared squads.";
}

export function campaignShare(finalPos, championName, youWon, formation) {
  if (youWon) {
    return "Roll XI · Campaign 🏆\nMy hand-built XI (" + formation + ") won it all — champions of Europe!";
  }
  if (finalPos) {
    return "Roll XI · Campaign\nMy XI (" + formation + ") finished " + finalPos + " in the league phase.\n" + (championName ? championName + " went on to win it." : "");
  }
  return "Roll XI · Campaign\n" + (championName || "Someone") + " are champions of Europe.";
}
