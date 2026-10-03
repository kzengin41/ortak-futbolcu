// ============================================================================
// ORTAK ONLINE PROTOKOL KATMANI — 12 Eylül 2026
//
// Neden var: projede iki farklı online mimari yan yana duruyordu.
//   • OnlineDuelScreen  -> Postgres + RPC (gerçek kaynak sunucuda, sağlam
//                          ama her yeni mod için yeni SQL fonksiyonu gerekiyor)
//   • OnlineLetterScreen -> Realtime broadcast (hızlı yazılıyor ama o ekranda
//                          üç ciddi kusur vardı: subscribe geri çağrısı BAYAT
//                          `phase` okuyordu, geç katılan/kopup dönen oyuncu
//                          durumu asla alamıyordu ve paketler sırasız gelse
//                          eski durum yenisinin üstüne yazabiliyordu.)
//
// step6_online.sql'in yorumunda yazan mimari ("host-client") doğru tercihti;
// eksik olan şey onu TEK BİR yerde, düzgün yazmaktı. Bu dosya o yer.
//
// Sözleşme çok basit:
//   • Oyuncu 1 (host) durumun TEK sahibidir. Kuralları sadece o işletir.
//   • Her iki taraf da eylemlerini `gonder(aksiyon)` ile bildirir. Host kendi
//     aksiyonunu doğrudan işler, istemci kanaldan yollar — yani ekran kodu
//     "ben host muyum" diye sormak zorunda kalmaz, iki tarafta da aynı satır
//     çalışır.
//   • Host her değişiklikte artan bir sürüm (v) ile TAM durumu yayınlar.
//     İstemci sadece kendi gördüğünden BÜYÜK sürümleri uygular; böylece
//     sırası karışan paket eski durumu geri getiremez.
//   • İstemci bağlanır bağlanmaz (ve durum gelmezse periyodik olarak)
//     "senkron" ister; host tam durumu tekrar yayınlar. Uygulama arka plandan
//     dönünce ya da ağ koparsa oyun kaldığı yerden devam eder.
//   • Presence ile rakibin odada olup olmadığı takip edilir.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

const SENKRON_ISTEK_MS = 1500;   // durum gelmezse istemci bu aralıkla tekrar sorar
const SENKRON_DENEME = 8;        // ~12 sn sonra vazgeçip "bağlantı yok" der

// Gelen durum paketi uygulanmalı mı? Sırası karışan paketin eski durumu geri
// getirmemesi bu üç satıra bakıyor; testten geçirilebilsin diye ayrı duruyor.
export function durumKabulEdilsinMi(gorulenSurum, paket) {
  if (!paket || typeof paket.v !== "number") return false;
  if (paket.zorla) return true;              // senkron cevabı: sürüm eşit olsa da uygula
  return paket.v > gorulenSurum;
}

