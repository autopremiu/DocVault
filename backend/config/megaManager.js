// config/megaManager.js
const { Storage } = require('megajs');
const { query }   = require('./database');

const LIMITE_BYTES = parseInt(process.env.MEGA_LIMIT_BYTES) || 15032385536;

const megaPool = {};

function getCuentasConfig() {
  const cuentas = [];
  for (let i = 1; i <= 4; i++) {
    const email = process.env[`MEGA_EMAIL_${i}`];
    const pass  = process.env[`MEGA_PASS_${i}`];
    // Solo incluir cuentas con credenciales reales (no los valores de ejemplo)
    if (email && pass &&
        !email.startsWith('cuenta') &&
        pass !== `password_cuenta${i}`) {
      cuentas.push({ numero: i, email, pass });
    }
  }
  return cuentas;
}

async function conectar(numero) {
  if (megaPool[numero]) return megaPool[numero];

  const configs = getCuentasConfig();
  const cfg = configs.find(c => c.numero === numero);
  if (!cfg) throw new Error(`Cuenta MEGA ${numero} no configurada o sin credenciales válidas`);

  console.log(`🔗 Conectando a MEGA cuenta ${numero} (${cfg.email})...`);

  const storage = await new Storage({
    email:    cfg.email,
    password: cfg.pass,
    autologin: true,
  }).ready;

  megaPool[numero] = storage;
  console.log(`✅ MEGA cuenta ${numero} conectada`);
  return storage;
}

// Elegir la cuenta con más espacio disponible
// Solo usa cuentas que tienen credenciales reales en .env
async function elegirCuenta() {
  const configs = getCuentasConfig();
  const numerosValidos = configs.map(c => c.numero);

  console.log('🔍 Cuentas MEGA con credenciales configuradas:', numerosValidos);

  if (!numerosValidos.length) {
    throw new Error('No hay cuentas MEGA con credenciales reales configuradas en las variables de entorno. Revisa MEGA_EMAIL_x y MEGA_PASS_x.');
  }

  const { rows } = await query(`
    SELECT id, numero, email, bytes_usados, limite_bytes
    FROM dv_mega_cuentas
    WHERE activa = TRUE
      AND bytes_usados < limite_bytes
      AND numero = ANY($1::int[])
    ORDER BY bytes_usados ASC
    LIMIT 1
  `, [numerosValidos]);

  if (!rows.length) {
    throw new Error(`Sin espacio disponible en las cuentas configuradas: [${numerosValidos.join(', ')}]`);
  }

  console.log(`✅ Cuenta elegida: #${rows[0].numero} (${rows[0].email})`);
  return rows[0];
}

// ─── SUBIR ARCHIVO ──────────────────────────────────────────
async function subirArchivo({ buffer, nombre, tamanioBytes }) {
  const cuenta = await elegirCuenta();
  const storage = await conectar(cuenta.numero);

  console.log(`⬆️  Subiendo "${nombre}" (${(tamanioBytes/1048576).toFixed(2)} MB) → MEGA cuenta ${cuenta.numero}`);

  const uploadResult = await storage.upload(
    { name: nombre, size: tamanioBytes },
    buffer
  ).complete;

  const link = await new Promise((res, rej) => {
    uploadResult.link((err, url) => err ? rej(err) : res(url));
  });

  await query(
    `UPDATE dv_mega_cuentas SET bytes_usados = bytes_usados + $1, updated_at = NOW() WHERE id = $2`,
    [tamanioBytes, cuenta.id]
  );

  console.log(`✅ Subido exitosamente → ${link}`);

  return {
    megaCuentaId: cuenta.id,
    megaNodeId:   uploadResult.nodeId || uploadResult.handle,
    megaLink:     link,
  };
}

// ─── DESCARGAR ARCHIVO ──────────────────────────────────────
async function descargarArchivo({ megaLink, megaNodeId, megaCuentaNumero }) {
  try {
    if (megaLink) {
      const { File } = require('megajs');
      const file = File.fromURL(megaLink);
      await file.loadAttributes();
      return await file.downloadBuffer();
    }

    if (megaNodeId && megaCuentaNumero) {
      const storage = await conectar(megaCuentaNumero);
      const file = storage.files[megaNodeId];
      if (!file) throw new Error('Archivo no encontrado en MEGA');
      return await file.downloadBuffer();
    }

    throw new Error('No hay suficiente información para descargar el archivo');
  } catch (err) {
    console.error('Error descargando de MEGA:', err.message);
    throw err;
  }
}

// ─── ELIMINAR ARCHIVO ───────────────────────────────────────
async function eliminarArchivo({ megaNodeId, megaCuentaNumero, megaCuentaId, tamanioBytes }) {
  try {
    if (megaNodeId && megaCuentaNumero) {
      const storage = await conectar(megaCuentaNumero);
      const file = storage.files[megaNodeId];
      if (file) {
        await new Promise((res, rej) => file.delete((err) => err ? rej(err) : res()));
      }
    }

    if (megaCuentaId && tamanioBytes) {
      await query(
        `UPDATE dv_mega_cuentas SET bytes_usados = GREATEST(0, bytes_usados - $1), updated_at = NOW() WHERE id = $2`,
        [tamanioBytes, megaCuentaId]
      );
    }
  } catch (err) {
    console.error('Error eliminando de MEGA:', err.message);
  }
}

// ─── ESTADO DE CUENTAS ──────────────────────────────────────
async function estadoCuentas() {
  const configs = getCuentasConfig();
  const numerosValidos = configs.map(c => c.numero);

  const { rows } = await query(`
    SELECT numero, email, bytes_usados, limite_bytes,
      ROUND((bytes_usados::numeric / NULLIF(limite_bytes,0)) * 100, 1) AS porcentaje_uso,
      limite_bytes - bytes_usados AS bytes_disponibles
    FROM dv_mega_cuentas
    WHERE activa = TRUE
    ORDER BY numero
  `);

  return rows.map(r => ({
    numero:        r.numero,
    email:         r.email,
    usadoGB:       (r.bytes_usados / 1073741824).toFixed(2),
    disponibleGB:  (r.bytes_disponibles / 1073741824).toFixed(2),
    totalGB:       (r.limite_bytes / 1073741824).toFixed(2),
    porcentajeUso: parseFloat(r.porcentaje_uso) || 0,
    configurada:   numerosValidos.includes(r.numero), // ← indica si tiene credenciales
  }));
}

module.exports = { subirArchivo, descargarArchivo, eliminarArchivo, estadoCuentas, conectar };
