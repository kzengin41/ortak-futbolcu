import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase, getDeviceId } from "../lib/supabaseClient";
import GameBackground from "../components/GameBackground";
import { KlavyeScroll } from "../components/Klavye";
import TabHeader from "../components/TabHeader";
import SoundPressable from "../components/SoundPressable";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import { useEslesmeProfili } from "../lib/useEslesmeProfili";
import { CLUB_INFO } from "../lib/clubs";
import { useAppSettings } from "../lib/SettingsContext";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Oyun modu kartları — 31 Ağustos 2026 (Faz 4) yeniden tasarımından önce
// düz metin satırlarıydı, şimdi Oyna sekmesindeki mod kartlarıyla aynı dilde
// (ikon + başlık + açıklama) gösteriliyor.
// 12 Eylül 2026 — YAYIN ENGELİ TEMİZLİĞİ. Bu listede çalışmayan üç giriş vardı:
//   "whoami" ve "draft"  -> OnlineWhoAmIScreen / OnlineDraftScreen sadece
//                           "Çok Yakında" yazan boş taslak. Oyuncu oda kurup
//                           rakip bekliyor, eşleşiyor ve boş ekrana düşüyordu.
//   "letter2"            -> App.js'teki rota eşlemesinde hiç karşılığı yoktu,
//                           seçen oyuncu TAMAMEN FARKLI bir oyuna (Düello)
//                           düşüyordu.
// Mağaza incelemecisinin buna denk gelmesi App Store'da Guideline 2.1
// (eksik işlevsellik) reddi demek. Üçü de geçici olarak `yakinda: true` ile
// kilitlenmişti.
//
// 12 Eylül 2026 (aynı gün, ikinci tur) — ÜÇÜ DE TAMAMLANDI, kilit kalktı:
//   whoami  -> screens/OnlineWhoAmIScreen.js + lib/onlineWhoAmI.js
//   draft   -> screens/OnlineDraftScreen.js  + lib/onlineDraft.js
//   letter2 -> screens/OnlineLetterScreen.js + lib/onlineLetter.js ("letter"
//              ile aynı ekran, harfleri oyuncular seçiyor)
// Üçünün de oyun kuralları saf modüllerde ve Node testleriyle doğrulandı;
// ağ katmanı ortak (lib/onlineRoom.js).
const GAME_MODES = [
  { id: "classic", label: "Ortak Kulüp", desc: "Rastgele iki takım, ortak oyuncuyu bul", icon: "shield-checkmark" },
  { id: "letter", label: "İlk Harften Bul", desc: "Rastgele harfle başlayan futbolcuyu bul", icon: "text" },
  { id: "draft", label: "Ortak Kulüp (Sen Seç)", desc: "Takımı sen söyle, rakip diğerini bulsun", icon: "create" },
  { id: "whoami", label: "Kim Bu Futbolcu?", desc: "İpuçlarıyla gizli futbolcuyu tahmin et", icon: "help-circle" },
  { id: "letter2", label: "İlk Harften Bul (Sen Seç)", desc: "Harfi sen belirle, yarış başlasın", icon: "create-outline" },
];

