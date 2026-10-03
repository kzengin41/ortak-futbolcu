// ============================================================================
// AÇILAN FUTBOLCU BİLDİRİMİ — 12 Eylül 2026
//
// UX denetiminin bulduğu en büyük "boşa giden altyapı": lib/pokedex.js'teki
// unlockPlayer yeni bir futbolcu açıldığında `true` döndürüyor ve bu dönüş
// değerini HİÇBİR EKRAN OKUMUYORDU. Yani oyunun en güçlü koleksiyon mekaniği
// tamamen görünmezdi — 2000 kişilik ansiklopedi sessizce doluyordu.
//
// Bu küçük yayın kanalı sorunu tek noktadan çözüyor: unlockPlayer başarılı
// olduğunda buraya haber veriyor, App.js'e bağlı tek bir bildirim bileşeni
// dinliyor. Böylece unlockPlayer'ı çağıran altı ekranın HİÇBİRİNE dokunmaya
// gerek kalmıyor ve ileride eklenecek modlar da otomatik kapsanıyor.
// ============================================================================

const dinleyiciler = new Set();

export function acilisDinle(fn) {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
}

// ek: { seviye } — bu açılışla seviye atlandıysa (4 Ekim 2026, lib/seviye.js).
export function acilisBildir(playerName, ek = null) {
  for (const fn of dinleyiciler) {
    try {
      fn(playerName, ek);
    } catch (e) {}
  }
}
