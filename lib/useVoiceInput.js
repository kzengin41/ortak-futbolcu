import { useState, useRef } from "react";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const TRANSCRIBE_URL = `${supabaseUrl}/functions/v1/transcribe`;

// 26 Eylül 2026 (Kerem: "mikrofonlu cevaplarda performans düştü, çok zaman
// alıyor sanki işlemesi") — kayıt ayarı konuşmaya göre küçültüldü.
// ESKİ: HIGH_QUALITY = 44,1 kHz, STEREO, 128 kbps (müzik kalitesi). 3 saniyelik
// bir cevap ~50 KB oluyordu ve mobil veride yükleme süresinin çoğunu bu
// alıyordu. Whisper sesi zaten 16 kHz MONO'ya indirerek işliyor — yani o
// fazladan veri tanımaya HİÇBİR katkı yapmadan sadece yüklemeyi yavaşlatıyordu.
// YENİ: 16 kHz, mono, 32 kbps AAC (.m4a) — dosya ~6 kat küçük, tanıma aynı.
const KONUSMA_KAYDI = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
};

// Sesli cevap: kaydet, Supabase Edge Function'a (o da Whisper'a) gönder,
// yazıya çevrilmiş metni döndür. API anahtarı istemcide hiç yok.
//
// ipucuUret (isteğe bağlı): Whisper'a gidecek isim ipuçlarını üreten fonksiyon.
// Kayıt BAŞLAR BAŞLAMAZ (kullanıcı konuşurken) çağrılıyor ki hesaplama
// süresi cevap bekleme süresine eklenmesin.
export function useVoiceInput(ipucuUret) {
  const recorder = useAudioRecorder(KONUSMA_KAYDI);
  const ipucuFn = useRef(ipucuUret);
  ipucuFn.current = ipucuUret;
  const hazirIpucu = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const permissionGranted = useRef(false);

  async function ensurePermission() {
    if (permissionGranted.current) return true;
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) return false;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    permissionGranted.current = true;
    return true;
  }

  async function startRecording() {
    const ok = await ensurePermission();
    if (!ok) throw new Error("Mikrofon izni verilmedi");
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    hazirIpucu.current = [];
    if (ipucuFn.current) {
      // Bir sonraki tikte: önce "kaydediliyor" arayüzü çizilsin.
      setTimeout(() => {
        try { hazirIpucu.current = ipucuFn.current() || []; } catch (e) { hazirIpucu.current = []; }
      }, 0);
    }
  }

  // Kaydı durdurur, sunucuya gönderir, yazıya çevrilmiş metni döner.
  // nameHints: Bu turdaki geçerli oyuncu isimlerinin listesi (string[]).
  // Whisper'a bağlam ipucu olarak veriliyor — tanıma doğruluğunu ciddi
  // şekilde artırıyor (özellikle "Olaitan Ojo" gibi nadir isimler için).
  async function stopRecording(nameHints) {
    const t0 = Date.now();
    setIsRecording(false);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) throw new Error("Kayıt bulunamadı");
    // Dizi verildiyse (boş dizi dahil) o kullanılır; hiç verilmediyse kayıt başında hazırlanan ipuçları.
    const ipuclari = Array.isArray(nameHints) ? nameHints : hazirIpucu.current;

    setIsProcessing(true);
    try {
      // 4 Eylül 2026 — MİKROFON YÜKLEME MACERASI (3 başarısız deneme sonrası
      // 4. ve umarım son yaklaşım). Kronoloji:
      //   1) ESKİ HÂL: `formData.append("audio", { uri, type, name })`
      //      (React Native'in klasik "dosya nesnesi" kalıbı) + `fetch()`
      //      → "Unsupported FormDataPart implementation" hatası.
      //   2) `fetch(uri).blob()` ile gerçek Blob'a çevirdik
      //      → OpenAI "Invalid file format" dedi.
      //   3) Blob'u `new Blob([rawBlob], { type: "audio/m4a" })` ile doğru
      //      MIME etiketiyle sardık → yine "Invalid file format".
      //   4) `.arrayBuffer()` + `new Blob([arrayBuffer])` denedik
      //      → "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are
      //         not supported" (React Native'in Blob implementasyonu
      //         ArrayBuffer'dan Blob üretmeyi HİÇ desteklemiyor).
      //
      // BU DENEMELERİN ORTAK DERSİ: Sorun dosyanın İÇERİĞİNDE değil, modern
      // `fetch` + Blob köprüsünde. Kritik ayrıntı: React Native'in FormData
      // implementasyonu `append(key, value, filename)` çağrısının ÜÇÜNCÜ
      // parametresini (dosya adını) YOK SAYIYOR — yani Blob gönderdiğimizde
      // multipart parçası "answer.m4a" adını HİÇ taşımıyor. OpenAI Whisper
      // ise ses formatını DOSYA ADI UZANTISINDAN belirliyor; adsız bir parça
      // geldiğinde tam olarak "Invalid file format" diyor. Bu, 2. ve 3.
      // denemelerin neden aynı hatayı verdiğini de açıklıyor.
      //
      // ÇÖZÜM: `fetch` yerine doğrudan `XMLHttpRequest` kullanıyoruz.
      // React Native'in XHR + FormData yolu, `{ uri, name, type }` dosya
      // nesnesini NATIVE tarafta işliyor (multipart'ı JS'te değil, native
      // networking katmanında kuruyor) — dosya adı ve MIME türü olduğu gibi
      // korunuyor, Blob köprüsüne hiç girilmiyor. Bu, RN'de dosya yüklemenin
      // en eski ve en güvenilir yolu.
      const t1 = Date.now();
      const sonuc = await uploadForTranscription(uri, ipuclari);
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // Hangi adım yavaş? kayıt kapatma / (yükleme + sunucu) / (sunucu içinde OpenAI)
        console.log(`[ses] kayit-kapat ${t1 - t0}ms, toplam ${Date.now() - t0}ms, sunucu-openai ${sonuc.sure ?? "?"}ms`);
      }
      return sonuc.text;
    } finally {
      setIsProcessing(false);
    }
  }

  return { isRecording, isProcessing, startRecording, stopRecording };
}

