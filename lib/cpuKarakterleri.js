// ============================================================================
// CPU KARAKTERLERİ — 4 Ekim 2026
//
// Benchmark kararı: "CPU gerçek rakip: isim, avatar, kısa tepkiler, zorluğa
// göre karakterler." Ekranda "CPU" yazmak yerine zorluğa göre bir rakip
// çıkıyor; doğru/yanlış bildiğinde ve maç sonunda kısa bir laf atıyor.
// Karakterin bildiği oyuncular yine lib/taninirlik.js eşiğiyle sınırlı.
// ============================================================================

export const KARAKTERLER = [
  {
    id: "cem", ad: "Çaylak Cem", avatar: "🧢", renk: "#7DD3FC", aralik: [1, 2],
    unvan: "Futbola yeni ısınıyor",
    tepkiler: {
      dusunuyor: ["Hmm, dur bir düşüneyim…", "Bu ikisi… tanıdık geliyor"],
      dogru: ["Oha, bildim!", "Şansıma geldi!", "Bunu babam söylemişti!"],
      yanlis: ["Bilemedim ya…", "Bu çok zormuş", "Pas geçiyorum"],
      kaptirdi: ["Hızlıymışsın!", "Ben de biliyordum ama…"],
      kazandi: ["Ben bile kazandım, inanamıyorum!"],
      kaybetti: ["Helal olsun, çok iyisin!", "Bir dahakine!"],
    },
  },
  {
    id: "murat", ad: "Mahalle Murat", avatar: "⚽", renk: "#A3E635", aralik: [3, 4],
    unvan: "Halı saha müdavimi",
    tepkiler: {
      dusunuyor: ["Halı sahada konuşmuştuk bunu…", "Dilimin ucunda"],
      dogru: ["Bunu herkes bilir!", "Kolay geldi bu", "Gol!"],
      yanlis: ["Aklıma gelmedi be", "Bu ikili zor", "Geç geç"],
      kaptirdi: ["Ağzımdan aldın!", "Tamam, bu seninki"],
      kazandi: ["Mahallenin kralı benim!"],
      kaybetti: ["Rövanş isterim!", "İyi oynadın"],
    },
  },
  {
    id: "kenan", ad: "Kahveci Kenan", avatar: "☕", renk: "#FDB913", aralik: [5, 6],
    unvan: "Her maçı izler, her şeyi bilir (sanır)",
    tepkiler: {
      dusunuyor: ["Çayımı alayım, söylerim…", "Bunu biliyorum, bekle"],
      dogru: ["Kahvede bunu bilmeyen yok!", "Ezbere bilirim", "Tamamdır!"],
      yanlis: ["Hay aksi, unuttum", "Bu sefer sende", "Yaşlandık…"],
      kaptirdi: ["Dilimin ucundaydı!", "Bunu bilmem lazımdı"],
      kazandi: ["Kahvenin şampiyonu yine ben!"],
      kaybetti: ["Bugün senin günün", "İyi oynadın"],
    },
  },
  {
    id: "selim", ad: "Spiker Selim", avatar: "🎙️", renk: "#F472B6", aralik: [7, 8],
    unvan: "Maç anlatır, isim kaçırmaz",
    tepkiler: {
      dusunuyor: ["Ve topu alıyor…", "Hafızamı yokluyorum"],
      dogru: ["Ve gooool!", "Bunu canlı yayında anlattım!", "Nefis bir cevap!"],
      yanlis: ["Kaçırdım, tribünler sessiz", "Bu sefer direkten döndü", "Pas"],
      kaptirdi: ["Ve rakip önde!", "Son anda kaptırdım"],
      kazandi: ["Maçın adamı belli oldu!"],
      kaybetti: ["Ayakta alkışlıyorum!", "Muhteşem bir performans"],
    },
  },
  {
    id: "ahmet", ad: "Ansiklopedi Ahmet", avatar: "📚", renk: "#C084FC", aralik: [9, 10],
    unvan: "Kariyer sayfalarını ezbere bilir",
    tepkiler: {
      dusunuyor: ["Kaynaklara bakıyorum…", "1997–98 sezonu… evet"],
      dogru: ["Elbette.", "Kayıtlara geçsin.", "Bu çok kolaydı."],
      yanlis: ["İlginç, bu kayıt bende yok", "Bunu araştırmam lazım", "Pas"],
      kaptirdi: ["Doğru. Not aldım.", "Hızlı bir cevap"],
      kazandi: ["Bilgi güçtür."],
      kaybetti: ["Etkileyici. Not alıyorum.", "Seni kütüphaneye bekliyorum"],
    },
  },
];

export function karakterSec(zorluk) {
  const z = Math.min(10, Math.max(1, Math.round(Number(zorluk) || 5)));
  return KARAKTERLER.find((k) => z >= k.aralik[0] && z <= k.aralik[1]) || KARAKTERLER[2];
}

export function tepki(karakter, tur, rastgele = Math.random) {
  const liste = (karakter && karakter.tepkiler && karakter.tepkiler[tur]) || [];
  return liste.length ? liste[Math.floor(rastgele() * liste.length)] : "";
}

// Yazarak cevaplanan (zil yok) turlarda CPU'nun düşünme süresi (ms).
// İnsan bir ismi ortalama 4–7 sn'de yazıyor; çok zor CPU buna yakın, kolay
// CPU yavaş.
export function dusunmeSuresi(zorluk, rastgele = Math.random) {
  const t = (Math.min(10, Math.max(1, Number(zorluk) || 5)) - 1) / 9;
  const ara = (a, b) => a + (b - a) * t;
  const en = ara(13000, 3500);
  const ek = ara(19000, 7000);
  return en + rastgele() * (ek - en);
}

// CPU'nun düşündüğü anda bildiğini söyleme olasılığı (bilse bile).
export function bilmeOlasiligi(zorluk) {
  const t = (Math.min(10, Math.max(1, Number(zorluk) || 5)) - 1) / 9;
  return 0.45 + t * 0.5;
}

// Paket 31 — rakibin adı her modda AYNI yazılır: kısa ad ("Kahveci Kenan" → "Kenan").
// Karakter nesnesi ya da ad metni alır. (Tam ad yalnız kurulumda, "Rakip" satırında.)
export function kisaAd(k) {
  const ad = typeof k === "string" ? k : (k && k.ad) || "CPU";
  return String(ad).split(" ").slice(-1)[0];
}

// Türkçe ekler (ünlü uyumu + sertleşme): "Kenan'ın", "Cem'in", "Ahmet'te", "Kenan'da".
const _SONUNLU = (ad) => { const m = String(ad).toLocaleLowerCase("tr").match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : "e"; };
export function iyelik(ad) {
  const u = _SONUNLU(ad);
  const ek = "aı".includes(u) ? "ın" : "ei".includes(u) ? "in" : "ou".includes(u) ? "un" : "ün";
  return `${ad}'${/[aeıioöuü]$/i.test(ad) ? "n" : ""}${ek}`;
}
export function bulunma(ad) {
  const u = _SONUNLU(ad);
  const sert = /[çfhkpsşt]$/i.test(ad);
  return `${ad}'${sert ? "t" : "d"}${"aıou".includes(u) ? "a" : "e"}`;
}