// 31 Ağustos 2026: "Online" artık kendi sekmesi (bottom tab) — üst ekrana
// "çıkış" kavramı yok, bu yüzden BackButton kaldırıldı. Oda kurup rakip
// beklerken "İptal Et" ise App.js'e çıkmak yerine artık ekranı kendi içinde
// başa (mod seçim ekranına) sıfırlıyor.
//
// FAZ 4 (31 Ağustos 2026): Kerem "Online sekmesinin içerik tasarımı çok
// çirkin, mükemmel ötesi bir UI tasarla" dedi. Bu turda TÜM state/network
// mantığı (handleCreate/handleJoin/handleAutoMatch/vb.) AYNEN korunarak
// sadece görünüm katmanı Oyna/Profilim sekmeleriyle aynı görsel dile
// (GameBackground, lib/theme tokenleri, ikonlu kartlar, gölgeli butonlar)
// taşındı — hiçbir fonksiyon/prop imzası değişmedi.
export default function OnlineLobbyScreen({ onRoomReady }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  // 28 Eylül 2026 — Eşleşme Profili. Online'da sunucu sadece izinli kulüp
  // listesini uyguluyor (ağırlıklar tek kişilik modlarda geçerli).
  const eslesme = useEslesmeProfili();
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [gameMode, setGameMode] = useState("classic");
  const [isRanked, setIsRanked] = useState(false); // classic | whoami | draft
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | working | waiting | error
  const [errorMsg, setErrorMsg] = useState("");
  const deviceIdRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    getDeviceId().then((id) => (deviceIdRef.current = id));
    return () => channelRef.current?.unsubscribe();
  }, []);


  async function handleAutoMatch() {
    setMode("join");
    setStatus("working");
    setErrorMsg("");
    const id = deviceIdRef.current || (await getDeviceId());

    const { data: rooms, error: errFind } = await supabase
      .from("rooms")
      .select("*")
      .eq("status", "waiting")
      .eq("game_mode", gameMode)
      .eq("is_ranked", isRanked)
      .neq("player1_id", id)
      .limit(1);

    if (rooms && rooms.length > 0) {
      const r = rooms[0];
      const { data, error } = await supabase
        .from("rooms")
        // 12 Eylül 2026: burası "playing" yazıyordu ama oda kurucunun realtime
        // dinleyicisi (aşağıda) "active" bekliyor — otomatik eşleşmede katılan
        // oyuncu oyuna giriyor, KURUCU sonsuza kadar "Rakip bekleniyor..."
        // ekranında kalıyordu. handleJoin zaten "active" yazıyor.
        .update({ player2_id: id, status: "active" })
        .eq("id", r.id)
        .select()
        .single();

      if (!error && data) {
        setStatus("idle");
        // Eşleşme sağlandı! Oda hazır.
        onRoomReady({ id: data.id, code: data.code, playerNumber: 2, allowedClubs: data.allowed_club_ids, gameMode: data.game_mode });
        return;
      }
    }
    // Eşleşme bulunamadıysa kendisi kursun
    handleCreate();
  }

  async function handleCreate() {
    setMode("create");
    setStatus("working");
    const id = deviceIdRef.current || (await getDeviceId());
    const roomCode = randomCode();

    // 27 Eylül 2026 — ESKİDEN bütün "clubs" tablosu çekilip telefonda
    // süzülüyordu. Supabase bir istekte en fazla 1000 satır döndürdüğü için
    // (26 bin kulüp var) seçilen ligin kulüplerinin çoğu listede hiç
    // yoktu. Artık izinli kulüp ADLARI telefonda hesaplanıyor (tek modlarla
    // aynı kaynak: CLUB_INFO + lig ön ayarı) ve sunucudan sadece onların
    // kimlikleri isteniyor.
    let allowedClubIds = null;
    const izinliKume = eslesme.derlenmis.onlineKapsam();
    const izinliAdlar = izinliKume ? [...izinliKume] : null;
    if (izinliAdlar) {
      allowedClubIds = [];
      for (let i = 0; i < izinliAdlar.length; i += 150) {
        const { data: satirlar, error: kulupHatasi } = await supabase
          .from("clubs")
          .select("id")
          .in("name", izinliAdlar.slice(i, i + 150));
        if (kulupHatasi) { setErrorMsg(kulupHatasi.message); setStatus("error"); return; }
        for (const s of satirlar || []) allowedClubIds.push(s.id);
      }
      if (allowedClubIds.length < 2) allowedClubIds = null; // güvenlik ağı: filtre boş kaldıysa hepsi
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert({ code: roomCode, player1_id: id, status: "waiting", allowed_club_ids: allowedClubIds, game_mode: gameMode, is_ranked: isRanked })
      .select()
      .single();
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setCode(roomCode);
    setStatus("waiting");

    channelRef.current = supabase
      .channel(`room-${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${data.id}` },
        (payload) => {
          if (payload.new.status === "active") {
            onRoomReady({ id: data.id, code: roomCode, playerNumber: 1, gameMode: data.game_mode });
          }
        }
      )
      .subscribe();
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setStatus("working");
    const id = deviceIdRef.current || (await getDeviceId());

    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", joinCode.trim().toUpperCase())
      .eq("status", "waiting")
      .single();

    if (error || !room) {
      setErrorMsg("Bu kodla bekleyen bir oda bulunamadı.");
      setStatus("error");
      return;
    }

    // .eq('status', 'waiting') koşulu: iki kişi aynı anda katılmaya çalışırsa
    // sadece ilki başarılı olur, diğeri boş sonuç alır.
    const { data: updated, error: updateError } = await supabase
      .from("rooms")
      .update({ player2_id: id, status: "active" })
      .eq("id", room.id)
      .eq("status", "waiting")
      .select()
      .single();

    if (updateError || !updated) {
      setErrorMsg("Bu oda az önce doldu, başka bir kod dene.");
      setStatus("error");
      return;
    }

    // 27 Eylül 2026: ilk turu artık bu taraf ÜRETMİYOR — OnlineDuelScreen'de
    // odayı kuran (1 numara) üretiyor. Eskiden sadece kodla katılınca üretiliyordu,
    // "otomatik eşleş" ile girilince hiç tur üretilmiyor ve maç "Yükleniyor"da
    // kalıyordu; ayrıca diğer modlarda (Kim Bu, Draft, Harf) gereksizdi.
    onRoomReady({ id: room.id, code: room.code, playerNumber: 2, allowedClubs: room.allowed_club_ids, gameMode: room.game_mode });
  }

  function cancelWaiting() {
    channelRef.current?.unsubscribe();
    setMode(null);
    setStatus("idle");
    setCode("");
  }

  const presetLabel = eslesme.derlenmis.etiket;

  return (
    <GameBackground style={styles.container} klavye="pay">
      <KlavyeScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TabHeader compact />
        <Text style={styles.title}>Online 1v1</Text>

        {!mode && (
          <>
            <SectionLabel icon="game-controller" text="Oyun Modu" />
            <View style={{ gap: SPACING.sm, marginBottom: SPACING.xl }}>
              {GAME_MODES.map((gm) => {
                const active = gameMode === gm.id;
                // Henüz tamamlanmamış modlar görünür ama seçilemez.
                const yakinda = Boolean(gm.yakinda);
                return (
                  <SoundPressable
                    key={gm.id}
                    disabled={yakinda}
                    onPress={() => { if (!yakinda) setGameMode(gm.id); }}
                    style={[styles.modeCard, active && styles.modeCardActive, yakinda && styles.modeCardSoon]}
                  >
                    <View style={[styles.modeIconWrap, active && styles.modeIconWrapActive]}>
                      <Ionicons
                        name={gm.icon}
                        size={20}
                        color={active ? COLORS.accentDark : yakinda ? COLORS.textFaint : COLORS.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive, yakinda && { color: COLORS.textMuted }]}>
                        {gm.label}
                      </Text>
                      <Text style={styles.modeCardDesc}>{gm.desc}</Text>
                    </View>
                    {yakinda ? (
                      <View style={styles.yakindaRozet}>
                        <Text style={styles.yakindaRozetText}>YAKINDA</Text>
                      </View>
                    ) : active ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                    ) : null}
                  </SoundPressable>
                );
              })}
            </View>

            <SectionLabel icon="earth" text="Eşleşme Profili" hint="oda kurarken geçerli" />
            <SoundPressable onPress={() => setLeagueModalOpen(true)} style={styles.presetRow}>
              <Ionicons name="filter" size={18} color={COLORS.accent} />
              <Text style={styles.presetRowText}>{presetLabel}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.presetChangeText}>Değiştir</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
            </SoundPressable>
            <EslesmeProfiliPenceresi
              visible={leagueModalOpen}
              profil={eslesme.profil}
              online
              onUygula={(p) => { eslesme.setMacProfili(p); setLeagueModalOpen(false); }}
              onVarsayilanYap={(p) => { eslesme.genelKaydet(p); setLeagueModalOpen(false); }}
              onClose={() => setLeagueModalOpen(false)}
            />

            <SectionLabel icon="trophy" text="Maç Türü" />
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.xl }}>
              <SoundPressable
                onPress={() => setIsRanked(false)}
                style={[styles.pillToggle, !isRanked && styles.pillToggleActiveGreen]}
              >
                <Ionicons name="happy-outline" size={18} color={!isRanked ? COLORS.accentDark : COLORS.textMuted} />
                <Text style={[styles.pillToggleText, !isRanked && styles.pillToggleTextActiveGreen]}>Casual</Text>
              </SoundPressable>
              <SoundPressable
                onPress={() => setIsRanked(true)}
                style={[styles.pillToggle, isRanked && styles.pillToggleActiveRed]}
              >
                <Ionicons name="trophy" size={18} color={isRanked ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.pillToggleText, isRanked && styles.pillToggleTextActiveRed]}>Ranked</Text>
              </SoundPressable>
            </View>

            <SoundPressable style={styles.primaryBtn} onPress={handleCreate}>
              <Ionicons name="add-circle" size={20} color={COLORS.accentDark} />
              <Text style={styles.primaryBtnText}>Oda Kur</Text>
            </SoundPressable>
            <SoundPressable style={styles.secondaryBtn} onPress={() => setMode("join")}>
              <Ionicons name="key" size={18} color={COLORS.text} />
              <Text style={styles.secondaryBtnText}>Kodla Katıl</Text>
            </SoundPressable>
          </>
        )}

        {mode === "create" && status === "waiting" && (
          <View style={styles.waitCard}>
            <Ionicons name="hourglass-outline" size={28} color={COLORS.accent} />
            <Text style={styles.label}>Bu kodu arkadaşına gönder</Text>
            <Text style={styles.codeText}>{code}</Text>
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.lg }} />
            <Text style={styles.waitingText}>Rakip bekleniyor...</Text>
            <SoundPressable onPress={cancelWaiting} style={styles.cancelPill}>
              <Text style={styles.cancelPillText}>İptal Et</Text>
            </SoundPressable>
          </View>
        )}

        {mode === "join" && (
          <View style={styles.joinCard}>
            <Ionicons name="key" size={28} color={COLORS.accent} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="ODA KODU"
              placeholderTextColor={COLORS.textFaint}
              autoCapitalize="characters"
              style={styles.input}
            />
            <SoundPressable style={[styles.primaryBtn, { marginTop: SPACING.lg }]} onPress={handleJoin} disabled={status === "working"}>
              <Ionicons name="enter" size={20} color={COLORS.accentDark} />
              <Text style={styles.primaryBtnText}>{status === "working" ? "Katılıyor..." : "Katıl"}</Text>
            </SoundPressable>
          </View>
        )}

        {status === "error" && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={22} color={COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <SoundPressable onPress={() => { setStatus(null); setErrorMsg(""); }} style={{ marginTop: SPACING.md }}>
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </SoundPressable>
          </View>
        )}
      </KlavyeScroll>
    </GameBackground>
  );
}

