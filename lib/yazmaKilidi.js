// ============================================================================
// YAZMA KİLİDİ — Paket 43 (29 Ekim 2026)
// Kerem: "bilmiyorum butonunun yeri sebebiyle el çarpabiliyor. hızlı yazmak
// isterken yanlışlıkla dokunuluyor."
//
// Cevap kutusuna her harf yazıldığında yazmaOldu() çağrılır. "Bilemedim"
// (components/BilemedimDugmesi.js) son yazmadan sonra KILIT_MS geçmeden gelen
// dokunuşu yok sayar: hızlı yazarken klavyenin üst sırasından taşan parmak
// turu yakmaz. Bilerek basan kullanıcı yazmayı bırakıp basar; 0,8 sn fark
// edilmez.
// ============================================================================
export const KILIT_MS = 800;
let _son = 0;

export function yazmaOldu(simdi = Date.now()) {
  _son = simdi;
}

export function yeniYazildiMi(simdi = Date.now(), ms = KILIT_MS) {
  return simdi - _son < ms;
}

// Testler için.
export function yazmaKilidiniSifirla() {
  _son = 0;
}
