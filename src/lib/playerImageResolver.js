const EN_WIKI = "https://en.wikipedia.org";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_FILE_REDIRECT = "https://commons.wikimedia.org/wiki/Special:Redirect/file/";
const CACHE_KEY = "rollxi.playerImageResolver.v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

const memory = new Map();
const pending = new Map();
let persistentLoaded = false;
let persistent = {};

function stripAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalisePlayerName(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadPersistent() {
  if (persistentLoaded) return;
  persistentLoaded = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    persistent = raw ? JSON.parse(raw) : {};
  } catch (e) {
    persistent = {};
  }
}

function savePersistent() {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(persistent));
  } catch (e) {}
}

function cacheKey(kind, player) {
  const name = typeof player === "string" ? player : player.name;
  if (kind === "season" && typeof player !== "string") {
    return "season:" + [player.squadId || "", player.club || "", player.season || "", name || ""].map(normalisePlayerName).join("|");
  }
  return "canonical:" + normalisePlayerName(name);
}

function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  loadPersistent();
  const entry = persistent[key];
  if (!entry) return undefined;
  if (Date.now() - entry.t > TTL_MS) {
    delete persistent[key];
    savePersistent();
    return undefined;
  }
  memory.set(key, entry.v || null);
  return entry.v || null;
}

function writeCache(key, value) {
  const v = value || null;
  memory.set(key, v);
  loadPersistent();
  persistent[key] = { t: Date.now(), v };
  savePersistent();
  return v;
}

function directPhoto(player, seasonAware = false) {
  if (!player || typeof player === "string") return null;
  if (seasonAware && player.seasonPhoto) return player.seasonPhoto;
  return player.photo || player.canonicalPhoto || null;
}

function photoUrlFromCommonsFile(fileName, width = 360) {
  if (!fileName) return null;
  const clean = String(fileName).replace(/^File:/i, "").trim().replace(/ /g, "_");
  return COMMONS_FILE_REDIRECT + encodeURIComponent(clean) + "?width=" + width;
}

function likelyFootballer(entity, player) {
  const desc = String(entity?.description || "").toLowerCase();
  const label = normalisePlayerName(entity?.label || "");
  const name = normalisePlayerName(typeof player === "string" ? player : player.name);
  const surname = name.split(" ").slice(-1)[0];
  const footballish = /football|soccer/.test(desc);
  const nameish = label === name || (surname && label.includes(surname));
  return footballish && nameish;
}

function titleCandidates(player) {
  const name = typeof player === "string" ? player : player.name;
  const club = typeof player === "string" ? "" : (player.club || "");
  const season = typeof player === "string" ? "" : (player.season || "");
  const nat = typeof player === "string" ? "" : (player.nat || "");
  const base = [
    name + " footballer",
    name + " (footballer)",
    name
  ];
  if (club) base.unshift(name + " " + club + " footballer");
  if (season && club) base.unshift(name + " " + club + " " + season + " footballer");
  if (nat) base.push(name + " " + nat + " footballer");
  return [...new Set(base.map((x) => x.trim()).filter(Boolean))];
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function wikipediaSummary(title) {
  try {
    const data = await fetchJson(EN_WIKI + "/api/rest_v1/page/summary/" + encodeURIComponent(title));
    if (data?.type === "disambiguation") return null;
    const thumb = data?.thumbnail?.source || data?.originalimage?.source || null;
    const desc = String(data?.description || data?.extract || "").toLowerCase();
    if (thumb && /football|soccer/.test(desc)) return thumb;
  } catch (e) {}
  return null;
}

async function searchWikipedia(player) {
  for (const q of titleCandidates(player)) {
    try {
      const data = await fetchJson(EN_WIKI + "/w/rest.php/v1/search/page?q=" + encodeURIComponent(q) + "&limit=5");
      const pages = data?.pages || [];
      for (const page of pages) {
        const hay = String([page.title, page.description, page.excerpt].join(" ")).toLowerCase();
        if (!/football|soccer/.test(hay)) continue;
        const viaSummary = await wikipediaSummary(page.title);
        if (viaSummary) return viaSummary;
        if (page.thumbnail?.url) return page.thumbnail.url.startsWith("//") ? "https:" + page.thumbnail.url : page.thumbnail.url;
      }
    } catch (e) {}
  }
  return null;
}

async function searchWikidata(player) {
  for (const q of titleCandidates(player)) {
    try {
      const search = await fetchJson(WIKIDATA_API + "?origin=*&action=wbsearchentities&language=en&format=json&limit=5&search=" + encodeURIComponent(q));
      const entities = (search?.search || []).filter((e) => likelyFootballer(e, player));
      for (const entity of entities) {
        const id = entity.id;
        const data = await fetchJson("https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(id) + ".json");
        const item = data?.entities?.[id];
        const p18 = item?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (p18) return photoUrlFromCommonsFile(p18);
        const title = item?.sitelinks?.enwiki?.title;
        if (title) {
          const viaSummary = await wikipediaSummary(title);
          if (viaSummary) return viaSummary;
        }
      }
    } catch (e) {}
  }
  return null;
}

async function resolve(kind, player) {
  const direct = directPhoto(player, kind === "season");
  if (direct) return direct;
  const key = cacheKey(kind, player);
  const cached = readCache(key);
  if (cached !== undefined) return cached;
  if (pending.has(key)) return pending.get(key);

  const task = (async () => {
    const wd = await searchWikidata(player);
    if (wd) return writeCache(key, wd);
    const wp = await searchWikipedia(player);
    return writeCache(key, wp || null);
  })().finally(() => pending.delete(key));

  pending.set(key, task);
  return task;
}

export function resolveCanonicalPlayerPhoto(player) {
  return resolve("canonical", player);
}

export function resolveSeasonPlayerPhoto(player) {
  return resolve("season", player);
}
