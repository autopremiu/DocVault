// server.js — DocVault v2 (MEGA + Supabase)
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const { pool }    = require('./config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 500 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 10,
  message: { error: 'Demasiados intentos de login' } }));

// ─── RUTAS ────────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch {}
  res.json({ status: 'ok', db: dbOk ? 'connected' : 'error', version: '2.0.0', ts: new Date().toISOString() });
});

// ─── FRONTEND (si se sirve junto al backend) ──────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

// ─── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── START ────────────────────────────────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1'); // verificar conexión BD
    console.log('✅ Supabase PostgreSQL conectado');
    app.listen(PORT, () => {
      console.log(`🚀 DocVault v2 corriendo en http://localhost:${PORT}`);
      console.log(`📦 Storage: MEGA (4 cuentas × 15 GB = 60 GB)`);
      console.log(`🗄️  BD: Supabase PostgreSQL (solo metadata)`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
start();
