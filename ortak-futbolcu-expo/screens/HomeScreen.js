import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function HomeScreen({ onSelect }) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PROTOTİP</Text>
      <Text style={styles.title}>ORTAK FUTBOLCU</Text>
      <Text style={styles.subtitle}>İki takım, tek futbolcu. İlk bilen kazanır.</Text>

      <Pressable style={styles.card} onPress={() => onSelect("local")}>
        <Text style={styles.cardTitle}>Tek Telefon, 2 Oyuncu</Text>
        <Text style={styles.cardDesc}>Pas at, hot-seat oyna</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => onSelect("cpu")}>
        <Text style={styles.cardTitle}>CPU'ya Karşı</Text>
        <Text style={styles.cardDesc}>Tek başına pratik yap</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => onSelect("onlineLobby")}>
        <Text style={styles.cardTitle}>Online 1v1</Text>
        <Text style={styles.cardDesc}>Arkadaşına kod gönder, düello et</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1613", padding: 24, justifyContent: "center" },
  eyebrow: { color: "#C6FF3D", fontSize: 11, fontWeight: "900", letterSpacing: 3, textAlign: "center", marginBottom: 8 },
  title: { color: "#F4F7F1", fontSize: 30, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { color: "#7C9186", fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 32 },
  card: { backgroundColor: "#132420", borderColor: "#26392F", borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 12 },
  cardTitle: { color: "#F4F7F1", fontWeight: "800", fontSize: 15 },
  cardDesc: { color: "#7C9186", fontSize: 12, marginTop: 4 },
});
