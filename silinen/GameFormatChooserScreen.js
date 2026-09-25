import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SoundPressable from "../components/SoundPressable";

export default function GameFormatChooserScreen({ onSelect, onBack }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oyun Formatı</Text>
      <Text style={styles.subtitle}>Hangi şekilde oynamak istersin?</Text>

      <SoundPressable style={[styles.card, { borderColor: "#7CFF5C" }]} onPress={() => onSelect("classic")}>
        <Text style={styles.cardIcon}>⚡</Text>
        <Text style={styles.cardTitle}>Klasik</Text>
        <Text style={styles.cardDesc}>Buzz'la, yaz ya da söyle — ilk bilen kazanır</Text>
      </SoundPressable>

      <SoundPressable style={[styles.card, { borderColor: "#FFB020" }]} onPress={() => onSelect("quick")}>
        <Text style={styles.cardIcon}>🎯</Text>
        <Text style={styles.cardTitle}>Hızlı Oyun</Text>
        <Text style={styles.cardDesc}>4 seçenekten doğrusunu bul — doğru +1, yanlış -1</Text>
      </SoundPressable>

      <SoundPressable onPress={onBack} style={{ marginTop: 20, alignItems: "center" }}>
        <Text style={styles.backLink}>Menüye dön</Text>
      </SoundPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1620", padding: 24, justifyContent: "center" },
  title: { color: "#F3F7FA", fontSize: 26, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#8CA0B3", fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 28 },
  card: {
    backgroundColor: "#16222E",
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  cardIcon: { fontSize: 36, marginBottom: 8 },
  cardTitle: { color: "#F3F7FA", fontSize: 18, fontWeight: "900" },
  cardDesc: { color: "#8CA0B3", fontSize: 12, marginTop: 6, textAlign: "center" },
  backLink: { color: "#8CA0B3", fontSize: 13 },
});
