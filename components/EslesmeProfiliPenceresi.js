import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, ScrollView, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import TeamBadge from "./TeamBadge";
import TakimSecici from "./TakimSecici";
import { SecimCipleri, KurulumBolum, KapsamDugmesi } from "./ModKurulum";
import {
  HAZIR_PROFILLER, BOLGE_KADEMELERI, DONEMLER, KUCUK_KULUP, TAKIM_ORANI, LIGLER,
  VARSAYILAN_PROFIL, etkinAyar, profilDerle, profilEtiketi,
} from "../lib/eslesmeProfili";
import { canonicalClub } from "../lib/clubAliases";
import { weightForClubs } from "../lib/clubWeights";
import { COLORS, RADIUS, SPACING, TYPE } from "../lib/theme";

// ============================================================================
// EŞLEŞME PROFİLİ PENCERESİ — 28 Eylül 2026
// Aynı profilin üç editörü:
//   HIZLI    — hazır profil kartları + tuttuğun takım (uğraşmak istemeyen)
//   AYARLA   — 4 basit ayar (orta)
//   DETAYLI  — lig/ülke ağırlıkları, kulüp bazında ayar, dönem sınırı
// Mod kurulumundan açılırsa: "Bu maç için uygula" + "Varsayılan yap".
// Ayarlar'dan açılırsa (ayarlarModu): tek "Kaydet".
// ============================================================================
const SEKMELER = [
  { id: "hizli", etiket: "Hızlı", ikon: "flash" },
  { id: "ayarla", etiket: "Ayarla", ikon: "options" },
  { id: "detayli", etiket: "Detaylı", ikon: "construct" },
];
const AGIRLIK_CIPLERI = [
  { deger: 0, etiket: "Kapalı" },
  { deger: 50, etiket: "Az" },
  { deger: 100, etiket: "Normal" },
  { deger: 200, etiket: "Çok" },
];
const ULKE_SATIRLARI = [
  { anahtar: "ulke:Turkey", ad: "Türkiye (alt ligler)", bayrak: "🇹🇷" },
  { anahtar: "ulke:United Kingdom", ad: "İngiltere (alt ligler)", bayrak: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { anahtar: "ulke:Spain", ad: "İspanya (alt ligler)", bayrak: "🇪🇸" },
  { anahtar: "ulke:Italy", ad: "İtalya (alt ligler)", bayrak: "🇮🇹" },
  { anahtar: "ulke:Germany", ad: "Almanya (alt ligler)", bayrak: "🇩🇪" },
  { anahtar: "ulke:France", ad: "Fransa (alt ligler)", bayrak: "🇫🇷" },
  { anahtar: "ulke:Portugal", ad: "Portekiz", bayrak: "🇵🇹" },
  { anahtar: "ulke:Netherlands", ad: "Hollanda", bayrak: "🇳🇱" },
  { anahtar: "ulke:Brazil", ad: "Brezilya", bayrak: "🇧🇷" },
  { anahtar: "ulke:Argentina", ad: "Arjantin", bayrak: "🇦🇷" },
  { anahtar: "ulke:United States", ad: "ABD (MLS)", bayrak: "🇺🇸" },
  { anahtar: "ulke:Saudi Arabia", ad: "Suudi Arabistan", bayrak: "🇸🇦" },
  { anahtar: "digerleri", ad: "Diğer bütün ülkeler", bayrak: "🌐" },
];
const DONEM_SINIRI = [
  { deger: 0, etiket: "Hepsi" },
  { deger: 1990, etiket: "1990+" },
  { deger: 2000, etiket: "2000+" },
  { deger: 2010, etiket: "2010+" },
  { deger: 2020, etiket: "2020+" },
];

function sade(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

let _kulupAdlari = null;
function kulupAdlari() {
  if (_kulupAdlari) return _kulupAdlari;
  const say = new Map();
  try {
    const P = require("../lib/players.json");
    for (const p of P) for (const c of p.clubs) say.set(c, (say.get(c) || 0) + 1);
  } catch (e) {}
  _kulupAdlari = [...say.entries()]
    .map(([c, n]) => ({ ad: c, sade: sade(c), puan: weightForClubs([c]) * 1000 + n }))
    .sort((a, b) => b.puan - a.puan);
  return _kulupAdlari;
}

// Profilin havuzunda kaç oyuncu var (alt bilgi satırı için).
let _oyuncular = null;
function havuzSayisi(derlenmis) {
  if (!_oyuncular) { try { _oyuncular = require("../lib/players.json"); } catch (e) { _oyuncular = []; } }
  let n = 0;
  for (const p of _oyuncular) if (derlenmis.oyuncuCarpani(p) > 0) n++;
  return n;
}

export default function EslesmeProfiliPenceresi({
  visible, profil, onUygula, onVarsayilanYap, onClose, ayarlarModu, online,
}) {
  const [sekme, setSekme] = useState("hizli");
  const [taslak, setTaslak] = useState({ ...VARSAYILAN_PROFIL, ...(profil || {}) });
  const [takimAcik, setTakimAcik] = useState(false);
  const [kulupAra, setKulupAra] = useState("");

  useEffect(() => {
    if (visible) {
      setTaslak({ ...VARSAYILAN_PROFIL, ...(profil || {}) });
      setTakimAcik(false);
      setKulupAra("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const anahtar = JSON.stringify(taslak);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derlenmis = useMemo(() => profilDerle(taslak), [anahtar]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const havuz = useMemo(() => (visible ? havuzSayisi(derlenmis) : 0), [anahtar, visible]);
  const ayar = etkinAyar(taslak);
  const temel = HAZIR_PROFILLER.find((h) => h.id === taslak.temel) || HAZIR_PROFILLER[0];

  const guncelle = (degisim) => setTaslak((t) => ({ ...t, ...degisim }));
  function hazirSec(id) {
    setTaslak((t) => ({
      ...VARSAYILAN_PROFIL, temel: id, takim: t.takim, takimOrani: t.takimOrani,
    }));
  }
  function ligAgirligi(id) {
    if (taslak.ligAgirlik && taslak.ligAgirlik[id] != null) return taslak.ligAgirlik[id];
    if (temel.kapsam && temel.kapsam.ligler) return temel.kapsam.ligler.includes(id) ? 100 : 0;
    return 100;
  }
  function ligAyarla(id, deger) {
    guncelle({ ligAgirlik: { ...(taslak.ligAgirlik || {}), [id]: deger } });
  }
  function kulupAyarla(ad, durum) {
    const k = { ...(taslak.kulupAyar || {}) };
    if (!durum || k[ad] === durum) delete k[ad]; else k[ad] = durum;
    guncelle({ kulupAyar: k });
  }

  const kulupSonuclari = useMemo(() => {
    const q = sade(kulupAra.trim());
    if (q.length < 2) return [];
    return kulupAdlari().filter((k) => k.sade.includes(q)).slice(0, 12).map((k) => k.ad);
  }, [kulupAra]);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.kap}>
        <View style={styles.ust}>
          <View style={{ flex: 1 }}>
            <Text style={styles.baslik}>Eşleşme Profili</Text>
            <Text style={styles.altBaslik} numberOfLines={1}>{profilEtiketi(taslak)}</Text>
          </View>
          <SoundPressable onPress={onClose} hitSlop={12} style={styles.kapat}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </SoundPressable>
        </View>

        <View style={styles.sekmeler}>
          {SEKMELER.map((s) => {
            const aktif = sekme === s.id;
            return (
              <SoundPressable key={s.id} style={[styles.sekme, aktif && styles.sekmeAktif]} onPress={() => setSekme(s.id)}>
                <Ionicons name={s.ikon} size={16} color={aktif ? COLORS.accentDark : COLORS.textMuted} />
                <Text style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}>{s.etiket}</Text>
              </SoundPressable>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
          {sekme === "hizli" ? (
            <>
              <Text style={styles.not}>Tek dokunuşla seç. İstersen "Ayarla" ya da "Detaylı" sekmesinden ince ayar yaparsın.</Text>
              <View style={styles.kartlar}>
                {HAZIR_PROFILLER.map((h) => {
                  const aktif = taslak.temel === h.id;
                  return (
                    <SoundPressable key={h.id} style={[styles.kart, aktif && styles.kartAktif]} onPress={() => hazirSec(h.id)}>
                      <Text style={styles.kartIkon}>{h.ikon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.kartAd, aktif && styles.kartAdAktif]}>{h.ad}</Text>
                        <Text style={styles.kartAciklama} numberOfLines={2}>{h.aciklama}</Text>
                      </View>
                      {aktif ? <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} /> : null}
                    </SoundPressable>
                  );
                })}
              </View>

              <KurulumBolum baslik="TUTTUĞUN TAKIM">
                {taslak.takim && !takimAcik ? (
                  <View style={styles.takimSatir}>
                    <TeamBadge name={taslak.takim} size={36} />
                    <Text style={styles.takimAd} numberOfLines={1}>{taslak.takim}</Text>
                    <SoundPressable onPress={() => setTakimAcik(true)} style={styles.kucukDugme}>
                      <Text style={styles.kucukDugmeYazi}>Değiştir</Text>
                    </SoundPressable>
                    <SoundPressable onPress={() => guncelle({ takim: null })} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
                    </SoundPressable>
                  </View>
                ) : takimAcik ? (
                  <TakimSecici secili={taslak.takim} kompakt onSec={(t) => { guncelle({ takim: t }); setTakimAcik(false); }} />
                ) : (
                  <SoundPressable style={styles.genisDugme} onPress={() => setTakimAcik(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                    <Text style={styles.genisDugmeYazi}>Takım seç</Text>
                  </SoundPressable>
                )}
              </KurulumBolum>
              {taslak.takim ? (
                <KurulumBolum baslik="TAKIMIN NE SIKLIKLA ÇIKSIN">
                  <SecimCipleri secenekler={TAKIM_ORANI} secili={taslak.takimOrani} onSec={(v) => guncelle({ takimOrani: v })} />
                </KurulumBolum>
              ) : null}
            </>
          ) : null}

          {sekme === "ayarla" ? (
            <>
              <Text style={styles.not}>Temel: {temel.ikon} {temel.ad}. Değiştirdiğin her ayar bu profilin üstüne yazılır.</Text>
              <KurulumBolum baslik="BÖLGE DENGESİ">
                <SecimCipleri
                  secenekler={BOLGE_KADEMELERI.map((b) => ({ deger: b.deger, etiket: b.etiket }))}
                  secili={ayar.bolge}
                  onSec={(v) => guncelle({ bolge: v })}
                />
                {temel.kapsam ? <Text style={styles.not}>Bu hazır profil belirli liglerle sınırlı; denge o ligler içinde uygulanır.</Text> : null}
              </KurulumBolum>
              <KurulumBolum baslik="DÖNEM">
                <SecimCipleri secenekler={DONEMLER} secili={ayar.donem} onSec={(v) => guncelle({ donem: v })} />
                <Text style={styles.not}>{(DONEMLER.find((d) => d.deger === ayar.donem) || {}).aciklama}</Text>
              </KurulumBolum>
              <KurulumBolum baslik="KÜÇÜK KULÜPLER">
                <SecimCipleri secenekler={KUCUK_KULUP} secili={ayar.kucukKulup} onSec={(v) => guncelle({ kucukKulup: v })} />
                <Text style={styles.not}>Pek tanınmayan kulüpler (alt ligler, küçük takımlar) ne kadar çıksın.</Text>
              </KurulumBolum>
              <KurulumBolum baslik="TUTTUĞUN TAKIM NE SIKLIKLA ÇIKSIN">
                {taslak.takim ? (
                  <SecimCipleri secenekler={TAKIM_ORANI} secili={taslak.takimOrani} onSec={(v) => guncelle({ takimOrani: v })} />
                ) : (
                  <SoundPressable style={styles.genisDugme} onPress={() => { setSekme("hizli"); setTakimAcik(true); }}>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                    <Text style={styles.genisDugmeYazi}>Önce takımını seç</Text>
                  </SoundPressable>
                )}
              </KurulumBolum>
              {taslak.bolge != null || taslak.donem != null || taslak.kucukKulup != null ? (
                <SoundPressable style={styles.sifirla} onPress={() => guncelle({ bolge: null, donem: null, kucukKulup: null })}>
                  <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
                  <Text style={styles.sifirlaYazi}>"{temel.ad}" ayarlarına dön</Text>
                </SoundPressable>
              ) : null}
            </>
          ) : null}

          {sekme === "detayli" ? (
            <>
              <KurulumBolum baslik="LİGLER (GÜNCEL ÜST LİGLER)">
                {LIGLER.map((l) => (
                  <View key={l.id} style={styles.agirlikSatir}>
                    <Text style={styles.agirlikAd} numberOfLines={1}>{l.bayrak} {l.ad}</Text>
                    <AgirlikCipleri deger={ligAgirligi(l.id)} onSec={(v) => ligAyarla(l.id, v)} />
                  </View>
                ))}
              </KurulumBolum>
              <KurulumBolum baslik="ÜLKELER (YUKARIDAKİ LİGLER DIŞINDAKİ KULÜPLER)">
                {temel.kapsam ? <Text style={styles.not}>"{temel.ad}" profili sadece seçili liglerle sınırlı; buradaki ayarlar ancak "Dengeli", "Türkiye Ağırlıklı", "Nostalji" ya da "Dünya Futbolu" temelinde işe yarar.</Text> : null}
                {ULKE_SATIRLARI.map((u) => (
                  <View key={u.anahtar} style={styles.agirlikSatir}>
                    <Text style={styles.agirlikAd} numberOfLines={1}>{u.bayrak} {u.ad}</Text>
                    <AgirlikCipleri
                      deger={taslak.ligAgirlik && taslak.ligAgirlik[u.anahtar] != null ? taslak.ligAgirlik[u.anahtar] : 100}
                      onSec={(v) => ligAyarla(u.anahtar, v)}
                    />
                  </View>
                ))}
              </KurulumBolum>
              <KurulumBolum baslik="KULÜPLER">
                <Text style={styles.not}>Bir kulübü öne çıkar, her zaman dahil et ya da hiç çıkmasın.</Text>
                <View style={styles.aramaKutu}>
                  <Ionicons name="search" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.arama}
                    value={kulupAra}
                    onChangeText={setKulupAra}
                    placeholder="Kulüp ara"
                    placeholderTextColor={COLORS.textFaint}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </View>
                {[...new Set([...Object.keys(taslak.kulupAyar || {}), ...kulupSonuclari])].map((ad) => (
                  <KulupSatiri key={ad} ad={ad} durum={(taslak.kulupAyar || {})[ad]} onSec={(d) => kulupAyarla(ad, d)} />
                ))}
              </KurulumBolum>
              <KurulumBolum baslik="EN ERKEN DÖNEM">
                <SecimCipleri
                  secenekler={DONEM_SINIRI}
                  secili={taslak.yilAraligi ? taslak.yilAraligi[0] : 0}
                  onSec={(v) => guncelle({ yilAraligi: v ? [v, null] : null })}
                />
                <Text style={styles.not}>Seçilen yıldan önce futbolu bırakmış oyuncular çıkmaz.</Text>
              </KurulumBolum>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.alt}>
          <Text style={[styles.havuz, havuz < 40 && { color: COLORS.danger }]}>
            {havuz < 40
              ? `Bu profille sadece ${havuz} oyuncu kalıyor — biraz genişlet.`
              : `Bu profille ${havuz.toLocaleString("tr-TR")} oyuncu havuzda.`}
            {online ? " Online odada sadece kulüp kapsamı uygulanır." : ""}
          </Text>
          {ayarlarModu ? (
            <SoundPressable style={styles.anaDugme} onPress={() => onVarsayilanYap && onVarsayilanYap(taslak)}>
              <Text style={styles.anaDugmeYazi}>KAYDET</Text>
            </SoundPressable>
          ) : (
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <SoundPressable style={[styles.anaDugme, { flex: 1.3 }]} onPress={() => onUygula && onUygula(taslak)}>
                <Text style={styles.anaDugmeYazi}>BU MAÇ İÇİN</Text>
              </SoundPressable>
              <SoundPressable style={[styles.ikinciDugme, { flex: 1 }]} onPress={() => onVarsayilanYap && onVarsayilanYap(taslak)}>
                <Text style={styles.ikinciDugmeYazi}>VARSAYILAN YAP</Text>
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
    <KurulumBolum baslik="EŞLEŞME PROFİLİ" not={not}>
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

function AgirlikCipleri({ deger, onSec }) {
  return (
    <View style={styles.agirlikCipler}>
      {AGIRLIK_CIPLERI.map((a) => {
        const aktif = deger === a.deger;
        return (
          <SoundPressable key={a.deger} style={[styles.aCip, aktif && styles.aCipAktif]} onPress={() => onSec(a.deger)}>
            <Text style={[styles.aCipYazi, aktif && styles.aCipYaziAktif]}>{a.etiket}</Text>
          </SoundPressable>
        );
      })}
    </View>
  );
}

const KULUP_DURUMLARI = [
  { deger: "one", etiket: "Öne çıkar", ikon: "star" },
  { deger: "dahil", etiket: "Dahil", ikon: "checkmark" },
  { deger: "haric", etiket: "Hariç", ikon: "close" },
];
function KulupSatiri({ ad, durum, onSec }) {
  return (
    <View style={styles.kulupSatir}>
      <TeamBadge name={canonicalClub(ad)} size={26} />
      <Text style={styles.kulupAd} numberOfLines={1}>{ad}</Text>
      {KULUP_DURUMLARI.map((k) => {
        const aktif = durum === k.deger;
        return (
          <SoundPressable key={k.deger} style={[styles.kDugme, aktif && styles.kDugmeAktif]} onPress={() => onSec(k.deger)} hitSlop={4}>
            <Ionicons name={k.ikon} size={14} color={aktif ? COLORS.accentDark : COLORS.textMuted} />
          </SoundPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 48 },
  ust: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  baslik: { ...TYPE.h1 },
  altBaslik: { ...TYPE.caption, color: COLORS.accent, marginTop: 2 },
  kapat: { padding: 4 },
  sekmeler: {
    flexDirection: "row", marginHorizontal: SPACING.lg, backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, padding: 4, gap: 4, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  sekme: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, borderRadius: RADIUS.sm },
  sekmeAktif: { backgroundColor: COLORS.accent },
  sekmeYazi: { ...TYPE.caption, fontWeight: "900", color: COLORS.textMuted },
  sekmeYaziAktif: { color: COLORS.accentDark },
  icerik: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  not: { ...TYPE.caption, color: COLORS.textFaint, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  kartlar: { gap: SPACING.sm },
  kart: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 64,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  kartAktif: { borderColor: COLORS.accent },
  kartIkon: { fontSize: 24 },
  kartAd: { ...TYPE.h3 },
  kartAdAktif: { color: COLORS.accent },
  kartAciklama: { ...TYPE.caption, marginTop: 2 },
  takimSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  takimAd: { ...TYPE.h3, flex: 1 },
  kucukDugme: { borderWidth: 1, borderColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  kucukDugmeYazi: { ...TYPE.caption, color: COLORS.accent, fontWeight: "800" },
  genisDugme: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48,
    borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.accent, borderRadius: RADIUS.md,
  },
  genisDugmeYazi: { ...TYPE.body, color: COLORS.accent, fontWeight: "800" },
  sifirla: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", marginTop: SPACING.lg, padding: SPACING.sm },
  sifirlaYazi: { ...TYPE.caption },
  agirlikSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 6 },
  agirlikAd: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", flex: 1 },
  agirlikCipler: { flexDirection: "row", gap: 4 },
  aCip: {
    minWidth: 50, minHeight: 34, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, paddingHorizontal: 6, backgroundColor: COLORS.card,
  },
  aCipAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  aCipYazi: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted },
  aCipYaziAktif: { color: COLORS.accentDark },
  aramaKutu: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    minHeight: 46, marginBottom: SPACING.sm,
  },
  arama: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 10 },
  kulupSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 6 },
  kulupAd: { ...TYPE.caption, color: COLORS.text, fontWeight: "700", flex: 1 },
  kDugme: {
    width: 36, height: 34, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, backgroundColor: COLORS.card,
  },
  kDugmeAktif: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  alt: {
    padding: SPACING.lg, paddingBottom: SPACING.xl, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
    backgroundColor: COLORS.bg, gap: SPACING.sm,
  },
  havuz: { ...TYPE.caption, textAlign: "center" },
  anaDugme: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, minHeight: 52, alignItems: "center", justifyContent: "center" },
  anaDugmeYazi: { ...TYPE.button, color: COLORS.accentDark },
  ikinciDugme: {
    borderWidth: 2, borderColor: COLORS.accent, borderRadius: RADIUS.md, minHeight: 52,
    alignItems: "center", justifyContent: "center",
  },
  ikinciDugmeYazi: { ...TYPE.button, color: COLORS.accent, fontSize: 13 },
});
