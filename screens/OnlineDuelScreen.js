import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KlavyeAlani, KlavyeScroll } from "../components/Klavye";
import GameBackground from "../components/GameBackground";
import SoundPressable from "../components/SoundPressable";
import TeamBadge from "../components/TeamBadge";
import EslesmeKarti from "../components/EslesmeKarti";
import TimerBar from "../components/TimerBar";
import OnlineMacSonu from "../components/OnlineMacSonu";
import RakipAyrildi from "../components/RakipAyrildi";
import PlayerPhoto from "../components/PlayerPhoto";
import VoiceConfirm from "../components/VoiceConfirm";
import { PLAYERS } from "../lib/players";
import { buildSuggestIndex, suggestPlayers, findMatchedPlayer, playersForPair, sesIpuclari } from "../lib/gameEngine";
import { taninirlik } from "../lib/taninirlik";
import { useVoiceInput } from "../lib/useVoiceInput";
import { useAppSettings } from "../lib/SettingsContext";
import { unlockPlayer } from "../lib/pokedex";
import { supabase } from "../lib/supabaseClient";
import { odaKur, odaNesnesi } from "../lib/onlineLobi";
import { recordRound } from "../lib/stats";
import { addXP, XP_MAC_GALIBIYETI, XP_MAC_MAGLUBIYETI } from "../lib/profile";
import { COLORS, RADIUS, SPACING, TYPE, SHADOW, MODE_COLORS } from "../lib/theme";

// Bu ekran hiçbir doğru-cevap kontrolü YAPMAZ. Sadece sunucudaki rounds
// satırını dinler ve o satıra göre ekranı çizer — "gerçek" (source of truth)
// her zaman Postgres'tedir, iki telefon da aynı satırı görür.
//
// 5 Ekim 2026 (benchmark .29772 / .29750) — YENİ TASARIM: 23 sabit renk kodu
// lib/theme tokenlerine taşındı, diğer online ekranlarla aynı dil. Maç artık
// HEDEF puana kadar (eskiden sonsuz "Sıradaki Tur"du, bitmediği için rövanş da
// yoktu). Rövanş: skorlar sunucuda tutulduğu ve geri alınamadığı (rooms_koruma)
// için aynı odada değil, YENİ bir odada. İki taraf da RÖVANŞ'a dokununca odayı
// kuran (1) yeni odayı rakibiyle birlikte açar ve kodunu eski odanın kanalından
// yollar; iki telefon da yeni maça geçer.
//
// PAKET 36 (15 Ekim 2026) — Kerem'in kardeşiyle ilk online denemesinden:
//  • "süre bitince buga giriyor. ekran bire bir aynı kalıyor" → cevap hakkını
//    alanın süresi dolunca yazdığı (boşsa boş) cevap otomatik gönderilir; o
//    telefon donmuşsa diğeri 2 sn sonra resolve_timeout ile turu açar/kapatır
//    (supabase/paket36_online.sql). Yarış aşamasında da RPC birkaç sn'de bir
//    yeniden denenir (ağ hatasında tur takılı kalmasın).
//  • "sonraki tur butonu olsun, butona basılmazsa 10 sn içinde otomatik geçsin"
//    → iki tarafta da SONRAKİ TUR (geri sayımlı); misafir basınca ev sahibine
//    haber gider, 10 sn dolunca ev sahibi kendiliğinden geçer.
//  • "mikrofon yok. verdiğim cevap karşıda çıkmıyor, mini profil karşıda da
//    çıkmalı" → mikrofon + öneriler; yazılan cevap rakibin ekranında canlı
//    görünür; tur sonunda bilinen futbolcu (fotoğrafına dokununca mini profil)
//    İKİ tarafta da çıkar; kimse bilemediyse en tanınmış 3 doğru cevap.
//  • "maç başlarken bilgilendirmeyi okurken maç arkada başlıyor" → ilk turu
//    ev sahibi ancak rakip EKRANA GELDİĞİNDE üretir (rehber kapanmadan ekran
//    bağlanmıyor, bkz. App.js RehberliOyun).
export const HEDEF = 5;
const VURGU = MODE_COLORS.online;
export const SONRAKI_TUR_SN = 10;      // sonuç ekranından otomatik geçiş
const CEVAP_PAYI_MS = 2000;            // cevap süresi dolduktan sonra rakibin turu açması için pay

