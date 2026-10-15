-- ============================================================================
-- PAKET 37 — ONLINE ORTAK KULÜP: ARKADAŞ ODASINDA DA TUR 30 SN (16 Ekim 2026)
--
-- Kerem: "arkadaş lobisinde de süre 30 sn olsun." Paket 36'da yalnız Hızlı
-- Eşleş (dereceli) odalar 30 sn'ydi; artık bütün odalarda tur 30 sn.
-- generate_round'un geri kalanı Paket 36 ile aynı (aynı tur iki kez üretilmez).
--
-- NASIL ÇALIŞTIRILIR: Supabase → SQL Editor → bu dosyanın TAMAMI → Run.
-- İki kez çalıştırmak zarar vermez. paket36_online.sql'den SONRA çalıştır.
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
  v_sure int := 30;
begin
  -- Paket 36: aynı tur iki kez üretilmesin (iki telefon aynı anda "sonraki tur"
  -- derse ya da misafir, ev sahibi gecikince kendisi üretirse) — varsa onu döndür.
  select * into v_round from public.rounds
   where room_id = p_room_id and round_number = p_round_number
   order by started_at limit 1;
  if v_round.id is not null then
    return v_round;
  end if;
  -- Paket 37 (Kerem: "arkadaş lobisinde de süre 30 sn olsun"): her odada 30 sn.
  v_sure := 30;
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
