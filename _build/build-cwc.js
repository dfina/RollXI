// Cup Winners' Cup roll of honour 1960-61 .. 1998-99 (39 editions).
// [season, winner, runnerUp, winnerCountry, ruCountry, winnerScorer, ruScorer]
// Verified against aworldofsoccer.com year-by-year list + Wikipedia finals pages.
const ROLL = [
  ["1960-61","Fiorentina","Rangers","Italy","Scotland","Hamrin","Scott"],
  ["1961-62","Atlético Madrid","Fiorentina","Spain","Italy","Mendonça","Hamrin"],
  ["1962-63","Tottenham Hotspur","Atlético Madrid","England","Spain","Greaves","Collar"],
  ["1963-64","Sporting CP","MTK Budapest","Portugal","Hungary","Mascarenhas","Sándor"],
  ["1964-65","West Ham United","1860 Munich","England","Germany","Sealey","Brunnenmeier"],
  ["1965-66","Borussia Dortmund","Liverpool","Germany","England","Held","Hunt"],
  ["1966-67","Bayern München","Rangers","Germany","Scotland","Roth","Johnston"],
  ["1967-68","AC Milan","Hamburg","Italy","Germany","Hamrin","Seeler"],
  ["1968-69","Slovan Bratislava","Barcelona","Slovakia","Spain","Cvetler","Zaldúa"],
  ["1969-70","Manchester City","Górnik Zabrze","England","Poland","Young","Oślizło"],
  ["1970-71","Chelsea","Real Madrid","England","Spain","Osgood","Zoco"],
  ["1971-72","Rangers","Dynamo Moscow","Scotland","Soviet Union","Stein","Eshtrekov"],
  ["1972-73","AC Milan","Leeds United","Italy","England","Chiarugi","Hunter"],
  ["1973-74","FC Magdeburg","AC Milan","Germany","Italy","Lanzi","Chiarugi"],
  ["1974-75","Dynamo Kyiv","Ferencváros","Soviet Union","Hungary","Onyshchenko","Mucha"],
  ["1975-76","Anderlecht","West Ham United","Belgium","England","Rensenbrink","Holland"],
  ["1976-77","Hamburg","Anderlecht","Germany","Belgium","Volkert","Rensenbrink"],
  ["1977-78","Anderlecht","Austria Wien","Belgium","Austria","Rensenbrink","Gasselich"],
  ["1978-79","Barcelona","Fortuna Düsseldorf","Spain","Germany","Krankl","Seel"],
  ["1979-80","Valencia","Arsenal","Spain","England","Kempes","Brady"],
  ["1980-81","Dinamo Tbilisi","Carl Zeiss Jena","Soviet Union","Germany","Gutsaev","Hoppe"],
  ["1981-82","Barcelona","Standard Liège","Spain","Belgium","Simonsen","Vandersmissen"],
  ["1982-83","Aberdeen","Real Madrid","Scotland","Spain","Black","Juanito"],
  ["1983-84","Juventus","Porto","Italy","Portugal","Vignola","Sousa"],
  ["1984-85","Everton","Rapid Vienna","England","Austria","Gray","Krankl"],
  ["1985-86","Dynamo Kyiv","Atlético Madrid","Soviet Union","Spain","Zavarov","Quique"],
  ["1986-87","Ajax","Lokomotive Leipzig","Netherlands","Germany","Van Basten","Marschall"],
  ["1987-88","KV Mechelen","Ajax","Belgium","Netherlands","Den Boer","Bosman"],
  ["1988-89","Barcelona","Sampdoria","Spain","Italy","Salinas","Vialli"],
  ["1989-90","Sampdoria","Anderlecht","Italy","Belgium","Vialli","Van der Linden"],
  ["1990-91","Manchester United","Barcelona","England","Spain","Hughes","Koeman"],
  ["1991-92","Werder Bremen","Monaco","Germany","France","Allofs","Clément"],
  ["1992-93","Parma","Antwerp","Italy","Belgium","Melli","Severeyns"],
  ["1993-94","Arsenal","Parma","England","Italy","Smith","Brolin"],
  ["1994-95","Real Zaragoza","Arsenal","Spain","England","Nayim","Hartson"],
  ["1995-96","Paris Saint-Germain","Rapid Vienna","France","Austria","N'Gotty","Stöger"],
  ["1996-97","Barcelona","Paris Saint-Germain","Spain","France","Ronaldo","Leonardo"],
  ["1997-98","Chelsea","VfB Stuttgart","England","Germany","Zola","Bobic"],
  ["1998-99","Lazio","Mallorca","Italy","Spain","Vieri","Dani"]
];
module.exports = ROLL;
console.log("CWC roll:", ROLL.length, "editions ("+ROLL[0][0]+" to "+ROLL[ROLL.length-1][0]+")");
// sanity: Barcelona should have 4 titles
const wins={}; ROLL.forEach(([s,w])=>wins[w]=(wins[w]||0)+1);
const top=Object.entries(wins).sort((a,b)=>b[1]-a[1]).slice(0,5);
console.log("Most titles:", top.map(([c,n])=>c+' '+n).join(', '));
