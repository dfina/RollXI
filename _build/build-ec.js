// Build the verified European Cup / Champions League opponent pack.
// Source: myfootballfacts.com finals + both semi-finalists, 1955-56..2025-26,
// cross-checked against Wikipedia for the early editions.
// Each season contributes up to 4 club-seasons: Winner, Runner-up, SF (lost to W), SF (lost to RU).
// EC = European Cup (pre 1992-93), UCL = Champions League (from 1992-93).

// Verified roll of honour: [season, winner, runnerUp, sfWinnerSide, sfRunnerUpSide]
const ROLL = [
  ["1955-56","Real Madrid","Reims","AC Milan","Hibernian"],
  ["1956-57","Real Madrid","Fiorentina","Manchester United","Red Star Belgrade"],
  ["1957-58","Real Madrid","AC Milan","Vasas SC","Manchester United"],
  ["1958-59","Real Madrid","Reims","Atletico Madrid","BSC Young Boys"],
  ["1959-60","Real Madrid","Eintracht Frankfurt","Barcelona","Glasgow Rangers"],
  ["1960-61","Benfica","Barcelona","Rapid Vienna","SV Hamburg"],
  ["1961-62","Benfica","Real Madrid","Tottenham Hotspur","Standard Liege"],
  ["1962-63","AC Milan","Benfica","Dundee","Feyenoord"],
  ["1963-64","Inter","Real Madrid","Borussia Dortmund","FC Zurich"],
  ["1964-65","Inter","Benfica","Liverpool","Vasas Gyor"],
  ["1965-66","Real Madrid","Partizan Belgrade","Inter","Manchester United"],
  ["1966-67","Celtic","Inter","Dukla Prague","CSKA Sofia"],
  ["1967-68","Manchester United","Benfica","Real Madrid","Juventus"],
  ["1968-69","AC Milan","Ajax","Manchester United","Spartak Trnava"],
  ["1969-70","Feyenoord","Celtic","Legia Warsaw","Leeds United"],
  ["1970-71","Ajax","Panathinaikos","Atletico Madrid","Red Star Belgrade"],
  ["1971-72","Ajax","Inter","Benfica","Celtic"],
  ["1972-73","Ajax","Juventus","Real Madrid","Derby County"],
  ["1973-74","Bayern Munich","Atletico Madrid","Ujpest","Celtic"],
  ["1974-75","Bayern Munich","Leeds United","Saint-Etienne","Barcelona"],
  ["1975-76","Bayern Munich","Saint-Etienne","Real Madrid","PSV Eindhoven"],
  ["1976-77","Liverpool","Borussia Monchengladbach","FC Zurich","Dinamo Kiev"],
  ["1977-78","Liverpool","Club Brugge","Borussia Monchengladbach","Juventus"],
  ["1978-79","Nottingham Forest","Malmo FF","1.FC Koln","Austria Wien"],
  ["1979-80","Nottingham Forest","SV Hamburg","Ajax","Real Madrid"],
  ["1980-81","Liverpool","Real Madrid","Bayern Munich","Inter"],
  ["1981-82","Aston Villa","Bayern Munich","Anderlecht","CSKA Sofia"],
  ["1982-83","SV Hamburg","Juventus","Real Sociedad","Widzew Lodz"],
  ["1983-84","Liverpool","AS Roma","Dinamo Bucharest","Dundee United"],
  ["1984-85","Juventus","Liverpool","Girondins Bordeaux","Panathinaikos"],
  ["1985-86","Steaua Bucharest","Barcelona","Anderlecht","IFK Gothenburg"],
  ["1986-87","FC Porto","Bayern Munich","Dinamo Kiev","Real Madrid"],
  ["1987-88","PSV Eindhoven","Benfica","Real Madrid","Steaua Bucharest"],
  ["1988-89","AC Milan","Steaua Bucharest","Real Madrid","Galatasaray"],
  ["1989-90","AC Milan","Benfica","Bayern Munich","Olympique Marseille"],
  ["1990-91","Red Star Belgrade","Olympique Marseille","Bayern Munich","Spartak Moscow"],
  ["1991-92","Barcelona","Sampdoria","Sparta Prague","Red Star Belgrade"],
  ["1992-93","Olympique Marseille","AC Milan","Glasgow Rangers","IFK Gothenburg"],
  ["1993-94","AC Milan","Barcelona","AS Monaco","FC Porto"],
  ["1994-95","Ajax","AC Milan","Bayern Munich","Paris Saint-Germain"],
  ["1995-96","Juventus","Ajax","FC Nantes","Panathinaikos"],
  ["1996-97","Borussia Dortmund","Juventus","Manchester United","Ajax"],
  ["1997-98","Real Madrid","Juventus","Borussia Dortmund","AS Monaco"],
  ["1998-99","Manchester United","Bayern Munich","Juventus","Dinamo Kiev"],
  ["1999-00","Real Madrid","Valencia","Bayern Munich","Barcelona"],
  ["2000-01","Bayern Munich","Valencia","Real Madrid","Leeds United"],
  ["2001-02","Real Madrid","Bayer Leverkusen","Barcelona","Manchester United"],
  ["2002-03","AC Milan","Juventus","Inter","Real Madrid"],
  ["2003-04","FC Porto","AS Monaco","Deportivo La Coruna","Chelsea"],
  ["2004-05","Liverpool","AC Milan","Chelsea","PSV Eindhoven"],
  ["2005-06","Barcelona","Arsenal","AC Milan","Villarreal"],
  ["2006-07","AC Milan","Liverpool","Manchester United","Chelsea"],
  ["2007-08","Manchester United","Chelsea","Barcelona","Liverpool"],
  ["2008-09","Barcelona","Manchester United","Chelsea","Arsenal"],
  ["2009-10","Inter","Bayern Munich","Barcelona","Lyon"],
  ["2010-11","Barcelona","Manchester United","Real Madrid","Schalke 04"],
  ["2011-12","Chelsea","Bayern Munich","Barcelona","Real Madrid"],
  ["2012-13","Bayern Munich","Borussia Dortmund","Barcelona","Real Madrid"],
  ["2013-14","Real Madrid","Atletico Madrid","Bayern Munich","Chelsea"],
  ["2014-15","Barcelona","Juventus","Bayern Munich","Real Madrid"],
  ["2015-16","Real Madrid","Atletico Madrid","Manchester City","Bayern Munich"],
  ["2016-17","Real Madrid","Juventus","Atletico Madrid","AS Monaco"],
  ["2017-18","Real Madrid","Liverpool","Bayern Munich","AS Roma"],
  ["2018-19","Liverpool","Tottenham Hotspur","Barcelona","Ajax"],
  ["2019-20","Bayern Munich","Paris Saint-Germain","Lyon","RB Leipzig"],
  ["2020-21","Chelsea","Manchester City","Real Madrid","Paris Saint-Germain"],
  ["2021-22","Real Madrid","Liverpool","Manchester City","Villarreal"],
  ["2022-23","Manchester City","Inter","Real Madrid","AC Milan"],
  ["2023-24","Real Madrid","Borussia Dortmund","Bayern Munich","Paris Saint-Germain"],
  ["2024-25","Paris Saint-Germain","Inter","Arsenal","Barcelona"],
  ["2025-26","Paris Saint-Germain","Arsenal","Bayern Munich","Atletico Madrid"]
];

