// ============================================================================
// PAKETLİ VERİ ÇÖZÜCÜ — Paket 22 (5 Ekim 2026)
// lib/paket/*.js dosyalarını (scripts/veri_paketle.py üretir) açar. Dışarıya
// verilen nesneler eski lib/*.json nesneleriyle AYNI davranır:
//     veri["Ad Soyad"]   -> aynı değer (ilk istendiğinde çözülür, sonra önbellekte)
//     "Ad Soyad" in veri -> var mı
//     Object.keys(veri)  -> bütün adlar (gerekirse; yavaş yol)
// Biçim: değerler tek bir ASCII metinde satır satır (satır sırası = adlar.js).
// Satırdaki JSON'da "n + f" biçimli sayılar (f: 0.5, 0.375...) sözlükteki n. yazıdır.
// ============================================================================

let _adlar = null, _sira = null;
function adlar() {
  if (!_adlar) _adlar = require("./adlar").adlar;
  return _adlar;
}
function sira() {
  if (!_sira) {
    _sira = new Map();
    const a = adlar();
    for (let i = 0; i < a.length; i++) if (!_sira.has(a[i])) _sira.set(a[i], i);
  }
  return _sira;
}

function ac(x, sozluk, f, A) {
  if (typeof x === "number") return x % 1 === f ? sozluk[x - f] : x;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const y = x[i];
      if (typeof y === "number") { if (y % 1 === f) x[i] = sozluk[y - f]; }
      else if (y !== null && typeof y === "object") x[i] = ac(y, sozluk, f, A);
    }
    return x;
  }
  if (x !== null && typeof x === "object") {
    if (A.length === 0) { for (const k in x) x[k] = ac(x[k], sozluk, f, A); return x; }
    const y = {};   // "~<sıra>" kısaltılmış anahtarlar geri adlandırılır, sıra korunur
    for (const k in x) y[k.charCodeAt(0) === 126 ? A[parseInt(k.slice(1), 36)] : k] = ac(x[k], sozluk, f, A);
    return y;
  }
  return x;
}

// Tembel nesne: satır ancak o ad istendiğinde çözülür.
function tembel(satirCoz, metin) {
  let satirlar = null;
  const onbellek = new Map();
  const sat = () => satirlar || (satirlar = metin.split("\n"));
  const getir = (ad) => {
    if (onbellek.has(ad)) return onbellek.get(ad);
    const i = sira().get(ad);
    const s = i === undefined ? "" : (sat()[i] || "");
    const v = s === "" ? undefined : satirCoz(s, ad);
    onbellek.set(ad, v);
    return v;
  };
  const varMi = (ad) => getir(ad) !== undefined;
  const tumAdlar = () => {
    const a = adlar(), s = sat(), out = [];
    for (let i = 0; i < s.length; i++) if (s[i] !== "" && sira().get(a[i]) === i) out.push(a[i]);
    for (const [k, v] of onbellek) if (v !== undefined && sira().get(k) === undefined) out.push(k);
    return out;
  };
  return new Proxy({}, {
    get(_, k) { return typeof k === "string" ? getir(k) : undefined; },
    has(_, k) { return typeof k === "string" && varMi(k); },
    set(_, k, v) { onbellek.set(k, v); return true; },
    deleteProperty(_, k) { onbellek.set(k, undefined); return true; },
    ownKeys() { return tumAdlar(); },
    getOwnPropertyDescriptor(_, k) {
      if (typeof k !== "string" || !varMi(k)) return undefined;
      return { value: getir(k), writable: true, enumerable: true, configurable: true };
    },
  });
}

// f: sözlük referansının kesir kısmı (paketleyici veride hiç geçmeyen birini seçer)
// A: kısaltılmış nesne anahtarlarının asılları
function tembelNesne(sozluk, metin, f, A) {
  return tembel((s) => ac(JSON.parse(s), sozluk, f, A || []), metin);
}

function fotoNesnesi(onek, metin, ozel) {
  return tembel((s, ad) => (s === "!" ? ozel[ad] : s.charCodeAt(0) === 126 /* ~ */ ? onek + s.slice(1) : s), metin);
}

// players.json: [{ name, clubs }] — sıra ve tekrarlar korunur, hemen çözülür.
function oyuncuListesi(kulupler, metin) {
  const a = adlar();
  const satirlar = metin.split("\n");
  const out = new Array(satirlar.length);
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    const iki = s.indexOf(":");
    const k = s.slice(iki + 1);
    const clubs = k === "" ? [] : k.split(",");
    for (let j = 0; j < clubs.length; j++) clubs[j] = kulupler[parseInt(clubs[j], 36)];
    out[i] = { name: a[parseInt(s.slice(0, iki), 36)], clubs };
  }
  return out;
}

module.exports = { tembelNesne, fotoNesnesi, oyuncuListesi };
