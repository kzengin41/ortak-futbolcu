import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import BackButton from "../components/BackButton";
import TeamBadge from "../components/TeamBadge";
import AnswerFeedback from "../components/AnswerFeedback";
import PoolEmpty from "../components/PoolEmpty";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers } from "../lib/gameEngine";
import { useCorrectSound, useWrongSound } from "../lib/useGameSounds";
import { unlockPlayer } from "../lib/pokedex";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import {
  izgaraUret, baslangicDurumu, aksiyonuIsle, hucreCevaplari, kareTukendiMi,
  cpuHucreSec, cpuCevapSec, sonucMetni, ZORLUKLAR, VARSAYILAN_ZORLUK, X, O,
} from "../lib/gridGame";

// ============================================================================
// FUTBOLCU XOX — 12 Eylül 2026 (Kerem: "xox oyunu da eklemek istiyorum.
// hem vs cpu hem aynı ekranda arkadaşla oynama şekli.")
//
// Kurallar lib/gridGame.js'te, saf ve Node testleriyle doğrulanmış. Bu dosya
// yalnızca çizim, CPU'nun gecikmeleri ve girdi.
//
// İki mod TEK ekranda: "cpu" ve "iki" (aynı telefon). Aradaki fark sadece
// O sırasının kimin tarafından oynandığı — kural kodu ikisinde de aynı.
// ============================================================================

const VURGU = MODE_COLORS.hotSeat;

