import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================================
// GÜNLÜK SERİ — 4 Ekim 2026 yeniden yazıldı (benchmark .29585)
//
// "Tek seri kuralı: günlük içerikten birini bitirmek seriyi sürdürür; haftada 1
// dondurma hakkı." Eskiden herhangi bir modda bir tur oynamak seriyi artırıyordu
// ve üç günlük sistem (bulmaca, görevler, seri) birbirinden habersizdi. Artık
// seri TEK yerden ilerliyor: gunlukIcerikBitti(kaynak). Kaynaklar:
//   • Günün Bulmacası bitti (bilinsin ya da bilinmesin)
//   • Günlük 5 Kulüp bitti (3 tahmin)
//   • Günlük Izgara bitti (9 hak ya da 9 kare)
//   • Günlük görevlerin üçü de tamamlandı
//
// DONDURMA: haftada bir (Pazartesi başlar) kaçırılan TEK gün kendiliğinden
// affedilir — Duolingo deseni. Dili utandırmıyor: "kaybettin" yerine
// "yeni seri başlat". Gün hesabı YEREL takvime göre (UTC değil).
// ============================================================================
const STREAK_KEY = "ortak-futbolcu-streak";

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const tarihten = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const gunEkle = (s, n) => { const d = tarihten(s); d.setDate(d.getDate() + n); return toDateStr(d); };
const gunFarki = (a, b) => Math.round((tarihten(b) - tarihten(a)) / 86400000);
// Haftanın anahtarı = o haftanın Pazartesi'si.
export function haftaAnahtari(s) {
  const d = tarihten(s);
  const fark = (d.getDay() + 6) % 7; // Pzt=0
  d.setDate(d.getDate() - fark);
  return toDateStr(d);
}

export async function getStreak() {
  const fallback = { count: 0, lastPlayedDate: null };
  try {
    const data = await AsyncStorage.getItem(STREAK_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return fallback;
}

// Ekranlar için: serinin bugünkü durumu (kayıt değiştirilmez).
//   durum: "tamam"    bugün günlük içerik bitti
//          "bekliyor" dün bitmiş; bugün bir günlük içerik bitirince sürer
//          "dondurma" dün kaçtı ama bu haftanın dondurma hakkı seriyi koruyor
//          "yeni"     seri yok ya da koptu → yeni seri
export function seriDurumu(s, bugun = toDateStr(new Date())) {
  const kayit = s || { count: 0, lastPlayedDate: null };
  const dondurmaVar = (gun) => kayit.dondurmaHaftasi !== haftaAnahtari(gun);
  const enIyi = Math.max(kayit.enIyi || 0, kayit.count || 0);
  const temel = { enIyi, dondurmaHakki: dondurmaVar(bugun) ? 1 : 0 };
  if (!kayit.lastPlayedDate || !kayit.count) {
    return { ...temel, gosterilen: 0, durum: "yeni", mesaj: "Bir günlük oyunu bitir, serin başlasın." };
  }
  const fark = gunFarki(kayit.lastPlayedDate, bugun);
  if (fark <= 0) return { ...temel, gosterilen: kayit.count, durum: "tamam", mesaj: "Bugün tamam ✓ Yarın da bir günlük oyun bitir." };
  if (fark === 1) return { ...temel, gosterilen: kayit.count, durum: "bekliyor", mesaj: "Bugün bir günlük oyun bitir, seri sürsün." };
  if (fark === 2 && dondurmaVar(gunEkle(bugun, -1))) {
    return { ...temel, gosterilen: kayit.count, durum: "dondurma", mesaj: "Dün kaçırdın ama haftalık dondurma hakkın seriyi koruyor. Bugün bitir, seri sürsün." };
  }
  return { ...temel, gosterilen: 0, durum: "yeni", mesaj: `En iyi serin ${enIyi} gün. Bugün yenisini başlat.` };
}

// Günlük içeriklerden biri bitti → seri ilerler (günde bir kez sayılır).
export async function gunlukIcerikBitti(kaynak = "") {
  try {
    const current = await getStreak();
    const today = toDateStr(new Date());
    if (current.lastPlayedDate === today) return { ...current, yeniGun: false };
    const d = seriDurumu(current, today);
    let next;
    if (d.durum === "bekliyor") next = { ...current, count: current.count + 1 };
    else if (d.durum === "dondurma") {
      const dun = gunEkle(today, -1);
      next = { ...current, count: current.count + 1, dondurmaHaftasi: haftaAnahtari(dun), dondurulanGun: dun };
    } else next = { ...current, count: 1 };
    next.lastPlayedDate = today;
    next.enIyi = Math.max(current.enIyi || 0, next.count);
    next.sonKaynak = kaynak;
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next));
    return { ...next, yeniGun: true, dondurmaKullanildi: d.durum === "dondurma" };
  } catch (e) {
    return { count: 0, lastPlayedDate: null, yeniGun: false };
  }
}

// Eski ad — bazı eski çağrılar için. Artık seri yalnızca günlük içerikle ilerler.
export const bumpStreak = gunlukIcerikBitti;
