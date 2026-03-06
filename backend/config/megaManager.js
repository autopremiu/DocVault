// config/megaManager.js
// ─────────────────────────────────────────────────────────────
// Gestiona 4 cuentas MEGA como un sistema de almacenamiento
// distribuido. Sube a la cuenta con más espacio disponible,
// balancea la carga automáticamente.
// ─────────────────────────────────────────────────────────────
const { Storage } = require('megajs');
const { query }   = require('./database');

const LIMITE_BYTES = parseInt(process.env.MEGA_LIMIT_BYTES) || 15032385536; // 14 GB

// Pool de conexiones MEGA en memoria
const megaPool = {};

// Configuración de las 4 cuentas desde .env
function getCuentasConfig() {
  const cuentas = [];
  for (let i = 1; i <= 4; i++) {
    const email = process.env[`MEGA_EMAIL_${i}`];
    const pass  = process.env[`MEGA_PASS_${i}`];
    if (email && pass) cuentas.push({ numero: i, email, pass });
  }
  return cuentas;
}

// Conectar a una cuenta MEGA (con cache)
async function conectar(numero) {
  if (megaPool[numero]) return megaPool[numero];

  const configs = getCuentasConfig();
  const cfg = configs.find(c => c.numero === numero);
  if (!cfg) throw new Error(`Cuenta MEGA ${numero} no configurada`);

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
async function elegirCuenta() {
  const { rows } = await query(`
    SELECT id, numero, email, bytes_usados, limite_bytes
    FROM dv_mega_cuentas
    WHERE activa = TRUE
      AND bytes_usados < limite_bytes
    ORDER BY bytes_usados ASC
    LIMIT 1
  `);

  if (!rows.length) throw new Error('⚠️ Sin espacio disponible en ninguna cuenta MEGA');
  return rows[0];
}

// ─── SUBIR ARCHIVO ──────────────────────────────────────────
async function subirArchivo({ buffer, nombre, tamanioBytes }) {
  const cuenta = await elegirCuenta();
  const storage = await conectar(cuenta.numero);

  console.log(`⬆️  Subiendo "${nombre}" (${(tamanioBytes/1048576).toFixed(2)} MB) → MEGA cuenta ${cuenta.numero}`);

  // Subir a MEGA
  const uploadResult = await storage.upload(
    { name: nombre, size: tamanioBytes },
    buffer
  ).complete;

  // Obtener link público
  const link = await new Promise((res, rej) => {
    uploadResult.link((err, url) => err ? rej(err) : res(url));
  });

  // Actualizar uso de la cuenta en BD
  await query(
    `UPDATE dv_mega_cuentas 
     SET bytes_usados = bytes_usados + $1, updated_at = NOW()
     WHERE id = $2`,
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
    // Método 1: Por link público (más confiable)
    if (megaLink) {
      const { File } = require('megajs');
      const file = File.fromURL(megaLink);
      await file.loadAttributes();
      return await file.downloadBuffer();
    }

    // Método 2: Por node ID (si tenemos acceso a la cuenta)
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

    // Liberar espacio en el registro
    if (megaCuentaId && tamanioBytes) {
      await query(
        `UPDATE dv_mega_cuentas
         SET bytes_usados = GREATEST(0, bytes_usados - $1), updated_at = NOW()
         WHERE id = $2`,
        [tamanioBytes, megaCuentaId]
      );
    }
  } catch (err) {
    console.error('Error eliminando de MEGA:', err.message);
    // No lanzar error — el registro en BD igual se elimina
  }
}

// ─── ESTADO DE CUENTAS ──────────────────────────────────────
async function estadoCuentas() {
  const { rows } = await query(`
    SELECT numero, email, bytes_usados, limite_bytes,
      ROUND((bytes_usados::numeric / limite_bytes) * 100, 1) AS porcentaje_uso,
      limite_bytes - bytes_usados AS bytes_disponibles
    FROM dv_mega_cuentas
    WHERE activa = TRUE
    ORDER BY numero
  `);

  return rows.map(r => ({
    numero:          r.numero,
    email:           r.email,
    usadoGB:         (r.bytes_usados / 1073741824).toFixed(2),
    disponibleGB:    (r.bytes_disponibles / 1073741824).toFixed(2),
    totalGB:         (r.limite_bytes / 1073741824).toFixed(2),
    porcentajeUso:   parseFloat(r.porcentaje_uso),
  }));
}

module.exports = { subirArchivo, descargarArchivo, eliminarArchivo, estadoCuentas, conectar };
