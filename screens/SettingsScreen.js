import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, Image, LayoutAnimation } from "react-native";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import BackButton from "../components/BackButton";
import ModVarsayilanlariPaneli from "../components/ModVarsayilanlariPaneli";
import { useAppSettings } from "../lib/SettingsContext";
import EslesmeProfiliPenceresi from "../components/EslesmeProfiliPenceresi";
import TakimSecici from "../components/TakimSecici";
import BilgiTestiPenceresi from "../components/BilgiTestiPenceresi";
import { seviyeEtiketi } from "../lib/bilgiSeviyesi";
import TeamBadge from "../components/TeamBadge";
import { ayarlardanProfil, profilEtiketi } from "../lib/eslesmeProfili";
import {
  bildirimDesteginVarMi, hatirlatmaKuruluMu, hatirlatmayiKur, hatirlatmayiKaldir,
  HATIRLATMA_SAATI, expoGodaMiyiz,
} from "../lib/notifications";

import { COLORS, PALETLER, saydam } from "../lib/theme";
import { ARKAPLANLAR, ARKAPLAN_SECENEKLERI, arkaplanAnahtari, SahaDeseni } from "../components/GameBackground";
import TemaOlusturucu from "../components/TemaOlusturucu";
import { uygulamayiYenile } from "../lib/temaYenile";
import { guncellemeBilgisi, guncellemeDenetle, yenidenBaslat } from "../lib/guncelleme";
const ITEMS = [
  { key: "background", label: "Arka Plan Sesi", desc: "Durmadan çalan tribün uğultusu" },
  { key: "correctWrong", label: "Doğru / Yanlış Sesi", desc: "Cevap verince çalan tepki sesi" },
  { key: "click", label: "Tıklama Sesi", desc: "Butonlara basınca çıkan kısa tık" },
  { key: "whistle", label: "Açılış Düdüğü", desc: "Uygulama açıldığında bir kez çalar" },
];

