// ============================================================================
// HESAP SİLME — Google Play zorunluluğu (12 Eylül 2026).
//
// Play, hesap oluşturan her uygulamada hem UYGULAMA İÇİ silme hem de web
// üzerinden erişilebilen bir silme talebi yolu istiyor. Bir kullanıcının Auth
// kaydını silmek service_role yetkisi gerektiriyor ve o anahtar asla istemciye
// konulamaz — bu yüzden işlem burada, sunucuda yapılıyor.
//
// GÜVENLİK: Fonksiyon çağıranın KENDİ oturum jetonunu doğruluyor ve yalnızca
// o jetonun sahibi olan kullanıcıyı siliyor. Gövdeden gelen bir id'ye
// GÜVENMİYOR — aksi halde herkes herkesin hesabını silebilirdi.
//
// Silinenler: avatar dosyası, profiles satırı ve Auth kullanıcısı. Oyun
// verisi (game_stats, reports) cihaz kimliğine bağlı ve kişiyi tanımlamıyor,
// ama kullanıcıya bağlı olan her şey gidiyor.
//
// KURULUM:
//   npx supabase functions deploy delete-account
//   (SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_URL platform tarafından otomatik
//    sağlanıyor, ayrıca secret eklemene gerek yok.)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Oturum jetonu yok" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Sunucu yapılandırması eksik" }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Jetonun sahibini ÇÖZ — silinecek kullanıcı yalnızca bu olabilir.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Oturum geçersiz" }, 401);

    // 1) Avatar dosyası
    await admin.storage.from("avatars").remove([`${user.id}/avatar.jpg`]).catch(() => {});

    // 2) Profil satırı
    await admin.from("profiles").delete().eq("id", user.id);

    // 3) Auth kullanıcısı
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
