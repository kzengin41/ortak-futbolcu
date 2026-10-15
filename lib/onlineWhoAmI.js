// ============================================================================
// ONLINE "KİM BU FUTBOLCU?" — SIRAYLA OYNANAN MASA (Paket 37, 16 Ekim 2026)
//
// Kerem: "online kim bu?'da yeni bir yapı olması lazım. ortak pot'u bir taraf
// spamlayıp azaltabiliyor. herkesin kendi pot'u olsun." Seçtiği kurgu:
// "Sırayla oyna".
//
// ESKİ (Paket 13): masa ve pot ORTAKTI, hamleler serbestti. Bir taraf art arda
// kart çevirip rakibinin de potunu eritebiliyordu.
// YENİ:
//   • Masa ortak (çevrilen kart ikinize de açılır), POT HERKESİN KENDİNE.
//     İkiniz de 10.000 ile başlarsınız.
//   • Hamleler SIRAYLA. Sıran gelince ya BİR kart çevirirsin (bedeli SENİN
//     potundan düşer) ya da BİR tahmin yaparsın. Sonra sıra rakibe geçer.
//     → Kart çevirmek bilgi verir ama rakibe de verir; o yüzden çevirmek
//       bedava değil, bekleyip rakibin çevirmesini ummak da riskli. Satranç gibi.
//   • Yanlış tahmin: potundan 1.000 düşer, karşılaştırma satırı masaya düşer
//     (ikiniz de görürsünüz), ortak kulüp varsa o kariyer kartı bedava açılır.
//   • Doğru tahmin turu alır: kendi potun × (hiç kart almadıysan 1,5; 1–2 kart
//     aldıysan 1,25; daha çoksa 1).
//   • Her hamlenin süresi HAMLE_SURESI_SN. Süre dolarsa senin yerine en ucuz
//     (potunun yettiği) kart çevrilir; yetmiyorsa sıra rakibe geçer.
//   • "Pes": bu turdan çekilirsin, rakip tek başına oynamaya devam eder.
//     İkiniz de pes ederseniz ya da AZAMI_HAMLE dolarsa tur kimseye yazılmaz.
//   • Turları sırayla açarsınız (1. turu ev sahibi, 2.'yi misafir…).
//   • HEDEF_TUR turu alan maçı alır; rövanş onlineRoom.rovansli ile.
//
// SAF dosya: veri işleri (masa kurma, karşılaştırma, isim eşleme) `baglam`
// ile dışarıdan gelir; Node testleri sahte bağlamla çalıştırır.
//   baglam = { yeniMasa(kullanilanlar, turNo) -> { gizli, masa } | null,
//              gizliMi(metin, gizli) -> bool,
//              oyuncuBul(metin) -> { name } | null,
//              karsilastirAd(tahminAd, gizli) -> satır | null }
// ============================================================================
import { ortakKartlariAc, tumKartlar, BASLANGIC_PUANI, ASGARI_PUAN } from "./kimBuMasa";

export const TUR_ARASI_MS = 6500;   // tur sonu açılışı + skor
export const HEDEF_TUR = 3;
export const HAMLE_SURESI_SN = 25;
export const YANLIS_CEZA = 1000;
export const AZAMI_HAMLE = 24;

const anahtar = (n) => `p${n}`;
const rakibi = (n) => (n === 1 ? 2 : 1);

export function baslangicDurumu() {
  return {
    faz: "hazirlik",          // hazirlik | oynaniyor | turSonu | macSonu
    turNo: 0,
    gizli: null,
    masa: null,
    acik: {},                 // kartId -> "baslangic" | "satin" | "bedava"
    alan: {},                 // kartId -> 1 | 2 (satın alan)
    potlar: { p1: BASLANGIC_PUANI, p2: BASLANGIC_PUANI },
    alinan: { p1: 0, p2: 0 }, // bu turda satın alınan kart sayısı
    sira: 1,
    hamleNo: 0,
    tahminler: [],            // karşılaştırma satırları + kimden
    pes: [],
    kullanilanlar: [],
    skorlar: { p1: 0, p2: 0 },
    turlar: { p1: 0, p2: 0 },
    turKazanani: null,        // 1 | 2 | 0
    turPuani: 0,
    sonOlay: null,            // { tip, kimden, ... } — ekran geri bildirimi
    rovansIstek: [],
  };
}

