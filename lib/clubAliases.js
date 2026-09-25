// 4 Eylül 2026 (Kerem: "burada Caner Erkin'i nasıl bilemedi?" — 5 Kulüp
// turunda "Internazionale" varken Caner Erkin sadece 1 kulüp eşleşmesi alıp
// 0 puan aldı) — KÖK NEDEN: players.json, AYNI GERÇEK KULÜBÜ birden fazla
// FARKLI metinle kaydetmiş (kaynak Wikipedia dökümü olduğu için). Örnekler:
//   "Inter Milan" (602 kayıt) ve "Internazionale" (316) ve "Inter" (55)
//   "Barcelona" (577) ve "FC Barcelona" (802)
//   "Real Madrid" (567) ve "Real Madrid Club de Fútbol" (319)
//   "AC Milan" (907) ve "Milan" (327)
// Bu varyantlar veri setinde ASLA aynı oyuncuda birlikte geçmiyor (kontrol
// edildi: 0 çakışma) — yani gerçekten aynı kulübün iki ayrı yazımı, oyuncular
// bunlar arasında BÖLÜNMÜŞ durumda. Sonuç: bir turda "Internazionale" çıkınca
// "Inter Milan" kaydı olan Caner Erkin gibi oyuncular HİÇ eşleşmiyordu.
//
// Aşağıdaki gruplar ELLE seçildi ve her biri veri setine karşı doğrulandı.
// KURAL: sadece BİRİNCİ TAKIM (A takımı) yazımları — "Barcelona B",
// "Juventus U23", "Bilbao Athletic" (Bilbao'nun B takımı), "Real Madrid
// Castilla" gibi altyapı/rezerv takımlar BİLİNÇLİ OLARAK HARİÇ, çünkü onlar
// gerçekten ayrı takımlar ve oyunda "o kulüpte oynadı" saymamalı.
export const CLUB_ALIAS_GROUPS = {
  "Barcelona": ["FC Barcelona"],
  "Real Madrid": ["Real Madrid Club de Fútbol"],
  "Bayern Munich": ["FC Bayern Munich"],
  "AC Milan": ["Milan", "A.C. Milan"],
  "Inter Milan": ["Internazionale", "Inter", "Ambrosiana-Inter"],
  "Roma": ["AS Roma"],
  "Napoli": ["SSC Napoli"],
  "Fiorentina": ["ACF Fiorentina"],
  "Atalanta": ["Atalanta BC"],
  "Lazio": ["SS Lazio"],
  "Marseille": ["Olympique de Marseille"],
  "Lyon": ["Olympique Lyonnais"],
  "Monaco": ["AS Monaco"],
  "PSV": ["PSV Eindhoven"],
  "Schalke 04": ["FC Schalke 04"],
  "Bayer Leverkusen": ["Bayer 04 Leverkusen"],
  "Athletic Bilbao": ["Athletic Club"],
  "Benfica": ["S.L. Benfica"],
  "River Plate": ["Club Atlético River Plate"],
  "Arsenal": ["Woolwich Arsenal"],
  "Beşiktaş": ["Beşiktaş (Football)"],
  "Fenerbahçe": ["Fenerbahçe Istanbul"],
};

// varyant metni -> kanonik (oyunda gösterilen) kulüp adı
const VARIANT_TO_CANONICAL = {};
for (const [canonical, variants] of Object.entries(CLUB_ALIAS_GROUPS)) {
  for (const v of variants) VARIANT_TO_CANONICAL[v] = canonical;
}

// Bir kulüp metnini kanonik adına çevirir. Bilinmeyen kulüpler aynen döner —
// yani bu fonksiyon HİÇBİR ZAMAN veri kaybettirmez, sadece bilinen varyantları
// tek bir isimde toplar.
export function canonicalClub(club) {
  return VARIANT_TO_CANONICAL[club] || club;
}

// Bir oyuncunun kulüp listesini kanonik adlardan oluşan bir Set'e çevirir.
export function canonicalClubSet(clubs) {
  const s = new Set();
  for (const c of clubs) s.add(canonicalClub(c));
  return s;
}
