import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as HizliResim } from "expo-image";
import SoundPressable from "./SoundPressable";
import PlayerPhoto from "./PlayerPhoto";
import { COLORS, SPACING, TYPE } from "../lib/theme";
import { acilabilirMi, tumKartlar, ASGARI_PUAN } from "../lib/kimBuMasa";
import { resolvePlayerPhotoUrl } from "../lib/playerPhotos";

// ============================================================================
// KİM BU — KART MASASI GÖRÜNÜMÜ (Paket 13, 5 Ekim 2026)
// WhoAmICpuScreen'in içindeki kart/tablo çizimi buraya alındı; Seri, Günlük
// Kim Bu, Kadro Avı ve Online düello AYNI masayı çiziyor.
//   MasaKartlari     — kimlik / kariyer / vitrin kartları (+ bulanık foto)
//   TahminTablosu    — yanlış tahminlerin karşılaştırma satırları
//   SimdiBilirsenAfis— "ŞİMDİ BİLİRSEN" afişi
//   AcilisAnimasyonu — tur sonu: kapalı kartlar sırayla döner, foto netleşir,
//                      ad çıkar, "ANSİKLOPEDİYE EKLENDİ" (benchmark: Tur sonu)
// ============================================================================
export const sayi = (n) => Math.round(n).toLocaleString("tr-TR");

