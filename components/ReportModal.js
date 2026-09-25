import React, { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, TextInput, Alert } from "react-native";
import { supabase, getDeviceId } from "../lib/supabaseClient";

import { COLORS } from "../lib/theme";
export default function ReportModal({ visible, onClose, playerContext }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      Alert.alert("Hata", "Lütfen bir neden belirtin.");
      return;
    }
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      await supabase.from("reports").insert([
        {
          player_name: playerContext || "Bilinmiyor",
          reason: reason.trim(),
          device_id: deviceId,
        }
      ]);
      Alert.alert("Teşekkürler", "Geri bildiriminiz alındı, en kısa sürede düzeltilecektir!");
      setReason("");
      onClose();
    } catch (err) {
      console.log(err);
      Alert.alert("Hata", "Gönderilemedi, lütfen tekrar deneyin.");
    }
    setLoading(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Hata Bildir</Text>
          <Text style={styles.subtitle}>
            İlgili Futbolcu: <Text style={{ color: COLORS.success }}>{playerContext || "Bilinmiyor"}</Text>
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Eksik kulüp mü, hatalı fotoğraf mı?"
            placeholderTextColor={COLORS.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          
          <View style={styles.row}>
            <Pressable style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>İptal</Text>
            </Pressable>
            <Pressable style={styles.btnSubmit} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.btnSubmitText}>{loading ? "..." : "Gönder"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: COLORS.bg, padding: 20, borderRadius: 16, borderColor: COLORS.cardBorder, borderWidth: 1 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: COLORS.accent, fontSize: 14, marginBottom: 16 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, padding: 12, borderRadius: 8, minHeight: 80, textAlignVertical: "top", marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  btnCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.textMuted, alignItems: "center" },
  btnCancelText: { color: COLORS.textMuted, fontWeight: "700" },
  btnSubmit: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.cta, alignItems: "center" },
  btnSubmitText: { color: COLORS.ctaDark, fontWeight: "800" },
});
