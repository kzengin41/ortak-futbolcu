// ============================================================================
// GÜNLÜK OYUNLAR — Günlük 5 Kulüp + Günlük Izgara (4 Ekim 2026)
//
// Benchmark kararları: ".29283 Günlük 5 Kulüp", ".29364 Günlük Izgara",
// ".29515 paylaşım metni ve kareler". Günün Bulmacası'yla aynı desen
// (lib/dailyPuzzle.js tohum/uretec/gunAnahtari): herkese aynı soru, günde bir
// kez, sonuç kareli paylaşım metniyle paylaşılır.
// Soru tarih tohumundan üretilir ve eşleşme profiline BAĞLI DEĞİLDİR (herkes
// aynı soruyu görsün diye).
// ============================================================================
import { tohum, uretec, gunAnahtari, gunNumarasi, takvimdenGun } from "./dailyPuzzle";
import {
  FIVE_CLUB_DIFFICULTIES, FIVE_CLUB_MIN_OVERLAP, bestFiveClubAnswers, scoreFiveClubAnswer,
} from "./gameEngine";
import { MEGA } from "./clubWeights";
import { izgaraUret, zorlukAyari10, hucreCevaplari, kosulEtiketi } from "./gridGame";
import { taninirlik } from "./taninirlik";
import { canonicalClub } from "./clubAliases";
import { profilDerle, VARSAYILAN_PROFIL } from "./eslesmeProfili";
import { BES_KULUP_HAK, IZGARA_HAK } from "./gunlukKayit";

// Kayıt yardımcıları hafif ayrı dosyada (Tüm Modlar kartı veri setini yüklemesin).
export { gunlukDurumOku, gunlukDurumYaz, BES_KULUP_HAK, IZGARA_HAK } from "./gunlukKayit";

const karistir = (a, rnd) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
const TR = new Set(["Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Bursaspor", "Başakşehir"]);

// ------------------------------------------------------------------ Günlük 5 Kulüp

// Hız için: yalnızca havuzdaki kulüplerden en az ikisinde oynamış oyuncular.
let _adaylar = null;
function besKulupAdaylari(veriSeti, havuz) {
  if (_adaylar) return _adaylar;
  const k = new Set(havuz.map(canonicalClub));
  _adaylar = veriSeti.filter((p) => {
    let n = 0;
    for (const c of new Set((p.clubs || []).map(canonicalClub))) if (k.has(c) && ++n >= 2) return true;
    return false;
  });
  return _adaylar;
}

const tarihNo = (tarih) => (/^\d{4}-\d{2}-\d{2}$/.test(tarih) ? gunNumarasi(new Date(`${tarih}T12:00:00`)) : 0);

export function gununBesKulubu(veriSeti, tarih = gunAnahtari()) {
  const havuz = FIVE_CLUB_DIFFICULTIES.zor.pool;
  const adaylar = besKulupAdaylari(veriSeti, havuz);
  // Sabit takvim (sürümden bağımsız, .29542): kulüpler dosyadan, cevaplar veriden.
  const no = tarihNo(tarih);
  const sabit = takvimdenGun("besKulup", no);
  if (sabit) return { kulupler: sabit, no, enIyiler: bestFiveClubAnswers(adaylar, sabit, 30).slice(0, 8) };
  const rnd = uretec(tohum("5kulup-" + tarih));
  let enIyiDeneme = null;
  for (let deneme = 0; deneme < 60; deneme++) {
    const capa = MEGA[Math.floor(rnd() * MEGA.length)];
    const kalan = karistir(havuz.filter((c) => c !== capa), rnd);
    const secilen = [capa];
    let tr = TR.has(capa) ? 1 : 0;
    for (const c of kalan) {
      if (secilen.length >= 5) break;
      if (TR.has(c)) { if (tr >= 2) continue; tr++; }
      secilen.push(c);
    }
    const en = bestFiveClubAnswers(adaylar, secilen, 30);
    // Güzel bir günlük: en az bir 4'lük cevap ve en az 4 tane 3+'lük cevap olsun.
    const ucluk = en.filter((x) => x.count >= 3).length;
    const sonuc = { kulupler: secilen, no: gunNumarasi(), enIyiler: en.slice(0, 8) };
    if (en.length && en[0].count >= 4 && ucluk >= 4) return sonuc;
    const skor = (en[0] ? en[0].count : 0) * 10 + ucluk;
    if (!enIyiDeneme || skor > enIyiDeneme.skor) enIyiDeneme = { skor, sonuc };
  }
  return enIyiDeneme ? enIyiDeneme.sonuc : null;
}

export function besKulupPuani(oyuncu, kulupler) {
  const { count, matchedClubs } = scoreFiveClubAnswer(oyuncu, kulupler);
  return { puan: count >= FIVE_CLUB_MIN_OVERLAP ? count : 0, matchedClubs };
}

export function besKulupPaylasim(no, tahminler, kulupler) {
  const toplam = tahminler.reduce((t, x) => t + x.puan, 0);
  const satirlar = tahminler.map((x) => kulupler.map((k) => (x.matchedClubs.includes(k) && x.puan ? "🟩" : "⬜")).join(""));
  return [`⚽ 3-2-1: Bitir İşi — Günlük 5 Kulüp #${no}`, `${toplam} / 15 puan`, ...satirlar, "Sen kaç yaparsın?"].join("\n");
}

// ------------------------------------------------------------------ Günlük Izgara

export function gununIzgarasi(veriSeti, tarih = gunAnahtari()) {
  const sabit = takvimdenGun("izgara", tarihNo(tarih));
  if (sabit) return { izgara: { satirlar: sabit[0], sutunlar: sabit[1] }, no: tarihNo(tarih) };
  const rnd = uretec(tohum("izgara-" + tarih));
  for (let i = 0; i < 5; i++) {
    // Herkese aynı ızgara: kullanıcının profili değil, varsayılan "Dengeli" profil.
    // Gün gün çeşit: ızgara türü ve (Türkiye ağırlıklı / dünya) karışımı tohumdan seçilir.
    const tur = ["kulup", "karma", "ulke", "kulup"][Math.floor(rnd() * 4)];
    const pr = rnd() < 0.5 ? null : profilDerle(VARSAYILAN_PROFIL);
    const izgara = izgaraUret(veriSeti, zorlukAyari10(4), rnd, tur, pr);
    if (izgara) return { izgara, no: gunNumarasi() };
  }
  return null;
}

export function kareCevaplari(veriSeti, izgara, indis) {
  return hucreCevaplari(veriSeti, izgara, Math.floor(indis / 3), indis % 3);
}

// Nadirlik: tanınırlığı düşük doğru cevap daha değerli (0–100, yüksek = nadir).
export function nadirlik(ad) {
  return Math.max(0, Math.round(100 - taninirlik(ad)));
}

export function izgaraPaylasim(no, kareler, toplamNadirlik) {
  const satir = (r) => [0, 1, 2].map((c) => (kareler[r * 3 + c] ? "🟩" : "⬜")).join("");
  const dogru = kareler.filter(Boolean).length;
  return [
    `⚽ 3-2-1: Bitir İşi — Günlük Izgara #${no}`,
    `${dogru} / 9 · nadirlik ${toplamNadirlik}`,
    satir(0), satir(1), satir(2),
    "Sen kaç kare alırsın?",
  ].join("\n");
}

export { kosulEtiketi };
