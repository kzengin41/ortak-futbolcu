// Ekranların eşleşme profilini okuması için tek kanca (28 Eylül 2026).
// Ayarlar'daki genel profil her modun varsayılanıdır; kurulum ekranında
// "sadece bu maç için" değiştirilebilir (setMacProfili) ya da yeni seçim
// genel varsayılan yapılabilir (genelKaydet).
import { useMemo, useState } from "react";
import { useAppSettings } from "./SettingsContext";
import { ayarlardanProfil, profilDerle } from "./eslesmeProfili";

export function useEslesmeProfili() {
  const { settings, setSetting } = useAppSettings();
  const genel = ayarlardanProfil(settings);
  const genelAnahtar = JSON.stringify(genel);
  const [mac, setMac] = useState(null);
  const profil = mac || genel;
  const anahtar = mac ? JSON.stringify(mac) : genelAnahtar;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const derlenmis = useMemo(() => profilDerle(profil), [anahtar]);
  return {
    profil,
    derlenmis,
    macaOzel: !!mac,
    setMacProfili: setMac,
    genelKaydet: (p) => {
      setMac(null);
      return setSetting("eslesmeProfili", p);
    },
  };
}
