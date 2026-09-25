// ============================================================================
// MEVKİ ADLARI — TÜRKÇE GÖSTERİM
//
// 12 Eylül 2026 (Kerem: "kim bu futbolcu modunda mevki, ülke isimleri vs hep
// İngilizce geliyor" + "oyuncu profillerinde de ülke adı ve mevki adı
// İngilizce yazıyor").
//
// lib/playerBirthPosition.json Wikipedia kaynaklı ve mevkiyi İngilizce
// tutuyor — bu DOĞRU, veri modeli değişmemeli. Bu dosya sadece EKRANDA
// GÖSTERİM için Türkçe karşılık sağlıyor (lib/countryNamesTr.js ile aynı
// mantık).
//
// Veri setinde 1744 farklı mevki metni var ama bu uzun kuyruğun tamamı
// birleşik ifadeler ("Centre-back, defensive midfielder") ve yazım farkları.
// Bu yüzden tek tek eşleme yerine PARÇALAYIP ÇEVİRİYORUZ: metni virgül/eğik
// çizgi ile bölüyor, her parçayı normalize edip sözlükten karşılığını
// alıyoruz. Böylece 60 kayıtlık bir sözlük binlerce varyantı kapsıyor.
// Karşılığı olmayan bir parça olduğu gibi bırakılıyor — hiçbir şey kırılmaz.
// ============================================================================

const MEVKI = {
  "goalkeeper": "Kaleci",
  "defender": "Defans",
  "midfielder": "Orta saha",
  "forward": "Forvet",
  "striker": "Santrfor",
  "winger": "Kanat",

  "centre back": "Stoper",
  "center back": "Stoper",
  "central defender": "Stoper",
  "centre half": "Stoper",
  "sweeper": "Libero",

  "left back": "Sol bek",
  "right back": "Sağ bek",
  "full back": "Bek",
  "wing back": "Kanat bek",
  "left wing back": "Sol kanat bek",
  "right wing back": "Sağ kanat bek",

  "defensive midfielder": "Ön libero",
  "central midfielder": "Merkez orta saha",
  "attacking midfielder": "Ofansif orta saha",
  "left midfielder": "Sol orta saha",
  "right midfielder": "Sağ orta saha",
  "wide midfielder": "Kanat orta saha",
  "box to box midfielder": "Box-to-box orta saha",
  "deep lying playmaker": "Derin oyun kurucu",
  "playmaker": "Oyun kurucu",

  "left winger": "Sol kanat",
  "right winger": "Sağ kanat",
  "centre forward": "Santrfor",
  "center forward": "Santrfor",
  "second striker": "İkinci forvet",
  "inside forward": "İç forvet",
  "inside left": "Sol iç",
  "inside right": "Sağ iç",
  "outside left": "Sol açık",
  "outside right": "Sağ açık",
  "outside forward": "Açık forvet",
  "target man": "Hedef forvet",

  // Eski dönem terimleri — veri setinde epey geçiyor (1950-70'ler oyuncuları)
  "wing half": "Kanat hafı",
  "half back": "Haf",
  "left half": "Sol haf",
  "right half": "Sağ haf",
  "centre half back": "Merkez haf",
  "utility player": "Çok yönlü oyuncu",
};

function normalize(p) {
  return String(p)
    .toLowerCase()
    .replace(/[-_/]/g, " ")
    .replace(/[^a-zçğıöşü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tek bir parçayı çevirir; bulamazsa baş harfi büyütülmüş hâlini döndürür.
function parcaCevir(parca) {
  const n = normalize(parca);
  if (!n) return "";
  if (MEVKI[n]) return MEVKI[n];
  // "centre-back" gibi yazımlar normalize sonrası "centre back" oluyor;
  // yine de bulunamazsa çoğul/ek farkını dene.
  const tekil = n.replace(/s$/, "");
  if (MEVKI[tekil]) return MEVKI[tekil];
  return parca.trim().charAt(0).toUpperCase() + parca.trim().slice(1);
}

// "Centre-back, defensive midfielder" -> "Stoper, Ön libero"
export function positionTr(position) {
  if (!position) return "";
  const ham = String(position).trim();
  // Wikipedia şablon artığı ("{{hlist" gibi) — gösterilecek bir şey yok.
  if (/^\{\{/.test(ham) || ham.toLowerCase() === "none") return "";
  const parcalar = ham.split(/\s*[,/]\s*|\s+ve\s+|\s+and\s+/).filter(Boolean);
  const cevrilmis = parcalar.map(parcaCevir).filter(Boolean);
  // Aynı çeviriye düşen tekrarları temizle ("Centre back" + "Centre-back")
  const benzersiz = [];
  for (const c of cevrilmis) if (!benzersiz.includes(c)) benzersiz.push(c);
  return benzersiz.join(", ");
}
