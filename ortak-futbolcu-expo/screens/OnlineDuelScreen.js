import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { supabase } from "../lib/supabaseClient";

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
      const { data: clubs } = await supabase.from("clubs").select("id, name");
      if (mounted && clubs) {
        const map = {};
        clubs.forEach((c) => (map[c.id] = c.name));
        setClubsMap(map);
      }
      const { data: r } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      if (mounted) setRoomRow(r);
      const { data: rd } = await supabase
        .from("rounds")
        .select("*")
        .eq("room_id", room.id)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();
      if (mounted) setRoundRow(rd);
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

  return (
    <View style={styles.container}>
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
          <Text style={styles.teamName}>{teamA}</Text>
        </View>
        <Text style={styles.plus}>+</Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.teamLabel}>Takım B</Text>
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
                placeholderTextColor="#4A5D52"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1613", padding: 20 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 16 },
  scoreBox: { alignItems: "center", flex: 1 },
  scoreLabel: { color: "#7C9186", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  scoreValue: { color: "#F4F7F1", fontSize: 32, fontWeight: "900" },
  vs: { color: "#4A5D52", fontWeight: "900" },
  teamsCard: { flexDirection: "row", backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center" },
  teamLabel: { color: "#7C9186", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  teamName: { color: "#F4F7F1", fontSize: 16, fontWeight: "900", marginTop: 4, textAlign: "center" },
  plus: { color: "#C6FF3D", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#7C9186", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzBtn: { marginTop: 16, borderColor: "#C6FF3D", borderWidth: 2, borderRadius: 20, paddingVertical: 40, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#26392F" },
  buzzBtnText: { color: "#C6FF3D", fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  buzzBtnTextDisabled: { color: "#4A5D52" },
  passBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  passBtnText: { color: "#7C9186", fontSize: 12, fontWeight: "700" },
  answeringText: { color: "#C6FF3D", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F4F7F1", fontSize: 16, marginBottom: 12 },
  primaryBtn: { backgroundColor: "#C6FF3D", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#0B1613", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: "#F4F7F1", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: "#7C9186", fontSize: 12, textAlign: "center", marginBottom: 12 },
  waitingText: { color: "#7C9186", fontSize: 12, marginTop: 8 },
  backLink: { color: "#7C9186", textAlign: "center", fontSize: 12 },
});
