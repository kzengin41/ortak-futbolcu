import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import TeamBadge from "../components/TeamBadge";
import TimerBar from "../components/TimerBar";
import OnlineMacSonu from "../components/OnlineMacSonu";
import { supabase } from "../lib/supabaseClient";
import { odaKur, odaNesnesi } from "../lib/onlineLobi";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";

// Bu ekran hiçbir doğru-cevap kontrolü YAPMAZ. Sadece sunucudaki rounds
// satırını dinler ve o satıra göre ekranı çizer — "gerçek" (source of truth)
// her zaman Postgres'tedir, iki telefon da aynı satırı görür.
//
// 5 Ekim 2026 (benchmark .29772 / .29750) — YENİ TASARIM: 23 sabit renk kodu
// lib/theme tokenlerine taşındı, diğer online ekranlarla aynı dil. Maç artık
// HEDEF puana kadar (eskiden sonsuz "Sıradaki Tur"du, bitmediği için rövanş da
// yoktu). Rövanş: skorlar sunucuda tutulduğu ve geri alınamadığı (rooms_koruma)
// için aynı odada değil, YENİ bir odada. İki taraf da RÖVANŞ'a dokununca odayı
// kuran (1) yeni odayı rakibiyle birlikte açar ve kodunu eski odanın kanalından
// yollar; iki telefon da yeni maça geçer.
export const HEDEF = 5;
const VURGU = MODE_COLORS.online;

