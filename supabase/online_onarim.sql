-- ============================================================================
-- ONLINE MODLAR — TEK SEFERLİK ONARIM (27 Eylül 2026)
--
-- Kerem: online modda "Could not find the 'allowed_club_ids' column of 'rooms'
-- in the schema cache" hatası. KÖK NEDEN: canlı veritabanındaki rooms/rounds
-- tabloları schema.sql'in ESKİ bir sürümüyle kurulmuş; sonradan eklenen kolonlar
-- (allowed_club_ids, game_mode, is_ranked, game_state...) "create table if not
-- exists" yüzünden hiç eklenmemiş. Ayrıca:
--   • player1_id/player2_id uuid tipindeydi ama uygulama "dev-..." biçiminde
--     bir cihaz kimliği gönderiyor -> oda kurma bir sonraki adımda da düşerdi.
--   • rooms tablosuna INSERT izni tanımlı değildi.
--   • generate_round, lig filtresiyle (ör. sadece Süper Lig) çoğu denemede
--     2 uygun kulübü olan oyuncu bulamayıp "tur üretilemedi" diyebiliyordu.
--
-- NASIL ÇALIŞTIRILIR: Supabase paneli -> SQL Editor -> bu dosyanın TAMAMINI
-- yapıştır -> Run. İki kez çalıştırmak zarar vermez (tamamen idempotent).
-- Sonra oyuncu/kulüp verisini güncellemek için: python scripts/sunucu_veri_yukle.py
-- ============================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- tablolar
create table if not exists public.clubs (
  id bigint primary key,
  name text not null unique
);
alter table public.clubs add column if not exists country text;
alter table public.clubs add column if not exists league text;

create table if not exists public.players (
  id bigint primary key,
  name text not null
);

create table if not exists public.player_clubs (
  player_id bigint references public.players(id) on delete cascade,
  club_id bigint references public.clubs(id) on delete cascade,
  primary key (player_id, club_id)
);
create index if not exists player_clubs_club_idx on public.player_clubs (club_id);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
);
alter table public.rooms add column if not exists status text not null default 'waiting';
alter table public.rooms add column if not exists player1_id text;
alter table public.rooms add column if not exists player2_id text;
alter table public.rooms add column if not exists score1 int not null default 0;
alter table public.rooms add column if not exists score2 int not null default 0;
alter table public.rooms add column if not exists allowed_club_ids bigint[];
alter table public.rooms add column if not exists game_mode text not null default 'classic';
alter table public.rooms add column if not exists is_ranked boolean not null default false;
alter table public.rooms add column if not exists created_at timestamptz not null default now();

-- Cihaz kimliği uuid değil ("dev-mf3k2...") -> kolonları metne çevir.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'rooms'
               and column_name = 'player1_id' and data_type = 'uuid') then
    alter table public.rooms alter column player1_id type text using player1_id::text;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'rooms'
               and column_name = 'player2_id' and data_type = 'uuid') then
    alter table public.rooms alter column player2_id type text using player2_id::text;
  end if;
end $$;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid()
);
alter table public.rounds add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.rounds add column if not exists round_number int not null default 1;
alter table public.rounds add column if not exists club_a_id bigint references public.clubs(id) on delete cascade;
alter table public.rounds add column if not exists club_b_id bigint references public.clubs(id) on delete cascade;
alter table public.rounds add column if not exists started_at timestamptz not null default now();
alter table public.rounds add column if not exists round_deadline timestamptz not null default (now() + interval '10 seconds');
alter table public.rounds add column if not exists buzzed_by int;
alter table public.rounds add column if not exists buzzed_at timestamptz;
alter table public.rounds add column if not exists answer_deadline timestamptz;
alter table public.rounds add column if not exists locked_players int[] not null default '{}';
alter table public.rounds add column if not exists winner int;
alter table public.rounds add column if not exists resolved boolean not null default false;
alter table public.rounds add column if not exists revealed_answers text[];
alter table public.rounds add column if not exists game_state jsonb not null default '{}'::jsonb;
create index if not exists rounds_room_idx on public.rounds (room_id, round_number);

-- ---------------------------------------------------------------- izinler (RLS)
alter table public.clubs        enable row level security;
alter table public.players      enable row level security;
alter table public.player_clubs enable row level security;
alter table public.rooms        enable row level security;
alter table public.rounds       enable row level security;

drop policy if exists "clubs herkes okur"        on public.clubs;
drop policy if exists "players herkes okur"      on public.players;
drop policy if exists "player_clubs herkes okur" on public.player_clubs;
create policy "clubs herkes okur"        on public.clubs        for select using (true);
create policy "players herkes okur"      on public.players      for select using (true);
create policy "player_clubs herkes okur" on public.player_clubs for select using (true);