// Oyuncunun potu (taban 1.000'in altına inmez).
export function potu(durum, n) {
  const p = durum && durum.potlar ? durum.potlar[anahtar(n)] : BASLANGIC_PUANI;
  return Math.max(ASGARI_PUAN, p);
}
export function carpani(durum, n) {
  const a = (durum && durum.alinan && durum.alinan[anahtar(n)]) || 0;
  if (a === 0) return 1.5;
  if (a <= 2) return 1.25;
  return 1;
}
export function turPuani(durum, n) {
  return Math.round(potu(durum, n) * carpani(durum, n));
}
// Bu oyuncu bu kartı KENDİ potundan alabilir mi?
export function alabilirMi(durum, n, kart) {
  if (!kart || durum.acik[kart.id]) return false;
  return durum.potlar[anahtar(n)] - kart.bedel >= ASGARI_PUAN;
}
export function enUcuzKart(durum, n) {
  return tumKartlar(durum.masa)
    .filter((k) => alabilirMi(durum, n, k))
    .sort((a, b) => a.bedel - b.bedel)[0] || null;
}

function yeniTur(durum, baglam) {
  const turNo = (durum.turNo || 0) + 1;
  const s = baglam && baglam.yeniMasa ? baglam.yeniMasa(durum.kullanilanlar || [], turNo) : null;
  if (!s) return { ...durum, faz: "hata" };
  return {
    ...durum,
    faz: "oynaniyor",
    turNo,
    gizli: s.gizli,
    masa: s.masa,
    acik: { ...(s.masa.acik || {}) },
    alan: {},
    potlar: { p1: BASLANGIC_PUANI, p2: BASLANGIC_PUANI },
    alinan: { p1: 0, p2: 0 },
    sira: turNo % 2 === 1 ? 1 : 2,
    hamleNo: 0,
    tahminler: [],
    pes: [],
    kullanilanlar: [...(durum.kullanilanlar || []), s.gizli],
    turKazanani: null,
    turPuani: 0,
    sonOlay: null,
  };
}

function turuKapat(durum, kazanan, puan, sonOlay) {
  const turlar = { ...durum.turlar };
  const skorlar = { ...durum.skorlar };
  if (kazanan) {
    turlar[anahtar(kazanan)] += 1;
    skorlar[anahtar(kazanan)] += puan;
  }
  const bitti = kazanan && turlar[anahtar(kazanan)] >= HEDEF_TUR;
  return { ...durum, faz: bitti ? "macSonu" : "turSonu", turlar, skorlar, turKazanani: kazanan || 0, turPuani: puan, sonOlay };
}

// Hamle bitti: sıra rakibe (rakip pes ettiyse sende kalır); hamle sınırı kontrolü.
function hamleBitti(durum, kimden) {
  const r = rakibi(kimden);
  const sonraki = { ...durum, hamleNo: durum.hamleNo + 1, sira: durum.pes.includes(r) ? kimden : r };
  if (sonraki.hamleNo >= AZAMI_HAMLE) return turuKapat(sonraki, 0, 0, { tip: "kimse", sebep: "hamle" });
  return sonraki;
}

function kartAl(durum, kimden, kart, olayTipi = "kart") {
  const k = anahtar(kimden);
  return {
    ...durum,
    acik: { ...durum.acik, [kart.id]: "satin" },
    alan: { ...durum.alan, [kart.id]: kimden },
    potlar: { ...durum.potlar, [k]: durum.potlar[k] - kart.bedel },
    alinan: { ...durum.alinan, [k]: (durum.alinan[k] || 0) + 1 },
    sonOlay: { tip: olayTipi, kimden, id: kart.id, bedel: kart.bedel },
  };
}

