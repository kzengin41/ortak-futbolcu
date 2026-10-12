import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeScroll } from "../components/Klavye";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import { ModKarti, ModBolumu, ModSecimPenceresi, modStilleri } from "../components/ModKarti";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { standartProfil } from "../lib/eslesmeProfili";
import {
  odaKur, odaAktifOlunca, odayiKapat, koduylaKatil, rastgeleOdaBul, kulupKimlikleri, odaNesnesi,
} from "../lib/onlineLobi";
import { gecmis as meydanGecmisi } from "../lib/meydanOkuma";
import LiderlikPenceresi, { DereceRozeti } from "../components/LiderlikPenceresi";
import AdSecPenceresi from "../components/AdSecPenceresi";
import { useDerece } from "../lib/derece";
import { getProfile } from "../lib/profile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// ONLINE LOBİ — 5 Ekim 2026 yeniden tasarım (benchmark .29772 / .29682 / .29648)
//
// Eski lobi: mod listesi + "Oda Kur" + "Kodla Katıl". "Rastgele rakip"
// fonksiyonu yazılmıştı ama hiçbir düğmeye bağlı değildi; olsa da bekleyen
// HER odaya (arkadaşına kod göndermiş birininkine bile) girerdi.
//
// Yeni lobi üç yol sunuyor:
//   1) RASTGELE RAKİP — bekleyen rastgele odaya gir, yoksa kur ve bekle.
//      30 sn sonra kimse gelmediyse öneri: "kodu arkadaşına gönder" ya da
//      "bu arada CPU'ya karşı oyna" (benchmark .29682: boş lobi riski).
//   2) ARKADAŞINLA — 5 haneli kodla oda kur / katıl (eski akış).
//   3) MEYDAN OKUMA — arkadaşın çevrimiçi olmasa da: 10 soruluk asenkron
//      düello, sonuç 6 harfli bir kodla paylaşılır (lib/meydanOkuma.js).
// Oda işlemleri lib/onlineLobi.js'te (maç sonu rövanşı da aynısını kullanıyor).
//
// Paket 16 (5 Ekim 2026, Kerem: "Online alanındaki tasarımı da tıpkı Tüm Modlar
// alanındaki gibi yapalım") — ana ekran artık Tüm Modlar'ın birebir aynısı:
// başlıklı bölümler + renkli mod kartları (components/ModKarti.js). Karta
// dokununca aynı pencere açılıyor: "Rastgele Rakip Bul / Oda Kur / Kodla Katıl".
// Kodla Katıl ve Meydan Okuma "Arkadaşınla" bölümünde kendi kartlarında.
// Yeni mod: Online 5 Kulüp (gameMode "five", screens/OnlineFiveScreen.js).
// Paket 18: kartlar yatay, ikonlar components/ModIkon.js (Tüm Modlar ile aynı).
// Paket 22 (Kerem: "online sekmesine hızlı eşleştirme butonu koymamız lazım",
// "takımı sen seç açıklaması yanlış... ortak kulüp içine gönderebiliriz"):
//   - En üstte HIZLI EŞLEŞ: modu fark etmeksizin bekleyen ilk rastgele odaya
//     girer; kimse yoksa Ortak Kulüp odası kurup bekler (beklerken de her moda
//     bakmaya devam eder).
//   - "Takımı Sen Seç" ayrı kart değil: Tüm Modlar'daki gibi Ortak Kulüp'ün
//     içinde bir TÜR. Açıklaması kurala göre düzeldi (lib/onlineDraft.js:
//     sırayla takım seçilir, seçtiğin takım rakibin sorusu olur; bilemezse
//     puan seçene).
// Paket 23 (11 Ekim 2026, Kerem onayı): Casual/Ranked düğmesi KALKTI.
//   • Rastgele rakip + Hızlı Eşleş = DERECELİ (online puan değişir),
//   • Arkadaş odası (kod) = DOSTLUK.
//   Üstteki rozet online puanı ve ligi gösterir, dokununca liderlik tablosu.
//   İlk dereceli aramadan önce takma ad yoksa seçtirilir. Eşleşme puana göre:
//   ±150 ile başlar, beklerken her 10 sn'de +100 genişler, 30 sn sonra herkes.
// ============================================================================
export const GAME_MODES = [
  { id: "classic", ikon: "ortakKulup", grup: "ortak", label: "Ortak Kulüp", desc: "İki takımda da oynamış futbolcuyu rakibinden önce bul. İstersen takımları sırayla siz seçin", icon: "shield-checkmark", colorKey: "teamTeam" },
  // Kartı yok (Ortak Kulüp'ün içinde bir tür); bekleme ekranı ve modIstegi için listede duruyor.
  { id: "draft", ikon: "takimiSenSec", grup: "ortak", gizli: true, label: "Ortak Kulüp · Takımı Sen Seç", desc: "Sırayla takım seçersiniz: seçtiğin takım rakibin sorusu olur, bilemezse puan senin", icon: "create", colorKey: "teamCountry" },
  { id: "five", ikon: "besKulup", grup: "ortak", label: "5 Kulüp", desc: "Aynı anda gizli cevap, en çok kulübü tutturan alır", icon: "podium", colorKey: "fiveClubs", rozet: "YENİ" },
  { id: "xox", ikon: "xox", grup: "ortak", label: "Futbolcu XOX", desc: "3×3 ızgara, sırayla kare kap", icon: "grid", colorKey: "xox" },
  { id: "whoami", ikon: "kimBu", grup: "bilgi", label: "Kim Bu Futbolcu?", desc: "İpuçlarından gizli futbolcuyu bil", icon: "help-circle", colorKey: "whoAmI" },
  { id: "letter", ikon: "ilkHarf", grup: "bilgi", label: "İlk Harften Bul", desc: "Harfle başlayan futbolcuyu bul", icon: "text", colorKey: "letters" },
  { id: "letter2", ikon: "harfiSenSec", grup: "bilgi", label: "Harfi Sen Seç", desc: "Harfleri siz belirleyin, yarış başlasın", icon: "create-outline", colorKey: "letters" },
].map((m) => ({ ...m, title: m.label }));
const GRUPLAR = [
  { id: "ortak", baslik: "Ortak Futbolcu Oyunları", ikon: "shield-checkmark" },
  { id: "bilgi", baslik: "Bilgi & Hız", ikon: "bulb" },
];
// Kulüp kimliği (allowedClubIds) gerektirmeyen modlar: kendi üreticileri var.
const KULUPSUZ = new Set(["xox", "five"]);
// Hızlı Eşleş'te aranacak modlar: bu sürümün oynayabildiği bütün online modlar.
const HIZLI_MODLAR = GAME_MODES.map((m) => m.id);
const KODLA_KATIL = { ikon: "kodlaKatil", title: "Kodla Katıl", desc: "Arkadaşın oda kurduysa 5 haneli kodunu yaz", icon: "key", colorKey: "online" };
const MEYDAN = { ikon: "meydanOkuma", title: "Meydan Okuma", desc: "10 soruyu çöz, kodunu gönder. Arkadaşın müsait olunca çözsün", icon: "paper-plane", colorKey: "dailyPuzzle" };
export const ONERI_SN = 30;          // rastgele aramada öneri kartının çıkış süresi
// Puana göre eşleşme penceresi (sn cinsinden bekleme -> izin verilen puan farkı; null = herkes)
export function eslesmePenceresi(gecenSn) {
  if (gecenSn >= 30) return null;
  return 150 + 100 * Math.floor(gecenSn / 10);
}
const YOKLAMA_MS = 6000;             // beklerken daha eski bir rastgele oda var mı?

