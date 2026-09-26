import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Image } from "expo-image";
import { kulupGrubu } from "../lib/clubAliases";
import { clubLogo } from "../lib/clubLogos";

// Gerçek kulüp amblemleri telifli/markalı görsellerdir, lisanssız kullanmak
// risk taşır. Bunun yerine gerçek takım RENKLERİYLE (renk kendisi telifli
// değil, amblem TASARIMI telifli) bir kalkan şekli + baş harflerden oluşan
// kendi armamızı üretiyoruz — Football Manager'daki jenerik/oluşturulmuş
// arma hissini vermeyi hedefliyor.
// 31 Ağustos 2026 (Kerem: "takım logoları mockup gibi... gs-sarı kırmızı gibi
// bu renkler türk takımları hariç çalışmıyor. real madrid-eflatun beyaz
// monaco-kırmızı beyaz vs. şekline getirilmesi gerekiyor") — Türk kulüplerine
// ek olarak en çok karşılaşılan büyük Avrupa/Güney Amerika kulüpleri de
// gerçek renkleriyle eklendi. Havuzda ismi buradakiyle BİREBİR eşleşmeyen bir
// kulüp hâlâ isimden türetilmiş rastgele bir renge düşer (colorForName) —
// tamamı için tek tek renk girmek (onbinlerce kulüp var) pratik değil, bu
// yüzden en popüler/en sık görülen kulüpler önceliklendirildi.
const KNOWN_COLORS = {
  "Galatasaray": ["#FDB913", "#A90432"],
  "Fenerbahçe": ["#FFEB00", "#00285E"],
  "Beşiktaş": ["#000000", "#FFFFFF"],
  "Trabzonspor": ["#7A1F3D", "#002E5D"],
  "İstanbul Başakşehir": ["#F58220", "#002B5C"],
  "Başakşehir": ["#F58220", "#002B5C"],
  "Alanyaspor": ["#F7941D", "#007A3D"],
  "Çaykur Rizespor": ["#007A3D", "#0033A0"],
  "Konyaspor": ["#007A3D", "#FFFFFF"],
  "Bursaspor": ["#007A3D", "#FFFFFF"],
  "Antalyaspor": ["#E30613", "#FFFFFF"],
  "Sivasspor": ["#E30613", "#FFFFFF"],
  "Kayserispor": ["#FDB913", "#E30613"],
  "Göztepe": ["#FDB913", "#E30613"],
  "Gençlerbirliği": ["#E30613", "#000000"],
  "Kasımpaşa": ["#002B5C", "#FFFFFF"],
  "MKE Ankaragücü": ["#FFEB00", "#00285E"],
  "Adana Demirspor": ["#0033A0", "#000000"],
  "Kocaelispor": ["#00693E", "#000000"],

  // --- La Liga ---
  "Real Madrid": ["#FFFFFF", "#7A1FA2"],
  "Barcelona": ["#004D98", "#A50044"],
  "FC Barcelona": ["#004D98", "#A50044"],
  "Atlético Madrid": ["#CB3524", "#272E61"],
  "Sevilla": ["#FFFFFF", "#D2001C"],
  "Valencia": ["#FFFFFF", "#EE7203"],
  "Villarreal": ["#FFE667", "#005187"],
  "Athletic Bilbao": ["#EE2523", "#FFFFFF"],
  "Real Sociedad": ["#0044A8", "#FFFFFF"],
  "Real Betis": ["#00954C", "#FFFFFF"],
  "Celta Vigo": ["#8AC3EE", "#FFFFFF"],
  "Espanyol": ["#0A1E82", "#FFFFFF"],

  // --- Premier Lig ---
  "Manchester United": ["#DA291C", "#FBE122"],
  "Manchester City": ["#6CABDD", "#1C2C5B"],
  "Liverpool": ["#C8102E", "#F6EB61"],
  "Chelsea": ["#034694", "#FFFFFF"],
  "Arsenal": ["#EF0107", "#FFFFFF"],
  "Tottenham": ["#FFFFFF", "#132257"],
  "Tottenham Hotspur": ["#FFFFFF", "#132257"],
  "Newcastle United": ["#241F20", "#FFFFFF"],
  "West Ham United": ["#7A263A", "#1BB1E7"],
  "Everton": ["#003399", "#FFFFFF"],
  "Leicester City": ["#003090", "#FDBE11"],
  "Aston Villa": ["#670E36", "#95BFE5"],
  "Wolverhampton Wanderers": ["#FDB913", "#231F20"],

  // --- Serie A ---
  "Juventus": ["#FFFFFF", "#000000"],
  "AC Milan": ["#FB090B", "#000000"],
  "Milan": ["#FB090B", "#000000"],
  "Internazionale": ["#010E80", "#000000"],
  "Inter": ["#010E80", "#000000"],
  "Inter Milan": ["#010E80", "#000000"],
  "Napoli": ["#12A0D7", "#FFFFFF"],
  "AS Roma": ["#8E1F2F", "#F0BC42"],
  "Roma": ["#8E1F2F", "#F0BC42"],
  "Lazio": ["#87D8F7", "#FFFFFF"],
  "Fiorentina": ["#5A2D81", "#FFFFFF"],
  "Atalanta": ["#1E71B8", "#000000"],


  // 12 Eylül 2026 (Kerem: "bazı kulüpler eksik") — veri setinde en çok geçen
  // 110 kulüp tarandı; renk tanımı olmayan 76'sı gerçek forma renkleriyle
  // eklendi. Tanımı olmayan kulüp isimden türetilen rastgele bir renge
  // düşmeye devam ediyor (onbinlerce kulüp var, hepsi elle girilemez) ama
  // artık oyunda gerçekten karşına çıkanların neredeyse hepsi doğru.
  "Brentford": ["#E30613", "#FFFFFF"],
  "Sunderland": ["#EB172B", "#FFFFFF"],
  "Burnley": ["#6C1D45", "#99D6EA"],
  "Southampton": ["#D71920", "#FFFFFF"],
  "Brighton & Hove Albion": ["#0057B8", "#FFFFFF"],
  "Brighton": ["#0057B8", "#FFFFFF"],
  "Crystal Palace": ["#1B458F", "#C4122E"],
  "Nottingham Forest": ["#DD0000", "#FFFFFF"],
  "Fulham": ["#FFFFFF", "#000000"],
  "Leeds United": ["#FFFFFF", "#1D428A"],
  "West Bromwich Albion": ["#122F67", "#FFFFFF"],
  "Blackburn Rovers": ["#009EE0", "#FFFFFF"],
  "Birmingham City": ["#0000FF", "#FFFFFF"],
  "Bolton Wanderers": ["#FFFFFF", "#263C7E"],
  "Derby County": ["#FFFFFF", "#000000"],
  "Coventry City": ["#78D0F3", "#FFFFFF"],
  "Charlton Athletic": ["#D4021D", "#FFFFFF"],
  "Norwich City": ["#FFF200", "#00A650"],
  "Ipswich Town": ["#0044A9", "#FFFFFF"],
  "Queens Park Rangers": ["#1D5BA4", "#FFFFFF"],
  "Watford": ["#FBEE23", "#ED2127"],
  "Portsmouth": ["#001489", "#FFFFFF"],
  "Sheffield United": ["#EE2737", "#FFFFFF"],
  "Sheffield Wednesday": ["#0066B3", "#FFFFFF"],
  "Blackpool": ["#F68712", "#FFFFFF"],
  "Reading": ["#004494", "#FFFFFF"],
  "Swindon Town": ["#D50000", "#FFFFFF"],
  "Bradford City": ["#FFCC00", "#75003C"],
  "Oldham Athletic": ["#004BA0", "#FFFFFF"],
  "Southend United": ["#003DA5", "#FFFFFF"],
  "Northampton Town": ["#8B1538", "#FFFFFF"],
  "Bristol City": ["#E21C38", "#FFFFFF"],
  "Notts County": ["#000000", "#FFFFFF"],
  "Millwall": ["#001D5B", "#FFFFFF"],
  "Middlesbrough": ["#E21C38", "#FFFFFF"],
  "Luton Town": ["#F78F1E", "#002D62"],
  "Preston North End": ["#FFFFFF", "#00214D"],
  "Port Vale": ["#FFFFFF", "#000000"],
  "Grimsby Town": ["#000000", "#FFFFFF"],
  "Doncaster Rovers": ["#E30613", "#FFFFFF"],
  "Cardiff City": ["#0070B5", "#FFFFFF"],
  "Stockport County": ["#005DAA", "#FFFFFF"],
  "Lincoln City": ["#E31B23", "#FFFFFF"],
  "Barnsley": ["#E4002B", "#FFFFFF"],
  "Hull City": ["#F5A12D", "#000000"],
  "Darlington": ["#000000", "#FFFFFF"],
  "Huddersfield Town": ["#0E63AD", "#FFFFFF"],
  "Walsall": ["#E30613", "#FFFFFF"],
  "Rochdale": ["#1B449C", "#FFFFFF"],
  "Gillingham": ["#0033A0", "#FFFFFF"],
  "Plymouth Argyle": ["#046A38", "#FFFFFF"],
  "Stoke City": ["#E03A3E", "#FFFFFF"],
  "Colchester United": ["#0057B8", "#FFFFFF"],
  "Leyton Orient": ["#E4002B", "#FFFFFF"],
  "Carlisle United": ["#0057B8", "#FFFFFF"],
  "Bury": ["#FFFFFF", "#003DA5"],
  "Mansfield Town": ["#FFD100", "#0033A0"],
  "Genoa": ["#B01E28", "#0B2545"],
  "Torino": ["#7A1F2B", "#FFFFFF"],
  "Parma": ["#FDE100", "#0B2545"],
  "Udinese": ["#000000", "#FFFFFF"],
  "Bologna": ["#B32635", "#0B2545"],
  "Venezia": ["#000000", "#F58220"],
  "Sampdoria": ["#1B4F9C", "#FFFFFF"],
  "Lecce": ["#FDE100", "#D2001C"],
  "Como": ["#0057B8", "#FFFFFF"],
  "Monza": ["#E30613", "#FFFFFF"],
  "Empoli": ["#0057B8", "#FFFFFF"],
  "Palermo": ["#F2A0C4", "#000000"],
  "Cagliari": ["#B01E28", "#0B2545"],
  "Bari": ["#E30613", "#FFFFFF"],
  "Pisa": ["#0B2545", "#000000"],
  "Elche": ["#00963F", "#FFFFFF"],
  "Mallorca": ["#E20613", "#000000"],
  "Rayo Vallecano": ["#FFFFFF", "#E53027"],
  "VfL Bochum": ["#005CA9", "#FFFFFF"],
  "Lens": ["#FFE500", "#E30613"],

  // --- Bundesliga ---
  "Bayern Munich": ["#DC052D", "#0066B2"],
  "Bayern München": ["#DC052D", "#0066B2"],
  "Borussia Dortmund": ["#FDE100", "#000000"],
  "RB Leipzig": ["#DD0741", "#FFFFFF"],
  "Bayer Leverkusen": ["#E32221", "#000000"],
  "Schalke 04": ["#004D9D", "#FFFFFF"],
  "Borussia Mönchengladbach": ["#000000", "#FFFFFF"],
  "Wolfsburg": ["#65B32E", "#FFFFFF"],
  "Eintracht Frankfurt": ["#E1000F", "#000000"],
  "Hamburger SV": ["#0F1E3D", "#FFFFFF"],
  "Werder Bremen": ["#1D9053", "#FFFFFF"],

  // --- Ligue 1 ---
  "Paris Saint-Germain": ["#004170", "#DA291C"],
  "PSG": ["#004170", "#DA291C"],
  "Marseille": ["#2FAEE0", "#FFFFFF"],
  "Olympique de Marseille": ["#2FAEE0", "#FFFFFF"],
  "Lyon": ["#0E4D92", "#FFFFFF"],
  "Olympique Lyonnais": ["#0E4D92", "#FFFFFF"],
  "Monaco": ["#E0231B", "#FFFFFF"],
  "AS Monaco": ["#E0231B", "#FFFFFF"],
  "Lille": ["#C60C30", "#003D7D"],
  "Nice": ["#CC0000", "#000000"],
  "Saint-Étienne": ["#00954C", "#FFFFFF"],
  "Rennes": ["#E4032E", "#000000"],
  "Nantes": ["#FFD100", "#00843D"],

  // --- Portekiz / Hollanda ---
  "Benfica": ["#E31B23", "#FFFFFF"],
  "FC Porto": ["#0033A0", "#FFFFFF"],
  "Porto": ["#0033A0", "#FFFFFF"],
  "Sporting CP": ["#008148", "#FFFFFF"],
  "Ajax": ["#D2122E", "#FFFFFF"],
  "PSV Eindhoven": ["#ED1C24", "#FFFFFF"],
  "PSV": ["#ED1C24", "#FFFFFF"],
  "Feyenoord": ["#E4231C", "#000000"],

  // --- Güney Amerika ---
  "Boca Juniors": ["#0038A8", "#FFD100"],
  "River Plate": ["#FFFFFF", "#DA291C"],
  "Santos": ["#FFFFFF", "#000000"],
  "Corinthians": ["#000000", "#FFFFFF"],
  "Flamengo": ["#E51937", "#000000"],
  "São Paulo": ["#FE0000", "#000000"],
};

