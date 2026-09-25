# -*- coding: utf-8 -*-
"""
TEK KOMUT: veri güncelleme işlerinin HEPSİNİ doğru sırayla çalıştırır.

    python scripts/CALISTIR.py

Başka hiçbir script'i elle çalıştırmana gerek yok. Bu dosya sırayla şunları yapar:

  ADIM 0  Yedek al            -> yedekler/<tarih-saat>/ klasörüne lib/*.json kopyalanır
  ADIM 1  Kadroları güncelle  -> 2026 yaz transferleri (Leao->Galatasaray gibi)
                                 + veri setinde hiç olmayan oyuncuları ekler
  ADIM 2  Fotoğrafları çek    -> TheSportsDB'den eksik fotoğrafları bulur
  ADIM 3  Kontrol sayfası     -> foto_kontrol.html üretir (tarayıcıda açıp bakarsın)
  ADIM 4  Supabase'e taşı     -> SADECE --key verirsen çalışır (isteğe bağlı)

Her adım kendi içinde kaldığı yerden devam edebilir; korkmadan durdurup
yeniden çalıştırabilirsin, hiçbir şey iki kez eklenmez.

SEÇENEKLER
    python scripts/CALISTIR.py                       # 1-2-3 adımları
    python scripts/CALISTIR.py --key SUPABASE_ANAHTARIN   # 1-2-3-4 hepsi
    python scripts/CALISTIR.py --adim 1              # sadece kadro güncelleme
    python scripts/CALISTIR.py --adim 2              # sadece foto çekme
    python scripts/CALISTIR.py --adim 3              # sadece kontrol sayfası
    python scripts/CALISTIR.py --hizli               # foto adımında ilk 500 ile yetin
"""

import argparse
import datetime
import os
import shutil
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(KOK, "scripts")
LIB = os.path.join(KOK, "lib")
YEDEK_KOK = os.path.join(KOK, "yedekler")


def baslik(no, ad):
    print("\n" + "=" * 62)
    print("  ADIM %s — %s" % (no, ad))
    print("=" * 62)


def calistir(dosya, argumanlar):
    komut = [sys.executable, os.path.join(SCRIPTS, dosya)] + argumanlar
    print("> %s\n" % " ".join(["python", "scripts/" + dosya] + argumanlar))
    try:
        sonuc = subprocess.run(komut, cwd=KOK)
        return sonuc.returncode == 0
    except KeyboardInterrupt:
        print("\n(bu adım senin tarafından durduruldu)")
        return False


def yedek_al():
    baslik(0, "YEDEK")
    damga = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    hedef = os.path.join(YEDEK_KOK, damga)
    os.makedirs(hedef, exist_ok=True)
    sayi = 0
    for ad in os.listdir(LIB):
        if ad.endswith(".json"):
            shutil.copy2(os.path.join(LIB, ad), os.path.join(hedef, ad))
            sayi += 1
    print("  %d veri dosyası yedeklendi -> yedekler/%s" % (sayi, damga))
    print("  (Bir şey ters giderse bu klasördeki dosyaları lib/ içine geri kopyalaman yeterli.)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adim", type=int, default=0, help="Sadece tek bir adımı çalıştır (1-4)")
    ap.add_argument("--key", default="", help="Supabase service_role anahtarı (verilirse ADIM 4 de çalışır)")
    ap.add_argument("--hizli", action="store_true", help="Foto adımında ilk 500 oyuncuyla yetin")
    a = ap.parse_args()

    tek = a.adim
    print("Proje klasörü: %s" % KOK)

    if tek in (0, 1):
        yedek_al()

    if tek in (0, 1):
        baslik(1, "KADROLARI GÜNCELLE (transferler + yeni oyuncular)")
        print("  140 kulübün Wikipedia'daki güncel kadrosu okunur; eksik kulüp")
        print("  kayıtları eklenir, veri setinde hiç olmayan oyuncular yaratılır.")
        print("  Süre: yaklaşık 15-30 dakika. Ctrl+C ile durdurabilirsin.\n")
        calistir("kadro_guncelle.py", ["--yeni-ekle"])

    if tek in (0, 2):
        baslik(2, "EKSİK FOTOĞRAFLARI ÇEK (TheSportsDB)")
        print("  En ünlü oyunculardan başlayarak fotoğraf aranır. Kimlik doğrulaması")
        print("  yapılır (takım / doğum yılı / uyruk) — yanlış kişi eklenmez.")
        print("  Emin olunamayanlar sportsdb_dusuk_guven.csv'ye ayrılır.\n")
        calistir("sportsdb_foto_cek.py", ["--limit", "500" if a.hizli else "0"])

    if tek in (0, 3):
        baslik(3, "KONTROL SAYFASI ÜRET")
        calistir("foto_kontrol_sayfasi.py", ["--limit", "800"])
        print("\n  -> Şimdi proje klasöründeki  foto_kontrol.html  dosyasına çift tıkla.")
        print("     Yeşil çerçeve = fotoğraf açılıyor, kırmızı çerçeve = kayıt kırık.")

    if (tek in (0, 4)) and a.key:
        baslik(4, "FOTOĞRAFLARI KENDİ SUPABASE DEPONA TAŞI")
        print("  Önce TheSportsDB'den gelenler (bunların çalıştığını biliyoruz).\n")
        calistir("supabase_foto_tasi.py", ["--key", a.key, "--kaynak", "sportsdb", "--limit", "0"])
    elif tek == 4 and not a.key:
        print("\nADIM 4 için Supabase service_role anahtarı gerekli:")
        print("  python scripts/CALISTIR.py --adim 4 --key ANAHTARIN")

    print("\n" + "=" * 62)
    print("  BİTTİ.")
    print("=" * 62)
    print("  Şimdi ne yapmalı:")
    print("   1) foto_kontrol.html'i tarayıcıda aç, fotoğraflara göz gezdir.")
    print("   2) Uygulamayı yeniden başlat (npx expo start -c) ve oyunda dene.")
    print("   3) Bir sorun görürsen bana raporları at:")
    print("      kadro_guncelleme_raporu.csv / sportsdb_dusuk_guven.csv")


if __name__ == "__main__":
    main()