export default function OnlineDuelScreen({ room, onExit, onRovansOda }) {
  const [roundRow, setRoundRow] = useState(null);
  const [roomRow, setRoomRow] = useState(null);
  const [clubsMap, setClubsMap] = useState({});
  const [answerInput, setAnswerInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const [rakipVar, setRakipVar] = useState(true);
  const [ilkYukleme, setIlkYukleme] = useState(null);         // null | "var" | "yok"
  const [benIstedim, setBenIstedim] = useState(false);
  const [rakipIstedi, setRakipIstedi] = useState(false);
  const [rovansHata, setRovansHata] = useState(null);
  const [rakipGeldi, setRakipGeldi] = useState(false);       // presence'ta rakip bir kez görüldü mü
  const [rakipYazi, setRakipYazi] = useState(null);          // { tur, metin } — rakibin canlı yazdığı
  const [tahminler, setTahminler] = useState({});            // turId -> [{ kim, metin }]
  const [rakipHazir, setRakipHazir] = useState(null);        // misafirin "sonraki tur" dediği tur no
  const [sesOnayIstegi, setSesOnayIstegi] = useState(null);
  const [sesHata, setSesHata] = useState(null);
  const channelRef = useRef(null);
  const rvKanalRef = useRef(null);
  const kuruluyorRef = useRef(false);
  const myPlayer = room.playerNumber; // 1 | 2

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      if (mounted) setRoomRow(r);
      const { data: turlar } = await supabase
        .from("rounds")
        .select("*")
        .eq("room_id", room.id)
        .order("round_number", { ascending: false })
        .limit(1);
      const rd = turlar && turlar[0];
      if (mounted && rd) setRoundRow(rd);
      if (mounted) setIlkYukleme(rd ? "var" : "yok");
    })();

    channelRef.current = supabase
      .channel(`duel-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        (payload) => payload.new && setRoundRow(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => payload.new && setRoomRow(payload.new)
      )
      .subscribe();

    // Rövanş + rakip varlığı kanalı (broadcast/presence; sunucuya yazmaz).
    const rv = supabase.channel(`duelrv-${room.id}`, { config: { broadcast: { self: false }, presence: { key: String(myPlayer) } } });
    rvKanalRef.current = rv;
    rv
      .on("broadcast", { event: "istek" }, () => mounted && setRakipIstedi(true))
      .on("broadcast", { event: "yaziyor" }, ({ payload }) => {
        if (mounted && payload && payload.tur) setRakipYazi({ tur: payload.tur, metin: String(payload.metin || "").slice(0, 40) });
      })
      .on("broadcast", { event: "tahmin" }, ({ payload }) => {
        if (mounted && payload && payload.tur) tahminEkle(payload.tur, myPlayer === 1 ? 2 : 1, payload.metin);
      })
      .on("broadcast", { event: "sonraki" }, ({ payload }) => {
        if (mounted && payload && payload.no) setRakipHazir(payload.no);
      })
      .on("broadcast", { event: "yeniOda" }, ({ payload }) => {
        if (!mounted || myPlayer !== 2 || !payload?.oda) return;
        onRovansOda && onRovansOda(odaNesnesi(payload.oda, 2));
      })
      .on("presence", { event: "sync" }, () => {
        if (!mounted) return;
        const hepsi = rv.presenceState() || {};
        const var_ = Boolean(hepsi[String(myPlayer === 1 ? 2 : 1)]?.length);
        setRakipVar(var_);
        if (var_) setRakipGeldi(true);
      })
      .subscribe((st) => { if (st === "SUBSCRIBED") rv.track({ oyuncu: myPlayer }); });

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      try { rv.untrack(); } catch (e) {}
      rv.unsubscribe();
    };
  }, [room.id]);

  // Kulüp adları: sadece bu turun iki kulübü soruluyor (1000 satır sınırı).
  useEffect(() => {
    const ids = [roundRow?.club_a_id, roundRow?.club_b_id].filter((x) => x != null && !clubsMap[x]);
    if (!ids.length) return;
    let iptal = false;
    supabase.from("clubs").select("id, name").in("id", ids).then(({ data }) => {
      if (iptal || !data) return;
      setClubsMap((m) => {
        const yeni = { ...m };
        data.forEach((c) => (yeni[c.id] = c.name));
        return yeni;
      });
    });
    return () => { iptal = true; };
  }, [roundRow?.club_a_id, roundRow?.club_b_id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const phase = !roundRow ? "loading" : roundRow.resolved ? "result" : roundRow.buzzed_by ? "answering" : "racing";
  const myScore = (myPlayer === 1 ? roomRow?.score1 : roomRow?.score2) ?? 0;
  const oppScore = (myPlayer === 1 ? roomRow?.score2 : roomRow?.score1) ?? 0;
  const macBitti = phase === "result" && (myScore >= HEDEF || oppScore >= HEDEF);
  // Paket 23 — dereceli maçta rakip düşerse geri sayım; dönmezse galibiyet.
  const ayrildi = <RakipAyrildi oda={room} benKimim={myPlayer} rakipVar={rakipVar} aktif={phase !== "loading" && !macBitti} macNo={1} onExit={onExit} />;

  const roundTimeLeft = roundRow
    ? Math.max(0, Math.ceil((new Date(roundRow.round_deadline).getTime() - now) / 1000))
    : 0;
  const answerTimeLeft = roundRow?.answer_deadline
    ? Math.max(0, Math.ceil((new Date(roundRow.answer_deadline).getTime() - now) / 1000))
    : 0;
  const turSuresi = roundRow?.round_deadline && roundRow?.started_at
    ? Math.max(1, Math.round((new Date(roundRow.round_deadline) - new Date(roundRow.started_at)) / 1000))
    : 20;
  const iAmBuzzer = roundRow?.buzzed_by === myPlayer;
  const iAmLocked = roundRow?.locked_players?.includes(myPlayer);

  // --- Paket 36: ilk tur ancak iki taraf da ekrandayken --------------------
  // (Misafir mod rehberini okurken maç arkada başlamasın — rehber kapanmadan
  // ekranı bağlanmıyor, yani presence'ta görünmüyor.)
  const ilkTurRef = useRef(false);
  useEffect(() => {
    if (myPlayer !== 1 || ilkYukleme !== "yok" || !rakipGeldi || ilkTurRef.current || roundRow) return;
    ilkTurRef.current = true;
    supabase.rpc("generate_round", {
      p_room_id: room.id,
      p_round_number: 1,
      p_allowed_club_ids: roomRow?.allowed_club_ids ?? null,
    }).then(({ error }) => { if (error) ilkTurRef.current = false; }, () => { ilkTurRef.current = false; });
  }, [myPlayer, ilkYukleme, rakipGeldi, roundRow, roomRow]);

  // --- Süre dolunca turu kapat (ilk fark eden; RPC idempotent) -------------
  // Ağ hatasında tur takılı kalmasın diye 3 sn'de bir yeniden denenir.
  const sonDenemeRef = useRef(0);
  function zamanAsimi() {
    if (!roundRow || Date.now() - sonDenemeRef.current < 3000) return;
    sonDenemeRef.current = Date.now();
    supabase.rpc("resolve_timeout", { p_round_id: roundRow.id }).then(() => {}, () => {});
  }
  useEffect(() => {
    if (phase === "racing" && roundTimeLeft === 0) zamanAsimi();
    // Cevap hakkını alanın süresi (+pay) doldu ve hâlâ cevap gelmedi: o telefon
    // donmuş/arka planda olabilir — turu sunucu açar ya da kapatır.
    if (phase === "answering" && roundRow?.answer_deadline && now > new Date(roundRow.answer_deadline).getTime() + CEVAP_PAYI_MS) zamanAsimi();
  }, [phase, roundTimeLeft, now, roundRow]);

  // Cevap süresi bitti: kutuda ne yazılıysa (boşsa boş) gönder — ekran donmasın.
  const otoGonderRef = useRef(null);
  useEffect(() => {
    if (phase !== "answering" || !iAmBuzzer || answerTimeLeft > 0 || !roundRow) return;
    const anahtar = `${roundRow.id}-${roundRow.buzzed_at}`;
    if (otoGonderRef.current === anahtar) return;
    otoGonderRef.current = anahtar;
    setSesOnayIstegi(null);
    cevapGonder(answerInput);
  }, [phase, iAmBuzzer, answerTimeLeft, roundRow]);

  // --- Paket 36: sonraki tura geçiş (iki taraf da; 10 sn sonra otomatik) ---
  const sonucAnRef = useRef({ id: null, t: 0 });
  if (phase === "result" && roundRow && sonucAnRef.current.id !== roundRow.id) sonucAnRef.current = { id: roundRow.id, t: Date.now() };
  const sonrakiKalan = phase === "result" ? Math.max(0, SONRAKI_TUR_SN - Math.floor((now - sonucAnRef.current.t) / 1000)) : SONRAKI_TUR_SN;
  const [benHazirim, setBenHazirim] = useState(null);   // "sonraki tur" dediğim tur no (misafir)
  const uretilenRef = useRef(0);
  useEffect(() => {
    if (phase !== "result" || macBitti || !roundRow) return;
    const no = roundRow.round_number;
    if (myPlayer === 1) {
      if (sonrakiKalan === 0 || rakipHazir === no) handleNextRound();
    } else if (now - sonucAnRef.current.t > (SONRAKI_TUR_SN + 6) * 1000) {
      // Ev sahibi hiç geçirmediyse (bağlantısı koptu vb.) misafir kendisi üretir;
      // generate_round aynı tur numarasını iki kez üretmez (paket36).
      handleNextRound(true);
    }
  }, [phase, macBitti, sonrakiKalan, rakipHazir, roundRow, now]);

  // Maç sonu istatistik + XP (bir kez)
  const macIslendiRef = useRef(false);
  useEffect(() => {
    if (!macBitti || macIslendiRef.current) return;
    macIslendiRef.current = true;
    const kazandim = myScore > oppScore;
    recordRound("onlineDuel", kazandim);
    addXP(kazandim ? XP_MAC_GALIBIYETI : XP_MAC_MAGLUBIYETI);
  }, [macBitti, myScore, oppScore]);

  // Rövanş: iki taraf da istediyse odayı kuran yeni odayı açar.
  useEffect(() => {
    if (myPlayer !== 1 || !benIstedim || !rakipIstedi || kuruluyorRef.current || !roomRow) return;
    kuruluyorRef.current = true;
    (async () => {
      try {
        const yeni = await odaKur({
          gameMode: roomRow.game_mode || "classic",
          isRanked: !!roomRow.is_ranked,
          allowedClubIds: roomRow.allowed_club_ids ?? null,
          player2Id: roomRow.player2_id,
        });
        rvKanalRef.current?.send({ type: "broadcast", event: "yeniOda", payload: { oda: yeni } });
        onRovansOda && onRovansOda(odaNesnesi(yeni, 1));
      } catch (e) {
        kuruluyorRef.current = false;
        setRovansHata("Rövanş odası kurulamadı, tekrar dene.");
        setBenIstedim(false);
      }
    })();
  }, [myPlayer, benIstedim, rakipIstedi, roomRow, onRovansOda]);

  function rovansIste() {
    if (benIstedim) return;
    setRovansHata(null);
    setBenIstedim(true);
    rvKanalRef.current?.send({ type: "broadcast", event: "istek", payload: { kimden: myPlayer } });
  }

  function yayinla(event, payload) {
    try { rvKanalRef.current?.send({ type: "broadcast", event, payload }); } catch (e) {}
  }
  function tahminEkle(tur, kim, metin) {
    const m = String(metin || "").trim().slice(0, 60);
    setTahminler((t) => ({ ...t, [tur]: [...(t[tur] || []), { kim, metin: m }] }));
  }

  // --- cevap kutusu: öneriler + canlı yayın + mikrofon ----------------------
  const suggestIndex = useMemo(() => buildSuggestIndex(PLAYERS), []);
  const oneriler = useMemo(
    () => (phase === "answering" && iAmBuzzer && answerInput.trim().length >= 3 ? suggestPlayers(suggestIndex, answerInput) : []),
    [suggestIndex, answerInput, phase, iAmBuzzer]
  );
  const sonYayinRef = useRef(0);
  function yaziDegisti(metin) {
    setAnswerInput(metin);
    // Rakip ekranında canlı görünsün (çok sık yayın yapmamak için ~150 ms aralık).
    const t = Date.now();
    if (roundRow && t - sonYayinRef.current > 150) {
      sonYayinRef.current = t;
      yayinla("yaziyor", { tur: roundRow.id, metin });
    }
  }

  const teamAAd = roundRow ? clubsMap[roundRow.club_a_id] : null;
  const teamBAd = roundRow ? clubsMap[roundRow.club_b_id] : null;
  const { settings: appSettings } = useAppSettings();
  const sesOnayiAcik = appSettings?.voiceConfirm !== false;
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(
    () => sesIpuclari(PLAYERS, [teamAAd, teamBAd])
  );
  async function mikrofon() {
    setSesHata(null);
    if (isRecording) {
      try {
        const metin = await stopRecording();
        if (!metin) { setSesHata("Sesi anlayamadım, tekrar dener misin?"); return; }
        const gonder = (a) => { setAnswerInput(a); cevapGonder(a); };
        const yaz = (a) => yaziDegisti(a);
        if (sesOnayiAcik) setSesOnayIstegi({ duyulan: metin, ad: metin, gonder, yaz });
        else gonder(metin);
      } catch (err) {
        setSesHata(err?.message || "Ses tanıma başarısız oldu");
      }
    } else {
      try { await startRecording(); } catch (err) { setSesHata(err?.message || "Mikrofona erişilemedi"); }
    }
  }

  async function handleBuzz() {
    if (!roundRow) return;
    await supabase.rpc("buzz_round", { p_round_id: roundRow.id, p_player: myPlayer });
  }
  async function handlePass() {
    if (!roundRow) return;
    await supabase.rpc("pass_round", { p_round_id: roundRow.id, p_player: myPlayer });
  }
  async function cevapGonder(metin) {
    if (!roundRow) return;
    const text = String(metin || "");
    setAnswerInput("");
    if (text.trim()) {
      tahminEkle(roundRow.id, myPlayer, text);
      yayinla("tahmin", { tur: roundRow.id, metin: text });
    }
    yayinla("yaziyor", { tur: roundRow.id, metin: "" });
    await supabase.rpc("submit_guess", { p_round_id: roundRow.id, p_player: myPlayer, p_guess: text });
  }
  function handleSubmit() {
    if (!answerInput.trim()) return;
    cevapGonder(answerInput);
  }
  async function handleNextRound(yedek = false) {
    // Çakışan iki insert olmasın diye sıradaki turu normalde odayı kuran başlatır;
    // misafir "SONRAKİ TUR" deyince ona haber verir (yedek: ev sahibi sessiz kaldı).
    if (!roundRow || macBitti) return;
    const no = roundRow.round_number + 1;
    if (myPlayer !== 1 && !yedek) {
      setBenHazirim(roundRow.round_number);
      yayinla("sonraki", { no: roundRow.round_number });
      return;
    }
    if (uretilenRef.current >= no) return;
    uretilenRef.current = no;
    let hata = null;
    try {
      const { error } = await supabase.rpc("generate_round", {
        p_room_id: room.id,
        p_round_number: no,
        p_allowed_club_ids: roomRow?.allowed_club_ids ?? null,
      });
      hata = error;
    } catch (e) { hata = e; }
    if (hata) uretilenRef.current = no - 1;
  }

  // Tur sonucu: bilinen futbolcu (iki tarafta da fotoğraf + mini profil).
  const turTahminleri = (roundRow && tahminler[roundRow.id]) || [];
  const ciftOyunculari = useMemo(
    () => (teamAAd && teamBAd ? playersForPair(PLAYERS, teamAAd, teamBAd) : []),
    [teamAAd, teamBAd]
  );
  const bilinen = useMemo(() => {
    if (phase !== "result" || !roundRow?.winner) return null;
    const son = [...turTahminleri].reverse().find((t) => t.kim === roundRow.winner);
    if (!son) return null;
    const p = findMatchedPlayer(son.metin, ciftOyunculari);
    return { metin: son.metin, ad: p ? p.name : null };
  }, [phase, roundRow?.winner, roundRow?.id, turTahminleri, ciftOyunculari]);
  const ornekler = useMemo(() => {
    const liste = (roundRow?.revealed_answers || []).filter(Boolean);
    return [...new Set(liste)].sort((a, b) => taninirlik(b) - taninirlik(a));
  }, [roundRow?.revealed_answers]);
  const kilitAcildiRef = useRef(null);
  useEffect(() => {
    if (bilinen?.ad && roundRow?.winner === myPlayer && kilitAcildiRef.current !== roundRow.id) {
      kilitAcildiRef.current = roundRow.id;
      unlockPlayer(bilinen.ad);
    }
  }, [bilinen, roundRow?.winner, roundRow?.id]);

  if (phase === "loading") {
    return (
      <GameBackground style={styles.merkez}>
        <ActivityIndicator color={VURGU.main} />
        <Text style={styles.bekleme}>{!rakipGeldi ? "Rakip bekleniyor… (kuralları okuyor olabilir)" : "Maç hazırlanıyor..."}</Text>
        <SoundPressable onPress={onExit} style={styles.cikisBtn}>
          <Text style={styles.cikisText}>Lobiye dön</Text>
        </SoundPressable>
      </GameBackground>
    );
  }

  const teamA = teamAAd || "...";
  const teamB = teamBAd || "...";
  const rakipCanli = rakipYazi && rakipYazi.tur === roundRow.id && roundRow.buzzed_by && roundRow.buzzed_by !== myPlayer ? rakipYazi.metin : "";
  const rakipNo = myPlayer === 1 ? 2 : 1;
  const rakipYanlislar = turTahminleri.filter((t) => t.kim === rakipNo && !(roundRow.winner === rakipNo && bilinen && t.metin === bilinen.metin));
  const rovansHal = !rakipVar
    ? { etiket: "RAKİP AYRILDI", pasif: true, rakipIstiyor: false }
    : benIstedim
    ? { etiket: rakipIstedi ? "ODA KURULUYOR…" : "DAVET GÖNDERİLDİ…", pasif: true, rakipIstiyor: false }
    : rakipIstedi
    ? { etiket: "KABUL ET — RÖVANŞ", pasif: false, rakipIstiyor: true }
    : { etiket: "RÖVANŞ", pasif: false, rakipIstiyor: false };

  // 4 Ekim 2026 — klavye cevap kutusunu kapatmasın (components/Klavye.js).
  return (
    <GameBackground style={styles.kap}>
      {ayrildi}
      <KlavyeAlani style={{ flex: 1 }}>
        <KlavyeScroll contentContainerStyle={{ flexGrow: 1, paddingBottom: SPACING.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.ustSerit}>
            <View style={styles.skorKutu}>
              <Text style={styles.skorEtiket}>SEN</Text>
              <Text style={[styles.skorDeger, { color: COLORS.accent }]}>{myScore}</Text>
            </View>
            <View style={styles.ortaKutu}>
              <Text style={styles.turEtiket}>TUR {roundRow.round_number}</Text>
              <Text style={styles.hedefEtiket}>{HEDEF} puana ilk ulaşan kazanır</Text>
              {!rakipVar ? <Text style={styles.kopuk}>rakip bağlı değil</Text> : null}
            </View>
            <View style={styles.skorKutu}>
              <Text style={styles.skorEtiket}>RAKİP</Text>
              <Text style={[styles.skorDeger, { color: COLORS.cta }]}>{oppScore}</Text>
            </View>
          </View>

          <EslesmeKarti sol={{ tip: "kulup", ad: teamA }} sag={{ tip: "kulup", ad: teamB }} />

          {phase === "racing" && (
            <>
              <View style={{ marginTop: SPACING.lg }}>
                <TimerBar current={roundTimeLeft} total={turSuresi} />
                <Text style={[styles.sureYazi, roundTimeLeft <= 5 && { color: COLORS.danger }]}>{roundTimeLeft} sn</Text>
              </View>
              <SoundPressable
                disabled={iAmLocked}
                onPress={handleBuzz}
                style={[styles.buzzBtn, iAmLocked && styles.buzzBtnPasif]}
                accessibilityLabel="Cevap hakkını al"
              >
                <Ionicons name={iAmLocked ? "lock-closed" : "flash"} size={28} color={iAmLocked ? COLORS.textMuted : COLORS.accentDark} />
                <Text style={[styles.buzzYazi, iAmLocked && { color: COLORS.textMuted }]}>
                  {iAmLocked ? "Bu turda elendin" : "BİLİYORUM!"}
                </Text>
              </SoundPressable>
              {!iAmLocked && (
                <SoundPressable onPress={handlePass} style={styles.pasBtn}>
                  <Text style={styles.pasYazi}>Bilemedim, pas</Text>
                </SoundPressable>
              )}
              {turTahminleri.length ? (
                <View style={styles.tahminListe}>
                  {turTahminleri.map((t, i) => (
                    <Text key={i} style={styles.tahminSatir}>
                      {`${t.kim === myPlayer ? "Sen" : "Rakip"}: “${t.metin}” `}<Text style={{ color: COLORS.danger }}>✗</Text>
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )}

          {phase === "answering" && (
            <View style={{ marginTop: SPACING.lg }}>
              {iAmBuzzer ? (
                <>
                  <Text style={[styles.cevapBaslik, answerTimeLeft <= 3 && { color: COLORS.danger }]}>Sıra sende — {answerTimeLeft} sn</Text>
                  <View style={styles.girdiSatir}>
                    <TextInput
                      autoFocus
                      value={answerInput}
                      onChangeText={yaziDegisti}
                      onSubmitEditing={handleSubmit}
                      placeholder="İki takımda da oynamış futbolcu..."
                      placeholderTextColor={COLORS.textFaint}
                      autoCorrect={false}
                      autoCapitalize="words"
                      spellCheck={false}
                      style={styles.girdi}
                    />
                    <SoundPressable
                      style={[styles.mikBtn, isRecording && styles.mikBtnAktif]}
                      onPress={mikrofon}
                      disabled={isProcessing}
                      accessibilityLabel={isRecording ? "Kaydı durdur" : "Sesle söyle"}
                    >
                      <Ionicons name={isProcessing ? "hourglass" : isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#fff" : COLORS.text} />
                    </SoundPressable>
                    <SoundPressable style={styles.gonderBtn} onPress={handleSubmit} accessibilityLabel="Gönder">
                      <Ionicons name="send" size={18} color={COLORS.accentDark} />
                    </SoundPressable>
                  </View>
                  {oneriler.length > 0 && !sesOnayIstegi ? (
                    <View style={styles.oneriKutu}>
                      {oneriler.map((ad) => (
                        <Pressable key={ad} onPress={() => cevapGonder(ad)} style={styles.oneriSatir} accessibilityRole="button" accessibilityLabel={ad}>
                          <Text style={styles.oneriYazi}>{ad}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {isRecording ? <Text style={styles.sesIpucu}>Dinliyorum — bitince dokun</Text> : null}
                  {isProcessing ? <Text style={styles.sesIpucu}>Yazıya çevriliyor…</Text> : null}
                  {sesHata ? <Text style={[styles.sesIpucu, { color: COLORS.danger }]}>{sesHata}</Text> : null}
                  <VoiceConfirm
                    istek={sesOnayIstegi}
                    onOnayla={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i && i.gonder(ad); }}
                    onTekrar={() => { setSesOnayIstegi(null); mikrofon(); }}
                    onYaz={(ad) => { const i = sesOnayIstegi; setSesOnayIstegi(null); i && i.yaz(ad); }}
                    onIptal={() => setSesOnayIstegi(null)}
                  />
                </>
              ) : (
                <View style={styles.bilgiKart}>
                  <View style={styles.bilgiUst}>
                    <ActivityIndicator color={VURGU.main} />
                    <Text style={styles.bilgiYazi}>Rakip cevap veriyor · {answerTimeLeft} sn</Text>
                  </View>
                  <Text style={[styles.canliYazi, !rakipCanli && { color: COLORS.textFaint }]} numberOfLines={1} accessibilityLiveRegion="polite">
                    {rakipCanli ? `“${rakipCanli}”` : "yazıyor…"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {phase === "result" && (
            <View style={styles.sonucKart}>
              <Text style={[styles.sonucBaslik, { color: roundRow.winner === myPlayer ? COLORS.accent : roundRow.winner ? COLORS.cta : COLORS.text }]}>
                {roundRow.winner === 0 ? "Kimse bilemedi" : roundRow.winner === myPlayer ? "Puan senin!" : "Rakip bildi"}
              </Text>
              {roundRow.winner > 0 && bilinen ? (
                <View style={styles.bilinen}>
                  {bilinen.ad ? <PlayerPhoto name={bilinen.ad} size={84} /> : null}
                  <Text style={styles.bilinenAd}>{bilinen.ad || bilinen.metin}</Text>
                  <Text style={styles.bilinenAlt}>
                    {roundRow.winner === myPlayer ? "Senin cevabın" : "Rakibin cevabı"}{bilinen.ad && bilinen.ad !== bilinen.metin ? ` · “${bilinen.metin}”` : ""}
                  </Text>
                  {bilinen.ad ? <Text style={styles.dokunIpucu}>Profil için fotoğrafa dokun</Text> : null}
                </View>
              ) : null}
              {rakipYanlislar.length ? (
                <Text style={styles.tahminSatir}>Rakip denedi: {rakipYanlislar.map((t) => `“${t.metin}”`).join(", ")} ✗</Text>
              ) : null}
              {roundRow.winner === 0 && ornekler.length ? (
                <View style={styles.ornekFotolar}>
                  {ornekler.slice(0, 3).map((ad) => (
                    <View key={ad} style={styles.ornekFoto}>
                      <PlayerPhoto name={ad} size={56} />
                      <Text style={styles.ornekFotoAd} numberOfLines={2}>{ad}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.ornekBaslik}>{roundRow.winner === 0 ? "Diğer doğru cevaplar" : "Geçerli cevaplardan bazıları"}</Text>
              <Text style={styles.ornekMetin}>{ornekler.slice(roundRow.winner === 0 ? 3 : 0, roundRow.winner === 0 ? 11 : 8).join(" · ") || "—"}</Text>
              {!macBitti ? (
                myPlayer === 1 || benHazirim !== roundRow.round_number ? (
                  <SoundPressable style={styles.anaBtn} onPress={() => handleNextRound()} accessibilityLabel="Sonraki tur">
                    <Text style={styles.anaBtnYazi}>SONRAKİ TUR · {sonrakiKalan}</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.accentDark} />
                  </SoundPressable>
                ) : (
                  <Text style={styles.bekleme}>Hazırsın — sıradaki tur başlıyor… ({sonrakiKalan})</Text>
                )
              ) : null}
            </View>
          )}

          {macBitti ? (
            <OnlineMacSonu
              modAdi="Online — Ortak Kulüp"
              oda={room}
              benKimim={myPlayer}
              onExit={onExit}
              skorSen={myScore}
              skorRakip={oppScore}
              skorEtiketi="puan"
              kazanan={myScore > oppScore ? "sen" : "rakip"}
              hal={rovansHal}
              onRovans={rovansIste}
              ekSatir={rovansHata ? <Text style={[styles.bekleme, { color: COLORS.danger }]}>{rovansHata}</Text> : null}
            />
          ) : (
            <SoundPressable onPress={onExit} style={styles.cikisBtn}>
              <Text style={styles.cikisText}>Odadan çık</Text>
            </SoundPressable>
          )}
        </KlavyeScroll>
      </KlavyeAlani>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.xxl },
  merkez: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  bekleme: { ...TYPE.caption, marginTop: SPACING.md, textAlign: "center" },

  ustSerit: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  skorKutu: {
    flex: 1, alignItems: "center", backgroundColor: COLORS.card, borderColor: COLORS.cardBorder,
    borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  skorEtiket: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, fontWeight: "900" },
  skorDeger: { ...TYPE.h1 },
  ortaKutu: { flex: 1.2, alignItems: "center" },
  turEtiket: { ...TYPE.h3, fontSize: 14 },
  hedefEtiket: { ...TYPE.caption, fontSize: 12, textAlign: "center" },
  kopuk: { ...TYPE.caption, fontSize: 12, color: COLORS.danger, marginTop: 2 },

  takimKart: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderColor: VURGU.main,
    borderWidth: 2, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.card,
  },
  takim: { flex: 1, alignItems: "center", gap: SPACING.sm },
  takimAd: { ...TYPE.h3, fontSize: 15, textAlign: "center" },
  arti: { color: VURGU.main, fontWeight: "900", fontSize: 24, marginHorizontal: SPACING.sm },
  sureYazi: { ...TYPE.caption, textAlign: "center", marginTop: -6, fontWeight: "800", color: COLORS.text },

  buzzBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.accent, borderRadius: RADIUS.xl, paddingVertical: 34,
    alignItems: "center", justifyContent: "center", gap: 6, ...SHADOW.card,
  },
  buzzBtnPasif: { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder },
  buzzYazi: { fontSize: 22, fontWeight: "900", letterSpacing: 1.5, color: COLORS.accentDark },
  pasBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: "center" },
  pasYazi: { ...TYPE.caption, textDecorationLine: "underline" },

  cevapBaslik: { ...TYPE.h3, color: COLORS.accent, textAlign: "center", marginBottom: SPACING.sm },
  girdiSatir: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  girdi: {
    flex: 1, minWidth: 0, backgroundColor: COLORS.card, borderColor: COLORS.accent, borderWidth: 2, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: 16,
  },
  gonderBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, ...SHADOW.card },
  bilgiKart: {
    alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  bilgiUst: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  bilgiYazi: { ...TYPE.body, fontWeight: "800" },
  canliYazi: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  mikBtn: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  mikBtnAktif: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  oneriKutu: { marginTop: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: "hidden" },
  oneriSatir: { paddingVertical: 11, paddingHorizontal: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.cardBorder },
  oneriYazi: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  sesIpucu: { ...TYPE.caption, textAlign: "center", marginTop: SPACING.sm },
  tahminListe: { marginTop: SPACING.md, alignItems: "center", gap: 2 },
  tahminSatir: { ...TYPE.caption, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm },
  bilinen: { alignItems: "center", marginTop: SPACING.md, gap: 4 },
  bilinenAd: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: SPACING.sm },
  bilinenAlt: { ...TYPE.caption, textAlign: "center" },
  dokunIpucu: { ...TYPE.caption, fontSize: 11, color: COLORS.textFaint },
  ornekFotolar: { flexDirection: "row", justifyContent: "center", gap: SPACING.md, marginTop: SPACING.md },
  ornekFoto: { alignItems: "center", width: 88 },
  ornekFotoAd: { ...TYPE.caption, fontSize: 12, color: COLORS.text, fontWeight: "800", textAlign: "center", marginTop: 4 },

  sonucKart: {
    backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg, alignItems: "center",
  },
  sonucBaslik: { ...TYPE.h2, textAlign: "center" },
  ornekBaslik: { ...TYPE.caption, fontSize: 12, letterSpacing: 1, marginTop: SPACING.md, textTransform: "uppercase" },
  ornekMetin: { ...TYPE.caption, color: COLORS.text, textAlign: "center", marginTop: 4, lineHeight: 18 },
  anaBtn: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "center", backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, marginTop: SPACING.lg, ...SHADOW.card,
  },
  anaBtnYazi: { ...TYPE.button, color: COLORS.accentDark },
  cikisBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.lg },
  cikisText: { ...TYPE.caption, textDecorationLine: "underline" },
});
