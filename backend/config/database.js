// config/database.js — Supabase PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.SUPABASE_DB_HOST,
  port:     parseInt(process.env.SUPABASE_DB_PORT) || 5432,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user:     process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl:      { rejectUnauthorized: false }, // Supabase requiere SSL
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('✅ Supabase PostgreSQL conectado'));
pool.on('error',   (err) => console.error('❌ DB error:', err.message));

const query = (text, params) => pool.query(text, params);

module.exports = { query, pool };
