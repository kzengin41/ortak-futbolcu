// ============================================================================
// ONLINE "İLK HARFTEN BUL" — SAF OYUN MANTIĞI (12 Eylül 2026)
//
// Bu mod zaten çalışıyordu ama ekranın içinde, üç ciddi kusurla:
//   1) Cevap kontrolü `name.toLowerCase().includes(girdi)` idi. Yani "a"
//      yazmak listedeki ilk ismi kabul ediyordu — modun tamamı bir harfle
//      sömürülebiliyordu. Artık findMatchedPlayer (projenin her yerinde
//      kullanılan, aksan/soyad toleranslı eşleştirici) kullanılıyor.
//   2) `subscribe` geri çağrısı BAYAT `phase` okuyordu (kapanış sorunu), bu
//      yüzden ilk durum bazen hiç yayınlanmıyordu.
//   3) Aynı futbolcu tekrar tekrar kabul ediliyordu — mod rehberi "aynı
//      futbolcu iki kez kabul edilmez" diye söz vermesine rağmen.
//
// Kurallar artık burada, saf ve test edilebilir. Ağ katmanı lib/onlineRoom.js.
//
// İKİ ÇEŞİT: "letter"  -> harfleri host RASTGELE belirler,
//            "letter2" -> her oyuncu birer harf seçer (lobideki "Sen Seç").
// ============================================================================
import { findMatchedPlayer } from "./gameEngine";

export const HEDEF_PUAN = 3;
export const TUR_ARASI_MS = 3500;
export const HARF_GOSTERIM_MS = 1400;   // harfler açıldıktan sonra yarış başlar

