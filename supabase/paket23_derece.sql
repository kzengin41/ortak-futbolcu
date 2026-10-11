-- ============================================================================
-- PAKET 23 — KİMLİK, İZİNLER, DERECE (ELO) VE ÖLÇÜM  (11 Ekim 2026)
--
-- NE YAPAR
--   1) Online oyuncu kimliği artık cihazın kendi ürettiği "dev-..." metni değil,
--      Supabase'in doğruladığı oturum kimliği (auth.uid()). Uygulama açılışta
--      sessizce ANONİM giriş yapıyor (e-posta hesabı varsa o hesap kullanılır).
--   2) rooms / rounds izinleri sıkılaştırıldı: oda yalnız kendi oyuncularınca
--      güncellenir; turları yalnız o odanın oyuncuları yazar; düello RPC'leri
--      "ben 2. oyuncuyum" yalanını kabul etmez.
--   3) Derece (ELO): derece + derece_mac tabloları. İki oyuncu da maç sonucunu
--      bildirir; ikisi aynıysa puan işlenir, çelişirse maç iptal. Tek bildirim
--      90 sn sonra (rakip ayrıldı) işlenir. Tablolara uygulama DOĞRUDAN
--      dokunamaz; yalnız aşağıdaki fonksiyonlar (SECURITY DEFINER) yazar.
--   4) olaylar: hafif ölçüm tablosu (yalnız ekleme; okuma panelden).
--
-- ÇALIŞTIRMADAN ÖNCE: Supabase → Authentication → Sign In / Providers →
--   "Allow anonymous sign-ins" AÇIK olmalı.
-- NASIL: SQL Editor → bu dosyanın TAMAMI → Run. İki kez çalıştırmak zarar vermez.
-- SONRA HEMEN: eas update (eski sürümler anonim oturum açmadığı için online'a
-- giremez; güncelleme gelince düzelir).
-- ============================================================================

