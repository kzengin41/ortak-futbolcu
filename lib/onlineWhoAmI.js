// ============================================================================
// ONLINE "KİM BU FUTBOLCU?" — SAF OYUN MANTIĞI (12 Eylül 2026)
//
// CPU sürümü (WhoAmICpuScreen) tek kişilik bir ilerleme oyunu: can, seviye,
// puanla ipucu SATIN ALMA. Bunu ikiye bölmek yanlış olurdu — online'da iki
// oyuncu aynı anda oynuyor, birinin ipucu satın alması diğerini de bilgilendirir
// ve "kim önce parayı harcadı" yarışı sinir bozucu olur.
//
// Bu yüzden online kural seti farklı ve yarış odaklı:
//   • Host gizli futbolcuyu ve ipucu listesini üretir (buildWhoAmIClues).
//   • İpuçları ZAMANLA ve İKİSİNE DE AYNI ANDA açılır (IPUCU_ARALIGI sn).
//   • Kim önce doğru bilirse turu alır. Puan = o an açık olan ipucu sayısına
//     göre azalır: erken bilmek çok daha değerli.
//   • Yanlış cevap oyuncuyu BİR SONRAKİ İPUCUNA KADAR kilitler — rastgele isim
//     yağdırmak cezalandırılır ama tur elinden alınmaz. (Mod rehberinde
//     oyuncuya verilen söz de tam olarak bu.)
//   • Pas geçen oyuncu o turun dışında kalır; ikisi de pas geçerse ya da
//     ipuçları biterse tur kimseye yazılmadan kapanır.
//
// Buradaki her şey SAF: React yok, Supabase yok. Ekran sadece bunu çağırıyor,
// testler de aynı fonksiyonları doğrudan çalıştırabiliyor.
// ============================================================================
import { buildWhoAmIClues, findMatchedPlayer } from "./gameEngine";

export const IPUCU_ARALIGI_MS = 6000;   // ipuçları arası süre
export const TUR_ARASI_MS = 4000;       // sonuç ekranının süresi
export const HEDEF_TUR = 3;             // maçı kazanmak için kazanılması gereken tur
export const BASLANGIC_IPUCU = 2;       // tur başında açık gelen ipucu sayısı

// Açık ipucu sayısına göre puan. İlk ipuçlarında bilmek ciddi ödül, sonlara
// doğru bilmek sembolik. Puan sıralama/gurur içindir; MAÇI bitiren şey
// HEDEF_TUR kadar tur kazanmaktır (aşağıdaki `turlar`).
export function turPuani(acikIpucu) {
  if (acikIpucu <= 2) return 1000;
  if (acikIpucu <= 4) return 700;
  if (acikIpucu <= 6) return 450;
  if (acikIpucu <= 8) return 250;
  return 100;
}

// Havuzdan sıradaki gizli futbolcuyu seçer. `veriSeti` ekran tarafından ZATEN
// filtrelenmiş ve popülerliğe göre SIRALANMIŞ geliyor (2+ kulüp, güvenilir
// fotoğraf). Buradan hep baştan seçmek her maçta aynı isimleri getirirdi;
// tanınırlığı korumak için üst dilimden rastgele seçiyoruz.
const SECIM_DILIMI = 600;
export function siradakiOyuncu(veriSeti, kullanilanlar, rastgele = Math.random) {
  const liste = veriSeti || [];
  if (!liste.length) return null;
  const kullanilanSet = new Set(kullanilanlar || []);
  const ust = Math.min(SECIM_DILIMI, liste.length);
  for (let i = 0; i < 60; i++) {
    const aday = liste[Math.floor(rastgele() * ust)];
    if (aday && !kullanilanSet.has(aday.name)) return aday;
  }
  return liste.find((p) => !kullanilanSet.has(p.name)) || null;
}

export function yeniTurDurumu(oyuncu, turNo, oncekiDurum) {
  const ipuclari = buildWhoAmIClues(oyuncu);
  return {
    ...oncekiDurum,
    faz: "oynaniyor",
    turNo,
    gizliOyuncu: { name: oyuncu.name, clubs: oyuncu.clubs },
    ipuclari,
    acikIpucu: Math.min(BASLANGIC_IPUCU, ipuclari.length),
    kilitli: [],          // bir sonraki ipucuna kadar cevap veremeyenler
    pasGecenler: [],      // turun tamamen dışında kalanlar
    turKazanani: null,
    sonTahmin: null,
    ipucuZamani: Date.now(),
  };
}

export function baslangicDurumu() {
  return {
    faz: "hazirlik",          // hazirlik | oynaniyor | turSonu | macSonu
    turNo: 0,
    gizliOyuncu: null,
    ipuclari: [],
    acikIpucu: 0,
    kilitli: [],
    pasGecenler: [],
    turKazanani: null,        // 1 | 2 | 0 (kimse)
    sonTahmin: null,          // { kimden, metin, dogru }
    skorlar: { p1: 0, p2: 0 },
    turlar: { p1: 0, p2: 0 },
    ipucuZamani: 0,
    kullanilanlar: [],
  };
}