export default function OnlineDuelScreen({ room, onExit, onRovansOda }) {
  const [roundRow, setRoundRow] = useState(null);
  const [roomRow, setRoomRow] = useState(null);
  const [clubsMap, setClubsMap] = useState({});
  const [answerInput, setAnswerInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const [rakipVar, setRakipVar] = useState(true);
  const [benIstedim, setBenIstedim] = useState(false);
  const [rakipIstedi, setRakipIstedi] = useState(false);
  const [rovansHata, setRovansHata] = useState(null);
  const channelRef = useRef(null);
  const rvKanalRef = useRef(null);
  const kuruluyorRef = useRef(false);
  const myPlayer = room.playerNumber; // 1 | 2

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      if (mounted) setRoomRow(r);
      const { data: turlar } = await supabase
        .from("rounds")
        .select("*")
        .eq("room_id", room.id)
        .order("round_number", { ascending: false })
        .limit(1);
      const rd = turlar && turlar[0];
      if (mounted && rd) setRoundRow(rd);
      // 27 Eylül 2026: henüz tur yoksa ilk turu odayı kuran (1) üretir; 2 numara
      // realtime ile gelen turu bekler.
      if (mounted && !rd && myPlayer === 1) {
        await supabase.rpc("generate_round", {
          p_room_id: room.id,
          p_round_number: 1,
          p_allowed_club_ids: r?.allowed_club_ids ?? null,
        });
      }
    })();

    channelRef.current = supabase
      .channel(`duel-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        (payload) => payload.new && setRoundRow(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => payload.new && setRoomRow(payload.new)
      )
      .subscribe();

    // Rövanş + rakip varlığı kanalı (broadcast/presence; sunucuya yazmaz).
    const rv = supabase.channel(`duelrv-${room.id}`, { config: { broadcast: { self: false }, presence: { key: String(myPlayer) } } });
    rvKanalRef.current = rv;
    rv
      .on("broadcast", { event: "istek" }, () => mounted && setRakipIstedi(true))
      .on("broadcast", { event: "yeniOda" }, ({ payload }) => {
        if (!mounted || myPlayer !== 2 || !payload?.oda) return;
        onRovansOda && onRovansOda(odaNesnesi(payload.oda, 2));
      })
      .on("presence", { event: "sync" }, () => {
        if (!mounted) return;
        const hepsi = rv.presenceState() || {};
        setRakipVar(Boolean(hepsi[String(myPlayer === 1 ? 2 : 1)]?.length));
      })
      .subscribe((st) => { if (st === "SUBSCRIBED") rv.track({ oyuncu: myPlayer }); });

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      try { rv.untrack(); } catch (e) {}
      rv.unsubscribe();
    };
  }, [room.id]);

  // Kulüp adları: sadece bu turun iki kulübü soruluyor (1000 satır sınırı).
  useEffect(() => {
    const ids = [roundRow?.club_a_id, roundRow?.club_b_id].filter((x) => x != null && !clubsMap[x]);
    if (!ids.length) return;
    let iptal = false;
    supabase.from("clubs").select("id, name").in("id", ids).then(({ data }) => {
      if (iptal || !data) return;
      setClubsMap((m) => {
        const yeni = { ...m };
        data.forEach((c) => (yeni[c.id] = c.name));
        return yeni;
      });
    });
    return () => { iptal = true; };
  }, [roundRow?.club_a_id, roundRow?.club_b_id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const phase = !roundRow ? "loading" : roundRow.resolved ? "result" : roundRow.buzzed_by ? "answering" : "racing";
  const myScore = (myPlayer === 1 ? roomRow?.score1 : roomRow?.score2) ?? 0;
  const oppScore = (myPlayer === 1 ? roomRow?.score2 : roomRow?.score1) ?? 0;
  const macBitti = phase === "result" && (myScore >= HEDEF || oppScore >= HEDEF);

  const roundTimeLeft = roundRow
    ? Math.max(0, Math.ceil((new Date(roundRow.round_deadline).getTime() - now) / 1000))
    : 0;
  const answerTimeLeft = roundRow?.answer_deadline
    ? Math.max(0, Math.ceil((new Date(roundRow.answer_deadline).getTime() - now) / 1000))
    : 0;
  const turSuresi = roundRow?.round_deadline && roundRow?.started_at
    ? Math.max(1, Math.round((new Date(roundRow.round_deadline) - new Date(roundRow.started_at)) / 1000))
    : 20;

  // Süre sunucu saatine göre dolduysa ilk fark eden istemci kapatır (idempotent RPC)
  useEffect(() => {
    if (phase === "racing" && roundTimeLeft === 0 && roundRow) {
      supabase.rpc("resolve_timeout", { p_round_id: roundRow.id });
    }
  }, [phase, roundTimeLeft, roundRow]);

  // Maç sonu istatistik + XP (bir kez)
  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (!macBitti || macIslendiRef.current) return;
    macIslendiRef.current = true;
    const kazandim = myScore > oppScore;
    recordRound("onlineDuel", kazandim);
    addXP(kazandim ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [macBitti, myScore, oppScore]);

  // Rövanş: iki taraf da istediyse odayı kuran yeni odayı açar.
  useEffect(() => {
    if (myPlayer !== 1 || !benIstedim || !rakipIstedi || kuruluyorRef.current || !roomRow) return;
    kuruluyorRef.current = true;
    (async () => {
      try {
        const yeni = await odaKur({
          gameMode: roomRow.game_mode || "classic",
          isRanked: !!roomRow.is_ranked,
          allowedClubIds: roomRow.allowed_club_ids ?? null,
          player2Id: roomRow.player2_id,
        });
        rvKanalRef.current?.send({ type: "broadcast", event: "yeniOda", payload: { oda: yeni } });
        onRovansOda && onRovansOda(odaNesnesi(yeni, 1));
      } catch (e) {
        kuruluyorRef.current = false;
        setRovansHata("Rövanş odası kurulamadı, tekrar dene.");
        setBenIstedim(false);
      }
    })();
  }, [myPlayer, benIstedim, rakipIstedi, roomRow, onRovansOda]);

  function rovansIste() {
    if (benIstedim) return;
    setRovansHata(null);
    setBenIstedim(true);
    rvKanalRef.current?.send({ type: "broadcast", event: "istek", payload: { kimden: myPlayer } });
  }

  const iAmBuzzer = roundRow?.buzzed_by === myPlayer;
  const iAmLocked = roundRow?.locked_players?.includes(myPlayer);

  async function handleBuzz() {
    if (!roundRow) return;
    await supabase.rpc("buzz_round", { p_round_id: roundRow.id, p_player: myPlayer });
  }
  async function handlePass() {
    if (!roundRow) return;
    await supabase.rpc("pass_round", { p_round_id: roundRow.id, p_player: myPlayer });
  }
  async function handleSubmit() {
    if (!roundRow || !answerInput.trim()) return;
    const text = answerInput;
    setAnswerInput("");
    await supabase.rpc("submit_guess", { p_round_id: roundRow.id, p_player: myPlayer, p_guess: text });
  }
  async function handleNextRound() {
    // Çakışan iki insert olmasın diye sıradaki turu sadece odayı kuran başlatır.
    if (myPlayer !== 1 || !roundRow || macBitti) return;
    await supabase.rpc("generate_round", {
      p_room_id: room.id,
      p_round_number: roundRow.round_number + 1,
      p_allowed_club_ids: roomRow?.allowed_club_ids ?? null,
    });
  }

  if (phase === "loading") {
    return (
      <GameBackground style={styles.merkez}>
        <ActivityIndicator color={VURGU.main} />
        <Text style={styles.bekleme}>Maç hazırlanıyor...</Text>
        <SoundPressable onPress={onExit} style={styles.cikisBtn}>
          <Text style={styles.cikisText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const teamA = clubsMap[roundRow.club_a_id] || "...";
  const teamB = clubsMap[roundRow.club_b_id] || "...";
  const rovansHal = !rakipVar
    ? { etiket: "RAKİP AYRILDI", pasif: true, rakipIstiyor: false }
    : benIstedim
    ? { etiket: rakipIstedi ? "ODA KURULUYOR…" : "RAKİP BEKLENİYOR…", pasif: true, rakipIstiyor: false }
    : rakipIstedi
    ? { etiket: "KABUL ET — RÖVANŞ", pasif: false, rakipIstiyor: true }
    : { etiket: "RÖVANŞ", pasif: false, rakipIstiyor: false };

  // 4 Ekim 2026 — klavye cevap kutusunu kapatmasın (components/Klavye.js).
  return (
    <GameBackground style={styles.kap}>
      <KlavyeAlani style={{ flex: 1 }}>
        <KlavyeScroll contentContainerStyle={{ flexGrow: 1, paddingBottom: SPACING.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.ustSerit}>
            <View style={styles.skorKutu}>
              <Text style={styles.skorEtiket}>SEN</Text>
              <Text style={[styles.skorDeger, { color: COLORS.accent }]}>{myScore}</Text>
            </View>
            <View style={styles.ortaKutu}>
              <Text style={styles.turEtiket}>TUR {roundRow.round_number}</Text>
              <Text style={styles.hedefEtiket}>{HEDEF} puana ilk ulaşan kazanır</Text>
              {!rakipVar ? <Text style={styles.kopuk}>rakip bağlı değil</Text> : null}
            </View>
            <View style={styles.skorKutu}>
              <Text style={styles.skorEtiket}>RAKİP</Text>
              <Text style={[styles.skorDeger, { color: COLORS.cta }]}>{oppScore}</Text>
            </View>
          </View>

          <View style={styles.takimKart}>
            <View style={styles.takim}>
              <TeamBadge name={teamA} size={56} />
              <Text style={styles.takimAd} numberOfLines={2}>{teamA}</Text>
            </View>
            <Text style={styles.arti}>+</Text>
            <View style={styles.takim}>
              <TeamBadge name={teamB} size={56} />
              <Text style={styles.takimAd} numberOfLines={2}>{teamB}</Text>
            </View>
          </View>

          {phase === "racing" && (
            <>
              <View style={{ marginTop: SPACING.lg }}>
                <TimerBar current={roundTimeLeft} total={turSuresi} />
                <Text style={[styles.sureYazi, roundTimeLeft <= 5 && { color: COLORS.danger }]}>{roundTimeLeft} sn</Text>
              </View>
              <SoundPressable
                disabled={iAmLocked}
                onPress={handleBuzz}
                style={[styles.buzzBtn, iAmLocked && styles.buzzBtnPasif]}
                accessibilityLabel="Cevap hakkını al"
              >
                <Ionicons name={iAmLocked ? "lock-closed" : "flash"} size={28} color={iAmLocked ? COLORS.textMuted : COLORS.accentDark} />
                <Text style={[styles.buzzYazi, iAmLocked && { color: COLORS.textMuted }]}>
                  {iAmLocked ? "Bu turda elendin" : "BİLİYORUM!"}
                </Text>
              </SoundPressable>
              {!iAmLocked && (
                <SoundPressable onPress={handlePass} style={styles.pasBtn}>
                  <Text style={styles.pasYazi}>Bilemedim, pas</Text>
                </SoundPressable>
              )}
            </>
          )}

          {phase === "answering" && (
            <View style={{ marginTop: SPACING.lg }}>
              {iAmBuzzer ? (
                <>
                  <Text style={styles.cevapBaslik}>Sıra sende — {answerTimeLeft} sn</Text>
                  <View style={styles.girdiSatir}>
                    <TextInput
                      autoFocus
                      value={answerInput}
                      onChangeText={setAnswerInput}
                      onSubmitEditing={handleSubmit}
                      placeholder="İki takımda da oynamış futbolcu..."
                      placeholderTextColor={COLORS.textFaint}
                      autoCorrect={false}
                      style={styles.girdi}
                    />
                    <SoundPressable style={styles.gonderBtn} onPress={handleSubmit} accessibilityLabel="Gönder">
                      <Ionicons name="send" size={18} color={COLORS.accentDark} />
                    </SoundPressable>
                  </View>
                </>
              ) : (
                <View style={styles.bilgiKart}>
                  <ActivityIndicator color={VURGU.main} />
                  <Text style={styles.bilgiYazi}>Rakip cevap veriyor...</Text>
                </View>
              )}
            </View>
          )}

          {phase === "result" && (
            <View style={styles.sonucKart}>
              <Text style={[styles.sonucBaslik, { color: roundRow.winner === myPlayer ? COLORS.accent : roundRow.winner ? COLORS.cta : COLORS.text }]}>
                {roundRow.winner === 0 ? "Kimse bilemedi" : roundRow.winner === myPlayer ? "Puan senin!" : "Rakip bildi"}
              </Text>
              <Text style={styles.ornekBaslik}>Geçerli cevaplardan bazıları</Text>
              <Text style={styles.ornekMetin}>{(roundRow.revealed_answers || []).slice(0, 8).join(" · ")}</Text>
              {!macBitti ? (
                myPlayer === 1 ? (
                  <SoundPressable style={styles.anaBtn} onPress={handleNextRound}>
                    <Text style={styles.anaBtnYazi}>SIRADAKİ TUR</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.accentDark} />
                  </SoundPressable>
                ) : (
                  <Text style={styles.bekleme}>Ev sahibi sıradaki turu başlatıyor...</Text>
                )
              ) : null}
            </View>
          )}

          {macBitti ? (
            <OnlineMacSonu
              modAdi="Online — Ortak Kulüp"
              onExit={onExit}
              skorSen={myScore}
              skorRakip={oppScore}
              skorEtiketi="puan"
              kazanan={myScore > oppScore ? "sen" : "rakip"}
              hal={rovansHal}
              onRovans={rovansIste}
              ekSatir={rovansHata ? <Text style={[styles.bekleme, { color: COLORS.danger }]}>{rovansHata}</Text> : null}
            />
          ) : (
            <SoundPressable onPress={onExit} style={styles.cikisBtn}>
              <Text style={styles.cikisText}>Odadan çık</Text>
            </SoundPressable>
          )}
        </KlavyeScroll>
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  skorKutu: {
    flex: 1, alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder,
    borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  skorEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, fontWeight: "900" },
  skorDeger: { ...TYPE.h1 },
  ortaKutu: { flex: 1.2, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 12, textAlign: "center" },
  kopuk: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },

  takimKart: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderColor: VURGU.main,
    borderWidth: 2, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.card,
  },
  takim: { flex: 1, alignItems: "center", gap: SPACING.sm },
  takimAd: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  arti: { color: VURGU.main, fontWeight: "900", fontSize: 24, marginHorizontal: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },

  buzzBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.accent, borderRadius: RADIUS.xl, paddingVertical: 34,
    alignItems: "center", justifyContent: "center", gap: 6, ...SHADOW.card,
  },
  buzzBtnPasif: { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder },
  buzzYazi: { fontSize: 22, fontWeight: "900", letterSpacing: 1.5, color: COLORS.accentDark },
  pasBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: "center" },
  pasYazi: { ...TYPE.caption, textDecorationLine: "underline" },

  cevapBaslik: { ...TYPE.h3, color: COLORS.accent, textAlign: "center", marginBottom: SPACING.sm },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: 16,
  },
  gonderBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card },
  bilgiKart: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  bilgiYazi: { ...TYPE.body, fontWeight: "800" },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  ornekBaslik: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, marginTop: SPACING.md, textTransform: "uppercase" },
  ornekMetin: { ...TYPE.caption, color: COLORS.text, textAlign: "center", marginTop: 4, lineHeight: 18 },
  anaBtn: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "center", backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, marginTop: SPACING.lg, ...SHADOW.card,
  },
  anaBtnYazi: { ...TYPE.button, color: COLORS.accentDark },
  cikisBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.lg },
  cikisText: { ...TYPE.caption, textDecorationLine: "underline" },
});
