-- ============================================================================
-- PAKET 28 — ONLINE KLASİK DÜELLO: KULÜP ÇİFTİ HAVUZU (12 Ekim 2026)
--
-- Kerem: "venezia-beşiktaş mesela. cevabı sadece 1 kişi. bu soruyu sormaması
-- gerekmez mi?"
--
-- KÖK NEDEN: Online klasik düelloda turu SUNUCU üretiyor (generate_round) ve
-- bu fonksiyon uygulamadaki zorluk kurallarının HİÇBİRİNİ bilmiyordu:
-- veritabanından rastgele BİR OYUNCU seçip onun rastgele İKİ KULÜBÜNÜ çift
-- yapıyordu. 46 bin oyuncunun çoğu az tanınan oyuncu olduğu için "Venezia ×
-- Beşiktaş" gibi tek cevaplı, kimsenin bilemeyeceği çiftler sık çıkıyordu.
-- (Ayrıca sunucudaki oyuncu verisi uygulamadakinden eskiydi.)
--
-- ÇÖZÜM: Çiftler artık uygulamanın KENDİ motoruyla önceden seçiliyor
-- (scripts/cift_havuzu.json: 7 hazır eşleşme profili × zorluk 3/5/7, en az 3
-- cevaplı, iki kulübü de tanınan çiftler) ve club_pairs tablosuna yükleniyor.
-- generate_round önce bu havuzdan, odanın kulüp filtresine uyan ve odada daha
-- önce sorulmamış bir çift seçer. Havuzda uygun çift kalmazsa eski yönteme
-- düşer ama en az 3 cevaplı çift şartıyla.
--
-- NASIL ÇALIŞTIRILIR:
--   1) Supabase → SQL Editor → bu dosyanın TAMAMI → Run (iki kez çalıştırmak zarar vermez)
--   2) Bilgisayarında:  python scripts\sunucu_veri_yukle.py   (oyuncu verisini + çift havuzunu yükler)
-- ============================================================================

create table if not exists public.club_pairs (
  club_a_id bigint not null references public.clubs(id) on delete cascade,
  club_b_id bigint not null references public.clubs(id) on delete cascade,
  cevap int not null,
  zorluk smallint not null default 5,
  primary key (club_a_id, club_b_id)
);
create index if not exists club_pairs_b_idx on public.club_pairs (club_b_id);

alter table public.club_pairs enable row level security;
drop policy if exists club_pairs_oku on public.club_pairs;
create policy club_pairs_oku on public.club_pairs for select using (true);
grant select on public.club_pairs to anon, authenticated;

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
begin
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
  values (p_room_id, p_round_number, v_club_a, v_club_b, now(), now() + interval '10 seconds')
  returning * into v_round;
  return v_round;
end;
$$;
