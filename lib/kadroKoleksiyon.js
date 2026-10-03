// ============================================================================
// KADRO KOLEKSİYONU — "bulunan" futbolcular (4 Ekim 2026)
// Ansiklopedi yalnızca en tanınmış 3000 futbolcuyu topluyor; kadrolarda ise
// daha az bilinen isimler de var (2000 UEFA Kupası'nda Ergün Penbe gibi). Bir
// kadronun TAMAMLANABİLMESİ için oyunlarda doğru söylenen HER isim burada
// tutuluyor (havuzda olsun olmasın). lib/pokedex.js unlockPlayer buraya da yazar.
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";

const ANAHTAR = "kadro-bulunanlar-v1";
let _bellek = null;
let _kuyruk = Promise.resolve();

export async function getBulunanlar() {
  if (_bellek) return _bellek;
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    _bellek = new Set(ham ? JSON.parse(ham) : []);
  } catch (e) {
    _bellek = new Set();
  }
  return _bellek;
}

export function bulunanEkle(adlar) {
  _kuyruk = _kuyruk.then(async () => {
    const s = await getBulunanlar();
    let degisti = false;
    for (const a of [].concat(adlar)) if (a && !s.has(a)) { s.add(a); degisti = true; }
    if (degisti) { try { await AsyncStorage.setItem(ANAHTAR, JSON.stringify([...s])); } catch (e) {} }
    return s;
  }).catch(() => _bellek || new Set());
  return _kuyruk;
}

// Tamamlanan kadro sayısı (Profil'de gösterilebilir).
export const TAMAM_ANAHTARI = "kadro-tamamlanan-v1";
export async function tamamlananlar() {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(TAMAM_ANAHTARI)) || "[]")); } catch (e) { return new Set(); }
}
export async function tamamlandiKaydet(id) {
  const s = await tamamlananlar();
  if (s.has(id)) return false;
  s.add(id);
  try { await AsyncStorage.setItem(TAMAM_ANAHTARI, JSON.stringify([...s])); } catch (e) {}
  return true;
}

// Test/eşitleme için bellek önbelleğini boşalt.
export function _sifirla() { _bellek = null; }