// club metadata: canonical id stem, country, kit [bg,fg], and a few signature
// scorers (era-agnostic club legends; used for the match ticker flavour).
const CLUB = {
  "Real Madrid":        {id:"rma", country:"Spain", kit:["#FFFFFF","#C9A227"], sc:["Di Stéfano","Puskás","Gento","Raúl","Ronaldo"]},
  "Reims":              {id:"reims", country:"France", kit:["#E30613","#FFFFFF"], sc:["Kopa","Fontaine","Piantoni"]},
  "AC Milan":           {id:"acm", country:"Italy", kit:["#D50000","#000000"], sc:["van Basten","Gullit","Shevchenko","Kaká"]},
  "Hibernian":          {id:"hibs", country:"Scotland", kit:["#005000","#FFFFFF"], sc:["Reilly","Turnbull"]},
  "Fiorentina":         {id:"fio", country:"Italy", kit:["#592C82","#FFFFFF"], sc:["Hamrin","Batistuta"]},
  "Manchester United":  {id:"mun", country:"England", kit:["#DA291C","#000000"], sc:["Charlton","Best","Law","Cantona"]},
  "Red Star Belgrade":  {id:"rsb", country:"Yugoslavia", kit:["#E4002B","#FFFFFF"], sc:["Pančev","Savićević","Mihajlović"]},
  "Vasas SC":           {id:"vasas", country:"Hungary", kit:["#E4002B","#003DA5"], sc:["Csordás","Szilágyi"]},
  "Atletico Madrid":    {id:"atm", country:"Spain", kit:["#CB3524","#FFFFFF"], sc:["Luis Aragonés","Griezmann","Torres"]},
  "BSC Young Boys":     {id:"yb", country:"Switzerland", kit:["#FFD200","#000000"], sc:["Meier","Hügi"]},
  "Eintracht Frankfurt":{id:"sge", country:"Germany", kit:["#E1000F","#000000"], sc:["Pirmann","Stein"]},
  "Barcelona":          {id:"bar", country:"Spain", kit:["#A50044","#004D98"], sc:["Kubala","Cruyff","Messi","Ronaldinho"]},
  "Glasgow Rangers":    {id:"rfc", country:"Scotland", kit:["#1B458F","#FFFFFF"], sc:["Millar","Brand","McCoist"]},
  "Benfica":            {id:"ben", country:"Portugal", kit:["#E30613","#FFFFFF"], sc:["Eusébio","Coluna","Águas"]},
  "Tottenham Hotspur":  {id:"tot", country:"England", kit:["#FFFFFF","#132257"], sc:["Greaves","Blanchflower","Kane"]},
  "Standard Liege":     {id:"std", country:"Belgium", kit:["#E30613","#FFFFFF"], sc:["Goethals","Piters"]},
  "Dundee":             {id:"dun", country:"Scotland", kit:["#003087","#FFFFFF"], sc:["Gilzean","Cousin"]},
  "Feyenoord":          {id:"fey", country:"Netherlands", kit:["#E30613","#FFFFFF"], sc:["Kindvall","Cruyff","van Hanegem"]},
  "Inter":              {id:"int", country:"Italy", kit:["#1E71B8","#000000"], sc:["Mazzola","Suárez","Milito","Eto'o"]},
  "Borussia Dortmund":  {id:"bvb", country:"Germany", kit:["#FDE100","#000000"], sc:["Lewandowski","Riedle","Reus"]},
  "FC Zurich":          {id:"fcz", country:"Switzerland", kit:["#FFFFFF","#1B458F"], sc:["Künzli","Martinelli"]},
  "Liverpool":          {id:"liv", country:"England", kit:["#C8102E","#FFFFFF"], sc:["Dalglish","Rush","Gerrard","Salah"]},
  "Vasas Gyor":         {id:"gyor", country:"Hungary", kit:["#008C44","#FFFFFF"], sc:["Korsós","Mészöly"]},
  "Partizan Belgrade":  {id:"par", country:"Yugoslavia", kit:["#000000","#FFFFFF"], sc:["Galić","Vasović"]},
  "Celtic":             {id:"cel", country:"Scotland", kit:["#018749","#FFFFFF"], sc:["Chalmers","McNeill","Larsson"]},
  "Dukla Prague":       {id:"duk", country:"Czechoslovakia", kit:["#7A0019","#FFD200"], sc:["Masopust","Kučera"]},
  "CSKA Sofia":         {id:"cska", country:"Bulgaria", kit:["#E4002B","#FFFFFF"], sc:["Asparuhov","Yakimov"]},
  "Juventus":           {id:"juv", country:"Italy", kit:["#000000","#FFFFFF"], sc:["Platini","Del Piero","Baggio","Boniperti"]},
  "Ajax":               {id:"aja", country:"Netherlands", kit:["#D2122E","#FFFFFF"], sc:["Cruyff","Rep","Kluivert","van Basten"]},
  "Spartak Trnava":     {id:"trn", country:"Czechoslovakia", kit:["#E30613","#000000"], sc:["Adamec","Kuna"]},
  "Legia Warsaw":       {id:"leg", country:"Poland", kit:["#FFFFFF","#018749"], sc:["Deyna","Pieszko"]},
  "Leeds United":       {id:"lee", country:"England", kit:["#FFFFFF","#1D428A"], sc:["Lorimer","Jones","Clarke"]},
  "Panathinaikos":      {id:"pao", country:"Greece", kit:["#018749","#FFFFFF"], sc:["Antoniadis","Domazos"]},
  "Bayern Munich":      {id:"bay", country:"Germany", kit:["#DC052D","#FFFFFF"], sc:["Müller","Hoeneß","Lewandowski","Robben"]},
  "Saint-Etienne":      {id:"ase", country:"France", kit:["#009639","#FFFFFF"], sc:["Rocheteau","H. Revelli","Larqué"]},
  "PSV Eindhoven":      {id:"psv", country:"Netherlands", kit:["#ED1C24","#FFFFFF"], sc:["Kieft","R. Koeman","Romário"]},
  "Borussia Monchengladbach":{id:"bmg", country:"Germany", kit:["#000000","#FFFFFF"], sc:["Heynckes","Simonsen","Stielike"]},
  "Dinamo Kiev":        {id:"dki", country:"Soviet Union", kit:["#FFFFFF","#0057B7"], sc:["Blokhin","Belanov"]},
  "Club Brugge":        {id:"clb", country:"Belgium", kit:["#0066B3","#000000"], sc:["Lambert","Ku Simon"]},
  "Malmo FF":           {id:"mff", country:"Sweden", kit:["#6CACE4","#FFFFFF"], sc:["Kindvall","Cervin"]},
  "1.FC Koln":          {id:"koln", country:"Germany", kit:["#E30613","#FFFFFF"], sc:["Müller","Allofs","Littbarski"]},
  "Austria Wien":       {id:"aut", country:"Austria", kit:["#7A2E8A","#FFFFFF"], sc:["Schachner","Prohaska"]},
  "Aston Villa":        {id:"avl", country:"England", kit:["#7A003C","#95BFE5"], sc:["Withe","Shaw","Morley"]},
  "Anderlecht":         {id:"and", country:"Belgium", kit:["#5A2A82","#FFFFFF"], sc:["Coeck","Vandenbergh","Nilis"]},
  "Real Sociedad":      {id:"rso", country:"Spain", kit:["#0067B1","#FFFFFF"], sc:["Satrústegui","López Ufarte"]},
  "Widzew Lodz":        {id:"wlo", country:"Poland", kit:["#E30613","#FFFFFF"], sc:["Boniek","Smolarek"]},
  "AS Roma":            {id:"rom", country:"Italy", kit:["#8E1F2F","#F0BC42"], sc:["Pruzzo","Conti","Totti"]},
  "Dinamo Bucharest":   {id:"dbu", country:"Romania", kit:["#E4002B","#FFFFFF"], sc:["Dudu Georgescu","Rednic"]},
  "Dundee United":      {id:"dut", country:"Scotland", kit:["#FF6600","#000000"], sc:["Sturrock","Dodds"]},
  "Girondins Bordeaux": {id:"gbx", country:"France", kit:["#000080","#FFFFFF"], sc:["Giresse","Tigana","Lacombe"]},
  "Steaua Bucharest":   {id:"ste", country:"Romania", kit:["#0033A0","#E4002B"], sc:["Pițurcă","Lăcătuș","Hagi"]},
  "IFK Gothenburg":     {id:"ifk", country:"Sweden", kit:["#0057B7","#FFFFFF"], sc:["Nilsson","Pettersson"]},
  "FC Porto":           {id:"por", country:"Portugal", kit:["#003DA5","#FFFFFF"], sc:["Madjer","Futre","Deco","Derlei"]},
  "Galatasaray":        {id:"gal", country:"Turkey", kit:["#A90432","#FBE122"], sc:["Hagi","Hakan Şükür"]},
  "Olympique Marseille":{id:"om", country:"France", kit:["#2FAEE0","#FFFFFF"], sc:["Papin","Boli","Waddle"]},
  "Spartak Moscow":     {id:"spm", country:"Soviet Union", kit:["#E4002B","#FFFFFF"], sc:["Rodionov","Cherenkov"]},
  "Sampdoria":          {id:"sam", country:"Italy", kit:["#003C7D","#FFFFFF"], sc:["Vialli","Mancini","Mihajlović"]},
  "Sparta Prague":      {id:"spp", country:"Czechoslovakia", kit:["#7A0019","#FFD200"], sc:["Siegl","Skuhravý"]},
  "AS Monaco":          {id:"mon", country:"France", kit:["#E30613","#FFFFFF"], sc:["Mbappé","Falcao","Tévez"]},
  "FC Nantes":          {id:"nan", country:"France", kit:["#FFD200","#009639"], sc:["Loko","Pedros","Ouédec"]},
  "Paris Saint-Germain":{id:"psg", country:"France", kit:["#004170","#E30613"], sc:["Mbappé","Weah","Raí","Ronaldinho"]},
  "Valencia":           {id:"val", country:"Spain", kit:["#FFFFFF","#EE3524"], sc:["Mendieta","Mista","Villa"]},
  "Bayer Leverkusen":   {id:"b04", country:"Germany", kit:["#E32219","#000000"], sc:["Ballack","Neuville","Kirsten"]},
  "Deportivo La Coruna":{id:"dep", country:"Spain", kit:["#0057B7","#FFFFFF"], sc:["Tristán","Valerón","Makaay"]},
  "Chelsea":            {id:"che", country:"England", kit:["#034694","#FFFFFF"], sc:["Drogba","Lampard","Hasselbaink"]},
  "Arsenal":            {id:"ars", country:"England", kit:["#EF0107","#FFFFFF"], sc:["Henry","Bergkamp","Wright"]},
  "Villarreal":         {id:"vil", country:"Spain", kit:["#FFE667","#005187"], sc:["Riquelme","Forlán","Senna"]},
  "Lyon":               {id:"lyo", country:"France", kit:["#FFFFFF","#DA001A"], sc:["Juninho","Benzema","Lacazette"]},
  "Schalke 04":         {id:"s04", country:"Germany", kit:["#004D9D","#FFFFFF"], sc:["Raúl","Kuranyi","Farfán"]},
  "Manchester City":    {id:"mci", country:"England", kit:["#6CABDD","#FFFFFF"], sc:["Agüero","Haaland","De Bruyne"]},
  "RB Leipzig":         {id:"rbl", country:"Germany", kit:["#DD0741","#FFFFFF"], sc:["Werner","Poulsen","Nkunku"]},
  "Rapid Vienna":       {id:"rap", country:"Austria", kit:["#006A33","#FFFFFF"], sc:["Hanappi","Krankl"]},
  "SV Hamburg":         {id:"hsv", country:"Germany", kit:["#FFFFFF","#003DA5"], sc:["Keegan","Hrubesch","Magath"]},
  "Ujpest":             {id:"ujp", country:"Hungary", kit:["#522D6D","#FFFFFF"], sc:["Bene","Göröcs"]},
  "Derby County":       {id:"der", country:"England", kit:["#FFFFFF","#000000"], sc:["Hector","O'Hare","Gemmill"]},
  "Nottingham Forest":  {id:"nfo", country:"England", kit:["#E53233","#FFFFFF"], sc:["Birtles","Woodcock","Robertson"]}
};