function SectionLabel({ icon, text, hint }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={14} color={COLORS.accent} />
      <Text style={styles.sectionLabel}>{text}</Text>
      {hint ? <Text style={styles.sectionLabelHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 60 },
  title: { ...TYPE.h1, textAlign: "center", marginBottom: SPACING.xl },

  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm, marginTop: 2 },
  sectionLabel: { ...TYPE.caption, textTransform: "uppercase", letterSpacing: 1, fontWeight: "800" },
  sectionLabelHint: { ...TYPE.caption, fontSize: 12, color: COLORS.textMuted },

  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  modeCardSoon: { opacity: 0.45 },
  yakindaRozet: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  yakindaRozetText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  modeCardActive: { borderColor: COLORS.accent, backgroundColor: "#1F5E3B" },
  modeIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(140,255,107,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  modeIconWrapActive: { backgroundColor: COLORS.accent },
  modeCardTitle: { ...TYPE.h3, fontSize: 14 },
  modeCardTitleActive: { color: COLORS.accent },
  modeCardDesc: { ...TYPE.caption, fontSize: 12, marginTop: 2 },

  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOW.card,
  },
  presetRowText: { ...TYPE.body, fontWeight: "700" },
  presetChangeText: { color: COLORS.accent, fontWeight: "800", fontSize: 12 },

  pillToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderColor: COLORS.cardBorder,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  pillToggleActiveGreen: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  pillToggleActiveRed: { borderColor: COLORS.danger, backgroundColor: COLORS.danger },
  pillToggleText: { ...TYPE.body, fontWeight: "800", color: COLORS.textMuted, fontSize: 13 },
  pillToggleTextActiveGreen: { color: COLORS.accentDark },
  pillToggleTextActiveRed: { color: COLORS.text },

  primaryBtn: {
    flexDirection: "row",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", textTransform: "uppercase", fontSize: 14 },
  secondaryBtn: {
    flexDirection: "row",
    gap: SPACING.sm,
    borderColor: COLORS.cardBorder,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  secondaryBtnText: { ...TYPE.body, fontWeight: "800", fontSize: 14 },

  waitCard: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    gap: 4,
    ...SHADOW.card,
  },
  label: { ...TYPE.caption, textTransform: "uppercase", letterSpacing: 1, marginTop: SPACING.sm },
  codeText: { color: COLORS.accent, fontSize: 44, fontWeight: "900", letterSpacing: 8, marginTop: SPACING.sm },
  waitingText: { ...TYPE.caption, marginTop: SPACING.sm },
  cancelPill: {
    marginTop: SPACING.xl,
    borderColor: COLORS.danger,
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: SPACING.xl,
  },
  cancelPillText: { color: COLORS.danger, fontSize: 13, fontWeight: "800" },

  joinCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOW.card,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
  },

  errorCard: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    gap: 4,
  },
  errorText: { color: COLORS.danger, textAlign: "center", fontSize: 13, marginTop: 4 },
  retryText: { color: COLORS.accent, fontSize: 14, fontWeight: "800" },
});
