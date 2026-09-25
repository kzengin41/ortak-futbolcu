import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import GameBackground from "../components/GameBackground";
import { PLAYERS } from "../lib/players";
import { suggestPlayers, buildSuggestIndex } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { calculatePlayerPopularity } from "../lib/clubWeights";
import { PLAYER_NATIONAL_TEAMS } from "../lib/playerNationalTeams";
import AnswerFeedback from "../components/AnswerFeedback";
import { addXP } from "../lib/profile";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Havuzu oluştur
const getValidPool = () => {
  const pool = [];
  for (const p of PLAYERS) {
    const nats = PLAYER_NATIONAL_TEAMS[p.name];
    if (nats && nats.length > 0 && p.clubs.length > 0) {
      pool.push({ player: p, nation: nats[0] });
    }
  }
  return pool.sort((a, b) => calculatePlayerPopularity(b.player) - calculatePlayerPopularity(a.player));
};

export default function CountryClubArcadeScreen({ onExit }) {
  const [phase, setPhase] = useState("start"); // start, playing, result, gameOver
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [answerInput, setAnswerInput] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [targetBlock, setTargetBlock] = useState(null);
  const fallAnim = useRef(new Animated.Value(0)).current;
  const fallSpeedRef = useRef(15000); // 15 saniyede düşer (level arttıkça hızlanır)
  
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  const pool = useMemo(() => getValidPool(), []);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const suggestions = useMemo(() => suggestPlayers(suggestIndex, answerInput), [suggestIndex, answerInput]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    fallSpeedRef.current = 15000;
    setPhase("playing");
    spawnBlock();
  };

  const spawnBlock = () => {
    fallAnim.stopAnimation();
    fallAnim.setValue(0);
    setAnswerInput("");
    
    // Levela göre zorluk (ilk 200, ilk 500 vb.)
    const maxIdx = Math.min(pool.length - 1, level * 200 + 100);
    const item = pool[Math.floor(Math.random() * maxIdx)];
    
    // Rastgele bir kulüp seç
    const club = item.player.clubs[Math.floor(Math.random() * item.player.clubs.length)].name;
    
    setTargetBlock({
      player: item.player,
      nation: item.nation,
      club: club
    });

    Animated.timing(fallAnim, {
      toValue: 1,
      duration: fallSpeedRef.current,
      easing: Easing.linear,
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) {
        handleCrash();
      }
    });
  };

  const handleCrash = () => {
    playWrong();
    setFeedback({ type: "wrong", text: `Yere Çarptı! Cevap: ${targetBlock.player.name}` });
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives <= 0) {
      setTimeout(() => { setPhase("gameOver"); addXP(score); }, 2000);
    } else {
      setTimeout(() => {
        setFeedback(null);
        spawnBlock();
      }, 2000);
    }
  };

  const checkAnswer = (text) => {
    if (phase !== "playing" || !targetBlock) return;
    
    const input = text.trim().toLowerCase();
    const correctName = targetBlock.player.name.toLowerCase();
    
    if (input === correctName || correctName.includes(input)) {
      // Doğru!
      playCorrect();
      fallAnim.stopAnimation();
      
      const newScore = score + 100 * level;
      setScore(newScore);
      
      if (newScore > level * 1000) {
        setLevel(l => l + 1);
        fallSpeedRef.current = Math.max(4000, fallSpeedRef.current - 1500); // Hızlandır
      }
      
      setFeedback({ type: "correct", text: `Harika! +${100 * level} Puan` });
      
      setTimeout(() => {
        setFeedback(null);
        spawnBlock();
      }, 1500);
      
    } else {
      // Yanlış!
      playWrong();
      setFeedback({ type: "wrong", text: "Yanlış İsim!" });
      setTimeout(() => setFeedback(null), 1000);
    }
    setAnswerInput("");
  };

  return (
    <GameBackground style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ülke & Takım <Text style={{color:"#FF5D5D"}}>ARCADE</Text></Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>Can: {"❤️".repeat(lives)}</Text>
          <Text style={styles.statText}>Skor: {score}</Text>
          <Text style={styles.statText}>Level: {level}</Text>
        </View>
      </View>

      {phase === "start" && (
        <View style={styles.centerPanel}>
          <Text style={styles.startTitle}>TETRİS SURVIVAL</Text>
          <Text style={styles.startDesc}>
            Yukarıdan aşağıya Ülke ve Kulüp logoları düşecek. Yere çarpmadan önce ikisinde de oynamış oyuncuyu yazmalısın! Bildikçe oyun hızlanacak.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={startGame}>
            <Text style={styles.primaryBtnText}>BAŞLA</Text>
          </Pressable>
          <Pressable onPress={onExit} style={{ marginTop: 24 }}>
            <Text style={styles.backLink}>Menüye Dön</Text>
          </Pressable>
        </View>
      )}

      {phase === "playing" && targetBlock && (
        <View style={styles.gameArea}>
          <Animated.View style={[styles.fallingBlock, {
            top: fallAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_HEIGHT * 0.55] }),
            backgroundColor: fallAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: ["#16222E", "#FFB020", "#FF5D5D"] })
          }]}>
            <Text style={styles.blockNation}>🌍 {targetBlock.nation}</Text>
            <Text style={styles.blockPlus}>+</Text>
            <Text style={styles.blockClub}>🛡️ {targetBlock.club}</Text>
          </Animated.View>
          
          <View style={styles.spikes}>
            <Text style={styles.spikesText}>^^^^^^^^^^^^^^^^^^^^^^^^^</Text>
          </View>
        </View>
      )}

      {phase === "playing" && !feedback && (
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Futbolcunun adını yaz..."
            placeholderTextColor="#8CA0B3"
            value={answerInput}
            onChangeText={setAnswerInput}
            autoFocus
            onSubmitEditing={() => checkAnswer(answerInput)}
          />
          {suggestions.length > 0 && answerInput.length > 1 && (
            <View style={styles.suggestBox}>
              {suggestions.slice(0, 2).map((s, i) => (
                <Pressable key={i} onPress={() => checkAnswer(s)} style={styles.suggestRow}>
                  <Text style={styles.suggestText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {feedback && (
        <View style={styles.feedbackOverlay}>
          <AnswerFeedback type={feedback.type} message={feedback.text} />
        </View>
      )}

      {phase === "gameOver" && (
        <View style={styles.centerPanel}>
          <Text style={styles.gameOverTitle}>OYUN BİTTİ!</Text>
          <Text style={styles.finalScore}>Skor: {score} (Level {level})</Text>
          <Pressable style={styles.primaryBtn} onPress={startGame}>
            <Text style={styles.primaryBtnText}>TEKRAR OYNA</Text>
          </Pressable>
          <Pressable onPress={onExit} style={{ marginTop: 24 }}>
            <Text style={styles.backLink}>Menüye Dön</Text>
          </Pressable>
        </View>
      )}
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D13", paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  title: { color: "#F3F7FA", fontSize: 24, fontWeight: "900", textAlign: "center" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#16222E", padding: 12, borderRadius: 12, marginTop: 12, borderColor: "#28394B", borderWidth: 1 },
  statText: { color: "#7CFF5C", fontWeight: "900", fontSize: 14 },
  
  centerPanel: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  startTitle: { color: "#7CFF5C", fontSize: 32, fontWeight: "900", marginBottom: 16 },
  startDesc: { color: "#F3F7FA", fontSize: 16, textAlign: "center", marginBottom: 32, lineHeight: 24 },
  primaryBtn: { backgroundColor: "#7CFF5C", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, alignItems: "center", width: "100%" },
  primaryBtnText: { color: "#0B1620", fontWeight: "900", fontSize: 18 },
  backLink: { color: "#8CA0B3", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },

  gameArea: { flex: 1, position: "relative", marginHorizontal: 20, overflow: "hidden", borderLeftWidth: 2, borderRightWidth: 2, borderColor: "#16222E", backgroundColor: "#0B1A12" },
  fallingBlock: { position: "absolute", width: "80%", alignSelf: "center", padding: 16, borderRadius: 16, borderWidth: 2, borderColor: "#F3F7FA", alignItems: "center", zIndex: 10 },
  blockNation: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  blockPlus: { color: "#FFF", fontSize: 24, fontWeight: "900", marginVertical: 4 },
  blockClub: { color: "#FFF", fontSize: 20, fontWeight: "900", textAlign: "center" },
  
  spikes: { position: "absolute", bottom: 0, width: "100%", alignItems: "center" },
  spikesText: { color: "#FF5D5D", fontSize: 24, fontWeight: "900", letterSpacing: 2 },

  inputArea: { padding: 20, backgroundColor: "#0B1620" },
  input: { backgroundColor: "#16222E", borderColor: "#28394B", borderWidth: 1, borderRadius: 14, padding: 16, color: "#F3F7FA", fontSize: 16 },
  suggestBox: { marginTop: 4, backgroundColor: "#0A141C", borderColor: "#28394B", borderWidth: 1, borderRadius: 12 },
  suggestRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1B2A38" },
  suggestText: { color: "#7CFF5C", fontSize: 14, fontWeight: "600" },

  feedbackOverlay: { position: "absolute", top: "40%", left: 20, right: 20, zIndex: 100 },
  gameOverTitle: { color: "#FF5D5D", fontSize: 42, fontWeight: "900", marginBottom: 8 },
  finalScore: { color: "#F3F7FA", fontSize: 24, fontWeight: "900", marginBottom: 32 },
});
