import { _t, yerel } from "../lib/dil";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SoundPressable from "./SoundPressable";
import TeamBadge from "./TeamBadge";
import TakimSecici from "./TakimSecici";
import { KurulumBolum, KapsamDugmesi } from "./ModKurulum";
import {
  HAZIR_PROFILLER, KAROLAR, KARO_DURUMLARI, KULUP_SEVIYELERI, DONEMLER, TAKIM_ORANI,
  VARSAYILAN_PROFIL, profiliDuzenle, hazirdanProfil, hazirEslesmesi, profilDerle,
} from "../lib/eslesmeProfili";
import { canonicalClub } from "../lib/clubAliases";
import { weightForClubs } from "../lib/clubWeights";
import { COLORS, RADIUS, SPACING, TYPE, saydam, vurguZemini } from "../lib/theme";

// ============================================================================
// EŞLEŞME PROFİLİ PENCERESİ — 2. sürüm (Paket 27, 12 Ekim 2026)
// Kerem: "eşleştirme profillerini baştan çalışmamız lazım. ayrıca bu eşleştirme
// profilleri ekranı da karmaşık duruyor." Eskiden 3 sekme (Hızlı / Ayarla /
// Detaylı) ve 9 ayrı kavram vardı. Artık TEK EKRAN, dört soru:
//   HAZIR      tek dokunuşla hazır cevaplar (aşağıdakileri doldurur)
//   NEREDEN    8 karo — dokundukça kapalı → açık → ağırlıklı
//   KULÜPLER   hepsi / büyük kulüpler / Şampiyonlar Ligi
//   NE ZAMAN   on yıllar (çoklu)
//   TAKIMIN    tuttuğun takım + Normal / Sık
// Altta CANLI ÖNİZLEME: seçtikçe örnek kulüp çiftleri ve havuz büyüklüğü
// değişir. Kulüp bazında "öne çıkar / hiç çıkmasın" kapalı gelen "Gelişmiş"te.
// Motor: lib/eslesmeProfili.js (2. sürüm) + lib/gameEngine.js bölgeli taban.
// ============================================================================

let _kulupAdlari = null;
function sade(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}
function kulupAdlari() {
  if (_kulupAdlari) return _kulupAdlari;
  const say = new Map();
  try {
    const P = require("../lib/paket/players");
    for (const p of P) for (const c of p.clubs) say.set(c, (say.get(c) || 0) + 1);
  } catch (e) {}
  _kulupAdlari = [...say.entries()]
    .map(([c, n]) => ({ ad: c, sade: sade(c), puan: weightForClubs([c]) * 1000 + n }))
    .sort((a, b) => b.puan - a.puan);
  return _kulupAdlari;
}

// Önizleme: havuz büyüklüğü + 3 örnek çift (oyun motoruyla, zorluk 5).
let _motor = null;
function motor() {
  if (_motor) return _motor;
  const G = require("../lib/gameEngine");
  const { PLAYERS } = require("../lib/players");
  _motor = { G, PLAYERS };
  return _motor;
}
function onizlemeHesapla(derlenmis) {
  const { G, PLAYERS } = motor();
  let toplam = 0;
  for (const p of PLAYERS) if (derlenmis.oyuncuCarpani(p) > 0) toplam++;
  const havuz = G.computeRoundPool(PLAYERS, derlenmis, 5);
  return { toplam, havuz: havuz.entries.length, ciftler: G.ornekCiftler(havuz, 3) };
}

