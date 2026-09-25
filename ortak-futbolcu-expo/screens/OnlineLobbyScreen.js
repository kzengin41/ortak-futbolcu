import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { supabase, getDeviceId } from "../lib/supabaseClient";
import { LEAGUE_PRESETS, clubIdsForPreset } from "../lib/leaguePresets";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function OnlineLobbyScreen({ onExit, onRoomReady }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [preset, setPreset] = useState("all");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | working | waiting | error
  const [errorMsg, setErrorMsg] = useState("");
  const deviceIdRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    getDeviceId().then((id) => (deviceIdRef.current = id));
    return () => channelRef.current?.unsubscribe();
  }, []);

  async function handleCreate() {
    setMode("create");
    setStatus("working");
    const id = deviceIdRef.current || (await getDeviceId());
    const roomCode = randomCode();

    let allowedClubIds = null;
    if (preset !== "all") {
      const { data: clubRows } = await supabase.from("clubs").select("id, name, country, league");
      allowedClubIds = clubIdsForPreset(preset, clubRows || []);
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert({ code: roomCode, player1_id: id, status: "waiting", allowed_club_ids: allowedClubIds })
      .select()
      .single();
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setCode(roomCode);
    setStatus("waiting");

    channelRef.current = supabase
      .channel(`room-${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${data.id}` },
        (payload) => {
          if (payload.new.status === "active") {
            onRoomReady({ id: data.id, code: roomCode, playerNumber: 1 });
          }
        }
      )
      .subscribe();
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setStatus("working");
    const id = deviceIdRef.current || (await getDeviceId());

    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", joinCode.trim().toUpperCase())
      .eq("status", "waiting")
      .single();

    if (error || !room) {
      setErrorMsg("Bu kodla bekleyen bir oda bulunamadı.");
      setStatus("error");
      return;
    }

    // .eq('status', 'waiting') koşulu: iki kişi aynı anda katılmaya çalışırsa
    // sadece ilki başarılı olur, diğeri boş sonuç alır.
    const { data: updated, error: updateError } = await supabase
      .from("rooms")
      .update({ player2_id: id, status: "active" })
      .eq("id", room.id)
      .eq("status", "waiting")
      .select()
      .single();

    if (updateError || !updated) {
      setErrorMsg("Bu oda az önce doldu, başka bir kod dene.");
      setStatus("error");
      return;
    }

    await supabase.rpc("generate_round", {
      p_room_id: room.id,
      p_round_number: 1,
      p_allowed_club_ids: room.allowed_club_ids ?? null,
    });
    onRoomReady({ id: room.id, code: room.code, playerNumber: 2 });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Online 1v1</Text>

      {!mode && (
        <View style={{ gap: 12 }}>
          <Text style={styles.label}>Lig / Kapsam <Text style={{ color: "#4A5D52" }}>(oda kurarken geçerli)</Text></Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {LEAGUE_PRESETS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPreset(p.id)}
                style={[styles.secondaryBtn, { flex: 1, minWidth: "47%", paddingVertical: 10 }, preset === p.id && { borderColor: "#C6FF3D" }]}
              >
                <Text style={[styles.secondaryBtnText, preset === p.id && { color: "#C6FF3D" }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primaryBtn} onPress={handleCreate}>
            <Text style={styles.primaryBtnText}>Oda Kur</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setMode("join")}>
            <Text style={styles.secondaryBtnText}>Kodla Katıl</Text>
          </Pressable>
          <Pressable onPress={onExit}>
            <Text style={styles.backLink}>Menüye dön</Text>
          </Pressable>
        </View>
      )}

      {mode === "create" && status === "waiting" && (
        <View style={styles.center}>
          <Text style={styles.label}>Bu kodu arkadaşına gönder</Text>
          <Text style={styles.codeText}>{code}</Text>
          <ActivityIndicator color="#C6FF3D" style={{ marginTop: 16 }} />
          <Text style={styles.waitingText}>Rakip bekleniyor...</Text>
        </View>
      )}

      {mode === "join" && (
        <View style={{ gap: 12 }}>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ODA KODU"
            placeholderTextColor="#4A5D52"
            autoCapitalize="characters"
            style={styles.input}
          />
          <Pressable style={styles.primaryBtn} onPress={handleJoin} disabled={status === "working"}>
            <Text style={styles.primaryBtnText}>{status === "working" ? "Katılıyor..." : "Katıl"}</Text>
          </Pressable>
        </View>
      )}

      {status === "error" && <Text style={styles.errorText}>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1613", padding: 24, justifyContent: "center" },
  title: { color: "#F4F7F1", fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 28 },
  primaryBtn: { backgroundColor: "#C6FF3D", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#0B1613", fontWeight: "900", textTransform: "uppercase", fontSize: 14 },
  secondaryBtn: { borderColor: "#26392F", borderWidth: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  secondaryBtnText: { color: "#F4F7F1", fontWeight: "800", fontSize: 14 },
  backLink: { color: "#7C9186", textAlign: "center", marginTop: 8, fontSize: 12 },
  center: { alignItems: "center" },
  label: { color: "#7C9186", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  codeText: { color: "#C6FF3D", fontSize: 44, fontWeight: "900", letterSpacing: 8, marginTop: 8 },
  waitingText: { color: "#7C9186", fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: "#132420",
    borderColor: "#26392F",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    color: "#F4F7F1",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
  },
  errorText: { color: "#FF5A3C", textAlign: "center", marginTop: 16, fontSize: 13 },
});
