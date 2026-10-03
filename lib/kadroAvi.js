// ============================================================================
// KADRO AVI — Paket 13 (benchmark "Kim Bu — Modlar": "Kadro Avı: ansiklopedideki
// gizli bir kadro oyuncusu; bulunca kadroya eklenir.")
//
// Bir kadro (kulüp sezonu ya da efsane final) seçilir; o kadronun HENÜZ
// BULUNMAMIŞ ve veri setinde profili olan oyuncularından biri kart masasına
// gizlenir. Bilince isim kadro koleksiyonuna (lib/kadroKoleksiyon) ve
// ansiklopediye eklenir; Ansiklopedi → Takımlar'daki sayaç ilerler.
// Kadronun kulübü zaten belli olduğu için o kulübün kariyer kartı bedava açık
// başlar (aksi halde bilinen bir bilgiye puan ödetmiş olurduk).
// SAF dosya: veri (oyuncu var mı?) dışarıdan.
// ============================================================================
import { MACLAR, SEZONLAR, kadroGetir } from "./kadrolar";
import { canonicalClub } from "./clubAliases";

// Avlanabilir oyuncular: veri setinde olan (o.v), bulunmamış ve masası kurulabilen.
export function hedefler(kadro, bulunanlar, oyuncuVarMi) {
  if (!kadro) return [];
  const gorulen = new Set();
  return [...kadro.ilk11, ...kadro.yedek].filter((o) => {
    if (!o.v || gorulen.has(o.a) || bulunanlar.has(o.a)) return false;
    gorulen.add(o.a);
    return !oyuncuVarMi || oyuncuVarMi(o.a);
  });
}

export function tumKadroIdleri() {
  const idler = SEZONLAR.map((s) => `${s.kulup}|${s.sezon}`);
  for (const m of MACLAR) for (const t of [0, 1]) if (m.takimlar && m.takimlar[t]) idler.push(`${m.id}#${t}`);
  return idler;
}

// Rastgele bir kadro: içinde en az bir avlanabilir oyuncu olan. Bulunanı çok
// olan (yarım kalmış) kadrolar biraz öne çıkar: tamamlamaya teşvik.
export function rastgeleKadro(bulunanlar, oyuncuVarMi, rastgele = Math.random) {
  const adaylar = [];
  for (const id of tumKadroIdleri()) {
    const k = kadroGetir(id);
    if (!k) continue;
    const h = hedefler(k, bulunanlar, oyuncuVarMi).length;
    if (!h) continue;
    const toplam = k.ilk11.length + k.yedek.length;
    const ilerleme = 1 - h / Math.max(1, toplam);
    adaylar.push([id, 1 + 3 * ilerleme]);
  }
  if (!adaylar.length) return null;
  const top = adaylar.reduce((t, [, a]) => t + a, 0);
  let r = rastgele() * top;
  for (const [id, a] of adaylar) { r -= a; if (r <= 0) return id; }
  return adaylar[adaylar.length - 1][0];
}

// Kadronun kulübünün kariyer kartını bedava aç (kulüp kadrosuysa).
export function kadroKulubunuAc(kadro, masa, acik) {
  if (!kadro || kadro.takimTip === "ulke") return acik;
  const hedef = canonicalClub(kadro.takim);
  const yeni = { ...acik };
  for (const k of masa.kariyer) if (!yeni[k.id] && canonicalClub(k.kulup) === hedef) yeni[k.id] = "bedava";
  return yeni;
}