drop policy if exists "room participants can read"               on public.rooms;
drop policy if exists "Anonim kullanicilar rooms güncelleyebilir" on public.rooms;
drop policy if exists "odalar okunur"     on public.rooms;
drop policy if exists "oda kurulabilir"   on public.rooms;
drop policy if exists "oda guncellenir"   on public.rooms;
create policy "odalar okunur"   on public.rooms for select using (true);
create policy "oda kurulabilir" on public.rooms for insert with check (true);
create policy "oda guncellenir" on public.rooms for update using (true) with check (true);

drop policy if exists "room participants can read rounds"          on public.rounds;
drop policy if exists "Anonim kullanicilar rounds ekleyebilir"     on public.rounds;
drop policy if exists "Anonim kullanicilar rounds güncelleyebilir" on public.rounds;
drop policy if exists "turlar okunur"   on public.rounds;
drop policy if exists "tur eklenir"     on public.rounds;
drop policy if exists "tur guncellenir" on public.rounds;
create policy "turlar okunur"   on public.rounds for select using (true);
create policy "tur eklenir"     on public.rounds for insert with check (true);
create policy "tur guncellenir" on public.rounds for update using (true) with check (true);

-- ---------------------------------------------------------------- fonksiyonlar
create or replace function public.normalize_tr(input text) returns text
language plpgsql stable as $$
declare
  result text;
begin
  if input is null then return ''; end if;
  result := lower(input);
  result := replace(result, 'ı', 'i');
  result := unaccent(result);
  result := regexp_replace(result, '[^a-z0-9 ]', '', 'g');
  result := regexp_replace(trim(result), '\s+', ' ', 'g');
  return result;
end;
$$;

create or replace function public.valid_answers_for(p_club_a bigint, p_club_b bigint)
returns table(player_id bigint, name text) language sql stable as $$
  select p.id, p.name
  from public.players p
  where exists (select 1 from public.player_clubs pc where pc.player_id = p.id and pc.club_id = p_club_a)
    and exists (select 1 from public.player_clubs pc where pc.player_id = p.id and pc.club_id = p_club_b);
$$;

-- Eski 2 parametreli sürüm duruyorsa PostgREST hangisini çağıracağını
-- karıştırmasın diye kaldırılıyor.
drop function if exists public.generate_round(uuid, int);

create or replace function public.generate_round(p_room_id uuid, p_round_number int, p_allowed_club_ids bigint[] default null)
returns public.rounds language plpgsql as $$
declare
  v_player_id bigint;
  v_clubs bigint[];
  v_club_a bigint;
  v_club_b bigint;
  v_attempt int := 0;
  v_round public.rounds;
begin
  loop
    v_attempt := v_attempt + 1;
    exit when v_attempt > 60;

    -- Lig filtresi varsa: DOĞRUDAN o kulüplerden en az ikisinde oynamış bir
    -- oyuncu seç (eskiden rastgele oyuncu seçip filtreye uymasını umuyordu,
    -- dar filtrelerde neredeyse hep boşa düşüyordu).
    if p_allowed_club_ids is null then
      select p.id into v_player_id from public.players p
        where exists (select 1 from public.player_clubs pc where pc.player_id = p.id)
        order by random() limit 1;
    else
      select pc.player_id into v_player_id
        from public.player_clubs pc
        where pc.club_id = any(p_allowed_club_ids)
        group by pc.player_id
        having count(*) >= 2
        order by random() limit 1;
    end if;
    exit when v_player_id is null;

    select array_agg(club_id order by random()) into v_clubs
      from public.player_clubs
      where player_id = v_player_id
        and (p_allowed_club_ids is null or club_id = any(p_allowed_club_ids));

    if v_clubs is null or array_length(v_clubs, 1) < 2 then
      continue;
    end if;
    v_club_a := v_clubs[1];
    v_club_b := v_clubs[2];

    if exists (
      select 1 from public.rounds
      where room_id = p_room_id
        and ((club_a_id = v_club_a and club_b_id = v_club_b) or (club_a_id = v_club_b and club_b_id = v_club_a))
    ) then
      continue;
    end if;

    insert into public.rounds (room_id, round_number, club_a_id, club_b_id, started_at, round_deadline)
    values (p_room_id, p_round_number, v_club_a, v_club_b, now(), now() + interval '10 seconds')
    returning * into v_round;
    return v_round;
  end loop;

  raise exception 'Bu oda için yeni tur üretilemedi (veri seti tükendi)';
end;
$$;

