// Fairs Cup + UEFA Cup + Europa League roll of honour.
// [season, winner, runnerUp, winnerCountry, ruCountry, winnerScorer, ruScorer]

// --- Inter-Cities Fairs Cup 1955-1971 (13 editions; early ones span multiple years) ---
const FAIRS = [
  ["1955-58","Barcelona","London XI","Spain","England","Suárez","Greaves"],
  ["1958-60","Barcelona","Birmingham City","Spain","England","Martínez","Hooper"],
  ["1960-61","AS Roma","Birmingham City","Italy","England","Manfredini","Harris"],
  ["1961-62","Valencia","Barcelona","Spain","Spain","Guillot","Kocsis"],
  ["1962-63","Valencia","Dinamo Zagreb","Spain","Yugoslavia","Waldo","Zambata"],
  ["1963-64","Zaragoza","Valencia","Spain","Spain","Villa","Urtiaga"],
  ["1964-65","Ferencváros","Juventus","Hungary","Italy","Fenyvesi","Combin"],
  ["1965-66","Barcelona","Zaragoza","Spain","Spain","Pujol","Marcelino"],
  ["1966-67","Dinamo Zagreb","Leeds United","Yugoslavia","England","Cerček","Charlton"],
  ["1967-68","Leeds United","Ferencváros","England","Hungary","Jones","Rákosi"],
  ["1968-69","Newcastle United","Ujpest","England","Hungary","Moncur","Bene"],
  ["1969-70","Arsenal","Anderlecht","England","Belgium","Kennedy","Devrindt"],
  ["1970-71","Leeds United","Juventus","England","Italy","Clarke","Bettega"]
];

// --- UEFA Cup 1971-72 .. 2008-09 (38 editions) ---
const UEFA = [
  ["1971-72","Tottenham Hotspur","Wolverhampton Wanderers","England","England","Chivers","Wagstaffe"],
  ["1972-73","Liverpool","Borussia Monchengladbach","England","Germany","Keegan","Heynckes"],
  ["1973-74","Feyenoord","Tottenham Hotspur","Netherlands","England","Rijsbergen","England"],
  ["1974-75","Borussia Monchengladbach","Twente","Germany","Netherlands","Heynckes","Drost"],
  ["1975-76","Liverpool","Club Brugge","England","Belgium","Kennedy","Lambert"],
  ["1976-77","Juventus","Athletic Bilbao","Italy","Spain","Tardelli","Irureta"],
  ["1977-78","PSV Eindhoven","Bastia","Netherlands","France","Van der Kuijlen","Rep"],
  ["1978-79","Borussia Monchengladbach","Red Star Belgrade","Germany","Yugoslavia","Simonsen","Jurišić"],
  ["1979-80","Eintracht Frankfurt","Borussia Monchengladbach","Germany","Germany","Schaub","Kulik"],
  ["1980-81","Ipswich Town","AZ Alkmaar","England","Netherlands","Wark","Welzl"],
  ["1981-82","IFK Gothenburg","Hamburg","Sweden","Germany","Nilsson","Bastrup"],
  ["1982-83","Anderlecht","Benfica","Belgium","Portugal","Brylle","Sheu"],
  ["1983-84","Tottenham Hotspur","Anderlecht","England","Belgium","Roberts","Olsen"],
  ["1984-85","Real Madrid","Videoton","Spain","Hungary","Míchel","Májer"],
  ["1985-86","Real Madrid","Koln","Spain","Germany","Sánchez","Bein"],
  ["1986-87","IFK Gothenburg","Dundee United","Sweden","Scotland","Pettersson","Clark"],
  ["1987-88","Bayer Leverkusen","Espanyol","Germany","Spain","Tita","Losada"],
  ["1988-89","Napoli","Stuttgart","Italy","Germany","Maradona","Klinsmann"],
  ["1989-90","Juventus","Fiorentina","Italy","Italy","Galia","Buso"],
  ["1990-91","Inter","AS Roma","Italy","Italy","Berti","Rizzitelli"],
  ["1991-92","Ajax","Torino","Netherlands","Italy","Pettersson","Casagrande"],
  ["1992-93","Juventus","Borussia Dortmund","Italy","Germany","Baggio","Rummenigge"],
  ["1993-94","Inter","Austria Salzburg","Italy","Austria","Berti","Jara"],
  ["1994-95","Parma","Juventus","Italy","Italy","Dino Baggio","Vialli"],
  ["1995-96","Bayern München","Bordeaux","Germany","France","Scholl","Dugarry"],
  ["1996-97","Schalke 04","Inter","Germany","Italy","Wilmots","Zamorano"],
  ["1997-98","Inter","Lazio","Italy","Italy","Ronaldo","Nedvěd"],
  ["1998-99","Parma","Marseille","Italy","France","Crespo","Gravelaine"],
  ["1999-00","Galatasaray","Arsenal","Turkey","England","Gheorghe","Henry"],
  ["2000-01","Liverpool","Alaves","England","Spain","Owen","Cruyff"],
  ["2001-02","Feyenoord","Borussia Dortmund","Netherlands","Germany","Van Hooijdonk","Koller"],
  ["2002-03","Porto","Celtic","Portugal","Scotland","Derlei","Larsson"],
  ["2003-04","Valencia","Marseille","Spain","France","Vicente","Meriem"],
  ["2004-05","CSKA Moscow","Sporting CP","Russia","Portugal","Vágner Love","Rogério"],
  ["2005-06","Sevilla","Middlesbrough","Spain","England","Maresca","Hasselbaink"],
  ["2006-07","Sevilla","Espanyol","Spain","Spain","Kanouté","Jonatas"],
  ["2007-08","Zenit","Rangers","Russia","Scotland","Denisov","Boyd"],
  ["2008-09","Shakhtar Donetsk","Werder Bremen","Ukraine","Germany","Jádson","Naldo"]
];

