import { _t } from "../lib/dil";
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import GameBackground from "../components/GameBackground";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import BackButton from "../components/BackButton";
import SoundPressable from "../components/SoundPressable";
import { signUpWithEmail, signInWithEmail, signOut, getCurrentUser, sifreSifirlamaKoduGonder, sifreyiKodlaYenile, ASGARI_SIFRE } from "../lib/auth";
import {
  fetchCloudProfile, reconcileOnLogin, updateDisplayName, updateAvatarColor,
  pushFullProgressToCloud, uploadAvatarPhoto, deleteAccount,
} from "../lib/cloudProfile";
import { getProfile, xpProgress, updateProfileName } from "../lib/profile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// Faz 5 (31 Ağustos 2026) — Kerem: "kullanıcı altyapısı kurulmalı. profil,
// mail-şifre, avatar, bunların veritabanı bağlantıları vs. vs." İlk dilim
// (e-posta/şifre + renk avatarı) sonrası "B'yi hemen yapalım" isteğiyle
// devam edildi: gerçek fotoğraf avatarı (expo-image-picker + Supabase
// Storage) ve Profilim'e her dönüşte sessiz arka plan yedeklemesi eklendi
// (bkz. lib/cloudProfile.js pushFullProgressToCloud).
//
// ÖNEMLİ — YENİ PAKET GEREKİYOR: expo-image-picker bu projeye henüz
// kurulmamıştı. Kerem'in bilgisayarında ÇALIŞTIRILMASI GEREKEN komut:
//   npx expo install expo-image-picker
// (npm install DEĞİL — npx expo install, Expo SDK 54 ile uyumlu doğru
// sürümü otomatik seçip package.json'a ekler.)
const AVATAR_COLORS = [COLORS.accent, "#7DD3FC", "#A78BFA", COLORS.cta, COLORS.danger, "#FFD93D", "#C084FC"];

