# Apple 2.1 "Information Needed" yanıtı — 3-2-1: Bitir İşi

Bu dosyada üç parça var:
- **A.** Ekran kaydı senaryosu (Türkçe, senin için).
- **B.** Resolution Center'a yapıştırılacak İngilizce yanıt.
- **C.** App Review Information → Notes alanına yapıştırılacak kısa sürüm (4000 karakter sınırı).

`<…>` ile işaretli yerleri kendin doldur.

---

## A. Ekran kaydı senaryosu (3–5 dakika)

**Cihaz:** ödünç bir iPhone, TestFlight'tan kurulmuş **1.1.0 (7)**.

**Kayıttan önce:**
- Uygulamayı silip yeniden kur ki ilk açılış görünsün.
- Ayarlar → Denetim Merkezi'ne "Ekran Kaydı"nı ekle.
- Rahatsız Etmeyin'i aç ki bildirim düşmesin.
- Supabase'de `paket38_guvenlik.sql` çalıştırılmış olmalı; yoksa Bildir/Engelle çalışmaz.

**Kayıt sırası:**
1. Kaydı ana ekranda başlat ve uygulama ikonuna dokun. Apple kaydın uygulamayı açmakla başlamasını istiyor.
2. İlk açılış (onboarding) → Ana Sayfa.
3. **3-2-1 Ortak Futbolcu'yu Bul**'u CPU'ya karşı oyna. 1–2 cevabı yazarak ver, birini mikrofonla ver; mikrofon izni penceresi görünsün.
4. Kısaca 1–2 mod daha göster (ör. 5 Kulüp, Futbolcu XOX).
5. **Online** sekmesi:
   - Takma ad seç.
   - Bir maç oyna. Rakip bulmak için ikinci bir cihaz kullan; Android'deki uygulama da olur. "Arkadaş odası" kodla en kolayı.
   - Maç sonunda **"Rakibi bildir / engelle"** → Bildir → bir sebep seç → teşekkür mesajı.
   - Aynı yerden **Engelle**.
6. Online sekmesinde sağ üstteki derece rozetine dokun → **Liderlik tablosu**:
   - Bir satıra dokun → Bildir / Engelle menüsünü göster.
   - Alttan **Engellediklerin** → engeli kaldır.
7. **Profilim → Hesabım:**
   - E-posta ile **Kayıt Ol** → Çıkış Yap → **Giriş Yap**.
   - **Hesabımı kalıcı olarak sil** → onayla → "Hesabın silindi".
8. **Profilim → Nasıl Oynanır → Kaynaklar** ekranını göster.
9. Ayarlar → Dil · Language → English, uygulama İngilizce açılsın. Kaydı bitir.

**Kayıttan sonra:**
- Video büyükse WhatsApp'a "belge" olarak göndermek ya da Google Drive'a yüklemek boyutu korur.
- Resolution Center yanıtına ek olarak yükle.
- Ayrıca **App Review Information → Attachment** alanına da koy.

---

## B. Resolution Center yanıtı (İngilizce — olduğu gibi yapıştır)

Hello App Review Team,

Thank you for the review. Please find the requested information below. The screen recording is attached to this message, and the same information has been added to the App Review Information notes.

Please note: we have updated the submission to version 1.1.0 (build 7). This build adds the content reporting and blocking features shown in the recording, iPad support and an English interface.

**1. Screen recording**
Attached (recorded on a physical <iPhone model>, iOS <version>). It starts by launching the app and shows:
- the typical gameplay flow (single-player vs. CPU, typed and voice answers);
- online play;
- the user-generated content safeguards (report and block);
- optional account registration, login and account deletion.

**2. Purpose and target audience**
3-2-1: Bitir İşi is a football (soccer) trivia game for football fans, mainly in Türkiye, available in Turkish and English. The core mode is "3-2-1 Find the Common Player": the app names two clubs, and the player has to name a footballer who played for both before the 3-2-1 countdown ends. Other modes include 5 Clubs, Who's That Player?, Tic-Tac-Toe, Letter Chain, Squad Hunt and daily puzzles. Players can play solo against CPU opponents, pass-and-play with a friend on the same phone, or play online.
The value it provides is a quick, fun way to test and improve football knowledge and to compete with friends.