// --- UEFA Europa League 2009-10 .. 2024-25 (16 editions; 2025-26 in progress, excluded) ---
const UEL = [
  ["2009-10","Atlético Madrid","Fulham","Spain","England","Forlán","Davies"],
  ["2010-11","Porto","Braga","Portugal","Portugal","Falcao","Custódio"],
  ["2011-12","Atlético Madrid","Athletic Bilbao","Spain","Spain","Falcao","Llorente"],
  ["2012-13","Chelsea","Benfica","England","Portugal","Ivanović","Cardozo"],
  ["2013-14","Sevilla","Benfica","Spain","Portugal","Bacca","Rodrigo"],
  ["2014-15","Sevilla","Dnipro","Spain","Ukraine","Bacca","Kalinić"],
  ["2015-16","Sevilla","Liverpool","Spain","England","Gameiro","Sturridge"],
  ["2016-17","Manchester United","Ajax","England","Netherlands","Mkhitaryan","Traoré"],
  ["2017-18","Atlético Madrid","Marseille","Spain","France","Griezmann","Payet"],
  ["2018-19","Chelsea","Arsenal","England","England","Hazard","Iwobi"],
  ["2019-20","Sevilla","Inter","Spain","Italy","De Jong","Lukaku"],
  ["2020-21","Villarreal","Manchester United","Spain","England","Moreno","Cavani"],
  ["2021-22","Eintracht Frankfurt","Rangers","Germany","Scotland","Borré","Aribo"],
  ["2022-23","Sevilla","AS Roma","Spain","Italy","Ramos","Dybala"],
  ["2023-24","Atalanta","Bayer Leverkusen","Italy","Germany","Lookman","Wirtz"],
  ["2024-25","Tottenham Hotspur","Manchester United","England","England","Johnson","Shaw"]
];

module.exports = { FAIRS, UEFA, UEL };
console.log("Fairs:", FAIRS.length, "| UEFA Cup:", UEFA.length, "| Europa League:", UEL.length, "| TOTAL editions:", FAIRS.length+UEFA.length+UEL.length);
// sanity checks vs known records
const allWins={};
[...UEFA,...UEL].forEach(([s,w])=>allWins[w]=(allWins[w]||0)+1);
const top=Object.entries(allWins).sort((a,b)=>b[1]-a[1]).slice(0,6);
console.log("UEFA Cup+EL most titles:", top.map(([c,n])=>c+' '+n).join(', '));
