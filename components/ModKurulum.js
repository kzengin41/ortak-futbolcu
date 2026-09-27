import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "./GameBackground";
import BackButton from "./BackButton";
import SoundPressable from "./SoundPressable";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW } from "../lib/theme";

// ============================================================================
// ORTAK MOD KURULUM EKRANI — 27 Eylül 2026
//
// Kerem: "her mod için zorluk ayarı olmalı. süre ayarı olmalı. her moddaki
// mimari dizayn aynı olmalı."
//
// Eskiden her modun kurulum ekranı ayrı ayrı elle yazılmıştı: bazısında
// zorluk 1-10 arası "−/+" düğmesi, bazısında 3 düğme, bazısında 5 satırlık
// liste; süre bazısında vardı bazısında yoktu; renklerin çoğu sabit yazılmış
// olduğu için seçilen tema kurulum ekranlarına hiç uygulanmıyordu. Artık
// BÜTÜN modlar aynı parçaları, aynı sırayla kullanıyor:
//
//   Başlık + kısa açıklama
//   RAKİP (varsa)  →  ZORLUK  →  SÜRE  →  mod'a özel ayarlar  →  KAPSAM
//   BAŞLA
//
// Renkler temadan (COLORS) okunuyor, vurgu rengi modun kendi rengi.
// ============================================================================

// Standart 5 kademe. Her mod kendi motoruna çevirir (bkz. zorlukMotoru).
export const STANDART_ZORLUKLAR = [
  { id: 1, etiket: "Çok Kolay", aciklama: "Sadece efsaneler ve süper yıldızlar" },
  { id: 2, etiket: "Kolay", aciklama: "Herkesin tanıdığı isimler" },
  { id: 3, etiket: "Orta", aciklama: "Büyük liglerin bilinen oyuncuları" },
  { id: 4, etiket: "Zor", aciklama: "Daha az bilinen oyuncular da çıkar" },
  { id: 5, etiket: "Çok Zor", aciklama: "Obskür isimler, hızlı ve isabetli CPU" },
];
export const VARSAYILAN_ZORLUK_ID = 3;

// 1-10 arası çalışan eski motorlar (tur havuzu + CPU hızı/isabeti) için.
const MOTOR_KARSILIGI = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 10 };
export function zorlukMotoru(id) {
  return MOTOR_KARSILIGI[id] || 5;
}

// ---------------------------------------------------------------- iskelet
export default function ModKurulum({
  baslik,
  aciklama,
  vurgu,
  onGeri,
  onBasla,
  baslaEtiketi = "BAŞLA",
  baslaYukleniyor = false,
  baslaDevreDisi = false,
  children,
}) {
  const renk = vurgu?.main || COLORS.accent;
  return (
    <GameBackground style={styles.kap}>
      {onGeri ? <BackButton onPress={onGeri} /> : null}
      <ScrollView
        contentContainerStyle={styles.icerik}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.baslik]}>{baslik}</Text>
        <View style={[styles.cizgi, { backgroundColor: renk }]} />
        {aciklama ? <Text style={styles.aciklama}>{aciklama}</Text> : null}

        {children}

        <SoundPressable
          style={[styles.basla, (baslaDevreDisi || baslaYukleniyor) && { opacity: 0.6 }]}
          onPress={onBasla}
          disabled={baslaDevreDisi || baslaYukleniyor}
        >
          {baslaYukleniyor ? (
            <ActivityIndicator color={COLORS.accentDark} />
          ) : (
            <Text style={styles.baslaYazi}>{baslaEtiketi}</Text>
          )}
        </SoundPressable>
      </ScrollView>
    </GameBackground>
  );
}

export function KurulumBolum({ baslik, not, notHata = false, children, vurgu }) {
  return (
    <View style={styles.bolum}>
      <Text style={[styles.bolumBaslik, vurgu && { color: vurgu.main }]}>{baslik}</Text>
      {children}
      {not ? <Text style={[styles.not, notHata && { color: COLORS.danger }]}>{not}</Text> : null}
    </View>
  );
}

// Yan yana seçenek düğmeleri (rakip, galibiyet sınırı, cevap yöntemi...).
// secenekler: [{ deger, etiket, ikon? }]
export function SecimCipleri({ secenekler, secili, onSec }) {
  return (
    <View style={styles.cipSatir}>
      {secenekler.map((s) => {
        const aktif = secili === s.deger;
        return (
          <SoundPressable
            key={String(s.deger)}
            style={[styles.cip, aktif && styles.cipAktif]}
            onPress={() => onSec(s.deger)}
          >
            {s.ikon ? (
              <Ionicons name={s.ikon} size={18} color={aktif ? COLORS.accentDark : COLORS.accent} />
            ) : null}
            <Text style={[styles.cipYazi, aktif && styles.cipYaziAktif]} numberOfLines={2}>
              {s.etiket}
            </Text>
          </SoundPressable>
        );
      })}
    </View>
  );
}

// Zorluk listesi — her satırda kademe noktaları + ad + açıklama.
export function ZorlukSecici({ seviyeler = STANDART_ZORLUKLAR, secili, onSec }) {
  const toplam = seviyeler.length;
  return (
    <View style={styles.zorlukListe}>
      {seviyeler.map((z, sira) => {
        const aktif = secili === z.id;
        return (
          <SoundPressable
            key={String(z.id)}
            style={[styles.zorlukSatir, aktif && styles.cipAktif]}
            onPress={() => onSec(z.id)}
          >
            <View style={styles.noktalar}>
              {Array.from({ length: toplam }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.nokta,
                    i <= sira && { backgroundColor: aktif ? COLORS.accentDark : COLORS.accent },
                  ]}
                />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.zorlukEtiket, aktif && styles.cipYaziAktif]}>{z.etiket}</Text>
              {z.aciklama ? (
                <Text style={[styles.zorlukAciklama, aktif && { color: COLORS.accentDark }]}>{z.aciklama}</Text>
              ) : null}
            </View>
            {aktif ? <Ionicons name="checkmark-circle" size={18} color={COLORS.accentDark} /> : null}
          </SoundPressable>
        );
      })}
    </View>
  );
}

