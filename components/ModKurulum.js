import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { zorlukEtiketi, useOyunBilgisi, ayarIstegiAl, useAyarIstegi } from "../lib/modAyarlari";

// ---------------------------------------------------------------- iskelet
// Paket 24 (12 Ekim 2026, Kerem: "ayarsız başlatacağız derken bir problem var.
// ayar ekranı 1 sn görünüyor ve kayboluyor. başlarken hızlı başla / eşleştirme
// ayarları diye 2 buton olsun. ayar ekranı da aşırı karmaşık şu an. görüntü
// olarak sade ve basit olması lazım.")
// KÖK NEDEN: "kurulumsuz başlangıç" (4 Ekim) kurulum ekranını önce ÇİZİP
// ayarlar yüklenince ~0,1-1 sn sonra oyunu kendiliğinden başlatıyordu; ekran
// bir an görünüp kayboluyordu. Otomatik başlatma kaldırıldı. Artık iki aşama:
//   1) GİRİŞ  — mod adı, kısa açıklama, kayıtlı ayarların özeti ve iki düğme:
//               HIZLI BAŞLA (kayıtlı ayarlarla hemen) · MAÇ AYARLARI
//   2) AYARLAR — sade liste: küçük başlık + seçim düğmeleri. Uzun açıklamalar
//               başlığın yanındaki (i) düğmesinin arkasında. Altta BAŞLA.
// Oyun sırasında ⚙ ile gelinirse doğrudan 2. aşama açılır.
// `girisYok`: giriş aşaması olmadan doğrudan ayarlar (ör. Sunucu: adlar şart).
export default function ModKurulum({
  modId,
  baslik,
  aciklama,
  vurgu,
  onGeri,
  onBasla,
  baslaEtiketi = "BAŞLA",
  baslaYukleniyor = false,
  baslaDevreDisi = false,
  onVarsayilanKaydet,
  girisYok = false,
  girisSecimi = null,   // Paket 26: giriş ekranında HIZLI BAŞLA'nın üstünde gösterilen seçim (ör. Ortak Kulüp türü)
  children,
}) {
  const [ayarda, setAyarda] = useState(() => ayarIstegiAl() || girisYok);
  useAyarIstegi(() => setAyarda(true));
  const bilgi = useOyunBilgisi(modId || null);
  const renk = vurgu?.main || COLORS.accent;
  const kapali = baslaDevreDisi || baslaYukleniyor;

  async function basla() {
    // 4 Ekim 2026 — "son seçimler hatırlanır": BAŞLA seçimleri bu modun
    // varsayılanı yapar; bir dahaki sefere HIZLI BAŞLA bu ayarlarla başlar.
    try { if (onVarsayilanKaydet) await onVarsayilanKaydet(); } catch (e) {}
    onBasla && onBasla();
  }

  if (!ayarda) {
    const satirlar = ((bilgi && bilgi.satirlar) || []).slice(0, 6);
    return (
      <GameBackground style={styles.kap}>
        {onGeri ? <BackButton onPress={onGeri} /> : null}
        <ScrollView contentContainerStyle={styles.girisIcerik} showsVerticalScrollIndicator={false}>
          <Text style={styles.baslik}>{baslik}</Text>
          <View style={[styles.cizgi, { backgroundColor: renk }]} />
          {aciklama ? <Text style={styles.aciklama}>{aciklama}</Text> : null}
          {girisSecimi ? <View style={styles.girisSecimi}>{girisSecimi}</View> : null}

          {satirlar.length ? (
            <View style={styles.ozet}>
              {satirlar.map(([k, v]) => (
                <View key={k} style={styles.ozetSatir}>
                  <Text style={styles.ozetEtiket} numberOfLines={1}>{k}</Text>
                  <Text style={styles.ozetDeger} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <SoundPressable
            style={[styles.basla, styles.girisBasla, kapali && { opacity: 0.6 }]}
            onPress={() => onBasla && onBasla()}
            disabled={kapali}
            accessibilityLabel="Hızlı başla"
          >
            {baslaYukleniyor ? (
              <ActivityIndicator color={COLORS.accentDark} />
            ) : (
              <View style={styles.dugmeIc}>
                <Ionicons name="flash" size={20} color={COLORS.accentDark} />
                <Text style={styles.baslaYazi}>HIZLI BAŞLA</Text>
              </View>
            )}
          </SoundPressable>
          <SoundPressable style={styles.ikincil} onPress={() => setAyarda(true)} accessibilityLabel="Maç ayarları">
            <Ionicons name="options-outline" size={20} color={COLORS.text} />
            <Text style={styles.ikincilYazi}>MAÇ AYARLARI</Text>
          </SoundPressable>
        </ScrollView>
      </GameBackground>
    );
  }

  return (
    <GameBackground style={styles.kap}>
      <BackButton onPress={girisYok ? onGeri : () => setAyarda(false)} confirm={false} />
      <ScrollView
        contentContainerStyle={styles.icerik}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.ayarBaslik}>{girisYok ? baslik : "Maç Ayarları"}</Text>
        <Text style={styles.ayarAlt}>{girisYok ? aciklama : baslik}</Text>

        <View style={styles.liste}>{children}</View>

        <SoundPressable style={[styles.basla, kapali && { opacity: 0.6 }]} onPress={basla} disabled={kapali}>
          {baslaYukleniyor ? (
            <ActivityIndicator color={COLORS.accentDark} />
          ) : (
            <Text style={styles.baslaYazi}>{baslaEtiketi}</Text>
          )}
        </SoundPressable>
        {onVarsayilanKaydet ? <Text style={styles.hatirlatma}>Seçimlerin bir dahaki HIZLI BAŞLA için hatırlanır.</Text> : null}
      </ScrollView>
    </GameBackground>
  );
}

// Bölüm: küçük başlık + içerik. Uzun açıklama (not ve içerideki seçicilerin
// açıklaması) başlığın yanındaki (i) ile açılır; hata notları hep görünür.
const BolumBaglami = createContext(null);
export function KurulumBolum({ baslik, not, notHata = false, children }) {
  const [acik, setAcik] = useState(false);
  const [icAciklama, setIcAciklama] = useState(false);
  const ctx = useMemo(() => ({ acik, bildir: () => setIcAciklama(true) }), [acik]);
  const bilgiVar = (!!not && !notHata) || icAciklama;
  return (
    <View style={styles.bolum}>
      <View style={styles.bolumUst}>
        <Text style={styles.bolumBaslik}>{baslik}</Text>
        {bilgiVar ? (
          <SoundPressable onPress={() => setAcik((a) => !a)} hitSlop={12} accessibilityLabel={`${baslik} hakkında bilgi`}>
            <Ionicons name={acik ? "information-circle" : "information-circle-outline"} size={18} color={acik ? COLORS.accent : COLORS.textFaint} />
          </SoundPressable>
        ) : null}
      </View>
      <BolumBaglami.Provider value={ctx}>{children}</BolumBaglami.Provider>
      {not && (notHata || acik) ? <Text style={[styles.not, notHata && { color: COLORS.danger }]}>{not}</Text> : null}
    </View>
  );
}

// Seçicinin açıklaması görünsün mü? Bir bölümün içindeyse yalnız (i) açıkken;
// bölüm dışında (eski kullanım) her zaman.
function useAciklamaGorunur(aciklamaVar) {
  const ctx = useContext(BolumBaglami);
  const bildir = ctx && ctx.bildir;
  useEffect(() => { if (aciklamaVar && bildir) bildir(); }, [aciklamaVar]);  // eslint-disable-line react-hooks/exhaustive-deps
  return ctx ? ctx.acik : true;
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
  const gorunur = useAciklamaGorunur(!!aciklama);
  return (
    <View>
      <View style={styles.zorlukCubuk}>
        <SoundPressable
          style={styles.zorlukOk}
          onPress={() => onDegis(Math.max(1, z - 1))}
          accessibilityLabel="Zorluğu azalt"
        >
          <Ionicons name="remove" size={18} color={COLORS.text} />
        </SoundPressable>
        <View style={styles.zorlukOrta}>
          <Text style={styles.zorlukAd}>{zorlukEtiketi(z)} <Text style={styles.zorlukOnda}>· {z}/10</Text></Text>
          <View style={styles.zorlukBolmeler}>
            {Array.from({ length: 10 }).map((_, i) => {
              const dolu = i < z;
              return (
                <SoundPressable
                  key={i}
                  style={[styles.zorlukBolme, dolu && { backgroundColor: COLORS.accent }]}
                  onPress={() => onDegis(i + 1)}
                  accessibilityLabel={`Zorluk ${i + 1}`}
                  hitSlop={{ top: 10, bottom: 10 }}
                />
              );
            })}
          </View>
        </View>
        <SoundPressable
          style={styles.zorlukOk}
          onPress={() => onDegis(Math.min(10, z + 1))}
          accessibilityLabel="Zorluğu artır"
        >
          <Ionicons name="add" size={18} color={COLORS.text} />
        </SoundPressable>
      </View>
      {aciklama && gorunur ? <Text style={styles.not}>{typeof aciklama === "function" ? aciklama(z) : aciklama}</Text> : null}
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

  const gorunur = useAciklamaGorunur(!!aciklama);
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

  let not = gorunur ? aciklama || null : null;
  if (ozelAcik && gecersiz) {
    not = `En az ${asgari}, en fazla ${azami} saniye olabilir — ${deger} sn ile başlayacak.`;
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
  // giriş aşaması
  girisIcerik: { flexGrow: 1, justifyContent: "center", paddingVertical: SPACING.xxl },
  baslik: { ...TYPE.h1, textAlign: "center" },
  cizgi: { alignSelf: "center", width: 48, height: 4, borderRadius: 2, marginTop: SPACING.sm },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.md, paddingHorizontal: SPACING.sm },
  ozet: {
    marginTop: SPACING.xl, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  ozetSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md, paddingVertical: 7 },
  ozetEtiket: { ...TYPE.caption, flexShrink: 0 },
  ozetDeger: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  girisBasla: { marginTop: SPACING.xl },
  girisSecimi: { marginTop: SPACING.xl },
  dugmeIc: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  ikincil: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, paddingVertical: SPACING.lg - 2, marginTop: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  ikincilYazi: { ...TYPE.button, color: COLORS.text },

  // ayarlar aşaması
  icerik: { paddingBottom: SPACING.xxxl, paddingTop: SPACING.xl },
  ayarBaslik: { ...TYPE.h2, textAlign: "center" },
  ayarAlt: { ...TYPE.caption, textAlign: "center", marginTop: 4 },
  liste: { marginTop: SPACING.md },
  hatirlatma: { ...TYPE.caption, color: COLORS.textFaint, textAlign: "center", marginTop: SPACING.md },

  bolum: { marginTop: SPACING.lg },
  bolumUst: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  bolumBaslik: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted, textTransform: "uppercase" },
  not: { ...TYPE.caption, marginTop: SPACING.sm, lineHeight: 17 },

  cipSatir: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cip: {
    flexGrow: 1, flexBasis: 64, minHeight: 42,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingVertical: 6, paddingHorizontal: SPACING.sm,
  },
  cipAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  cipYazi: { ...TYPE.caption, fontSize: 13, color: COLORS.text, fontWeight: "800", textAlign: "center" },
  cipYaziAktif: { color: COLORS.accentDark },

  zorlukCubuk: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  zorlukOrta: { flex: 1, gap: 6 },
  zorlukAd: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  zorlukOnda: { ...TYPE.caption },
  zorlukOk: {
    width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
  },
  zorlukBolmeler: { flexDirection: "row", gap: 3 },
  zorlukBolme: { flex: 1, height: 10, borderRadius: 5, backgroundColor: COLORS.cardBorder },

  ozelSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  ozelGirdi: {
    width: 96, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 1.5,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: 16, fontWeight: "800", textAlign: "center",
  },
  ozelBirim: { ...TYPE.bodyMuted },

  kapsam: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 46,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
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
