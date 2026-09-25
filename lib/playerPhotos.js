export const PLAYER_PHOTO_FILENAME = require('./playerPhotos.json');

// 31 Ağustos 2026 — BUG FIX: "Kim Bu Futbolcu?" modunda çoğu fotoğraf hiç
// yüklenmiyordu. Kök neden: lib/playerPhotos.json içindeki değerler İKİ
// FARKLI biçimde: bazıları tam bir https:// URL'i (kullanıcının özel
// yüklediği fotoğraflar, Supabase Storage'da), bazıları ise SADECE bir dosya
// adı (eski toplu Wikipedia indirmesi, CloudFront'ta barındırılıyor — o
// dosya adının önüne CLOUDFRONT_BASE eklenmesi gerekiyor). components/
// PlayerPhoto.js değeri hiç dönüştürmeden URI olarak kullanıyordu (sadece
// dosya adı olan kayıtlar için geçersiz bir URI oluyordu, sessizce
// başarısız olup baş harf rozetine düşüyordu); WhoAmICpuScreen.js ise
// TERSİNE HER ZAMAN CloudFront önekini ekliyordu (zaten tam URL olan
// kayıtlar için de) — bu da geçersiz, çift URL'li bir adres üretiyordu.
// Bu fonksiyon TEK doğru kaynak: değer "http" ile başlıyorsa olduğu gibi
// kullan, değilse CloudFront önekini ekle.
const CLOUDFRONT_BASE = "https://d138rdl3z47cng.cloudfront.net/";

// 31 Ağustos 2026 (Kerem: resim temin edip assets/player_photos_custom/
// klasörüne kendi ekliyor) — bu, ÜÇÜNCÜ bir foto kaynağı: Kerem'in projeye
// gömdüğü (bundle edilen) yerel resimler. Supabase/CloudFront'tan farklı
// olarak internet gerektirmiyor, ve Kerem'in resim eklediği isimler için EN
// GÜNCEL/en doğru kaynak olduğundan diğer ikisinden ÖNCE kontrol ediliyor.
import { LOCAL_PLAYER_PHOTOS } from "./localPlayerPhotos";

export function resolvePlayerPhotoUrl(name) {
  if (LOCAL_PLAYER_PHOTOS[name]) return LOCAL_PLAYER_PHOTOS[name];

  const value = PLAYER_PHOTO_FILENAME[name];
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return CLOUDFRONT_BASE + encodeURIComponent(value);
}
