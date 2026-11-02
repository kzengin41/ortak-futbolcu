// ============================================================================
// GÜNLÜK ÖDÜL — Paket 44 (2 Kasım 2026)
// Kerem: "günlük bulmacaları bilince bir şeyler kazansın. kuru kuruya biliyor
// şu an."
//
// Her günlük oyun bitince bir KADEME kazanılır (performansa göre):
//   🥇 Altın   (≥ %90)  +100 XP · koleksiyona 3 yeni futbolcu
//   🥈 Gümüş   (≥ %50)   +60 XP · 2 yeni futbolcu
//   🥉 Bronz   (> 0)     +30 XP · 1 yeni futbolcu
//   🎟️ Katılım (0)       +10 XP
// Beş günlük oyunun (Bulmaca, 5 Kulüp, Izgara, Kadro, Kim Bu) hepsi aynı gün
// bitince ek "Günün hepsi" ödülü: +150 XP · 3 futbolcu.
// Yeni futbolcular tanınmış (fotoğraflı) ve henüz açılmamış isimlerden seçilir;
// Ansiklopedi'ye eklenir, seviye = açılan futbolcu sayısı olduğu için seviye
// de ilerler. Ödül günde oyun başına BİR KEZ verilir (tekrar açınca aynı sonuç
// gösterilir). Oranları her ekran kendi hesaplar (gunlukOran).
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import { _t } from "./dil";
import { gunAnahtari } from "./dailyPuzzle";

export const GUNLUK_OYUNLAR = ["bulmaca", "5kulup", "izgara", "kadro", "kimBu"];
export const KADEMELER = [
  { id: "altin", esik: 0.9, xp: 100, oyuncu: 3, ikon: "🥇", ad: _t("Altın") },
  { id: "gumus", esik: 0.5, xp: 60, oyuncu: 2, ikon: "🥈", ad: _t("Gümüş") },
  { id: "bronz", esik: 0.0001, xp: 30, oyuncu: 1, ikon: "🥉", ad: _t("Bronz") },
  { id: "katilim", esik: 0, xp: 10, oyuncu: 0, ikon: "🎟️", ad: _t("Katılım") },
];
export const HEPSI_BONUS = { xp: 150, oyuncu: 3 };
const ODUL_HAVUZU = 2500;   // en tanınmış (fotoğraflı) ilk 2500 futbolcu
const ANAHTAR = "gunluk-odul";

export function kademeBul(oran) {
  const o = Math.max(0, Math.min(1, Number(oran) || 0));
  return KADEMELER.find((k) => o >= k.esik) || KADEMELER[KADEMELER.length - 1];
}

// Oyun → başarı oranı (0–1). Ekranlar kendi değerleriyle çağırır.
export function gunlukOran(oyun, v = {}) {
  switch (oyun) {
    case "bulmaca": return v.bilindi ? [1, 0.7, 0.5][Math.max(0, (v.deneme || 1) - 1)] ?? 0.5 : 0;
    case "5kulup": return Math.min(1, (v.puan || 0) / 12);          // 15 üzerinden; 11+ altın
    case "izgara": return (v.dolu || 0) / 9;
    // Kadro: her ipucu 0,2 oyuncu sayılır (ipuçları sınırsız ama ödülü biraz düşürür).
    case "kadro": return Math.max(0, (v.bulunan || 0) - 0.2 * (v.ipucu || 0)) / 11;
    case "kimBu": return v.dogru ? [1, 0.8, 0.65, 0.5, 0.4][Math.min(4, v.tahmin || 0)] : 0;
    default: return 0;
  }
}

async function oku(tarih) {
  try {
    const h = await AsyncStorage.getItem(ANAHTAR);
    const v = h ? JSON.parse(h) : null;
    return v && v.tarih === tarih ? v : { tarih, oyunlar: {}, hepsi: null };
  } catch (e) {
    return { tarih, oyunlar: {}, hepsi: null };
  }
}
async function yaz(v) {
  try { await AsyncStorage.setItem(ANAHTAR, JSON.stringify(v)); } catch (e) {}
}

// Ödül futbolcuları: tanınmış + henüz açılmamış, rastgele.
export function odulOyunculariSec(havuz, acilmis, adet, rastgele = Math.random) {
  const kapali = havuz.filter((p) => !acilmis.has(p.name));
  const secilen = [];
  for (let i = 0; i < adet && kapali.length; i++) {
    const j = Math.floor(rastgele() * kapali.length);
    secilen.push(kapali.splice(j, 1)[0].name);
  }
  return secilen;
}

// Günün ödülünü al (oyun başına günde bir kez). Dönüş:
// { kademe, xp, oyuncular, hepsi: {xp, oyuncular} | null, yeni }
export async function gunlukOdulAl(oyun, oran, tarih = gunAnahtari()) {
  const kayit = await oku(tarih);
  if (kayit.oyunlar[oyun]) {
    const k = kayit.oyunlar[oyun];
    return { ...k, kademe: KADEMELER.find((x) => x.id === k.kademeId) || kademeBul(0), hepsi: k.hepsiBende ? kayit.hepsi : null, yeni: false };
  }
  const kademe = kademeBul(oran);
  const { getUnlockedPlayers, unlockPlayer } = require("./pokedex");
  const { taninmisHavuz } = require("./kimBuVeri");
  const { addXP } = require("./profile");
  const acilmis = new Set(await getUnlockedPlayers());
  const havuz = taninmisHavuz(ODUL_HAVUZU);
  const oyuncular = odulOyunculariSec(havuz, acilmis, kademe.oyuncu);
  oyuncular.forEach((a) => acilmis.add(a));
  const sonuc = { kademeId: kademe.id, xp: kademe.xp, oyuncular };
  kayit.oyunlar[oyun] = sonuc;
  let hepsi = null;
  if (!kayit.hepsi && GUNLUK_OYUNLAR.every((o) => kayit.oyunlar[o])) {
    hepsi = { xp: HEPSI_BONUS.xp, oyuncular: odulOyunculariSec(havuz, acilmis, HEPSI_BONUS.oyuncu) };
    kayit.hepsi = hepsi;
    sonuc.hepsiBende = true;
  }
  await yaz(kayit);
  try {
    await addXP(kademe.xp + (hepsi ? hepsi.xp : 0));
    for (const a of [...oyuncular, ...(hepsi ? hepsi.oyuncular : [])]) await unlockPlayer(a, { odul: true });
  } catch (e) {}
  return { ...sonuc, kademe, hepsi, yeni: true };
}

// Bugün kaç günlük oyunun ödülü alındı (Tüm Modlar kartı için).
export async function gunlukOdulDurumu(tarih = gunAnahtari()) {
  const k = await oku(tarih);
  return { alinan: GUNLUK_OYUNLAR.filter((o) => k.oyunlar[o]).length, toplam: GUNLUK_OYUNLAR.length, hepsi: !!k.hepsi };
}
