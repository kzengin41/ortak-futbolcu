// 5 büyük ligin güncel/yakın dönem düzenli takımları — Türkiye listemizle
// aynı mantık: "tüm zamanlar" değil, gerçekten tanıdık gelen, son
// sezonlarda görülen kulüpler. Küme her sezon biraz değişir (küme
// düşme/çıkma), bu yüzden %100 güncel garantisi vermiyorum — eksik/fazla
// bir takım fark edersen lib/corrections.js mantığıyla burayı da
// güncelleyebiliriz.
export const PREMIER_LEAGUE_CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton & Hove Albion",
  "Chelsea", "Crystal Palace", "Everton", "Fulham", "Liverpool", "Manchester City",
  "Manchester United", "Newcastle United", "Nottingham Forest", "Tottenham Hotspur",
  "West Ham United", "Wolverhampton Wanderers", "Leicester City", "Ipswich Town",
  "Southampton", "Leeds United", "Burnley", "Sunderland"
];

export const LA_LIGA_CLUBS = [
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Real Sociedad",
  "Real Betis", "Villarreal", "Athletic Bilbao", "Valencia", "Girona", "Osasuna",
  "Celta Vigo", "Getafe", "Rayo Vallecano", "Mallorca", "Las Palmas", "Alaves",
  "Espanyol", "Levante", "Elche"
];

export const SERIE_A_CLUBS = [
  "Juventus", "AC Milan", "Inter Milan", "Napoli", "AS Roma", "Lazio", "Atalanta",
  "Fiorentina", "Bologna", "Torino", "Udinese", "Sassuolo", "Genoa", "Cagliari",
  "Empoli", "Hellas Verona", "Monza", "Lecce", "Parma", "Como", "Venezia", "Pisa"
];

export const BUNDESLIGA_CLUBS = [
  "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
  "Eintracht Frankfurt", "VfB Stuttgart", "Borussia Monchengladbach", "VfL Wolfsburg",
  "Union Berlin", "SC Freiburg", "Mainz 05", "TSG Hoffenheim", "Werder Bremen",
  "FC Augsburg", "1. FC Heidenheim", "VfL Bochum", "FC St. Pauli", "Holstein Kiel"
];

export const LIGUE_1_CLUBS = [
  "Paris Saint-Germain", "Marseille", "Monaco", "Lyon", "Lille", "Nice", "Rennes",
  "Lens", "Strasbourg", "Toulouse", "Nantes", "Montpellier", "Reims", "Brest",
  "Auxerre", "Angers", "Le Havre"
];

export const BIG5_CLUBS = [
  ...PREMIER_LEAGUE_CLUBS,
  ...LA_LIGA_CLUBS,
  ...SERIE_A_CLUBS,
  ...BUNDESLIGA_CLUBS,
  ...LIGUE_1_CLUBS,
];
