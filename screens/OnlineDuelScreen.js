import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import { supabase } from "../lib/supabaseClient";
import TeamBadge from "../components/TeamBadge";

// Bu ekran hiçbir doğru-cevap kontrolü YAPMAZ. Sadece sunucudaki rounds
// satırını dinler ve o satıra göre ekranı çizer — "gerçek" (source of truth)
// her zaman Postgres'tedir, iki telefon da aynı satırı görür.
export default function OnlineDuelScreen({ room, onExit }) {
  const [roundRow, setRoundRow] = useState(null);
  const [roomRow, setRoomRow] = useState(null);
  const [clubsMap, setClubsMap] = useState({});
  const [answerInput, setAnswerInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef(null);
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
      // realtime ile gelen turu bekler. (Eskiden sadece kodla katılan üretiyordu.)
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

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
    };
  }, [room.id]);

  // Kulüp adları: eskiden bütün "clubs" tablosu çekiliyordu ama Supabase en
  // fazla 1000 satır döndürdüğü için çoğu kulüp "..." görünüyordu. Artık
  // sadece bu turun iki kulübü soruluyor.
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

  const roundTimeLeft = roundRow
    ? Math.max(0, Math.ceil((new Date(roundRow.round_deadline).getTime() - now) / 1000))
    : 0;
  const answerTimeLeft = roundRow?.answer_deadline
    ? Math.max(0, Math.ceil((new Date(roundRow.answer_deadline).getTime() - now) / 1000))
    : 0;

  // Süre sunucu saatine göre dolduysa ilk fark eden istemci kapatır (idempotent RPC)
  useEffect(() => {
    if (phase === "racing" && roundTimeLeft === 0 && roundRow) {
      supabase.rpc("resolve_timeout", { p_round_id: roundRow.id });
    }
  }, [phase, roundTimeLeft, roundRow]);

  const iAmBuzzer = roundRow?.buzzed_by === myPlayer;
  const iAmLocked = roundRow?.locked_players?.includes(myPlayer);

  async function handleBuzz() {
    if (!roundRow) return;
    // Sunucudaki WHERE buzzed_by is null koşulu yarışı adilce çözer;
    // burada dönen sonuca bakmıyoruz, gerçek durumu realtime zaten getirecek.
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
    // MVP basitleştirmesi: çakışan iki insert olmasın diye sıradaki turu
    // sadece odayı kuran (1 numaralı) oyuncu başlatıyor.
    if (myPlayer !== 1 || !roundRow) return;
    await supabase.rpc("generate_round", {
      p_room_id: room.id,
      p_round_number: roundRow.round_number + 1,
      p_allowed_club_ids: roomRow?.allowed_club_ids ?? null,
    });
  }

  if (phase === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.waitingText}>Yükleniyor...</Text>
      </View>
    );
  }

  const teamA = clubsMap[roundRow.club_a_id] || "...";
  const teamB = clubsMap[roundRow.club_b_id] || "...";
  const myScore = myPlayer === 1 ? roomRow?.score1 : roomRow?.score2;
  const oppScore = myPlayer === 1 ? roomRow?.score2 : roomRow?.score1;

  // 4 Ekim 2026 — klavye cevap kutusunu kapatmasın (components/Klavye.js).
  return (
    <KlavyeAlani style={styles.container}>
    <KlavyeScroll contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Sen</Text>
          <Text style={styles.scoreValue}>{myScore ?? 0}</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Rakip</Text>
          <Text style={styles.scoreValue}>{oppScore ?? 0}</Text>
        </View>
      </View>

      <View style={styles.teamsCard}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.teamLabel}>Takım A</Text>
          <TeamBadge name={teamA} />
          <Text style={styles.teamName}>{teamA}</Text>
        </View>
        <Text style={styles.plus}>+</Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.teamLabel}>Takım B</Text>
          <TeamBadge name={teamB} />
          <Text style={styles.teamName}>{teamB}</Text>
        </View>
      </View>

      {phase === "racing" && (
        <>
          <Text style={styles.timerText}>{roundTimeLeft} sn</Text>
          <Pressable
            disabled={iAmLocked}
            onPress={handleBuzz}
            style={[styles.buzzBtn, iAmLocked && styles.buzzBtnDisabled]}
          >
            <Text style={[styles.buzzBtnText, iAmLocked && styles.buzzBtnTextDisabled]}>
              {iAmLocked ? "Bu turda elendin" : "BUZZ'LA"}
            </Text>
          </Pressable>
          {!iAmLocked && (
            <Pressable onPress={handlePass} style={styles.passBtn}>
              <Text style={styles.passBtnText}>Bilemedim</Text>
            </Pressable>
          )}
        </>
      )}

      {phase === "answering" && (
        <View style={{ marginTop: 24 }}>
          {iAmBuzzer ? (
            <>
              <Text style={styles.answeringText}>Sırada sen varsın — {answerTimeLeft} sn</Text>
              <TextInput
                autoFocus
                value={answerInput}
                onChangeText={setAnswerInput}
                onSubmitEditing={handleSubmit}
                placeholder="Futbolcu adı..."
                placeholderTextColor="#56697A"
                style={styles.input}
              />
              <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
                <Text style={styles.primaryBtnText}>Gönder</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.answeringText}>Rakip cevap veriyor...</Text>
          )}
        </View>
      )}

      {phase === "result" && (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Text style={styles.resultText}>
            {roundRow.winner === 0
              ? "Kimse bilemedi"
              : roundRow.winner === myPlayer
              ? "Kazandın!"
              : "Rakip bildi"}
          </Text>
          <Text style={styles.answersText}>
            Geçerli cevaplar: {(roundRow.revealed_answers || []).join(", ")}
          </Text>
          {myPlayer === 1 ? (
            <Pressable style={styles.primaryBtn} onPress={handleNextRound}>
              <Text style={styles.primaryBtnText}>Sıradaki Tur</Text>
            </Pressable>
          ) : (
            <Text style={styles.waitingText}>Ev sahibi sıradaki turu başlatıyor...</Text>
          )}
        </View>
      )}

      <Pressable onPress={onExit} style={{ marginTop: 24 }}>
        <Text style={styles.backLink}>Odadan çık</Text>
      </Pressable>
    </KlavyeScroll>
    </KlavyeAlani>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 20 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 16 },
  scoreBox: { alignItems: "center", flex: 1 },
  scoreLabel: { color: "#8CA0B3", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  scoreValue: { color: "#F3F7FA", fontSize: 32, fontWeight: "900" },
  vs: { color: "#8CA0B3", fontWeight: "900" },
  teamsCard: { flexDirection: "row", backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center" },
  teamLabel: { color: "#8CA0B3", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  teamName: { color: "#F3F7FA", fontSize: 16, fontWeight: "900", marginTop: 4, textAlign: "center" },
  plus: { color: "#7CFF5C", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#8CA0B3", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzBtn: { marginTop: 16, borderColor: "#7CFF5C", borderWidth: 2, borderRadius: 20, paddingVertical: 40, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#28394B" },
  buzzBtnText: { color: "#7CFF5C", fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  buzzBtnTextDisabled: { color: "#8CA0B3" },
  passBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  passBtnText: { color: "#8CA0B3", fontSize: 12, fontWeight: "700" },
  answeringText: { color: "#7CFF5C", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F3F7FA", fontSize: 16, marginBottom: 12 },
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: "#F3F7FA", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: "#8CA0B3", fontSize: 12, textAlign: "center", marginBottom: 12 },
  waitingText: { color: "#8CA0B3", fontSize: 12, marginTop: 8 },
  backLink: { color: "#8CA0B3", textAlign: "center", fontSize: 12 },
});
