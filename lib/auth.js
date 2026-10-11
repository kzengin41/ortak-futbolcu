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
