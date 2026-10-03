// ============================================================================
// GÜNÜN BULMACASI — 12 Eylül 2026
//
// Tutundurma (retention) özelliği: herkese AYNI GÜN AYNI soru, günde bir kez,
// 3 deneme hakkı. Wordle'ın işe yarama sebebi tam olarak bu üçlü — paylaşılan
// bir soru, sınırlı hak ve ertesi günü beklemek.
//
// TASARIM KARARI — SUNUCU YOK: soru, TARİHTEN türeyen bir tohumla (seed)
// deterministik olarak seçiliyor. Aynı gün, aynı uygulama sürümü, aynı cihaz
// bağımsız aynı soru. Böylece ne yeni bir tablo, ne bir edge function, ne de
// çevrimiçi olma zorunluluğu var; uçakta bile çalışıyor.
//
// Tohumun tarihi YEREL: "günün bulmacası" kullanıcının takvim gününe göre
// değişmeli. UTC kullansaydık Türkiye'de gece yarısından sonra 3 saat boyunca
// "dünün" bulmacası görünürdü.
// ============================================================================
import { playersForPair, rezervTakimMi, FIVE_CLUB_POOL } from "./gameEngine";
import { canonicalClub } from "./clubAliases";

export const DENEME_HAKKI = 3;

// Tohum ve üreteç lib/tohum.js'e taşındı (günlük görevler veri setini yüklemesin);
// eski içe aktarmalar bozulmasın diye buradan da dışa veriliyor.
import { tohum, uretec } from "./tohum";
export { tohum, uretec };

// 4 Ekim 2026 (benchmark .29542) — "Günün sorusu uygulama sürümünden bağımsız
// olsun: maç listesi sıralı bir dosya, gün numarası = sıra." Sorular artık
// lib/gunlukTakvim.json'da SABİT (2 yıl); veri dosyası güncellense de aynı gün
// herkes aynı çifti görür. Takvim bitince eski tohum yöntemine düşülür.
import TAKVIM from "./gunlukTakvim.json";
export function takvimdenGun(oyun, no) {
  const liste = TAKVIM && TAKVIM[oyun];
  return liste && no >= 1 && no <= liste.length ? liste[no - 1] : null;
}

