import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import { KlavyeScroll } from "../components/Klavye";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import {
  odaKur, odaAktifOlunca, odayiKapat, koduylaKatil, rastgeleOdaBul, kulupKimlikleri, odaNesnesi,
} from "../lib/onlineLobi";
import { gecmis as meydanGecmisi } from "../lib/meydanOkuma";
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
// ============================================================================
export const GAME_MODES = [
  { id: "classic", label: "Ortak Kulüp", desc: "İki takım, ortak oyuncuyu ilk bulan alır", icon: "shield-checkmark" },
  { id: "xox", label: "Futbolcu XOX", desc: "3×3 ızgara, sırayla kare kap", icon: "grid" },
  { id: "letter", label: "İlk Harften Bul", desc: "Harfle başlayan futbolcuyu bul", icon: "text" },
  { id: "draft", label: "Takımı Sen Seç", desc: "Takımı sen söyle, rakip ortağı bulsun", icon: "create" },
  { id: "whoami", label: "Kim Bu Futbolcu?", desc: "İpuçlarından gizli futbolcuyu bil", icon: "help-circle" },
  { id: "letter2", label: "Harfi Sen Seç", desc: "Harfleri siz belirleyin, yarış başlasın", icon: "create-outline" },
];
export const ONERI_SN = 30;          // rastgele aramada öneri kartının çıkış süresi
const YOKLAMA_MS = 6000;             // beklerken daha eski bir rastgele oda var mı?