export function useOnlineRoom({
  kanalAdi,          // string — oda başına benzersiz kanal adı
  benKimim,          // 1 (host) | 2 (istemci)
  baslangicDurumu,   // host'un ilk durumu (sadece host kullanır)
  aksiyonIsle,       // (durum, aksiyon, kimden) => yeniDurum | null  (sadece host'ta çalışır)
}) {
  const hostMuyum = benKimim === 1;

  const [durum, setDurumInternal] = useState(hostMuyum ? baslangicDurumu : null);
  const [bagli, setBagli] = useState(false);
  const [rakipVar, setRakipVar] = useState(false);
  const [senkronBekliyor, setSenkronBekliyor] = useState(!hostMuyum);

  const kanalRef = useRef(null);
  const durumRef = useRef(durum);
  const surumRef = useRef(0);
  const aksiyonIsleRef = useRef(aksiyonIsle);
  const baslangicRef = useRef(baslangicDurumu);

  // Geri çağrılar her render'da yeniden yaratılıyor; kanal aboneliği ise
  // ekran ömrü boyunca BİR KEZ kuruluyor. Bayat closure sorununun (eski
  // ekrandaki asıl kusur) tek gerçek çözümü referans üzerinden okumak.
  useEffect(() => { aksiyonIsleRef.current = aksiyonIsle; });
  useEffect(() => { durumRef.current = durum; }, [durum]);

  const durumuYaz = useCallback((yeni) => {
    durumRef.current = yeni;
    setDurumInternal(yeni);
  }, []);

  // --- HOST: durumu yayınla -------------------------------------------------
  const yayinla = useCallback((yeni, { zorla = false } = {}) => {
    if (!hostMuyum) return;
    if (!yeni) return;
    surumRef.current += 1;
    durumuYaz(yeni);
    kanalRef.current?.send({
      type: "broadcast",
      event: "durum",
      payload: { v: surumRef.current, durum: yeni, zorla },
    });
  }, [hostMuyum, durumuYaz]);

  // Host'un kendi durumunu güncellemesi için fonksiyonel arayüz —
  // setState gibi çalışır ama sonucu otomatik yayınlar.
  const guncelle = useCallback((uretici) => {
    if (!hostMuyum) return;
    const oncesi = durumRef.current;
    const sonrasi = typeof uretici === "function" ? uretici(oncesi) : uretici;
    if (!sonrasi || sonrasi === oncesi) return;
    yayinla(sonrasi);
  }, [hostMuyum, yayinla]);

  // --- Her iki taraf: aksiyon gönder ---------------------------------------
  const gonder = useCallback((aksiyon) => {
    if (hostMuyum) {
      const sonrasi = aksiyonIsleRef.current?.(durumRef.current, aksiyon, 1);
      if (sonrasi) yayinla(sonrasi);
    } else {
      kanalRef.current?.send({
        type: "broadcast",
        event: "aksiyon",
        payload: { kimden: benKimim, aksiyon },
      });
    }
  }, [hostMuyum, benKimim, yayinla]);

  useEffect(() => {
    let iptal = false;
    let senkronZamanlayici = null;
    let senkronSayaci = 0;

    const kanal = supabase.channel(kanalAdi, {
      config: {
        broadcast: { self: false },
        presence: { key: String(benKimim) },
      },
    });
    kanalRef.current = kanal;

    kanal
      .on("broadcast", { event: "durum" }, ({ payload }) => {
        if (iptal || hostMuyum) return;
        if (!durumKabulEdilsinMi(surumRef.current, payload)) return;
        surumRef.current = payload.v;
        setSenkronBekliyor(false);
        durumuYaz(payload.durum);
      })
      .on("broadcast", { event: "aksiyon" }, ({ payload }) => {
        if (iptal || !hostMuyum || !payload) return;
        const sonrasi = aksiyonIsleRef.current?.(durumRef.current, payload.aksiyon, payload.kimden);
        if (sonrasi) yayinla(sonrasi);
      })
      .on("broadcast", { event: "senkronIste" }, () => {
        if (iptal || !hostMuyum) return;
        // Sürümü ARTIRMADAN mevcut durumu tekrar yolluyoruz; `zorla` bayrağı
        // istemcinin "bu sürümü zaten gördüm" kontrolünü aşmasını sağlıyor
        // (yeniden bağlanan istemcinin sayacı sıfırdan başlıyor olabilir).
        kanalRef.current?.send({
          type: "broadcast",
          event: "durum",
          payload: { v: surumRef.current, durum: durumRef.current, zorla: true },
        });
      })
      .on("presence", { event: "sync" }, () => {
        if (iptal) return;
        const hepsi = kanal.presenceState() || {};
        const rakipAnahtari = String(benKimim === 1 ? 2 : 1);
        setRakipVar(Boolean(hepsi[rakipAnahtari]?.length));
      })
      .subscribe((status) => {
        if (iptal) return;
        if (status !== "SUBSCRIBED") {
          setBagli(false);
          return;
        }
        setBagli(true);
        kanal.track({ oyuncu: benKimim, t: Date.now() });

        if (hostMuyum) {
          // Host bağlanınca ilk durumu yayınlar — istemci önce bağlanmış olsa
          // bile onun senkron isteği bu yayını tekrar tetikleyecek.
          if (!durumRef.current) durumuYaz(baslangicRef.current);
          surumRef.current += 1;
          kanal.send({
            type: "broadcast",
            event: "durum",
            payload: { v: surumRef.current, durum: durumRef.current, zorla: true },
          });
        } else {
          const iste = () => {
            if (iptal) return;
            if (durumRef.current) return;              // durum geldi, bitti
            if (senkronSayaci >= SENKRON_DENEME) {
              setSenkronBekliyor(false);               // ekran "bağlanılamadı" gösterebilsin
              return;
            }
            senkronSayaci += 1;
            kanal.send({ type: "broadcast", event: "senkronIste", payload: {} });
            senkronZamanlayici = setTimeout(iste, SENKRON_ISTEK_MS);
          };
          iste();
        }
      });

    return () => {
      iptal = true;
      if (senkronZamanlayici) clearTimeout(senkronZamanlayici);
      try { kanal.untrack(); } catch (e) {}
      kanal.unsubscribe();
      kanalRef.current = null;
    };
    // Kanal ekran ömrü boyunca tek sefer kurulur; değişen her şeye ref'ten
    // erişiliyor (bkz. yukarıdaki not).
  }, [kanalAdi, benKimim, hostMuyum, durumuYaz, yayinla]);

  return {
    durum,
    hostMuyum,
    bagli,
    rakipVar,
    senkronBekliyor,
    gonder,
    guncelle,   // sadece host: zamanlayıcı/otomatik geçişler için
  };
}

