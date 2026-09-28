import React, { useMemo } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import TeamBadge from "./TeamBadge";
import { resolvePlayerPhotoUrl } from "../lib/playerPhotos";

import { countryTr } from "../lib/countryNamesTr";
import { positionTr } from "../lib/positionNamesTr";
import { COLORS } from "../lib/theme";
import { BASARILAR, oyuncuBasarilari } from "../lib/basarilar";
// DİKKAT — burada bilerek `PlayerPhoto` KULLANILMIYOR: PlayerPhoto bu dosyayı
// import ediyor, buradan da onu import etseydik DAİRESEL (circular) bir
// bağımlılık oluşur ve modüllerden biri yüklenirken `undefined` olabilirdi
// (bu projede daha önce "undefined is not a function" render hatalarıyla
// uğraşıldı). Onun yerine avatarı burada, birkaç satırla kendimiz çiziyoruz.
function ProfileAvatar({ name, size }) {
  const [failed, setFailed] = React.useState(false);
  const uri = resolvePlayerPhotoUrl(name);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.bg }}
        contentFit="cover"
        transition={200}
        onError={() => setFailed(true)}
      />
    );
  }
  const words = (name || "?").split(" ").filter(Boolean);
  const ini = words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.32 }}>{ini}</Text>
    </View>
  );
}

// 7 Eylül 2026 (Kerem: "oyuncu resmine tıklandığında açılacak bir mini profil
// sayfası olsa nasıl olur? oyuncu, doğum tarihi, oynadığı kulüpler, başarılar
// vs. yazsa") — futbolcu fotoğrafına dokununca açılan küçük kart.
//
// PERFORMANS NOTU (önemli): Bu ekranın gösterdiği veriler (players.json ~6MB,
// playerBirthPosition.json ~2.7MB vb.) uygulamanın EN AĞIR dosyaları. Bu
// yüzden dosyanın TEPESİNDE import EDİLMİYORLAR — `require(...)` çağrıları
// bilerek fonksiyon İÇİNDE. Metro bu "inline require" desenini destekliyor
// ve modül ancak kart İLK KEZ açıldığında değerlendiriliyor. Böylece
// PlayerPhoto'yu kullanan hafif ekranlar (ana menü, profil vb.) bu veriyi
// boşuna belleğe almıyor.
function buildInfo(name) {
  if (!name) return null;
  try {
    const { PLAYERS } = require("../lib/players");
    const birthPosition = require("../lib/playerBirthPosition.json");
    const years = require("../lib/playerYears.json");
    const nationalTeams = require("../lib/playerNationalTeams.json");
    let achievements = {};
    try { achievements = require("../lib/playerAchievements.json"); } catch (e) {}
    // 28 Eylül 2026 — özgeçmiş verisi (Wikidata + Wikipedia "Honours"):
    // güncel/son kulüp, vefat, boy/ayak, yıllı kariyer, kupalar, ödüller.
    // scripts/ozgecmis_cek.py + ozgecmis_isle.py ile üretiliyor.
    let profiles = {};
    try { profiles = require("../lib/playerProfiles.json"); } catch (e) {}

    const player = PLAYERS.find((p) => p.name === name);
    const bp = birthPosition[name] || {};
    return {
      clubs: player ? player.clubs : [],
      birthYear: bp.birthYear || null,
      position: bp.position || null,
      lastYear: years[name] || null,
      national: nationalTeams[name] || null,
      achievements: achievements[name] || null,
      profil: profiles[name] || null,
      basarilar: oyuncuBasarilari(name),
    };
  } catch (e) {
    return null;
  }
}

const CURRENT_YEAR = new Date().getFullYear();

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarihYaz(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || ""));
  if (!m) return String(t || "").slice(0, 4);
  const ay = Number(m[2]), gun = Number(m[3]);
  if (!ay || !gun) return m[1];
  return `${gun} ${AYLAR[ay - 1]} ${m[1]}`;
}

// playerProfiles.json "k" satırları: [kulüp sıra no, başlangıç, bitiş, maç, gol].
// Sıra no, players.json'daki kulüp listesinin indeksi. Aynı kulüpteki birden çok
// dönem (ör. Hakan Şükür - Galatasaray x3) tek satırda birleşir.
function kariyerOzeti(k) {
  if (!k || !k.length) return null;
  const ozet = {};
  for (const [i, bas, bit, mac, gol] of k) {
    const o = ozet[i] || (ozet[i] = { donem: [], mac: null, gol: null });
    o.donem.push(bit === bas ? String(bas) : `${bas}–${bit || ""}`);
    if (mac != null) o.mac = (o.mac || 0) + mac;
    if (gol != null) o.gol = (o.gol || 0) + gol;
  }
  for (const o of Object.values(ozet)) o.yillar = o.donem.join(", ");
  return ozet;
}

