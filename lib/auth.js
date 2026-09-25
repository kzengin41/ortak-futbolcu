import { supabase } from "./supabaseClient";

// Faz 5 (31 Ağustos 2026) — Kerem'in isteği: "kullanıcı altyapısı kurulmalı.
// profil, mail-şifre, avatar, bunların veritabanı bağlantıları vs." Bu dosya
// e-posta/şifre ile Supabase Auth akışını sarmalıyor. Uygulama hesapsız da
// (misafir/cihaz bazlı, eskisi gibi) TAMAMEN çalışmaya devam ediyor — hesap
// isteğe bağlı bir katman, zorunlu değil.

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  return { user: data?.user || null, session: data?.session || null, error };
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return { user: data?.user || null, session: data?.session || null, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

// Ekranların login/logout durumuna canlı tepki vermesi için — dönen
// fonksiyonu çağırınca abonelik iptal edilir (useEffect cleanup'ta kullan).
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return () => data?.subscription?.unsubscribe();
}