export default function OnlineLobbyScreen({ onRoomReady, onCpu, onMeydanOkuma, modIstegi }) {
  const baslangicModu = modIstegi && modIstegi.mod;
  const eslesme = useEslesmeProfili();
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [gameMode, setGameMode] = useState(baslangicModu && GAME_MODES.some((m) => m.id === baslangicModu) ? baslangicModu : "classic");
  const [hizli, setHizli] = useState(false);       // Hızlı Eşleş araması mı (her mod)
  const { kart: derece } = useDerece();
  const [liderlikAcik, setLiderlikAcik] = useState(false);
  const [adIstegi, setAdIstegi] = useState(null);   // ad seçilince çalışacak arama
  const [adOnerisi, setAdOnerisi] = useState("");
  const gecenRef = useRef(0);
  // ekran: ana | arama (rastgele) | oda (arkadaş odası bekliyor)
  const [ekran, setEkran] = useState("ana");
  // açık pencere: { tip: "mod", mod } | { tip: "katil" } | { tip: "meydan", kodGir }
  const [pencere, setPencere] = useState(null);
  const [oda, setOda] = useState(null);           // bekleyen odanın satırı
  const [joinCode, setJoinCode] = useState("");
  const [meydanKod, setMeydanKod] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");
  const [gecen, setGecen] = useState(0);
  const [sonMeydan, setSonMeydan] = useState(null);
  const birakRef = useRef(null);
  const odaRef = useRef(null);
  const canliRef = useRef(true);

  // Tüm Modlar → "XOX Online" gibi girişler o modun penceresini açık getirir.
  // (modIstegi her girişte yeni bir nesne: aynı mod ikinci kez istense de uygulanır.)
  useEffect(() => {
    let m = baslangicModu && GAME_MODES.find((x) => x.id === baslangicModu);
    if (m && m.gizli) m = GAME_MODES.find((x) => x.id === "classic");   // draft -> Ortak Kulüp penceresi
    if (m) { setGameMode(m.id); setPencere({ tip: "mod", mod: m }); }
  }, [modIstegi]);

  useEffect(() => {
    meydanGecmisi().then((g) => canliRef.current && setSonMeydan(g[0] || null)).catch(() => {});
    return () => {
      canliRef.current = false;
      birakRef.current?.();
      if (odaRef.current) odayiKapat(odaRef.current.id);
    };
  }, []);

  function hazir(room) {
    try { require("../lib/olcum").olay("online_eslesme", { mod: room && room.gameMode, veri: { sn: gecenRef.current, d: room && room.isRanked ? 1 : 0, h: hizli ? 1 : 0 } }); } catch (e) {}
    birakRef.current?.();
    birakRef.current = null;
    odaRef.current = null;
    setOda(null);
    setEkran("ana");
    setPencere(null);
    setCalisiyor(false);
    onRoomReady(room);
  }

  function hataGoster(e) {
    setHata(e?.message || String(e || "Bir şeyler ters gitti"));
    setCalisiyor(false);
  }

  async function odaKurVeBekle(rastgele, mod) {
    // Paket 27: dereceli (rastgele) odada herkes aynı Dengeli havuz; arkadaş odasında kuranın profili.
    const profil = rastgele ? standartProfil() : eslesme.derlenmis;
    const allowedClubIds = KULUPSUZ.has(mod) ? null : await kulupKimlikleri(profil.onlineKapsam());
    const puan = derece && Number.isFinite(derece.puan) ? derece.puan : null;
    const satir = await odaKur({ gameMode: mod, isRanked: rastgele, allowedClubIds, rastgele, puan: rastgele ? puan : null });
    if (!canliRef.current) { odayiKapat(satir.id); return null; }
    odaRef.current = satir;
    setOda(satir);
    birakRef.current = odaAktifOlunca(satir.id, (yeni) => hazir(odaNesnesi({ ...satir, ...yeni }, 1)));
    return satir;
  }

  // --- 1) Rastgele rakip ------------------------------------------------------
  // herMod: Hızlı Eşleş — bekleyen her moddaki odaya bakar, yoksa `mod` odası kurar.
  // Dereceli aramadan önce takma ad (yoksa) seçtirilir.
  function rastgeleAra(mod, herMod = false) {
    if (derece && derece.durum === "tamam" && !derece.takma_ad) {
      setPencere(null);
      getProfile().then((p) => setAdOnerisi((p && p.name) || "")).catch(() => {});
      setAdIstegi(() => () => aramayaBasla(mod, herMod));
      return;
    }
    aramayaBasla(mod, herMod);
  }

  async function aramayaBasla(mod, herMod = false) {
    setGameMode(mod);
    setHizli(herMod);
    setPencere(null);
    setHata("");
    setCalisiyor(true);
    setEkran("arama");
    setGecen(0);
    gecenRef.current = 0;
    try {
      const puan = derece && Number.isFinite(derece.puan) ? derece.puan : null;
      const bulunan = await rastgeleOdaBul({ gameMode: mod, modlar: herMod ? HIZLI_MODLAR : null, isRanked: true, puan, pencere: eslesmePenceresi(0) });
      if (bulunan) { hazir(bulunan); return; }
      await odaKurVeBekle(true, mod);
      setCalisiyor(false);
    } catch (e) {
      setEkran("ana");
      hataGoster(e);
    }
  }

  // Arama sürerken: sayaç + daha önce kurulmuş bir rastgele oda çıktı mı?
  useEffect(() => {
    if (ekran !== "arama" || !oda) return;
    const t = setInterval(() => setGecen((g) => { gecenRef.current = g + 1; return g + 1; }), 1000);
    const y = setInterval(async () => {
      try {
        const puan = derece && Number.isFinite(derece.puan) ? derece.puan : null;
        const eski = await rastgeleOdaBul({ gameMode, modlar: hizli ? HIZLI_MODLAR : null, isRanked: true, oncesi: oda.created_at, puan, pencere: eslesmePenceresi(gecenRef.current) });
        if (!eski || !canliRef.current) return;
        birakRef.current?.();
        await odayiKapat(oda.id);
        hazir(eski);
      } catch (e) {}
    }, YOKLAMA_MS);
    return () => { clearInterval(t); clearInterval(y); };
  }, [ekran, oda, gameMode, hizli, derece && derece.puan]);

  // --- 2) Arkadaşınla ---------------------------------------------------------
  async function arkadasOdasiKur(mod) {
    setGameMode(mod);
    setPencere(null);
    setHata("");
    setCalisiyor(true);
    setEkran("oda");
    try { await odaKurVeBekle(false, mod); setCalisiyor(false); } catch (e) { setEkran("ana"); hataGoster(e); }
  }

  async function koduylaGir() {
    if (!joinCode.trim()) return;
    setHata("");
    setCalisiyor(true);
    try { hazir(await koduylaKatil(joinCode)); } catch (e) { hataGoster(e); }
  }

  function bekleyiIptal() {
    try { require("../lib/olcum").olay("online_iptal", { mod: gameMode, veri: { sn: gecenRef.current } }); } catch (e) {}
    birakRef.current?.();
    birakRef.current = null;
    if (odaRef.current) odayiKapat(odaRef.current.id);
    odaRef.current = null;
    setOda(null);
    setEkran("ana");
    setCalisiyor(false);
  }

  function koduPaylas() {
    if (!oda) return;
    const mod = GAME_MODES.find((m) => m.id === gameMode);
    Share.share({ message: `⚽ 3-2-1: Bitir İşi — benimle online ${mod ? mod.label : ""} oyna!\nUygulamada Online → Kodla Katıl: ${oda.code}` }).catch(() => {});
  }

  function cpuyaGec() {
    const m = gameMode;
    bekleyiIptal();
    onCpu && onCpu(m);
  }

  const seciliMod = GAME_MODES.find((m) => m.id === gameMode) || GAME_MODES[0];

  // ---------------------------------------------------------------- bekleme ekranları
  if (ekran === "arama" || ekran === "oda") {
    const rastgele = ekran === "arama";
    const oneri = rastgele && gecen >= ONERI_SN;
    return (
      <GameBackground style={styles.container}>
        <KlavyeScroll contentContainerStyle={[styles.scrollContent, styles.beklemePay]} showsVerticalScrollIndicator={false}>
          <TabHeader compact />
          <View style={styles.waitCard}>
            <View style={styles.modRozet}>
              <Ionicons name={seciliMod.icon} size={14} color={COLORS.accent} />
              <Text style={styles.modRozetYazi}>{rastgele && hizli ? "Hızlı Eşleş · her mod" : seciliMod.label} · {rastgele ? "Dereceli" : "Dostluk"}</Text>
            </View>
            {rastgele ? (
              <>
                <ActivityIndicator color={COLORS.accent} size="large" style={{ marginTop: SPACING.lg }} />
                <Text style={styles.waitTitle}>{oda ? "Rakip aranıyor…" : "Bağlanılıyor…"}</Text>
                {oda ? <Text style={styles.sayac}>{`${Math.floor(gecen / 60)}:${String(gecen % 60).padStart(2, "0")}`}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.label}>Bu kodu arkadaşına gönder</Text>
                <Text style={styles.codeText} selectable>{oda ? oda.code : "·····"}</Text>
                <SoundPressable style={[styles.primaryBtn, { alignSelf: "stretch", marginTop: SPACING.md }]} onPress={koduPaylas} disabled={!oda}>
                  <Ionicons name="share-social" size={20} color={COLORS.accentDark} />
                  <Text style={styles.primaryBtnText}>Kodu Paylaş</Text>
                </SoundPressable>
                <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.lg }} />
                <Text style={styles.waitingText}>Arkadaşın bekleniyor...</Text>
              </>
            )}
          </View>

          {oneri ? (
            <View style={styles.oneriKart}>
              <Ionicons name="people" size={22} color={COLORS.cta} />
              <Text style={styles.oneriBaslik}>Şu an çevrimiçi rakip az</Text>
              <Text style={styles.oneriYazi}>Arkadaşını çağır: aşağıdaki kodu gönder, o da Kodla Katıl'a yazsın. Ya da bu arada CPU'ya karşı oyna.</Text>
              <Text style={styles.oneriKod} selectable>{oda?.code}</Text>
              <SoundPressable style={[styles.primaryBtn, { alignSelf: "stretch" }]} onPress={koduPaylas}>
                <Ionicons name="share-social" size={20} color={COLORS.accentDark} />
                <Text style={styles.primaryBtnText}>Arkadaşına Gönder</Text>
              </SoundPressable>
              <SoundPressable style={[styles.secondaryBtn, { alignSelf: "stretch" }]} onPress={cpuyaGec}>
                <Ionicons name="hardware-chip" size={18} color={COLORS.text} />
                <Text style={styles.secondaryBtnText}>Bu arada CPU'ya karşı oyna</Text>
              </SoundPressable>
            </View>
          ) : null}

          <SoundPressable onPress={bekleyiIptal} style={styles.cancelPill}>
            <Text style={styles.cancelPillText}>{rastgele ? "Aramayı İptal Et" : "İptal Et"}</Text>
          </SoundPressable>
        </KlavyeScroll>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- ana ekran
  const meydanBasla = (kod) => { setPencere(null); onMeydanOkuma && onMeydanOkuma(kod); };
  const pencereMod = pencere?.tip === "mod" ? pencere.mod : pencere?.tip === "katil" ? KODLA_KATIL : pencere?.tip === "meydan" ? MEYDAN : null;
  let pencereIcerik = null;
  let secenekler = [];
  if (pencere?.tip === "mod" && pencere.mod.id === "classic") {
    // Tüm Modlar'daki gibi tür seçimi pencerenin içinde: rastgele takımlar / takımı sen seç
    const tur = "Dereceli";
    secenekler = [
      { anahtar: "c-rastgele", grup: "RASTGELE TAKIMLAR", ikon: "flash", label: "Rastgele Rakip Bul", alt: `${tur} · iki takım gelir, ortak oyuncuyu ilk bulan alır`, kapali: calisiyor, onPress: () => rastgeleAra("classic") },
      { anahtar: "c-oda", grup: "RASTGELE TAKIMLAR", ikon: "add-circle", label: "Oda Kur", alt: "Dostluk · kodu arkadaşına gönder, o katılsın", kapali: calisiyor, onPress: () => arkadasOdasiKur("classic") },
      { anahtar: "d-rastgele", grup: "TAKIMI SEN SEÇ", ikon: "flash", label: "Rastgele Rakip Bul", alt: `${tur} · sırayla takım seçersiniz, seçtiğin takım rakibin sorusu olur`, kapali: calisiyor, onPress: () => rastgeleAra("draft") },
      { anahtar: "d-oda", grup: "TAKIMI SEN SEÇ", ikon: "add-circle", label: "Oda Kur", alt: "Rakip bilemezse puan seçene — kodu arkadaşına gönder", kapali: calisiyor, onPress: () => arkadasOdasiKur("draft") },
      { anahtar: "katil", grup: "ARKADAŞINLA", ikon: "key", label: "Kodla Katıl", alt: "Arkadaşının kodu sende mi?", onPress: () => { setHata(""); setPencere({ tip: "katil" }); } },
    ];
  } else if (pencere?.tip === "mod") {
    const m = pencere.mod.id;
    secenekler = [
      { anahtar: "rastgele", grup: "RASTGELE RAKİP", ikon: "flash", label: "Rastgele Rakip Bul", alt: "Dereceli · puanına yakın rakip", kapali: calisiyor, onPress: () => rastgeleAra(m) },
      { anahtar: "oda", grup: "ARKADAŞINLA", ikon: "add-circle", label: "Oda Kur", alt: "Dostluk · kodu arkadaşına gönder, o katılsın", kapali: calisiyor, onPress: () => arkadasOdasiKur(m) },
      { anahtar: "katil", grup: "ARKADAŞINLA", ikon: "key", label: "Kodla Katıl", alt: "Arkadaşının kodu sende mi?", onPress: () => { setHata(""); setPencere({ tip: "katil" }); } },
    ];
  } else if (pencere?.tip === "meydan" && !pencere.kodGir) {
    secenekler = [
      { anahtar: "yeni", grup: "ÇEVRİMDIŞI DA OLUR", ikon: "paper-plane", label: "Meydan Oku", alt: "10 soru çöz, kodunu gönder", onPress: () => meydanBasla() },
      { anahtar: "kod", grup: "ÇEVRİMDIŞI DA OLUR", ikon: "mail-open", label: "Kodu Gir", alt: "Sana gelen meydan okumayı kabul et", onPress: () => { setMeydanKod(""); setPencere({ tip: "meydan", kodGir: true }); } },
    ];
  } else if (pencere?.tip === "katil" || pencere?.tip === "meydan") {
    const katil = pencere.tip === "katil";
    const deger = katil ? joinCode : meydanKod;
    const gonder = () => { if (!deger.trim()) return; if (katil) koduylaGir(); else meydanBasla(deger.trim()); };
    pencereIcerik = (
      <View style={modStilleri.modalOptions}>
        <Text style={modStilleri.kiminle}>{katil ? "Oda kodu" : "Meydan okuma kodu"}</Text>
        <TextInput
          value={deger}
          onChangeText={(t) => { (katil ? setJoinCode : setMeydanKod)(t); setHata(""); }}
          placeholder={katil ? "ODA KODU" : "MEYDAN OKUMA KODU"}
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={styles.input}
          onSubmitEditing={gonder}
        />
        {hata ? <Text style={styles.pencereHata}>{hata}</Text> : null}
        <SoundPressable style={modStilleri.modalOptionBtn} onPress={gonder} disabled={calisiyor}>
          <Ionicons name={katil ? "enter" : "checkmark-circle"} size={20} color={COLORS.accentDark} />
          <Text style={modStilleri.modalOptionText}>{katil ? (calisiyor ? "Katılıyor..." : "Katıl") : "Kabul Et"}</Text>
        </SoundPressable>
      </View>
    );
  }

  return (
    <GameBackground style={styles.container} klavye="pay">
      <KlavyeScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.ustKisim}>
          <TabHeader compact />
          <Text style={styles.title}>Online 1v1</Text>
          <View style={styles.ayarSatir}>
            <SoundPressable onPress={() => setLeagueModalOpen(true)} style={styles.presetRow}>
              <Ionicons name="filter" size={16} color={COLORS.accent} />
              <Text style={styles.presetRowText} numberOfLines={1}>Arkadaş odası: {eslesme.derlenmis.etiket}</Text>
            </SoundPressable>
            <DereceRozeti kart={derece} onPress={() => setLiderlikAcik(true)} />
          </View>
          {/* Paket 22 — Hızlı Eşleş: her moddaki bekleyen ilk rakip */}
          <SoundPressable
            onPress={() => rastgeleAra("classic", true)}
            disabled={calisiyor}
            style={styles.hizliBtn}
            accessibilityRole="button"
            accessibilityLabel="Hızlı Eşleş"
          >
            <View style={styles.hizliIkon}>
              <Ionicons name="flash" size={24} color={COLORS.accentDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hizliBaslik}>Hızlı Eşleş</Text>
              <Text style={styles.hizliAlt} numberOfLines={2}>Mod fark etmez — bekleyen ilk rakiple hemen başla</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.accentDark} />
          </SoundPressable>
          {hata && !pencere ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
              <Text style={styles.errorText}>{hata}</Text>
            </View>
          ) : null}
        </View>
        <EslesmeProfiliPenceresi
          visible={leagueModalOpen}
          profil={eslesme.profil}
          online
          onUygula={(p) => { eslesme.setMacProfili(p); setLeagueModalOpen(false); }}
          onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setLeagueModalOpen(false); }}
          onClose={() => setLeagueModalOpen(false)}
        />

        {GRUPLAR.map((g) => (
          <ModBolumu key={g.id} baslik={g.baslik} ikon={g.ikon}>
            {GAME_MODES.filter((m) => m.grup === g.id && !m.gizli).map((m) => (
              <ModKarti key={m.id} mod={m} rozet={m.rozet} onPress={() => { setHata(""); setGameMode(m.id); setPencere({ tip: "mod", mod: m }); }} />
            ))}
          </ModBolumu>
        ))}

        <ModBolumu baslik="Arkadaşınla" ikon="people">
          <ModKarti mod={KODLA_KATIL} onPress={() => { setHata(""); setPencere({ tip: "katil" }); }} />
          <ModKarti mod={MEYDAN} rozet="ÇEVRİMDIŞI" onPress={() => setPencere({ tip: "meydan" })} />
        </ModBolumu>
      </KlavyeScroll>

      <ModSecimPenceresi
        mod={pencereMod}
        soru={pencere?.tip === "mod" ? "Nasıl eşleşmek istiyorsun?" : pencere?.tip === "meydan" ? "Ne yapmak istiyorsun?" : null}
        secenekler={secenekler}
        altYazi={pencere?.tip === "meydan" && sonMeydan ? `Son: ${sonMeydan.rakip ? `${sonMeydan.ben.dogru}-${sonMeydan.rakip.dogru}` : `${sonMeydan.ben.dogru}/10 gönderildi`}` : null}
        onClose={() => { setPencere(null); setHata(""); }}
      >
        {pencereIcerik}
      </ModSecimPenceresi>
      <LiderlikPenceresi visible={liderlikAcik} onKapat={() => setLiderlikAcik(false)} />
      <AdSecPenceresi
        visible={!!adIstegi}
        oneri={adOnerisi}
        aciklama="Dereceli maçlarda rakibin ve liderlik tablosu seni bu adla görür. Sonra Online Puan ekranından değiştirebilirsin."
        onKaydet={() => { const f = adIstegi; setAdIstegi(null); f && f(); }}
        onKapat={() => setAdIstegi(null)}
      />
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
  // Bekleme ekranlarında yatay pay burada; ana ekranda bölümler (ModBolumu) kendi payını veriyor.
  scrollContent: { paddingBottom: 60 },
  ustKisim: { paddingHorizontal: SPACING.xl },
  beklemePay: { paddingHorizontal: SPACING.lg },
  title: { ...TYPE.h1, marginBottom: SPACING.md },
  pencereHata: { color: COLORS.danger, fontSize: 13, textAlign: "center" },



  ayarSatir: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  presetRow: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: SPACING.md,
  },
  presetRowText: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flex: 1 },
  hizliBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.accent, borderRadius: RADIUS.lg,
    paddingVertical: 14, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg, ...SHADOW.card,
  },
  hizliIkon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.28)" },
  hizliBaslik: { color: COLORS.accentDark, fontSize: 17, fontWeight: "900" },
  hizliAlt: { color: COLORS.accentDark, fontSize: 12, fontWeight: "700", opacity: 0.8, marginTop: 1 },



  primaryBtn: {
    flexDirection: "row", gap: SPACING.sm, backgroundColor: COLORS.accent, borderRadius: RADIUS.lg,
    paddingVertical: 14, alignItems: "center", justifyContent: "center", ...SHADOW.card,
  },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  secondaryBtn: {
    flexDirection: "row", gap: SPACING.sm, borderColor: COLORS.cardBorder, borderWidth: 1.5, borderRadius: RADIUS.lg,
    paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: SPACING.sm,
  },
  secondaryBtnText: { ...TYPE.body, fontWeight: "800", fontSize: 13 },
  input: {
    backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.md, color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: 4,
  },

  waitCard: {
    alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.xl, padding: SPACING.xl, marginTop: SPACING.lg, gap: 4, ...SHADOW.card,
  },
  modRozet: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  modRozetYazi: { ...TYPE.caption, fontSize: 12, fontWeight: "800", color: COLORS.text },
  waitTitle: { ...TYPE.h2, marginTop: SPACING.md, textAlign: "center" },
  sayac: { fontSize: 28, fontWeight: "900", color: COLORS.accent, marginTop: 4 },
  label: { ...TYPE.caption, textTransform: "uppercase", letterSpacing: 1, marginTop: SPACING.md },
  codeText: { color: COLORS.accent, fontSize: 44, fontWeight: "900", letterSpacing: 8, marginTop: SPACING.sm },
  waitingText: { ...TYPE.caption, marginTop: SPACING.sm },
  oneriKart: {
    alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.cta,
  },
  oneriBaslik: { ...TYPE.h3, color: COLORS.cta },
  oneriYazi: { ...TYPE.caption, textAlign: "center" },
  oneriKod: { fontSize: 30, fontWeight: "900", letterSpacing: 6, color: COLORS.text },
  cancelPill: {
    alignSelf: "center", marginTop: SPACING.xl, borderColor: COLORS.danger, borderWidth: 1.5, borderRadius: RADIUS.pill,
    paddingVertical: 10, paddingHorizontal: SPACING.xl,
  },
  cancelPillText: { color: COLORS.danger, fontSize: 13, fontWeight: "800" },

  errorCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card, borderColor: COLORS.danger,
    borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm,
  },
  errorText: { color: COLORS.danger, fontSize: 13, flex: 1 },
});