export function gunAnahtari(d = new Date()) {
  const a = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${a}-${g}`;
}

// Bulmacanın kaçıncı gün olduğu — paylaşım metninde "#137" gibi görünüyor.
const BASLANGIC = Date.UTC(2026, 8, 12); // 12 Eylül 2026
export function gunNumarasi(d = new Date()) {
  const bugun = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(1, Math.round((bugun - BASLANGIC) / 86400000) + 1);
}

export const ASGARI_CEVAP = 4;   // bulmaca en az bu kadar geçerli cevabı olmalı

// İLK ÜRETİMDE ÇIKAN SORUN: filtre yokken günün sorusu "Jong Ajax + Ajax",
// "Atlético Madrid B + Atlético Madrid" ya da "Maccabi Tel Aviv + Hapoel
// Be'er Sheva" gibi çıkıyordu. Günün bulmacası uygulamanın vitrini —
// paylaşılacak, ekran görüntüsü alınacak — bu yüzden İKİ KULÜP DE tanıdık
// olmak zorunda. FIVE_CLUB_POOL zaten bu iş için elle küratörlenmiş
// (MEGA + BIG + Şampiyonlar Ligi klasikleri + tanıdık ekler) bir liste.
const TANIDIK = new Set(FIVE_CLUB_POOL.map((c) => canonicalClub(c) || c));

function ciftUygunMu(teamA, teamB) {
  if (!teamA || !teamB || teamA === teamB) return false;
  if (rezervTakimMi(teamA) || rezervTakimMi(teamB)) return false;
  const a = canonicalClub(teamA) || teamA;
  const b = canonicalClub(teamB) || teamB;
  if (a === b) return false;                    // aynı kulüp ailesi (A takımı + B takımı)
  return TANIDIK.has(a) && TANIDIK.has(b);
}

// UYGUN İKİLİ LİSTESİ
// İlk tasarım her gün için "rastgele oyuncu seç, kulüplerinden ikisini al,
// uygun mu bak" döngüsü çalıştırıyordu. İki sorunu vardı: (a) aynı ikili yıl
// içinde 7 kez tekrar ediyordu, hatta 4 gün arayla ("Beşiktaş + Galatasaray"
// #4 ve #8), (b) tekrarları önlemek için geçmiş günleri yeniden üretmek
// gerekiyordu ve tek üretim ~30 ms — telefonda 30 günlük geriye bakış saniyeler
// sürerdi.
//
// Şimdiki yaklaşım: TÜM uygun ikililer TEK BİR GEÇİŞTE çıkarılıyor, sabit bir
// tohumla karıştırılıyor ve gün numarası bu dizide bir İNDİS oluyor. Böylece
// liste tükenene kadar hiçbir ikili tekrar etmiyor ve günlük maliyet tek bir
// playersForPair çağrısı.
//
// NOT: liste veri setinden türediği için uygulama güncellemesiyle veri değişirse
// sıra da değişebilir. Günün sorusu o gün içinde sabit kaldığı sürece sorun
// değil (aynı sürümdeki herkes aynı soruyu görür).
let _ikiliOnbellek = null;

export function uygunIkililer(veriSeti) {
  if (_ikiliOnbellek) return _ikiliOnbellek;
  const sayac = new Map();
  for (const p of veriSeti) {
    const kulupler = [];
    for (const c of p.clubs || []) {
      if (rezervTakimMi(c)) continue;
      const k = canonicalClub(c) || c;
      if (TANIDIK.has(k) && !kulupler.includes(k)) kulupler.push(k);
    }
    for (let i = 0; i < kulupler.length; i++) {
      for (let j = i + 1; j < kulupler.length; j++) {
        const anahtar = [kulupler[i], kulupler[j]].sort().join("|");
        sayac.set(anahtar, (sayac.get(anahtar) || 0) + 1);
      }
    }
  }
  const liste = [];
  for (const [anahtar, adet] of sayac) if (adet >= ASGARI_CEVAP) liste.push(anahtar);
  liste.sort();                                   // cihazdan bağımsız kararlı sıra
  _ikiliOnbellek = karistir(liste, uretec(0x3210BEEF));
  return _ikiliOnbellek;
}

// Fisher-Yates — verilen üreteçle deterministik.
function karistir(dizi, rnd) {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Günün sorusunu üretir. Aynı tarih için HER ZAMAN aynı sonuç.
export function gununBulmacasi(veriSeti, tarihMetni = gunAnahtari()) {
  const no = gunNumarasi(new Date(`${tarihMetni}T12:00:00`));
  const sabit = takvimdenGun("bulmaca", no);
  let teamA, teamB;
  if (sabit) {
    [teamA, teamB] = sabit;
  } else {
    const ikililer = uygunIkililer(veriSeti);
    if (!ikililer.length) return null;
    const indis = (no - 1) % ikililer.length;
    [teamA, teamB] = ikililer[indis].split("|");
  }
  const gecerli = playersForPair(veriSeti, teamA, teamB);
  if (gecerli.length < ASGARI_CEVAP) return null;  // veri değişmişse güvenlik payı

  return {
    tarih: tarihMetni,
    no,
    teamA,
    teamB,
    gecerliCevaplar: gecerli,
    toplamCevap: gecerli.length,
  };
}

// Paylaşım metni — cevabı ASLA yazmıyor, sadece kaç denemede bilindiğini.
export function paylasimMetni(sonuc) {
  if (!sonuc) return "";
  const kutular = [];
  for (let i = 0; i < DENEME_HAKKI; i++) {
    if (sonuc.bilindi && i === sonuc.denemeSayisi - 1) kutular.push("🟩");
    else if (i < sonuc.denemeSayisi) kutular.push("🟥");
    else kutular.push("⬜");
  }
  const bas = sonuc.bilindi ? `${sonuc.denemeSayisi}/${DENEME_HAKKI}` : `X/${DENEME_HAKKI}`;
  return `3-2-1 Günün Bulmacası #${sonuc.no} — ${bas}\n${kutular.join("")}\n${sonuc.teamA} + ${sonuc.teamB}`;
}
