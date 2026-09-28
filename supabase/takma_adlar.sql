-- ============================================================================
-- TAKMA ADLAR (online) — 28 Eylül 2026
-- Uygulamada çift kayıtlar birleşti; silinen yazımlar (ör. "Daniel Alves")
-- tutulan kaydın takma adı oldu (lib/playerAliases.json). Tek kişilik modlar
-- bunları zaten tanıyor; bu dosya ONLINE cevap kontrolünü de aynı hale getirir.
-- online_onarim.sql'DEN SONRA çalıştır. Tekrar tekrar çalıştırılabilir.
-- Sonra: python scripts/sunucu_veri_yukle.py (takma adları da yükler).
-- ============================================================================
create table if not exists public.player_aliases (
  player_id bigint references public.players(id) on delete cascade,
  alias text not null,
  primary key (player_id, alias)
);
alter table public.player_aliases enable row level security;
drop policy if exists "takma adlar herkes okur" on public.player_aliases;
create policy "takma adlar herkes okur" on public.player_aliases for select using (true);

create or replace function public.submit_guess(p_round_id uuid, p_player int, p_guess text)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
  v_correct boolean := false;
  v_answers text[];
  v_adaylar text[];
  v_norm text;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.resolved or v_round.buzzed_by is distinct from p_player then
    return v_round;
  end if;

  v_norm := public.normalize_tr(p_guess);
  select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
  -- 28 Eylül 2026: takma adlar da cevap sayılır ("Daniel Alves" -> Dani Alves).
  -- Açıklanan cevaplar (revealed_answers) yine asıl adlar.
  select coalesce(array_agg(x), '{}') into v_adaylar from (
    select v.name as x from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id) v
    union all
    select pa.alias from public.player_aliases pa
    join public.valid_answers_for(v_round.club_a_id, v_round.club_b_id) v on v.player_id = pa.player_id
  ) t;

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

notify pgrst, 'reload schema';