export default function AccountScreen({ onBack }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [cloudProfile, setCloudProfile] = useState(null);

  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // Paket 41: şifremi unuttum — null | "eposta" | "kod"
  const [sifirlama, setSifirlama] = useState(null);
  const [kod, setKod] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [localXp, setLocalXp] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const u = await getCurrentUser();
        if (!active) return;
        setUser(u);
        setChecking(false);
        if (u) {
          const cp = await fetchCloudProfile(u.id);
          if (active) {
            setCloudProfile(cp);
            setNameInput(cp?.display_name || "");
          }
          // Ekran her açıldığında (bir tur bitip Hesabım'a bakınca dahil)
          // mevcut cihaz ilerlemesini sessizce buluta yedekle.
          pushFullProgressToCloud(u.id);
        }
        const p = await getProfile();
        if (active) setLocalXp(xpProgress(p));
      })();
      return () => { active = false; };
    }, [])
  );

  async function handlePickPhoto() {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(_t("Fotoğraf seçebilmek için galeri izni gerekiyor."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // 12 Eylül 2026: MediaTypeOptions SDK 52'de kullanımdan kaldırıldı ve
      // sonraki sürümlerde silindi — SDK 57'de undefined geçiliyordu.
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingPhoto(true);
    setError("");
    const { url, error: uploadErr } = await uploadAvatarPhoto(user.id, result.assets[0].uri);
    setUploadingPhoto(false);
    if (uploadErr) {
      setError(_t("Fotoğraf yüklenemedi: ") + (uploadErr.message || _t("bilinmeyen hata")));
      return;
    }
    setCloudProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    setInfo(_t("Fotoğraf güncellendi."));
  }

  async function handleSubmit() {
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError(_t("E-posta ve şifre gerekli."));
      return;
    }
    setBusy(true);
    const fn = authMode === "signup" ? signUpWithEmail : signInWithEmail;
    const { user: newUser, session, error: authError } = await fn(email, password);
    setBusy(false);
    if (authError) {
      setError(authError.message || _t("Bir şeyler ters gitti."));
      return;
    }
    if (authMode === "signup" && !session) {
      setInfo(_t("Kayıt oldun! E-postana gelen onay linkine tıklayıp buraya geri dön."));
      return;
    }
    if (newUser) await girisSonrasi(newUser);
  }

  // Giriş / kayıt / şifre sıfırlama sonrası ortak adımlar.
  async function girisSonrasi(newUser, onMesaj = "") {
    setUser(newUser);
    const result = await reconcileOnLogin(newUser.id);
    const cp = await fetchCloudProfile(newUser.id);
    setCloudProfile(cp);
    setNameInput(cp?.display_name || "");
    const mesaj = result.winner === "local"
      ? _t("Giriş yapıldı — bu cihazdaki ilerleme buluta kaydedildi.")
      : _t("Giriş yapıldı — buluttaki hesabın gösteriliyor.");
    setInfo(onMesaj ? onMesaj + " " + mesaj : mesaj);
  }

  function sifirlamaHataMetni(h) {
    if (h === "sik") return _t("Çok sık denedin. Bir dakika bekleyip tekrar dene.");
    if (h === "kod") return _t("Kod hatalı ya da süresi dolmuş. Yeni kod isteyebilirsin.");
    if (h === "sifre") return _t("Yeni şifre kabul edilmedi. En az {0} karakter olmalı.", [ASGARI_SIFRE]);
    return _t("Bir şeyler ters gitti. İnternet bağlantını kontrol edip tekrar dene.");
  }

  function sifirlamayiAc() {
    setSifirlama("eposta");
    setKod("");
    setYeniSifre("");
    setError("");
    setInfo("");
  }

  function sifirlamayiKapat() {
    setSifirlama(null);
    setError("");
    setInfo("");
  }

  async function kodGonder() {
    setError("");
    setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(_t("Geçerli bir e-posta adresi yaz."));
      return;
    }
    setBusy(true);
    const { hata } = await sifreSifirlamaKoduGonder(email);
    setBusy(false);
    if (hata) {
      setError(sifirlamaHataMetni(hata));
      return;
    }
    setSifirlama("kod");
    setInfo(_t("Bu adresle bir hesap varsa {0} adresine bir kod gönderdik. Birkaç dakika içinde gelmezse gereksiz (spam) klasörüne de bak.", [email.trim()]));
  }

  async function sifreyiYenile() {
    setError("");
    setInfo("");
    if (!kod.trim()) {
      setError(_t("E-postadaki kodu yaz."));
      return;
    }
    if (yeniSifre.length < ASGARI_SIFRE) {
      setError(_t("Yeni şifre en az {0} karakter olmalı.", [ASGARI_SIFRE]));
      return;
    }
    setBusy(true);
    const { user: u, hata } = await sifreyiKodlaYenile(email, kod, yeniSifre);
    setBusy(false);
    if (!u) {
      setError(sifirlamaHataMetni(hata));
      return;
    }
    setSifirlama(null);
    setPassword("");
    setKod("");
    setYeniSifre("");
    if (hata) setError(sifirlamaHataMetni(hata));
    await girisSonrasi(u, hata ? "" : _t("Şifren yenilendi."));
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
    setUser(null);
    setCloudProfile(null);
    setEmail("");
    setPassword("");
  }

  async function handleSaveName() {
    if (!user || !nameInput.trim()) return;
    setBusy(true);
    const { error: e } = await updateDisplayName(user.id, nameInput);
    setBusy(false);
    if (e) {
      setError(e.message);
    } else {
      setInfo(_t("İsim güncellendi."));
      setCloudProfile((prev) => (prev ? { ...prev, display_name: nameInput.trim() } : prev));
      // 12 Eylül 2026: isim SADECE Supabase'e yazılıyordu; yerel profile hiç
      // işlenmediği için Profilim ekranı kullanıcıya hâlâ "Gizemli Forvet"
      // diyordu. updateProfileName yazılmış ama hiçbir yerden çağrılmıyordu.
      await updateProfileName(nameInput.trim());
    }
  }

  // 12 Eylül 2026 — HESAP SİLME (Google Play zorunluluğu). Hesap oluşturan
  // her uygulamada uygulama içi silme şart. Gerçek silme sunucuda
  // (supabase/functions/delete-account) yapılıyor; burada sadece onay alınıyor.
  function handleDeleteAccount() {
    Alert.alert(
      _t("Hesabını sil"),
      _t(
        "Hesabın, profilin ve bulut yedeğin kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nBu cihazdaki oyun ilerlemen (seviye, seri, ansiklopedi) silinmez — sadece buluttaki hesabın kaldırılır."
      ),
      [
        { text: _t("Vazgeç"), style: "cancel" },
        {
          text: _t("Hesabımı sil"),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError("");
            setInfo("");
            const { error: e } = await deleteAccount();
            setBusy(false);
            if (e) {
              setError(_t("Hesap silinemedi: ") + (e.message || _t("bilinmeyen hata")));
              return;
            }
            setUser(null);
            setCloudProfile(null);
            setEmail("");
            setPassword("");
            setInfo(_t("Hesabın silindi."));
          },
        },
      ]
    );
  }

  async function handlePickColor(hex) {
    if (!user) return;
    setCloudProfile((prev) => (prev ? { ...prev, avatar_color: hex } : prev));
    await updateAvatarColor(user.id, hex);
  }

  if (checking) {
    return (
      <GameBackground style={styles.container}>
        <BackButton onPress={onBack} confirm={false} />
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
      </GameBackground>
    );
  }

  return (
    <GameBackground style={styles.container}>
      <KlavyeAlani style={{ flex: 1 }}>
        <KlavyeScroll contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <BackButton onPress={onBack} confirm={false} />
          <Text style={styles.title}>{_t("Hesabım")}</Text>

          {!user ? (
            <>
              <Text style={styles.bodyMuted}>{_t(
                "Hesabın olmadan da her şey cihazında normal çalışmaya devam eder. Hesap açarsan seviyeni ve ilerlemeni bulutta yedekleyip başka bir cihazda da görebilirsin."
              )}</Text>

              <View style={styles.tabRow}>
                <SoundPressable
                  style={[styles.tabBtn, authMode === "signin" && styles.tabBtnActive]}
                  onPress={() => { setAuthMode("signin"); setSifirlama(null); setError(""); setInfo(""); }}
                >
                  <Text style={[styles.tabBtnText, authMode === "signin" && styles.tabBtnTextActive]}>{_t("Giriş Yap")}</Text>
                </SoundPressable>
                <SoundPressable
                  style={[styles.tabBtn, authMode === "signup" && styles.tabBtnActive]}
                  onPress={() => { setAuthMode("signup"); setSifirlama(null); setError(""); setInfo(""); }}
                >
                  <Text style={[styles.tabBtnText, authMode === "signup" && styles.tabBtnTextActive]}>{_t("Kayıt Ol")}</Text>
                </SoundPressable>
              </View>

              {sifirlama ? (
              <View style={styles.card}>
                <Text style={styles.sifirlamaBaslik}>{_t("Şifreni yenile")}</Text>
                <Text style={styles.sifirlamaAciklama}>
                  {sifirlama === "eposta"
                    ? _t("Hesabının e-posta adresini yaz, sana bir kod gönderelim.")
                    : _t("E-postadaki kodu ve yeni şifreni yaz.")}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={_t("E-posta")}
                  placeholderTextColor={COLORS.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={sifirlama === "eposta"}
                  style={[styles.input, sifirlama !== "eposta" && { opacity: 0.6 }]}
                />
                {sifirlama === "kod" ? (
                  <>
                    <TextInput
                      value={kod}
                      onChangeText={setKod}
                      placeholder={_t("Kod")}
                      placeholderTextColor={COLORS.textFaint}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={10}
                      style={[styles.input, { marginTop: SPACING.sm, letterSpacing: 4 }]}
                    />
                    <TextInput
                      value={yeniSifre}
                      onChangeText={setYeniSifre}
                      placeholder={_t("Yeni şifre")}
                      placeholderTextColor={COLORS.textFaint}
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      style={[styles.input, { marginTop: SPACING.sm }]}
                    />
                  </>
                ) : null}
                {!!error && <Text style={styles.errorText}>{error}</Text>}
                {!!info && <Text style={styles.infoText}>{info}</Text>}
                <SoundPressable style={styles.primaryBtn} onPress={sifirlama === "eposta" ? kodGonder : sifreyiYenile} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={COLORS.accentDark} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{sifirlama === "eposta" ? _t("Kod gönder") : _t("Şifreyi yenile")}</Text>
                  )}
                </SoundPressable>
                {sifirlama === "kod" ? (
                  <SoundPressable style={styles.linkBtn} onPress={kodGonder} disabled={busy} hitSlop={8}>
                    <Text style={styles.linkText}>{_t("Kodu tekrar gönder")}</Text>
                  </SoundPressable>
                ) : null}
                <SoundPressable style={styles.linkBtn} onPress={sifirlamayiKapat} disabled={busy} hitSlop={8}>
                  <Text style={styles.linkText}>{_t("Girişe dön")}</Text>
                </SoundPressable>
              </View>
              ) : (
              <View style={styles.card}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={_t("E-posta")}
                  placeholderTextColor={COLORS.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={_t("Şifre")}
                  placeholderTextColor={COLORS.textFaint}
                  secureTextEntry
                  style={[styles.input, { marginTop: SPACING.sm }]}
                />
                {!!error && <Text style={styles.errorText}>{error}</Text>}
                {!!info && <Text style={styles.infoText}>{info}</Text>}
                <SoundPressable style={styles.primaryBtn} onPress={handleSubmit} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={COLORS.accentDark} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{authMode === "signup" ? _t("Kayıt Ol") : _t("Giriş Yap")}</Text>
                  )}
                </SoundPressable>
                {authMode === "signin" ? (
                  <SoundPressable style={styles.linkBtn} onPress={sifirlamayiAc} disabled={busy} hitSlop={8}>
                    <Text style={styles.linkText}>{_t("Şifremi unuttum")}</Text>
                  </SoundPressable>
                ) : null}
              </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.avatarWrap}>
                <SoundPressable onPress={handlePickPhoto} disabled={uploadingPhoto}>
                  {cloudProfile?.avatar_url ? (
                    <Image source={{ uri: cloudProfile.avatar_url }} style={styles.avatarPhoto} contentFit="cover" transition={150} />
                  ) : (
                    <View style={[styles.avatarCircle, { backgroundColor: cloudProfile?.avatar_color || COLORS.accent }]}>
                      <Text style={styles.avatarLetter}>
                        {(cloudProfile?.display_name || user.email || "?").trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.avatarEditBadge}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={COLORS.accentDark} />
                    ) : (
                      <Ionicons name="camera" size={14} color={COLORS.accentDark} />
                    )}
                  </View>
                </SoundPressable>
                <Text style={styles.emailText}>{user.email}</Text>
                {localXp && <Text style={styles.levelText}>{_t("Seviye")}{" "}{localXp.level}</Text>}
              </View>

              <Text style={styles.sectionLabel}>{_t("Avatar Rengi")}{" "}<Text style={{ color: COLORS.textMuted, textTransform: "none", letterSpacing: 0 }}>{_t("(fotoğraf yoksa kullanılır)")}</Text>
              </Text>
              <View style={styles.colorRow}>
                {AVATAR_COLORS.map((hex) => (
                  <SoundPressable
                    key={hex}
                    onPress={() => handlePickColor(hex)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: hex },
                      cloudProfile?.avatar_color === hex && styles.colorSwatchActive,
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>{_t("Görünen İsim")}</Text>
              <View style={styles.nameRow}>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={_t("İsim")}
                  placeholderTextColor={COLORS.textFaint}
                  style={[styles.input, { flex: 1 }]}
                />
                <SoundPressable style={styles.saveBtn} onPress={handleSaveName}>
                  <Ionicons name="checkmark" size={20} color={COLORS.accentDark} />
                </SoundPressable>
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!info && <Text style={styles.infoText}>{info}</Text>}

              <SoundPressable style={styles.signOutBtn} onPress={handleSignOut} disabled={busy}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
                <Text style={styles.signOutText}>{_t("Çıkış Yap")}</Text>
              </SoundPressable>

              <SoundPressable style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={busy}>
                <Text style={styles.deleteText}>{_t("Hesabımı kalıcı olarak sil")}</Text>
              </SoundPressable>
            </>
          )}
        </KlavyeScroll>
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50, paddingHorizontal: SPACING.xl },
  title: { ...TYPE.h1, marginTop: SPACING.md, marginBottom: SPACING.md },
  bodyMuted: { ...TYPE.bodyMuted, marginBottom: SPACING.xl },
  sectionLabel: { ...TYPE.caption, textTransform: "uppercase", letterSpacing: 1, fontWeight: "800", marginBottom: SPACING.sm, marginTop: SPACING.lg },

  tabRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  tabBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderColor: COLORS.accent, backgroundColor: "#1F5E3B" },
  tabBtnText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
  tabBtnTextActive: { color: COLORS.accent },

  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.accentDark, fontWeight: "900", fontSize: 14, textTransform: "uppercase" },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: SPACING.sm, textAlign: "center" },
  infoText: { color: COLORS.accent, fontSize: 12, marginTop: SPACING.sm, textAlign: "center" },
  linkBtn: { alignSelf: "center", marginTop: SPACING.md, paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  sifirlamaBaslik: { color: COLORS.text, fontSize: 17, fontWeight: "900", marginBottom: 4 },
  sifirlamaAciklama: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", marginBottom: SPACING.md, lineHeight: 18 },

  avatarWrap: { alignItems: "center", marginBottom: SPACING.md },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm },
  avatarPhoto: { width: 72, height: 72, borderRadius: 36, marginBottom: SPACING.sm, backgroundColor: COLORS.card },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  avatarLetter: { fontSize: 30, fontWeight: "900", color: COLORS.accentDark },
  emailText: { ...TYPE.body, fontWeight: "700" },
  levelText: { ...TYPE.caption, marginTop: 2 },

  colorRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: COLORS.text },

  nameRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  saveBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  deleteBtn: { alignSelf: "center", marginTop: SPACING.lg, paddingVertical: 10, paddingHorizontal: 16 },
  deleteText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  signOutBtn: {
    marginTop: SPACING.xxl,
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderColor: COLORS.danger,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  signOutText: { color: COLORS.danger, fontWeight: "800", fontSize: 14 },
});
