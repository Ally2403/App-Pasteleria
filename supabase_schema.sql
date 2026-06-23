-- ====================================================
-- ESQUEMA DE BASE DE DATOS (SUPABASE / POSTGRESQL)
-- Proyecto: App Pastelería Mami 🎂
-- Copia y ejecuta este script en el editor SQL de Supabase
-- ====================================================

-- ── 1. HABILITAR EXTENSIONES ─────────────────────────
create extension if not exists "uuid-ossp";

-- ── 2. ELIMINAR TABLAS EXISTENTES (Si existen, en orden inverso de FK) ──
drop table if exists production_logs cascade;
drop table if exists recipe_pricing cascade;
drop table if exists recipe_extra_costs cascade;
drop table if exists recipe_ingredients cascade;
drop table if exists recipes cascade;
drop table if exists inventory cascade;
drop table if exists ingredients cascade;
drop table if exists profiles cascade;

-- ── 3. CREAR TABLA DE PERFILES ────────────────────────
-- Vinculada directamente con auth.users de Supabase Auth
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'partner')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS)
alter table profiles enable row level security;

-- Políticas de seguridad para perfiles
create policy "Cualquier usuario autenticado puede leer perfiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Los usuarios pueden editar su propio perfil"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- ── 4. TABLA DE INGREDIENTES ─────────────────────────
create table ingredients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  provider text,
  quantity_sold numeric not null,
  unit text not null,
  price numeric not null,
  unit_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table ingredients enable row level security;

create policy "Cualquier usuario autenticado puede ver ingredientes"
  on ingredients for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar ingredientes"
  on ingredients for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 5. TABLA DE INVENTARIO (STOCK ACTUAL) ────────────
create table inventory (
  id uuid default gen_random_uuid() primary key,
  ingredient_id uuid references ingredients(id) on delete cascade not null unique,
  current_stock numeric default 0 not null,
  unit text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table inventory enable row level security;

create policy "Cualquier usuario autenticado puede ver inventario"
  on inventory for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar inventario"
  on inventory for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 6. TABLA DE RECETAS ──────────────────────────────
create table recipes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  units_per_batch numeric not null,
  has_partner boolean default false not null,
  partner_id uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table recipes enable row level security;

create policy "Cualquier usuario autenticado puede ver recetas"
  on recipes for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar recetas"
  on recipes for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 7. TABLA DE INGREDIENTES DE RECETA ────────────────
create table recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  quantity_used numeric not null
);

alter table recipe_ingredients enable row level security;

create policy "Cualquier usuario autenticado puede ver ingredientes de receta"
  on recipe_ingredients for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar ingredientes de receta"
  on recipe_ingredients for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 8. TABLA DE COSTOS EXTRA ──────────────────────────
create table recipe_extra_costs (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('packaging', 'service', 'labor', 'other')),
  quantity numeric not null,
  unit_price numeric not null,
  total numeric not null
);

alter table recipe_extra_costs enable row level security;

create policy "Cualquier usuario autenticado puede ver costos extra"
  on recipe_extra_costs for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar costos extra"
  on recipe_extra_costs for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 9. TABLA DE PRECIOS Y MARGENES ────────────────────
create table recipe_pricing (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null unique,
  profit_percentage numeric not null,
  suggested_price numeric not null,
  rounded_price numeric not null
);

alter table recipe_pricing enable row level security;

create policy "Cualquier usuario autenticado puede ver precios"
  on recipe_pricing for select
  to authenticated
  using (true);

create policy "Solo administradores pueden modificar precios"
  on recipe_pricing for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 10. TABLA DE REGISTROS DE PRODUCCION ──────────────
create table production_logs (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  units_produced numeric not null,
  actual_ingredients jsonb not null, -- Guardar instantánea del consumo real [{ ingredientId, quantityUsed }]
  notes text
);

alter table production_logs enable row level security;

create policy "Cualquier usuario autenticado puede ver logs de producción"
  on production_logs for select
  to authenticated
  using (true);

create policy "Solo administradores pueden registrar producciones"
  on production_logs for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 11. TRIGGER PARA CREACION AUTOMATICA DE PERFIL ────
-- Función para que cada vez que un usuario se registre en Supabase Auth,
-- se inserte una fila en la tabla de perfiles automáticamente.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Nueva Pastelera'),
    coalesce(new.raw_user_meta_data->>'role', 'partner') -- Por defecto socio a menos que se defina
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger adjunto
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ====================================================
-- EJEMPLO: CÓMO CREAR A CECILIA (ADMIN) Y JHON (SOCIO)
-- ====================================================
-- 1. Regístralos en la sección de "Authentication" -> "Users" -> "Add User" en Supabase.
-- 2. Copia sus IDs de usuario (UUID) desde la lista de Supabase Auth.
-- 3. Si quieres actualizarlos manualmente para definir los roles correctos:
--
-- UPDATE public.profiles
-- SET role = 'admin', full_name = 'Cecilia Ruiz'
-- WHERE id = 'ID-DE-UUID-DE-CECILIA';
--
-- UPDATE public.profiles
-- SET role = 'partner', full_name = 'Jhon'
-- WHERE id = 'ID-DE-UUID-DE-JHON';
-- ====================================================
