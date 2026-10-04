// ============================================================================
// MOD REHBERLERİ — her mod İLK KEZ oynandığında açılan tek sayfalık kart.
//
// 11 Eylül 2026 (Kerem: "her bir modun ilk defa oynandığında rehber gibi
// nereye tıklanacak, nasıl cevap verilecek gösteren bir şey açılmalı. atla
// butonu olmalı. 1 kez oynandıktan sonra kaybolmalı ama eğer (i) butonu gibi
// bir info butonuna tıklanırsa tekrar bakılabilmeli.")
//
// Anahtarlar App.js'teki ROTA ADLARIYLA birebir aynı — rehber merkezî olarak
// withExit() içinde gösteriliyor, böylece yeni bir mod eklendiğinde tek yapman
// gereken buraya bir kayıt eklemek. Buraya kaydı olmayan bir rota için rehber
// hiç açılmaz (sessizce atlanır), bu yüzden eksik kayıt hiçbir şeyi kırmaz.
//
// Metinler HelpScreen'deki açıklamalarla aynı çizgide ama daha KISA ve
// EYLEME DÖNÜK: oyuncu oynamak istiyor, sunum izlemek değil.
// ============================================================================

export const MODE_GUIDES = {
  cpu: {
    title: "Ortak Kulüp",
    icon: "shield-checkmark",
    points: [
      "Kurulumda türü seç: Kulüp × Kulüp, Kulüp × Ülke, Takımı sen seç ya da Çoktan seçmeli.",
      "3-2-1 bitince iki taraf belirir; ikisinde de oynamış bir futbolcuyu yaz. Zil yok — cevap kutusu baştan açık.",
      "Rakibin (zorluğa göre bir karakter) aynı anda düşünüyor; önce doğru yazan turu alır. Rakip sadece tanıdığı oyuncuları bilir.",
      "3 yanlış hakkın var. Hakkın biterse ya da \"Bilemedim\" dersen rakibin cevabı hemen açılır.",
      "Tur başında \"bu ikilide N ortak futbolcu var\" yazar; zorluk arttıkça N küçülür.",
      "Kulüp × Ülke'de vatandaşlık ya da milli takım ikisi de geçer.",
    ],
  },
  draftCpu: {
    title: "Takımı Sen Seç",
    icon: "shield-checkmark",
    points: [
      "Takımlardan birini sen yazarsın, diğerini CPU seçer. Sonra ikisinde de oynamış futbolcuyu bulursun.",
      "Takım yazarken alttaki önerilere dokunmak en hızlısı.",
      "Zor bir takım seçmek CPU'nun işini de zorlaştırır — ama seninkini de.",
    ],
  },
  countryTeamCpu: {
    title: "Kulüp & Ülke",
    icon: "earth",
    points: [
      "Bir ülke ve bir kulüp belirir. O ülkeden olup o kulüpte oynamış bir futbolcu bulman gerek.",
      "Milli takımda oynamış olması şart değil — uyruğu yetiyor.",
      "\"Sen Seç\" modunda taraflar dönüşümlü: bir tur ülkeyi sen yazarsın, sonraki tur kulübü.",
      "Ülke adlarını Türkçe yazabilirsin (Hollanda, Fildişi Sahili...).",
    ],
  },
  letterCpu: {
    title: "İlk Harften Bul",
    icon: "text",
    points: [
      "Ad ve soyadın baş harfleri verilir; o harflerle başlayan bir futbolcu yazarsın.",
      "Harfleri kendin seçebilir ya da CPU'ya bıraktırabilirsin.",
      "Zincir modunda bir önceki cevabın son harfinden devam edilir. Tek başına rekor denemek için Tüm Modlar'daki Harf Zinciri'ni aç.",
    ],
  },
  whoAmICpu: {
    title: "Kim Bu Futbolcu?",
    icon: "help-circle",
    points: [
      "Gizli futbolcunun bilgileri kapalı kartlarda: kimlik, kariyer (yıllar açık) ve vitrin. Bir kart açık başlar.",
      "İstediğin kartı çevir; her kart \"şimdi bilirsen\" puanından düşer. Kart çevirmeden bilirsen ×2, 1–2 kartla ×1,5.",
      "Yanlış tahmin bir can götürür ama karşılaştırma bırakır (bayrak, mevki, yaş, lig, kulüp); ortak kulüp varsa o kart bedava açılır.",
      "Doğru tahmin bir can geri verir (en fazla 3). Jokerler: Pas ve 4 Şık (puan yarıya iner).",
    ],
  },
  quickCpu: {
    title: "Çoktan Seçmeli",
    icon: "flash",
    points: [
      "Süre 60 sn (kurulumdan değişir). Her doğru cevap +2 sn kazandırır.",
      "Art arda 3 doğru puanı ×2, 6 doğru ×3 yapar; yanlışta seri sıfırlanır.",
      "Dört soru türü: ortak futbolcu, ülke + kulüp, \"hangi kulüpte oynadı?\" ve \"hangisi burada HİÇ oynamadı?\".",
      "Zorluk kendiliğinden ayarlanır: bildikçe sorular zorlaşır, takılınca kolaylaşır.",
    ],
  },

  sunucu: {
    title: "Sunucu Modu",
    icon: "mic",
    points: [
      "2–6 kişi, tek telefon. Telefonu tutan sunucu olur, adları bir kez girersiniz.",
      "Sunucu iki kulübü yüksek sesle okur; ilk bağıran oyuncunun adına dokunur.",
      "Ekranda o çiftin doğru cevapları çıkar: sunucu ✓ ya da ✗ der. Yanlış bilen o turda bir daha cevaplayamaz.",
      "Hedef puana ilk ulaşan kazanır; maç sonunda isimli tablo ve RÖVANŞ.",
    ],
  },
  local: {
    title: "Ortak Kulüp — Yanımdaki",
    icon: "phone-portrait",
    points: [
      "Telefon ortadan ikiye bölünür, karşılıklı oturursunuz. Üstteki taraf ters döner.",
      "Cevabı ilk bilen kendi tarafındaki BİLİYORUM! düğmesine basar.",
      "Basan yanlış bilirse o tur için kilitlenir, sıra rakibe geçer.",
    ],
  },
  fiveClubs: {
    title: "5 Kulüp",
    icon: "grid",
    points: [
      "Ekranda 5 kulüp belirir. Bu kulüplerden en az ikisinde oynamış TEK bir futbolcu söylersin.",
      "Kaç kulübü tutturursan o kadar puan — 5'inde de oynamış birini bulmak en yüksek puan.",
      "Sıra sende değilken de süre işliyor, düşünmeyi turdan önce bitir.",
      "Bir kulübü hangi oyuncunun bulduğunu 1 ve 2 rozetlerinden görebilirsin.",
      "3 ya da 5 tur oynanır (kurulumdan). İstersen son tur ALTIN TUR olur: puanlar ×2.",
    ],
  },
  fiveClubsCpu: {
    title: "5 Kulüp — CPU'ya Karşı",
    icon: "grid",
    points: [
      "Ekranda 5 kulüp belirir. Bu kulüplerden en az ikisinde oynamış TEK bir futbolcu söylersin.",
      "Kaç kulübü tutturursan o kadar puan — 5'inde de oynamış birini bulmak en yüksek puan.",
      "CPU da her turda bir futbolcu söylüyor. Zorluk arttıkça daha iyi isimler buluyor ve daha nadir pas geçiyor.",
      "3 ya da 5 tur sonunda en çok puanı toplayan kazanır. Altın tur açıksa son turda puanlar ×2.",
    ],
  },
  onlineDuel: {
    title: "Online — Ortak Kulüp",
    icon: "wifi",
    points: [
      "Rakibinle aynı takımları aynı anda görürsünüz. İlk doğru cevap puanı alır.",
      "Bağlantı koparsa tur devam eder, geri geldiğinde skora kaldığın yerden bakarsın.",
    ],
  },
  // 5 Ekim 2026 (.29379 / .29648)
  onlineXox: {
    title: "Online — Futbolcu XOX",
    icon: "wifi",
    points: [
      "Odayı kuran X, katılan O. Sıran gelince bir kareye dokun ve o karenin iki kulübünde de oynamış bir futbolcu yaz.",
      "Her hamle 30 saniye; süre dolarsa ya da yanlış yazarsan sıra rakibe geçer.",
      "Çalma kuralı açık: rakibin karesine FARKLI bir futbolcuyla el koyabilirsin (3 hak).",
      "Üçlü sırayı yapan kazanır; tahta dolarsa çok kare alan. Maç sonunda ikiniz de RÖVANŞ'a dokunursanız yeni ızgara gelir.",
    ],
  },
  // Paket 16 — Online 5 Kulüp
  onlineFive: {
    title: "Online — 5 Kulüp",
    icon: "wifi",
    points: [
      "İkiniz de aynı 5 kulübü görürsünüz. En az 2'sinde oynamış TEK bir futbolcu yaz — kaç kulübü tutturursan o kadar puan.",
      "Aynı anda ve gizli oynanır: cevabın kilitlenir, rakibinki ikiniz de bitirince (ya da 40 sn dolunca) açılır.",
      "Veri setinde olmayan bir isim yazarsan cevap sayılmaz, tekrar yazabilirsin.",
      "3 tur sonunda çok puanı olan kazanır. Maç sonunda ikiniz de RÖVANŞ'a dokunursanız yeni kulüplerle baştan.",
    ],
  },
  meydanOkuma: {
    title: "Meydan Okuma",
    icon: "paper-plane",
    points: [
      "10 soru, her biri 20 saniye: iki kulübün ikisinde de oynamış bir futbolcu yaz.",
      "Bitince 6 harfli bir kod alırsın. Kodu arkadaşına gönder; o, Online → Meydan Okuma → Kodu Gir ile aynı 10 soruyu çözer.",
      "Daha çok bilen kazanır, eşitlikte daha hızlı olan. Arkadaşının çevrimiçi olması gerekmez.",
    ],
  },
  onlineWhoAmI: {
    title: "Online — Kim Bu Futbolcu?",
    icon: "wifi",
    points: [
      "İkiniz aynı kart masasındasınız: kim kart çevirirse çevirsin kart ikinize de açılır ve \"şimdi bilirsen\" potu ikiniz için düşer.",
      "İlk doğru tahmin turu ve potu alır (kart çevrilmeden ×2, 1–2 kartla ×1,5). 3 turu alan maçı kazanır.",
      "Yanlış tahmin masaya karşılaştırma satırı bırakır ve seni biri yeni bir kart çevirene kadar kilitler.",
      "Bilemeyeceğini düşünürsen turu pas geçebilirsin; ikiniz de çekilirseniz tur kimseye yazılmaz.",
    ],
  },
  // Paket 13 — Günlük Kim Bu ve Kadro Avı
  gunlukKimBu: {
    title: "Günlük Kim Bu",
    icon: "calendar",
    points: [
      "Bugün herkes aynı gizli futbolcuyu arıyor. 5 tahmin hakkın var.",
      "Kartlar tek kişilik Kim Bu ile aynı: istediğini çevir, her kart puanından düşer. Bilinmeyen isim hak götürmez.",
      "Bitince sonucu paylaş: hangi kartları çevirdiğin kareler halinde görünür, ismi ele vermez.",
    ],
  },
  kadroAvi: {
    title: "Kadro Avı",
    icon: "search-circle",
    points: [
      "Bir kadronun (kulüp sezonu ya da efsane final) henüz bulmadığın bir oyuncusu kart masasına gizlenir.",
      "Kadronun kulübünün kariyer kartı bedava açık gelir. Kartları çevir, tahmin et: 3 can, doğru +1, yanlış −1.",
      "Bildiğin her oyuncu kadroya ve ansiklopediye eklenir. Kadro dolunca rozet!",
    ],
  },
  onlineDraft: {
    title: "Online — Takımı Sen Seç",
    icon: "wifi",
    points: [
      "Sırayla takım seçersiniz: birinizin seçtiği takım diğerinin sorusu olur.",
      "Zor takım seçmek rakibi zorlar ama tur sana da dönecek.",
    ],
  },
  xox: {
    title: "Futbolcu XOX",
    icon: "grid",
    points: [
      "Izgaranın satır ve sütunlarında kulüpler var; bir kareyi almak için o iki kulüpte de oynamış futbolcuyu söyle.",
      "Bilemezsen sıra rakibe geçer. Aynı futbolcuyu birden fazla karede kullanabilirsin.",
      "ÇALMA: rakibin aldığı kareye dokunup o kare için FARKLI bir futbolcu söylersen kare senin olur. Her oyuncunun 3 çalma hakkı var (kurulumdan kapatılabilir).",
      "Üçlü sırayı yapan kazanır; tahta dolarsa çok kare alan kazanır.",
    ],
  },
  onlineLetter: {
    title: "Online — İlk Harften Bul",
    icon: "wifi",
    points: [
      "Baş harfler ikinize de aynı anda gelir, ilk doğru yazan puanı alır.",
      "Aynı futbolcu iki kez kabul edilmez.",
    ],
  },
};