// Paket 24 (12 Ekim 2026, Kerem: "ayarlar ekranını açtığımız gibi yukarıdan bir
// ton bir şey ekranı kaplıyor. her şey kapalı gelsin, tıkladığımız açılsın.")
// Kısayol ızgarası (8 düğme) ve Sen/Oyun/Gelişmiş sekmeleri kaldırıldı. Ekran
// artık tek bir liste: her ayar bir satır (ikon + ad + kısa özet), HEPSİ KAPALI
// açılır; satıra dokununca altında açılır, başka satır açılınca önceki kapanır.
// Pencere açan ayarlar (Futbol Bilgin, Eşleşme Profili) doğrudan pencereyi açar.
export default function SettingsScreen({ onBack }) {
  const { settings, setSetting } = useAppSettings();
  const genelProfil = ayarlardanProfil(settings);
  const [profilAcik, setProfilAcik] = useState(false);
  const [testAcik, setTestAcik] = useState(false);
  const [acik, setAcik] = useState(null);   // açık satırın kimliği (tek seferde bir tane)
  const ac = (id) => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {}
    setAcik((x) => (x === id ? null : id));
  };

  // 26 Eylül 2026 — tema seçilince uygulamayı kendisi yeniden yüklüyor,
  // kullanıcıdan "kapat aç" beklemiyoruz. Yazma BİTMEDEN yeniden yüklemek
  // seçimi kaybettireceği için `await setSetting(...)` şart (bkz.
  // lib/SettingsContext.js ve lib/temaYenile.js).
  const [temaYenileniyor, setTemaYenileniyor] = useState(false);
  const [olusturucuAcik, setOlusturucuAcik] = useState(false);

  // 4 Ekim 2026 — tema oluşturucudan gelen tam palet. Eski "Özel" ayar
  // anahtarları (customAccent...) da aynı değerlerle yazılıyor ki index.js
  // ikisini birlikte uyguladığında çelişmesin.
  async function ozelTemaKaydet(secim, palet) {
    if (temaYenileniyor) return;
    setOlusturucuAcik(false);
    await setSetting("customTemaSecimi", secim);
    await setSetting("customPalet", palet);
    await setSetting("customAccent", palet.accent);
    await setSetting("customAccentDark", palet.accentDark);
    await setSetting("customCta", palet.cta);
    await setSetting("customCtaDark", palet.ctaDark);
    await temaSec("ozel");
  }

  async function temaSec(id) {
    if (temaYenileniyor) return;
    setTemaYenileniyor(true);
    try {
      await setSetting("themeId", id);
      const oldu = await uygulamayiYenile();
      // oldu === false: expo-updates yok (ya da Expo Go) — ayar kaydedildi,
      // bir sonraki açılışta görünecek. Aşağıdaki not bunu söylüyor.
      if (!oldu) setTemaYenileniyor(false);
      // oldu === true ise uygulama zaten yeniden yükleniyor, state'i bırakıyoruz.
    } catch (e) {
      setTemaYenileniyor(false);
    }
  }

  // 12 Eylül 2026 — akşam hatırlatması. Durumu ayarlardan değil İŞLETİM
  // SİSTEMİNDEN okuyoruz: kullanıcı bildirimleri sistem ayarlarından kapatmış
  // olabilir, o zaman burada "açık" göstermek yalan olurdu.
  const [bildirimAcik, setBildirimAcik] = useState(false);
  const [bildirimMesgul, setBildirimMesgul] = useState(false);
  const bildirimVar = bildirimDesteginVarMi();

  useEffect(() => {
    let iptal = false;
    if (!bildirimVar) return;
    hatirlatmaKuruluMu().then((v) => { if (!iptal) setBildirimAcik(v); }).catch(() => {});
    return () => { iptal = true; };
  }, [bildirimVar]);

  async function bildirimDegistir(deger) {
    setBildirimMesgul(true);
    try {
      const ok = deger ? await hatirlatmayiKur() : await hatirlatmayiKaldir();
      // Kurulum izin verilmediği için başarısız olduysa anahtar geri dönüyor —
      // kullanıcı açık sanıp bildirim beklemesin.
      setBildirimAcik(deger && ok);
    } finally {
      setBildirimMesgul(false);
    }
  }

  const temaAdi = (PALETLER.find((p) => p.id === (settings.themeId || "cim")) || PALETLER[0]).ad;
  const sesOzet = ITEMS.filter((i) => (settings[i.key] || 0) > 0).length;

  return (
    <GameBackground style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingVertical: 24 }}>
        <BackButton onPress={onBack} confirm={false} />
        <Text style={styles.title}>Ayarlar</Text>

        <Text style={styles.grup}>Sen</Text>
        <View style={styles.liste}>
          <Satir id="takim" ikon="shield" ad="Tuttuğun Takım" ozet={genelProfil.takim || "Seçilmedi"} acik={acik} ac={ac}>
            <Text style={styles.sectionDesc}>Takımın turlarda daha sık çıkar. Ne sıklıkla çıkacağını eşleşme profilinden ayarlarsın.</Text>
            <TakimSecici
              secili={genelProfil.takim}
              kompakt
              onSec={(t) => { setSetting("eslesmeProfili", { ...genelProfil, takim: t }); setAcik(null); }}
            />
          </Satir>

          <Satir id="tema" ikon="color-palette" ad="Tema ve Arkaplan" ozet={temaAdi} acik={acik} ac={ac}>
          <View style={styles.temaIzgara}>
            {PALETLER.map((p) => {
              const secili = (settings.themeId || "cim") === p.id;
              return (
                <SoundPressable
                  key={p.id}
                  onPress={() => (p.id === "ozel" ? setOlusturucuAcik(true) : temaSec(p.id))}
                  style={[styles.temaKart, secili && styles.temaKartAktif]}
                >
                  {/* Örnek renkler paletin KENDİ değerlerinden geliyor, aktif
                      temadan değil — böylece her kart gerçek rengini gösteriyor.
                      İlk renk (kart yüzeyi) geniş, vurgular dar (bayrak gibi durmasın). */}
                  <View style={styles.temaSeritler}>
                    {(p.id === "ozel" && settings.customPalet
                      ? [settings.customPalet.card, settings.customPalet.accent, settings.customPalet.cta]
                      : p.onizleme
                    ).map((renk, i) => (
                      <View key={i} style={[styles.temaSerit, { backgroundColor: renk, flex: i === 0 ? 3 : 1 }]} />
                    ))}
                  </View>
                  <Text style={[styles.temaAd, secili && styles.temaAdAktif]} numberOfLines={1}>{p.ad}</Text>
                  {secili ? (
                    <View style={styles.temaTik}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                    </View>
                  ) : null}
                </SoundPressable>
              );
            })}
          </View>

          {/* Paket 18 — tema renkleri yeniden açılışta değişir ama arkaplan HEMEN değişir. */}
          <Text style={styles.altBaslik}>Arkaplan</Text>
          <View style={styles.arkaIzgara}>
            {ARKAPLAN_SECENEKLERI.map((a) => {
              // Paket 25: eski takım fotoğrafı seçimleri (gs/fb/...) artık "Temaya uygun"
              const kayitli = settings.arkaplan === "saha" || settings.arkaplan === "duz" ? settings.arkaplan : "tema";
              const secili = kayitli === a.id;
              const goster = a.id === "tema" ? arkaplanAnahtari(settings.themeId, "tema") : a.id;
              return (
                <SoundPressable
                  key={a.id}
                  onPress={() => setSetting("arkaplan", a.id)}
                  style={[styles.arkaKart, secili && styles.arkaKartAktif]}
                  accessibilityLabel={`Arkaplan: ${a.ad}`}
                  accessibilityState={{ selected: secili }}
                >
                  <View style={[styles.arkaResim, { backgroundColor: COLORS.bg }]}>
                    {goster === "saha" ? <Image source={ARKAPLANLAR.saha} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
                    {goster === "saha" ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: saydam(COLORS.bg, 0.55) }]} /> : null}
                    {goster === "desen" ? <DesenOnizleme /> : null}
                    {secili ? <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} style={styles.arkaTik} /> : null}
                  </View>
                  <Text style={[styles.arkaAd, secili && { color: COLORS.text }]} numberOfLines={1}>{a.ad}</Text>
                </SoundPressable>
              );
            })}
          </View>

          <SoundPressable style={styles.profilKart} onPress={() => setOlusturucuAcik(true)}>
            <Ionicons name="color-palette" size={20} color={COLORS.accent} />
            <Text style={[styles.presetLabel, { flex: 1 }]}>{settings.customPalet ? "Kendi temanı düzenle" : "Kendi temanı oluştur"}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </SoundPressable>

          <View style={styles.temaNot}>
            <Ionicons
              name={temaYenileniyor ? "sync-outline" : "information-circle-outline"}
              size={16}
              color={temaYenileniyor ? COLORS.accent : COLORS.textMuted}
            />
            <Text style={styles.temaNotYazi}>
              {temaYenileniyor
                ? "Tema uygulanıyor…"
                : "Tema seçince uygulama kendini yeniler; ilerlemen ve ayarların korunur."}
            </Text>
          </View>
          </Satir>

          <Satir id="ses" ikon="volume-high" ad="Ses" ozet={sesOzet ? `${sesOzet}/${ITEMS.length} açık` : "Kapalı"} acik={acik} ac={ac}>
          {ITEMS.map((item) => (
            <View key={item.key} style={styles.sesSatir}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowPercent}>{Math.round((settings[item.key] || 0) * 100)}%</Text>
              </View>
              <Text style={styles.rowDesc}>{item.desc}</Text>
              <Slider
                style={{ width: '100%', height: 36, marginTop: 4 }}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.cardBorder}
                thumbTintColor={COLORS.text}
                value={settings[item.key] || 0}
                onValueChange={(val) => setSetting(item.key, val)}
              />
            </View>
          ))}
          </Satir>

          <Satir id="hatirlatma" ikon="notifications" ad="Hatırlatma" ozet={bildirimVar ? (bildirimAcik ? "Açık" : "Kapalı") : "Yok"} acik={acik} ac={ac}>
            <Text style={styles.sectionDesc}>
              {bildirimVar
                ? `Günün bulmacasını ve görevlerini kaçırmamak için akşam ${HATIRLATMA_SAATI}:00'de tek bir hatırlatma.`
                : expoGodaMiyiz()
                  ? "Bildirimler Expo Go'da denenemiyor. Uygulamanın derlenmiş sürümünde (APK) çalışır."
                  : "Bildirim modülü bu sürümde kurulu değil."}
            </Text>
            {bildirimVar && (
              <AnahtarSatir etiket="Akşam Hatırlatması" alt="Günde bir kez, sadece bu cihazda" deger={bildirimAcik} kapali={bildirimMesgul} onDegis={bildirimDegistir} />
            )}
          </Satir>
        </View>

        <Text style={styles.grup}>Oyun</Text>
        <View style={styles.liste}>
          {/* 4 Ekim 2026 — futbol bilgisi testi: seviye bütün modların varsayılan zorluğu */}
          <Satir
            id="bilgi" ikon="school" ad="Futbol Bilgin" git
            ozet={Number.isFinite(settings.bilgiSeviyesi) ? `${settings.bilgiSeviyesi}/10 · ${seviyeEtiketi(settings.bilgiSeviyesi)}` : "Test çözülmedi"}
            onPress={() => setTestAcik(true)}
          />
          {/* 28 Eylül 2026 — bütün modların varsayılan eşleşme profili */}
          <Satir id="eslesme" ikon="options" ad="Eşleşme Profili" git ozet={profilEtiketi(genelProfil)} onPress={() => setProfilAcik(true)} />
          <Satir id="sesli" ikon="mic" ad="Sesli Cevap" ozet={settings.voiceConfirm !== false ? "Onaylı" : "Doğrudan"} acik={acik} ac={ac}>
            <AnahtarSatir
              etiket="Göndermeden Önce Onayla"
              alt="Mikrofonla verdiğin cevap önce ekranda gösterilir; yanlış anlaşılan cevap turu kaybettirmez."
              deger={settings.voiceConfirm !== false}
              onDegis={(val) => setSetting("voiceConfirm", val)}
            />
          </Satir>
          <Satir id="mod" ikon="game-controller" ad="Mod Varsayılanları" ozet="HIZLI BAŞLA ayarları" acik={acik} ac={ac}>
            <Text style={styles.sectionDesc}>
              Her modun HIZLI BAŞLA ile açılan ayarları: zorluk (10 üzerinden), süre ve moda özel kurallar. Modu açınca MAÇ AYARLARI'ndan o maç için de değiştirebilirsin.
            </Text>
            <ModVarsayilanlariPaneli />
          </Satir>
        </View>

        <Text style={styles.grup}>Diğer</Text>
        <View style={styles.liste}>
          {/* Paket 23 — hafif ölçüm (lib/olcum.js) */}
          <Satir id="gizlilik" ikon="shield-checkmark" ad="Gizlilik" ozet={settings.olcum !== false ? "Kullanım verisi açık" : "Kullanım verisi kapalı"} acik={acik} ac={ac}>
            <AnahtarSatir
              etiket="Kullanım verisi gönder"
              alt="Hangi modların oynandığını anonim olarak sayar; oyunu geliştirmemize yardım eder. Kişisel bilgi içermez."
              deger={settings.olcum !== false}
              onDegis={(val) => setSetting("olcum", val)}
            />
          </Satir>
          {/* 5 Ekim 2026 — OTA güncellemesinin gelip gelmediği buradan görülür (lib/guncelleme.js) */}
          <Satir id="surum" ikon="information-circle" ad="Sürüm" ozet={guncellemeBilgisi().runtime || ""} acik={acik} ac={ac}>
            <SurumKutusu />
          </Satir>
        </View>

        <BilgiTestiPenceresi visible={testAcik} onKapat={() => setTestAcik(false)} />
        <EslesmeProfiliPenceresi
          visible={profilAcik}
          profil={genelProfil}
          ayarlarModu
          onVarsayilanYap={(pr) => { setSetting("eslesmeProfili", pr); setProfilAcik(false); }}
          onClose={() => setProfilAcik(false)}
        />

        <TemaOlusturucu
          visible={olusturucuAcik}
          baslangic={settings.customTemaSecimi}
          onKapat={() => setOlusturucuAcik(false)}
          onKaydet={ozelTemaKaydet}
        />
      </ScrollView>
    </GameBackground>
  );
}

