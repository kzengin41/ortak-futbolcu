import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { LEAGUE_PRESETS, clubsForPreset } from "../lib/leaguePresets";
import { generateRound, isCorrectAnswer, ANSWER_SECONDS, ROUND_TIME_OPTIONS } from "../lib/gameEngine";

export default function LocalGameScreen({ onExit }) {
  const [started, setStarted] = useState(false);
  const [roundSeconds, setRoundSeconds] = useState(ROUND_TIME_OPTIONS[1]);
  const [preset, setPreset] = useState("all");
  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("racing"); // racing | answering | result
  const [buzzedBy, setBuzzedBy] = useState(null); // 'p1' | 'p2'
  const [lockedOut, setLockedOut] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_SECONDS);
  const [answerInput, setAnswerInput] = useState("");
  const [resultText, setResultText] = useState("");
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);

  const startNewRound = useCallback(() => {
    setUsedPairs((prev) => {
      const allowedClubs = clubsForPreset(preset, CLUB_INFO);
      const r = generateRound(PLAYERS, prev, allowedClubs);
      setRound(r);
      if (!r) return prev;
      const next = new Set(prev);
      next.add(r.key);
      return next;
    });
    setPhase("racing");
    setBuzzedBy(null);
    setLockedOut(new Set());
    setTimeLeft(roundSeconds);
    setAnswerInput("");
    setResultText("");
  }, [roundSeconds, preset]);

  useEffect(() => {
    if (started) startNewRound();
  }, [started, startNewRound]);

  useEffect(() => {
    if (phase !== "racing") return;
    if (timeLeft <= 0) {
      endRound(null, "Süre doldu, kimse bilemedi.");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== "answering") return;
    if (answerTimeLeft <= 0) {
      submitAnswer();
      return;
    }
    const t = setTimeout(() => setAnswerTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLeft]);

  function handleBuzz(who) {
    if (phase !== "racing" || lockedOut.has(who) || !round) return;
    setBuzzedBy(who);
    setPhase("answering");
    setAnswerTimeLeft(ANSWER_SECONDS);
  }

  function lockPlayer(who) {
    const nextLocked = new Set(lockedOut);
    nextLocked.add(who);
    setLockedOut(nextLocked);
    const remaining = ["p1", "p2"].filter((o) => !nextLocked.has(o));
    if (remaining.length === 0) {
      endRound(null, "İkisi de bilemedi.");
    } else if (phase !== "racing") {
      setBuzzedBy(null);
      setPhase("racing");
    }
  }

  function handlePass(who) {
    if (phase !== "racing" || lockedOut.has(who) || !round) return;
    lockPlayer(who);
  }

  function submitAnswer() {
    if (!round) return;
    const ok = isCorrectAnswer(answerInput, round.validAnswers);
    if (ok) {
      endRound(buzzedBy, `Doğru! (${answerInput.trim()})`);
    } else {
      setAnswerInput("");
      lockPlayer(buzzedBy);
    }
  }

  function endRound(winner, text) {
    setResultText(text);
    setPhase("result");
    if (winner === "p1") setScoreP1((s) => s + 1);
    if (winner === "p2") setScoreP2((s) => s + 1);
  }

  if (!started) {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingVertical: 24 }}>
        <Text style={styles.title}>Tur Süresi</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          {ROUND_TIME_OPTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setRoundSeconds(s)}
              style={[styles.diffBtn, { flex: 1 }, roundSeconds === s && styles.diffBtnActive]}
            >
              <Text style={[styles.diffBtnText, roundSeconds === s && styles.diffBtnTextActive]}>{s} sn</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.title, { fontSize: 16, marginTop: 24 }]}>Lig / Kapsam</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {LEAGUE_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPreset(p.id)}
              style={[styles.diffBtn, { minWidth: "47%" }, preset === p.id && styles.diffBtnActive]}
            >
              <Text style={[styles.diffBtnText, preset === p.id && styles.diffBtnTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => setStarted(true)}>
          <Text style={styles.primaryBtnText}>Başla</Text>
        </Pressable>
        <Pressable onPress={onExit} style={{ marginTop: 16, marginBottom: 24 }}>
          <Text style={styles.backLink}>Menüye dön</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!round) {
    return (
      <View style={styles.container}>
        <Text style={styles.center}>Bu veri setiyle yeni eşleşme kalmadı.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => { setUsedPairs(new Set()); startNewRound(); }}>
          <Text style={styles.primaryBtnText}>Sıfırla</Text>
        </Pressable>
      </View>
    );
  }

  const p1Locked = lockedOut.has("p1");
  const p2Locked = lockedOut.has("p2");

  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Oyuncu 1: {scoreP1}</Text>
        <Text style={styles.scoreText}>Oyuncu 2: {scoreP2}</Text>
      </View>

      <View style={styles.teamsCard}>
        <Text style={styles.teamName}>{round.teamA}</Text>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.teamName}>{round.teamB}</Text>
      </View>

      {phase === "racing" && (
        <>
          <Text style={styles.timerText}>{timeLeft} sn</Text>
          <View style={styles.buzzRow}>
            <View style={{ flex: 1 }}>
              <Pressable disabled={p1Locked} onPress={() => handleBuzz("p1")} style={[styles.buzzBtn, p1Locked && styles.buzzBtnDisabled]}>
                <Text style={[styles.buzzBtnText, p1Locked && styles.buzzBtnTextDisabled]}>Oyuncu 1</Text>
              </Pressable>
              <Pressable disabled={p1Locked} onPress={() => handlePass("p1")} style={styles.passBtn}>
                <Text style={styles.passBtnText}>{p1Locked ? "Bilemedi" : "Bilemedim"}</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Pressable disabled={p2Locked} onPress={() => handleBuzz("p2")} style={[styles.buzzBtn, p2Locked && styles.buzzBtnDisabled]}>
                <Text style={[styles.buzzBtnText, p2Locked && styles.buzzBtnTextDisabled]}>Oyuncu 2</Text>
              </Pressable>
              <Pressable disabled={p2Locked} onPress={() => handlePass("p2")} style={styles.passBtn}>
                <Text style={styles.passBtnText}>{p2Locked ? "Bilemedi" : "Bilemedim"}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {phase === "answering" && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.answeringText}>
            {buzzedBy === "p1" ? "Oyuncu 1" : "Oyuncu 2"} buzz'ladı — {answerTimeLeft} sn
          </Text>
          <TextInput
            autoFocus
            value={answerInput}
            onChangeText={setAnswerInput}
            onSubmitEditing={submitAnswer}
            placeholder="Futbolcu adı..."
            placeholderTextColor="#4A5D52"
            style={styles.input}
          />
          <Pressable style={styles.primaryBtn} onPress={submitAnswer}>
            <Text style={styles.primaryBtnText}>Gönder</Text>
          </Pressable>
        </View>
      )}

      {phase === "result" && (
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={styles.resultText}>{resultText}</Text>
          <Text style={styles.answersText}>Geçerli cevaplar: {round.validAnswers.map((p) => p.name).join(", ")}</Text>
          <Pressable style={styles.primaryBtn} onPress={startNewRound}>
            <Text style={styles.primaryBtnText}>Sıradaki Tur</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={onExit} style={{ marginTop: 24 }}>
        <Text style={styles.backLink}>Menüye dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1613", padding: 20, justifyContent: "center" },
  scrollContainer: { flex: 1, backgroundColor: "#0B1613", padding: 20 },
  title: { color: "#F4F7F1", fontSize: 20, fontWeight: "900", textAlign: "center" },
  diffBtn: { borderColor: "#26392F", borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: "#C6FF3D", backgroundColor: "#132420" },
  diffBtnText: { color: "#7C9186", fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: "#C6FF3D" },
  center: { color: "#F4F7F1", textAlign: "center", marginBottom: 16 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  scoreText: { color: "#7C9186", fontWeight: "700", fontSize: 13 },
  teamsCard: { flexDirection: "row", backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", justifyContent: "center" },
  teamName: { color: "#F4F7F1", fontSize: 16, fontWeight: "900", flex: 1, textAlign: "center" },
  plus: { color: "#C6FF3D", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#7C9186", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  buzzBtn: { flex: 1, borderColor: "#C6FF3D", borderWidth: 2, borderRadius: 18, paddingVertical: 36, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#26392F" },
  buzzBtnText: { color: "#C6FF3D", fontWeight: "900", fontSize: 14 },
  buzzBtnTextDisabled: { color: "#4A5D52" },
  passBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  passBtnText: { color: "#7C9186", fontSize: 12, fontWeight: "700" },
  answeringText: { color: "#C6FF3D", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F4F7F1", fontSize: 16, marginBottom: 12 },
  primaryBtn: { backgroundColor: "#C6FF3D", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#0B1613", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: "#F4F7F1", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: "#7C9186", fontSize: 12, textAlign: "center", marginBottom: 12 },
  backLink: { color: "#7C9186", textAlign: "center", fontSize: 12 },
});