// era-based baseline rating for an opponent club-season; finalists slightly higher
function ratingFor(role, seasonStartYear) {
  // base by role
  let base = role === "W" ? 88 : role === "RU" ? 86 : 84;
  // modern era clubs a touch stronger in our scale; older eras compress slightly
  if (seasonStartYear >= 2000) base += 1;
  if (seasonStartYear < 1970) base -= 1;
  return Math.max(78, Math.min(92, base));
}

const out = {};
function add(club, season, role, comp, isGroupRunnerUp) {
  const meta = CLUB[club];
  if (!meta) { throw new Error("Missing club metadata: " + club); }
  const y = parseInt(season.slice(0, 4), 10);
  const id = "ec-" + meta.id + "-" + season.replace("-", "");
  // dedupe: a club-season is unique; if it already exists, keep the strongest role + merge comps
  if (out[id]) {
    // upgrade rating if this role is higher (winner beats SF etc.)
    out[id].rating = Math.max(out[id].rating, ratingFor(role, y));
    return;
  }
  out[id] = {
    id, tierType: "O", club, country: meta.country, season,
    comps: [comp],
    rating: ratingFor(role, y),
    kit: meta.kit, crest: null,
    scorers: meta.sc.slice(0, 3),
    note: isGroupRunnerUp ? "reached final group stage" : undefined
  };
}

