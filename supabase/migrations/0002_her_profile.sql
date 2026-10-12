-- lnstinct-blog 迁移 0002：「她」页面的内容（单行 JSON）
--
-- 背景：这一页的内容原先只写本地 data/her.json，而 Vercel 的文件系统是临时的
-- ——在线上后台改完，下一次请求或重新部署就回到默认内容。
-- 这里给它在 Supabase 里一个固定的家，让「线上写 → 刷新 → 还在」成立。
--
-- 设计：单行、key-value 风格。整份 HerProfile 存在 jsonb 里，
-- 形状仍由应用层的 zod（src/domain/her-schemas.ts）把关；
-- 数据库只负责「存住这一份」，不重复定义字段（避免两处 schema 漂移）。
--
-- 权限：匿名只能 SELECT（内容本来就是公开可渲染的，且页面已 noindex）；
-- 写入只走 service-role（服务端 Server Action），没有面向浏览器的写策略。
--
-- 三条来自真实执行的教训（2026-10-12 在正式项目上跑过）：
-- 1. **必须自包含**：第一次执行时报 `42883: function public.is_admin(uuid) does not exist`
--    —— 那套库里的 `0001_init.sql` 并没有全部就位（表在、函数不在）。所以这里把
--    `set_updated_at` / `admin_users` / `is_admin` 三个依赖用 `create or replace`
--    与 `create table if not exists` 补齐，不假设 0001 跑全了。
-- 2. **不能出现 `drop` 关键字**：Supabase 的 SQL Editor 会把任何 `drop` 判为
--    「破坏性操作」并弹确认框。用 `if not exists`（pg_trigger / pg_policies）替代
--    `drop trigger/policy if exists`，同样幂等，但不会吓到执行的人。
-- 3. **可重复执行**：所有语句都是 `if not exists` / `create or replace`，跑第二遍无副作用。

-- ---------------------------------------------------------------------------
-- 0. 依赖：补齐 0001 里定义过、但线上可能缺失的辅助对象
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 管理员身份表：没有它就没有 is_admin 的依据。
-- 定义与 0001 一致（含指向 auth.users 的外键）；`auth` schema 不存在时退回无外键版本，
-- 让这份迁移在「已是正式项目」和「尚未初始化 auth」两种库里都能跑。
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    create table if not exists public.admin_users (
      user_id uuid primary key references auth.users (id) on delete cascade,
      created_at timestamptz not null default now()
    );
  else
    create table if not exists public.admin_users (
      user_id uuid primary key,
      created_at timestamptz not null default now()
    );
  end if;
end
$$;

alter table public.admin_users enable row level security;

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
-- 1. 「她」的内容表（单行）
-- ---------------------------------------------------------------------------
create table if not exists public.her_profile (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint her_profile_slug_fixed check (slug = 'her')
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'her_profile_set_updated_at'
      and tgrelid = 'public.her_profile'::regclass
  ) then
    create trigger her_profile_set_updated_at
      before update on public.her_profile
      for each row
      execute function public.set_updated_at();
  end if;
end
$$;

alter table public.her_profile enable row level security;

-- 策略：匿名读（公开页要渲染）；管理员全权（与 posts/projects 同口径）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'her_profile' and policyname = 'her_profile_public_read'
  ) then
    create policy "her_profile_public_read"
      on public.her_profile for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'her_profile' and policyname = 'her_profile_admin_all'
  ) then
    create policy "her_profile_admin_all"
      on public.her_profile for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end
$$;