export function aksiyonuIsle(durum, aksiyon, kimden, baglam) {
  if (!durum || !aksiyon) return null;
  switch (aksiyon.tip) {
    case "baslat":
      if (durum.faz !== "hazirlik" || kimden !== 1) return null;
      return yeniTur(durum, baglam);

    case "sonrakiTur":
      if (durum.faz !== "turSonu" || kimden !== 1) return null;
      return yeniTur(durum, baglam);

    case "kartCevir": {
      if (durum.faz !== "oynaniyor" || durum.sira !== kimden || durum.pes.includes(kimden)) return null;
      const kart = tumKartlar(durum.masa).find((k) => k.id === aksiyon.id);
      if (!kart || !alabilirMi(durum, kimden, kart)) return null;
      return hamleBitti(kartAl(durum, kimden, kart), kimden);
    }

    case "tahmin": {
      if (durum.faz !== "oynaniyor" || durum.sira !== kimden || durum.pes.includes(kimden)) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;
      if (baglam.gizliMi(metin, durum.gizli)) {
        return turuKapat(durum, kimden, turPuani(durum, kimden), { tip: "dogru", kimden, ad: durum.gizli });
      }
      const o = baglam.oyuncuBul(metin);
      // Tanınmayan / tekrar isim hamle sayılmaz (yazım hatası cezalandırılmasın).
      if (!o) return { ...durum, sonOlay: { tip: "bilinmeyen", kimden, metin } };
      if (durum.tahminler.some((t) => t.ad === o.name)) return { ...durum, sonOlay: { tip: "tekrar", kimden, ad: o.name } };
      const satir = baglam.karsilastirAd(o.name, durum.gizli) || { ad: o.name, bayrak: "yok", mevki: "yok", yas: "yok", lig: "yok", kulup: "hayir", ortakKulupler: [] };
      const bedava = ortakKartlariAc(durum.masa, durum.acik, satir.ortakKulupler || []);
      const acik = { ...durum.acik };
      for (const id of bedava) acik[id] = "bedava";
      const k = anahtar(kimden);
      return hamleBitti({
        ...durum,
        acik,
        potlar: { ...durum.potlar, [k]: Math.max(ASGARI_PUAN, durum.potlar[k] - YANLIS_CEZA) },
        tahminler: [{ ...satir, kimden }, ...durum.tahminler],
        sonOlay: { tip: "yanlis", kimden, ad: o.name, bedava: bedava.length, ortak: satir.ortakKulupler || [] },
      }, kimden);
    }

    // Ev sahibinin saati: hamle süresi doldu (hamleNo eşleşmeli, arada hamle yapılmışsa yok sayılır).
    case "sureDoldu": {
      if (kimden !== 1 || durum.faz !== "oynaniyor" || aksiyon.hamleNo !== durum.hamleNo) return null;
      const n = durum.sira;
      const kart = enUcuzKart(durum, n);
      if (kart) return hamleBitti(kartAl(durum, n, kart, "sureKart"), n);
      return hamleBitti({ ...durum, sonOlay: { tip: "sure", kimden: n } }, n);
    }

    case "pes": {
      if (durum.faz !== "oynaniyor" || durum.pes.includes(kimden)) return null;
      const pes = [...durum.pes, kimden];
      if (pes.length >= 2) return turuKapat({ ...durum, pes }, 0, 0, { tip: "kimse", sebep: "pes" });
      return { ...durum, pes, sira: rakibi(kimden), hamleNo: durum.hamleNo + 1, sonOlay: { tip: "pes", kimden } };
    }

    // Yalnızca iki taraf da istediğinde çağrılır (onlineRoom.rovansli).
    case "rovans":
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu();

    default:
      return null;
  }
}
