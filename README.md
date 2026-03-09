# DocVault v2 — MEGA + Supabase + Render
### Sin Oracle, sin tarjeta de crédito, 60 GB de almacenamiento real gratis

---

## 🏗️ ARQUITECTURA

```
Usuario/Admin
     ↓
React Frontend (Vercel — gratis)
     ↓
Node.js Backend API (Render.com — gratis)
     ├── Supabase PostgreSQL ← SOLO METADATA (500MB gratis, sin tarjeta)
     │     • nombre, tipo, carpeta, fecha, tamaño
     │     • mega_cuenta_id, mega_node_id, mega_link
     │
     └── MEGA Storage Manager ← ARCHIVOS REALES (60 GB gratis)
           ├── Cuenta MEGA 1 — 15 GB
           ├── Cuenta MEGA 2 — 15 GB
           ├── Cuenta MEGA 3 — 15 GB
           └── Cuenta MEGA 4 — 15 GB
               (auto-selecciona la cuenta con más espacio)
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
docvault2/
├── backend/
│   ├── config/
│   │   ├── database.js      ← Pool Supabase PostgreSQL
│   │   ├── megaManager.js   ← Gestor de 4 cuentas MEGA
│   │   └── schema.sql       ← Tablas en Supabase
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── server.js
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/   ← Dashboard, Carpetas, Documentos, Subir, Actividad
        └── App.jsx
```

---

## 🚀 PASO 1 — SUPABASE (Base de Datos — sin tarjeta)

1. Ir a https://supabase.com → **Start your project**
2. Registrarse con GitHub o email (completamente gratis, sin tarjeta)
3. **New Project** → nombre: `docvault` → elegir contraseña fuerte
4. Esperar ~2 minutos a que el proyecto se cree
5. Ir a **SQL Editor** → **New Query**
6. Pegar todo el contenido de `backend/config/schema.sql`
7. Ejecutar (**Run** o Ctrl+Enter)

### Obtener credenciales de conexión:
- Ir a **Project Settings** → **Database**
- Copiar datos de **Connection string** (sección "URI"):
  ```
  Host:     db.XXXXXXXXXXXX.supabase.co
  Port:     5432
  Database: postgres
  User:     postgres
  Password: [la que pusiste al crear el proyecto]
  ```

---

## 🚀 PASO 2 — MEGA (4 Cuentas = 60 GB — sin tarjeta)

### Crear las 4 cuentas:
1. Ir a https://mega.nz → **Create account**
2. Necesitas 4 emails distintos (puedes usar Gmail con `+`:
   - `tuemail+mega1@gmail.com`
   - `tuemail+mega2@gmail.com`
   - `tuemail+mega3@gmail.com`
   - `tuemail+mega4@gmail.com`
3. Para cada cuenta: registrarse, verificar el email
4. **NO activar el bono temporal** de 35 GB — solo usa los 15 GB permanentes

> ⚠️ MEGA no tiene API oficial. El SDK `megajs` funciona con las credenciales
> de email/password de cada cuenta. Mantenlas seguras en las variables de entorno.

---

## 🚀 PASO 3 — RENDER.COM (Servidor — gratis)

### 3.1 Subir a GitHub
```bash
cd docvault2
git init
git add .
git commit -m "DocVault v2 — MEGA + Supabase"
# Crear repo en github.com primero, luego:
git remote add origin https://github.com/TU_USUARIO/docvault.git
git push -u origin main
```

### 3.2 Crear Web Service
1. https://render.com → **New Web Service**
2. Conectar con GitHub → seleccionar tu repo
3. Configurar:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free ✅

### 3.3 Variables de entorno en Render
En **Environment** → agregar todas estas:

```
PORT                    = 3000
NODE_ENV                = production
JWT_SECRET              = [genera en randomkeygen.com — Fort Knox]
FRONTEND_URL            = https://[tu-app].vercel.app

SUPABASE_DB_HOST        = db.XXXX.supabase.co
SUPABASE_DB_PORT        = 5432
SUPABASE_DB_NAME        = postgres
SUPABASE_DB_USER        = postgres
SUPABASE_DB_PASSWORD    = [tu password de Supabase]

MEGA_EMAIL_1            = cuenta1@gmail.com
MEGA_PASS_1             = 
MEGA_EMAIL_2            = cuenta2@gmail.com
MEGA_PASS_2             = [password cuenta 2]
MEGA_EMAIL_3            = cuenta3@gmail.com
MEGA_PASS_3             = [password cuenta 3]
MEGA_EMAIL_4            = cuenta4@gmail.com
MEGA_PASS_4             = [password cuenta 4]
MEGA_LIMIT_BYTES        = 15032385536
```

---

## 🚀 PASO 4 — FRONTEND EN VERCEL (Gratis)

1. Crear `frontend/.env.production`:
   ```
   VITE_API_URL=https://docvault-api.onrender.com/api
   ```
2. https://vercel.com → **New Project** → importar repo
3. Root Directory: `frontend`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Agregar env var: `VITE_API_URL` = URL de tu backend en Render

---

## 💡 NOTAS IMPORTANTES

### Render Free Tier
El servidor se "duerme" tras 15 min sin tráfico. Primera petición puede tardar 30s.
**Solución:** Usar https://uptimerobot.com (gratis) para hacer ping cada 14 min.

### Supabase vs Oracle
- Supabase: 500 MB para metadata = ~5 millones de registros de documentos
- Para solo guardar nombres, tipos, fechas y links de MEGA, 500 MB es MÁS que suficiente
- Si llegas al límite: migrar a Neon (3 GB gratis) sin cambiar el código (ambos son PostgreSQL)

### MEGA Consideraciones
- Los archivos se suben con `megajs` desde el servidor (no desde el navegador)
- El sistema auto-balancea: siempre sube a la cuenta con más espacio libre
- Si una cuenta se llena, automáticamente usa la siguiente
- Puedes agregar más cuentas fácilmente en el `.env`

---

## 🔑 CREDENCIALES DEFAULT
```
email: admin@docvault.com
password: admin123
```
**⚠️ CAMBIAR INMEDIATAMENTE en producción.**

---

## 📊 CAPACIDAD TOTAL

| Recurso        | Límite          | Para qué sirve         |
|----------------|-----------------|------------------------|
| Supabase       | 500 MB          | Metadata (5M+ registros)|
| MEGA (4 ctas)  | 60 GB           | Archivos Excel/Word/PPT |
| Render         | 750 h/mes       | Servidor backend        |
| Vercel         | ∞ (banda ancha) | Frontend React          |
| **TOTAL**      | **~60 GB**      | **100% GRATIS**         |
