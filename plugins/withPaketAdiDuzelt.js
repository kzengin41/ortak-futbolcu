// 26 Eylül 2026 — BUILD HATASI "Unresolved reference 'BuildConfig'" (MainActivity.kt /
// MainApplication.kt) KÖK NEDENİ.
//
// Expo prebuild, şablondaki "helloworld" adını uygulama ADINDAN türetilen bir
// adla değiştiriyor, sonra onu app.json'daki paket adına (com.kerem.ortakfutbolcu)
// çeviriyor. Uygulama adımız "3-2-1: Bitir İşi" — içindeki Türkçe "İ" harfi
// küçültülünce İKİ karaktere dönüşüyor ("i" + birleşik nokta). Bu yüzden Expo
// klasör adını "321bitiri", dosya içini "321bitirii" diye üretiyor; son adımda
// sadece "321bitiri" kısmı değiştirilip sonda bir "i" kalıyor:
//     package com.kerem.ortakfutbolcui      <- YANLIŞ (fazladan i)
// BuildConfig ise doğru pakette (com.kerem.ortakfutbolcu) üretildiği için
// Kotlin onu bulamıyor ve derleme duruyor. (Expo'nun Türkçe/ASCII olmayan
// uygulama adlarıyla ilgili hatası; uygulama adını değiştirmeden çözüyoruz.)
//
// Bu eklenti prebuild'in sonunda, uygulamanın kendi paket klasöründeki
// .kt/.java dosyalarının "package ..." satırını app.json'daki paket adıyla
// birebir aynı yapıyor.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function dosyalar(klasor) {
  if (!fs.existsSync(klasor)) return [];
  return fs.readdirSync(klasor, { withFileTypes: true }).flatMap((g) => {
    const tam = path.join(klasor, g.name);
    if (g.isDirectory()) return dosyalar(tam);
    return /\.(kt|java)$/.test(g.name) ? [tam] : [];
  });
}

module.exports = function withPaketAdiDuzelt(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const paket = cfg.android && cfg.android.package;
      if (!paket) return cfg;
      const src = path.join(cfg.modRequest.platformProjectRoot, "app", "src");
      for (const tur of ["main", "debug", "release", "debugOptimized"]) {
        const paketKlasoru = path.join(src, tur, "java", ...paket.split("."));
        for (const dosya of dosyalar(paketKlasoru)) {
          // Alt klasörlerdeki dosyalar alt paket kullanır (ör. .../ortakfutbolcu/x)
          const goreli = path.relative(paketKlasoru, path.dirname(dosya));
          const dogru = goreli ? `${paket}.${goreli.split(path.sep).join(".")}` : paket;
          const eski = fs.readFileSync(dosya, "utf8");
          const yeni = eski.replace(/^package\s+[^\s;]+/m, `package ${dogru}`);
          if (yeni !== eski) fs.writeFileSync(dosya, yeni);
        }
      }
      return cfg;
    },
  ]);
};