**3. How to access the main features**
- No login is required. All game modes work immediately after launch; an anonymous session is created automatically in the background.
- Online play: open the "Online" tab and choose a nickname. Then tap "Quick Match" for a random opponent, or create a friend room and share its 5-character code. A second device is needed to see a full online match.
- Leaderboard: in the "Online" tab, tap the rank badge at the top right.
- Optional account (cloud backup of progress): Profile → My Account → Sign Up (email + password).
  - Account deletion is in the same screen: "Permanently delete my account". It deletes the account and its data.
  - Demo account: <e-posta> / <şifre>
- Voice answers: tap the microphone button in any game and say a player's name.
- Language: Settings → Dil · Language.

**User-generated content and safety (Guideline 1.2)**
- The only user-generated content visible to other users is the nickname shown on the leaderboard and to online opponents.
- Answers typed during an online match are only shown to the opponent if they match a real player name. Otherwise they are replaced with "an unknown name".
- There is no chat or messaging, and profile photos are never shown to other users.
- Nicknames are filtered for offensive words, both in the app and on the server.
- Reporting: users can report any player by tapping their row on the leaderboard, or via "Report / block opponent" at the end of an online match.
- Blocking: users can block any player from the same two places. A blocked player is never matched with the user again. Blocked players can be managed under Leaderboard → Blocked players.
- Moderation: reports are reviewed by the developer within 24 hours. A nickname reported by 3 different users is removed automatically.

**4. External services**
- Supabase: anonymous and email authentication, database, real-time online matches, storage for the optional profile photo, and a server function for voice transcription.
- Apple speech recognition: live transcription of voice answers.
- OpenAI Whisper API: speech-to-text fallback, called only through our Supabase server function. Audio is not stored.
- Sentry: crash and error reporting.
- Expo (EAS Update): delivery of app updates.
- Content sources:
  - Wikipedia: players' club history, compiled and bundled with the app.
  - Wikimedia Commons and TheSportsDB: player photos.
- There are no ads, no in-app purchases and no paid content.

**5. Regional differences**
The app works the same in all regions. The only difference is the interface language: Turkish or English, chosen from the device language and changeable in Settings.

**6. Regulated industry / third-party material**
- The app does not operate in a regulated industry.
- Player names and career facts are publicly available factual information.
- Player photos come from Wikimedia Commons (Creative Commons licensed) and TheSportsDB, credited on the in-app Sources screen (Profile → How to Play → Sources).
- Team badges are not the clubs' official crests. They come from a generic, unlicensed badge pack made by the Football Manager player community. Clubs without such a badge get an original shield generated from their colours.
- The app states in-app that it is not affiliated with or endorsed by any club, league, federation or player.
- The Sources screen includes a contact address for removal requests (kzengin41@gmail.com). Any image is removed promptly on request from a rights holder.

Best regards,
Kerem Zengin

---

## C. App Review Information → Notes (kısa sürüm)

3-2-1: Bitir İşi is a football trivia game for football fans, in Turkish and English. The core mode names two clubs; the player names a footballer who played for both before the 3-2-1 countdown ends. Other modes: 5 Clubs, Who's That Player?, Tic-Tac-Toe, daily puzzles. Play solo vs CPU, pass-and-play, or online.

NO LOGIN REQUIRED. An anonymous session is created automatically.
- Optional account (cloud backup): Profile → My Account → Sign Up. Deletion is in the same screen: "Permanently delete my account".
- Demo account: <e-posta> / <şifre>

ONLINE: Online tab → choose a nickname → Quick Match, or friend room with a 5-character code (a second device is needed). Leaderboard: rank badge at the top right of the Online tab.

UGC (Guideline 1.2):
- The only UGC visible to others is the nickname. Typed online answers are shown to the opponent only if they match a real player name. No chat; profile photos are private.
- Nicknames are filtered for offensive words in the app and on the server.
- Report / Block: tap any leaderboard row, or "Report / block opponent" after an online match. Blocked players are never matched again; manage them under Leaderboard → Blocked players.
- Reports are reviewed within 24 h. A nickname reported by 3 users is removed automatically.

SERVICES:
- Supabase (auth, database, realtime, storage, server function)
- Apple speech recognition, plus OpenAI Whisper as a fallback through our server (audio not stored)
- Sentry (crash reports)
- Expo EAS Update
- No ads, no IAP, no paid content.

REGIONS: Same in all regions; only the UI language (TR/EN) changes.

CONTENT:
- Career facts: Wikipedia.
- Player photos: Wikimedia Commons (CC) and TheSportsDB, credited under Profile → How to Play → Sources.
- Team badges are not official crests; they come from a generic badge pack made by the Football Manager community.
- The app states that it is not affiliated with any club or league.
- Removal requests: kzengin41@gmail.com

A screen recording is attached.
