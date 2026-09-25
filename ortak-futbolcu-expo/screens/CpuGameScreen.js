import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { PLAYERS } from "../lib/players";
import { CLUB_INFO } from "../lib/clubs";
import { LEAGUE_PRESETS, clubsForPreset } from "../lib/leaguePresets";
import { generateRound, isCorrectAnswer, ANSWER_SECONDS, CPU_PROFILES, ROUND_TIME_OPTIONS } from "../lib/gameEngine";

export default function CpuGameScreen({ onExit }) {
  const [difficulty, setDifficulty] = useState("orta");
  const [roundSeconds, setRoundSeconds] = useState(ROUND_TIME_OPTIONS[1]);
  const [preset, setPreset] = useState("all");
  const [started, setStarted] = useState(false);
  const [usedPairs, setUsedPairs] = useState(new Set());
  const [round, setRound] = useState(null);
  const [phase, setPhase] = useState("racing");
  const [buzzedBy, setBuzzedBy] = useState(null); // 'p1' | 'cpu'
  const [lockedOut, setLockedOut] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_SECONDS);
  const [answerInput, setAnswerInput] = useState("");
  const [resultText, setResultText] = useState("");
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreCpu, setScoreCpu] = useState(0);
  const cpuTimeoutRef = useRef(null);

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
    if (!started || phase !== "racing") return;
    if (timeLeft <= 0) {
      endRound(null, "Süre doldu, kimse bilemedi.");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, phase, timeLeft]);

  useEffect(() => {
    if (phase !== "answering" || buzzedBy === "cpu") return;
    if (answerTimeLeft <= 0) {
      submitAnswer();
      return;
    }
    const t = setTimeout(() => setAnswerTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLeft, buzzedBy]);

  useEffect(() => {
    if (!started || phase !== "racing" || !round) return;
    const profile = CPU_PROFILES[difficulty];
    const delay = profile.minDelay + Math.random() * (profile.maxDelay - profile.minDelay);
    cpuTimeoutRef.current = setTimeout(() => {
      if (lockedOut.has("cpu")) return;
      const willBeCorrect = Math.random() < profile.correctChance;
      setBuzzedBy("cpu");
      setPhase("answering");
      setTimeout(() => {
        if (willBeCorrect && round.validAnswers.length > 0) {
          const pick = round.validAnswers[Math.floor(Math.random() * round.validAnswers.length)];
          endRound("cpu", `CPU doğru bildi: ${pick.name}`);
        } else {
          registerWrong("cpu");
        }
      }, 900);
    }, delay);
    return () => clearTimeout(cpuTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase, round, difficulty]);

  function handleBuzz() {
    if (phase !== "racing" || lockedOut.has("p1") || !round) return;
    if (cpuTimeoutRef.current) clearTimeout(cpuTimeoutRef.current);
    setBuzzedBy("p1");
    setPhase("answering");
    setAnswerTimeLeft(ANSWER_SECONDS);
  }

  function handlePass() {
    if (phase !== "racing" || lockedOut.has("p1") || !round) return;
    registerWrong("p1");
  }

  function submitAnswer() {
    if (!round) return;
    const ok = isCorrectAnswer(answerInput, round.validAnswers);
    if (ok) {
      endRound("p1", `Doğru! (${answerInput.trim()})`);
    } else {
      registerWrong("p1");
    }
  }

  function registerWrong(who) {
    const nextLocked = new Set(lockedOut);
    nextLocked.add(who);
    setLockedOut(nextLocked);
    setAnswerInput("");
    const remaining = ["p1", "cpu"].filter((o) => !nextLocked.has(o));
    if (remaining.length === 0) {
      endRound(null, "İkiniz de bilemediniz.");
    } else {
      setBuzzedBy(null);
      setPhase("racing");
    }
  }

  function endRound(winner, text) {
    setResultText(text);
    setPhase("result");
    if (winner === "p1") setScoreP1((s) => s + 1);
    if (winner === "cpu") setScoreCpu((s) => s + 1);
  }

  if (!started) {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingVertical: 24 }}>
        <Text style={styles.title}>Zorluk Seç</Text>
        <View style={{ gap: 12, marginTop: 20 }}>
          {["kolay", "orta", "zor"].map((d) => (
            <Pressable
              key={d}
              onPress={() => setDifficulty(d)}
              style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
            >
              <Text style={[styles.diffBtnText, difficulty === d && styles.diffBtnTextActive]}>
                {d.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.title, { fontSize: 16, marginTop: 24 }]}>Tur Süresi</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
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
      </View>
    );
  }

  const p1Locked = lockedOut.has("p1");

  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Sen: {scoreP1}</Text>
        <Text style={styles.scoreText}>CPU: {scoreCpu}</Text>
      </View>

      <View style={styles.teamsCard}>
        <Text style={styles.teamName}>{round.teamA}</Text>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.teamName}>{round.teamB}</Text>
      </View>

      {phase === "racing" && (
        <>
          <Text style={styles.timerText}>{timeLeft} sn</Text>
          <Pressable disabled={p1Locked} onPress={handleBuzz} style={[styles.buzzBtn, p1Locked && styles.buzzBtnDisabled]}>
            <Text style={[styles.buzzBtnText, p1Locked && styles.buzzBtnTextDisabled]}>BUZZ'LA</Text>
          </Pressable>
          <Pressable disabled={p1Locked} onPress={handlePass} style={styles.passBtn}>
            <Text style={styles.passBtnText}>{p1Locked ? "Bilemedin" : "Bilemedim"}</Text>
          </Pressable>
        </>
      )}

      {phase === "answering" && (
        <View style={{ marginTop: 20 }}>
          {buzzedBy === "cpu" ? (
            <Text style={styles.answeringText}>CPU cevap veriyor...</Text>
          ) : (
            <>
              <Text style={styles.answeringText}>{answerTimeLeft} sn içinde yaz</Text>
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
            </>
          )}
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
  center: { color: "#F4F7F1", textAlign: "center" },
  diffBtn: { borderColor: "#26392F", borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  diffBtnActive: { borderColor: "#C6FF3D", backgroundColor: "#132420" },
  diffBtnText: { color: "#7C9186", fontWeight: "800", fontSize: 13 },
  diffBtnTextActive: { color: "#C6FF3D" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  scoreText: { color: "#7C9186", fontWeight: "700", fontSize: 13 },
  teamsCard: { flexDirection: "row", backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", justifyContent: "center" },
  teamName: { color: "#F4F7F1", fontSize: 16, fontWeight: "900", flex: 1, textAlign: "center" },
  plus: { color: "#C6FF3D", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  timerText: { color: "#7C9186", textAlign: "center", marginTop: 16, fontSize: 12 },
  buzzBtn: { marginTop: 16, borderColor: "#C6FF3D", borderWidth: 2, borderRadius: 20, paddingVertical: 40, alignItems: "center" },
  buzzBtnDisabled: { borderColor: "#26392F" },
  buzzBtnText: { color: "#C6FF3D", fontWeight: "900", fontSize: 16 },
  buzzBtnTextDisabled: { color: "#4A5D52" },
  passBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  passBtnText: { color: "#7C9186", fontSize: 12, fontWeight: "700" },
  answeringText: { color: "#C6FF3D", textAlign: "center", fontWeight: "800", marginBottom: 12 },
  input: { backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F4F7F1", fontSize: 16, marginBottom: 12 },
  primaryBtn: { backgroundColor: "#C6FF3D", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  primaryBtnText: { color: "#0B1613", fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
  resultText: { color: "#F4F7F1", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  answersText: { color: "#7C9186", fontSize: 12, textAlign: "center", marginBottom: 12 },
  backLink: { color: "#7C9186", textAlign: "center", fontSize: 12 },
});
