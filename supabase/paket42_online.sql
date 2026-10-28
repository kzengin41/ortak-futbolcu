-- ============================================================================
-- PAKET 42 (26 Ekim 2026) — Online Ortak Kulüp: BİLİYORUM düğmesi kalktı
--
-- Kerem: "ortak kulüp kulüp x kulüp modundaki biliyorum butonu kalksın. direkt
-- yazalım."
--
-- ESKİ: önce buzz_round (cevap hakkı + 12 sn), sonra submit_guess; tek deneme,
-- yanlışsa o turda kilit. Hakkı alan cevaplarken öbürü bekliyordu.
-- YENİ: iki oyuncu da kutuya doğrudan yazar; ilk doğru yazan turu alır (CPU
-- modundaki gibi). Her oyuncunun turda 3 yanlış hakkı var (rounds.game_state
-- içinde "yanlis1"/"yanlis2"); 3. yanlışta o turda kilitlenir. İki taraf da
-- kilitlenirse (ya da ikisi de "Bilemedim" derse) tur kimseye yazılmaz.
--
-- UYUMLULUK: buzz_round / submit_guess / pass_round / resolve_timeout aynen
-- duruyor. Eski sürümdeki bir rakip buzz'la oynamaya devam edebilir; yeni
-- fonksiyon buzzed_by'a bakmaz. Yalnız EKLEME yapar, mevcut hiçbir şeyi
-- değiştirmez.
--
-- NASIL ÇALIŞTIRILIR: Supabase → SQL Editor → bu dosyanın TAMAMI → Run.
-- İki kez çalıştırmak zarar vermez.
-- ============================================================================

create or replace function public._ortak_cevap_dogru_mu(p_club_a bigint, p_club_b bigint, p_guess text)
returns boolean language plpgsql stable set search_path = public as $$
declare
  v_norm text := public.normalize_tr(p_guess);
  v_adaylar text[];
  v_sonuc boolean := false;
begin
  if coalesce(length(v_norm), 0) < 2 then return false; end if;
  -- Takma adlar da cevap sayılır ("Daniel Alves" -> Dani Alves).
  select coalesce(array_agg(x), '{}') into v_adaylar from (
    select v.name as x from public.valid_answers_for(p_club_a, p_club_b) v
    union all
    select pa.alias from public.player_aliases pa
    join public.valid_answers_for(p_club_a, p_club_b) v on v.player_id = pa.player_id
  ) t;

  -- submit_guess ile aynı eşleşme kuralları.
  select exists (
    select 1
    from unnest(v_adaylar) a
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
  ) into v_sonuc;
  return v_sonuc;
end;
$$;

-- Doğrudan cevap: buzz yok. Dönen satırda game_state->'yanlis1'/'yanlis2' kalan
-- hakkı hesaplamak için kullanılır.
create or replace function public.ortak_cevap(p_round_id uuid, p_player int, p_guess text)
returns public.rounds language plpgsql security definer set search_path = public as $$
declare
  v_round public.rounds;
  v_answers text[];
  v_anahtar text := 'yanlis' || p_player::text;
  v_yanlis int;
begin
  if p_player not in (1, 2) then return null; end if;
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved then
    return v_round;
  end if;
  -- Yalnız odadaki oyuncu, kendi numarasıyla.
  if public.oda_oyuncu_no(v_round.room_id) is distinct from p_player then
    return v_round;
  end if;
  if p_player = any(v_round.locked_players) then
    return v_round;
  end if;
  -- Tur süresi (+2 sn ağ payı) dolduysa cevap alınmaz; turu resolve_timeout kapatır.
  if now() > v_round.round_deadline + interval '2 seconds' then
    return v_round;
  end if;

  if public._ortak_cevap_dogru_mu(v_round.club_a_id, v_round.club_b_id, p_guess) then
    select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
    update public.rounds set resolved = true, winner = p_player, revealed_answers = v_answers,
           buzzed_by = null, buzzed_at = null, answer_deadline = null
     where id = p_round_id returning * into v_round;
    if p_player = 1 then
      update public.rooms set score1 = score1 + 1 where id = v_round.room_id;
    else
      update public.rooms set score2 = score2 + 1 where id = v_round.room_id;
    end if;
    return v_round;
  end if;

  v_yanlis := coalesce((v_round.game_state ->> v_anahtar)::int, 0) + 1;
  update public.rounds
     set game_state = coalesce(game_state, '{}'::jsonb) || jsonb_build_object(v_anahtar, v_yanlis),
         locked_players = case when v_yanlis >= 3 then array_append(locked_players, p_player) else locked_players end
   where id = p_round_id returning * into v_round;

  if array_length(v_round.locked_players, 1) >= 2 then
    select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
    update public.rounds set resolved = true, winner = 0, revealed_answers = v_answers
     where id = p_round_id returning * into v_round;
  end if;
  return v_round;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public._ortak_cevap_dogru_mu(bigint, bigint, text) from anon, authenticated';
    execute 'revoke all on function public.ortak_cevap(uuid, int, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.ortak_cevap(uuid, int, text) to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