-- ---------------------------------------------------------------- yardımcılar
-- Bu oturumdaki kullanıcı odanın kaçıncı oyuncusu? (1 / 2 / null)
create or replace function public.oda_oyuncu_no(p_oda uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    when r.player1_id = auth.uid()::text then 1
    when r.player2_id = auth.uid()::text then 2
  end
  from public.rooms r where r.id = p_oda;
$$;

-- ---------------------------------------------------------------- rooms / rounds izinleri
alter table public.rooms add column if not exists p1_puan int;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('rooms', 'rounds') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "odalar okunur" on public.rooms for select to authenticated using (true);
create policy "oda kurulur" on public.rooms for insert to authenticated
  with check (player1_id = auth.uid()::text and player2_id is distinct from player1_id);
-- Bekleyen boş odaya katılmak (player2 olmak) ya da kendi odasını güncellemek.
create policy "oda guncellenir" on public.rooms for update to authenticated
  using (auth.uid()::text in (player1_id, coalesce(player2_id, '')) or (status = 'waiting' and player2_id is null))
  with check (auth.uid()::text in (player1_id, coalesce(player2_id, '')));

create policy "turlar okunur" on public.rounds for select to authenticated using (true);
create policy "tur eklenir" on public.rounds for insert to authenticated
  with check (public.oda_oyuncu_no(room_id) is not null);
create policy "tur guncellenir" on public.rounds for update to authenticated
  using (public.oda_oyuncu_no(room_id) is not null)
  with check (public.oda_oyuncu_no(room_id) is not null);

-- Oda kimlik alanları kurulduktan sonra değişmez (katılan oyuncu odayı ele geçiremez).
create or replace function public.rooms_koruma() returns trigger
language plpgsql as $$
begin
  if new.player1_id is distinct from old.player1_id
     or new.is_ranked is distinct from old.is_ranked
     or new.game_mode is distinct from old.game_mode
     or new.created_at is distinct from old.created_at
     or (old.player2_id is not null and new.player2_id is distinct from old.player2_id) then
    raise exception 'oda kimlik alanları değiştirilemez';
  end if;
  return new;
end;
$$;
drop trigger if exists rooms_koruma on public.rooms;
create trigger rooms_koruma before update on public.rooms
  for each row execute function public.rooms_koruma();

-- Düello RPC'leri: p_player artık oturumdaki oyuncuyla eşleşmek ZORUNDA.
create or replace function public.buzz_round(p_round_id uuid, p_player int)
returns public.rounds language plpgsql as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null or public.oda_oyuncu_no(v_round.room_id) is distinct from p_player then
    return v_round;
  end if;
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
  if public.oda_oyuncu_no(v_round.room_id) is distinct from p_player then
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
  -- Paket 23: yalnız sırası gelen oyuncunun kendisi cevap verebilir.
  if public.oda_oyuncu_no(v_round.room_id) is distinct from p_player then
    return v_round;
  end if;

  v_norm := public.normalize_tr(p_guess);
  select array_agg(name) into v_answers from public.valid_answers_for(v_round.club_a_id, v_round.club_b_id);
  -- 28 Eylül 2026: takma adlar da cevap sayılır ("Daniel Alves" -> Dani Alves).
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

-- ---------------------------------------------------------------- DERECE (ELO)
create table if not exists public.derece (
  oyuncu uuid primary key references auth.users(id) on delete cascade,
  takma_ad text,
  puan int not null default 1000,
  mac int not null default 0,
  galibiyet int not null default 0,
  beraberlik int not null default 0,
  maglubiyet int not null default 0,
  en_yuksek int not null default 1000,
  seri int not null default 0,                 -- +3: 3 galibiyet üst üste, -2: 2 mağlubiyet
  devir_jetonu text not null default gen_random_uuid()::text,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);
create index if not exists derece_puan_idx on public.derece (puan desc);

create table if not exists public.derece_mac (
  id bigint generated always as identity primary key,
  oda uuid not null references public.rooms(id) on delete cascade,
  mac_no int not null default 1,
  mod text,
  p1 uuid not null,
  p2 uuid not null,
  bildirim1 int,                -- 1. oyuncunun beyanı: kazanan 1 / 2 / 0 (berabere)
  bildirim2 int,
  ayrildi1 boolean not null default false,   -- "rakibim ayrıldı" beyanı
  ayrildi2 boolean not null default false,
  bildirim1_zaman timestamptz,
  bildirim2_zaman timestamptz,
  durum text not null default 'bekliyor',    -- bekliyor | islendi | iptal | sayilmadi
  sebep text,
  kazanan int,
  p1_once int, p1_sonra int, p2_once int, p2_sonra int,
  olusturuldu timestamptz not null default now(),
  islendi timestamptz,
  unique (oda, mac_no)
);
create index if not exists derece_mac_p1_idx on public.derece_mac (p1, islendi);
create index if not exists derece_mac_p2_idx on public.derece_mac (p2, islendi);
create index if not exists derece_mac_bekleyen_idx on public.derece_mac (durum) where durum = 'bekliyor';

alter table public.derece enable row level security;
alter table public.derece_mac enable row level security;
-- Bilerek HİÇ policy yok: okuma/yazma yalnız aşağıdaki fonksiyonlarla.
revoke all on public.derece, public.derece_mac from anon, authenticated;

-- Sabitler
create or replace function public._derece_k(p_mac int) returns int
language sql immutable as $$
  select case when p_mac < 10 then 40 when p_mac < 30 then 32 else 20 end;
$$;

-- a'nın puan değişimi. s: 1 galibiyet, 0.5 berabere, 0 mağlubiyet.
-- Yerleştirmedeki (5 maçtan az) rakibe karşı kazanılan/kaybedilen yarıya iner
-- (yeni açılan hesaplarla puan kasmayı zorlaştırır).
create or replace function public._elo_degisim(p_a int, p_b int, p_s numeric, p_mac_a int, p_mac_b int)
returns int language sql immutable as $$
  select round(
    public._derece_k(p_mac_a)
    * (case when p_mac_b < 5 then 0.5 else 1 end)
    * (p_s - 1.0 / (1 + power(10::numeric, (p_b - p_a) / 400.0)))
  )::int;
$$;

create or replace function public._derece_satir(p_oyuncu uuid) returns public.derece
language plpgsql security definer set search_path = public as $$
declare v public.derece;
begin
  insert into public.derece (oyuncu) values (p_oyuncu) on conflict (oyuncu) do nothing;
  select * into v from public.derece where oyuncu = p_oyuncu;
  return v;
end;
$$;

-- Bir maçı puana işler (kilitli satır üzerinde çağrılır).
create or replace function public._derece_uygula(p_id bigint, p_kazanan int, p_sebep text)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.derece_mac;
  a public.derece;
  b public.derece;
  s1 numeric; s2 numeric;
  d1 int; d2 int;
  ikili int;
begin
  select * into m from public.derece_mac where id = p_id for update;
  if m.id is null or m.durum <> 'bekliyor' then return; end if;

  -- Aynı ikili 24 saatte en fazla 3 dereceli maç (puan kasma freni).
  select count(*) into ikili from public.derece_mac
    where durum = 'islendi' and islendi > now() - interval '24 hours'
      and ((p1 = m.p1 and p2 = m.p2) or (p1 = m.p2 and p2 = m.p1));
  if ikili >= 3 then
    update public.derece_mac set durum = 'sayilmadi', sebep = 'gunluk_ikili_siniri', kazanan = p_kazanan, islendi = now()
      where id = p_id;
    return;
  end if;

  perform public._derece_satir(m.p1);
  perform public._derece_satir(m.p2);
  select * into a from public.derece where oyuncu = m.p1 for update;
  select * into b from public.derece where oyuncu = m.p2 for update;

  s1 := case p_kazanan when 1 then 1 when 2 then 0 else 0.5 end;
  s2 := 1 - s1;
  d1 := public._elo_degisim(a.puan, b.puan, s1, a.mac, b.mac);
  d2 := public._elo_degisim(b.puan, a.puan, s2, b.mac, a.mac);

  update public.derece set
    puan = greatest(100, a.puan + d1),
    mac = mac + 1,
    galibiyet = galibiyet + (p_kazanan = 1)::int,
    maglubiyet = maglubiyet + (p_kazanan = 2)::int,
    beraberlik = beraberlik + (p_kazanan = 0)::int,
    en_yuksek = greatest(en_yuksek, a.puan + d1),
    seri = case p_kazanan when 1 then greatest(seri, 0) + 1 when 2 then least(seri, 0) - 1 else 0 end,
    guncellendi = now()
  where oyuncu = m.p1;
  update public.derece set
    puan = greatest(100, b.puan + d2),
    mac = mac + 1,
    galibiyet = galibiyet + (p_kazanan = 2)::int,
    maglubiyet = maglubiyet + (p_kazanan = 1)::int,
    beraberlik = beraberlik + (p_kazanan = 0)::int,
    en_yuksek = greatest(en_yuksek, b.puan + d2),
    seri = case p_kazanan when 2 then greatest(seri, 0) + 1 when 1 then least(seri, 0) - 1 else 0 end,
    guncellendi = now()
  where oyuncu = m.p2;

  update public.derece_mac set
    durum = 'islendi', sebep = p_sebep, kazanan = p_kazanan, islendi = now(),
    p1_once = a.puan, p1_sonra = greatest(100, a.puan + d1),
    p2_once = b.puan, p2_sonra = greatest(100, b.puan + d2)
  where id = p_id;
end;
$$;

-- Tek taraflı bildirimi 90 sn'dir bekleyen maçları işle (zamanlayıcı yok:
-- her derece çağrısında birkaç tanesi temizlenir).
create or replace function public._derece_bekleyenleri_isle()
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in
    select id, coalesce(bildirim1, bildirim2) as k
    from public.derece_mac
    where durum = 'bekliyor'
      and (bildirim1 is null) <> (bildirim2 is null)
      and coalesce(bildirim1_zaman, bildirim2_zaman) < now() - interval '90 seconds'
    order by id
    limit 25
  loop
    perform public._derece_uygula(m.id, m.k, 'tek_bildirim');
  end loop;
