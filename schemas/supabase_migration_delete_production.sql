-- Habilitar eliminación de logs de producción para administradores
create policy "Solo administradores pueden eliminar producciones"
  on production_logs for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Habilitar actualización de logs de producción para administradores (por si acaso)
create policy "Solo administradores pueden actualizar producciones"
  on production_logs for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
