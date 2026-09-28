// Sentry: her pakete ve kaynak haritasına benzersiz Debug ID ekler; EAS derlemesinde
// kaynak haritaları Sentry'ye yüklenir ve hatalar sıkıştırılmış kod yerine gerçek
// dosya/satır olarak görünür. (getDefaultConfig'in yerine geçer, onu da içerir.)
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