create or replace function public.buzz_round(p_round_id uuid, p_player int)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
begin
  update public.rounds
  set buzzed_by = p_player,
      buzzed_at = now(),
      answer_deadline = now() + interval '12 seconds'
  where id = p_round_id
    and buzzed_by is null
    and not (p_player = any(locked_players))
    and now() < round_deadline
    and not resolved
  returning * into v_round;
  return v_round;
end;
$$;

create or replace function public.submit_guess(p_round_id uuid, p_player int, p_guess text)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
  v_correct boolean := false;
  v_answers text[];
  v_norm text;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved or v_round.buzzed_by is distinct from p_player then
    return v_round;
  end if;

  v_norm := public.normalize_tr(p_guess);
  select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);

  select exists (
    select 1
    from unnest(v_answers) a
    cross join lateral unnest(string_to_array(public.normalize_tr(a), ' ')) as tok
    where public.normalize_tr(a) = v_norm
       or tok = v_norm
       or (length(v_norm) >= 3 and left(tok, length(v_norm)) = v_norm)
       or (
         array_length(string_to_array(public.normalize_tr(a), ' '), 1) >= 2
         and array_length(string_to_array(v_norm, ' '), 1) >= 2
         and (string_to_array(public.normalize_tr(a), ' '))[1] = (string_to_array(v_norm, ' '))[1]
         and (string_to_array(public.normalize_tr(a), ' '))[array_length(string_to_array(public.normalize_tr(a), ' '), 1)]
             = (string_to_array(v_norm, ' '))[array_length(string_to_array(v_norm, ' '), 1)]
       )
       or (
         array_length(string_to_array(public.normalize_tr(a), ' '), 1) >= 3
         and array_to_string(
               (string_to_array(public.normalize_tr(a), ' '))[2:array_length(string_to_array(public.normalize_tr(a), ' '), 1)],
               ' '
             ) = v_norm
       )
       or (length(v_norm) >= 4 and similarity(public.normalize_tr(a), v_norm) > 0.45)
  ) into v_correct;

  if v_correct then
    update public.rounds set resolved = true, winner = p_player, revealed_answers = v_answers
    where id = p_round_id returning * into v_round;
    if p_player = 1 then
      update public.rooms set score1 = score1 + 1 where id = v_round.room_id;
    else
      update public.rooms set score2 = score2 + 1 where id = v_round.room_id;
    end if;
  else
    update public.rounds
    set locked_players = array_append(locked_players, p_player),
        buzzed_by = null, buzzed_at = null, answer_deadline = null
    where id = p_round_id returning * into v_round;
    if array_length(v_round.locked_players, 1) >= 2 then
      update public.rounds set resolved = true, winner = 0, revealed_answers = v_answers
      where id = p_round_id returning * into v_round;
    end if;
  end if;
  return v_round;
end;
$$;

create or replace function public.resolve_timeout(p_round_id uuid)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
  v_answers text[];
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved or now() < v_round.round_deadline then
    return v_round;
  end if;
  select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
  update public.rounds set resolved = true, winner = 0, revealed_answers = v_answers
  where id = p_round_id returning * into v_round;
  return v_round;
end;
$$;

create or replace function public.pass_round(p_round_id uuid, p_player int)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
  v_answers text[];
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved then
    return v_round;
  end if;
  if p_player = any(v_round.locked_players) then
    return v_round;
  end if;
  update public.rounds
  set locked_players = array_append(locked_players, p_player)
  where id = p_round_id
  returning * into v_round;
  if array_length(v_round.locked_players, 1) >= 2 then
    select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
    update public.rounds set resolved = true, winner = 0, revealed_answers = v_answers
    where id = p_round_id returning * into v_round;
  end if;
  return v_round;
end;
$$;

-- Veri yükleme scriptinin (scripts/sunucu_veri_yukle.py) eski oyuncu/kulüp
-- verisini silmesi için. SADECE service_role çağırabilir — uygulamadaki anon
-- anahtar bu fonksiyonu ÇAĞIRAMAZ.
create or replace function public.veri_sifirla()
returns void language plpgsql security definer set search_path = public as $$
begin
  truncate table public.player_clubs, public.players, public.clubs restart identity cascade;
end;
$$;
revoke all on function public.veri_sifirla() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.veri_sifirla() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.veri_sifirla() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.veri_sifirla() to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------- canlı yayın
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
      alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds') then
      alter publication supabase_realtime add table public.rounds;
    end if;
  end if;
end $$;

-- "schema cache" hatasının asıl çözümü: PostgREST'e şemayı yeniden okut.
notify pgrst, 'reload schema';