// Kupa grubu başlığı: kulüp adı, "Bireysel" ya da milli takım ("Turkey U17").
function grupAdi(g) {
  const m = /^(.*?)( U\d\d| Olimpik)?$/.exec(String(g || ""));
  return countryTr(m[1]) + (m[2] || "");
}

// BAŞARILAR — XOX'taki başarı sütunlarıyla aynı liste. Sayı yalnızca Wikipedia
// kupa listesinden biliniyorsa yazılır ("×3"); bilinmiyorsa sadece rozet.
function BasariRozetleri({ kodlar, sayilar }) {
  if (!kodlar || !kodlar.length) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>Başarılar</Text>
      <View style={styles.basariSatir}>
        {kodlar.map((k) => {
          const b = BASARILAR[k];
          const n = sayilar ? sayilar[k] : 0;
          return (
            <View key={k} style={styles.basari}>
              <Ionicons name={b.ikon} size={13} color={COLORS.cta} />
              <Text style={styles.basariText}>{b.etiket}</Text>
              {n > 1 ? <Text style={styles.basariAdet}>×{n}</Text> : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

// Profilin tepesindeki durum şeridi: şu anki kulüp (aktifse), son kulüp
// (bıraktıysa) ve varsa vefat bilgisi.
function DurumKarti({ pr, active, lastYear, olumYili, age }) {
  if (!pr) return null;
  const satirlar = [];
  if (pr.sb && active !== false && !olumYili) satirlar.push({ ikon: "person-outline", etiket: "DURUM", metin: "Serbest oyuncu" });
  if (pr.g && active) satirlar.push({ ikon: "shirt", etiket: pr.gk ? "ŞU ANKİ KULÜBÜ (KİRALIK)" : "ŞU ANKİ KULÜBÜ", kulup: pr.g });
  else if (pr.s) satirlar.push({ ikon: "flag-outline", etiket: pr.sy || lastYear ? `SON KULÜBÜ (${pr.sy || lastYear})` : "SON KULÜBÜ", kulup: pr.s });
  if (olumYili) satirlar.push({ ikon: "rose-outline", etiket: "VEFAT", metin: `${tarihYaz(pr.o)}${age ? ` · ${age} yaşında` : ""}` });
  if (!satirlar.length) return null;
  return (
    <View style={styles.durum}>
      {satirlar.map((s, i) => (
        <View key={i} style={[styles.durumSatir, i > 0 && styles.durumAyrac]}>
          <Ionicons name={s.ikon} size={15} color={COLORS.accent} />
          <Text style={styles.durumEtiket}>{s.etiket}</Text>
          <View style={styles.durumDeger}>
            {s.kulup ? <TeamBadge name={s.kulup} size={20} /> : null}
            <Text style={styles.durumMetin} numberOfLines={1}>{s.kulup || s.metin}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PlayerMiniProfile({ name, visible, onClose }) {
  // Kart kapalıyken hiç hesaplama yapmıyoruz (ağır require'lar tetiklenmesin).
  const info = useMemo(() => (visible ? buildInfo(name) : null), [visible, name]);
  if (!visible) return null;

  const pr = info?.profil || null;
  const olumYili = pr?.o ? Number(String(pr.o).slice(0, 4)) : null;
  const dogumYili = info?.birthYear || (pr?.d ? Number(String(pr.d).slice(0, 4)) : null);
  const age = dogumYili ? (olumYili || CURRENT_YEAR) - dogumYili : null;
  // playerYears.json = oyuncunun SON AKTİF yılı. Bu yıl ya da geçen yılsa
  // "aktif", daha eskiyse kariyerini bitirmiş sayıyoruz.
  const active = olumYili ? false : info?.lastYear ? info.lastYear >= CURRENT_YEAR - 1 : null;
  const kariyer = kariyerOzeti(pr?.k);

  const chips = [];
  // 12 Eylül 2026 (Kerem: "burada da ülke adı ve mevki adı İngilizce yazıyor")
  // — veri seti İngilizce kalıyor, sadece gösterim Türkçeleşiyor.
  const mevki = positionTr(info?.position);
  if (mevki) chips.push({ icon: "football", text: mevki });
  if (dogumYili) chips.push({ icon: "calendar", text: olumYili ? `${dogumYili} – ${olumYili}` : `${dogumYili}${age ? ` (${age})` : ""}` });
  if (pr?.b) chips.push({ icon: "resize", text: `${pr.b} cm` });
  if (pr?.a) chips.push({ icon: "footsteps", text: pr.a === "İki ayak" ? "İki ayak" : `${pr.a} ayak` });
  if (info?.national && info.national.length) chips.push({ icon: "flag", text: info.national.map(countryTr).join(", ") });
  if (info?.lastYear && !olumYili) {
    if (active && pr?.sb) chips.push({ icon: "person-outline", text: "Serbest" });
    else chips.push({ icon: active ? "flash" : "time", text: active ? "Aktif" : `Son sezon ${info.lastYear}` });
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* İçeriğe dokunmak kartı kapatmasın diye iç Pressable dokunuşu yutuyor. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </Pressable>

          <View style={styles.header}>
            <ProfileAvatar name={name} size={84} />
            <Text style={styles.name} numberOfLines={2}>{name}</Text>
          </View>

          {chips.length > 0 && (
            <View style={styles.chipRow}>
              {chips.map((c, i) => (
                <View key={i} style={styles.chip}>
                  <Ionicons name={c.icon} size={12} color={COLORS.accent} />
                  <Text style={styles.chipText} numberOfLines={1}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          <DurumKarti pr={pr} active={active} lastYear={info?.lastYear} olumYili={olumYili} age={age} />

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} nestedScrollEnabled>
            <BasariRozetleri kodlar={info?.basarilar} sayilar={pr?.bs} />
            {info?.basarilar?.length ? <View style={{ height: 14 }} /> : null}
            {info?.clubs?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Kulüpler ({info.clubs.length})</Text>
                {info.clubs.map((c, i) => {
                  const d = kariyer ? kariyer[i] : null;
                  return (
                    <View key={`${c}-${i}`} style={styles.clubRow}>
                      <TeamBadge name={c} size={26} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clubName} numberOfLines={1}>{c}</Text>
                        {d && d.mac != null ? (
                          <Text style={styles.clubStat}>{d.mac} maç{d.gol != null ? ` · ${d.gol} gol` : ""}</Text>
                        ) : null}
                      </View>
                      {d && d.yillar ? <Text style={styles.clubYears} numberOfLines={2}>{d.yillar}</Text> : null}
                    </View>
                  );
                })}
              </>
            )}

            {pr?.ku?.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Kupalar</Text>
                {pr.ku.map(([grup, liste], gi) => (
                  <View key={gi} style={styles.kupaGrup}>
                    <Text style={styles.kupaGrupAd}>{grupAdi(grup)}</Text>
                    {liste.map(([kupa, adet, yillar], i) => (
                      <View key={i} style={styles.achRow}>
                        <Ionicons name="trophy" size={13} color={COLORS.cta} />
                        <Text style={styles.achText}>
                          {kupa}{adet > 1 ? <Text style={styles.kupaAdet}>{`  ×${adet}`}</Text> : null}
                          {yillar?.length ? <Text style={styles.kupaYil}>{`\n${yillar.join(", ")}`}</Text> : null}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}

            {pr?.od?.length > 0 && !(pr?.ku || []).some(([g]) => g === "Bireysel") && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Ödüller</Text>
                {pr.od.map(([odul, yil], i) => (
                  <View key={i} style={styles.achRow}>
                    <Ionicons name="medal" size={13} color={COLORS.cta} />
                    <Text style={styles.achText}>{odul}{yil ? <Text style={styles.kupaYil}>{`  ${yil}`}</Text> : null}</Text>
                  </View>
                ))}
              </>
            )}

            {info?.achievements?.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Diğer ödüller</Text>
                {info.achievements.map((a, i) => (
                  <View key={i} style={styles.achRow}>
                    <Ionicons name="trophy" size={13} color={COLORS.cta} />
                    <Text style={styles.achText}>{a}</Text>
                  </View>
                ))}
              </>
            )}

            {!info?.clubs?.length && (
              <Text style={styles.empty}>Bu futbolcu için ayrıntılı bilgi bulunamadı.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6,12,20,0.82)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, maxHeight: "82%", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 20, padding: 18 },
  closeBtn: { position: "absolute", top: 10, right: 10, zIndex: 2, padding: 4 },
  header: { alignItems: "center", gap: 10, marginBottom: 12 },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9 },
  chipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  body: { flexGrow: 0 },
  sectionTitle: { color: COLORS.cta, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  clubRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  clubName: { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  achRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingVertical: 3 },
  achText: { color: COLORS.text, fontSize: 12, flex: 1, lineHeight: 17 },
  basariSatir: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  basari: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.bg, borderColor: COLORS.cta, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 9 },
  basariText: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  basariAdet: { color: COLORS.cta, fontSize: 12, fontWeight: "900" },
  clubStat: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600", marginTop: 1 },
  clubYears: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  kupaGrup: { marginBottom: 8 },
  kupaGrupAd: { color: COLORS.text, fontSize: 12, fontWeight: "900", marginBottom: 2 },
  kupaAdet: { color: COLORS.cta, fontWeight: "900" },
  kupaYil: { color: COLORS.textMuted, fontSize: 11 },
  durum: { backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 },
  durumSatir: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  durumAyrac: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  durumEtiket: { color: COLORS.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  durumDeger: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  durumMetin: { color: COLORS.text, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 },
});
