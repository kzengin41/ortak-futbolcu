# -*- coding: utf-8 -*-
"""
FOTO EŞLEŞTİRME SCRİPTİ — Ortak Futbolcu
==========================================
Ne yapar:
  1. Bu dosyayla birlikte gelen "eslestirilecek_adaylar.csv" listesindeki
     her (isim, Transfermarkt ID) çifti için, senin faces klasöründe
     <ID>.png dosyası var mı diye bakar.
  2. Varsa: dosyayı "bulunanlar/<İsim>.png" olarak kopyalar (isim CSV'deki
     ile BİREBİR AYNI, oyunun require() edeceği ad budur).
  3. Yoksa: "bulunamayanlar.csv" dosyasına (isim, ID, popülerlik) olarak yazar.

Neden bunu SEN çalıştırıyorsun (Claude tek tek denemiyor)?
  1611 adaydan sadece ~%20'sinin fotoğrafı gerçekten var — Claude'un cihazına
  bağlı köprü ise dosyaları TEK TEK (birer birer) çekmek zorunda, bu da
  binlerce ayrı işlem demek. Senin bilgisayarında bu iş SANİYELER sürer.

KULLANIM:
  1. Bu "foto_eslestir.py" dosyasını VE "eslestirilecek_adaylar.csv" dosyasını
     AYNI KLASÖRE koy (örneğin Masaüstü).
  2. Python kuruluysa (çoğu Windows'ta hazır gelir), o klasörde bir terminal
     aç ve şunu çalıştır:
         python foto_eslestir.py
     (Eğer "python" çalışmazsa "py foto_eslestir.py" dene.)
  3. Script bitince aynı klasörde:
       - "bulunanlar/" klasörü (gerçekten bulunan tüm fotoğraflar, doğru
         isimlerle kopyalanmış hâlde)
       - "bulunamayanlar.csv" (bulunamayan herkesin isim + ID + popülerlik
         listesi — Excel'de Türkçe karakterler bozulmadan açılır)
     oluşmuş olacak.
  4. "bulunanlar/" klasöründeki TÜM dosyaları
     C:\\ortak-futbolcu\\assets\\player_photos_custom\\ klasörüne kopyala
     (aynı senin daha önce Zidane/Henry için yaptığın gibi), sonra bana
     haber ver — ben lib/localPlayerPhotos.js'e yeni satırları ekleyip
     kod tarafını tamamlarım.

AYARLAR (gerekirse aşağıdaki 2 satırı kendi klasör yoluna göre değiştir):
"""

import csv
import os
import shutil

# --- AYARLAR --------------------------------------------------------------
FACES_KLASORU = r"C:\Users\Monster\Desktop\faces"          # <ID>.png dosyalarının olduğu klasör
ADAYLAR_CSV = "eslestirilecek_adaylar.csv"                  # bu script ile birlikte gelen dosya
CIKTI_KLASORU = "bulunanlar"                                # bulunan fotoğrafların kopyalanacağı klasör
BULUNAMAYAN_CSV = "bulunamayanlar.csv"                      # bulunamayanların listesi
# ---------------------------------------------------------------------------


def main():
    if not os.path.isdir(FACES_KLASORU):
        print(f"HATA: faces klasörü bulunamadı: {FACES_KLASORU}")
        print("Dosyanın başındaki FACES_KLASORU değişkenini kontrol et.")
        return

    if not os.path.isfile(ADAYLAR_CSV):
        print(f"HATA: {ADAYLAR_CSV} bulunamadı. Bu script ile aynı klasörde olmalı.")
        return

    os.makedirs(CIKTI_KLASORU, exist_ok=True)

    bulunan = 0
    bulunamayan = []

    with open(ADAYLAR_CSV, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)

    print(f"Toplam {len(rows)} aday kontrol edilecek...")

    for row in rows:
        isim = row["isim"]
        pid = row["id"]
        pop = row.get("popularite", "")
        kaynak = os.path.join(FACES_KLASORU, f"{pid}.png")
        if os.path.isfile(kaynak):
            hedef = os.path.join(CIKTI_KLASORU, f"{isim}.png")
            shutil.copyfile(kaynak, hedef)
            bulunan += 1
        else:
            bulunamayan.append((isim, pid, pop))

    with open(BULUNAMAYAN_CSV, "wb") as f:
        f.write(b"\xef\xbb\xbf")  # Excel'de Türkçe karakterler için BOM
    with open(BULUNAMAYAN_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["isim", "id", "popularite"])
        for isim, pid, pop in bulunamayan:
            w.writerow([isim, pid, pop])

    print("")
    print("=" * 50)
    print(f"BULUNDU:      {bulunan} fotoğraf  -> '{CIKTI_KLASORU}/' klasörüne kopyalandı")
    print(f"BULUNAMADI:   {len(bulunamayan)} kişi -> '{BULUNAMAYAN_CSV}' dosyasına yazıldı")
    print("=" * 50)


if __name__ == "__main__":
    main()
