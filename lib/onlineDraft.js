// ============================================================================
// ONLINE "ORTAK KULÜP — SEN SEÇ" — SAF OYUN MANTIĞI (12 Eylül 2026)
//
// Mod rehberinde oyuncuya verilen söz:
//   "Sırayla takım seçersiniz: birinizin seçtiği takım diğerinin sorusu olur.
//    Zor takım seçmek rakibi zorlar ama tur sana da dönecek."
//
// Yani bu bir YARIŞ değil, sıra tabanlı bir düello: seçen kişi soruyu kurar,
// CEVAP VEREN karşı taraftır. Bilirse puan onun, bilemezse puan soruyu kurana.
//
// SÖMÜRÜ RİSKİ VE ÇÖZÜMÜ: "bilemezse puan seçene" kuralı tek başına, en
// bilinmedik kulübü seçmeyi kusursuz strateji yapardı. İki fren koyuldu:
//   1) Seçilebilir kulüpler veri setinde EN AZ `ASGARI_KULUP_OYUNCU` oyuncusu
//      olanlarla sınırlı (öneri listesi de sadece onları gösteriyor).
//   2) İkinci takımı SEÇEN DEĞİL motor belirliyor ve tur ancak EN AZ
//      `ASGARI_GECERLI_CEVAP` geçerli cevabı varsa kabul ediliyor.
// Böylece "zor" seçim hâlâ mümkün, "imkansız" seçim değil.
// ============================================================================
import { generateDraftRound, findMatchedPlayer, buildClubSuggestIndex, rezervTakimMi } from "./gameEngine";
import { canonicalClub } from "./clubAliases";

export const CEVAP_SURESI_MS = 20000;   // cevap verenin süresi
export const TUR_ARASI_MS = 4500;       // sonuç ekranının süresi
export const HEDEF_PUAN = 5;            // maçı kazanmak için gereken puan
export const ASGARI_KULUP_OYUNCU = 15;  // seçilebilir kulüp için asgari oyuncu
export const ASGARI_GECERLI_CEVAP = 2;  // tur kabul edilsin diye asgari cevap
export const VARSAYILAN_ZORLUK = 4;     // bkz. turUret
export const URETIM_DENEMESI = 30;

export function rakip(n) {
  return n === 1 ? 2 : 1;
}

// Öneri indeksi: sadece yeterince kalabalık kulüpler. `buildClubSuggestIndex`
// zaten rezerv takımları ve sıfır oyunculu kayıtları eliyor; buradaki eşik
// onun üstüne biniyor.
export function secilebilirKulupIndeksi(kuluplerListesi, veriSeti) {
  return buildClubSuggestIndex(kuluplerListesi, veriSeti)
    .filter((k) => k.oyuncu >= ASGARI_KULUP_OYUNCU);
}

// generateDraftRound ikinci takımı ZORLUĞA göre seçiyor: 5-7 aralığında
// adaylar rastgele karıştırılıyor ve olası teamB'lerin ezici çoğunluğunun
// seçilen kulüple ORTAK TEK oyuncusu var. Yani tek çağrıda gelen turun çoğu
// zaman bir tek geçerli cevabı oluyor — tek bir isim bilinmezse tur bitiyor,
// üstelik "CFR Timișoara" gibi kimsenin tanımadığı bir eşleşmeyle.
//
// Online'da bu kabul edilemez (rakip soruyu kuruyor; şansa bırakılamaz), o
// yüzden iki fren: varsayılan zorluk 4 (adaylar ORTAK OYUNCU SAYISINA GÖRE
// azalan sıralanıyor, yani tanıdık ve dolu eşleşmeler öne geliyor) ve yeterli
// cevabı olan bir tur çıkana kadar tekrar deneme.
function turUret(kulup, veriSeti, kullanilan, izinliKulupler, zorluk = VARSAYILAN_ZORLUK) {
  for (let i = 0; i < URETIM_DENEMESI; i++) {
    const tur = generateDraftRound(kulup, veriSeti, kullanilan, izinliKulupler, zorluk);
    if (!tur) return null;                       // bu kulüpten hiç tur çıkmıyor
    if (turKabulEdilirMi(tur)) return tur;
  }
  return null;
}

// İkinci takım motordan geliyor ve motor oyuncunun HAM kulüp listesine bakıyor —
// yani rezerv/altyapı takımları da aday. Denemede "Real Madrid + Real Madrid C"
// çıktı: 111 geçerli cevap, hepsi altyapıdan, soru olarak hiçbir değeri yok.
// Aynı kulüp ailesinden bir eşleşme de anlamsız ("Beşiktaş + Beşiktaş JK").
function turKabulEdilirMi(tur) {
  const cevapSayisi = (tur.validAnswers || []).length;
  if (cevapSayisi < ASGARI_GECERLI_CEVAP) return false;
  if (rezervTakimMi(tur.teamB)) return false;
  const a = canonicalClub(tur.teamA) || tur.teamA;
  const b = canonicalClub(tur.teamB) || tur.teamB;
  if (a === b) return false;
  return true;
}