// Ekranların ortak ihtiyacı: "rakip mi ben mi" etiketleri.
export function benimSkorum(skorlar, benKimim) {
  return benKimim === 1 ? skorlar?.p1 ?? 0 : skorlar?.p2 ?? 0;
}
export function rakipSkoru(skorlar, benKimim) {
  return benKimim === 1 ? skorlar?.p2 ?? 0 : skorlar?.p1 ?? 0;
}

// ============================================================================
// TEK DOKUNUŞLA RÖVANŞ — 5 Ekim 2026 (benchmark .29750)
// Eskiden rövanşı SADECE ev sahibi başlatabiliyordu; misafir "Rövanşı ev
// sahibi başlatabilir" yazısına bakıp bekliyordu. Artık iki taraf da
// "RÖVANŞ"a dokunur: ilk dokunan istek bırakır (rakibin ekranında "Rakip
// rövanş istiyor — KABUL ET" çıkar), ikinci dokunuşta yeni maç başlar.
// Mod kurallarına dokunmadan: ekran, aksiyon işleyicisini rovansli(...) ile
// sarıyor; asıl "rovans" aksiyonu (yeni maç durumu) yalnızca iki taraf da
// istediğinde çalışıyor.
// ============================================================================
export function rovansIstegi(durum, kimden, yeniMac) {
  if (!durum || durum.faz !== "macSonu" || (kimden !== 1 && kimden !== 2)) return null;
  const istek = Array.isArray(durum.rovansIstek) ? durum.rovansIstek : [];
  if (istek.includes(kimden)) return null;
  const rakip = kimden === 1 ? 2 : 1;
  if (istek.includes(rakip)) {
    const yeni = yeniMac();
    if (!yeni) return null;
    return { ...yeni, rovansIstek: [] };
  }
  return { ...durum, rovansIstek: [...istek, kimden] };
}

export function rovansli(aksiyonIsle) {
  return (durum, aksiyon, kimden, ...ek) =>
    aksiyon && aksiyon.tip === "rovans"
      ? rovansIstegi(durum, kimden, () => aksiyonIsle(durum, aksiyon, kimden, ...ek))
      : aksiyonIsle(durum, aksiyon, kimden, ...ek);
}

// Maç sonu rövanş düğmesinin hâli (ekranlar arası ortak).
export function rovansHali(durum, benKimim, rakipVar) {
  const istek = (durum && Array.isArray(durum.rovansIstek)) ? durum.rovansIstek : [];
  const rakip = benKimim === 1 ? 2 : 1;
  if (!rakipVar) return { etiket: "RAKİP AYRILDI", pasif: true, rakipIstiyor: false };
  if (istek.includes(benKimim)) return { etiket: "RAKİP BEKLENİYOR…", pasif: true, rakipIstiyor: false };
  if (istek.includes(rakip)) return { etiket: "KABUL ET — RÖVANŞ", pasif: false, rakipIstiyor: true };
  return { etiket: "RÖVANŞ", pasif: false, rakipIstiyor: false };
}