// Paket 25 — "Temaya uygun" arkaplanın küçük önizlemesi (kartın kendi boyutunda).
function DesenOnizleme() {
  const [b, setB] = useState(null);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setB(e.nativeEvent.layout)}>
      {b ? <SahaDeseni genislik={b.width} yukseklik={b.height} cizgiKalinligi={1} /> : null}
    </View>
  );
}

// Paket 24 — tek satır: dokununca altında açılır (ya da `git` ise pencere açar).
function Satir({ id, ikon, ad, ozet, acik, ac, git = false, onPress, children }) {
  const acikMi = !git && acik === id;
  return (
    <View style={[styles.satir, acikMi && styles.satirAcik]}>
      <SoundPressable
        style={styles.satirUst}
        onPress={git ? onPress : () => ac(id)}
        accessibilityRole="button"
        accessibilityState={git ? undefined : { expanded: acikMi }}
        accessibilityLabel={ad}
      >
        <View style={styles.satirIkon}><Ionicons name={ikon} size={18} color={COLORS.accent} /></View>
        <Text style={styles.satirAd} numberOfLines={1}>{ad}</Text>
        {ozet ? <Text style={styles.satirOzet} numberOfLines={1}>{ozet}</Text> : null}
        <Ionicons name={git ? "chevron-forward" : acikMi ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
      </SoundPressable>
      {acikMi ? <View style={styles.satirIc}>{children}</View> : null}
    </View>
  );
}

function AnahtarSatir({ etiket, alt, deger, onDegis, kapali }) {
  return (
    <View style={styles.anahtar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{etiket}</Text>
        {alt ? <Text style={styles.rowDesc}>{alt}</Text> : null}
      </View>
      <Switch
        value={deger}
        disabled={kapali}
        onValueChange={onDegis}
        trackColor={{ false: COLORS.cardBorder, true: COLORS.accent }}
        thumbColor={COLORS.text}
        accessibilityLabel={etiket}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grup: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 6, marginBottom: 8, marginLeft: 4 },
  liste: { gap: 8, marginBottom: 18 },
  satir: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  satirAcik: { borderColor: COLORS.accent },
  satirUst: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 54 },
  satirIkon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: saydam(COLORS.accent, 0.14) },
  satirAd: { color: COLORS.text, fontWeight: "800", fontSize: 15, flexShrink: 0 },
  satirOzet: { flex: 1, textAlign: "right", color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  satirIc: { paddingHorizontal: 14, paddingBottom: 14 },
  sesSatir: { marginBottom: 10 },
  anahtar: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  profilKart: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 8,
  },
  container: { flex: 1, width: "100%", paddingHorizontal: 20 },
  backLink: { color: COLORS.textMuted, fontSize: 13 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginBottom: 6, marginTop: 4 },
  sectionDesc: { color: COLORS.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 17 },
  presetList: { marginBottom: 26, gap: 8 },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  presetRowActive: { borderColor: COLORS.accent },
  presetFlag: { fontSize: 18 },
  presetLabel: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  presetLabelActive: { color: COLORS.accent },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  rowLabel: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  rowPercent: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },
  rowDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },

  // --- tema secici ---
  altBaslik: { color: COLORS.text, fontSize: 14, fontWeight: "900", marginTop: 4, marginBottom: 8 },
  arkaIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  arkaKart: { flex: 1, minWidth: 72, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.cardBorder, overflow: "hidden", backgroundColor: COLORS.card },
  arkaKartAktif: { borderColor: COLORS.accent, borderWidth: 2 },
  arkaResim: { height: 96, overflow: "hidden" },
  arkaTik: { position: "absolute", top: 4, right: 4 },
  arkaAd: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted, paddingHorizontal: 6, paddingVertical: 5 },
  temaIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  temaKart: {
    width: "48%", backgroundColor: COLORS.card, borderWidth: 1,
    borderColor: COLORS.cardBorder, borderRadius: 12, padding: 10,
  },
  temaKartAktif: { borderColor: COLORS.accent, borderWidth: 2 },
  temaSeritler: { flexDirection: "row", height: 26, borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  temaSerit: { flex: 1 },
  temaAd: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  temaAdAktif: { color: COLORS.accent },
  temaAciklama: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  temaTik: { position: "absolute", top: 6, right: 6 },
  ozelKap: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  renkIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  renkKutu: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center",
    justifyContent: "center", borderWidth: 2, borderColor: "transparent",
  },
  renkKutuAktif: { borderColor: COLORS.text },
  temaNot: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 26 },
  temaNotYazi: { color: COLORS.textMuted, fontSize: 12, flex: 1 },
});