// Her iki oyuncu da (kilit ya da pas nedeniyle) şu an cevap veremiyor mu?
function herkesBekliyor(durum) {
  const engelli = new Set([...durum.kilitli, ...durum.pasGecenler]);
  return engelli.has(1) && engelli.has(2);
}

// Sıradaki ipucunu açar; ipucu kalmadıysa turu kimsesiz kapatır.
// Her yeni ipucu geçici kilitleri temizler — pas geçenler turun dışında kalır.
function ipucuAc(durum) {
  if (durum.acikIpucu >= durum.ipuclari.length) {
    return { ...durum, faz: "turSonu", turKazanani: 0, kilitli: [] };
  }
  return { ...durum, acikIpucu: durum.acikIpucu + 1, kilitli: [], ipucuZamani: Date.now() };
}

// Host'un çalıştırdığı indirgeyici. Dönüş: yeni durum ya da null (değişiklik yok).
export function aksiyonuIsle(durum, aksiyon, kimden, veriSeti) {
  if (!durum || !aksiyon) return null;

  switch (aksiyon.tip) {
    case "tahmin": {
      if (durum.faz !== "oynaniyor") return null;
      if (durum.kilitli.includes(kimden)) return null;
      if (durum.pasGecenler.includes(kimden)) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;

      // Eşleştirme TÜM veri setine değil, sadece gizli oyuncuya bakıyor:
      // "doğru mu" sorusunun cevabı tek bir isim. findMatchedPlayer'ın
      // takma ad/yazım toleransı burada da geçerli olsun diye tek elemanlı
      // liste veriyoruz.
      const eslesen = findMatchedPlayer(metin, [durum.gizliOyuncu]);
      const dogru = Boolean(eslesen);

      if (dogru) {
        const anahtar = `p${kimden}`;
        const kazanilan = turPuani(durum.acikIpucu);
        const skorlar = { ...durum.skorlar, [anahtar]: durum.skorlar[anahtar] + kazanilan };
        const turlar = { ...durum.turlar, [anahtar]: durum.turlar[anahtar] + 1 };
        return {
          ...durum,
          faz: turlar[anahtar] >= HEDEF_TUR ? "macSonu" : "turSonu",
          skorlar,
          turlar,
          turKazanani: kimden,
          sonTahmin: { kimden, metin, dogru: true },
        };
      }

      const kilitli = [...durum.kilitli, kimden];
      const araDurum = { ...durum, kilitli, sonTahmin: { kimden, metin, dogru: false } };
      // İkisi de (kilit ya da pas yüzünden) cevap veremiyorsa beklemenin
      // anlamı yok — sıradaki ipucunu hemen açıyoruz, bu da kilitleri temizler.
      if (herkesBekliyor(araDurum)) return ipucuAc(araDurum);
      return araDurum;
    }

    case "pas": {
      if (durum.faz !== "oynaniyor") return null;
      if (durum.pasGecenler.includes(kimden)) return null;
      const pasGecenler = [...durum.pasGecenler, kimden];
      if (pasGecenler.length >= 2) {
        return { ...durum, faz: "turSonu", pasGecenler, turKazanani: 0, sonTahmin: null };
      }
      const araDurum = { ...durum, pasGecenler, sonTahmin: null };
      if (herkesBekliyor(araDurum)) return ipucuAc(araDurum);
      return araDurum;
    }

    // Zamanlayıcıyı host çalıştırır; aksiyon olarak gelmesi testleri
    // kolaylaştırıyor (gerçek zamanı beklemeden ilerletebiliyoruz).
    case "ipucuAc":
      if (durum.faz !== "oynaniyor") return null;
      return ipucuAc(durum);

    // İlk turu başlatır (hazirlik -> oynaniyor). Host, rakip odaya girer
    // girmez kendisi tetikliyor.
    case "baslat": {
      if (durum.faz !== "hazirlik") return null;
      const ilk = siradakiOyuncu(veriSeti, durum.kullanilanlar);
      if (!ilk) return null;
      return yeniTurDurumu(ilk, 1, durum);
    }

    case "sonrakiTur": {
      if (durum.faz !== "turSonu") return null;
      const kullanilanlar = durum.gizliOyuncu
        ? [...durum.kullanilanlar, durum.gizliOyuncu.name]
        : durum.kullanilanlar;
      const aday = siradakiOyuncu(veriSeti, kullanilanlar);
      if (!aday) return { ...durum, faz: "macSonu" };
      return yeniTurDurumu(aday, durum.turNo + 1, { ...durum, kullanilanlar });
    }

    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      return { ...baslangicDurumu(), faz: "hazirlik" };
    }

    default:
      return null;
  }
}

// Bir ipucunun ekranda nasıl görüneceği — fotoğraf ipucunun metni yok,
// ekran onu PlayerPhoto ile çiziyor.
export function ipucuGorunur(ipucu) {
  return Boolean(ipucu && (ipucu.text || ipucu.type === "photo"));
}
