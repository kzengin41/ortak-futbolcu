// ============================================================================
// ONLINE "KİM BU FUTBOLCU?" — AYNI MASADA DÜELLO (Paket 13, 5 Ekim 2026)
//
// Benchmark (Kim Bu — yeni kurgu, Modlar): "Online düello: iki oyuncu aynı
// masada; kart çevirmek ikisine de açılır, ilk bilen alır."
//
// 12 Eylül sürümü zamanla açılan bir ipucu listesiydi. Artık tek kişilik
// modla AYNI kart masası (lib/kimBuMasa.js):
//   • Masa ortak. Kartı kim çevirirse çevirsin İKİSİNE de açılır ve
//     "şimdi bilirsen" potu İKİSİ için birden düşer. Kart çevirmek bilgi
//     verir ama rakibe de verir — strateji bu.
//   • İlk doğru tahmin turu ve o anki potu (turPuani: kart çevirmeden ×2,
//     1–2 kartla ×1,5) alır.
//   • Yanlış tahmin: karşılaştırma satırı masaya düşer (ikisi de görür),
//     ortak kulüp varsa o kariyer kartı bedava açılır, tahmin eden oyuncu
//     BİR SONRAKİ KART ÇEVRİLENE kadar kilitlenir (isim yağdırmak yasak).
//   • Pas: o turdan çekil. İkisi de pas geçerse ya da ikisi de kilitliyken
//     çevrilebilecek kart kalmazsa tur kimseye yazılmadan kapanır.
//   • HEDEF_TUR turu alan maçı alır; rövanş onlineRoom.rovansli ile.
//
// SAF dosya: veri işleri (masa kurma, karşılaştırma, isim eşleme) `baglam`
// ile dışarıdan gelir; Node testleri sahte bağlamla çalıştırır.
//   baglam = { yeniMasa(kullanilanlar) -> { gizli, masa } | null,
//              gizliMi(metin, gizli) -> bool,
//              oyuncuBul(metin) -> { name } | null,
//              karsilastirAd(tahminAd, gizli) -> satır | null }
// ============================================================================
import { acilabilirMi, ortakKartlariAc, turPuani as masaPuani, simdiBilirsen, tumKartlar } from "./kimBuMasa";

export const TUR_ARASI_MS = 6500;   // tur sonu açılışı + skor
export const HEDEF_TUR = 3;

export function baslangicDurumu() {
  return {
    faz: "hazirlik",          // hazirlik | oynaniyor | turSonu | macSonu
    turNo: 0,
    gizli: null,
    masa: null,
    acik: {},
    tahminler: [],            // karşılaştırma satırları + kimden
    kilitli: [],
    pas: [],
    kullanilanlar: [],
    skorlar: { p1: 0, p2: 0 },
    turlar: { p1: 0, p2: 0 },
    turKazanani: null,        // 1 | 2 | 0
    turPuani: 0,
    sonOlay: null,            // { tip, kimden, ... } — ekran geri bildirimi
    rovansIstek: [],
  };
}

const anahtar = (n) => `p${n}`;

function yeniTur(durum, baglam) {
  const s = baglam && baglam.yeniMasa ? baglam.yeniMasa(durum.kullanilanlar || []) : null;
  if (!s) return { ...durum, faz: "hata" };
  return {
    ...durum,
    faz: "oynaniyor",
    turNo: (durum.turNo || 0) + 1,
    gizli: s.gizli,
    masa: s.masa,
    acik: { ...(s.masa.acik || {}) },
    tahminler: [],
    kilitli: [],
    pas: [],
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

// İkisi de oyun dışıysa (kilit/pas) ve kilidi açacak kart yoksa tur biter.
function cikmazMi(durum) {
  const disarida = new Set([...durum.kilitli, ...durum.pas]);
  if (!(disarida.has(1) && disarida.has(2))) return false;
  if (durum.pas.includes(1) && durum.pas.includes(2)) return true;
  return !tumKartlar(durum.masa).some((k) => acilabilirMi(durum.masa, durum.acik, k));
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
      if (durum.faz !== "oynaniyor" || durum.pas.includes(kimden)) return null;
      const kart = tumKartlar(durum.masa).find((k) => k.id === aksiyon.id);
      if (!kart || !acilabilirMi(durum.masa, durum.acik, kart)) return null;
      // Kart çevrilince kilitler açılır (yeni bilgi = yeni tahmin hakkı).
      return { ...durum, acik: { ...durum.acik, [kart.id]: "satin" }, kilitli: [], sonOlay: { tip: "kart", kimden, id: kart.id } };
    }

    case "tahmin": {
      if (durum.faz !== "oynaniyor") return null;
      if (durum.kilitli.includes(kimden) || durum.pas.includes(kimden)) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;
      if (baglam.gizliMi(metin, durum.gizli)) {
        const puan = masaPuani(durum.masa, durum.acik);
        return turuKapat(durum, kimden, puan, { tip: "dogru", kimden, ad: durum.gizli });
      }
      const o = baglam.oyuncuBul(metin);
      if (!o) return { ...durum, sonOlay: { tip: "bilinmeyen", kimden, metin } };
      if (durum.tahminler.some((t) => t.ad === o.name)) return { ...durum, sonOlay: { tip: "tekrar", kimden, ad: o.name } };
      const satir = baglam.karsilastirAd(o.name, durum.gizli) || { ad: o.name, bayrak: "yok", mevki: "yok", yas: "yok", lig: "yok", kulup: "hayir", ortakKulupler: [] };
      const bedava = ortakKartlariAc(durum.masa, durum.acik, satir.ortakKulupler || []);
      const acik = { ...durum.acik };
      for (const id of bedava) acik[id] = "bedava";
      const sonraki = {
        ...durum,
        acik,
        tahminler: [{ ...satir, kimden }, ...durum.tahminler],
        kilitli: [...durum.kilitli, kimden],
        sonOlay: { tip: "yanlis", kimden, ad: o.name, bedava: bedava.length, ortak: satir.ortakKulupler || [] },
      };
      return cikmazMi(sonraki) ? turuKapat(sonraki, 0, 0, { tip: "kimse" }) : sonraki;
    }

    case "pas": {
      if (durum.faz !== "oynaniyor" || durum.pas.includes(kimden)) return null;
      const sonraki = { ...durum, pas: [...durum.pas, kimden], sonOlay: { tip: "pas", kimden } };
      return cikmazMi(sonraki) ? turuKapat(sonraki, 0, 0, { tip: "kimse" }) : sonraki;
    }

    // Yalnızca iki taraf da istediğinde çağrılır (onlineRoom.rovansli).
    case "rovans":
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu();

    default:
      return null;
  }
}

// Ortak "şimdi bilirsen" potu (çarpan afişte ayrıca gösterilir).
export function pot(durum) {
  return durum && durum.masa ? simdiBilirsen(durum.masa, durum.acik) : 0;
}