// 5 Ekim 2026 — sürüm/güncelleme bilgisi + elle denetleme.
function SurumKutusu() {
  const [durum, setDurum] = useState(null);
  const b = guncellemeBilgisi();
  const tarih = b.tarih ? `${b.tarih.toLocaleDateString("tr-TR")} ${b.tarih.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : null;
  const satirlar = [
    ["Sürüm", b.runtime || "—"],
    ["Kanal", b.kanal || (b.etkin ? "—" : "güncelleme kapalı")],
    ["Çalışan paket", b.gomulu ? "APK'nın kendi paketi" : `güncelleme · ${tarih || "?"}`],
    ["Paket kimliği", b.kimlik ? b.kimlik.slice(0, 8) : "—"],
  ];
  async function denetle() {
    setDurum("denetleniyor");
    const r = await guncellemeDenetle();
    setDurum(r.durum === "hata" ? `hata: ${r.mesaj}` : r.durum);
  }
  const yazi = { denetleniyor: "Denetleniyor…", guncel: "En yeni sürümdesin", hazir: "Yeni sürüm indirildi", kapali: "Bu kurulumda güncelleme kapalı" }[durum] || durum;
  return (
    <View style={{ marginBottom: 26 }}>
      {b.acil ? (
        <Text style={[styles.sectionDesc, { color: COLORS.danger }]}>
          Son indirilen güncelleme açılırken hata verdi; APK'nın kendi paketiyle açıldı. (Hata raporu gönderildi.)
        </Text>
      ) : null}
      {satirlar.map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={[styles.rowLabel, { flex: 1 }]}>{k}</Text>
          <Text style={styles.rowDesc} selectable>{v}</Text>
        </View>
      ))}
      <SoundPressable style={[styles.profilKart, { marginTop: 10 }]} onPress={durum === "hazir" ? yenidenBaslat : denetle} accessibilityLabel="Güncellemeleri denetle">
        <Ionicons name={durum === "hazir" ? "refresh" : "cloud-download-outline"} size={20} color={COLORS.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.presetLabelActive}>{durum === "hazir" ? "Şimdi yenile" : "Güncellemeleri denetle"}</Text>
          {yazi ? <Text style={styles.sectionDesc}>{yazi}</Text> : null}
        </View>
      </SoundPressable>
    </View>
  );
}
