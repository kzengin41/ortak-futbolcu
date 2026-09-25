-- ============================================================================
-- ORTAK FUTBOLCU — Supabase şeması
-- Ana prensip: "kim ilk buzz'ladı" ve "cevap doğru mu" kararları HER ZAMAN
-- sunucuda (Postgres fonksiyonu) verilir. İstemciye asla o turun geçerli
-- cevap listesi gönderilmez — yoksa oyuncu dev tools açıp hile yapabilir.
-- ============================================================================

create table if not exists clubs (
  id bigint primary key,
  name text not null unique,
  country text,
  league text
);

create table if not exists players (
  id bigint primary key,
  name text not null
);

create table if not exists player_clubs (
  player_id bigint references players(id) on delete cascade,
  club_id bigint references clubs(id) on delete cascade,
  primary key (player_id, club_id)
);

-- Bir oda = iki oyuncunun eşleştiği maç
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- paylaşılan 4-6 haneli davet kodu
  status text not null default 'waiting', -- waiting | active | finished
  player1_id uuid,                     -- Supabase auth.uid() ya da anonim oturum id'si
  player2_id uuid,
  score1 int not null default 0,
  score2 int not null default 0,
  allowed_club_ids bigint[], -- null = filtre yok; oda kurulurken seçilen lig ön ayarı
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_number int not null,
  club_a_id bigint references clubs(id),
  club_b_id bigint references clubs(id),
  started_at timestamptz not null default now(),
  round_deadline timestamptz not null,   -- started_at + 20sn, istemciler buna göre senkron sayar
  buzzed_by int,                         -- 1 | 2 | null
  buzzed_at timestamptz,
  answer_deadline timestamptz,           -- buzz anı + 6sn
  locked_players int[] not null default '{}', -- yanlış cevap veren oyuncu numaraları
  winner int,                            -- 1 | 2 | 0 (kimse bilemedi)
  resolved boolean not null default false,
  revealed_answers text[]                -- round bitince doldurulur, öncesinde null
);

alter table rooms enable row level security;
alter table rounds enable row level security;

-- Basit politika: sadece odadaki iki oyuncu kendi odalarını görebilir/güncelleyebilir.
-- Prod'a çıkmadan önce auth.uid() ile player1_id/player2_id eşleşmesi netleştirilmeli.
create policy "room participants can read" on rooms
  for select using (true); -- MVP: kod bilen herkes okuyabilir, prod'da daraltılmalı

create policy "room participants can read rounds" on rounds
  for select using (true);
