const API_BASE = "https://en.wikipedia.org";
const CACHE_KEY = "rollxi.crestResolver.v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

const memory = new Map();
const pending = new Map();
let persistentLoaded = false;
let persistent = {};

function stripAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normaliseClubName(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Page-title overrides are used where the Roll XI display name is shortened,
  translated, historically variant, or otherwise likely to resolve to a
  non-football/disambiguation page. The runtime resolver still falls back to a
  Wikipedia search for clubs not listed here.

  UNVERIFIED (2026-08-07): "besiktas", "helsingborg", "rosenborg", "sturm graz"
  and "vicenza" were added from general knowledge, not checked against a live
  Wikipedia fetch (this environment has no web access to wikipedia.org).
  Spot-check these five page titles before relying on them; if wrong, the
  runtime fallback search will likely still find the right page, so this is
  a missed-crest risk, not a broken-crest risk.
*/
export const CREST_PAGE_OVERRIDES = {
  "1 fc koln": "1. FC Köln",
  "1fc koln": "1. FC Köln", // legacy display spelling
  "1860 munich": "TSV 1860 Munich",
  "ac milan": "AC Milan",
  "as monaco": "AS Monaco FC",
  "as roma": "AS Roma",
  "az alkmaar": "AZ Alkmaar",
  "alaves": "Deportivo Alavés",
  "anderlecht": "R.S.C. Anderlecht",
  "antwerp": "Royal Antwerp F.C.",
  "arsenal": "Arsenal F.C.",
  "aston villa": "Aston Villa F.C.",
  "athletic bilbao": "Athletic Bilbao",
  "atletico madrid": "Atlético Madrid",
  "atletico madrid": "Atlético Madrid",
  "austria salzburg": "SV Austria Salzburg",
  "austria wien": "FK Austria Wien",
  "bsc young boys": "BSC Young Boys",
  "barcelona": "FC Barcelona",
  "basel": "FC Basel",
  "bastia": "SC Bastia",
  "bayer leverkusen": "Bayer 04 Leverkusen",
  "bayern munich": "FC Bayern Munich",
  "bayern munchen": "FC Bayern Munich",
  "benfica": "S.L. Benfica",
  "besiktas": "Beşiktaş J.K.",
  "birmingham city": "Birmingham City F.C.",
  "borussia dortmund": "Borussia Dortmund",
  "borussia monchengladbach": "Borussia Mönchengladbach",
  "braga": "S.C. Braga",
  "cfr cluj": "CFR Cluj",
  "cska moscow": "PFC CSKA Moscow",
  "cska sofia": "PFC CSKA Sofia",
  "carl zeiss jena": "FC Carl Zeiss Jena",
  "celta vigo": "RC Celta de Vigo",
  "celtic": "Celtic F.C.",
  "chelsea": "Chelsea F.C.",
  "chievo": "AC ChievoVerona",
  "club brugge": "Club Brugge KV",
  "crystal palace": "Crystal Palace F.C.",
  "deportivo": "Deportivo de La Coruña",
  "deportivo la coruna": "Deportivo de La Coruña",
  "derby county": "Derby County F.C.",
  "dinamo bucharest": "FC Dinamo București",
  "dinamo kiev": "FC Dynamo Kyiv",
  "dinamo zagreb": "GNK Dinamo Zagreb",
  "dnipro": "FC Dnipro",
  "dukla prague": "Dukla Prague",
  "dundee": "Dundee F.C.",
  "dundee united": "Dundee United F.C.",
  "dynamo kyiv": "FC Dynamo Kyiv",
  "dynamo moscow": "FC Dynamo Moscow",
  "eintracht frankfurt": "Eintracht Frankfurt",
  "espanyol": "RCD Espanyol",
  "everton": "Everton F.C.",
  "fc magdeburg": "1. FC Magdeburg",
  "fc nantes": "FC Nantes",
  "fc porto": "FC Porto",
  "fc zurich": "FC Zürich",
  "fenerbahce": "Fenerbahçe S.K. (football)",
  "feyenoord": "Feyenoord",
  "fortuna dusseldorf": "Fortuna Düsseldorf",
  "freiburg": "SC Freiburg",
  "fulham": "Fulham F.C.",
  "galatasaray": "Galatasaray S.K. (football)",
  "girondins bordeaux": "FC Girondins de Bordeaux",
  "glasgow rangers": "Rangers F.C.",
  "gornik zabrze": "Górnik Zabrze",
  "haka": "FC Haka",
  "halmstads bk": "Halmstads BK",
  "hamburg": "Hamburger SV",
  "hamburger sv": "Hamburger SV",
  "hibernian": "Hibernian F.C.",
  "helsingborg": "Helsingborgs IF",
  "ifk gothenburg": "IFK Göteborg",
  "inter": "Inter Milan",
  "ipswich town": "Ipswich Town F.C.",
  "kv mechelen": "K.V. Mechelen",
  "karlsruher sc": "Karlsruher SC",
  "koln": "1. FC Köln",
  "leeds united": "Leeds United F.C.",
  "legia warsaw": "Legia Warsaw",
  "lens": "RC Lens",
  "liverpool": "Liverpool F.C.",
  "lokeren": "K.S.C. Lokeren Oost-Vlaanderen",
  "lokomotive leipzig": "1. FC Lokomotive Leipzig",
  "london xi": "London XI",
  "lyon": "Olympique Lyonnais",
  "msv duisburg": "MSV Duisburg",
  "mtk budapest": "MTK Budapest FC",
  "mallorca": "RCD Mallorca",
  "malmo ff": "Malmö FF",
  "manchester city": "Manchester City F.C.",
  "manchester united": "Manchester United F.C.",
  "marseille": "Olympique de Marseille",
  "middlesbrough": "Middlesbrough F.C.",
  "monaco": "AS Monaco FC",
  "monchengladbach": "Borussia Mönchengladbach",
  "malaga": "Málaga CF",
  "newcastle united": "Newcastle United F.C.",
  "nottingham forest": "Nottingham Forest F.C.",
  "olympiacos": "Olympiacos F.C.",
  "olympique marseille": "Olympique de Marseille",
  "psv eindhoven": "PSV Eindhoven",
  "panathinaikos": "Panathinaikos F.C.",
  "paris saint-germain": "Paris Saint-Germain F.C.",
  "partizan belgrade": "FK Partizan",
  "pasching": "FC Juniors OÖ",
  "porto": "FC Porto",
  "rb leipzig": "RB Leipzig",
  "rangers": "Rangers F.C.",
  "rapid vienna": "SK Rapid Wien",
  "rayo vallecano": "Rayo Vallecano",
  "real betis": "Real Betis",
  "real madrid": "Real Madrid CF",
  "real sociedad": "Real Sociedad",
  "real zaragoza": "Real Zaragoza",
  "rosenborg": "Rosenborg BK",
  "red star belgrade": "Red Star Belgrade",
  "reims": "Stade de Reims",
  "rotor volgograd": "FC Rotor Volgograd",
  "ruch chorzow": "Ruch Chorzów",
  "sc heerenveen": "SC Heerenveen",
  "saint-etienne": "AS Saint-Étienne",
  "schalke 04": "FC Schalke 04",
  "segesta sisak": "HNK Segesta",
  "shakhtar donetsk": "FC Shakhtar Donetsk",
  "sigma olomouc": "SK Sigma Olomouc",
  "slovan bratislava": "ŠK Slovan Bratislava",
  "slovan liberec": "FC Slovan Liberec",
  "sparta prague": "AC Sparta Prague",
  "sturm graz": "SK Sturm Graz",
  "spartak moscow": "FC Spartak Moscow",
  "spartak trnava": "FC Spartak Trnava",
  "sporting cp": "Sporting CP",
  "standard liege": "Standard Liège",
  "standard liege": "Standard Liège",
  "steaua bucharest": "FCSB",
  "stuttgart": "VfB Stuttgart",
  "tottenham hotspur": "Tottenham Hotspur F.C.",
  "twente": "FC Twente",
  "ujpest": "Újpest FC",
  "uniao de leiria": "U.D. Leiria",
  "vasas gyor": "Győri ETO FC",
  "vasas sc": "Vasas SC",
  "vfb stuttgart": "VfB Stuttgart",
  "vfl wolfsburg": "VfL Wolfsburg",
  "videoton": "Fehérvár FC",
  "werder bremen": "SV Werder Bremen",
  "west ham united": "West Ham United F.C.",
  "widzew lodz": "Widzew Łódź",
  "wolverhampton wanderers": "Wolverhampton Wanderers F.C.",
  "zaragoza": "Real Zaragoza",
  "zenit": "FC Zenit Saint Petersburg",
  // Explicitly resolved from the former runtime-search fallback list.
  "aberdeen": "Aberdeen F.C.",
  "ajax": "AFC Ajax",
  "ancona": "US Ancona",
  "ascoli": "Ascoli Calcio 1898 FC",
  "atalanta": "Atalanta BC",
  "auxerre": "AJ Auxerre",
  "bari": "SSC Bari",
  "benevento": "Benevento Calcio",
  "bologna": "Bologna FC 1909",
  "bordeaux": "FC Girondins de Bordeaux",
  "brescia": "Brescia Calcio",
  "cagliari": "Cagliari Calcio",
  "carpi": "AC Carpi",
  "catania": "Catania FC",
  "cesena": "Cesena FC",
  "como": "Como 1907",
  "cremonese": "US Cremonese",
  "crotone": "FC Crotone",
  "dinamo tbilisi": "FC Dinamo Tbilisi",
  "empoli": "Empoli FC",
  "ferencvaros": "Ferencvárosi TC",
  "fiorentina": "ACF Fiorentina",
  "frosinone": "Frosinone Calcio",
  "genoa": "Genoa CFC",
  "guingamp": "En Avant Guingamp",
  "hellas verona": "Hellas Verona FC",
  "juventus": "Juventus FC",
  "lazio": "SS Lazio",
  "lecce": "US Lecce",
  "lille": "Lille OSC",
  "livorno": "US Livorno 1915",
  "messina": "ACR Messina",
  "metz": "FC Metz",
  "modena": "Modena FC 2018",
  "montpellier": "Montpellier HSC",
  "monza": "AC Monza",
  "napoli": "SSC Napoli",
  "novara": "Novara FC",
  "palermo": "Palermo FC",
  "parma": "Parma Calcio 1913",
  "perugia": "AC Perugia Calcio",
  "pescara": "Delfino Pescara 1936",
  "piacenza": "Piacenza Calcio 1919",
  "reggina": "AS Reggina 1914",
  "rennes": "Stade Rennais FC",
  "salernitana": "US Salernitana 1919",
  "sampdoria": "UC Sampdoria",
  "sassuolo": "US Sassuolo Calcio",
  "sevilla": "Sevilla FC",
  "siena": "Siena FC SSD",
  "silkeborg": "Silkeborg IF",
  "spal": "SPAL",
  "spezia": "Spezia Calcio",
  "strasbourg": "RC Strasbourg Alsace",
  "sv hamburg": "Hamburger SV",
  "tirol innsbruck": "FC Tirol Innsbruck",
  "torino": "Torino FC",
  "treviso": "Treviso FBC 1993",
  "troyes": "ES Troyes AC",
  "udinese": "Udinese Calcio",
  "valencia": "Valencia CF",
  "venezia": "Venezia FC",
  "vicenza": "L.R. Vicenza",
  "verona": "Hellas Verona FC",
  "villarreal": "Villarreal CF",
  "vojvodina": "FK Vojvodina",

  // Conference League 2025-26 main-draw additions.
  "aek athens": "AEK Athens F.C.",
  "aek larnaca": "AEK Larnaca FC",
  "breidablik": "Breiðablik men's football",
  "breiðablik": "Breiðablik men's football",
  "celje": "NK Celje",
  "drita": "FC Drita",
  "hacken": "BK Häcken",
  "hamrun spartans": "Hamrun Spartans F.C.",
  "jagiellonia bialystok": "Jagiellonia Białystok",
  "jagiellonia białystok": "Jagiellonia Białystok",
  "kups": "Kuopion Palloseura",
  "lausanne-sport": "FC Lausanne-Sport",
  "lech poznan": "Lech Poznań",
  "lincoln red imps": "Lincoln Red Imps F.C.",
  "mainz": "1. FSV Mainz 05",
  "noah": "FC Noah",
  "omonia": "AC Omonia",
  "rakow czestochowa": "Raków Częstochowa",
  "rijeka": "HNK Rijeka",
  "samsunspor": "Samsunspor",
  "shamrock rovers": "Shamrock Rovers F.C.",
  "shelbourne": "Shelbourne F.C.",
  "shkendija": "KF Shkëndija",
  "universitatea craiova": "CS Universitatea Craiova",
  "zrinjski mostar": "HŠK Zrinjski Mostar",

  // Conference League 2023-24 main-draw additions.
  "ballkani": "FC Ballkani",
  "bodo/glimt": "FK Bodø/Glimt",
  "bodø/glimt": "FK Bodø/Glimt",
  "cukaricki": "FK Čukarički",
  "genk": "K.R.C. Genk",
  "ki klaksvik": "KÍ Klaksvík",
  "ludogorets": "PFC Ludogorets Razgrad",
  "maccabi tel aviv": "Maccabi Tel Aviv F.C.",
  "nordsjaelland": "FC Nordsjælland",
  "nordsjælland": "FC Nordsjælland",
  "paok": "PAOK FC",
  "viktoria plzen": "FC Viktoria Plzeň",
  "zorya luhansk": "FC Zorya Luhansk",

  // Conference League 2024-25 main-draw additions.
  "apoel": "APOEL FC",
  "astana": "FC Astana",
  "borac banja luka": "FK Borac Banja Luka",
  "cercle brugge": "Cercle Brugge K.S.V.",
  "copenhagen": "F.C. Copenhagen",
  "dinamo minsk": "FC Dinamo Minsk",
  "djurgarden": "Djurgårdens IF Fotboll",
  "gent": "KAA Gent",
  "hearts": "Heart of Midlothian F.C.",
  "heidenheim": "1. FC Heidenheim",
  "hjk helsinki": "Helsingin Jalkapalloklubi",
  "istanbul basaksehir": "İstanbul Başakşehir F.K.",
  "larne": "Larne F.C.",
  "lask": "LASK",
  "lugano": "FC Lugano",
  "mlada boleslav": "FK Mladá Boleslav",
  "molde": "Molde FK",
  "olimpija ljubljana": "NK Olimpija Ljubljana (2005)",
  "pafos": "Pafos FC",
  "petrocub": "FC Petrocub Hîncești",
  "st gallen": "FC St. Gallen",
  "the new saints": "The New Saints F.C.",
  "tsc backa topola": "FK TSC",
  "vikingur reykjavik": "Knattspyrnufélagið Víkingur",
  "vitoria guimaraes": "Vitória S.C.",

};

function loadPersistent() {
  if (persistentLoaded) return;
  persistentLoaded = true;
  if (typeof window === "undefined") return;
  try {
    persistent = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    persistent = {};
  }
}

function savePersistent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(persistent));
  } catch {
    // Ignore quota/private-mode failures. The in-memory cache still works.
  }
}