ROLL.forEach(([season, w, ru, sfw, sfru]) => {
  const y = parseInt(season.slice(0, 4), 10);
  const comp = y >= 1992 ? "UCL" : "EC";   // 1992-93 onward is UCL
  const groupEra = (season === "1991-92" || season === "1992-93"); // SFs were 2nd-in-group
  add(w, season, "W", comp, false);
  add(ru, season, "RU", comp, false);
  add(sfw, season, "SF", comp, groupEra);
  add(sfru, season, "SF", comp, groupEra);
});

const rows = Object.values(out).map((r) => { if (r.note === undefined) delete r.note; return r; });
const pack = {
  meta: {
    name: "European Cup / Champions League — finalists & semi-finalists",
    source: "myfootballfacts.com (finals + semi-finals), cross-checked vs Wikipedia",
    verified: true,
    scope: "Winner, runner-up and both semi-finalists of every edition 1955-56 to 2025-26",
    comps: ["EC", "UCL"]
  },
  squads: rows
};

const fs = require("fs");
fs.writeFileSync("public/data/pack-opponents-ec-ucl.json", JSON.stringify(pack, null, 1));
console.log("Wrote", rows.length, "unique club-season rows.");
console.log("EC rows:", rows.filter(r=>r.comps.includes("EC")).length, "| UCL rows:", rows.filter(r=>r.comps.includes("UCL")).length);
console.log("Rating range:", Math.min(...rows.map(r=>r.rating)), "-", Math.max(...rows.map(r=>r.rating)));
console.log("Distinct clubs:", new Set(rows.map(r=>r.club)).size);
// sample a few
console.log("Samples:");
["ec-rma-195556","ec-aja-197172","ec-ste-198586","ec-bar-201415","ec-psg-202526"].forEach(id=>{
  const r=out[id]; if(r) console.log("  "+r.season+" "+r.club+" ("+r.comps[0]+") rating "+r.rating+" kit "+r.kit.join("/")+" scorers "+r.scorers.join(", "));
});
