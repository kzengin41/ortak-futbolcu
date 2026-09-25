# Gizlilik Politikası — 3-2-1: Bitir İşi

**Son güncelleme:** 12 Eylül 2026

Bu politika, **3-2-1: Bitir İşi** mobil uygulamasının hangi verileri topladığını,
neden topladığını ve kimlerle paylaştığını anlatır. Uygulamayı kullanarak burada
anlatılanları kabul etmiş olursun.

Veri sorumlusu: Kerem Zengin — iletişim: **KontStudioApps@gmail.com**

---

## Kısaca

Uygulama hesap açmadan da tamamen oynanabilir. Hesap açmak isteğe bağlıdır ve
yalnızca ilerlemeni cihazlar arasında taşımak içindir. Reklam göstermiyoruz,
verilerini reklam amaçlı kimseye satmıyoruz.

Ama tam olarak dürüst olmak gerekirse: **çevrimdışı modlarda bile** uygulama
sunucumuza küçük bir kayıt gönderiyor ve **sesli cevap özelliğini kullanırsan
ses kaydın yazıya çevrilmek üzere yurt dışındaki bir servise gidiyor.**
Ayrıntılar aşağıda.

---

## Topladığımız veriler

### 1. Cihaz kimliği (hesapsız da toplanır)

Uygulama ilk açılışta cihazına rastgele bir kimlik üretir. Bu kimlik senin adın,
telefon numaran veya reklam kimliğinle ilgisi olmayan, yalnızca bu uygulamaya
özel bir numaradır.

Ne için kullanılıyor: hangi oyun modlarının ne sıklıkta oynandığını görmek
(oyunu geliştirebilmek için), online odalarda iki oyuncuyu birbirinden ayırmak,
ve bir hatayı bildirdiğinde bildirimi kaynağıyla eşleştirmek.

Bir mod açtığında — o mod internetsiz oynanıyor olsa bile — bu kimlik ve mod adı
sunucumuza yazılır.

### 2. Sesli cevaplar

Sesli cevap özelliğini kullandığında kaydettiğin kısa ses dosyası:

1. sunucumuza (Supabase, Avrupa Birliği) yüklenir,
2. oradan yazıya çevrilmek üzere **OpenAI Whisper** servisine (Amerika Birleşik
   Devletleri) iletilir,
3. dönen metin cevabını değerlendirmek için kullanılır.

Ses kaydı bu işlem dışında saklanmaz ve başka hiçbir amaçla kullanılmaz. Mikrofon
izni yalnızca sen mikrofon butonuna bastığında kullanılır; uygulama arka planda
dinleme yapmaz.

**Sesli cevabı hiç kullanmazsan hiçbir ses kaydı alınmaz veya gönderilmez.**
Klavyeyle cevap vermek her modda mümkündür.

### 3. Hesap bilgileri (yalnızca hesap açarsan)

Hesap açarsan şunları saklarız: e-posta adresin, seçtiğin görünen ad, seçtiğin
avatar rengi veya yüklediğin profil fotoğrafı, ve oyun ilerlemen (deneyim puanı,
seviye, açtığın futbolcular, istatistikler).

Şifren bize hiç ulaşmaz; kimlik doğrulamayı Supabase Auth yapar ve şifreler
orada şifrelenmiş olarak tutulur.

Profil fotoğrafı yüklersen bu fotoğraf, adresini bilenlerin erişebileceği bir
depolama alanına konur. Buraya özel veya hassas bir fotoğraf yüklememeni öneririz.

### 4. Hata bildirimleri

Oyun içindeki "Bildir" düğmesiyle bir hata bildirirsen yazdığın metin ve cihaz
kimliğin bize ulaşır.

---

## Toplamadığımız veriler

Konum bilgisi, rehber, çağrı kayıtları, SMS, diğer uygulamaların listesi, reklam
kimliği ve benzeri hiçbir veriye erişmiyoruz. Üçüncü taraf reklam veya analiz
izleyicisi kullanmıyoruz.

---

## Verilerin paylaşıldığı taraflar

| Kime | Ne | Neden |
|---|---|---|
| Supabase (AB) | Cihaz kimliği, hesap bilgileri, oyun ilerlemesi, ses kaydı (geçici) | Sunucu ve veritabanı altyapısı |
| OpenAI (ABD) | Ses kaydı | Sesi yazıya çevirmek |

Bunun dışında hiç kimseyle veri paylaşmıyoruz, satmıyoruz, kiralamıyoruz.

---

## Saklama süresi ve verilerini silme

Hesap açmadıysan: cihaz kimliğine bağlı kayıtlar oyun istatistiği olarak
saklanır ve seni tanımlamaz.

Hesap açtıysan: **Profilim → Hesabım → "Hesabımı kalıcı olarak sil"** ile
hesabını, profilini, profil fotoğrafını ve bulut yedeğini kalıcı olarak
silebilirsin. İşlem geri alınamaz ve anında uygulanır.

Uygulamayı silmeden hesabını silmek istersen ya da uygulamaya erişimin yoksa,
yukarıdaki e-posta adresine yazman yeterli — talebini 30 gün içinde
sonuçlandırırız.

---

## Çocukların gizliliği

Uygulama 13 yaş altı çocuklara yönelik değildir ve bilerek 13 yaşından küçük
kişilerden veri toplamayız. Çocuğunuzun bize veri gönderdiğini düşünüyorsanız
yukarıdaki adresten bize ulaşın, kaydı silelim.

---

## Üçüncü taraf içerik

Uygulamadaki futbolcu fotoğrafları ve kariyer bilgileri açık kaynaklardan
derlenmiştir; kaynak listesi uygulama içinde **Profilim → Nasıl Oynanır →
Kaynaklar** bölümünde yer alır. Uygulama hiçbir kulüp, lig, federasyon veya
oyuncuyla resmi bağlantılı değildir.

---

## Değişiklikler

Bu politika değişirse bu sayfadaki "Son güncelleme" tarihi güncellenir. Önemli
bir değişiklik olursa uygulama içinde ayrıca bilgilendiririz.

## İletişim

Soruların için: **KontStudioApps@gmail.com**