function cached(key) {
  loadPersistent();
  const now = Date.now();
  if (memory.has(key)) return memory.get(key);
  const row = persistent[key];
  if (row && now - row.t < TTL_MS) {
    memory.set(key, row.url || null);
    return row.url || null;
  }
  return undefined;
}

function setCached(key, url) {
  memory.set(key, url || null);
  persistent[key] = { url: url || null, t: Date.now() };
  savePersistent();
}

async function fetchJson(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function imageFromSummary(summary) {
  if (!summary || summary.type === "disambiguation") return null;
  return summary.thumbnail?.source || summary.originalimage?.source || null;
}

async function summaryImageForTitle(title) {
  const url = API_BASE + "/api/rest_v1/page/summary/" + encodeURIComponent(title);
  const summary = await fetchJson(url);
  return imageFromSummary(summary);
}

async function searchTitleForClub(club) {
  const q = club + " football club";
  const url = API_BASE + "/w/api.php?origin=*&action=opensearch&namespace=0&limit=1&format=json&search=" + encodeURIComponent(q);
  const out = await fetchJson(url);
  return Array.isArray(out) && out[1] && out[1][0] ? out[1][0] : null;
}

export function preferredWikiTitleForClub(club) {
  const key = normaliseClubName(club);
  return CREST_PAGE_OVERRIDES[key] || club;
}

export async function resolveClubCrestUrl(club) {
  const key = normaliseClubName(club);
  if (!key) return null;

  const known = cached(key);
  if (known !== undefined) return known;
  if (pending.has(key)) return pending.get(key);

  const task = (async () => {
    let url = null;
    const preferredTitle = preferredWikiTitleForClub(club);
    try {
      url = await summaryImageForTitle(preferredTitle);
    } catch {
      url = null;
    }
    if (!url) {
      try {
        const title = await searchTitleForClub(club);
        if (title) url = await summaryImageForTitle(title);
      } catch {
        url = null;
      }
    }
    setCached(key, url);
    pending.delete(key);
    return url;
  })();

  pending.set(key, task);
  return task;
}
