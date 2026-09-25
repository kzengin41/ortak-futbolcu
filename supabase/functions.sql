-- unaccent: á, é, ç, ñ, č vb. gibi aksanlı harfleri temel harfe indirger.
-- Postgres'in bu iş için standart eklentisi — kendi regex'imizi yazmaktan
-- daha güvenilir.
create extension if not exists unaccent;

-- pg_trgm: yazım hatalarına toleranslı "benzerlik" araması için standart
-- Postgres eklentisi (Gemini'nin önerisi, doğruladım — gerçek ve isabetli).
create extension if not exists pg_trgm;

-- ============================================================================
-- normalize_tr: Türkçe karakter/case farklarını VE genel Latin aksanlarını
-- (á, é, ñ, č, Vágner->vagner gibi) sadeleştirir.
-- ============================================================================
create or replace function normalize_tr(input text) returns text
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

-- ============================================================================
-- valid_answers_for: iki kulüpte de oynamış tüm oyuncular (istemciye ASLA
-- doğrudan gönderilmez — sadece round çözüldükten sonra revealed_answers'a yazılır)
-- ============================================================================
create or replace function valid_answers_for(p_club_a bigint, p_club_b bigint)
returns table(player_id bigint, name text) language sql stable as $$
  select p.id, p.name
  from players p
  where exists (select 1 from player_clubs pc where pc.player_id = p.id and pc.club_id = p_club_a)
    and exists (select 1 from player_clubs pc where pc.player_id = p.id and pc.club_id = p_club_b);
$$;

-- ============================================================================
-- generate_round: her zaman çözülebilir bir takım çifti üretir (bir oyuncunun
-- gerçekten oynadığı iki kulüpten seçerek garanti eder), aynı odada tekrar etmez
-- ============================================================================
create or replace function generate_round(p_room_id uuid, p_round_number int, p_allowed_club_ids bigint[] default null)
returns rounds language plpgsql as $$
declare
  v_player_id bigint;
  v_clubs bigint[];
  v_club_a bigint;
  v_club_b bigint;
  v_answer_count int;
  v_attempt int := 0;
  v_max_attempts int;
  v_round rounds;
begin
  v_max_attempts := case when p_allowed_club_ids is null then 50 else 200 end;
  loop
    v_attempt := v_attempt + 1;
    exit when v_attempt > v_max_attempts;

    select p.id into v_player_id from players p order by random() limit 1;
    select array_agg(club_id order by random()) into v_clubs
      from player_clubs
      where player_id = v_player_id
        and (p_allowed_club_ids is null or club_id = any(p_allowed_club_ids));

    if v_clubs is null or array_length(v_clubs, 1) < 2 then
      continue;
    end if;

    v_club_a := v_clubs[1];
    v_club_b := v_clubs[2];

    select count(*) into v_answer_count from valid_answers_for(v_club_a, v_club_b);
    if v_answer_count = 0 then
      continue;
    end if;

    if exists (
      select 1 from rounds
      where room_id = p_room_id
        and ((club_a_id = v_club_a and club_b_id = v_club_b) or (club_a_id = v_club_b and club_b_id = v_club_a))
    ) then
      continue;
    end if;

    insert into rounds (room_id, round_number, club_a_id, club_b_id, started_at, round_deadline)
    values (p_room_id, p_round_number, v_club_a, v_club_b, now(), now() + interval '10 seconds')
    returning * into v_round;

    return v_round;
  end loop;

  raise exception 'Bu oda için yeni tur üretilemedi (veri seti tükendi)';
end;
$$;

-- ============================================================================
-- buzz_round: "ilk basan kazanır" yarışının adil hakemi.
-- WHERE koşulundaki "buzzed_by is null" atomik compare-and-swap görevi görür —
-- iki istemci aynı anda çağırsa bile Postgres satır kilidiyle sadece biri
-- güncellemeyi başarır. Kazanan, dönen satırın kendi player numarasına eşit
-- olup olmadığına bakarak anlar.
-- ============================================================================
create or replace function buzz_round(p_round_id uuid, p_player int)
returns rounds language plpgsql as $$
declare
  v_round rounds;
begin
  update rounds
  set buzzed_by = p_player,
      buzzed_at = now(),
      answer_deadline = now() + interval '12 seconds'
  where id = p_round_id
    and buzzed_by is null
    and not (p_player = any(locked_players))
    and now() < round_deadline
    and not resolved
  returning * into v_round;

  return v_round; -- null dönerse: biri önce bastı, süre bitti ya da kilitlisin
end;
$$;

-- ============================================================================
-- submit_guess: cevap kontrolü SUNUCUDA yapılır — istemci geçerli cevap
-- listesini hiçbir zaman round bitmeden görmez.
-- ============================================================================
create or replace function submit_guess(p_round_id uuid, p_player int, p_guess text)
returns rounds language plpgsql as $$
declare
  v_round rounds;
  v_correct boolean := false;
  v_answers text[];
  v_norm text;
begin
  select * into v_round from rounds where id = p_round_id for update;

  if v_round.id is null or v_round.resolved or v_round.buzzed_by is distinct from p_player then
    return v_round; -- sırası olmayan biri cevap gönderemez
  end if;

  v_norm := normalize_tr(p_guess);
  select array_agg(name) into v_answers from valid_answers_for(v_round.club_a_id, v_round.club_b_id);

  select exists (
    select 1
    from unnest(v_answers) a
    cross join lateral unnest(string_to_array(normalize_tr(a), ' ')) as tok
    where normalize_tr(a) = v_norm
       or tok = v_norm
       or (length(v_norm) >= 3 and left(tok, length(v_norm)) = v_norm)
       -- orta ad farkını tolere et: ilk ve son kelime aynıysa kabul et
       or (
         array_length(string_to_array(normalize_tr(a), ' '), 1) >= 2
         and array_length(string_to_array(v_norm, ' '), 1) >= 2
         and (string_to_array(normalize_tr(a), ' '))[1] = (string_to_array(v_norm, ' '))[1]
         and (string_to_array(normalize_tr(a), ' '))[array_length(string_to_array(normalize_tr(a), ' '), 1)]
             = (string_to_array(v_norm, ' '))[array_length(string_to_array(v_norm, ' '), 1)]
       )
       -- baştaki ilk adın atlanmasını tolere et: "Robin van Persie" <-> "van Persie"
       or (
         array_length(string_to_array(normalize_tr(a), ' '), 1) >= 3
         and array_to_string(
               (string_to_array(normalize_tr(a), ' '))[2:array_length(string_to_array(normalize_tr(a), ' '), 1)],
               ' '
             ) = v_norm
       )
       -- son çare: yazım hatasına toleranslı trigram benzerliği (pg_trgm)
       or (length(v_norm) >= 4 and similarity(normalize_tr(a), v_norm) > 0.45)
  ) into v_correct;

  if v_correct then
    update rounds set resolved = true, winner = p_player, revealed_answers = v_answers
    where id = p_round_id returning * into v_round;

    if p_player = 1 then
      update rooms set score1 = score1 + 1 where id = v_round.room_id;
    else
      update rooms set score2 = score2 + 1 where id = v_round.room_id;
    end if;
  else
    update rounds
    set locked_players = array_append(locked_players, p_player),
        buzzed_by = null, buzzed_at = null, answer_deadline = null
    where id = p_round_id returning * into v_round;

    if array_length(v_round.locked_players, 1) >= 2 then
      update rounds set resolved = true, winner = 0, revealed_answers = v_answers
      where id = p_round_id returning * into v_round;
    end if;
  end if;

  return v_round;
end;
$$;

-- ============================================================================
-- resolve_timeout: süre dolduğunda round'u kapatır (istemcilerden biri
-- round_deadline geçtiğinde bunu çağırır)
-- ============================================================================
create or replace function resolve_timeout(p_round_id uuid)
returns rounds language plpgsql as $$
declare
  v_round rounds;
  v_answers text[];
begin
  select * into v_round from rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved or now() < v_round.round_deadline then
    return v_round;
  end if;
  select array_agg(name) into v_answers from valid_answers_for(v_round.club_a_id, v_round.club_b_id);
  update rounds set resolved = true, winner = 0, revealed_answers = v_answers
  where id = p_round_id returning * into v_round;
  return v_round;
end;
$$;

-- ============================================================================
-- pass_round: oyuncu buzz'lamadan "bilemedim" diyip kendini bu turdan çeker.
-- İkisi de pas geçerse round hemen kapanır — süre dolana kadar boşuna
-- beklemeye gerek kalmaz.
-- ============================================================================
create or replace function pass_round(p_round_id uuid, p_player int)
returns rounds language plpgsql as $$
declare
  v_round rounds;
  v_answers text[];
begin
  select * into v_round from rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved then
    return v_round;
  end if;

  if p_player = any(v_round.locked_players) then
    return v_round; -- zaten pas geçmiş/kilitli
  end if;

  update rounds
  set locked_players = array_append(locked_players, p_player)
  where id = p_round_id
  returning * into v_round;

  if array_length(v_round.locked_players, 1) >= 2 then
    select array_agg(name) into v_answers from valid_answers_for(v_round.club_a_id, v_round.club_b_id);
    update rounds set resolved = true, winner = 0, revealed_answers = v_answers
    where id = p_round_id returning * into v_round;
  end if;

  return v_round;
end;
$$;

-- Realtime: rooms ve rounds tablolarındaki değişiklikleri her iki oyuncuya
-- da anında yayınla
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table rounds;