end;
$$;

-- Maç sonucu bildir. p_kazanan: 1 / 2 / 0 (berabere), mutlak oyuncu numarasıyla.
-- p_rakip_ayrildi: rakip maçı yarıda bıraktı (bildirenin galibiyeti).
create or replace function public.derece_bildir(p_oda uuid, p_mac_no int, p_kazanan int, p_rakip_ayrildi boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ben uuid := auth.uid();
  r public.rooms;
  no int;
  m public.derece_mac;
  diger int;
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  perform public._derece_bekleyenleri_isle();

  select * into r from public.rooms where id = p_oda;
  if r.id is null then return jsonb_build_object('durum', 'oda_yok'); end if;
  no := public.oda_oyuncu_no(p_oda);
  if no is null then return jsonb_build_object('durum', 'oyuncu_degil'); end if;
  if not r.is_ranked then return jsonb_build_object('durum', 'dereceli_degil'); end if;
  if r.player2_id is null or r.player1_id = r.player2_id
     or r.player1_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or r.player2_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  if p_kazanan not in (0, 1, 2) or p_mac_no is null or p_mac_no < 1 or p_mac_no > 30 then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  if p_rakip_ayrildi and p_kazanan <> no then return jsonb_build_object('durum', 'gecersiz'); end if;

  insert into public.derece_mac (oda, mac_no, mod, p1, p2)
    values (p_oda, p_mac_no, r.game_mode, r.player1_id::uuid, r.player2_id::uuid)
    on conflict (oda, mac_no) do nothing;
  select * into m from public.derece_mac where oda = p_oda and mac_no = p_mac_no for update;

  if m.durum <> 'bekliyor' then
    return public.derece_mac_durumu(p_oda, p_mac_no);
  end if;
  -- Çok kısa "maç" sayılmaz (ilk maç için oda en az 30 sn önce kurulmuş olmalı).
  if p_mac_no = 1 and r.created_at > now() - interval '30 seconds' then
    update public.derece_mac set durum = 'sayilmadi', sebep = 'cok_kisa', islendi = now() where id = m.id;
    return public.derece_mac_durumu(p_oda, p_mac_no);
  end if;

  if no = 1 then
    if m.bildirim1 is null then
      update public.derece_mac set bildirim1 = p_kazanan, ayrildi1 = p_rakip_ayrildi, bildirim1_zaman = now()
        where id = m.id returning * into m;
    end if;
  else
    if m.bildirim2 is null then
      update public.derece_mac set bildirim2 = p_kazanan, ayrildi2 = p_rakip_ayrildi, bildirim2_zaman = now()
        where id = m.id returning * into m;
    end if;
  end if;

  if m.bildirim1 is not null and m.bildirim2 is not null then
    if m.bildirim1 = m.bildirim2 then
      perform public._derece_uygula(m.id, m.bildirim1, 'iki_bildirim');
    else
      -- İki taraf farklı sonuç söylüyor (ya da biri "rakip ayrıldı" derken öbürü
      -- maçı başka sonuçla bitirdi): güvenli tarafta kal, puan işlenmez.
      update public.derece_mac set durum = 'iptal', sebep = 'celiski', islendi = now() where id = m.id;
    end if;
  end if;
  return public.derece_mac_durumu(p_oda, p_mac_no);
end;
$$;

-- Maçın derece sonucu (yalnız o maçın oyuncuları görür).
create or replace function public.derece_mac_durumu(p_oda uuid, p_mac_no int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.derece_mac;
  ben uuid := auth.uid();
  no int;
begin
  perform public._derece_bekleyenleri_isle();
  select * into m from public.derece_mac where oda = p_oda and mac_no = p_mac_no;
  if m.id is null then return jsonb_build_object('durum', 'yok'); end if;
  if ben is distinct from m.p1 and ben is distinct from m.p2 then return jsonb_build_object('durum', 'oyuncu_degil'); end if;
  no := case when ben = m.p1 then 1 else 2 end;
  return jsonb_build_object(
    'durum', m.durum,
    'sebep', m.sebep,
    'kazanan', m.kazanan,
    'ben', no,
    'once', case when no = 1 then m.p1_once else m.p2_once end,
    'sonra', case when no = 1 then m.p1_sonra else m.p2_sonra end,
    'rakip_once', case when no = 1 then m.p2_once else m.p1_once end,
    'rakip_sonra', case when no = 1 then m.p2_sonra else m.p1_sonra end
  );
end;
$$;

-- Kendi derece kartım (yoksa açılır). Sıra = puanı benden yüksek olan sayısı + 1.
create or replace function public.derece_benim()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ben uuid := auth.uid();
  v public.derece;
  sira int;
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  perform public._derece_bekleyenleri_isle();
  v := public._derece_satir(ben);
  select count(*) + 1 into sira from public.derece where puan > v.puan and mac > 0;
  return jsonb_build_object(
    'durum', 'tamam', 'oyuncu', v.oyuncu, 'takma_ad', v.takma_ad, 'puan', v.puan, 'mac', v.mac,
    'galibiyet', v.galibiyet, 'beraberlik', v.beraberlik, 'maglubiyet', v.maglubiyet,
    'en_yuksek', v.en_yuksek, 'seri', v.seri, 'sira', case when v.mac > 0 then sira end,
    'devir_jetonu', v.devir_jetonu
  );
end;
$$;

-- Başka bir oyuncunun herkese açık kartı (rakip adı ve ligi için).
create or replace function public.derece_oyuncu(p_oyuncu uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('takma_ad', d.takma_ad, 'puan', d.puan, 'mac', d.mac) from public.derece d where d.oyuncu = p_oyuncu),
    jsonb_build_object('takma_ad', null, 'puan', 1000, 'mac', 0)
  );
$$;

-- Takma ad: 3–16 karakter, harf/rakam/boşluk/._- ; uygunsuz kelime içermez.
create or replace function public._ad_uygun_mu(p_ad text) returns boolean
language plpgsql immutable as $$
declare
  n text;
  yasak text[] := array[
    'amk','aq','amq','amina','amcik','orospu','orosbu','pic','pezevenk','sik','sikerim','sikik','siktir',
    'yarrak','yarak','got','gotveren','ibne','kahpe','kaltak','oc','ananı','anani','bok','salak','gerizekal',
    'serefsiz','haysiyetsiz','puşt','pust','kancik','dalyarak','fuck','shit','bitch','nigger','nigga','whore',
    'cunt','pussy','admin','moderator','yonetici'
  ];
  k text;
begin
  if p_ad is null then return false; end if;
  if char_length(btrim(p_ad)) < 3 or char_length(btrim(p_ad)) > 16 then return false; end if;
  if p_ad !~ '^[A-Za-z0-9ÇĞİÖŞÜçğıöşü ._-]+$' then return false; end if;
  n := lower(translate(p_ad, 'ÇĞİÖŞÜçğıöşü', 'cgiosucgiosu'));
  n := regexp_replace(n, '[^a-z0-9]', '', 'g');
  n := translate(n, '0134578', 'oieasbt');
  foreach k in array yasak loop
    k := regexp_replace(lower(translate(k, 'ÇĞİÖŞÜçğıöşü', 'cgiosucgiosu')), '[^a-z0-9]', '', 'g');
    if char_length(k) <= 3 then
      if n = k then return false; end if;   -- kısa kelimeler yalnız tek başına (Işık, Gökhan geçsin)
    elsif position(k in n) > 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.derece_ad_ayarla(p_ad text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ben uuid := auth.uid();
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  if not public._ad_uygun_mu(p_ad) then return jsonb_build_object('durum', 'uygunsuz'); end if;
  perform public._derece_satir(ben);
  update public.derece set takma_ad = btrim(regexp_replace(p_ad, '\s+', ' ', 'g')), guncellendi = now() where oyuncu = ben;
  return jsonb_build_object('durum', 'tamam', 'takma_ad', btrim(regexp_replace(p_ad, '\s+', ' ', 'g')));
end;
$$;

-- Liderlik: p_tur 'tum' (puana göre) | 'hafta' (son 7 günde kazanılan puan).
create or replace function public.liderlik(p_tur text default 'tum', p_limit int default 50)
returns table(sira int, takma_ad text, puan int, mac int, deger int, ben boolean)
language plpgsql stable security definer set search_path = public as $$
declare ben uuid := auth.uid();
begin
  if p_tur = 'hafta' then
    return query
      with k as (
        select x.oyuncu, sum(x.d)::int as kazanc, count(*)::int as n from (
          select p1 as oyuncu, p1_sonra - p1_once as d from public.derece_mac where durum = 'islendi' and islendi > now() - interval '7 days'
          union all
          select p2, p2_sonra - p2_once from public.derece_mac where durum = 'islendi' and islendi > now() - interval '7 days'
        ) x group by x.oyuncu
      )
      select (row_number() over (order by k.kazanc desc, d.puan desc))::int, coalesce(d.takma_ad, 'Oyuncu'), d.puan, k.n, k.kazanc, d.oyuncu = ben
      from k join public.derece d on d.oyuncu = k.oyuncu
      order by k.kazanc desc, d.puan desc
      limit least(greatest(p_limit, 1), 100);
  else
    return query
      select (row_number() over (order by d.puan desc, d.mac desc))::int, coalesce(d.takma_ad, 'Oyuncu'), d.puan, d.mac, d.puan, d.oyuncu = ben
      from public.derece d
      where d.mac > 0
      order by d.puan desc, d.mac desc
      limit least(greatest(p_limit, 1), 100);
  end if;
end;
$$;

-- Anonim hesaptan e-posta hesabına puan taşıma. Anonim oturumdayken alınan
-- devir jetonu ile, YENİ hesapta henüz dereceli maç yoksa kart taşınır.
create or replace function public.derece_devral(p_eski uuid, p_jeton text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ben uuid := auth.uid();
  eski public.derece;
  yeni public.derece;
  anonim boolean;
begin
  if ben is null then return jsonb_build_object('durum', 'oturum_yok'); end if;
  if p_eski is null or p_eski = ben then return jsonb_build_object('durum', 'gerek_yok'); end if;
  select * into eski from public.derece where oyuncu = p_eski for update;
  if eski.oyuncu is null or eski.devir_jetonu is distinct from p_jeton then
    return jsonb_build_object('durum', 'gecersiz');
  end if;
  select coalesce(u.is_anonymous, false) into anonim from auth.users u where u.id = p_eski;
  if not coalesce(anonim, false) then return jsonb_build_object('durum', 'gecersiz'); end if;
  select * into yeni from public.derece where oyuncu = ben for update;
  if yeni.oyuncu is not null and yeni.mac > 0 then
    return jsonb_build_object('durum', 'hesapta_derece_var');
  end if;
  delete from public.derece where oyuncu = ben;
  update public.derece set oyuncu = ben, devir_jetonu = gen_random_uuid()::text, guncellendi = now() where oyuncu = p_eski;
  update public.derece_mac set p1 = ben where p1 = p_eski;
  update public.derece_mac set p2 = ben where p2 = p_eski;
  return jsonb_build_object('durum', 'tasindi');
end;
$$;

-- ---------------------------------------------------------------- profiller
-- Anonim oturumlar (her cihaz) için boş profiles satırı açılmasın; profil yalnız
-- e-posta hesabı açanlar için (schema_auth.sql'deki tetikleyicinin yeni hâli).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------- ÖLÇÜM
create table if not exists public.olaylar (
  id bigint generated always as identity primary key,
  oyuncu uuid default auth.uid(),
  olay text not null,
  mod text,
  veri jsonb,
  surum text,
  zaman timestamptz not null default now()
);
create index if not exists olaylar_zaman_idx on public.olaylar (zaman);
create index if not exists olaylar_olay_idx on public.olaylar (olay, zaman);
alter table public.olaylar enable row level security;
drop policy if exists "olay eklenir" on public.olaylar;
create policy "olay eklenir" on public.olaylar for insert to authenticated
  with check (oyuncu = auth.uid() and char_length(olay) <= 40 and (veri is null or pg_column_size(veri) < 2000));
revoke all on public.olaylar from anon;
grant insert on public.olaylar to authenticated;

-- ---------------------------------------------------------------- yetkiler
revoke all on function public._derece_k(int) from public;
revoke all on function public._elo_degisim(int, int, numeric, int, int) from public;
revoke all on function public._derece_satir(uuid) from public;
revoke all on function public._derece_uygula(bigint, int, text) from public;
revoke all on function public._derece_bekleyenleri_isle() from public;
revoke all on function public._ad_uygun_mu(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public._derece_k(int) from anon';
    execute 'revoke all on function public._elo_degisim(int, int, numeric, int, int) from anon';
    execute 'revoke all on function public._derece_satir(uuid) from anon, authenticated';
    execute 'revoke all on function public._derece_uygula(bigint, int, text) from anon, authenticated';
    execute 'revoke all on function public._derece_bekleyenleri_isle() from anon, authenticated';
    execute 'revoke all on function public._ad_uygun_mu(text) from anon';
    execute 'revoke all on function public.derece_bildir(uuid, int, int, boolean) from anon';
    execute 'revoke all on function public.derece_mac_durumu(uuid, int) from anon';
    execute 'revoke all on function public.derece_benim() from anon';
    execute 'revoke all on function public.derece_ad_ayarla(text) from anon';
    execute 'revoke all on function public.derece_devral(uuid, text) from anon';
  end if;
end $$;
grant execute on function public.derece_bildir(uuid, int, int, boolean) to authenticated;
grant execute on function public.derece_mac_durumu(uuid, int) to authenticated;
grant execute on function public.derece_benim() to authenticated;
grant execute on function public.derece_oyuncu(uuid) to authenticated;
grant execute on function public.derece_ad_ayarla(text) to authenticated;
grant execute on function public.liderlik(text, int) to authenticated;
grant execute on function public.derece_devral(uuid, text) to authenticated;
grant execute on function public.oda_oyuncu_no(uuid) to authenticated;

notify pgrst, 'reload schema';
