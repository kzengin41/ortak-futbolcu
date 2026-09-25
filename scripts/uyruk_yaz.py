# -*- coding: utf-8 -*-
"""
uyruk_ilerleme.json -> lib/playerNationality.js  (AĞA HİÇ ÇIKMAZ)

NİYE VAR (11 Eylül 2026): uyruk_guncelle.py'nin ESKİ KODLU bir kopyası arka
planda çalışmaya devam edip, tur bitince çıktı dosyasını KENDİ (daha küçük)
sonucuyla üzerine yazdı — Python dosyayı başlangıçta belleğe aldığı için
scripti düzeltmek çalışan süreci düzeltmiyor. İlerleme dosyası sağlam
kaldığı hâlde uygulama eski veriyi görüyordu.

Bu script sadece ilerleme dosyasını okuyup .js'i yeniden üretir. Böyle bir
karışıklıkta ya da uzun bir turu Ctrl+C ile kestiğinde çalıştır:

    python scripts/uyruk_yaz.py
"""

import json
import os

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ILERLEME = os.path.join(KOK, "uyruk_ilerleme.json")
CIKTI = os.path.join(KOK, "lib", "playerNationality.js")


def main():
    with open(ILERLEME, encoding="utf-8") as f:
        uyruk = json.load(f).get("uyruk", {})
    if not uyruk:
        print("uyruk_ilerleme.json boş — yazılacak bir şey yok.")
        return

    eski = 0
    if os.path.exists(CIKTI):
        for satir in open(CIKTI, encoding="utf-8"):
            if satir.startswith("// Kayıt sayısı:"):
                try:
                    eski = int(satir.split(":")[1].strip())
                except ValueError:
                    pass
                break

    icerik = (
        "// Her oyuncunun GERÇEK UYRUĞU (milli takım kaydından BAĞIMSIZ).\n"
        "// Wikipedia kategorilerinden çıkarıldı: scripts/uyruk_guncelle.py\n"
        "// Milli takım geçmişi (caps) için hâlâ lib/playerNationalTeams.js var —\n"
        "// bu o değil, sadece uyruk. Ülke-Takım modu önce BURAYA bakıyor.\n"
        "// Kayıt sayısı: %d\n"
        "export const PLAYER_NATIONALITY = %s;\n"
        % (len(uyruk), json.dumps(uyruk, ensure_ascii=False))
    )
    gecici = CIKTI + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        f.write(icerik)
    os.replace(gecici, CIKTI)
    print("lib/playerNationality.js yazıldı: %d kayıt  (öncesi: %d)" % (len(uyruk), eski))


if __name__ == "__main__":
    main()
