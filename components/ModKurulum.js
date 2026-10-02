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

// 27 Eylül 2026 (2. sürüm) — Kerem: "her mod için 10 üstünden zorluk". Bütün
// modlar artık 1-10 ölçeğini kullanıyor; her mod kendi motoruna çeviriyor
// (bkz. lib/modAyarlari.js ve ekranlardaki eşlemeler).
import { zorlukEtiketi } from "../lib/modAyarlari";

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
  onVarsayilanKaydet,
  children,
}) {
  const [kaydedildi, setKaydedildi] = useState(false);
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
        {onVarsayilanKaydet ? (
          <SoundPressable
            style={styles.varsayilanLink}
            onPress={async () => {
              await onVarsayilanKaydet();
              setKaydedildi(true);
              setTimeout(() => setKaydedildi(false), 2500);
            }}
          >
            <Ionicons name={kaydedildi ? "checkmark-circle" : "bookmark-outline"} size={15} color={COLORS.textMuted} />
            <Text style={styles.varsayilanYazi}>
              {kaydedildi ? "Kaydedildi — bu mod artık böyle açılacak" : "Bu ayarları bu modun varsayılanı yap"}
            </Text>
          </SoundPressable>
        ) : null}
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

// Birden fazla seçilebilen düğmeler (ör. Kim Bu'daki dönemler). En az `enAz`
// tanesi seçili kalır — son seçiliyi kaldırmaya izin verilmez.
export function CokluSecim({ secenekler, secililer, onDegis, enAz = 1 }) {
  return (
    <View style={styles.cipSatir}>
      {secenekler.map((s) => {
        const aktif = secililer.includes(s.deger);
        return (
          <SoundPressable
            key={String(s.deger)}
            style={[styles.cip, aktif && styles.cipAktif]}
            onPress={() => {
              if (aktif) {
                if (secililer.length <= enAz) return;
                onDegis(secililer.filter((x) => x !== s.deger));
              } else {
                onDegis([...secililer, s.deger]);
              }
            }}
          >
            <Ionicons
              name={aktif ? "checkbox" : "square-outline"}
              size={16}
              color={aktif ? COLORS.accentDark : COLORS.textMuted}
            />
            <Text style={[styles.cipYazi, aktif && styles.cipYaziAktif]} numberOfLines={2}>{s.etiket}</Text>
          </SoundPressable>
        );
      })}
    </View>
  );
}

// Zorluk: 1-10 arası, dokunulabilir 10 bölmeli çubuk + büyük etiket.
// aciklama: (z) => string — modun o seviyede ne yaptığını anlatan kısa metin.
export function ZorlukSecici({ deger, onDegis, aciklama }) {
  const z = deger || 5;
  return (
    <View>
      <View style={styles.zorlukUst}>
        <Text style={styles.zorlukSayi}>{z}<Text style={styles.zorlukOnda}> / 10</Text></Text>
        <Text style={styles.zorlukAd}>{zorlukEtiketi(z)}</Text>
      </View>
      <View style={styles.zorlukCubuk}>
        <SoundPressable
          style={styles.zorlukOk}
          onPress={() => onDegis(Math.max(1, z - 1))}
          accessibilityLabel="Zorluğu azalt"
        >
          <Ionicons name="remove" size={20} color={COLORS.text} />
        </SoundPressable>
        <View style={styles.zorlukBolmeler}>
          {Array.from({ length: 10 }).map((_, i) => {
            const dolu = i < z;
            return (
              <SoundPressable
                key={i}
                style={[styles.zorlukBolme, dolu && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }]}
                onPress={() => onDegis(i + 1)}
                accessibilityLabel={`Zorluk ${i + 1}`}
                hitSlop={{ top: 8, bottom: 8 }}
              />
            );
          })}
        </View>
        <SoundPressable
          style={styles.zorlukOk}
          onPress={() => onDegis(Math.min(10, z + 1))}
          accessibilityLabel="Zorluğu artır"
        >
          <Ionicons name="add" size={20} color={COLORS.text} />
        </SoundPressable>
      </View>
      {aciklama ? <Text style={styles.not}>{typeof aciklama === "function" ? aciklama(z) : aciklama}</Text> : null}
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
  bolumBaslik: { ...TYPE.eyebrow, fontSize: 12, marginBottom: SPACING.sm },
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

  zorlukUst: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: SPACING.sm },
  zorlukSayi: { ...TYPE.h1, fontSize: 30 },
  zorlukOnda: { ...TYPE.caption, fontSize: 14 },
  zorlukAd: { ...TYPE.h3, color: COLORS.accent },
  zorlukCubuk: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  zorlukOk: {
    width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
  },
  zorlukBolmeler: { flex: 1, flexDirection: "row", gap: 4 },
  zorlukBolme: {
    flex: 1, height: 26, borderRadius: 6,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
  },
  varsayilanLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.md, paddingVertical: SPACING.sm },
  varsayilanYazi: { ...TYPE.caption, textDecorationLine: "underline" },

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
