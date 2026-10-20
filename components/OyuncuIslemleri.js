import { _t } from "../lib/dil";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { BILDIRIM_SEBEPLERI, oyuncuBildir, oyuncuEngelle, engellediklerim } from "../lib/guvenlik";
import { COLORS, RADIUS, SPACING } from "../lib/theme";

// ============================================================================
// OYUNCUYU BİLDİR / ENGELLE — Paket 38 (App Store kural 1.2)
// Liderlik tablosunda bir satıra ya da maç sonunda "Rakibi bildir / engelle"
// bağlantısına dokununca açılır. Engellenen oyuncuyla bir daha eşleşilmez.
// ============================================================================
export default function OyuncuIslemleri({ visible, oyuncu, baglam, engelli: engelliBaslangic = false, onKapat, onDegisti }) {
  const [asama, setAsama] = useState("menu");   // menu | bildir | tamam
  const [mesaj, setMesaj] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [engelli, setEngelli] = useState(engelliBaslangic);

  useEffect(() => {
    if (!visible) return;
    setAsama("menu");
    setMesaj("");
    setCalisiyor(false);
    setEngelli(!!engelliBaslangic);
  }, [visible, oyuncu && oyuncu.id, engelliBaslangic]);

  if (!visible || !oyuncu || !oyuncu.id) return null;
  const ad = oyuncu.ad || _t("Oyuncu");

  async function bildir(sebep) {
    setCalisiyor(true);
    const r = await oyuncuBildir(oyuncu.id, sebep, { baglam });
    setCalisiyor(false);
    if (r.durum === "tamam") setMesaj(r.ad_silindi ? _t("Teşekkürler. Bu takma ad birden fazla kez bildirildiği için kaldırıldı.") : _t("Teşekkürler, bildirimin bize ulaştı. 24 saat içinde incelenir."));
    else if (r.durum === "zaten") setMesaj(_t("Bu oyuncuyu bu sebeple zaten bildirdin. Teşekkürler!"));
    else if (r.durum === "sinir") setMesaj(_t("Bugün çok fazla bildirim gönderdin; yarın tekrar deneyebilirsin."));
    else setMesaj(_t("Bildirim gönderilemedi. İnternet bağlantını kontrol edip tekrar dene."));
    setAsama("tamam");
  }

  async function engelDegistir() {
    setCalisiyor(true);
    const yeni = !engelli;
    const r = await oyuncuEngelle(oyuncu.id, yeni);
    setCalisiyor(false);
    if (r.durum === "tamam") {
      setEngelli(yeni);
      setMesaj(yeni ? _t("{0} engellendi. Bu oyuncuyla bir daha eşleşmeyeceksin.", [ad]) : _t("{0} için engel kaldırıldı.", [ad]));
      onDegisti && onDegisti({ id: oyuncu.id, engelli: yeni });
    } else {
      setMesaj(_t("İşlem yapılamadı. İnternet bağlantını kontrol edip tekrar dene."));
    }
    setAsama("tamam");
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onKapat}>
      <View style={st.arka}>
        <View style={st.kart} accessibilityViewIsModal>
          <View style={st.ust}>
            <Text style={st.baslik} numberOfLines={1}>{ad}</Text>
            <SoundPressable onPress={onKapat} hitSlop={14} accessibilityLabel={_t("Kapat")}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </SoundPressable>
          </View>

          {calisiyor ? <ActivityIndicator color={COLORS.accent} style={{ marginVertical: SPACING.xl }} /> : null}

          {!calisiyor && asama === "menu" ? (
            <>
              <Satir ikon="flag-outline" yazi={_t("Bildir")} alt={_t("Uygunsuz ad, hakaret ya da hile")} onPress={() => setAsama("bildir")} />
              <Satir
                ikon={engelli ? "lock-open-outline" : "ban-outline"}
                yazi={engelli ? _t("Engeli kaldır") : _t("Engelle")}
                alt={engelli ? _t("Bu oyuncuyla yeniden eşleşebilirsin") : _t("Bu oyuncuyla bir daha eşleşmezsin")}
                tehlike={!engelli}
                onPress={engelDegistir}
              />
            </>
          ) : null}

          {!calisiyor && asama === "bildir" ? (
            <>
              <Text style={st.aciklama}>{_t("Neden bildiriyorsun?")}</Text>
              {BILDIRIM_SEBEPLERI.map((s) => (
                <Satir key={s.id} ikon={s.ikon} yazi={s.etiket} onPress={() => bildir(s.id)} />
              ))}
            </>
          ) : null}

          {!calisiyor && asama === "tamam" ? (
            <>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.accent} style={{ alignSelf: "center", marginTop: SPACING.sm }} />
              <Text style={st.sonuc}>{mesaj}</Text>
              {!engelli ? (
                <SoundPressable style={st.ikincil} onPress={() => setAsama("menu")} accessibilityLabel={_t("Diğer seçenekler")}>
                  <Text style={st.ikincilYazi}>{_t("Diğer seçenekler")}</Text>
                </SoundPressable>
              ) : null}
              <SoundPressable style={st.tamam} onPress={onKapat} accessibilityLabel={_t("Tamam")}>
                <Text style={st.tamamYazi}>{_t("TAMAM")}</Text>
              </SoundPressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Satir({ ikon, yazi, alt, onPress, tehlike }) {
  const renk = tehlike ? COLORS.danger : COLORS.text;
  return (
    <SoundPressable onPress={onPress} style={st.satir} accessibilityLabel={yazi}>
      <Ionicons name={ikon} size={20} color={renk} />
      <View style={{ flex: 1 }}>
        <Text style={[st.satirYazi, { color: renk }]}>{yazi}</Text>
        {alt ? <Text style={st.satirAlt}>{alt}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
    </SoundPressable>
  );
}

// "Rakibi bildir / engelle" bağlantısı (maç sonu kartının altında).
export function RakipBildirBaglantisi({ oyuncuId, ad, baglam }) {
  const [acik, setAcik] = useState(false);
  if (!oyuncuId) return null;
  return (
    <>
      <SoundPressable onPress={() => setAcik(true)} style={st.baglanti} hitSlop={8} accessibilityLabel={_t("Rakibi bildir ya da engelle")}>
        <Ionicons name="flag-outline" size={14} color={COLORS.textFaint} />
        <Text style={st.baglantiYazi}>{_t("Rakibi bildir / engelle")}</Text>
      </SoundPressable>
      <OyuncuIslemleri visible={acik} oyuncu={{ id: oyuncuId, ad: ad || _t("Rakip") }} baglam={baglam} onKapat={() => setAcik(false)} />
    </>
  );
}

// Engellediklerin listesi (liderlik penceresinin altından açılır).
export function EngellenenlerPenceresi({ visible, onKapat }) {
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(false);
  const [secili, setSecili] = useState(null);

  function yukle() {
    setListe(null);
    engellediklerim().then((r) => { setListe(r.liste); setHata(r.hata); });
  }
  useEffect(() => { if (visible) yukle(); }, [visible]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onKapat}>
      <View style={st.arka}>
        <View style={[st.kart, { maxHeight: "80%" }]}>
          <View style={st.ust}>
            <Text style={st.baslik}>{_t("Engellediklerin")}</Text>
            <SoundPressable onPress={onKapat} hitSlop={14} accessibilityLabel={_t("Kapat")}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </SoundPressable>
          </View>
          {liste === null ? <ActivityIndicator color={COLORS.accent} style={{ marginVertical: SPACING.lg }} /> : null}
          {liste && !liste.length ? (
            <Text style={st.aciklama}>{hata ? _t("Liste yüklenemedi; internetini kontrol et.") : _t("Kimseyi engellemedin.")}</Text>
          ) : null}
          <ScrollView style={{ flexGrow: 0 }}>
            {(liste || []).map((x) => (
              <Satir key={x.oyuncu} ikon="ban-outline" yazi={x.takma_ad || _t("Oyuncu")} alt={_t("Engeli kaldırmak için dokun")} onPress={() => setSecili({ id: x.oyuncu, ad: x.takma_ad })} />
            ))}
          </ScrollView>
        </View>
      </View>
      <OyuncuIslemleri
        visible={!!secili}
        oyuncu={secili}
        engelli
        baglam="engel_listesi"
        onKapat={() => setSecili(null)}
        onDegisti={() => yukle()}
      />
    </Modal>
  );
}

const st = StyleSheet.create({
  arka: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  kart: { width: "100%", maxWidth: 380, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.lg },
  ust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm, gap: SPACING.md },
  baslik: { color: COLORS.text, fontSize: 20, fontWeight: "900", flex: 1 },
  aciklama: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700", marginVertical: SPACING.sm },
  satir: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  satirYazi: { fontSize: 16, fontWeight: "800" },
  satirAlt: { color: COLORS.textFaint, fontSize: 12, fontWeight: "600", marginTop: 2 },
  sonuc: { color: COLORS.text, fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: SPACING.md, lineHeight: 21 },
  tamam: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center", marginTop: SPACING.lg },
  tamamYazi: { color: COLORS.accentDark, fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  ikincil: { paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.sm },
  ikincilYazi: { color: COLORS.textMuted, fontSize: 14, fontWeight: "800" },
  baglanti: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: SPACING.sm, marginTop: SPACING.sm },
  baglantiYazi: { color: COLORS.textFaint, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
