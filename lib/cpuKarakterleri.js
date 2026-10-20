import { _t } from "./dil";
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
    id: "cem", ad: _t("Çaylak Cem"), avatar: "🧢", renk: "#7DD3FC", aralik: [1, 2],
    unvan: _t("Futbola yeni ısınıyor"),
    tepkiler: {
      dusunuyor: [_t("Hmm, dur bir düşüneyim…"), _t("Bu ikisi… tanıdık geliyor")],
      dogru: [_t("Oha, bildim!"), _t("Şansıma geldi!"), _t("Bunu babam söylemişti!")],
      yanlis: [_t("Bilemedim ya…"), _t("Bu çok zormuş"), _t("Pas geçiyorum")],
      kaptirdi: [_t("Hızlıymışsın!"), _t("Ben de biliyordum ama…")],
      kazandi: [_t("Ben bile kazandım, inanamıyorum!")],
      kaybetti: [_t("Helal olsun, çok iyisin!"), _t("Bir dahakine!")],
    },
  },
  {
    id: "murat", ad: _t("Mahalle Murat"), avatar: "⚽", renk: "#A3E635", aralik: [3, 4],
    unvan: _t("Halı saha müdavimi"),
    tepkiler: {
      dusunuyor: [_t("Halı sahada konuşmuştuk bunu…"), _t("Dilimin ucunda")],
      dogru: [_t("Bunu herkes bilir!"), _t("Kolay geldi bu"), _t("Gol!")],
      yanlis: [_t("Aklıma gelmedi be"), _t("Bu ikili zor"), _t("Geç geç")],
      kaptirdi: [_t("Ağzımdan aldın!"), _t("Tamam, bu seninki")],
      kazandi: [_t("Mahallenin kralı benim!")],
      kaybetti: [_t("Rövanş isterim!"), _t("İyi oynadın")],
    },
  },
  {
    id: "kenan", ad: _t("Kahveci Kenan"), avatar: "☕", renk: "#FDB913", aralik: [5, 6],
    unvan: _t("Her maçı izler, her şeyi bilir (sanır)"),
    tepkiler: {
      dusunuyor: [_t("Çayımı alayım, söylerim…"), _t("Bunu biliyorum, bekle")],
      dogru: [_t("Kahvede bunu bilmeyen yok!"), _t("Ezbere bilirim"), _t("Tamamdır!")],
      yanlis: [_t("Hay aksi, unuttum"), _t("Bu sefer sende"), _t("Yaşlandık…")],
      kaptirdi: [_t("Dilimin ucundaydı!"), _t("Bunu bilmem lazımdı")],
      kazandi: [_t("Kahvenin şampiyonu yine ben!")],
      kaybetti: [_t("Bugün senin günün"), _t("İyi oynadın")],
    },
  },
  {
    id: "selim", ad: _t("Spiker Selim"), avatar: "🎙️", renk: "#F472B6", aralik: [7, 8],
    unvan: _t("Maç anlatır, isim kaçırmaz"),
    tepkiler: {
      dusunuyor: [_t("Ve topu alıyor…"), _t("Hafızamı yokluyorum")],
      dogru: [_t("Ve gooool!"), _t("Bunu canlı yayında anlattım!"), _t("Nefis bir cevap!")],
      yanlis: [_t("Kaçırdım, tribünler sessiz"), _t("Bu sefer direkten döndü"), "Pas"],
      kaptirdi: [_t("Ve rakip önde!"), _t("Son anda kaptırdım")],
      kazandi: [_t("Maçın adamı belli oldu!")],
      kaybetti: [_t("Ayakta alkışlıyorum!"), _t("Muhteşem bir performans")],
    },
  },
  {
    id: "ahmet", ad: _t("Ansiklopedi Ahmet"), avatar: "📚", renk: "#C084FC", aralik: [9, 10],
    unvan: _t("Kariyer sayfalarını ezbere bilir"),
    tepkiler: {
      dusunuyor: [_t("Kaynaklara bakıyorum…"), _t("1997–98 sezonu… evet")],
      dogru: [_t("Elbette."), _t("Kayıtlara geçsin."), _t("Bu çok kolaydı.")],
      yanlis: [_t("İlginç, bu kayıt bende yok"), _t("Bunu araştırmam lazım"), "Pas"],
      kaptirdi: [_t("Doğru. Not aldım."), _t("Hızlı bir cevap")],
      kazandi: [_t("Bilgi güçtür.")],
      kaybetti: [_t("Etkileyici. Not alıyorum."), _t("Seni kütüphaneye bekliyorum")],
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
  const ad = typeof k === "string" ? k : (k && k.ad) || _t("CPU");
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