// Kapalıdan açığa geçerken Y ekseninde dönen kart (4 Ekim 2026, Kerem'in isteği).
// `children` bir fonksiyon: o an görünen yüzü (gorunen) alır.
export function Kart({ kart, durum, kilitli, onPress, genislik, yukseklik = 70, children }) {
  const [gorunen, setGorunen] = useState(durum);
  const aci = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (durum === gorunen) return;
    if (!durum || gorunen) { setGorunen(durum); return; } // kapanma / yüz değişimi: anında
    Animated.timing(aci, { toValue: 1, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setGorunen(durum);
      aci.setValue(-1);
      Animated.timing(aci, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  }, [durum]);
  const rotateY = aci.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-90deg", "0deg", "90deg"] });
  const stil = gorunen === "bedava" ? s.kartBedava : gorunen === "baslangic" ? s.kartBaslangic : gorunen === "son" ? s.kartSon : gorunen ? s.kartAcik : kilitli ? s.kartKilitli : s.kartKapali;
  return (
    <Animated.View style={{ width: genislik, transform: [{ perspective: 700 }, { rotateY }] }}>
      <SoundPressable
        style={[s.kart, stil, { minHeight: yukseklik }]}
        onPress={onPress}
        disabled={!!durum || !onPress}
        accessibilityLabel={
          durum ? `${kart.etiket || kart.yil} açık`
            : kilitli ? `${kart.etiket || kart.yil} kartı için puan yetmiyor`
            : `${kart.etiket || kart.yil} kartını çevir, ${kart.bedel} puan`
        }
      >
        {children(gorunen)}
      </SoundPressable>
    </Animated.View>
  );
}

export function Bedel({ kart, kilitli }) {
  if (kilitli) {
    return (
      <View style={s.kilitSatir}>
        <Ionicons name="lock-closed" size={11} color={COLORS.textMuted} />
        <Text style={s.kartBedelKilitli}>{sayi(kart.bedel)}</Text>
      </View>
    );
  }
  return <Text style={s.kartBedel}>{sayi(kart.bedel)}</Text>;
}

const HUCRE = {
  evet: { y: "✓", zemin: "#1F5A33", renk: "#CFF7D6" },
  hayir: { y: "✗", zemin: "#3A1A1E", renk: "#FF9A9A" },
  asagi: { y: "↓", zemin: "#3D2C08", renk: "#FFE3A3" },
  yukari: { y: "↑", zemin: "#3D2C08", renk: "#FFE3A3" },
  esit: { y: "=", zemin: "#1F5A33", renk: "#CFF7D6" },
  yok: { y: "—", zemin: COLORS.card, renk: COLORS.textMuted },
};
export function Hucre({ deger }) {
  const h = HUCRE[deger] || HUCRE.yok;
  return (
    <View style={[s.hucre, s.hucreGenislik, { backgroundColor: h.zemin }]}>
      <Text style={[s.hucreYazi, { color: h.renk }]}>{h.y}</Text>
    </View>
  );
}

// tahminler: karsilastir() satırları; etiket(t) varsa adın önüne yazılır (online: "Sen"/"Rakip").
export function TahminTablosu({ tahminler, baslik = "TAHMİNLERİN", etiket }) {
  if (!tahminler || !tahminler.length) return null;
  return (
    <>
      <View style={s.tabloBaslik}>
        <Text style={[s.tabloBaslikYazi, { flex: 1, textAlign: "left" }]}>{baslik}</Text>
        {["BAYRAK", "MEVKİ", "YAŞ", "LİG", "KULÜP"].map((b) => (
          <Text key={b} style={[s.tabloBaslikYazi, s.hucreGenislik]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{b}</Text>
        ))}
      </View>
      {tahminler.map((t, i) => (
        <View key={`${t.ad}-${i}`} style={s.tahminSatir}>
          <View style={{ flex: 1 }}>
            {etiket ? <Text style={s.tahminKim}>{etiket(t)}</Text> : null}
            <Text style={s.tahminAd} numberOfLines={1}>{t.ad}</Text>
          </View>
          {["bayrak", "mevki", "yas", "lig", "kulup"].map((alan) => (
            <Hucre key={alan} deger={t[alan]} />
          ))}
        </View>
      ))}
    </>
  );
}

export function SimdiBilirsenAfis({ puan, carp, kucuk, alt }) {
  return (
    <View style={[s.afis, kucuk && s.afisKucuk]}>
      <View style={kucuk && { flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={s.afisUst}>ŞİMDİ BİLİRSEN</Text>
        <Text style={[s.afisSayi, kucuk && s.afisSayiKucuk]}>{sayi(puan)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {carp > 1 ? <Text style={[s.afisCarpan, kucuk && { fontSize: 18 }]}>×{String(carp).replace(".", ",")}</Text> : null}
        {!kucuk ? <Text style={s.afisAlt}>{alt || (carp === 2 ? "kart çevirmeden" : carp > 1 ? "1–2 kartla" : `en az ${sayi(ASGARI_PUAN)}`)}</Text> : null}
      </View>
    </View>
  );
}

// Masanın kartları. onKartCevir yoksa kartlar dokunulmaz (izleme / tur sonu).
// durumGetir(k) verilirse kart durumu ondan okunur (açılış animasyonu için).
export function MasaKartlari({ masa, acik, onKartCevir, turAnahtari = "", fotoAd, durumGetir, kompakt }) {
  const [fotoBozuk, setFotoBozuk] = useState(false);
  const durum = (k) => (durumGetir ? durumGetir(k) : acik[k.id] || null);
  const kilitli = (k) => !!onKartCevir && !acik[k.id] && !acilabilirMi(masa, acik, k);
  const bas = (k) => (onKartCevir ? () => onKartCevir(k) : undefined);
  const fotoUrl = fotoAd ? resolvePlayerPhotoUrl(fotoAd) : null;
  const siluetAcik = masa.vitrin.some((k) => k.id === "siluet" && durum(k));
  return (
    <>
      <Text style={s.bolum}>KİMLİK</Text>
      <View style={s.izgara}>
        {masa.kimlik.map((k) => (
          <Kart key={turAnahtari + k.id} kart={k} durum={durum(k)} kilitli={kilitli(k)} onPress={bas(k)} genislik="23.5%" yukseklik={kompakt ? 56 : 70}>
            {(d) => (
              <>
                <Text style={s.kartEtiket}>{k.etiket}</Text>
                {d ? (
                  <Text style={s.kartDeger} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{k.deger}</Text>
                ) : (
                  <Bedel kart={k} kilitli={kilitli(k)} />
                )}
              </>
            )}
          </Kart>
        ))}
      </View>

      <Text style={s.bolum}>KARİYER · {masa.kariyer.length} KULÜP <Text style={s.bolumAlt}>eskiden yeniye</Text></Text>
      <View style={s.izgara}>
        {masa.kariyer.map((k) => (
          <Kart key={turAnahtari + k.id} kart={k} durum={durum(k)} kilitli={kilitli(k)} onPress={bas(k)} genislik="18.4%" yukseklik={kompakt ? 72 : 88}>
            {(d) => (
              <>
                <Text style={s.kariyerYil}>{k.yil}</Text>
                {d ? (
                  <Text style={s.kariyerAd} numberOfLines={3}>{k.kulup}</Text>
                ) : (
                  <View style={s.kalkan}><Text style={s.kalkanSoru}>?</Text></View>
                )}
                {d === "bedava" ? <Text style={s.bedava}>bedava</Text> : !d ? <Bedel kart={k} kilitli={kilitli(k)} /> : <View />}
              </>
            )}
          </Kart>
        ))}
      </View>

      {masa.vitrin.length ? (
        <>
          <Text style={s.bolum}>VİTRİN</Text>
          <View style={s.izgara}>
            {masa.vitrin.map((k) => (
              <Kart key={turAnahtari + k.id} kart={k} durum={durum(k)} kilitli={kilitli(k)} onPress={bas(k)} genislik="31.8%" yukseklik={durum(k) && k.id === "basarilar" ? undefined : 80}>
                {(d) => (
                  <>
                    <Text style={s.vitrinAd} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{k.etiket}</Text>
                    {!d ? (
                      <Bedel kart={k} kilitli={kilitli(k)} />
                    ) : k.id === "basarilar" ? (
                      k.liste.map((b, i) => <Text key={i} style={s.basari} numberOfLines={2}>{b}</Text>)
                    ) : k.id === "arkadas" ? (
                      <>
                        <Text style={s.arkadasAd} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{k.deger}</Text>
                        <Text style={s.arkadasAlt} numberOfLines={1}>{k.alt}</Text>
                      </>
                    ) : (
                      <Ionicons name="image" size={20} color={COLORS.accent} />
                    )}
                  </>
                )}
              </Kart>
            ))}
          </View>
          {/* 4 Ekim 2026: bulanık foto (silüet tintColor ile opak JPG'lerde düz daire veriyordu). */}
          {siluetAcik && fotoUrl && !fotoBozuk && !durumGetir ? (
            <View style={s.siluetKutu}>
              {/* Paket 18 (Kerem: "bulanık foto aşırı aşırı bulanık... en net halinden
                  bir tık bulanık olsa yeter") — 24 → 4 */}
              <HizliResim source={{ uri: fotoUrl }} style={s.siluet} blurRadius={4} contentFit="cover" cachePolicy="memory-disk" transition={150} onError={() => setFotoBozuk(true)} />
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

// --------------------------------------------------------------------------
// TUR SONU AÇILIŞI — benchmark "Tur sonu: Bütün kartlar sırayla döner,
// fotoğraf netleşir, ad ve mini profil çıkar, 'ansiklopediye eklendi'".
//   1) masadaki kapalı kartlar 90 ms arayla tek tek döner (Kart animasyonu)
//   2) fotoğraf bulanık başlar, netleşir (bulanık üst katman söner)
//   3) ad + kısa künye belirir; doğru bilindiyse "ANSİKLOPEDİYE EKLENDİ"
// --------------------------------------------------------------------------
export function AcilisAnimasyonu({ masa, acik, ad, dogru, baslik, baslikRengi, eklendiYazisi = "ANSİKLOPEDİYE EKLENDİ", altSatir, kartlariGoster = true }) {
  const kapali = tumKartlar(masa).filter((k) => !acik[k.id]);
  const [donen, setDonen] = useState(0);
  const [asama, setAsama] = useState(kapali.length ? "kartlar" : "foto");
  const bulanik = useRef(new Animated.Value(1)).current;
  const adGorunur = useRef(new Animated.Value(0)).current;
  const fotoUrl = resolvePlayerPhotoUrl(ad);

  useEffect(() => {
    if (asama !== "kartlar") return;
    const t = setInterval(() => setDonen((d) => d + 1), 90);
    return () => clearInterval(t);
  }, [asama]);
  useEffect(() => {
    if (asama === "kartlar" && donen >= kapali.length) setAsama("foto");
  }, [asama, donen, kapali.length]);

  useEffect(() => {
    if (asama !== "foto") return;
    Animated.timing(bulanik, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setAsama("ad"));
  }, [asama]);
  useEffect(() => {
    if (asama !== "ad") return;
    Animated.timing(adGorunur, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => setAsama("bitti"));
  }, [asama]);

  const sira = new Map(kapali.map((k, i) => [k.id, i]));
  const durumGetir = (k) => acik[k.id] || (sira.has(k.id) && sira.get(k.id) < donen ? "son" : null);
  const adAsamasi = asama === "ad" || asama === "bitti";

  return (
    <View style={s.acilis}>
      {baslik ? <Text style={[s.acilisBaslik, { color: baslikRengi || (dogru ? COLORS.accent : COLORS.danger) }]}>{baslik}</Text> : null}
      <View style={s.fotoCerceve}>
        <PlayerPhoto name={ad} size={112} showProfileOnPress={adAsamasi} />
        {fotoUrl ? (
          <Animated.View pointerEvents="none" style={[s.fotoUst, { opacity: bulanik }]}>
            <HizliResim source={{ uri: fotoUrl }} style={s.fotoBulanik} blurRadius={24} contentFit="cover" cachePolicy="memory-disk" />
          </Animated.View>
        ) : null}
      </View>
      {adAsamasi ? (
        <Animated.View style={{ opacity: adGorunur, alignItems: "center" }}>
          <Text style={s.acilisAd}>{ad}</Text>
          {altSatir ? <Text style={s.acilisAlt}>{altSatir}</Text> : null}
          {dogru ? (
            <View style={s.eklendi}>
              <Ionicons name="book" size={14} color={COLORS.accentDark} />
              <Text style={s.eklendiYazi}>{eklendiYazisi}</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : (
        <Text style={s.acilisAd}>???</Text>
      )}
      {kartlariGoster ? (
        <View style={{ alignSelf: "stretch" }}>
          <MasaKartlari masa={masa} acik={acik} durumGetir={durumGetir} turAnahtari={"acilis:" + ad + ":"} kompakt />
        </View>
      ) : null}
    </View>
  );
}


const s = StyleSheet.create({
  afis: {
    marginHorizontal: SPACING.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: 18,
    backgroundColor: "#2A1F06", borderWidth: 1, borderColor: "#5A430E",
  },
  afisUst: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: "#FFD98A" },
  afisSayi: { fontSize: 40, fontWeight: "900", color: COLORS.cta, lineHeight: 44 },
  afisCarpan: { fontSize: 22, fontWeight: "900", color: "#FFE3A3" },
  afisAlt: { fontSize: 12, fontWeight: "700", color: "#FFD98A" },
  afisKucuk: { paddingVertical: 6 },
  afisSayiKucuk: { fontSize: 24, lineHeight: 28 },

  tabloBaslik: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: SPACING.md, marginBottom: 4 },
  tabloBaslikYazi: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, color: COLORS.textMuted, textAlign: "center" },
  hucreGenislik: { width: 40 },
  tahminSatir: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 5,
    borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  tahminKim: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, color: COLORS.cta },
  tahminAd: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  hucre: { height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  hucreYazi: { fontSize: 14, fontWeight: "900" },

  bolum: { marginTop: SPACING.lg, marginBottom: SPACING.sm, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: COLORS.textMuted },
  bolumAlt: { fontSize: 12, fontWeight: "600", letterSpacing: 0, color: COLORS.textMuted },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kart: { borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 },
  kartKapali: { backgroundColor: "#141E2B", borderColor: "#2E3E55" },
  kartAcik: { backgroundColor: "#10283A", borderColor: "#2B6A8E" },
  kartBaslangic: { backgroundColor: "#10283A", borderColor: "#5EC8FF" },
  kartBedava: { backgroundColor: "#0E2A18", borderColor: "#2F7A47" },
  kartSon: { backgroundColor: "#22303F", borderColor: "#4A5D73" },
  kartKilitli: { backgroundColor: "#0F1620", borderColor: "#222D3B", opacity: 0.6 },
  kilitSatir: { flexDirection: "row", alignItems: "center", gap: 3 },
  kartBedelKilitli: { fontSize: 13, fontWeight: "900", color: COLORS.textMuted, textDecorationLine: "line-through" },
  kartEtiket: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, color: COLORS.textMuted },
  kartDeger: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center", alignSelf: "stretch" },
  arkadasAd: { fontSize: 14, fontWeight: "900", color: COLORS.text, textAlign: "center", alignSelf: "stretch" },
  kartBedel: { fontSize: 13, fontWeight: "900", color: COLORS.cta },
  kariyerYil: { fontSize: 12, fontWeight: "800", color: "#C9D4DF" },
  kariyerAd: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  kalkan: {
    width: 28, height: 32, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center",
  },
  kalkanSoru: { fontSize: 15, fontWeight: "900", color: COLORS.textMuted },
  bedava: { fontSize: 12, fontWeight: "900", color: COLORS.accent },
  vitrinAd: { fontSize: 13, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  basari: { fontSize: 12, fontWeight: "700", color: "#FFE3A3", textAlign: "center", marginTop: 2 },
  arkadasAlt: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  siluetKutu: { alignItems: "center", marginTop: SPACING.md },
  siluet: { width: 140, height: 140, borderRadius: 70 },

  acilis: { alignItems: "center", alignSelf: "stretch" },
  acilisBaslik: { marginTop: SPACING.md, marginBottom: SPACING.md, fontSize: 22, fontWeight: "900", letterSpacing: 3, textAlign: "center" },
  fotoCerceve: { width: 112, height: 112, borderRadius: 56, overflow: "hidden" },
  fotoUst: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  fotoBulanik: { width: 112, height: 112 },
  acilisAd: { ...TYPE.h1, marginTop: SPACING.md, textAlign: "center" },
  acilisAlt: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  eklendi: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, backgroundColor: COLORS.accent,
  },
  eklendiYazi: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: COLORS.accentDark },
});
