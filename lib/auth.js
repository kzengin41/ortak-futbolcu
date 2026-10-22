import { supabase } from "./supabaseClient";
import { deviriHazirla, deviriTamamla, dereceOnbelleginiTemizle } from "./derece";

// Faz 5 (31 Ağustos 2026) — Kerem'in isteği: "kullanıcı altyapısı kurulmalı.
// profil, mail-şifre, avatar, bunların veritabanı bağlantıları vs." Bu dosya
// e-posta/şifre ile Supabase Auth akışını sarmalıyor. Uygulama hesapsız da
// (misafir/cihaz bazlı, eskisi gibi) TAMAMEN çalışmaya devam ediyor — hesap
// isteğe bağlı bir katman, zorunlu değil.

// Paket 23 (11 Ekim 2026): online için her cihaz sessizce ANONİM oturum açıyor
// (lib/supabaseClient.js oturumKimligi). E-posta ile giriş/kayıt olunca
// anonim oturumdaki derece (online puan) kartı yeni hesaba taşınır
// (lib/derece.js deviriHazirla / deviriTamamla). Anonim oturum "hesap"
// sayılmaz: getCurrentUser onu null döner, Hesabım ekranı giriş formunu gösterir.
export async function signUpWithEmail(email, password) {
  await deviriHazirla();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (!error && data?.session) await deviriTamamla();
  return { user: data?.user || null, session: data?.session || null, error };
}

export async function signInWithEmail(email, password) {
  await deviriHazirla();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error && data?.session) await deviriTamamla();
  return { user: data?.user || null, session: data?.session || null, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  await dereceOnbelleginiTemizle();
  return { error };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  const u = data?.user || null;
  return u && !u.is_anonymous ? u : null;
}

// Ekranların login/logout durumuna canlı tepki vermesi için — dönen
// fonksiyonu çağırınca abonelik iptal edilir (useEffect cleanup'ta kullan).
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user || null;
    callback(u && !u.is_anonymous ? u : null);
  });
  return () => data?.subscription?.unsubscribe();
}

// ---------------------------------------------------------------- şifre sıfırlama
// Paket 41 (21 Ekim 2026) — Kerem: "şifremi unuttum ekleyelim". Bağlantı
// (deep link) yerine KOD: Supabase "Reset Password" e-posta şablonunda
// {{ .Token }} var; kullanıcı e-postadaki kodu ve yeni şifresini uygulamaya
// yazar. Yerel (native) değişiklik gerekmez, `eas update` ile gider.
// Mailin gidebilmesi için Supabase'e özel SMTP bağlı olmalı (varsayılan
// servis yalnız proje ekibine mail atar).
export const ASGARI_SIFRE = 6;

function sifirlamaHatasi(error) {
  const m = String((error && error.message) || "").toLowerCase();
  if ((error && error.status === 429) || m.includes("security purposes") || m.includes("rate limit")) return "sik";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) return "kod";
  if (m.includes("password")) return "sifre";
  return "genel";
}

// E-postaya sıfırlama kodu gönderir. Supabase, kayıtlı olmayan adres için de
// "tamam" döner (kimin üye olduğu anlaşılmasın diye) — ekran da öyle davranır.
export async function sifreSifirlamaKoduGonder(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email || "").trim());
    if (!error) return { hata: null };
    const h = sifirlamaHatasi(error);
    return { hata: h === "sik" ? "sik" : "genel" };
  } catch (e) {
    return { hata: "genel" };
  }
}

// Kod doğruysa oturum açılır ve şifre yenilenir. Şifre yenilenemese bile
// oturum açılmış olur (kullanıcı = giriş yapmış), bu durumda hata "sifre".
export async function sifreyiKodlaYenile(email, kod, yeniSifre) {
  try {
    await deviriHazirla();
    const { data, error } = await supabase.auth.verifyOtp({
      email: String(email || "").trim(),
      token: String(kod || "").replace(/\s/g, ""),
      type: "recovery",
    });
    if (error || !data?.session) return { user: null, hata: error ? sifirlamaHatasi(error) : "kod" };
    const { error: e2 } = await supabase.auth.updateUser({ password: yeniSifre });
    await deviriTamamla();
    return { user: data.user, hata: e2 ? "sifre" : null };
  } catch (e) {
    return { user: null, hata: "genel" };
  }
}