// Türkçe adları latin alfabesine indirger: "Şükrü" -> "S", "İlhan" -> "I".
const HARF_ESLEME = { Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U" };
export function ilkHarf(kelime) {
  if (!kelime) return "";
  const c = String(kelime).trim()[0]?.toLocaleUpperCase("tr-TR") || "";
  return HARF_ESLEME[c] || c;
}

// "Zinedine Zidane" -> "Z-Z" ; "Arda Turan" -> "A-T" (sıralı, yani harf sırası
// önemli değil — CPU sürümündeki classicMap ile birebir aynı kural).
export function harfCifti(ad) {
  const parcalar = String(ad || "").split(" ").filter(Boolean);
  if (parcalar.length < 2) return null;
  const f = ilkHarf(parcalar[0]);
  const l = ilkHarf(parcalar[parcalar.length - 1]);
  if (f >= "A" && f <= "Z" && l >= "A" && l <= "Z") return [f, l].sort().join("-");
  return null;
}

export function kurHarfHaritasi(veriSeti) {
  const harita = new Map();
  for (const p of veriSeti) {
    const cift = harfCifti(p.name);
    if (!cift) continue;
    if (!harita.has(cift)) harita.set(cift, []);
    harita.get(cift).push(p);
  }
  return harita;
}

export const ALFABE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Yeterince cevabı olan harf çiftleri — rastgele atamada "hiç cevabı olmayan"
// bir çift çıkarsa tur oynanamaz hale gelirdi.
export const ASGARI_CEVAP = 8;
export function uygunCiftler(harita, asgari = ASGARI_CEVAP) {
  const sonuc = [];
  for (const [cift, liste] of harita) if (liste.length >= asgari) sonuc.push(cift);
  return sonuc;
}

export function baslangicDurumu(cesit = "letter2", ilkSecen = 1) {
  return {
    cesit,                       // "letter" | "letter2"
    faz: cesit === "letter" ? "hazirlik" : "secim",
    // hazirlik | secim | harfler | yaris | turSonu | macSonu
    turNo: 1,
    secen: ilkSecen,             // "letter2": sırası gelen seçici
    harfP1: null,                // ilk seçilen harf (sahibi `secen`)
    harfP2: null,                // ikinci seçilen harf
    kullanilanCiftler: [],
    sonCevap: null,              // { kimden, metin, dogru, ad }
    soylenenler: [],             // bu MAÇ boyunca kabul edilmiş isimler
    turKazanani: null,
    skorlar: { p1: 0, p2: 0 },
  };
}

export function digeri(n) {
  return n === 1 ? 2 : 1;
}

export function aksiyonuIsle(durum, aksiyon, kimden, baglam) {
  if (!durum || !aksiyon) return null;
  const { harita, rastgele = Math.random } = baglam || {};

  switch (aksiyon.tip) {
    // "letter" çeşidi: harfleri host rastgele belirler.
    case "rastgeleHarfler": {
      if (durum.faz !== "hazirlik" && durum.faz !== "turSonu") return null;
      const cift = rastgeleCift(durum, harita, rastgele);
      if (!cift) return { ...durum, faz: "macSonu" };
      const [a, b] = cift.split("-");
      return { ...durum, faz: "harfler", harfP1: a, harfP2: b, sonCevap: null, turKazanani: null };
    }

    case "harfSec": {
      if (durum.faz !== "secim") return null;
      if (kimden !== durum.secen) return null;          // sıra sende değil
      const harf = String(aksiyon.harf || "").toUpperCase();
      if (!ALFABE.includes(harf)) return null;

      // İlk harf: sıra karşıya geçiyor.
      if (!durum.harfP1) {
        return { ...durum, harfP1: harf, secen: digeri(durum.secen), secimReddedildi: 0 };
      }

      // İkinci harf: ikili bu maçta oynandıysa ya da hiç cevabı yoksa seçim
      // reddedilir (durum bozulmadan, ekran "başka harf dene" diyor).
      const cift = [durum.harfP1, harf].sort().join("-");
      const liste = harita?.get(cift) || [];
      if (durum.kullanilanCiftler.includes(cift) || liste.length < ASGARI_CEVAP) {
        return { ...durum, secimReddedildi: (durum.secimReddedildi || 0) + 1 };
      }
      return { ...durum, faz: "harfler", harfP2: harf, secimReddedildi: 0 };
    }

    // Harfler kısa süre gösterildi, yarış başlıyor.
    case "yarisBasla": {
      if (durum.faz !== "harfler") return null;
      return { ...durum, faz: "yaris" };
    }

    case "cevap": {
      if (durum.faz !== "yaris") return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;

      const cift = [durum.harfP1, durum.harfP2].sort().join("-");
      const aday = harita?.get(cift) || [];
      const eslesen = findMatchedPlayer(metin, aday);

      if (!eslesen) return { ...durum, sonCevap: { kimden, metin, dogru: false, ad: null } };

      // Mod rehberi: "Aynı futbolcu iki kez kabul edilmez."
      if (durum.soylenenler.includes(eslesen.name)) {
        return { ...durum, sonCevap: { kimden, metin, dogru: false, ad: eslesen.name, tekrar: true } };
      }

      const anahtar = `p${kimden}`;
      const skorlar = { ...durum.skorlar, [anahtar]: durum.skorlar[anahtar] + 1 };
      return {
        ...durum,
        faz: skorlar[anahtar] >= HEDEF_PUAN ? "macSonu" : "turSonu",
        skorlar,
        turKazanani: kimden,
        soylenenler: [...durum.soylenenler, eslesen.name],
        sonCevap: { kimden, metin, dogru: true, ad: eslesen.name },
      };
    }

    case "sonrakiTur": {
      if (durum.faz !== "turSonu") return null;
      const cift = [durum.harfP1, durum.harfP2].sort().join("-");
      const temel = {
        ...durum,
        turNo: durum.turNo + 1,
        kullanilanCiftler: [...durum.kullanilanCiftler, cift],
        harfP1: null,
        harfP2: null,
        sonCevap: null,
        turKazanani: null,
      };
      if (durum.cesit === "letter") {
        const yeni = rastgeleCift(temel, harita, rastgele);
        if (!yeni) return { ...temel, faz: "macSonu" };
        const [a, b] = yeni.split("-");
        return { ...temel, faz: "harfler", harfP1: a, harfP2: b };
      }
      // "Sen seç" çeşidinde ilk seçim hakkı turu KAYBEDENE geçiyor —
      // küçük ama hissedilen bir denge unsuru.
      const kaybeden = durum.turKazanani ? digeri(durum.turKazanani) : durum.secen;
      return { ...temel, faz: "secim", secen: kaybeden };
    }

    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu(durum.cesit);
    }

    default:
      return null;
  }
}

function rastgeleCift(durum, harita, rastgele) {
  const havuz = uygunCiftler(harita || new Map()).filter(
    (c) => !durum.kullanilanCiftler.includes(c)
  );
  if (!havuz.length) return null;
  return havuz[Math.floor(rastgele() * havuz.length)];
}
