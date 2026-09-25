// Wikidata'da eksik olduğu fark edilen kulüp üyelikleri buraya elle eklenir.
// Anahtar, lib/players.js'teki oyuncu adıyla BİREBİR aynı olmalı (Türkçe
// karakterler dahil). Oynarken "bu cevap doğruydu ama kabul etmedi" fark
// edersen buraya bir satır ekleyip scripts/apply_corrections.js'i çalıştır.
//
// ÖNEMLİ — format JSON olmak zorunda (script'ler bunu JSON.parse ile okuyor):
// çift tırnak kullan, son elemandan sonra virgül koyma, içine yorum ekleme.
export const CORRECTIONS = {
  "Burak Yılmaz": ["Antalyaspor", "Beşiktaş", "Fenerbahçe", "Manisaspor", "Eskişehirspor", "Beijing Guoan"]
};
