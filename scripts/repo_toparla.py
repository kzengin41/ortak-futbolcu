# -*- coding: utf-8 -*-
"""
DEPO TOPARLAMA — Paket 16, 5 Ekim 2026 (Kerem: "bu temizlikleri yapalım. Sildir bana.")

Herkese açık depoda (kzengin41/ortak-futbolcu) uygulamanın KULLANMADIĞI eski
yedekler, rapor CSV'leri ve tek seferlik denemeler duruyor. Bu script onları
SİLMEZ, depo klasörünün DIŞINDAKİ bir arşive TAŞIR:

    C:\\ortak-futbolcu-arsiv\\<tarih-saat>\\...

Böylece bir şey lazım olursa geri alınabilir; birkaç hafta sonra arşiv
klasörünü elle silebilirsin.

Kullanım (proje klasöründe):
    python scripts\\repo_toparla.py            -> sadece listeler (hiçbir şey taşımaz)
    python scripts\\repo_toparla.py --uygula   -> taşır

Sonra:
    git add -A
    git commit -m "Depo toparlandi: eski yedekler ve rapor CSV'leri arsive tasindi"
    git push

Taşınanlar ve neden güvenli olduğu (5 Ekim'de tek tek kontrol edildi):
  • yedek/, yedekler/        — Eylül'deki playerPhotos JSON ve PNG yedekleri
                               (fotoğraflar artık Supabase'de, webp).
  • bulunanlar/              — elle bulunmuş ~270 fotoğraf (Supabase'e yüklendi).
  • silinen/                 — kaldırılmış eski ekranlar (HomeScreen vb.).
  • ortak-futbolcu-expo/     — projenin içindeki çok eski kopya (.gitignore'da
                               zaten vardı ama dosyaları depoya girmişti).
  • Kökteki *.csv             — script RAPORLARI (çıktı). Uygulama hiçbirini
                               okumuyor. Tek istisna: fotografi_eksik_populariteye_gore.csv
                               eski fotoğraf scriptlerinin (sportsdb_foto_cek,
                               supabase_foto_tasi, foto_kontrol_sayfasi) GİRDİSİ;
                               o hat Eylül'de bitti. Yeniden çalıştırman gerekirse
                               arşivden geri kopyala.
  • fix.js, generate_csv.js, test_letters.js, test_mjs.mjs, foto_eslestir.py
                             — tek seferlik denemeler; hiçbir dosya bunlara
                               başvurmuyor (grep ile kontrol edildi).
  • foto_kontrol.html, kirik_foto_kontrolu.html — üretilmiş kontrol sayfaları.

Depodan silinen dosyalar git GEÇMİŞİNDE kalır (eski commit'lerde görünür);
bu script yalnızca güncel hâli temizler. İçlerinde gizli bilgi yok.
"""
import os
import sys
import glob
import shutil
from datetime import datetime

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KLASORLER = ["yedek", "yedekler", "bulunanlar", "silinen", "ortak-futbolcu-expo"]
DOSYALAR = [
    "fix.js", "generate_csv.js", "test_letters.js", "test_mjs.mjs", "foto_eslestir.py",
    "foto_kontrol.html", "kirik_foto_kontrolu.html",
]
# Kökte KALMASI gereken dosyalar (yanlışlıkla eşleşmesin diye açıkça yazılı).
KORUNAN = {
    "App.js", "index.js", "app.json", "eas.json", "package.json", "package-lock.json",
    "metro.config.js", "tsconfig.json", "README.md", "NEREDEYIZ.md", "PRIVACY_POLICY.md",
    ".gitignore", ".easignore", ".env", ".env.example",
}


def boyut(yol):
    if os.path.isfile(yol):
        return os.path.getsize(yol)
    t = 0
    for kok, _, dosyalar in os.walk(yol):
        for d in dosyalar:
            try:
                t += os.path.getsize(os.path.join(kok, d))
            except OSError:
                pass
    return t


def main():
    uygula = "--uygula" in sys.argv
    adaylar = [k for k in KLASORLER if os.path.isdir(os.path.join(KOK, k))]
    adaylar += [d for d in DOSYALAR if os.path.isfile(os.path.join(KOK, d))]
    adaylar += sorted(os.path.basename(p) for p in glob.glob(os.path.join(KOK, "*.csv")))
    adaylar = [a for a in dict.fromkeys(adaylar) if a not in KORUNAN]

    if not adaylar:
        print("Taşınacak bir şey yok — depo zaten temiz.")
        return

    arsiv = os.path.join(os.path.dirname(KOK), "ortak-futbolcu-arsiv", datetime.now().strftime("%Y%m%d-%H%M"))
    toplam = 0
    print("Taşınacaklar:" if uygula else "Taşınacaklar (DENEME — hiçbir şey taşınmadı):")
    for a in adaylar:
        b = boyut(os.path.join(KOK, a))
        toplam += b
        print("  %-45s %8.1f MB" % (a + ("/" if os.path.isdir(os.path.join(KOK, a)) else ""), b / 1048576))
    print("  %-45s %8.1f MB" % ("TOPLAM", toplam / 1048576))

    if not uygula:
        print("\nTaşımak için:  python scripts\\repo_toparla.py --uygula")
        print("Arşiv yeri:    " + arsiv)
        return

    os.makedirs(arsiv, exist_ok=True)
    for a in adaylar:
        shutil.move(os.path.join(KOK, a), os.path.join(arsiv, a))
    print("\nTamam. Arşiv: " + arsiv)
    print("Şimdi:  git add -A  ->  git commit  ->  git push")


if __name__ == "__main__":
    main()
