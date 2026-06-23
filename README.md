# 🎂 App de Gestión — Pastelería Mami

Esta aplicación web está diseñada a la medida para Cecilia y su negocio de pastelería. Permite llevar el control completo de ingredientes, calcular los costos exactos y las ganancias de las recetas (desglosando la parte de socios como Jhon), registrar la producción diaria para descontar existencias automáticamente del inventario y generar listas de compras agrupadas por proveedor y optimizadas según las cantidades de empaque mínimas.

---

## 🚀 Guía de Configuración Rápida

Sigue estos 4 pasos para tener la aplicación funcionando en producción:

### 1. Crear un proyecto en Supabase (Base de datos + Autenticación)
1. Ve a [Supabase](https://supabase.com/) e inicia sesión.
2. Crea un nuevo proyecto (es totalmente gratuito y permanente). Asigna un nombre (ej. `pasteleria-mami`) y una contraseña fuerte para la base de datos.
3. Espera un par de minutos a que la base de datos se configure.

### 2. Ejecutar el Esquema de Tablas
1. Entra a tu panel del proyecto en Supabase y haz clic en la sección **SQL Editor** en el panel izquierdo (icono de `SQL`).
2. Haz clic en **New query** (Nueva consulta).
3. Copia el contenido del archivo [`supabase_schema.sql`](file:///c:/Users/Allison%20Ruiz/Desktop/app%20mami/supabase_schema.sql) que hemos creado en este repositorio.
4. Pégalo en el editor y haz clic en **Run** (Ejecutar) abajo a la derecha. Verás el mensaje "Success. No rows returned". Esto creará todas las tablas, relaciones de claves foráneas, políticas de seguridad RLS y el trigger para los perfiles.

### 3. Configurar las Variables de Entorno en Local
1. En la raíz de este proyecto, haz una copia del archivo `.env.example` y cámbiale el nombre a `.env` (o `.env.local` en tu máquina local).
2. Ve a Supabase -> **Project Settings** (icono de engranaje abajo a la izquierda) -> **API**.
3. Copia la **Project URL** y pégala en `VITE_SUPABASE_URL`.
4. Copia la **Anon Key** (Clave anónima pública) y pégala en `VITE_SUPABASE_ANON_KEY`.
   
   Ejemplo del archivo `.env`:
   ```env
   VITE_SUPABASE_URL=https://abcde12345.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 4. Crear los Usuarios y Asignar Roles
1. Ve a Supabase -> **Authentication** -> **Users** -> **Add user** -> **Create user**.
2. Registra el correo de Cecilia y de Jhon con sus respectivas contraseñas.
3. Copia el **User ID** (UUID de 36 caracteres) de cada uno desde la tabla de usuarios.
4. Vuelve al **SQL Editor** de Supabase, crea una consulta rápida y ejecuta lo siguiente reemplazando las claves para asignar los roles:

   ```sql
   -- Asignar rol de Administradora a Cecilia
   UPDATE public.profiles
   SET role = 'admin', full_name = 'Cecilia Ruiz'
   WHERE id = 'UUID-DE-CECILIA';

   -- Asignar rol de Socio a Jhon
   UPDATE public.profiles
   SET role = 'partner', full_name = 'Jhon'
   WHERE id = 'UUID-DE-JHON';
   ```

---

## 💻 Desarrollo Local

Para correr y probar la aplicación en tu computadora local:

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre el navegador en la dirección indicada (usualmente `http://localhost:5173/`).
4. Para ejecutar las pruebas automatizadas y asegurar que todo está correcto:
   ```bash
   npm run test:run
   ```

---

## 🌐 Deploy en Vercel (Hosting Gratuito)

Vercel compila y publica tu aplicación de forma 100% gratuita con certificados SSL automáticos.

1. Sube este código a un repositorio tuyo de **GitHub** (público o privado).
2. Regístrate en [Vercel](https://vercel.com/) usando tu cuenta de GitHub.
3. Haz clic en **Add New** -> **Project**.
4. Importa el repositorio de la pastelería.
5. En la sección de **Environment Variables** (Variables de Entorno), agrega las siguientes claves con sus correspondientes valores de Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Haz clic en **Deploy**. ¡Listo! En un minuto tendrás la URL del sitio oficial para Cecilia y Jhon.