export default function XoxScreen({ onExit, onExitSilent }) {
  const playCorrect = useCorrectSound();
  const playWrong = useWrongSound();

  const [rakipTipi, setRakipTipi] = useState("cpu");   // "cpu" | "iki"
  const [zorluk, setZorluk] = useState(VARSAYILAN_ZORLUK);
  const [basladi, setBasladi] = useState(false);
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [durum, setDurum] = useState(null);
  const [girdi, setGirdi] = useState("");
  const [geriBildirim, setGeriBildirim] = useState(null);
  const [cpuDusunuyor, setCpuDusunuyor] = useState(false);
  const [uretilemedi, setUretilemedi] = useState(false);

  const baglam = useMemo(() => ({ veriSeti: PLAYERS }), []);
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(
    () => (girdi.trim().length < 3 ? [] : suggestPlayers(suggestIndex, girdi)),
    [suggestIndex, girdi]
  );

  const cpuyaKarsi = rakipTipi === "cpu";
  // CPU her zaman O; insan (ya da 1. oyuncu) X. Böylece "sıra bende mi"
  // sorusunun cevabı tek bir yerde duruyor.
  const benimSiram = !cpuyaKarsi || durum?.sira === X;

  const zamanlayiciRef = useRef(null);
  useEffect(() => () => { if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current); }, []);

  const yeniOyun = useCallback(() => {
    setHazirlaniyor(true);
    setUretilemedi(false);
    // Izgara üretimi ilk çağrıda ikili tablosunu kuruyor (~0,1 sn). Bir kare
    // bekletip göstergeyi çizdiriyoruz ki ekran donuk açılmasın.
    setTimeout(() => {
      // 13 Eylül 2026 (Kerem: "gelen takımlar zorluk derecesine göre daha kolay
      // olmalı") — ızgara ARTIK zorluğa göre kuruluyor; eskiden zorluk sadece
      // CPU'yu etkiliyordu, soru her seviyede aynı zorluktaydı.
      const izgara = izgaraUret(PLAYERS, zorluk);
      if (!izgara) { setUretilemedi(true); setHazirlaniyor(false); return; }
      // veriSeti veriliyor: dokuz karenin cevapları bir kez hesaplanıp durumda
      // saklanıyor (bkz. lib/gridGame.js baslangicDurumu).
      setDurum(baslangicDurumu(izgara, X, PLAYERS));
      setGirdi("");
      setGeriBildirim(null);
      setHazirlaniyor(false);
      setBasladi(true);
    }, 40);
  }, [zorluk]);

  // --- CPU sırası ----------------------------------------------------------
  useEffect(() => {
    if (!durum || durum.bitti || !cpuyaKarsi) return;
    if (durum.sira !== O || durum.secili) return;

    setCpuDusunuyor(true);
    zamanlayiciRef.current = setTimeout(() => {
      setCpuDusunuyor(false);
      setDurum((d) => {
        if (!d || d.bitti || d.sira !== O) return d;
        const indis = cpuHucreSec(d, zorluk, Math.random, PLAYERS);
        if (indis === null) return d;
        const satir = Math.floor(indis / 3);
        const sutun = indis % 3;
        const secili = aksiyonuIsle(d, { tip: "hucreSec", satir, sutun }, baglam) || d;
        const ad = cpuCevapSec(secili, satir, sutun, baglam, zorluk);
        const sonraki = ad
          ? aksiyonuIsle(secili, { tip: "cevap", metin: ad }, baglam)
          : aksiyonuIsle(secili, { tip: "pas" }, baglam);
        return sonraki || secili;
      });
    }, 900 + Math.random() * 900);

    return () => { if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current); };
  }, [durum, cpuyaKarsi, zorluk, baglam]);

  // --- Hamle sonrası ses + geri bildirim -----------------------------------
  const islenenHamleRef = useRef(null);
  useEffect(() => {
    const h = durum?.sonHamle;
    if (!h || h === islenenHamleRef.current) return;
    islenenHamleRef.current = h;

    const cpuHamlesi = cpuyaKarsi && h.kimden === O;
    if (h.tip === "dogru") {
      playCorrect();
      unlockPlayer(h.ad);
      setGeriBildirim({ correct: true, message: cpuHamlesi ? `CPU: ${h.ad}` : h.ad });
    } else if (h.tip === "yanlis") {
      playWrong();
      setGeriBildirim({
        correct: false,
        message: cpuHamlesi ? `CPU bilemedi: ${h.metin}` : "Bu futbolcu bu ikilide oynamadı",
      });
    } else if (h.tip === "pas") {
      setGeriBildirim({ correct: false, message: cpuHamlesi ? "CPU pas geçti" : "Pas geçtin" });
    }
  }, [durum?.sonHamle, cpuyaKarsi, playCorrect, playWrong]);

  // --- Maç sonu: istatistik + XP (bir kez) ---------------------------------
  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (!durum?.bitti) { macIslendiRef.current = false; return; }
    if (macIslendiRef.current) return;
    macIslendiRef.current = true;

    const modId = cpuyaKarsi ? "xoxCpu" : "xox";
    if (cpuyaKarsi) {
      const kazandim = durum.kazanan === X;
      recordRound(modId, kazandim);
      addXP(kazandim ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
    } else {
      // İki kişilik modda "kazanan" bu cihazın sahibi olmayabilir; istatistiğe
      // galibiyet/mağlubiyet yazmak yanıltıcı olurdu. Sadece oynandı bilgisi
      // için 1. oyuncunun sonucunu yazıyoruz (yerel modda da böyle).
      recordRound(modId, durum.kazanan === X);
    }
  }, [durum?.bitti, durum?.kazanan, cpuyaKarsi]);

  function hucreyeDokun(satir, sutun) {
    if (!durum || durum.bitti || !benimSiram || cpuDusunuyor) return;
    // Bu karede kullanılmamış geçerli cevap kalmadıysa dokunmak boşuna —
    // oyuncu bilmediği için değil, cevap KALMADIĞI için kaybediyor olurdu.
    if (kareTukendiMi(durum, satir, sutun, PLAYERS)) {
      setGeriBildirim({ correct: false, message: "Bu karenin cevapları tükendi" });
      return;
    }
    const yeni = aksiyonuIsle(durum, { tip: "hucreSec", satir, sutun }, baglam);
    if (yeni) { setDurum(yeni); setGirdi(""); }
  }

  function cevapGonder(ad) {
    const metin = String(ad ?? girdi).trim();
    if (!metin || !durum?.secili) return;
    setGirdi("");
    const yeni = aksiyonuIsle(durum, { tip: "cevap", metin }, baglam);
    if (yeni) setDurum(yeni);
  }

  // ---------------------------------------------------------------- kurulum
  if (uretilemedi) {
    return <PoolEmpty onReset={yeniOyun} onExit={onExit} />;
  }

  if (!basladi) {
    return (
      <GameBackground style={styles.kap}>
        <BackButton onPress={onExitSilent || onExit} />
        <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
          <Text style={styles.ustBaslik}>FUTBOLCU XOX</Text>
          <Text style={styles.aciklama}>
            Izgaranın satır ve sütunlarında kulüpler var. Bir kareyi almak için o
            karenin iki kulübünde de oynamış bir futbolcu söyle. Üçlü sırayı yapan
            kazanır.
          </Text>

          <Text style={styles.blokBaslik}>RAKİP</Text>
          <View style={styles.secimSatir}>
            {[
              { id: "cpu", label: "CPU'ya karşı", ikon: "hardware-chip" },
              { id: "iki", label: "2 Kişi (aynı telefon)", ikon: "people" },
            ].map((s) => {
              const aktif = rakipTipi === s.id;
              return (
                <SoundPressable
                  key={s.id}
                  style={[styles.secimKart, aktif && styles.secimKartAktif]}
                  onPress={() => setRakipTipi(s.id)}
                >
                  <Ionicons name={s.ikon} size={20} color={aktif ? COLORS.accentDark : COLORS.accent} />
                  <Text style={[styles.secimText, aktif && styles.secimTextAktif]}>{s.label}</Text>
                </SoundPressable>
              );
            })}
          </View>

          {/* Zorluk İKİ modda da seçilebiliyor: ızgaranın zorluğunu belirlediği
              için 2 kişilik oyunda da anlamlı. */}
          <Text style={styles.blokBaslik}>ZORLUK</Text>
          <View style={styles.zorlukListe}>
            {ZORLUKLAR.map((z) => {
              const aktif = zorluk === z.id;
              return (
                <SoundPressable
                  key={z.id}
                  style={[styles.zorlukSatir, aktif && styles.zorlukSatirAktif]}
                  onPress={() => setZorluk(z.id)}
                >
                  <View style={styles.zorlukNokta}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.nokta,
                          i < z.id && { backgroundColor: aktif ? COLORS.accentDark : COLORS.accent },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.zorlukEtiket, aktif && styles.secimTextAktif]}>{z.etiket}</Text>
                    <Text style={[styles.zorlukAciklama, aktif && { color: COLORS.accentDark }]}>
                      {z.aciklama}
                    </Text>
                  </View>
                  {aktif && <Ionicons name="checkmark-circle" size={18} color={COLORS.accentDark} />}
                </SoundPressable>
              );
            })}
          </View>
          <Text style={styles.zorlukNot}>
            {cpuyaKarsi
              ? "Zorluk hem ızgaradaki kulüpleri hem CPU'nun ne kadar iyi oynadığını belirler."
              : "Zorluk ızgaradaki kulüpleri ve karelerin ne kadar kolay doldurulacağını belirler."}
          </Text>

          <SoundPressable style={styles.anaBtn} onPress={yeniOyun} disabled={hazirlaniyor}>
            {hazirlaniyor ? (
              <ActivityIndicator color={COLORS.accentDark} />
            ) : (
              <Text style={styles.anaBtnText}>BAŞLA</Text>
            )}
          </SoundPressable>
        </ScrollView>
      </GameBackground>
    );
  }

  // ---------------------------------------------------------------- oyun
  const secili = durum.secili;
  const seciliCevapSayisi = secili
    ? hucreCevaplari(PLAYERS, durum.izgara, secili.satir, secili.sutun).length
    : 0;

  const siraEtiketi = durum.bitti
    ? sonucMetni(durum, cpuyaKarsi)
    : cpuyaKarsi
    ? (durum.sira === X ? "Sıra sende" : cpuDusunuyor ? "CPU düşünüyor..." : "CPU oynuyor")
    : (durum.sira === X ? "1. Oyuncu (X)" : "2. Oyuncu (O)");

  return (
    <GameBackground style={styles.kap}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BackButton onPress={onExitSilent || onExit} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
          // iOS'ta klavye açılınca içeriği kendiliğinden yukarı iter; panel
          // zaten üstte ama uzun ızgaralarda bu da işe yarıyor.
          automaticallyAdjustKeyboardInsets
        >
          {!secili && !durum.bitti && benimSiram && (
            <Text style={styles.ipucu}>Almak istediğin kareye dokun</Text>
          )}

          <View style={styles.siraSerit}>
            <View style={[styles.isaretRozet, { backgroundColor: durum.sira === X ? VURGU.main : COLORS.card }]}>
              <Text style={[styles.isaretRozetText, durum.sira === X && { color: COLORS.accentDark }]}>X</Text>
            </View>
            <Text style={styles.siraText}>{siraEtiketi}</Text>
            <View style={[styles.isaretRozet, { backgroundColor: durum.sira === O ? VURGU.main : COLORS.card }]}>
              <Text style={[styles.isaretRozetText, durum.sira === O && { color: COLORS.accentDark }]}>O</Text>
            </View>
          </View>

          {/* --- CEVAP ALANI ---
              13 Eylül 2026 (Kerem: "cevap verme kısmı aşırı aşağıda kalıyor.
              klavye kapatıyor.") — panel eskiden ekranın EN ALTINDA sabitti;
              klavye açılınca tam onun üstüne biniyordu. Artık ızgaranın
              ÜSTÜNDE, sıra şeridinin hemen altında duruyor: klavye ekranın alt
              yarısını kaplasa bile girdi kutusu görünür kalıyor. Hangi kareyi
              doldurduğun zaten başlıkta ("Arsenal + Chelsea") yazdığı için
              ızgaranın görünmesi şart değil. */}
          {secili && !durum.bitti && benimSiram && (
            <View style={styles.cevapPaneli}>
              <Text style={styles.hedefText}>
                {durum.izgara.satirlar[secili.satir]} + {durum.izgara.sutunlar[secili.sutun]}
              </Text>
              <Text style={styles.hedefAlt}>{seciliCevapSayisi} olası cevap</Text>

              <View style={styles.girdiSatir}>
                <TextInput
                  style={styles.girdi}
                  placeholder="Futbolcu adı yaz..."
                  placeholderTextColor={COLORS.textFaint}
                  value={girdi}
                  onChangeText={setGirdi}
                  onSubmitEditing={() => cevapGonder()}
                  returnKeyType="send"
                  autoCorrect={false}
                  autoFocus
                />
                <SoundPressable style={styles.gonderBtn} onPress={() => cevapGonder()}>
                  <Ionicons name="send" size={18} color={COLORS.accentDark} />
                </SoundPressable>
              </View>

              {oneriler.length > 0 && (
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  style={styles.oneriSerit}
                >
                  {oneriler.map((ad) => (
                    <SoundPressable key={ad} style={styles.oneriCip} onPress={() => cevapGonder(ad)}>
                      <Text style={styles.oneriCipText}>{ad}</Text>
                    </SoundPressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.altBtnSatir}>
                <SoundPressable
                  onPress={() => setDurum(aksiyonuIsle(durum, { tip: "secimiIptal" }, baglam) || durum)}
                >
                  <Text style={styles.kucukLink}>Başka kare seç</Text>
                </SoundPressable>
                <SoundPressable
                  onPress={() => setDurum(aksiyonuIsle(durum, { tip: "pas" }, baglam) || durum)}
                >
                  <Text style={styles.kucukLink}>Pas geç</Text>
                </SoundPressable>
              </View>
            </View>
          )}

          {/* --- IZGARA --- */}
          <View style={styles.izgara}>
            {/* Üst başlık satırı: köşe boş + sütun kulüpleri */}
            <View style={styles.izgaraSatir}>
              <View style={styles.kose} />
              {durum.izgara.sutunlar.map((k) => (
                <View key={k} style={styles.baslikHucre}>
                  <TeamBadge name={k} size={26} />
                  <Text style={styles.baslikText} numberOfLines={2}>{k}</Text>
                </View>
              ))}
            </View>

            {durum.izgara.satirlar.map((satirKulup, r) => (
              <View key={satirKulup} style={styles.izgaraSatir}>
                <View style={styles.baslikHucre}>
                  <TeamBadge name={satirKulup} size={26} />
                  <Text style={styles.baslikText} numberOfLines={2}>{satirKulup}</Text>
                </View>
                {durum.izgara.sutunlar.map((_, c) => {
                  const indis = r * 3 + c;
                  const sahip = durum.tahta[indis];
                  const sahipBilgi = durum.hucreSahipleri[`${r}-${c}`];
                  const seciliMi = secili?.satir === r && secili?.sutun === c;
                  const kazananDa = durum.kazananCizgi?.includes(indis);
                  const tukendi = !sahip && kareTukendiMi(durum, r, c, PLAYERS);
                  return (
                    <SoundPressable
                      key={c}
                      style={[
                        styles.hucre,
                        seciliMi && styles.hucreSecili,
                        sahip === X && styles.hucreX,
                        sahip === O && styles.hucreO,
                        kazananDa && styles.hucreKazanan,
                        tukendi && styles.hucreTukendi,
                      ]}
                      onPress={() => hucreyeDokun(r, c)}
                    >
                      {sahip ? (
                        <>
                          <Text style={[styles.hucreIsaret, sahip === O && { color: COLORS.cta }]}>
                            {sahip === X ? "X" : "O"}
                          </Text>
                          <Text style={styles.hucreAd} numberOfLines={2}>{sahipBilgi?.ad}</Text>
                        </>
                      ) : (
                        <Ionicons
                          name={tukendi ? "close" : seciliMi ? "create" : "add"}
                          size={18}
                          color={seciliMi ? VURGU.main : COLORS.textFaint}
                        />
                      )}
                    </SoundPressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* --- MAÇ SONU --- */}
          {durum.bitti && (
            <View style={styles.sonucKart}>
              <Text style={styles.sonucBaslik}>{sonucMetni(durum, cpuyaKarsi)}</Text>
              <Text style={styles.sonucAlt}>
                {durum.kullanilanlar.length} doğru cevap
              </Text>
              <View style={styles.sonucBtnSatir}>
                <SoundPressable style={styles.anaBtnKucuk} onPress={yeniOyun}>
                  <Text style={styles.anaBtnText}>YENİ IZGARA</Text>
                </SoundPressable>
                <SoundPressable style={styles.ikincilBtn} onPress={() => setBasladi(false)}>
                  <Text style={styles.ikincilBtnText}>Ayarlar</Text>
                </SoundPressable>
              </View>
            </View>
          )}

          {/* Kullanılan futbolcular — aynı isim iki kez kullanılamadığı için
              oyuncunun bunu görmesi gerekiyor. */}
          {durum.kullanilanlar.length > 0 && !durum.bitti && (
            <View style={styles.kullanilanKutu}>
              <Text style={styles.kullanilanBaslik}>KULLANILANLAR</Text>
              <Text style={styles.kullanilanText}>{durum.kullanilanlar.join(" · ")}</Text>
            </View>
          )}
        </ScrollView>

        {geriBildirim && (
          <View style={styles.geriBildirimSarmal} pointerEvents="none">
            <AnswerFeedback
              correct={geriBildirim.correct}
              message={geriBildirim.message}
              onDone={() => setGeriBildirim(null)}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },

  ustBaslik: { ...TYPE.h1, textAlign: "center", marginTop: SPACING.md },
  aciklama: { ...TYPE.bodyMuted, textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.xl },
  blokBaslik: { ...TYPE.eyebrow, color: VURGU.main, fontSize: 11, marginBottom: SPACING.sm },

  secimSatir: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  secimKart: {
    flex: 1, alignItems: "center", gap: SPACING.xs,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  zorlukListe: { gap: SPACING.sm, marginBottom: SPACING.md },
  zorlukSatir: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
  },
  zorlukSatirAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  zorlukNokta: { flexDirection: "row", gap: 3 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.cardBorder },
  zorlukEtiket: { ...TYPE.h3, fontSize: 14 },
  zorlukAciklama: { ...TYPE.caption, fontSize: 11, marginTop: 1 },
  secimKartAktif: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  secimText: { ...TYPE.caption, color: COLORS.text, fontWeight: "800", textAlign: "center" },
  secimTextAktif: { color: COLORS.accentDark },
  zorlukNot: { ...TYPE.caption, marginBottom: SPACING.lg },

  siraSerit: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.md, marginBottom: SPACING.md,
  },
  isaretRozet: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    borderColor: COLORS.cardBorder, borderWidth: 1,
  },
  isaretRozetText: { ...TYPE.h3, color: COLORS.textMuted },
  siraText: { ...TYPE.h3, fontSize: 15, flex: 1, textAlign: "center" },

  izgara: { gap: 4 },
  izgaraSatir: { flexDirection: "row", gap: 4 },
  kose: { flex: 1 },
  baslikHucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    gap: 2, paddingHorizontal: 2,
  },
  baslikText: { ...TYPE.caption, fontSize: 9, textAlign: "center", color: COLORS.textMuted },
  hucre: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 2,
    borderRadius: RADIUS.sm, padding: 2,
  },
  hucreSecili: { borderColor: VURGU.main },
  hucreX: { backgroundColor: "#173A22", borderColor: COLORS.accent },
  hucreO: { backgroundColor: "#3D2600", borderColor: COLORS.cta },
  hucreKazanan: { borderWidth: 3, borderColor: VURGU.main },
  hucreTukendi: { opacity: 0.4 },
  hucreIsaret: { ...TYPE.h2, color: COLORS.accent },
  hucreAd: { ...TYPE.caption, fontSize: 8, textAlign: "center", color: COLORS.textMuted },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  sonucAlt: { ...TYPE.caption, marginTop: SPACING.xs },
  sonucBtnSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.lg, marginTop: SPACING.md },

  kullanilanKutu: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  kullanilanBaslik: { ...TYPE.caption, fontSize: 9, letterSpacing: 1 },
  kullanilanText: { ...TYPE.caption, color: COLORS.text, marginTop: 2 },

  cevapPaneli: {
    backgroundColor: COLORS.card, borderColor: VURGU.main, borderWidth: 2,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  hedefText: { ...TYPE.h3, fontSize: 14, textAlign: "center" },
  hedefAlt: { ...TYPE.caption, textAlign: "center", marginBottom: SPACING.sm },
  oneriSerit: { marginTop: SPACING.sm },
  oneriCip: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.sm,
  },
  oneriCipText: { ...TYPE.caption, color: COLORS.text, fontWeight: "700" },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    color: COLORS.text, fontSize: 15,
  },
  gonderBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card,
  },
  altBtnSatir: { flexDirection: "row", justifyContent: "space-between", paddingTop: SPACING.sm },
  kucukLink: { ...TYPE.caption, textDecorationLine: "underline" },
  ipucu: { ...TYPE.caption, textAlign: "center", paddingBottom: SPACING.sm },

  geriBildirimSarmal: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center" },

  anaBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    alignItems: "center", marginTop: SPACING.lg, ...SHADOW.card,
  },
  anaBtnKucuk: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, ...SHADOW.card,
  },
  anaBtnText: { ...TYPE.button, color: COLORS.accentDark },
  ikincilBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  ikincilBtnText: { ...TYPE.caption, textDecorationLine: "underline" },
});
