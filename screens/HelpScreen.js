import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
import SoundPressable from "../components/SoundPressable";
import { COLORS, MODE_COLORS, SPACING, RADIUS, TYPE, SHADOW } from "../lib/theme";

// 4 Eylül 2026 (Kerem ekran görüntüsü: "setLayoutAnimationEnabledExperimental
// is currently a no-op in the New Architecture" konsol uyarısı) — bu satır
// ESKİ mimaride Android'de LayoutAnimation'ı açmak için GEREKLİYDİ, ama Yeni
// Mimari'de (New Architecture) LayoutAnimation zaten varsayılan olarak açık
// ve bu çağrı HİÇBİR ŞEY YAPMIYOR; sadece her açılışta uyarı basıyordu.
// Kaldırıldı — aşağıdaki LayoutAnimation.configureNext çağrısı çalışmaya
// devam ediyor.

// İçerik, HomeScreen'deki gerçek 6 mod + online + ansiklopedi ile birebir eşleşir.
// Her kartın rengi o modun HomeScreen'deki rengiyle aynı (MODE_COLORS) — kullanıcı
// menüde gördüğü rengi burada da görünce "aynı oyun" olduğunu hemen anlar.
const SECTIONS = [
  {
    key: "teamTeam",
    icon: "shield-checkmark",
    title: "Ortak Kulüp",
    summary: "İki takımda da oynamış ortak futbolcuyu bul",
    points: [
      "Ekranda iki takım belirir. Amacın, kariyeri boyunca ikisinde de forma giymiş bir futbolcuyu söylemek.",
      "\"Takımı Sen Seç\" seçeneğinde bir takımı sen belirlersin, rakip takımı ise CPU otomatik atar.",
      "\"CPU Rastgele Atar\" seçeneğinde iki takımı da CPU seçer, sen sadece cevabı bulmaya odaklanırsın.",
    ],
  },
  {
    key: "teamCountry",
    icon: "earth",
    title: "Kulüp & Ülke",
    summary: "Bir ülke + bir kulüpte oynamış futbolcuyu bul",
    points: [
      "Ekranda bir ülke bayrağı ve bir kulüp belirir. Amacın, o ülkenin milli takımından olup aynı zamanda o kulüpte de forma giymiş bir futbolcunun adını söylemek.",
      "\"CPU Rastgele Atar\" modunda ülke ve kulübün ikisini de CPU seçer, sen sadece cevaba odaklanırsın.",
      "\"Sen Seç\" modunda taraflar dönüşümlü seçilir: bir tur sen bir ülke söylersin CPU o ülkeden birinin oynadığı bir kulüp bulur, sonraki tur sen bir kulüp söylersin CPU o kulüpte oynamış birinin ülkesini bulur.",
    ],
  },
  {
    key: "letters",
    icon: "text",
    title: "İlk Harften Bul",
    summary: "Verilen baş harflerle başlayan futbolcuyu bul",
    points: [
      "Ad ve soyadının baş harfleri verilir, bu harflerle başlayan bir futbolcu bulman gerekir.",
      "Harfleri kendin seçebilir ya da \"Rastgele Ata\" ile CPU'ya bıraktırabilirsin.",
      "Zincir modunda bir önceki cevabın son harfinden devam edilir — tıpkı isim zinciri gibi.",
    ],
  },
  {
    key: "whoAmI",
    icon: "help-circle",
    title: "Kim Bu Futbolcu?",
    summary: "İpuçlarıyla gizli futbolcuyu tahmin et",
    points: [
      "CPU gizli bir futbolcu tutar; mevki, ülke, kulüp gibi ipuçları sırayla açılır.",
      "Ne kadar az ipuçla doğru tahmin edersen o kadar yüksek puan kazanırsın.",
    ],
  },
  {
    key: "training",
    icon: "flash",
    title: "Hızlı Antrenman",
    summary: "4 şıklı, seri cevaplamaca (sadece offline)",
    points: [
      "CPU iki takım atar, 4 oyuncu ismi arasından doğru olanı seçmen gerekir.",
      "Doğru cevap +1, yanlış cevap −1 puan; cevap verince hemen yeni tur başlar.",
      "Isınma ve pratik için idealdir, internet bağlantısı gerekmez.",
    ],
  },
  {
    key: "hotSeat",
    icon: "phone-portrait",
    title: "Tek Telefon 2 Kişi",
    summary: "Ekran ikiye bölünür, ilk buzz'layan kazanır",
    points: [
      "CPU iki takım atar, telefon ortadan ikiye bölünür — her oyuncu kendi tarafından oynar.",
      "Cevabı ilk bilen tarafa \"buzz\" basar ve sesli söyler; doğruysa puanı alır.",
      "Sesli mod desteklenir: cevabını mikrofonla da söyleyebilirsin.",
    ],
  },
  {
    key: "online",
    icon: "wifi",
    title: "Online Lobi",
    summary: "Farklı telefonlardan arkadaşınla oyna",
    points: [
      "Bir oda kurup arkadaşını davet edersin, ya da paylaşılan bir odaya katılırsın.",
      "Aynı mod çeşitleri (Takım-Takım, Kim Bu?, Baş Harf) online üzerinden de oynanabilir.",
    ],
  },
  {
    key: "encyclopedia",
    icon: "book",
    title: "Ansiklopedi",
    summary: "Oyuncuları ve kariyerlerini incele",
    points: [
      "Oyun dışı bir keşif ekranı — dilediğin futbolcuyu arayıp kulüp geçmişini görebilirsin.",
      "Puan ya da süre yok; sadece bilgi almak için kullanılır.",
    ],
  },
];

export default function HelpScreen({ onBack, onSources }) {
  const [openKey, setOpenKey] = useState(SECTIONS[0].key);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <GameBackground style={styles.container}>
      <BackButton onPress={onBack} confirm={false} />
      <Text style={styles.title}>Nasıl Oynanır?</Text>
      <Text style={styles.subtitle}>Bir moda dokun, kurallarını gör.</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => {
          const isOpen = openKey === section.key;
          const modeColor = MODE_COLORS[section.key] || MODE_COLORS.teamTeam;
          return (
            <View
              key={section.key}
              style={[styles.card, isOpen && { borderColor: modeColor.main }]}
            >
              <SoundPressable onPress={() => toggle(section.key)} style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: modeColor.main }]}>
                  <Ionicons name={section.icon} size={20} color={modeColor.dark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{section.title}</Text>
                  <Text style={styles.cardSummary}>{section.summary}</Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.textMuted}
                />
              </SoundPressable>

              {isOpen && (
                <View style={styles.cardBody}>
                  {section.points.map((point, i) => (
                    <View key={i} style={styles.pointRow}>
                      <View style={[styles.bullet, { backgroundColor: modeColor.main }]} />
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {onSources ? (
          <SoundPressable onPress={onSources} style={styles.kaynakLink} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.kaynakLinkText}>İçerik kaynakları ve iletişim</Text>
          </SoundPressable>
        ) : null}
      </ScrollView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kaynakLink: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    alignSelf: "center", marginTop: SPACING.xl, paddingVertical: 10, paddingHorizontal: 14,
  },
  kaynakLinkText: { ...TYPE.caption, textDecorationLine: "underline" },
  container: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  title: { ...TYPE.h1, marginBottom: 2 },
  subtitle: { ...TYPE.bodyMuted, marginBottom: SPACING.lg },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
    ...SHADOW.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...TYPE.h3, marginBottom: 2 },
  cardSummary: { ...TYPE.caption },
  cardBody: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  pointRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  pointText: { ...TYPE.body, flex: 1 },
});
