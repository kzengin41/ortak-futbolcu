-- ============================================================================
-- PAKET 36 — ONLINE ORTAK KULÜP DÜELLOSU DÜZELTMELERİ (15 Ekim 2026)
--
-- Kerem: "süre bitince buga giriyor. ekran bire bir aynı kalıyor."
--   KÖK NEDEN: cevap hakkını alan oyuncunun 12 sn'lik cevap süresi dolunca
--   kimse turu kapatmıyordu (resolve_timeout yalnız TUR süresine bakıyordu,
--   uygulama da yalnız "yarış" aşamasında çağırıyordu). Cevap veren telefonu
--   kilitlenirse/arka plana atılırsa iki ekran da sonsuza kadar donuyordu.
--   ÇÖZÜM: resolve_timeout artık cevap süresi (+2 sn pay) dolmuş hakkı da
--   "yanlış cevap" gibi işler: o oyuncu kilitlenir, tur diğerine açılır; iki
--   oyuncu da kilitliyse ya da tur süresi de bittiyse tur kapanır.
-- Kerem: "hızlı eşleş kısmında süre kısıtı 30 sn olsun" → dereceli (rastgele)
--   odalarda tur 30 sn. Arkadaş odası 10 sn kalır.
-- Ayrıca generate_round aynı tur numarasını ikinci kez üretmez (artık iki taraf
-- da "Sonraki tur" diyebiliyor, 10 sn sonra otomatik geçiyor).
--
-- NASIL ÇALIŞTIRILIR: Supabase → SQL Editor → bu dosyanın TAMAMI → Run.
-- İki kez çalıştırmak zarar vermez. paket23_derece.sql ve paket28 ÖNCE
-- çalıştırılmış olmalı (is_ranked sütunu ve club_pairs tablosu).
-- ============================================================================

create or replace function public.generate_round(p_room_id uuid, p_round_number int, p_allowed_club_ids bigint[] default null)
returns public.rounds language plpgsql as $$
declare
  v_player_id bigint;
  v_clubs bigint[];
  v_club_a bigint;
  v_club_b bigint;
  v_tmp bigint;
  v_attempt int := 0;
  v_round public.rounds;
  v_sure int := 10;
begin
  -- Paket 36: aynı tur iki kez üretilmesin (iki telefon aynı anda "sonraki tur"
  -- derse ya da misafir, ev sahibi gecikince kendisi üretirse) — varsa onu döndür.
  select * into v_round from public.rounds
   where room_id = p_room_id and round_number = p_round_number
   order by started_at limit 1;
  if v_round.id is not null then
    return v_round;
  end if;
  -- Paket 36 (Kerem: "hızlı eşleş kısmında süre kısıtı 30 sn olsun"):
  -- Hızlı Eşleş / rastgele maçlar (dereceli) 30 sn, arkadaş odası eskisi gibi 10 sn.
  select case when coalesce(r.is_ranked, false) then 30 else 10 end into v_sure
    from public.rooms r where r.id = p_room_id;
  v_sure := coalesce(v_sure, 10);
  -- 1) Önceden seçilmiş çift havuzundan (Paket 28)
  select cp.club_a_id, cp.club_b_id into v_club_a, v_club_b
  from public.club_pairs cp
  where (p_allowed_club_ids is null
         or (cp.club_a_id = any(p_allowed_club_ids) and cp.club_b_id = any(p_allowed_club_ids)))
    and not exists (
      select 1 from public.rounds r
      where r.room_id = p_room_id
        and ((r.club_a_id = cp.club_a_id and r.club_b_id = cp.club_b_id)
          or (r.club_a_id = cp.club_b_id and r.club_b_id = cp.club_a_id)))
  order by random()
  limit 1;

  -- 2) Yedek: eski yöntem (havuz boşsa ya da filtreye uyan çift kalmadıysa), en az 3 cevaplı çift
  if v_club_a is null then
    loop
      v_attempt := v_attempt + 1;
      exit when v_attempt > 80;
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
      ) or (select count(*) from public.valid_answers_for(v_club_a, v_club_b)) < 3 then
        v_club_a := null;
        continue;
      end if;
      exit;
    end loop;
  end if;

  if v_club_a is null then
    raise exception 'Bu oda için yeni tur üretilemedi (veri seti tükendi)';
  end if;

  -- Hangi kulübün solda duracağı rastgele
  if random() < 0.5 then
    v_tmp := v_club_a; v_club_a := v_club_b; v_club_b := v_tmp;
  end if;

  insert into public.rounds (room_id, round_number, club_a_id, club_b_id, started_at, round_deadline)
  values (p_room_id, p_round_number, v_club_a, v_club_b, now(), now() + make_interval(secs => v_sure))
  returning * into v_round;
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
  if v_round.id is null or v_round.resolved then
    return v_round;
  end if;

  -- 1) Cevap hakkı alınmış ve cevap süresi (+2 sn ağ payı) dolmuş: yanlış cevap say.
  if v_round.buzzed_by is not null then
    if v_round.answer_deadline is null or now() < v_round.answer_deadline + interval '2 seconds' then
      return v_round;   -- hâlâ cevaplıyor
    end if;
    update public.rounds
    set locked_players = case when v_round.buzzed_by = any(locked_players) then locked_players
                              else array_append(locked_players, v_round.buzzed_by) end,
        buzzed_by = null, buzzed_at = null, answer_deadline = null
    where id = p_round_id returning * into v_round;
    if coalesce(array_length(v_round.locked_players, 1), 0) < 2 and now() < v_round.round_deadline then
      return v_round;   -- tur diğer oyuncuya açık
    end if;
  elsif now() < v_round.round_deadline
        and coalesce(array_length(v_round.locked_players, 1), 0) < 2 then
    return v_round;     -- tur sürüyor
  end if;

  -- 2) Tur bitti: kimse bilemedi.
  select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
  update public.rounds set resolved = true, winner = 0, revealed_answers = v_answers
  where id = p_round_id returning * into v_round;
  return v_round;
end;
$$;
