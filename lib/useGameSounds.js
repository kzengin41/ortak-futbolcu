import { useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { useSoundSettings } from "./SettingsContext";

const whistleSource = require("../assets/sounds/whistle.mp3");
const correctSource = require("../assets/sounds/correct.mp3");
const wrongSource = require("../assets/sounds/wrong.mp3");
const clickSource = require("../assets/sounds/click.mp3");
const ambienceSource = require("../assets/sounds/ambience.mp3");

// Her ses için AYRI, tek bir hook — bir ekran sadece ihtiyacı olan sesi
// yükler. Her hook, ilgili ayar 0 ise sessizce hiçbir şey yapmıyor.
export function useWhistleSound() {
  const player = useAudioPlayer(whistleSource);
  const { settings } = useSoundSettings();
  return () => {
    if (settings.whistle <= 0) return;
    try {
      player.volume = settings.whistle;
      player.seekTo(0);
      player.play();
    } catch {}
  };
}

export function useCorrectSound() {
  const player = useAudioPlayer(correctSource);
  const { settings } = useSoundSettings();
  return () => {
    if (settings.correctWrong <= 0) return;
    try {
      player.volume = settings.correctWrong;
      player.seekTo(0);
      player.play();
    } catch {}
  };
}

// 26 Eylül 2026 (Kerem: "cpu doğru bilince doğru bilme sesi çalmasın. klik
// gibi uygun bir ses vs düşün o çalsın.") — CPU'nun doğru cevabı artık
// "tebrikler" sesiyle değil, nötr bir top dokunuşu (click.mp3) ile duyuluyor:
// hamle yapıldığı anlaşılsın ama kullanıcıya kutlama gibi gelmesin.
// Doğru/yanlış ses ayarı (correctWrong) kapalıysa bu da çalmaz.
export function useCpuCorrectSound() {
  const player = useAudioPlayer(clickSource);
  const { settings } = useSoundSettings();
  return () => {
    if (settings.correctWrong <= 0) return;
    try {
      player.volume = Math.min(1, settings.correctWrong);
      player.seekTo(0);
      player.play();
    } catch {}
  };
}

export function useWrongSound() {
  const player = useAudioPlayer(wrongSource);
  const { settings } = useSoundSettings();
  return () => {
    if (settings.correctWrong <= 0) return;
    try {
      player.volume = settings.correctWrong;
      player.seekTo(0);
      player.play();
    } catch {}
  };
}

export function useClickSound() {
  const player = useAudioPlayer(clickSource);
  const { settings } = useSoundSettings();
  return () => {
    if (settings.click <= 0) return;
    try {
      player.volume = settings.click;
      player.seekTo(0);
      player.play();
    } catch {}
  };
}

// Arka planda durmadan çalan tribün uğultusu. App.js'te BİR KEZ kullanılıyor
// (bütün uygulama boyunca sürsün diye) — ayar >0 iken otomatik başlar,
// kapatılınca/açılınca canlı olarak tepki verir.
// 11 Eylül 2026 (Kerem: "butonlara basınca blip diye bir ses geliyor, onu topa
// dokunma sesi gibi bir şey yapmak istiyorum. ve sadece butonlara değil
// herhangi bir yere tıklandığında gelsin. kullanıcının canı isterse boş bir
// yere sürekli tıklayarak topa vurma sesi çıkartsın.")
//
// ÜÇ AYRI OYNATICI kullanıyoruz çünkü tek oynatıcıda hızlı art arda dokunuşta
// her yeni ses bir öncekini KESİYOR — topa üst üste vurma hissi kayboluyor,
// tık tık tık yerine yarım bir ses duyuluyor. Sırayla dönerek çalınca sesler
// birbirinin üstüne binebiliyor ve gerçek bir top sektirme hissi veriyor.
export function useTapKickSound() {
  const p1 = useAudioPlayer(clickSource);
  const p2 = useAudioPlayer(clickSource);
  const p3 = useAudioPlayer(clickSource);
  const sira = useRef(0);
  const { settings } = useSoundSettings();

  return useCallback(() => {
    if (settings.click <= 0) return;
    const oynaticilar = [p1, p2, p3];
    const p = oynaticilar[sira.current % oynaticilar.length];
    sira.current += 1;
    try {
      p.volume = settings.click;
      p.seekTo(0);
      p.play();
    } catch {}
  }, [settings.click, p1, p2, p3]);
}

export function useBackgroundAmbience() {
  const player = useAudioPlayer(ambienceSource);
  const { settings, loaded } = useSoundSettings();

  useEffect(() => {
    if (!loaded || !player) return;
    
    try {
      player.loop = true;
      
      if (settings.background > 0) {
        player.volume = settings.background;
        player.play();
      } else {
        player.pause();
      }
    } catch (err) {
      console.log("Tribün sesi başlatılamadı:", err);
    }
  }, [settings.background, loaded, player]);
}
