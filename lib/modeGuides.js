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
      "3-2-1 sayımı bitince iki takım belirir. İkisinde de forma giymiş bir futbolcu bulman gerek.",
      "Cevabı bildiğin an BUZZ'a bas — süre durur, sonra yazarak ya da mikrofonla söylersin.",
      "CPU da aynı anda düşünüyor. Zorluk arttıkça daha hızlı ve daha çok biliyor.",
      "Tur bitince \"Doğru cevapları göster\" ile o eşleşmedeki bütün futbolcuları görebilirsin.",
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
      "Zincir modunda bir önceki cevabın son harfinden devam edilir.",
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
    title: "Hızlı Antrenman",
    icon: "flash",
    points: [
      "İki takım gelir, 4 isim arasından doğru olanı seçersin.",
      "Doğru +1, yanlış −1. Cevap verir vermez yeni tur başlar.",
      "Buzz yok, yazma yok — sadece hız. Isınmak için birebir.",
    ],
  },
  local: {
    title: "Tek Telefon 2 Kişi",
    icon: "phone-portrait",
    points: [
      "Telefon ortadan ikiye bölünür, karşılıklı oturursunuz. Üstteki taraf ters döner.",
      "Cevabı ilk bilen kendi tarafındaki BUZZ'a basar.",
      "Buzz'layan yanlış bilirse o tur için kilitlenir, sıra rakibe geçer.",
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
    ],
  },
  fiveClubsCpu: {
    title: "5 Kulüp — CPU'ya Karşı",
    icon: "grid",
    points: [
      "Ekranda 5 kulüp belirir. Bu kulüplerden en az ikisinde oynamış TEK bir futbolcu söylersin.",
      "Kaç kulübü tutturursan o kadar puan — 5'inde de oynamış birini bulmak en yüksek puan.",
      "CPU da her turda bir futbolcu söylüyor. Zorluk arttıkça daha iyi isimler buluyor ve daha nadir pas geçiyor.",
      "3 tur sonunda en çok puanı toplayan kazanır.",
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
  onlineWhoAmI: {
    title: "Online — Kim Bu Futbolcu?",
    icon: "wifi",
    points: [
      "İpuçları iki oyuncuya da aynı anda açılır. Erken bilen çok puan alır.",
      "Yanlış tahmin sıradaki ipucunu beklemene neden olur.",
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