export function baslangicDurumu(ilkSecen = 1) {
  return {
    faz: "secim",            // secim | cevap | turSonu | macSonu
    turNo: 1,
    secen: ilkSecen,         // kulübü seçen oyuncu
    teamA: null,
    teamB: null,
    gecerliCevaplar: [],     // [{ name }]
    cevapBitis: 0,           // epoch ms — cevap verenin süresi
    turKazanani: null,       // 1 | 2 | 0
    sonCevap: null,          // { metin, dogru }
    skorlar: { p1: 0, p2: 0 },
    kullanilanCiftler: [],
  };
}

// Host'un çalıştırdığı indirgeyici. veriSeti + izinliKulupler dışarıdan gelir.
export function aksiyonuIsle(durum, aksiyon, kimden, baglam) {
  if (!durum || !aksiyon) return null;
  const { veriSeti, izinliKulupler, zorluk = VARSAYILAN_ZORLUK } = baglam || {};

  switch (aksiyon.tip) {
    case "kulupSec": {
      if (durum.faz !== "secim") return null;
      if (kimden !== durum.secen) return null;         // sıra sende değil
      const kulup = String(aksiyon.kulup || "").trim();
      if (!kulup) return null;

      const kullanilan = new Set(durum.kullanilanCiftler);
      const tur = turUret(kulup, veriSeti, kullanilan, izinliKulupler, zorluk);
      if (!tur) {
        // Seçim tura dönüşemedi — durumu bozmadan reddediyoruz; ekran
        // `secimReddedildi` sayacına bakıp kullanıcıya "başka takım dene" diyor.
        return { ...durum, secimReddedildi: (durum.secimReddedildi || 0) + 1 };
      }

      return {
        ...durum,
        faz: "cevap",
        teamA: tur.teamA,
        teamB: tur.teamB,
        gecerliCevaplar: tur.validAnswers.map((p) => ({ name: p.name, clubs: p.clubs })),
        cevapBitis: Date.now() + CEVAP_SURESI_MS,
        turKazanani: null,
        sonCevap: null,
        secimReddedildi: 0,
      };
    }

    case "cevap": {
      if (durum.faz !== "cevap") return null;
      if (kimden !== rakip(durum.secen)) return null;  // cevap sırası karşıda
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;

      const eslesen = findMatchedPlayer(metin, durum.gecerliCevaplar);
      if (eslesen) return turuKapat(durum, kimden, { metin, dogru: true, ad: eslesen.name });
      // Yanlış cevap turu BİTİRMEZ; süre dolana kadar tekrar denenebilir —
      // tek deneme hakkı, yazım hatasını maç kaybına çevirirdi.
      return { ...durum, sonCevap: { metin, dogru: false } };
    }

    // Süre doldu (host tetikler) ya da cevap veren pes etti.
    case "sureDoldu":
    case "pes": {
      if (durum.faz !== "cevap") return null;
      if (aksiyon.tip === "pes" && kimden !== rakip(durum.secen)) return null;
      return turuKapat(durum, durum.secen, { metin: null, dogru: false, ad: null });
    }

    case "sonrakiTur": {
      if (durum.faz !== "turSonu") return null;
      const kullanilanCiftler = durum.teamA && durum.teamB
        ? [...durum.kullanilanCiftler, [durum.teamA, durum.teamB].sort().join("|")]
        : durum.kullanilanCiftler;
      return {
        ...durum,
        faz: "secim",
        turNo: durum.turNo + 1,
        secen: rakip(durum.secen),     // sıra dönüyor
        teamA: null,
        teamB: null,
        gecerliCevaplar: [],
        cevapBitis: 0,
        turKazanani: null,
        sonCevap: null,
        kullanilanCiftler,
      };
    }

    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      // Rövanşta ilk seçim hakkı MAÇI KAYBEDENDE — küçük ama hissedilen bir
      // telafi.
      const kaybeden = durum.skorlar.p1 > durum.skorlar.p2 ? 2 : 1;
      return baslangicDurumu(kaybeden);
    }

    default:
      return null;
  }
}

function turuKapat(durum, kazanan, sonCevap) {
  const anahtar = `p${kazanan}`;
  const skorlar = { ...durum.skorlar, [anahtar]: durum.skorlar[anahtar] + 1 };
  return {
    ...durum,
    faz: skorlar[anahtar] >= HEDEF_PUAN ? "macSonu" : "turSonu",
    skorlar,
    turKazanani: kazanan,
    sonCevap,
  };
}

// Sonuç ekranında gösterilecek örnek cevaplar (en fazla `adet` tane).
export function ornekCevaplar(durum, adet = 6) {
  return (durum.gecerliCevaplar || []).slice(0, adet).map((p) => p.name);
}
