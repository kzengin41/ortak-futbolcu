// ============================================================================
// SERİ (üst üste doğru) — Paket 46
// Bütün modlarda doğru/yanlış geri bildirimi tek bileşenden (AnswerFeedback)
// geçiyor; seri sayacı burada, modül düzeyinde. Yanlışta, maç sonunda
// (MacSonuKarti) ya da 2 dakika ara verince sıfırlanır.
// Seri 3'ten itibaren her doğru +10 XP (seri bonusu) kazandırır.
// ============================================================================
export const SERI_ARA_MS = 120000;
export const SERI_BONUS_ESIK = 3;
export const SERI_BONUS_XP = 10;
let _seri = 0;
let _son = 0;
let _enIyi = 0;

export function seriDogru(simdi = Date.now()) {
  if (simdi - _son > SERI_ARA_MS) _seri = 0;
  _seri += 1;
  _son = simdi;
  if (_seri > _enIyi) _enIyi = _seri;
  return _seri;
}
export function seriYanlis() { _seri = 0; }
export function seriSifirla() { _seri = 0; _son = 0; }
export function seriSimdi() { return _seri; }
export function seriEnIyi() { return _enIyi; }

// Seri sayısına göre ekranda yazacak söz ve büyüklük (null: gösterme).
export function seriSozu(n) {
  if (n >= 10) return { metin: "EFSANE SERİ!", seviye: 4 };
  if (n >= 7) return { metin: "DURDURULAMAZ!", seviye: 3 };
  if (n >= 5) return { metin: "ALEV ALEV!", seviye: 3 };
  if (n >= 3) return { metin: "SERİ!", seviye: 2 };
  if (n >= 2) return { metin: "ÜST ÜSTE!", seviye: 1 };
  return null;
}