// Süre seçimi: hazır seçenekler + "Özel" (elle saniye) + isteğe bağlı "Süresiz".
// deger: saniye (sayı) ya da null (süresiz).
export function SureSecici({
  secenekler,
  deger,
  onDegis,
  asgari = 5,
  azami = 300,
  suresizVar = false,
  aciklama,
}) {
  const hazirMi = deger === null ? suresizVar : secenekler.includes(deger);
  const [ozelAcik, setOzelAcik] = useState(!hazirMi);
  const [metin, setMetin] = useState(!hazirMi && deger ? String(deger) : "");

  const sayi = parseInt(metin, 10);
  const gecersiz = ozelAcik && (!Number.isFinite(sayi) || sayi < asgari || sayi > azami);

  function ozelYaz(t) {
    const temiz = t.replace(/[^0-9]/g, "").slice(0, 3);
    setMetin(temiz);
    const n = parseInt(temiz, 10);
    if (Number.isFinite(n)) onDegis(Math.min(azami, Math.max(asgari, n)));
  }

  const liste = [
    ...secenekler.map((s) => ({ deger: s, etiket: `${s} sn` })),
    ...(suresizVar ? [{ deger: "suresiz", etiket: "Süresiz" }] : []),
    { deger: "ozel", etiket: "Özel" },
  ];
  const secili = ozelAcik ? "ozel" : deger === null ? "suresiz" : deger;

  let not = aciklama || null;
  if (ozelAcik && gecersiz) {
    not = `En az ${asgari}, en fazla ${azami} saniye olabilir — ${deger} sn ile başlayacak.`;
  } else if (ozelAcik && deger) {
    not = `${deger} saniye.` + (aciklama ? " " + aciklama : "");
  }

  return (
    <View>
      <SecimCipleri
        secenekler={liste}
        secili={secili}
        onSec={(d) => {
          if (d === "ozel") {
            setOzelAcik(true);
            const n = parseInt(metin, 10);
            if (Number.isFinite(n)) onDegis(Math.min(azami, Math.max(asgari, n)));
            return;
          }
          setOzelAcik(false);
          onDegis(d === "suresiz" ? null : d);
        }}
      />
      {ozelAcik ? (
        <View style={styles.ozelSatir}>
          <TextInput
            style={styles.ozelGirdi}
            value={metin}
            onChangeText={ozelYaz}
            keyboardType="number-pad"
            placeholder={`en az ${asgari}`}
            placeholderTextColor={COLORS.textFaint}
            maxLength={3}
          />
          <Text style={styles.ozelBirim}>saniye</Text>
        </View>
      ) : null}
      {not ? <Text style={[styles.not, gecersiz && { color: COLORS.danger }]}>{not}</Text> : null}
    </View>
  );
}

// Lig / kapsam seçimi düğmesi (modal ekranın kendisinde duruyor).
export function KapsamDugmesi({ etiket, onPress }) {
  return (
    <SoundPressable style={styles.kapsam} onPress={onPress}>
      <Ionicons name="earth" size={18} color={COLORS.accent} />
      <Text style={styles.kapsamYazi} numberOfLines={1}>{etiket}</Text>
      <Text style={styles.kapsamDegis}>Değiştir ›</Text>
    </SoundPressable>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xxl },
  icerik: { paddingBottom: SPACING.xxxl, paddingTop: SPACING.sm },
  baslik: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.md },
  cizgi: { alignSelf: "center", width: 48, height: 4, borderRadius: 2, marginTop: SPACING.sm },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.md, marginBottom: SPACING.sm },

  bolum: { marginTop: SPACING.lg },
  bolumBaslik: { ...TYPE.eyebrow, fontSize: 11, marginBottom: SPACING.sm },
  not: { ...TYPE.caption, marginTop: SPACING.sm },

  cipSatir: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cip: {
    flexGrow: 1, flexBasis: 64, minHeight: 46,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
  },
  cipAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  cipYazi: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", textAlign: "center" },
  cipYaziAktif: { color: COLORS.accentDark },

  zorlukListe: { gap: SPACING.sm },
  zorlukSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 50,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  noktalar: { flexDirection: "row", gap: 3 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.cardBorder },
  zorlukEtiket: { ...TYPE.h3, fontSize: 14 },
  zorlukAciklama: { ...TYPE.caption, fontSize: 11, marginTop: 1 },

  ozelSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  ozelGirdi: {
    width: 96, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: 16, fontWeight: "800", textAlign: "center",
  },
  ozelBirim: { ...TYPE.bodyMuted },

  kapsam: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 50,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
  },
  kapsamYazi: { ...TYPE.body, fontWeight: "800", flex: 1 },
  kapsamDegis: { ...TYPE.caption, color: COLORS.accent, fontWeight: "800" },

  basla: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.lg,
    alignItems: "center", marginTop: SPACING.xl, ...SHADOW.card,
  },
  baslaYazi: { ...TYPE.button, fontSize: 17, color: COLORS.accentDark },
});
