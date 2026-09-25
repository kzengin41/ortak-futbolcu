import React from "react";
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
import { COLORS, SPACING, RADIUS, TYPE } from "../lib/theme";

// ============================================================================
// KAYNAKLAR — 12 Eylül 2026
//
// Uygulamadaki futbolcu fotoğrafları ve kariyer verisi açık kaynaklardan
// derlendi. Bu ekran kaynakları ve kaldırma talebi yolunu gösteriyor;
// gizlilik politikası da buraya işaret ediyor
// ("Profilim → Nasıl Oynanır → Kaynaklar").
//
// Öne çıkan bir yer değil, bilerek: Yardım ekranının altından açılıyor.
// Ama gerçekten var olması önemli — hem mağaza incelemeleri hem de bir hak
// sahibi geldiğinde muhatap bulunabilmesi için.
//
// E-POSTA ADRESİNİ DEĞİŞTİR: aşağıdaki ILETISIM sabiti hem burada hem
// PRIVACY_POLICY.md'de gerçek bir adres olmalı — kaldırma talebi gelirse
// ulaşılacak tek kanal bu.
// ============================================================================

const ILETISIM = "kzengin41@gmail.com";

const KAYNAKLAR = [
  {
    baslik: "Futbolcu fotoğrafları",
    maddeler: [
      "Fotoğrafların büyük bölümü Wikimedia Commons'tan derlenmiştir. Buradaki görsellerin çoğu Creative Commons (CC BY / CC BY-SA) lisanslıdır ve telif hakları kendi fotoğrafçılarına aittir.",
      "Bir kısmı TheSportsDB açık veri tabanından alınmıştır.",
      "Az sayıda fotoğraf uygulama sahibi tarafından ücretsiz kaynaklardan temin edilip eklenmiştir.",
    ],
  },
  {
    baslik: "Kulüp ve kariyer verisi",
    maddeler: [
      "Futbolcuların kulüp geçmişi, uyruk ve milli takım bilgileri Wikipedia'dan derlenmiştir.",
      "Kulüp amblemleri kullanılmamaktadır; uygulamadaki takım rozetleri kulüp renklerinden üretilen özgün görsellerdir.",
    ],
  },
];

export default function SourcesScreen({ onBack }) {
  const mailAc = () => {
    Linking.openURL(
      `mailto:${ILETISIM}?subject=${encodeURIComponent("3-2-1 Bitir İşi — içerik talebi")}`
    ).catch(() => {});
  };

  return (
    <GameBackground style={styles.container}>
      <BackButton onPress={onBack} confirm={false} text="Geri" />
      <Text style={styles.baslik}>Kaynaklar</Text>
      <Text style={styles.altBaslik}>İçeriğin nereden geldiği ve iletişim</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {KAYNAKLAR.map((bolum) => (
          <View key={bolum.baslik} style={styles.kart}>
            <Text style={styles.kartBaslik}>{bolum.baslik}</Text>
            {bolum.maddeler.map((m, i) => (
              <View key={i} style={styles.madde}>
                <View style={styles.nokta} />
                <Text style={styles.maddeYazi}>{m}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={[styles.kart, styles.kaldirmaKart]}>
          <Text style={styles.kartBaslik}>Kaldırma talebi</Text>
          <Text style={styles.maddeYazi}>
            Bir görselin veya bilginin hak sahibiysen ve uygulamadan kaldırılmasını
            istiyorsan bize yaz — talebini inceleyip ilgili içeriği kaldırıyoruz.
            Ayrıca bir fotoğrafın yanlış futbolcuya ait olduğunu fark edersen oyun
            içindeki "Bildir" düğmesini kullanabilirsin.
          </Text>
          <Pressable onPress={mailAc} style={styles.mailBtn} hitSlop={10}>
            <Ionicons name="mail-outline" size={16} color={COLORS.accentDark} />
            <Text style={styles.mailBtnYazi}>{ILETISIM}</Text>
          </Pressable>
        </View>

        <Text style={styles.feragat}>
          Bu uygulama hiçbir kulüp, lig, federasyon veya oyuncuyla resmi bağlantılı
          değildir. Kulüp ve oyuncu isimleri yalnızca tanımlama amacıyla kullanılmaktadır.
        </Text>
      </ScrollView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50, paddingHorizontal: SPACING.xl },
  baslik: { ...TYPE.h1, marginTop: SPACING.md },
  altBaslik: { ...TYPE.bodyMuted, marginBottom: SPACING.xl },
  kart: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  kaldirmaKart: { borderColor: COLORS.cta },
  kartBaslik: { ...TYPE.h3, marginBottom: SPACING.xs },
  madde: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  nokta: {
    width: 5, height: 5, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent, marginTop: 8,
  },
  maddeYazi: { ...TYPE.bodyMuted, flex: 1 },
  mailBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    alignSelf: "flex-start", marginTop: SPACING.sm,
    backgroundColor: COLORS.cta, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  mailBtnYazi: { color: COLORS.ctaDark, fontSize: 13, fontWeight: "900" },
  feragat: {
    ...TYPE.caption, color: COLORS.textFaint, textAlign: "center",
    marginTop: SPACING.lg, lineHeight: 17,
  },
});
