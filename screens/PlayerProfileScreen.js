import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import TabHeader from "../components/TabHeader";
import { getPokedexPool, getUnlockedPlayers } from "../lib/pokedex";
import { getProfile } from "../lib/profile";
import PlayerPhoto from "../components/PlayerPhoto";
import { PLAYER_NATIONAL_TEAMS } from "../lib/playerNationalTeams";
import { PLAYER_BIRTH_POSITION } from "../lib/playerBirthPosition";

import { countryTr } from "../lib/countryNamesTr";
import { positionTr } from "../lib/positionNamesTr";
import { COLORS } from "../lib/theme";
// 30 Ağustos 2026: Ansiklopedi artık kendi sekmesi (bottom tab) — bir üst
// ekrana "çıkış" kavramı yok, tab bar'ın kendisi navigasyonu sağlıyor. Bu
// yüzden onExit prop'u ve alttaki "Menüye Dön" butonu kaldırıldı (Kerem:
// "geri butonuna basınca uyarı çıkmasın, direkt menüye dönsün" — en temiz
// çözüm, gereksiz onay isteyen bir geri butonunu hiç bulundurmamak).
export default function PlayerProfileScreen() {
  const [unlockedNames, setUnlockedNames] = useState(new Set());
  const [profile, setProfile] = useState({ level: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Detaylar için
  const [onlyUnlocked, setOnlyUnlocked] = useState(false); // Kerem: "sadece açılanları göster" butonu

  const pool = useMemo(() => getPokedexPool(), []);

  useEffect(() => {
    getUnlockedPlayers().then(arr => {
      // 12 Eylül 2026: burada hiç oynamamış kullanıcıya havuzun ilk 15 oyuncusu
      // "açılmış" gibi gösteriliyordu. Aynı anda İstatistikler ekranı "0 / 2000
      // açıldı" diyordu — iki ekran birbiriyle çelişiyor ve koleksiyonun bütün
      // psikolojik değeri daha ilk dokunuşta harcanıyordu. Artık gerçekten 0.
      setUnlockedNames(new Set(arr));
      setLoading(false);
    });
    getProfile().then(p => setProfile(p));
  }, []);

  const filteredPool = useMemo(() => {
    let list = pool;
    if (onlyUnlocked) list = list.filter(p => unlockedNames.has(p.name));
    if (search.trim()) {
      const lower = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(lower));
    }
    return list;
  }, [pool, search, onlyUnlocked, unlockedNames]);

  // 31 Ağustos 2026 (Kerem: "direkt açılsın") — açma artık seviyeye bağlı
  // DEĞİL (bkz. lib/pokedex.js unlockPlayer): havuzdaki (top 2000) bir
  // oyuncu hangi modda olursa olsun bulunduğu anda açılıyor. Bu yüzden
  // burada artık "needsLevel"/"Sv. X" ayrımı yok — bir kart ya açılmıştır
  // (bulunmuş) ya da düz "KİLİTLİ"dir (henüz bulunmamış).
  const renderItem = ({ item, index }) => {
    const isUnlocked = unlockedNames.has(item.name);
    // Asıl havuzdaki sırasını bul (Arama yapıldığında index değişir, o yüzden index'i pool'dan alalım)
    const dexRank = pool.findIndex(p => p.name === item.name); // 0-indexli
    const dexNumber = dexRank + 1;

    return (
      <Pressable
        style={[styles.card, isUnlocked ? styles.cardUnlocked : styles.cardLocked]}
        onPress={() => isUnlocked && setSelectedPlayer(item)}
      >
        <Text style={styles.dexNumber}>#{dexNumber}</Text>
        <View style={styles.photoContainer}>
          {isUnlocked ? (
            <PlayerPhoto name={item.name} size={60} />
          ) : (
            <View style={styles.silhouette}>
              <Ionicons name="person" size={24} color={COLORS.textMuted} />
            </View>
          )}
        </View>
        <Text style={styles.playerName} numberOfLines={2}>
          {isUnlocked ? item.name : "KİLİTLİ"}
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <GameBackground style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} style={{marginTop:100}} />
      </GameBackground>
    );
  }

  // EĞER OYUNCU DETAYINA TIKLANDIYSA
  if (selectedPlayer) {
    const info = PLAYER_BIRTH_POSITION[selectedPlayer.name] || {};
    const teams = PLAYER_NATIONAL_TEAMS[selectedPlayer.name] || [];
    return (
      <GameBackground style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>KARİYER İNCELEME</Text>
        </View>
        <View style={styles.detailCard}>
          <PlayerPhoto name={selectedPlayer.name} size={120} />
          <Text style={styles.detailName}>{selectedPlayer.name}</Text>
          {/* 12 Eylül 2026: ülke ve mevki artık Türkçe gösteriliyor. */}
          <Text style={styles.detailSub}>
            {(teams || []).map(countryTr).join(", ")} • {positionTr(info.position) || "?"}
          </Text>

          <View style={{marginTop: 20, width: "100%"}}>
            <Text style={{color:COLORS.accent, fontWeight:"900", marginBottom:8}}>OYNADIĞI KULÜPLER</Text>
            {selectedPlayer.clubs.map((c, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Ionicons name="shield" size={14} color={COLORS.accent} />
                <Text style={styles.detailClubText}>{c.name}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => setSelectedPlayer(null)}>
            <Text style={styles.primaryBtnText}>KOLEKSİYONA DÖN</Text>
          </Pressable>
        </View>
      </GameBackground>
    );
  }

  // KOLEKSİYON LİSTESİ (POKEDEX)
  return (
    <GameBackground style={styles.container}>
      <View style={styles.header}>
        <TabHeader compact />
        <Text style={styles.title}>EFSANELER KOLEKSİYONU</Text>
        <Text style={styles.subtitle}>Oyun içinde açtığın karakterler bunlar!</Text>

        <View style={styles.statsBox}>
          <Text style={styles.statsText}>
            Seviye {profile.level} - Açılan: <Text style={{color:COLORS.accent}}>{unlockedNames.size}</Text> / {pool.length} Futbolcu
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, (unlockedNames.size / pool.length) * 100)}%` }]} />
          </View>
        </View>

        <TextInput
          autoCorrect={false}
          autoCapitalize="words"
          spellCheck={false}
          style={styles.searchInput}
          placeholder="Futbolcu ara..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />

        <Pressable
          style={[styles.filterToggle, onlyUnlocked && styles.filterToggleActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
          onPress={() => setOnlyUnlocked(v => !v)}
        >
          {onlyUnlocked && <Ionicons name="checkmark" size={14} color={COLORS.bg} />}
          <Text style={[styles.filterToggleText, onlyUnlocked && styles.filterToggleTextActive]}>
            {onlyUnlocked ? "Sadece Açılanlar" : "Sadece Açılanları Göster"}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredPool}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 60 }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
      />
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 10, alignItems: "center" },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontStyle: "italic", textAlign: "center" },

  statsBox: { width: "100%", backgroundColor: COLORS.card, padding: 12, borderRadius: 12, marginTop: 12, borderColor: COLORS.cardBorder, borderWidth: 1 },
  statsText: { color: COLORS.text, fontSize: 14, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  progressBarBg: { height: 10, backgroundColor: COLORS.bg, borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: COLORS.accent },

  searchInput: { width: "100%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, padding: 12, color: COLORS.text, marginTop: 12 },

  filterToggle: { marginTop: 10, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.cardBorder },
  filterToggleActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterToggleText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  filterToggleTextActive: { color: COLORS.bg },

  card: { width: "31%", backgroundColor: COLORS.card, borderRadius: 12, padding: 8, alignItems: "center", marginBottom: 12, borderColor: COLORS.cardBorder, borderWidth: 1 },
  cardUnlocked: { borderColor: COLORS.accent, backgroundColor: COLORS.card },
  cardLocked: { opacity: 0.6 },
  dexNumber: { position: "absolute", top: 4, left: 4, color: COLORS.textMuted, fontSize: 10, fontWeight: "900" },
  photoContainer: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", backgroundColor: "#000", marginVertical: 8, justifyContent: "center", alignItems: "center" },
  silhouette: { opacity: 0.5 },
  playerName: { color: COLORS.text, fontSize: 10, fontWeight: "800", textAlign: "center" },

  detailCard: { flex: 1, backgroundColor: COLORS.card, margin: 20, borderRadius: 20, padding: 20, alignItems: "center", borderColor: COLORS.cardBorder, borderWidth: 2 },
  detailName: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 16, textAlign: "center" },
  detailSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 4, fontWeight: "700" },
  detailClubText: { color: COLORS.text, fontSize: 14, marginVertical: 4, fontWeight: "600" },

  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", marginTop: "auto", width: "100%" },
  primaryBtnText: { color: COLORS.bg, fontWeight: "900", fontSize: 14 },

  bottomExit: { position: "absolute", bottom: 20, alignSelf: "center", backgroundColor: COLORS.bg, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  backLink: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
});
