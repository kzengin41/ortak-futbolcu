import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { useAppSettings } from "../lib/SettingsContext";
import { ayarlardanProfil, ozellestirilmisMi } from "../lib/eslesmeProfili";
import { seviyeEtiketi, oneriEtiketi, oneriyiUygula, pencereyiSifirla } from "../lib/bilgiSeviyesi";
import { COLORS, RADIUS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// FUTBOL BİLGİSİ TESTİ PENCERESİ — 4 Ekim 2026
// Akış: giriş → 8 soru → sonuç. Ana sayfada takım sorusundan hemen sonra
// kendiliğinden bir kez açılır (`otomatik`); Ayarlar'dan istendiği zaman
// tekrar çözülür (`visible` + `onKapat`). Soru üretimi lib/bilgiTesti.js
// (players.json yüklüyor) — o yüzden modül ancak test BAŞLAYINCA yükleniyor,
// ana sayfanın açılışı ağırlaşmasın.
// ============================================================================
let _bt = null;
const bt = () => (_bt = _bt || require("../lib/bilgiTesti"));

export default function BilgiTestiPenceresi({ otomatik = false, visible, onKapat }) {
  const { settings, setSetting, loaded } = useAppSettings();
  const acik = otomatik ? loaded && settings.takimSoruldu && !settings.bilgiTestiSoruldu : !!visible;

  const [faz, setFaz] = useState("giris"); // giris | hazirlaniyor | soru | sonuc
  const [soru, setSoru] = useState(null);
  const [no, setNo] = useState(0);
  const [secilen, setSecilen] = useState(null);
  const [sonuc, setSonuc] = useState(null);
  const [profilUygula, setProfilUygula] = useState(true);
  const seviye = useRef(5);
  const cevaplar = useRef([]);
  const kullanilan = useRef(new Set());
  const zaman = useRef(null);

  useEffect(() => () => clearTimeout(zaman.current), []);
  useEffect(() => {
    if (acik) { setFaz("giris"); setSoru(null); setSecilen(null); setSonuc(null); }
  }, [acik]);

  if (!acik) return null;
  const profil = ayarlardanProfil(settings);

  function kapat(isaretle) {
    clearTimeout(zaman.current);
    if (isaretle) setSetting("bilgiTestiSoruldu", true);
    onKapat?.();
  }

  function soruHazirla(i) {
    const B = bt();
    let s = B.soruUret(B.PLAN[i], seviye.current, kullanilan.current);
    // Çok nadir: o aralıkta soru çıkmazsa bir basamak kolaylaştır.
    for (let d = 1; !s && d <= 4; d++) s = B.soruUret(B.PLAN[i], Math.max(1, seviye.current - d), kullanilan.current);
    if (s) kullanilan.current.add(s.hedef);
    return s;
  }

  function basla() {
    setFaz("hazirlaniyor");
    seviye.current = 5;
    cevaplar.current = [];
    kullanilan.current = new Set();
    // Veri ilk kez yükleniyor; "Hazırlanıyor" bir kare görünsün diye kısa erteleme.
    zaman.current = setTimeout(() => {
      seviye.current = bt().ILK_SEVIYE;
      const s = soruHazirla(0);
      if (!s) { kapat(true); return; }
      setNo(0);
      setSoru(s);
      setSecilen(null);
      setFaz("soru");
    }, 30);
  }

  function cevapla(sik) {
    if (secilen !== null || !soru) return;
    const dogru = sik === soru.dogru;
    setSecilen(sik === null ? "__bilmiyorum" : sik);
    const B = bt();
    const sonra = B.sonrakiSeviye(seviye.current, dogru, no);
    cevaplar.current.push({ bolge: soru.bolge, donem: soru.donem, seviye: seviye.current, dogru, sonra });
    seviye.current = sonra;
    zaman.current = setTimeout(() => {
      const i = no + 1;
      if (i >= B.SORU_SAYISI) {
        const r = B.sonucHesapla(cevaplar.current);
        setSonuc(r);
        // Profil elle özelleştirilmişse ya da hazır profil değiştirilmişse öneriyi kendiliğinden uygulama.
        setProfilUygula(!ozellestirilmisMi(profil) && (profil.temel || "dengeli") === "dengeli");
        setFaz("sonuc");
        return;
      }
      const s = soruHazirla(i);
      if (!s) { setSonuc(B.sonucHesapla(cevaplar.current)); setFaz("sonuc"); return; }
      setNo(i);
      setSoru(s);
      setSecilen(null);
    }, dogru ? 650 : 1100);
  }

  async function kaydet() {
    await setSetting("bilgiSeviyesi", sonuc.seviye);
    if (profilUygula) await setSetting("eslesmeProfili", oneriyiUygula(profil, sonuc.oneri));
    await setSetting("bilgiTestiSoruldu", true);
    pencereyiSifirla();
    onKapat?.();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => kapat(true)}>
      <View style={s.perde}>
        <View style={s.kart}>
          {faz === "giris" || faz === "hazirlaniyor" ? (
            <>
              <View style={s.ust}>
                <View style={s.rozet}><Ionicons name="school" size={26} color={COLORS.accent} /></View>
                <SoundPressable onPress={() => kapat(true)} hitSlop={12} accessibilityLabel="Kapat">
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </SoundPressable>
              </View>
              <Text style={s.baslik}>Futbol bilgini ölçelim</Text>
              <Text style={s.aciklama}>
                8 kısa soru, yaklaşık 1 dakika. Sonuca göre bütün modlarda zorluk ve hangi oyuncuların çıkacağı
                sana göre ayarlanır. Bilmediğin soruda "Bilmiyorum" de, tahmin etme.
              </Text>
              <View style={s.maddeler}>
                <Madde ikon="speedometer" yazi="Zorluk: bütün modlar senin seviyenden başlar" />
                <Madde ikon="options" yazi="Eşleşme: Türkiye / Avrupa ve dönem dengesi önerilir" />
                <Madde ikon="trending-up" yazi="Oynadıkça seviyen kendiliğinden ince ayarlanır" />
              </View>
              <SoundPressable style={s.anaDugme} onPress={basla} disabled={faz === "hazirlaniyor"}>
                {faz === "hazirlaniyor" ? <ActivityIndicator color={COLORS.accentDark} /> : <Text style={s.anaDugmeYazi}>TESTE BAŞLA</Text>}
              </SoundPressable>
              <SoundPressable style={s.gec} onPress={() => kapat(true)}>
                <Text style={s.gecYazi}>Şimdilik geç · Ayarlar'dan çözebilirsin</Text>
              </SoundPressable>
            </>
          ) : faz === "soru" && soru ? (
            <>
              <View style={s.ilerleme}>
                {Array.from({ length: bt().SORU_SAYISI }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.ilerlemeParca,
                      i < no && { backgroundColor: cevaplar.current[i]?.dogru ? COLORS.accent : COLORS.danger },
                      i === no && { backgroundColor: COLORS.text },
                    ]}
                  />
                ))}
              </View>
              <View style={s.soruUst}>
                <Text style={s.soruNo}>SORU {no + 1} / {bt().SORU_SAYISI}</Text>
                <SoundPressable onPress={() => kapat(true)} hitSlop={12} accessibilityLabel="Testi bırak">
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </SoundPressable>
              </View>
              <Text style={s.soruMetin}>{soru.metin}</Text>
              <View style={{ gap: SPACING.sm, marginTop: SPACING.lg }}>
                {soru.siklar.map((sik) => {
                  const cevaplandi = secilen !== null;
                  const buDogru = sik === soru.dogru;
                  const buSecilen = sik === secilen;
                  return (
                    <SoundPressable
                      key={sik}
                      style={[
                        s.sik,
                        cevaplandi && buDogru && s.sikDogru,
                        cevaplandi && buSecilen && !buDogru && s.sikYanlis,
                      ]}
                      onPress={() => cevapla(sik)}
                      disabled={cevaplandi}
                    >
                      <Text style={s.sikYazi} numberOfLines={2}>{sik}</Text>
                      {cevaplandi && buDogru ? <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} /> : null}
                      {cevaplandi && buSecilen && !buDogru ? <Ionicons name="close-circle" size={20} color={COLORS.danger} /> : null}
                    </SoundPressable>
                  );
                })}
              </View>
              <SoundPressable style={s.bilmiyorum} onPress={() => cevapla(null)} disabled={secilen !== null}>
                <Text style={s.bilmiyorumYazi}>Bilmiyorum</Text>
              </SoundPressable>
            </>
          ) : faz === "sonuc" && sonuc ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.sonucUst}>FUTBOL BİLGİN</Text>
              <View style={s.sonucSatir}>
                <Text style={s.sonucSayi}>{sonuc.seviye}</Text>
                <View>
                  <Text style={s.sonucBolu}>/ 10</Text>
                  <Text style={s.sonucEtiket}>{seviyeEtiketi(sonuc.seviye)}</Text>
                </View>
              </View>
              <Text style={s.aciklama}>{bt().SORU_SAYISI} sorudan {sonuc.dogruSayisi} doğru. Bütün modlar {sonuc.seviye}/10 zorlukla başlayacak (Ayarlar'da elle değiştirdiğin modlar hariç).</Text>

              <View style={s.cubuklar}>
                <Cubuk etiket="Türkiye" oran={sonuc.oranlar.tr} />
                <Cubuk etiket="Avrupa" oran={sonuc.oranlar.avr} />
                <Cubuk etiket="Güncel" oran={sonuc.oranlar.guncel} />
                <Cubuk etiket="Nostalji" oran={sonuc.oranlar.nostalji} />
              </View>

              <View style={s.oneri}>
                <View style={{ flex: 1 }}>
                  <Text style={s.oneriBaslik}>Önerilen eşleşme</Text>
                  <Text style={s.oneriYazi}>{oneriEtiketi(sonuc.oneri)}</Text>
                  <Text style={s.oneriAlt}>Takımın ve detaylı ayarların korunur.</Text>
                </View>
                <Switch value={profilUygula} onValueChange={setProfilUygula} trackColor={{ true: COLORS.accent }} />
              </View>

              <SoundPressable style={s.anaDugme} onPress={kaydet}>
                <Text style={s.anaDugmeYazi}>KAYDET VE OYNA</Text>
              </SoundPressable>
              <SoundPressable style={s.gec} onPress={basla}>
                <Text style={s.gecYazi}>Testi baştan çöz</Text>
              </SoundPressable>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Madde({ ikon, yazi }) {
  return (
    <View style={s.madde}>
      <Ionicons name={ikon} size={18} color={COLORS.accent} />
      <Text style={s.maddeYazi}>{yazi}</Text>
    </View>
  );
}

function Cubuk({ etiket, oran }) {
  const yuzde = oran == null ? 0 : Math.round(oran * 100);
  return (
    <View style={s.cubukSatir}>
      <Text style={s.cubukEtiket}>{etiket}</Text>
      <View style={s.cubukZemin}>
        <View style={[s.cubukDolu, { width: `${Math.max(4, yuzde)}%` }]} />
      </View>
      <Text style={s.cubukYuzde}>{oran == null ? "–" : `%${yuzde}`}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: "rgba(6,12,20,0.82)", justifyContent: "flex-end" },
  kart: {
    maxHeight: "92%", backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, paddingBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  ust: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rozet: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.cardBorder },
  baslik: { ...TYPE.h1, marginTop: SPACING.md },
  aciklama: { ...TYPE.bodyMuted, fontSize: 14, lineHeight: 20, marginTop: SPACING.sm },
  maddeler: { marginTop: SPACING.lg, gap: SPACING.sm },
  madde: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  maddeYazi: { ...TYPE.body, fontSize: 14, flex: 1 },
  anaDugme: { marginTop: SPACING.xl, height: 56, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { fontSize: 18, fontWeight: "900", letterSpacing: 1.2, color: COLORS.accentDark },
  gec: { alignSelf: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, marginTop: SPACING.xs || 4 },
  gecYazi: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },

  ilerleme: { flexDirection: "row", gap: 4, marginBottom: SPACING.md },
  ilerlemeParca: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.cardBorder },
  soruUst: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  soruNo: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  soruMetin: { ...TYPE.h2, fontSize: 21, lineHeight: 28, marginTop: SPACING.sm },
  sik: {
    minHeight: 54, flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  sikDogru: { borderColor: COLORS.accent, backgroundColor: "rgba(124,255,92,0.10)" },
  sikYanlis: { borderColor: COLORS.danger, backgroundColor: "rgba(255,93,93,0.10)" },
  sikYazi: { flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.text },
  bilmiyorum: { alignSelf: "center", marginTop: SPACING.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl },
  bilmiyorumYazi: { fontSize: 15, fontWeight: "800", color: COLORS.textMuted, textDecorationLine: "underline" },

  sonucUst: { fontSize: 13, fontWeight: "800", letterSpacing: 2, color: COLORS.accent },
  sonucSatir: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm, marginTop: SPACING.sm },
  sonucSayi: { fontSize: 64, fontWeight: "900", color: COLORS.text, lineHeight: 68 },
  sonucBolu: { fontSize: 20, fontWeight: "800", color: COLORS.textMuted },
  sonucEtiket: { fontSize: 18, fontWeight: "900", color: COLORS.cta, marginBottom: 8 },
  cubuklar: { marginTop: SPACING.lg, gap: 8 },
  cubukSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cubukEtiket: { width: 70, fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  cubukZemin: { flex: 1, height: 10, borderRadius: 5, backgroundColor: COLORS.card, overflow: "hidden" },
  cubukDolu: { height: "100%", borderRadius: 5, backgroundColor: COLORS.accent },
  cubukYuzde: { width: 44, textAlign: "right", fontSize: 13, fontWeight: "800", color: COLORS.text },
  oneri: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.lg, padding: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  oneriBaslik: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: COLORS.textMuted },
  oneriYazi: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  oneriAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginTop: 2 },
});