export default function EslesmeProfiliPenceresi({
  visible, profil, onUygula, onVarsayilanYap, onClose, ayarlarModu, online,
}) {
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0 };
  const [taslak, setTaslak] = useState(() => profiliDuzenle(profil));
  const [takimAcik, setTakimAcik] = useState(false);
  const [gelismis, setGelismis] = useState(false);
  const [kulupAra, setKulupAra] = useState("");
  const [onizleme, setOnizleme] = useState(null);
  const [uyari, setUyari] = useState(null);

  useEffect(() => {
    if (visible) {
      setTaslak(profiliDuzenle(profil));
      setTakimAcik(false);
      setGelismis(false);
      setKulupAra("");
      setUyari(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const anahtar = JSON.stringify(taslak);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derlenmis = useMemo(() => profilDerle(taslak), [anahtar]);
  const secili = hazirEslesmesi(taslak);

  // Canlı önizleme — dokunuşları bekletmesin diye kısa bir gecikmeyle hesaplanır.
  const zamanlayici = useRef(null);
  useEffect(() => {
    if (!visible) return undefined;
    setOnizleme((o) => (o ? { ...o, yukleniyor: true } : { yukleniyor: true }));
    clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => {
      try { setOnizleme(onizlemeHesapla(derlenmis)); } catch (e) { setOnizleme(null); }
    }, 250);
    return () => clearTimeout(zamanlayici.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, visible]);

  const guncelle = (degisim) => setTaslak((t) => ({ ...t, ...degisim, temel: "ozel" }));
  const hazirSec = (id) => setTaslak((t) => hazirdanProfil(id, t));
  function karoDegistir(id) {
    const simdi = taslak.karolar[id] || 0;
    const sonraki = (simdi + 1) % 3;
    const yeni = { ...taslak.karolar, [id]: sonraki };
    if (!Object.values(yeni).some((v) => v > 0)) { setUyari(_t("En az bir yer açık kalmalı.")); return; }
    setUyari(null);
    guncelle({ karolar: yeni });
  }
  function donemDegistir(d) {
    const var_ = taslak.donemler.includes(d);
    const yeni = var_ ? taslak.donemler.filter((x) => x !== d) : [...taslak.donemler, d];
    if (!yeni.length) { setUyari(_t("En az bir dönem seçili kalmalı.")); return; }
    setUyari(null);
    guncelle({ donemler: yeni });
  }
  function kulupAyarla(ad, durum) {
    const k = { ...(taslak.kulupAyar || {}) };
    if (!durum || k[ad] === durum) delete k[ad]; else k[ad] = durum;
    setTaslak((t) => ({ ...t, kulupAyar: k }));
  }

  const kulupSonuclari = useMemo(() => {
    const q = sade(kulupAra.trim());
    if (q.length < 2) return [];
    return kulupAdlari().filter((k) => k.sade.includes(q)).slice(0, 10).map((k) => k.ad);
  }, [kulupAra]);

  if (!visible) return null;

  const nitelik = !onizleme || onizleme.havuz == null ? null
    : onizleme.havuz >= 150 ? { yazi: _t("çeşit bol"), ikon: "checkmark-circle", renk: COLORS.accent }
    : onizleme.havuz >= 60 ? { yazi: "yeterli", ikon: "checkmark", renk: COLORS.cta }
    : { yazi: _t("dar — biraz genişlet"), ikon: "alert-circle", renk: COLORS.danger };
  const ozelSayisi = Object.keys(taslak.kulupAyar || {}).length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.kap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.ust}>
          <View style={{ flex: 1 }}>
            <Text style={styles.baslik}>{_t("Hangi futbolcular çıksın?")}</Text>
            <Text style={styles.altBaslik} numberOfLines={1}>
              {ayarlarModu ? _t("Bütün modlar bu seçimle başlar") : _t("Bu maç için ya da varsayılan olarak")}
            </Text>
          </View>
          <SoundPressable onPress={onClose} hitSlop={12} style={styles.kapat} accessibilityLabel={_t("Kapat")}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </SoundPressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
          <Text style={styles.eb}>{_t("Hazır")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hazirlar}>
            {HAZIR_PROFILLER.map((h) => {
              const aktif = secili === h.id;
              return (
                <SoundPressable key={h.id} style={[styles.hazir, aktif && styles.hazirAktif]} onPress={() => hazirSec(h.id)} accessibilityLabel={_t("Hazır: {0}", [h.ad])} accessibilityState={{ selected: aktif }}>
                  <Text style={[styles.hazirYazi, aktif && styles.hazirYaziAktif]}>{h.ikon} {h.ad}</Text>
                </SoundPressable>
              );
            })}
            {secili === "ozel" ? (
              <View style={[styles.hazir, styles.hazirAktif]}><Text style={[styles.hazirYazi, styles.hazirYaziAktif]}>{_t("✏️ Özel")}</Text></View>
            ) : null}
          </ScrollView>
          {secili !== "ozel" ? <Text style={styles.not}>{(HAZIR_PROFILLER.find((h) => h.id === secili) || {}).aciklama}</Text> : null}

          <Text style={styles.eb}>{_t("Nereden")}{" "}<Text style={styles.ebIpucu}>{_t("· dokun: kapalı → açık → ağırlıklı")}</Text></Text>
          <View style={styles.izgara}>
            {KAROLAR.map((k) => {
              const d = taslak.karolar[k.id] || 0;
              return (
                <SoundPressable
                  key={k.id}
                  style={[styles.karo, d === 1 && styles.karoAcik, d === 2 && styles.karoCok, d === 0 && styles.karoKapali]}
                  onPress={() => karoDegistir(k.id)}
                  accessibilityLabel={`${k.ad}: ${_t(KARO_DURUMLARI[d])}`}
                >
                  <Text style={styles.karoBayrak}>{k.bayrak}</Text>
                  <Text style={styles.karoAd} numberOfLines={2}>{k.ad}</Text>
                  <Text style={[styles.karoDurum, d > 0 && { color: COLORS.accent }, d === 2 && { fontWeight: "900" }]}>{_t(KARO_DURUMLARI[d])}</Text>
                </SoundPressable>
              );
            })}
          </View>
          {uyari ? <Text style={[styles.not, { color: COLORS.danger }]}>{uyari}</Text> : null}

          <Text style={styles.eb}>{_t("Kulüpler")}</Text>
          <View style={styles.seg}>
            {KULUP_SEVIYELERI.map((s) => {
              const aktif = taslak.kulupler === s.deger;
              return (
                <SoundPressable key={s.deger} style={[styles.segDugme, aktif && styles.segAktif]} onPress={() => guncelle({ kulupler: s.deger })} accessibilityLabel={_t("Kulüpler: {0}", [s.etiket])}>
                  <Text style={[styles.segYazi, aktif && styles.segYaziAktif]} numberOfLines={2}>{s.etiket}</Text>
                </SoundPressable>
              );
            })}
          </View>
          <Text style={styles.not}>{(KULUP_SEVIYELERI.find((s) => s.deger === taslak.kulupler) || {}).aciklama}</Text>

          <Text style={styles.eb}>{_t("Ne zaman")}</Text>
          <View style={styles.seg}>
            {DONEMLER.map((d) => {
              const aktif = taslak.donemler.includes(d.deger);
              return (
                <SoundPressable key={d.deger} style={[styles.segDugme, aktif && styles.segAktif]} onPress={() => donemDegistir(d.deger)} accessibilityLabel={_t("Dönem: {0}", [d.etiket])} accessibilityState={{ selected: aktif }}>
                  <Text style={[styles.segYazi, aktif && styles.segYaziAktif]} numberOfLines={2}>{d.etiket}</Text>
                </SoundPressable>
              );
            })}
          </View>

          <Text style={styles.eb}>{_t("Takımın")}</Text>
          {takimAcik ? (
            <TakimSecici secili={taslak.takim} kompakt onSec={(t) => { setTaslak((x) => ({ ...x, takim: t })); setTakimAcik(false); }} />
          ) : taslak.takim ? (
            <View style={styles.takimSatir}>
              <SoundPressable onPress={() => setTakimAcik(true)} style={styles.takimSol} accessibilityLabel={_t("Takımı değiştir")}>
                <TeamBadge name={taslak.takim} size={32} />
                <Text style={styles.takimAd} numberOfLines={1}>{taslak.takim}</Text>
              </SoundPressable>
              {TAKIM_ORANI.filter((t) => t.deger !== "yok").map((t) => {
                const aktif = taslak.takimOrani === t.deger;
                return (
                  <SoundPressable key={t.deger} style={[styles.mini, aktif && styles.miniAktif]} onPress={() => setTaslak((x) => ({ ...x, takimOrani: t.deger }))} accessibilityLabel={_t("Takımın: {0}", [t.etiket])}>
                    <Text style={[styles.miniYazi, aktif && styles.miniYaziAktif]}>{t.etiket}</Text>
                  </SoundPressable>
                );
              })}
              <SoundPressable onPress={() => setTaslak((x) => ({ ...x, takim: null }))} hitSlop={8} accessibilityLabel={_t("Takımı kaldır")}>
                <Ionicons name="close-circle" size={20} color={COLORS.textFaint} />
              </SoundPressable>
            </View>
          ) : (
            <SoundPressable style={styles.genisDugme} onPress={() => setTakimAcik(true)}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
              <Text style={styles.genisDugmeYazi}>{_t("Takım seç")}</Text>
            </SoundPressable>
          )}

          {/* Canlı önizleme */}
          <View style={styles.onizleme}>
            <View style={styles.onizlemeUst}>
              <Text style={styles.onizlemeBaslik}>{_t("ÖRNEK EŞLEŞMELER")}</Text>
              {onizleme && onizleme.yukleniyor ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : null}
              {nitelik && !onizleme.yukleniyor ? (
                <View style={styles.nitelik}>
                  <Ionicons name={nitelik.ikon} size={14} color={nitelik.renk} />
                  <Text style={[styles.nitelikYazi, { color: nitelik.renk }]} numberOfLines={1}>
                    {onizleme.toplam.toLocaleString(yerel())}{" "}{_t("oyuncu ·")}{" "}{nitelik.yazi}
                  </Text>
                </View>
              ) : null}
            </View>
            {(onizleme && onizleme.ciftler ? onizleme.ciftler : []).map(([a, b]) => (
              <View key={`${a}|${b}`} style={styles.cift}>
                <TeamBadge name={canonicalClub(a)} size={22} />
                <Text style={styles.ciftAd} numberOfLines={1}>{a}</Text>
                <Text style={styles.ciftX}>×</Text>
                <TeamBadge name={canonicalClub(b)} size={22} />
                <Text style={styles.ciftAd} numberOfLines={1}>{b}</Text>
              </View>
            ))}
            {onizleme && onizleme.ciftler && !onizleme.ciftler.length && !onizleme.yukleniyor ? (
              <Text style={[styles.not, { color: COLORS.danger }]}>{_t("Bu seçimle eşleşme çıkmıyor — bir yer ya da dönem daha aç.")}</Text>
            ) : null}
          </View>

          {/* Gelişmiş: kulüp bazında ayar */}
          <SoundPressable style={styles.gelismisBaslik} onPress={() => setGelismis((g) => !g)} accessibilityRole="button" accessibilityState={{ expanded: gelismis }} accessibilityLabel={_t("Gelişmiş")}>
            <Ionicons name="construct-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.gelismisYazi}>{_t("Gelişmiş")}{ozelSayisi ? _t(" · {0} kulüp ayarı", [ozelSayisi]) : ""}</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name={gelismis ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
          </SoundPressable>
          {gelismis ? (
            <View>
              <Text style={styles.not}>{_t("Bir kulübü öne çıkar ya da hiç çıkmasın.")}</Text>
              <View style={styles.aramaKutu}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.arama}
                  value={kulupAra}
                  onChangeText={setKulupAra}
                  placeholder={_t("Kulüp ara")}
                  placeholderTextColor={COLORS.textFaint}
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </View>
              {[...new Set([...Object.keys(taslak.kulupAyar || {}), ...kulupSonuclari])].map((ad) => (
                <KulupSatiri key={ad} ad={ad} durum={(taslak.kulupAyar || {})[ad]} onSec={(d) => kulupAyarla(ad, d)} />
              ))}
            </View>
          ) : null}

          {online ? (
            <Text style={[styles.not, { marginTop: SPACING.md }]}>{_t(
              "Dereceli maçlarda herkes aynı (Dengeli) havuzla oynar; bu seçim arkadaş odalarında geçerli."
            )}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.alt, { paddingBottom: insets.bottom + SPACING.md }]}>
          {ayarlarModu ? (
            <SoundPressable style={styles.anaDugme} onPress={() => onVarsayilanYap && onVarsayilanYap(taslak)}>
              <Text style={styles.anaDugmeYazi}>{_t("KAYDET")}</Text>
            </SoundPressable>
          ) : (
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <SoundPressable style={[styles.anaDugme, { flex: 1.3 }]} onPress={() => onUygula && onUygula(taslak)}>
                <Text style={styles.anaDugmeYazi}>{_t("BU MAÇ İÇİN")}</Text>
              </SoundPressable>
              <SoundPressable style={[styles.ikinciDugme, { flex: 1 }]} onPress={() => onVarsayilanYap && onVarsayilanYap(taslak)}>
                <Text style={styles.ikinciDugmeYazi}>{_t("VARSAYILAN YAP")}</Text>
              </SoundPressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Kurulum ekranlarına tek satırla eklenen bölüm: "EŞLEŞME PROFİLİ [Dengeli · Değiştir ›]".
// eslesme = useEslesmeProfili() sonucu.
export function EslesmeProfiliBolumu({ eslesme, online, not }) {
  const [acik, setAcik] = useState(false);
  return (
    <KurulumBolum baslik={_t("EŞLEŞME PROFİLİ")} not={not}>
      <KapsamDugmesi etiket={eslesme.derlenmis.etiket} onPress={() => setAcik(true)} />
      <EslesmeProfiliPenceresi
        visible={acik}
        profil={eslesme.profil}
        online={online}
        onUygula={(pr) => { eslesme.setMacProfili(pr); setAcik(false); }}
        onVarsayilanYap={(pr) => { eslesme.genelKaydet(pr); setAcik(false); }}
        onClose={() => setAcik(false)}
      />
    </KurulumBolum>
  );
}

const KULUP_DURUMLARI = [
  { deger: "one", etiket: _t("Öne çıkar"), ikon: "star" },
  { deger: "haric", etiket: _t("Hiç çıkmasın"), ikon: "close" },
];
function KulupSatiri({ ad, durum, onSec }) {
  return (
    <View style={styles.kulupSatir}>
      <TeamBadge name={canonicalClub(ad)} size={26} />
      <Text style={styles.kulupAd} numberOfLines={1}>{ad}</Text>
      {KULUP_DURUMLARI.map((k) => {
        const aktif = durum === k.deger;
        return (
          <SoundPressable key={k.deger} style={[styles.kDugme, aktif && styles.kDugmeAktif]} onPress={() => onSec(k.deger)} hitSlop={4} accessibilityLabel={`${ad}: ${k.etiket}`}>
            <Ionicons name={k.ikon} size={14} color={aktif ? COLORS.accentDark : COLORS.textMuted} />
            <Text style={[styles.kDugmeYazi, aktif && { color: COLORS.accentDark }]}>{k.etiket}</Text>
          </SoundPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  ust: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, marginBottom: SPACING.xs },
  baslik: { ...TYPE.h2 },
  altBaslik: { ...TYPE.caption, marginTop: 2 },
  kapat: { padding: 4 },
  icerik: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  eb: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted, textTransform: "uppercase", marginTop: SPACING.lg, marginBottom: SPACING.sm },
  ebIpucu: { letterSpacing: 0, textTransform: "none", fontWeight: "700", color: COLORS.textFaint },
  not: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 17 },

  hazirlar: { gap: SPACING.sm, paddingRight: SPACING.lg },
  hazir: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  hazirAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  hazirYazi: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  hazirYaziAktif: { color: COLORS.accentDark },

  izgara: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  karo: {
    width: "23%", flexGrow: 1, minHeight: 78, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  karoAcik: { borderColor: saydam(COLORS.accent, 0.6), backgroundColor: vurguZemini(0.1) },
  karoCok: { borderColor: COLORS.accent, borderWidth: 2, backgroundColor: vurguZemini(0.22) },
  karoKapali: { opacity: 0.5 },
  karoBayrak: { fontSize: 22 },
  karoAd: { fontSize: 11, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 2 },
  karoDurum: { fontSize: 10, fontWeight: "700", color: COLORS.textFaint, marginTop: 1 },

  seg: { flexDirection: "row", gap: 6 },
  segDugme: {
    flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  segAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  segYazi: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  segYaziAktif: { color: COLORS.accentDark },

  takimSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  takimSol: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  takimAd: { ...TYPE.h3, fontSize: 15, flexShrink: 1 },
  mini: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  miniAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  miniYazi: { fontSize: 12, fontWeight: "800", color: COLORS.text },
  miniYaziAktif: { color: COLORS.accentDark },
  genisDugme: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46,
    borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.accent, borderRadius: RADIUS.md,
  },
  genisDugmeYazi: { ...TYPE.body, color: COLORS.accent, fontWeight: "800" },

  onizleme: {
    marginTop: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: saydam(COLORS.accent, 0.45),
    backgroundColor: vurguZemini(0.07), paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, minHeight: 120,
  },
  onizlemeUst: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 4 },
  onizlemeBaslik: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: COLORS.textMuted, flex: 1 },
  nitelik: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  nitelikYazi: { fontSize: 12, fontWeight: "800" },
  cift: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  ciftAd: { fontSize: 13, fontWeight: "800", color: COLORS.text, flexShrink: 1 },
  ciftX: { fontSize: 12, color: COLORS.textFaint, marginHorizontal: 2 },

  gelismisBaslik: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.lg, paddingVertical: SPACING.sm },
  gelismisYazi: { ...TYPE.caption, fontWeight: "800" },
  aramaKutu: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    minHeight: 46, marginVertical: SPACING.sm,
  },
  arama: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 10 },
  kulupSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 6 },
  kulupAd: { ...TYPE.caption, color: COLORS.text, fontWeight: "700", flex: 1 },
  kDugme: {
    flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, backgroundColor: COLORS.card,
  },
  kDugmeAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  kDugmeYazi: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted },

  alt: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, backgroundColor: COLORS.bg },
  anaDugme: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, minHeight: 52, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { ...TYPE.button, color: COLORS.accentDark },
  ikinciDugme: {
    borderWidth: 2, borderColor: COLORS.accent, borderRadius: RADIUS.md, minHeight: 52,
    alignItems: "center", justifyContent: "center",
  },
  ikinciDugmeYazi: { ...TYPE.button, color: COLORS.accent, fontSize: 13 },
});
