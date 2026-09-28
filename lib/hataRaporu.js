import * as Sentry from "@sentry/react-native";

// ============================================================================
// ÇÖKME / HATA RAPORLAMA — 29 Eylül 2026 (Sentry, AB bölgesi)
// ----------------------------------------------------------------------------
// - DSN gizli değildir (her uygulamanın paketine gömülür); sadece hata
//   GÖNDERMEYE yarar, okumaya yaramaz. Asıl gizli olan SENTRY_AUTH_TOKEN'dır ve
//   o yalnızca EAS ortam değişkeninde (Sensitive) durur, koda asla girmez.
// - Sadece gerçek derlemelerde açık (__DEV__ iken kapalı): geliştirme sırasında
//   Metro'daki hatalar panoyu kirletmesin.
// - Gizlilik: kişisel veri gönderilmez (sendDefaultPii kapalı, IP saklanmaz),
//   ekran görüntüsü / oturum kaydı (replay) yok, performans izleme yok. Sadece
//   hata mesajı, yığın izi ve cihaz modeli / Android sürümü gibi teknik bilgi.
//   Gizlilik politikasının "Çökme raporları" maddesi bununla uyumlu olmalı.
// - Yakalananlar: yakalanmamış JS hataları, reddedilen promise'ler, yerel
//   (Java/Kotlin/C++) çökmeler, ANR (uygulama donması), HataSiniri'na düşen
//   ekran hataları (App.js → hataRaporla).
// - expo-updates ile gelen güncellemelerin kimliği SDK tarafından otomatik
//   etiketlenir (expo.updates.update_id / channel / runtime_version).
// ============================================================================
const DSN =
  "https://5c21516b7279caada4ac4515708a49a2@o4512166626394112.ingest.de.sentry.io/4512166653460560";

Sentry.init({
  dsn: DSN,
  enabled: !__DEV__,
  sendDefaultPii: false,
  environment: __DEV__ ? "development" : "production",
  tracesSampleRate: 0,
  attachScreenshot: false,
  attachViewHierarchy: false,
  maxBreadcrumbs: 50,
  // İnternet kesintisi / sunucuya ulaşılamaması gibi kullanıcının elinde olmayan
  // ve zaten ekranda nazikçe gösterilen durumlar panoyu doldurmasın.
  ignoreErrors: [
    "Network request failed",
    "Failed to fetch",
    "The network connection was lost",
    "AbortError",
  ],
});

// Hata sınırına (HataSiniri) düşen render hataları için. React bileşen yığınını
// da ekler ki hangi ekranda olduğu görülsün.
export function hataRaporla(hata, bilgi) {
  try {
    Sentry.withScope((kapsam) => {
      if (bilgi?.componentStack) kapsam.setContext("react", { componentStack: bilgi.componentStack });
      kapsam.setTag("kaynak", "HataSiniri");
      Sentry.captureException(hata);
    });
  } catch {
    // Raporlama asla uygulamayı düşürmemeli.
  }
}

export { Sentry };