// Basit bir kalkan hatlı yol (viewBox 0 0 100 100)
const SHIELD_PATH = "M50 3 L90 17 L90 52 Q90 86 50 97 Q10 86 10 52 L10 17 Z";
// Alt kısımda banner/şerit hissi veren ikinci bir yol
const BANNER_PATH = "M10 58 Q10 86 50 97 Q90 86 90 58 L90 66 Q90 88 50 96 Q10 88 10 66 Z";

function colorForName(name) {
  if (!name || typeof name !== "string") return "#16222E";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 40%)`;
}

function initials(name) {
  if (!name || typeof name !== "string") return "?";
  const words = name.split(" ").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function TeamBadge({ name, size = 56 }) {
  // 12 Eylül 2026 (Kerem: "Inter Milan'ın amblemi mavi-siyah olmamış, bazı
  // kulüpler eksik") — KÖK NEDEN: KNOWN_COLORS'ta "Internazionale" ve "Inter"
  // vardı ama veri setindeki asıl yazım "Inter Milan"dı; o da listede olmadığı
  // için isimden türetilen RASTGELE renge düşüyordu. Aynı sorun yazımı farklı
  // her kulüpte vardı. lib/clubAliases.js bu eşlemeyi zaten biliyor (5 Kulüp
  // ve puanlama onu kullanıyor), rozet de artık aynı kaynağa bakıyor:
  // önce birebir ad, olmazsa kanonik ad.
  // 25 Eylul 2026 (Kerem: FM'in jenerik/lisanssiz armalarini buldu) — 1247
  // kulup adi icin gercek arma gorseli uygulamanin icine gomuldu
  // (assets/club_logos, 128px WebP). Gorseli olan kulupte artik kalkan+bas
  // harf DEGIL, armanin kendisi cikiyor. Gorseli olmayan kulup (alt lig,
  // rezerv takim) eskisi gibi uretilmis kalkana duser — yani bu degisiklik
  // HICBIR kulubu bozmaz, sadece bilinenleri iyilestirir.
  const logo = clubLogo(name);
  if (logo) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Image
          source={logo}
          style={{ width: size, height: size }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    );
  }

  // 26 Eylül 2026: kulüp varyantları birleşti — renk, grubun HERHANGİ bir
  // yazımına kayıtlıysa bulunur ("MKE Ankaragücü" rengi "Ankaragücü"ne de gelir).
  let known = KNOWN_COLORS[name];
  if (!known) for (const ad of kulupGrubu(name)) { known = KNOWN_COLORS[ad]; if (known) break; }
  const bg = known ? known[0] : colorForName(name);
  const fg = known ? known[1] : "#FFFFFF";

  return (
    // 4 Eylül 2026 (Kerem: "5 Kulüp modunda logo altındaki kısaltma takım
    // adıyla üst üste biniyor, AR Arsenal gibi") — KÖK NEDEN: baş harf yazısı
    // (Text) sistem font ölçeği büyütüldüğünde (erişilebilirlik ayarı veya
    // bazı cihazlarda varsayılan) rozetin (küçük boyutlu kullanıldığında,
    // ör. 40px) sınırlarını AŞIYORDU — labelWrap absolute dolgu olsa da
    // üzerine overflow:hidden YOKTU, yazı taştığında rozetin altındaki isme
    // biniyordu. ÇÖZÜM: dış konteynıra overflow:"hidden" + baş harf
    // yazısına allowFontScaling={false} (rozet zaten sabit küçük bir alan,
    // erişilebilirlik ölçeğine göre büyümemeli).
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={SHIELD_PATH} fill={bg} stroke="#0B1620" strokeWidth={4} />
        <Path d={BANNER_PATH} fill={fg} opacity={0.22} />
        <Circle cx="50" cy="38" r="16" fill={fg} opacity={0.12} />
      </Svg>
      <View style={styles.labelWrap} pointerEvents="none">
        <Text allowFontScaling={false} style={[styles.text, { fontSize: size * 0.3, color: fg }]}>{initials(name)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "900", letterSpacing: -0.5 },
});