export default function OnlineLobbyScreen({ onRoomReady, onCpu, onMeydanOkuma, modIstegi }) {
  const baslangicModu = modIstegi && modIstegi.mod;
  const eslesme = useEslesmeProfili();
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [gameMode, setGameMode] = useState(baslangicModu && GAME_MODES.some((m) => m.id === baslangicModu) ? baslangicModu : "classic");
  const [isRanked, setIsRanked] = useState(false);
  // ekran: ana | arama (rastgele) | oda (arkadaş odası bekliyor) | katil | meydan
  const [ekran, setEkran] = useState("ana");
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

  // Tüm Modlar → "XOX Online" gibi girişler modu önceden seçili getirir.
  // (modIstegi her girişte yeni bir nesne: aynı mod ikinci kez istense de uygulanır.)
  useEffect(() => {
    if (baslangicModu && GAME_MODES.some((m) => m.id === baslangicModu)) setGameMode(baslangicModu);
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
    birakRef.current?.();
    birakRef.current = null;
    odaRef.current = null;
    setOda(null);
    setEkran("ana");
    setCalisiyor(false);
    onRoomReady(room);
  }

  function hataGoster(e) {
    setHata(e?.message || String(e || "Bir şeyler ters gitti"));
    setCalisiyor(false);
  }

  async function odaKurVeBekle(rastgele) {
    const allowedClubIds = gameMode === "xox" ? null : await kulupKimlikleri(eslesme.derlenmis.onlineKapsam());
    const satir = await odaKur({ gameMode, isRanked, allowedClubIds, rastgele });
    if (!canliRef.current) { odayiKapat(satir.id); return null; }
    odaRef.current = satir;
    setOda(satir);
    birakRef.current = odaAktifOlunca(satir.id, (yeni) => hazir(odaNesnesi({ ...satir, ...yeni }, 1)));
    return satir;
  }

  // --- 1) Rastgele rakip ------------------------------------------------------
  async function rastgeleAra() {
    setHata("");
    setCalisiyor(true);
    setEkran("arama");
    setGecen(0);
    try {
      const bulunan = await rastgeleOdaBul({ gameMode, isRanked });
      if (bulunan) { hazir(bulunan); return; }
      await odaKurVeBekle(true);
      setCalisiyor(false);
    } catch (e) {
      setEkran("ana");
      hataGoster(e);
    }
  }

  // Arama sürerken: sayaç + daha önce kurulmuş bir rastgele oda çıktı mı?
  useEffect(() => {
    if (ekran !== "arama" || !oda) return;
    const t = setInterval(() => setGecen((g) => g + 1), 1000);
    const y = setInterval(async () => {
      try {
        const eski = await rastgeleOdaBul({ gameMode, isRanked, oncesi: oda.created_at });
        if (!eski || !canliRef.current) return;
        birakRef.current?.();
        await odayiKapat(oda.id);
        hazir(eski);
      } catch (e) {}
    }, YOKLAMA_MS);
    return () => { clearInterval(t); clearInterval(y); };
  }, [ekran, oda, gameMode, isRanked]);

  // --- 2) Arkadaşınla ---------------------------------------------------------
  async function arkadasOdasiKur() {
    setHata("");
    setCalisiyor(true);
    setEkran("oda");
    try { await odaKurVeBekle(false); setCalisiyor(false); } catch (e) { setEkran("ana"); hataGoster(e); }
  }

  async function koduylaGir() {
    if (!joinCode.trim()) return;
    setHata("");
    setCalisiyor(true);
    try { hazir(await koduylaKatil(joinCode)); } catch (e) { hataGoster(e); }
  }

  function bekleyiIptal() {
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
    Share.share({ message: `⚽ 3-2-1: Bitir İşi — benimle online ${mod ? mod.label : ""} oyna!\nUygulamada Online → Arkadaşınla → Kodla Katıl: ${oda.code}` }).catch(() => {});
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
        <KlavyeScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TabHeader compact />
          <View style={styles.waitCard}>
            <View style={styles.modRozet}>
              <Ionicons name={seciliMod.icon} size={14} color={COLORS.accent} />
              <Text style={styles.modRozetYazi}>{seciliMod.label} · {isRanked ? "Ranked" : "Casual"}</Text>
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
  return (
    <GameBackground style={styles.container} klavye="pay">
      <KlavyeScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TabHeader compact />
        <Text style={styles.title}>Online 1v1</Text>

        <SectionLabel icon="game-controller" text="Oyun Modu" />
        <View style={styles.modIzgara}>
          {GAME_MODES.map((gm) => {
            const active = gameMode === gm.id;
            return (
              <SoundPressable
                key={gm.id}
                onPress={() => setGameMode(gm.id)}
                style={[styles.modeCard, active && styles.modeCardActive]}
                accessibilityLabel={gm.label}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.modeIconWrap, active && styles.modeIconWrapActive]}>
                  <Ionicons name={gm.icon} size={18} color={active ? COLORS.accentDark : COLORS.accent} />
                </View>
                <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]} numberOfLines={1}>{gm.label}</Text>
                <Text style={styles.modeCardDesc} numberOfLines={2}>{gm.desc}</Text>
              </SoundPressable>
            );
          })}
        </View>

        <View style={styles.ayarSatir}>
          <SoundPressable onPress={() => setLeagueModalOpen(true)} style={styles.presetRow}>
            <Ionicons name="filter" size={16} color={COLORS.accent} />
            <Text style={styles.presetRowText} numberOfLines={1}>{eslesme.derlenmis.etiket}</Text>
          </SoundPressable>
          <SoundPressable onPress={() => setIsRanked((r) => !r)} style={[styles.turCip, isRanked && styles.turCipRanked]} accessibilityLabel={isRanked ? "Ranked" : "Casual"}>
            <Ionicons name={isRanked ? "trophy" : "happy-outline"} size={16} color={isRanked ? COLORS.text : COLORS.accent} />
            <Text style={[styles.turCipYazi, isRanked && { color: COLORS.text }]}>{isRanked ? "Ranked" : "Casual"}</Text>
          </SoundPressable>
        </View>
        <EslesmeProfiliPenceresi
          visible={leagueModalOpen}
          profil={eslesme.profil}
          online
          onUygula={(p) => { eslesme.setMacProfili(p); setLeagueModalOpen(false); }}
          onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setLeagueModalOpen(false); }}
          onClose={() => setLeagueModalOpen(false)}
        />

        {/* 1) Rastgele rakip */}
        <SoundPressable style={styles.anaKart} onPress={rastgeleAra} disabled={calisiyor} accessibilityLabel="Rastgele Rakip Bul">
          <View style={styles.anaKartIkon}><Ionicons name="flash" size={26} color={COLORS.accentDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.anaKartBaslik}>Rastgele Rakip Bul</Text>
            <Text style={styles.anaKartAlt}>{seciliMod.label} · hemen eşleş</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.accentDark} />
        </SoundPressable>

        {/* 2) Arkadaşınla */}
        <View style={styles.kart}>
          <View style={styles.kartBaslikSatir}>
            <Ionicons name="people" size={18} color={COLORS.accent} />
            <Text style={styles.kartBaslik}>Arkadaşınla</Text>
          </View>
          {ekran === "katil" ? (
            <>
              <TextInput
                value={joinCode}
                onChangeText={(t) => { setJoinCode(t); setHata(""); }}
                placeholder="ODA KODU"
                placeholderTextColor={COLORS.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                onSubmitEditing={koduylaGir}
              />
              <View style={styles.ikiliSatir}>
                <SoundPressable style={[styles.secondaryBtn, styles.yarim]} onPress={() => { setEkran("ana"); setHata(""); }}>
                  <Text style={styles.secondaryBtnText}>Vazgeç</Text>
                </SoundPressable>
                <SoundPressable style={[styles.primaryBtn, styles.yarim]} onPress={koduylaGir} disabled={calisiyor}>
                  <Ionicons name="enter" size={18} color={COLORS.accentDark} />
                  <Text style={styles.primaryBtnText}>{calisiyor ? "Katılıyor..." : "Katıl"}</Text>
                </SoundPressable>
              </View>
            </>
          ) : (
            <View style={styles.ikiliSatir}>
              <SoundPressable style={[styles.primaryBtn, styles.yarim]} onPress={arkadasOdasiKur} disabled={calisiyor}>
                <Ionicons name="add-circle" size={18} color={COLORS.accentDark} />
                <Text style={styles.primaryBtnText}>Oda Kur</Text>
              </SoundPressable>
              <SoundPressable style={[styles.secondaryBtn, styles.yarim]} onPress={() => { setEkran("katil"); setHata(""); }}>
                <Ionicons name="key" size={16} color={COLORS.text} />
                <Text style={styles.secondaryBtnText}>Kodla Katıl</Text>
              </SoundPressable>
            </View>
          )}
        </View>

        {/* 3) Meydan okuma (asenkron) */}
        <View style={styles.kart}>
          <View style={styles.kartBaslikSatir}>
            <Ionicons name="paper-plane" size={18} color={COLORS.cta} />
            <Text style={styles.kartBaslik}>Meydan Okuma</Text>
            <View style={styles.yeniRozet}><Text style={styles.yeniRozetYazi}>ÇEVRİMDIŞI DA OLUR</Text></View>
          </View>
          <Text style={styles.kartAciklama}>10 ortak futbolcu sorusunu çöz, kodunu gönder. Arkadaşın müsait olunca aynı soruları çözsün.</Text>
          {ekran === "meydan" ? (
            <>
              <TextInput
                value={meydanKod}
                onChangeText={(t) => { setMeydanKod(t); setHata(""); }}
                placeholder="MEYDAN OKUMA KODU"
                placeholderTextColor={COLORS.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                onSubmitEditing={() => meydanKod.trim() && onMeydanOkuma && onMeydanOkuma(meydanKod.trim())}
              />
              <View style={styles.ikiliSatir}>
                <SoundPressable style={[styles.secondaryBtn, styles.yarim]} onPress={() => setEkran("ana")}>
                  <Text style={styles.secondaryBtnText}>Vazgeç</Text>
                </SoundPressable>
                <SoundPressable style={[styles.ctaBtn, styles.yarim]} onPress={() => meydanKod.trim() && onMeydanOkuma && onMeydanOkuma(meydanKod.trim())}>
                  <Text style={styles.ctaBtnText}>Kabul Et</Text>
                </SoundPressable>
              </View>
            </>
          ) : (
            <View style={styles.ikiliSatir}>
              <SoundPressable style={[styles.ctaBtn, styles.yarim]} onPress={() => onMeydanOkuma && onMeydanOkuma()}>
                <Ionicons name="paper-plane" size={16} color={COLORS.ctaDark} />
                <Text style={styles.ctaBtnText}>Meydan Oku</Text>
              </SoundPressable>
              <SoundPressable style={[styles.secondaryBtn, styles.yarim]} onPress={() => setEkran("meydan")}>
                <Ionicons name="mail-open" size={16} color={COLORS.text} />
                <Text style={styles.secondaryBtnText}>Kodu Gir</Text>
              </SoundPressable>
            </View>
          )}
          {sonMeydan ? (
            <Text style={styles.sonMeydan}>
              Son: {sonMeydan.rakip ? `${sonMeydan.ben.dogru}-${sonMeydan.rakip.dogru}` : `${sonMeydan.ben.dogru}/10 gönderildi`}
            </Text>
          ) : null}
        </View>

        {hata ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
            <Text style={styles.errorText}>{hata}</Text>
          </View>
        ) : null}
      </KlavyeScroll>
    </GameBackground>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={14} color={COLORS.accent} />
      <Text style={styles.sectionLabel}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: 60 },
  title: { ...TYPE.h1, textAlign: "center", marginBottom: SPACING.lg },

  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  sectionLabel: { ...TYPE.caption, textTransform: "uppercase", letterSpacing: 1, fontWeight: "800" },

  modIzgara: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  modeCard: {
    width: "48.5%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1.5,
    borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4,
  },
  modeCardActive: { borderColor: COLORS.accent, backgroundColor: "#1F5E3B" },
  modeIconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(140,255,107,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  modeIconWrapActive: { backgroundColor: COLORS.accent },
  modeCardTitle: { ...TYPE.h3, fontSize: 14 },
  modeCardTitleActive: { color: COLORS.accent },
  modeCardDesc: { ...TYPE.caption, fontSize: 12 },

  ayarSatir: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  presetRow: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: SPACING.md,
  },
  presetRowText: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flex: 1 },
  turCip: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.accent,
  },
  turCipRanked: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  turCipYazi: { ...TYPE.caption, fontWeight: "900", color: COLORS.accent },

  anaKart: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.card,
  },
  anaKartIkon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" },
  anaKartBaslik: { fontSize: 19, fontWeight: "900", color: COLORS.accentDark },
  anaKartAlt: { fontSize: 13, fontWeight: "700", color: COLORS.accentDark, opacity: 0.8, marginTop: 2 },

  kart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.card,
  },
  kartBaslikSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  kartBaslik: { ...TYPE.h3, fontSize: 16, flex: 1 },
  kartAciklama: { ...TYPE.caption, marginBottom: SPACING.sm },
  yeniRozet: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.ctaDark, borderWidth: 1, borderColor: COLORS.cta },
  yeniRozetYazi: { color: COLORS.cta, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  sonMeydan: { ...TYPE.caption, fontSize: 12, marginTop: SPACING.sm, textAlign: "center" },
  ikiliSatir: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  yarim: { flex: 1, marginTop: 0 },

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
  ctaBtn: {
    flexDirection: "row", gap: SPACING.sm, backgroundColor: COLORS.cta, borderRadius: RADIUS.lg,
    paddingVertical: 14, alignItems: "center", justifyContent: "center", ...SHADOW.card,
  },
  ctaBtnText: { color: COLORS.ctaDark, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
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
