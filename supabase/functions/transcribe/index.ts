// ============================================================================
// Sesli cevap girişi için sunucu tarafı köprü. İstemci ses dosyasını buraya
// gönderir, biz de OpenAI Whisper'a iletip yazıya çevrilmiş metni geri
// döneriz. API ANAHTARI SADECE BURADA (sunucuda) — istemciye/APK'ya hiç
// gömülmez, ters mühendislikle çalınamaz.
// ============================================================================

// Paket 16 (5 Ekim 2026) — kötüye kullanım sınırı. Bu fonksiyonu APK'daki
// herkese açık anon anahtarla herkes çağırabiliyor; büyük bir dosya ya da
// uzun bir "ipucu" metni OpenAI faturasını şişirebilir. Uygulama sesi 32 kbps
// kaydediyor (~4 KB/sn) ve bir cevap birkaç saniye: 400 KB (~100 sn) fazlasıyla
// yeter. (Ek güvence: OpenAI hesabında aylık 5 $ harcama sınırı var.)
const AZAMI_BAYT = 400 * 1024;
const AZAMI_IPUCU = 1500;   // karakter

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY ayarlı değil (supabase secrets set ile ekle)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gövdeyi okumadan önce: istemci boyutu bildiriyorsa büyük isteği hemen reddet.
    const bildirilen = Number(req.headers.get("content-length") || 0);
    if (bildirilen > AZAMI_BAYT + 64 * 1024) {
      return new Response(JSON.stringify({ error: "Ses kaydı çok uzun" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingForm = await req.formData();
    const audioFile = incomingForm.get("audio");
    if (!audioFile || typeof audioFile === "string") {
      return new Response(JSON.stringify({ error: "audio alanı eksik ya da dosya değil" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // İstemci bu turdaki geçerli oyuncu isimlerini gönderirse Whisper'a
    // bağlam ipucu olarak veriyoruz. Whisper'ın prompt'u önceki konuşma metni
    // gibi davrandığından, listede geçen isimler öncelikli olarak tanınıyor.
    // 26 Eylül 2026: istemci artık SADECE doğru cevapları değil, turdaki
    // kulüplerin tanınmış oyuncularını karışık gönderiyor (bkz. gameEngine
    // sesIpuclari) — ipucu listesi cevabı ele vermesin diye.
    const hamIpucu = incomingForm.get("names"); // "Ronaldo, Messi, Olaitan Ojo, ..."
    const namesHint = typeof hamIpucu === "string" ? hamIpucu.slice(0, AZAMI_IPUCU) : null;
    const prompt = namesHint
      ? `Futbolcu isimleri: ${namesHint}.`
      : "Futbolcu ismi: Ronaldo, Messi, Drogba, Okocha, Iniesta, Zidane, Ballack.";

    // ========================================================================
    // 11 Eylül 2026 — MİKROFONUN "Unsupported FormDataPart implementation"
    // HATASININ ASIL SEBEBİ BURASIYDI.
    //
    // Eskiden şöyleydi:
    //     openaiForm.append("file", audioFile, "answer.m4a");
    // yani GELEN istekten `req.formData()` ile alınan File nesnesi, olduğu
    // gibi GİDEN FormData'ya konuluyordu. Deno bu nesneyi giden çok parçalı
    // (multipart) gövdeye serileştiremiyor ve "Unsupported FormDataPart
    // implementation" fırlatıyor. Hata catch'e düşüp aynen istemciye
    // dönüyordu — bu yüzden telefonda bir istemci hatası gibi görünüyor,
    // istemci tarafında ne denenirse denensin geçmiyordu. (Dört ayrı istemci
    // yaklaşımı bu yüzden boşa gitti: fetch+{uri,type,name}, .blob(),
    // yeniden sarmalanmış Blob, arrayBuffer.)
    //
    // ÇÖZÜM: baytları okuyup Deno'nun KENDİ ürettiği yeni bir Blob'a koymak.
    // Bu nesne sorunsuz serileşiyor.
    //
    // Uzantı da önemli: Whisper dosya biçimini DOSYA ADININ UZANTISINDAN
    // belirliyor. Gelen parçanın kendi adından uzantıyı koruyoruz, yoksa
    // .m4a'ya düşüyoruz (expo-audio Android/iOS'ta m4a üretiyor).
    // ========================================================================
    const gelenAd = (audioFile as File).name || "answer.m4a";
    const uzanti = (gelenAd.match(/\.(m4a|mp4|mp3|wav|webm|ogg|flac|mpga|mpeg)$/i)?.[1] || "m4a").toLowerCase();
    const baytlar = new Uint8Array(await audioFile.arrayBuffer());
    if (baytlar.byteLength > AZAMI_BAYT) {
      return new Response(JSON.stringify({ error: "Ses kaydı çok uzun" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (baytlar.byteLength < 1000) {
      return new Response(JSON.stringify({ error: "Ses kaydı boş ya da çok kısa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sesBlob = new Blob([baytlar], { type: audioFile.type || `audio/${uzanti}` });

    const openaiForm = new FormData();
    openaiForm.append("file", sesBlob, `answer.${uzanti}`);
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "tr");
    openaiForm.append("prompt", prompt);

    // 26 Eylül 2026: OpenAI'nin ne kadar sürdüğünü istemciye bildiriyoruz
    // (geliştirme modunda terminalde "[ses] ... sunucu-openai Xms" yazar) —
    // yavaşlık yüklemede mi Whisper'da mı, bunu ayırt etmek için.
    const openaiBasla = Date.now();
    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: `OpenAI hatası: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openaiRes.json();
    return new Response(JSON.stringify({ text: data.text || "", sure: Date.now() - openaiBasla }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
