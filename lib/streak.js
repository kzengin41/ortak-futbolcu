import AsyncStorage from "@react-native-async-storage/async-storage";

// Duolingo tarzı "günlük seri" — art arda kaç gün oynadığını sayar.
// Bağımlılık/alışkanlık döngüsü için klasik bir mekanik: kullanıcı seriyi
// bozmamak için o gün de mutlaka bir tur oynamak ister.
const STREAK_KEY = "ortak-futbolcu-streak";

// NOT: toISOString() BİLEREK kullanılmıyor — o, tarihi UTC'ye çevirir. Türkiye
// (UTC+3) gibi UTC'nin ilerisindeki dilimlerde, yerel gece yarısını yeni geçmiş
// biri için UTC tarihi hâlâ "dün" olabilir — bu da geceyarısından hemen sonra
// oynayan birinin serisinin bir gün GEÇ artmasına yol açar. Yerel takvim
// gününü (kullanıcının telefonunun gördüğü gün) baz alıyoruz.
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getStreak() {
  const fallback = { count: 0, lastPlayedDate: null };
  try {
    const data = await AsyncStorage.getItem(STREAK_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return fallback;
}

// Kullanıcı bir mod seçip oynamaya başladığında çağrılır.
// Aynı gün içinde tekrar tekrar çağrılması zararsızdır (sadece ilk çağrı sayılır).
export async function bumpStreak() {
  try {
    const current = await getStreak();
    const today = toDateStr(new Date());
    if (current.lastPlayedDate === today) return current;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = current.lastPlayedDate === toDateStr(yesterday);

    const next = { count: wasYesterday ? current.count + 1 : 1, lastPlayedDate: today };
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return { count: 0, lastPlayedDate: null };
  }
}
