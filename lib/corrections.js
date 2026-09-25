// Wikidata'da eksik olduğu fark edilen kulüp üyelikleri buraya elle eklenir.
// Anahtar, lib/players.js'teki oyuncu adıyla BİREBİR aynı olmalı (Türkçe
// karakterler dahil). Oynarken "bu cevap doğruydu ama kabul etmedi" fark
// edersen buraya bir satır ekleyip scripts/apply_corrections.js'i çalıştır.
//
// ÖNEMLİ — format JSON olmak zorunda (script'ler bunu JSON.parse ile okuyor):
// çift tırnak kullan, son elemandan sonra virgül koyma, içine yorum ekleme.
export const CORRECTIONS = {
  "Burak Yılmaz": ["Antalyaspor", "Beşiktaş", "Fenerbahçe", "Manisaspor", "Eskişehirspor", "Beijing Guoan"],
  "Batuhan Karadeniz": ["Beşiktaş", "Eskişehirspor", "Trabzonspor", "Elazığspor", "Sivasspor", "FC St. Gallen", "Şanlıurfaspor", "Sakaryaspor", "Adana Demirspor", "Bandırmaspor", "Tuzlaspor", "Iğdır FK"],
  "Yusuf Sarı": ["Olympique Marseille", "Clermont Foot", "Trabzonspor", "Çaykur Rizespor", "Adana Demirspor", "İstanbul Başakşehir"],
  "Emirhan Topçu": ["Çaykur Rizespor", "NK Čelik Zenica", "Menemenspor", "Beşiktaş"],
  "Gökdeniz Bayrakdar": ["Kocaelispor", "Antalyaspor", "Bodrumspor", "Bodrum FK"],
  "Yunus Akgün": ["Galatasaray", "Adana Demirspor", "Leicester City"],
  "Onurcan Piri": ["Giresunspor", "Bursaspor", "Çankaya", "Çorum FK", "Kayserispor", "Kocaelispor"],
  "Güven Yalçın": ["Bayer Leverkusen", "Beşiktaş", "Lecce", "Genoa", "Fatih Karagümrük", "Arouca", "Alanyaspor", "Kasımpaşa"],
  "Mustafa Yumlu": ["Trabzonspor", "1461 Trabzon", "Eskişehirspor", "Akhisarspor", "Denizlispor", "Erzurumspor", "Erzurumspor FK"]
};
