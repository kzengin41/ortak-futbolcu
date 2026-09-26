// Temayı ANINDA uygulamak için uygulamayı yeniden yükler.
//
// 26 Eylül 2026 (Kerem: "tema kapatıp açmadan uygulansa daha şık olacak").
//
// NİYE YENİDEN YÜKLEME GEREKİYOR: React Native'de
// `StyleSheet.create({ color: COLORS.text })` rengi O SATIR ÇALIŞTIĞI ANDA
// kopyalar. Sonradan COLORS'ı değiştirmek, daha önce oluşturulmuş stilleri
// etkilemez; ekranı yeniden çizmek de yetmez. Renkleri render zamanında
// okumaya çevirmek 31 dosyada 597 kullanım demek. Bunun yerine JS paketini
// yeniden yüklüyoruz: index.js açılışta temayı uyguladığı için (bkz. index.js)
// yeniden yükleme sonrası her şey yeni renklerle geliyor. Kullanıcı açısından
// ~1 saniyelik bir yenilenme.
//
// expo-updates KURULU DEĞİLSE ya da Expo Go'da çalışıyorsak sessizce false
// döner — o zaman arayüz "uygulamayı kapatıp aç" notunu göstermeye devam eder.
// Yani bu dosya paket kurulmadan önce de güvenle projede durabilir.
export async function uygulamayiYenile() {
  try {
    // Dinamik require: paket yoksa import hatası uygulamayı çökertmesin.
    const Updates = require("expo-updates");
    if (!Updates || typeof Updates.reloadAsync !== "function") return false;
    await Updates.reloadAsync();
    return true;
  } catch (e) {
    // Expo Go'da ve geliştirme istemcisinde reloadAsync hata verir — normal.
    return false;
  }
}

// Yeniden yükleme yapılabilir mi? Arayüzün doğru metni göstermesi için.
export function yenilemeDestekleniyorMu() {
  try {
    const Updates = require("expo-updates");
    return !!(Updates && typeof Updates.reloadAsync === "function" && Updates.isEmbeddedLaunch !== undefined);
  } catch (e) {
    return false;
  }
}
