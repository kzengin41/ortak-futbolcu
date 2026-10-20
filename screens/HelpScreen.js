import { _t } from "../lib/dil";
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, LayoutAnimation } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import BackButton from "../components/BackButton";
import SoundPressable from "../components/SoundPressable";
import { COLORS, MODE_COLORS, SPACING, RADIUS, TYPE, SHADOW, yumusakKaro } from "../lib/theme";

// 4 Eylül 2026 (Kerem ekran görüntüsü: "setLayoutAnimationEnabledExperimental
// is currently a no-op in the New Architecture" konsol uyarısı) — bu satır
// ESKİ mimaride Android'de LayoutAnimation'ı açmak için GEREKLİYDİ, ama Yeni
// Mimari'de (New Architecture) LayoutAnimation zaten varsayılan olarak açık
// ve bu çağrı HİÇBİR ŞEY YAPMIYOR; sadece her açılışta uyarı basıyordu.
// Kaldırıldı — aşağıdaki LayoutAnimation.configureNext çağrısı çalışmaya
// devam ediyor.

// İçerik, Oyna ekranındaki TÜM modlar + online + ansiklopedi ile birebir eşleşir.
// (26 Eylül 2026: 5 Kulüp, Futbolcu XOX ve Günün Bulmacası eklendi — eskiden
//  bu üçü menüde vardı ama burada anlatılmıyordu.)
// Her kartın rengi o modun HomeScreen'deki rengiyle aynı (MODE_COLORS) — kullanıcı
// menüde gördüğü rengi burada da görünce "aynı oyun" olduğunu hemen anlar.
const SECTIONS = [
  {
    key: "teamTeam",
    icon: "shield-checkmark",
    title: _t("Ortak Kulüp"),
    summary: _t("İki takımda da oynamış ortak futbolcuyu bul"),
    points: [
      _t(
        "Ekranda iki takım belirir. Amacın, kariyeri boyunca ikisinde de forma giymiş bir futbolcuyu söylemek."
      ),
      _t(
        "\"Takımı Sen Seç\" seçeneğinde bir takımı sen belirlersin, rakip takımı ise CPU otomatik atar."
      ),
      _t(
        "\"CPU Rastgele Atar\" seçeneğinde iki takımı da CPU seçer, sen sadece cevabı bulmaya odaklanırsın."
      ),
    ],
  },
  {
    key: "teamCountry",
    icon: "earth",
    title: _t("Kulüp & Ülke"),
    summary: _t("Bir ülke + bir kulüpte oynamış futbolcuyu bul"),
    points: [
      _t(
        "Ekranda bir ülke bayrağı ve bir kulüp belirir. Amacın, o ülkenin milli takımından olup aynı zamanda o kulüpte de forma giymiş bir futbolcunun adını söylemek."
      ),
      _t(
        "\"CPU Rastgele Atar\" modunda ülke ve kulübün ikisini de CPU seçer, sen sadece cevaba odaklanırsın."
      ),
      _t(
        "\"Sen Seç\" modunda taraflar dönüşümlü seçilir: bir tur sen bir ülke söylersin CPU o ülkeden birinin oynadığı bir kulüp bulur, sonraki tur sen bir kulüp söylersin CPU o kulüpte oynamış birinin ülkesini bulur."
      ),
    ],
  },
  {
    key: "letters",
    icon: "text",
    title: _t("İlk Harften Bul"),
    summary: _t("Verilen baş harflerle başlayan futbolcuyu bul"),
    points: [
      _t(
        "Ad ve soyadının baş harfleri verilir, bu harflerle başlayan bir futbolcu bulman gerekir."
      ),
      _t(
        "Harfleri kendin seçebilir ya da \"Rastgele Ata\" ile CPU'ya bıraktırabilirsin."
      ),
      _t(
        "Zincir modunda bir önceki cevabın son harfinden devam edilir — tıpkı isim zinciri gibi."
      ),
    ],
  },
  {
    key: "whoAmI",
    icon: "help-circle",
    title: _t("Kim Bu Futbolcu?"),
    summary: _t("İpuçlarıyla gizli futbolcuyu tahmin et"),
    points: [
      _t(
        "CPU gizli bir futbolcu tutar; mevki, ülke, kulüp gibi ipuçları sırayla açılır."
      ),
      _t("Ne kadar az ipuçla doğru tahmin edersen o kadar yüksek puan kazanırsın."),
    ],
  },
  {
    key: "training",
    icon: "flash",
    title: _t("Hızlı Antrenman"),
    summary: _t("4 şıklı, seri cevaplamaca (sadece offline)"),
    points: [
      _t("CPU iki takım atar, 4 oyuncu ismi arasından doğru olanı seçmen gerekir."),
      _t(
        "Doğru cevap +1, yanlış cevap −1 puan; cevap verince hemen yeni tur başlar."
      ),
      _t("Isınma ve pratik için idealdir, internet bağlantısı gerekmez."),
    ],
  },
  {
    key: "hotSeat",
    icon: "phone-portrait",
    title: _t("Yanımdakilerle (aynı telefon)"),
    summary: _t("Ortak Kulüp, 5 Kulüp ve XOX'ta rakip olarak \"Yanımdaki\"yi seç"),
    points: [
      _t(
        "Tüm Modlar'da Ortak Kulüp, 5 Kulüp ya da XOX'a dokununca önce rakibini seçersin: CPU, Yanımdaki ya da Online."
      ),
      _t(
        "Ortak Kulüp'te 2 kişide telefon ortadan ikiye bölünür — her oyuncu kendi tarafından oynar."
      ),
      _t(
        "Sunucu Modu: 2–6 kişi. Telefonu tutan kulüpleri okur, ilk bağıranın adına dokunur, ekrandaki cevaplara bakıp ✓/✗ der."
      ),
      _t(
        "Cevabı ilk bilen BİLİYORUM düğmesine basar ve sesli söyler; doğruysa puanı alır."
      ),
      _t("Sesli mod desteklenir: cevabını mikrofonla da söyleyebilirsin."),
    ],
  },
  {
    key: "online",
    icon: "wifi",
    title: _t("Online Lobi"),
    summary: _t("Farklı telefonlardan arkadaşınla oyna"),
    points: [
      _t(
        "Bir oda kurup arkadaşını davet edersin, ya da paylaşılan bir odaya katılırsın."
      ),
      _t(
        "Aynı mod çeşitleri (Takım-Takım, Kim Bu?, Baş Harf) online üzerinden de oynanabilir."
      ),
    ],
  },
  {
    key: "encyclopedia",
    icon: "book",
    title: _t("Ansiklopedi"),
    summary: _t("Oyuncuları ve kariyerlerini incele"),
    points: [
      _t(
        "Oyun dışı bir keşif ekranı — dilediğin futbolcuyu arayıp kulüp geçmişini görebilirsin."
      ),
      _t("Puan ya da süre yok; sadece bilgi almak için kullanılır."),
    ],
  },
  // 26 Eylül 2026 — DENETİM BULGUSU: bu üç mod ana menüde duruyordu ama
  // "Nasıl Oynanır?" ekranında HİÇ anlatılmıyordu. Yeni kullanıcı 5 Kulüp,
  // XOX ve Günün Bulmacası'nın kuralını hiçbir yerden öğrenemiyordu.
  {
    key: "fiveClubs",
    icon: "list",
    title: _t("5 Kulüp"),
    summary: _t("Bir futbolcunun oynadığı beş kulübü say"),
    points: [
      _t(
        "Ekranda bir futbolcu belirir. Amacın, kariyerinde forma giydiği kulüplerden beşini saymak."
      ),
      _t(
        "Her doğru kulüp puan kazandırır; aynı kulübü iki kez söylemek puan getirmez."
      ),
      _t(
        "İki kişilik oynanışta rakibin söylediği kulübü tekrar söylemek de puan kazandırmaz — sırayla farklı kulüpler bulmanız gerekir."
      ),
      _t(
        "Bir kulübü kim bulduysa kulübün köşesinde \"1\" ya da \"2\" rozeti çıkar; ikiniz de bulduysanız iki rozet birlikte görünür."
      ),
    ],
  },
  {
    key: "xox",
    icon: "grid",
    title: _t("Futbolcu XOX"),
    summary: _t("3x3 ızgarada kareyi ortak futbolcuyla al"),
    points: [
      _t(
        "Izgaranın üç satırında ve üç sütununda birer kulüp vardır. Bir kareyi almak için, o karenin kesiştiği İKİ kulüpte de oynamış bir futbolcu söylersin."
      ),
      _t("Doğru cevap kareyi senin adına işaretler; bilemezsen sıra rakibe geçer."),
      _t("Aynı futbolcuyu birden fazla karede kullanabilirsin — kısıtlama yoktur."),
      _t("Üçlü sırayı (yatay, dikey ya da çapraz) tamamlayan kazanır."),
      _t(
        "Beş zorluk seviyesi var: kolay seviyelerde tanıdık kulüpler ve bol cevaplı kareler gelir, zor seviyelerde kareler 3-4 cevaba kadar düşer."
      ),
      _t("CPU'ya karşı ya da aynı telefonda arkadaşına karşı oynayabilirsin."),
    ],
  },
  {
    key: "dailyPuzzle",
    icon: "calendar",
    title: _t("Günün Bulmacası"),
    summary: _t("Her gün tek bir soru, herkese aynı"),
    points: [
      _t(
        "Her gün iki kulüp belirir ve ikisinde de oynamış bir futbolcuyu bulman istenir."
      ),
      _t(
        "Soru o gün uygulamayı açan HERKESTE aynıdır — arkadaşlarınla karşılaştırabilirsin."
      ),
      _t(
        "Sınırlı deneme hakkın var. Gün içinde çıkıp tekrar girsen bile ilerlemen kaybolmaz."
      ),
      _t("Gece yarısı yeni bir soru gelir; geçmiş günlerin sorusuna dönülemez."),
      _t(
        "Sonucu paylaşırken cevap sızdırılmaz — sadece kaç denemede bulduğun görünür."
      ),
    ],
  },
];

export default function HelpScreen({ onBack, onSources, onKarsilama }) {
  const [openKey, setOpenKey] = useState(SECTIONS[0].key);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <GameBackground style={styles.container}>
      <BackButton onPress={onBack} confirm={false} />
      <Text style={styles.title}>{_t("Nasıl Oynanır?")}</Text>
      <Text style={styles.subtitle}>{_t("Bir moda dokun, kurallarını gör.")}</Text>

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
                <View style={[styles.iconWrap, yumusakKaro(modeColor.main)]}>
                  <Ionicons name={section.icon} size={20} color={modeColor.main} />
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
        {/* Paket 37 — karşılama (canlı deneme turu) yeniden izlenebilsin */}
        {onKarsilama ? (
          <SoundPressable onPress={onKarsilama} style={styles.kaynakLink} hitSlop={10} accessibilityLabel={_t("Tanıtımı tekrar izle")}>
            <Ionicons name="play-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.kaynakLinkText}>{_t("Tanıtımı ve deneme turunu tekrar izle")}</Text>
          </SoundPressable>
        ) : null}
        {onSources ? (
          <SoundPressable onPress={onSources} style={styles.kaynakLink} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.kaynakLinkText}>{_t("İçerik kaynakları ve iletişim")}</Text>
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