// Ses kaydını Supabase Edge Function'a XMLHttpRequest ile yükler.
// (Neden fetch değil de XHR: yukarıdaki uzun nota bakınız.)
function uploadForTranscription(uri, nameHints = []) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("audio", { uri, name: "answer.m4a", type: "audio/m4a" });

    // Max 30 isim gönder (Whisper prompt'u ~224 token ile sınırlı)
    if (nameHints.length > 0) {
      formData.append("names", nameHints.slice(0, 30).join(", "));
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", TRANSCRIBE_URL);
    xhr.setRequestHeader("Authorization", `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    // Content-Type'ı BİLEREK set etmiyoruz: multipart boundary'sini native
    // katman kendi üretmeli, elle yazarsak bozulur.
    xhr.timeout = 30000;

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        // JSON değilse aşağıda ham metinle hata verilecek
      }
      const errText = data && data.error
        ? (typeof data.error === "string" ? data.error : JSON.stringify(data.error))
        : null;
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(errText || `Sunucu hatası (${xhr.status})`));
        return;
      }
      if (errText) {
        reject(new Error(errText));
        return;
      }
      if (!data) {
        reject(new Error("Sunucudan beklenmeyen bir yanıt geldi"));
        return;
      }
      resolve({ text: (data.text || "").trim(), sure: data.sure });
    };
    xhr.onerror = () => reject(new Error("Ağ hatası: sunucuya ulaşılamadı"));
    xhr.ontimeout = () => reject(new Error("Sunucu zaman aşımına uğradı, tekrar dener misin?"));

    xhr.send(formData);
  });
}
