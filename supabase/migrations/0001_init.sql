-- lnstinct-blog Supabase migrations
-- 说明：字段与 Task 1 的 snake_case Row 类型严格对齐。
-- 应用不持有 service-role key；所有写操作由 admin_users 中的管理员身份完成。

-- ---------------------------------------------------------------------------
-- 1. posts
-- ---------------------------------------------------------------------------
create type public.content_status as enum ('draft', 'published', 'trashed');
create type public.post_kind as enum ('article', 'essay');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  kind public.post_kind not null,
  title text not null,
  summary text,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  tags text[] not null default '{}',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_slug_kind_unique unique (slug, kind),
  constraint posts_title_not_blank check (length(btrim(title)) > 0)
);

create index posts_status_idx on public.posts (status);
create index posts_kind_status_idx on public.posts (kind, status);
create index posts_published_at_idx on public.posts (published_at desc);

-- 自动维护 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  repository_url text not null,
  live_url text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_not_blank check (length(btrim(title)) > 0),
  constraint projects_repo_http check (repository_url like 'http://%' or repository_url like 'https://%'),
  constraint projects_live_http check (live_url is null or live_url like 'http://%' or live_url like 'https://%')
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. admin_users（管理员身份表）
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 判断某个 auth.uid() 是否为管理员
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS：匿名只能读 published；管理员可读写一切（含草稿/回收站）
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.projects enable row level security;
alter table public.admin_users enable row level security;

-- posts：匿名读 published
create policy "posts_public_read_published"
  on public.posts for select
  using (status = 'published');

-- posts：管理员读写全部
create policy "posts_admin_all"
  on public.posts for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- projects：匿名读
create policy "projects_public_read"
  on public.projects for select
  using (true);

-- projects：管理员读写全部
create policy "projects_admin_all"
  on public.projects for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- admin_users：管理员自己可见
create policy "admin_users_self_read"
  on public.admin_users for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Storage：draft-media 私有、public-media 公开；仅管理员可上传/移动/删除
-- ---------------------------------------------------------------------------
-- 创建 bucket（在 SQL 中声明，实际操作在管理控制台或脚本中执行）
-- insert into storage.buckets (id, name, public)
-- values ('draft-media', 'draft-media', false),
--        ('public-media', 'public-media', true);

-- draft-media：管理员读写，其余不可见
create policy "draft_media_admin_all"
  on storage.objects for all
  using (bucket_id = 'draft-media' and public.is_admin(auth.uid()))
  with check (bucket_id = 'draft-media' and public.is_admin(auth.uid()));

-- public-media：匿名可读，管理员可写
create policy "public_media_public_read"
  on storage.objects for select
  using (bucket_id = 'public-media');

create policy "public_media_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'public-media' and public.is_admin(auth.uid()));

create policy "public_media_admin_update"
  on storage.objects for update
  using (bucket_id = 'public-media' and public.is_admin(auth.uid()))
  with check (bucket_id = 'public-media' and public.is_admin(auth.uid()));

create policy "public_media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'public-media' and public.is_admin(auth.uid()));
