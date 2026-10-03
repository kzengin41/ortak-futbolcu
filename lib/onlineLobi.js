// ============================================================================
// ONLINE ODA İŞLEMLERİ — 5 Ekim 2026 (benchmark .29682 / .29750)
//
// Lobideki oda kurma / kodla katılma / rastgele eşleşme kodu ekrandan buraya
// alındı: maç sonu rövanşı da (Düello) aynı işlemleri kullanıyor.
//
// RASTGELE EŞLEŞME vs. ARKADAŞ ODASI — ESKİDEN "otomatik eşleş" bekleyen HER
// odaya giriyordu; arkadaşına kod göndermiş birinin odasına yabancı biri
// düşebiliyordu. Ek sütun (ve SQL göçü) gerekmesin diye ayrım KODUN
// UZUNLUĞUNDA: arkadaş odası 5 hane, rastgele eşleşme odası 6 hane. Rastgele
// arama yalnızca 6 haneli ve son 3 dakikada kurulmuş odalara bakıyor (terk
// edilmiş hayalet odaya düşmemek için).
// ============================================================================
import { supabase, getDeviceId } from "./supabaseClient";

export const KOD_HARFLERI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ARKADAS_KOD_UZUNLUK = 5;
export const RASTGELE_KOD_UZUNLUK = 6;
export const RASTGELE_ODA_OMRU_MS = 3 * 60 * 1000;

export function rastgeleKod(uzunluk = ARKADAS_KOD_UZUNLUK, rnd = Math.random) {
  return Array.from({ length: uzunluk }, () => KOD_HARFLERI[Math.floor(rnd() * KOD_HARFLERI.length)]).join("");
}

export function rastgeleOdaMi(kod) {
  return String(kod || "").length === RASTGELE_KOD_UZUNLUK;
}

// Oda satırından ekranların beklediği "room" nesnesi.
export function odaNesnesi(satir, playerNumber) {
  return {
    id: satir.id,
    code: satir.code,
    playerNumber,
    allowedClubs: satir.allowed_club_ids ?? null,
    gameMode: satir.game_mode || "classic",
    isRanked: !!satir.is_ranked,
  };
}

// Eşleşme profilinin kulüp ADLARINI sunucudaki kimliklere çevir (150'lik
// parçalar: PostgREST'in "in" listesi URL'de taşınıyor).
export async function kulupKimlikleri(adlar) {
  if (!adlar) return null;
  const liste = [...adlar];
  const kimlikler = [];
  for (let i = 0; i < liste.length; i += 150) {
    const { data, error } = await supabase.from("clubs").select("id").in("name", liste.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const s of data || []) kimlikler.push(s.id);
  }
  return kimlikler.length < 2 ? null : kimlikler;   // filtre boş kaldıysa hepsi
}

export async function odaKur({ gameMode = "classic", isRanked = false, allowedClubIds = null, rastgele = false, player2Id = null } = {}) {
  const ben = await getDeviceId();
  const satir = {
    code: rastgeleKod(rastgele ? RASTGELE_KOD_UZUNLUK : ARKADAS_KOD_UZUNLUK),
    player1_id: ben,
    status: player2Id ? "active" : "waiting",
    allowed_club_ids: allowedClubIds,
    game_mode: gameMode,
    is_ranked: isRanked,
  };
  if (player2Id) satir.player2_id = player2Id;
  const { data, error } = await supabase.from("rooms").insert(satir).select().single();
  if (error || !data) throw new Error(error?.message || "Oda kurulamadı");
  return data;
}

// Oda "active" olunca (rakip girince) cb(satir). Dönen fonksiyon dinlemeyi bırakır.
export function odaAktifOlunca(odaId, cb) {
  let bitti = false;
  const kanal = supabase
    .channel(`room-${odaId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${odaId}` }, (p) => {
      if (bitti || !p.new || p.new.status !== "active") return;
      bitti = true;
      cb(p.new);
    })
    .subscribe();
  return () => { bitti = true; try { kanal.unsubscribe(); } catch (e) {} };
}

// Bekleyen odayı kapat (iptal, ekrandan çıkış). Rastgele aramada hayalet oda kalmasın.
export async function odayiKapat(odaId) {
  if (!odaId) return;
  try { await supabase.from("rooms").update({ status: "finished" }).eq("id", odaId).eq("status", "waiting"); } catch (e) {}
}

// Koda göre bekleyen odaya katıl. Başarısızsa anlaşılır bir Hata fırlatır.
export async function koduylaKatil(kod) {
  const temiz = String(kod || "").trim().toUpperCase();
  if (!temiz) throw new Error("Oda kodunu yaz.");
  const ben = await getDeviceId();
  const { data: oda } = await supabase.from("rooms").select("*").eq("code", temiz).eq("status", "waiting").maybeSingle();
  if (!oda) throw new Error("Bu kodla bekleyen bir oda bulunamadı.");
  if (oda.player1_id === ben) throw new Error("Bu oda senin — kodu arkadaşına gönder.");
  // .eq("status","waiting"): iki kişi aynı anda girerse yalnız ilki başarılı olur.
  const { data: guncel } = await supabase
    .from("rooms").update({ player2_id: ben, status: "active" })
    .eq("id", oda.id).eq("status", "waiting").select().maybeSingle();
  if (!guncel) throw new Error("Bu oda az önce doldu, başka bir kod dene.");
  return odaNesnesi(guncel, 2);
}

// Rastgele rakip: aynı mod + aynı maç türünde, son 3 dakikada kurulmuş, 6
// haneli (rastgele eşleşme) bir oda varsa ona gir; yoksa null.
// oncesi: kendi odamızı kurmuş bekliyorsak yalnız BİZDEN ÖNCE kurulmuş odalara
// bakılır — aynı anda arayan iki kişi birbirinin odasına girmeye çalışıp
// ikisi de yarı yolda kalmasın (eskisi bekler, yenisi ona katılır).
export async function rastgeleOdaBul({ gameMode = "classic", isRanked = false, simdi = Date.now(), oncesi = null } = {}) {
  const ben = await getDeviceId();
  let sorgu = supabase
    .from("rooms").select("*")
    .eq("status", "waiting").eq("game_mode", gameMode).eq("is_ranked", isRanked)
    .neq("player1_id", ben)
    .gt("created_at", new Date(simdi - RASTGELE_ODA_OMRU_MS).toISOString())
    .like("code", "_".repeat(RASTGELE_KOD_UZUNLUK));
  if (oncesi) sorgu = sorgu.lt("created_at", oncesi);
  const { data: odalar } = await sorgu.order("created_at", { ascending: true }).limit(3);
  for (const oda of odalar || []) {
    const { data: guncel } = await supabase
      .from("rooms").update({ player2_id: ben, status: "active" })
      .eq("id", oda.id).eq("status", "waiting").select().maybeSingle();
    if (guncel) return odaNesnesi(guncel, 2);
  }
  return null;
}
