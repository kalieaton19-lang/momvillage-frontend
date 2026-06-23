alter table public.posts
  add column if not exists support_status text,
  add column if not exists support_fulfilled_by_user_id uuid,
  add column if not exists support_fulfilled_at timestamptz;

update public.posts
set support_status = 'open'
where type = 'support'
  and (support_status is null or support_status = '');

update public.posts
set support_status = null
where type <> 'support';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_support_status_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_support_status_check
      check (support_status is null or support_status in ('open', 'fulfilled', 'canceled'));
  end if;
end $$;

create table if not exists public.post_support_offers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  offered_by_user_id uuid not null,
  message text,
  created_at timestamptz not null default now(),
  unique (post_id, offered_by_user_id)
);

create index if not exists idx_post_support_offers_post_id on public.post_support_offers(post_id);
create index if not exists idx_post_support_offers_offered_by on public.post_support_offers(offered_by_user_id);

alter table public.post_support_offers enable row level security;

drop policy if exists post_support_offers_select on public.post_support_offers;
create policy post_support_offers_select
on public.post_support_offers
for select
to authenticated
using (
  offered_by_user_id = auth.uid()
  or exists (
    select 1
    from public.posts p
    where p.id = post_support_offers.post_id
      and p.author_user_id = auth.uid()
  )
);

drop policy if exists post_support_offers_insert on public.post_support_offers;
create policy post_support_offers_insert
on public.post_support_offers
for insert
to authenticated
with check (
  offered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_support_offers.post_id
      and p.type = 'support'
      and p.author_user_id <> auth.uid()
      and coalesce(p.support_status, 'open') = 'open'
  )
);

drop policy if exists post_support_offers_delete on public.post_support_offers;
create policy post_support_offers_delete
on public.post_support_offers
for delete
to authenticated
using (
  offered_by_user_id = auth.uid()
  or exists (
    select 1
    from public.posts p
    where p.id = post_support_offers.post_id
      and p.author_user_id = auth.uid()
  )
);

grant select, insert, delete on public.post_support_offers to authenticated;

alter table public.user_public_profiles
  add column if not exists moms_helped_count integer not null default 0;

create or replace function public.handle_support_offer_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author_id uuid;
begin
  select p.author_user_id
  into target_author_id
  from public.posts p
  where p.id = new.post_id;

  if target_author_id is not null then
    insert into public.notifications (user_id, type, data)
    values (
      target_author_id,
      'support_offer_received',
      jsonb_build_object(
        'post_id', new.post_id,
        'offer_id', new.id,
        'offered_by_user_id', new.offered_by_user_id,
        'created_at', new.created_at
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists support_offer_notification_trigger on public.post_support_offers;
create trigger support_offer_notification_trigger
after insert on public.post_support_offers
for each row
execute function public.handle_support_offer_notification();

create or replace function public.handle_support_post_resolution_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.support_status is distinct from new.support_status then
    if new.support_status = 'fulfilled' and new.support_fulfilled_by_user_id is not null then
      update public.user_public_profiles
      set moms_helped_count = coalesce(moms_helped_count, 0) + 1
      where id = new.support_fulfilled_by_user_id;

      insert into public.notifications (user_id, type, data)
      values (
        new.support_fulfilled_by_user_id,
        'support_offer_accepted',
        jsonb_build_object(
          'post_id', new.id,
          'author_user_id', new.author_user_id,
          'fulfilled_at', coalesce(new.support_fulfilled_at, now())
        )
      );
    elsif new.support_status = 'canceled' then
      insert into public.notifications (user_id, type, data)
      select distinct
        offers.offered_by_user_id,
        'support_post_canceled',
        jsonb_build_object(
          'post_id', new.id,
          'author_user_id', new.author_user_id,
          'canceled_at', now()
        )
      from public.post_support_offers offers
      where offers.post_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists support_post_resolution_updates_trigger on public.posts;
create trigger support_post_resolution_updates_trigger
after update on public.posts
for each row
execute function public.handle_support_post_resolution_updates();
