// OTOMATİK BOŞALTILDI — 25 Eylül 2026
//
// NİYE: İlk üretim (release) derlemesi Android'in kaynak derleyicisinde
// (AAPT2) patladı:
//     ERROR: .../drawable-mdpi/assets_player_photos_custom_renatonhaga.png:
//            AAPT: error: file failed to compile.
//
// KÖK NEDEN: `assets/player_photos_custom/` klasöründeki bazı dosyalar
// UZANTISI .png OLDUĞU HÂLDE aslında başka formatta. Doğrulanan örnekler:
//     Renato Nhaga.png  -> gerçekte JPEG (200x234)
//     Suat Kaya.png     -> gerçekte WebP (300x390)
// Metro/JS tarafı bunu sorun etmiyor (geliştirme sırasında resimler
// sorunsuz görünüyordu), ama `require()` edilen her görsel Android'de bir
// DRAWABLE KAYNAĞINA dönüşüyor ve AAPT2 formatı UZANTIDAN belirliyor.
// .png uzantılı bir JPEG'i derlemeye çalışıp hata veriyor. Bu yüzden hata
// ancak ilk release derlemesinde ortaya çıktı — geliştirme sürümünde hiç
// görünmedi.
//
// ÇÖZÜM OLARAK BU HARİTA BOŞALTILDI, dosyalar silinmedi.
// Gerekçe: buradaki 290 ismin **hepsinin** Supabase'de de fotoğrafı var
// (lib/playerPhotos.json ile birebir karşılaştırıldı, eksik 0). Yani gömülü
// kopyalar hiçbir şey kazandırmıyordu; uygulama zaten 28.000 fotoğrafın
// tamamını internetten çekiyor. Boşaltmak:
//   - derlemeyi bozan kaynakları tamamen ortadan kaldırıyor,
//   - APK'yı ~550 KB küçültüyor,
//   - resolvePlayerPhotoUrl'in sözleşmesini BOZMUYOR (aşağıya bak).
//
// TEKRAR GÖMMEK İSTERSEN: dosyaları önce gerçek PNG'ye çevir
// (`scripts/foto_dogrula.py --duzelt`), sonra buraya statik require satırları
// ekle. `require()` RN/Metro'da DİNAMİK OLAMAZ — her görsel için ayrı satır
// şart.
import { Image } from "react-native";

// Boş bırakıldı (yukarıdaki nota bak). Biçim korunuyor ki yeni satır eklemek
// kolay olsun ve aşağıdaki dönüşüm kodu aynen çalışsın.
const LOCAL_PLAYER_PHOTO_MODULES = {};

export const LOCAL_PLAYER_PHOTOS = Object.fromEntries(
  Object.entries(LOCAL_PLAYER_PHOTO_MODULES).map(([name, mod]) => [
    name,
    Image.resolveAssetSource(mod).uri,
  ])
);
