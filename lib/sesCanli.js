import { useEffect, useState } from "react";

// ============================================================================
// CANLI SES YAZISI — Paket 18 (Kerem: "mikrofon açıkken realtime anladığını
// yazsın... irfancan kahveci diyorum, aynı anda irfan can kahveci diye yazsın")
//
// lib/useVoiceInput.js telefonun tanıyıcısından gelen ara sonuçları buraya
// yazar; components/CanliSesBalonu.js (App.js'te bir kez) bunu ekranın üstünde
// gösterir. Böylece 9 oyun ekranının hiçbirine dokunmadan her modda konuşurken
// yazı canlı görünür.
// ============================================================================
let durum = { aktif: false, metin: "", isleniyor: false };
const dinleyiciler = new Set();

export function canliYaz(yeni) {
  durum = { ...durum, ...yeni };
  dinleyiciler.forEach((f) => f(durum));
}

export function canliDurum() {
  return durum;
}

export function useCanliSes() {
  const [d, setD] = useState(durum);
  useEffect(() => {
    dinleyiciler.add(setD);
    setD(durum);
    return () => { dinleyiciler.delete(setD); };
  }, []);
  return d;
}
