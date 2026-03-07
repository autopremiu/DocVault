// routes/index.js
const router  = require('express').Router();
const multer  = require('multer');
const auth    = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const docsCtrl = require('../controllers/documentosController');
const carpCtrl = require('../controllers/carpetasController');
const { query } = require('../config/database');

// ─── AUTH ────────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.login);
router.get ('/auth/verify',   auth, (req,res) => res.json({ admin: req.admin }));
router.put ('/auth/password', auth, authCtrl.cambiarPassword);

// ─── DOCUMENTOS — multer en memoria (buffer directo a MEGA) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 200 * 1024 * 1024, files: 50 }, // 200MB/archivo, 50 archivos max
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const ok  = ['xlsx','xls','xlsm','docx','doc','pptx','ppt','pdf'].includes(ext);
    ok ? cb(null, true) : cb(new Error(`Formato no soportado: .${ext}`));
  },
});

router.get   ('/documentos/stats',          auth, docsCtrl.stats);
router.get   ('/documentos',                auth, docsCtrl.listar);
router.post  ('/documentos/upload',         auth, upload.array('archivos', 50), docsCtrl.upload);
router.get   ('/documentos/:uuid/download', auth, docsCtrl.descargar);
router.delete('/documentos/:uuid',          auth, docsCtrl.eliminar);

// ─── INFO — devuelve metadata + link MEGA (sin descargar el archivo) ──
// El frontend usa este link para abrir Google Docs Viewer u Office Online
router.get('/documentos/:uuid/info', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.uuid, d.nombre_original, d.nombre_display, d.tipo, d.extension,
             d.tamanio_bytes, d.tamanio_display, d.descripcion, d.tags, d.descargas,
             d.mega_link, d.mega_node_id,
             TO_CHAR(d.created_at,'DD/MM/YYYY HH24:MI') AS fecha,
             c.nombre AS carpeta_nombre, c.icono AS carpeta_icono,
             m.numero AS mega_numero, m.email AS mega_email
      FROM dv_documentos d
      LEFT JOIN dv_carpetas c      ON d.carpeta_id     = c.id
      LEFT JOIN dv_mega_cuentas m  ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE`, [req.params.uuid]);

    if (!rows.length) return res.status(404).json({ error: 'Documento no encontrado' });

    const doc = rows[0];
    res.json({
      uuid:          doc.uuid,
      nombre:        doc.nombre_display,
      tipo:          doc.tipo,
      extension:     doc.extension,
      tamanioDisplay:doc.tamanio_display,
      tamanioBytes:  doc.tamanio_bytes,
      descripcion:   doc.descripcion,
      tags:          doc.tags,
      descargas:     doc.descargas,
      fecha:         doc.fecha,
      carpeta:       `${doc.carpeta_icono} ${doc.carpeta_nombre}`,
      megaLink:      doc.mega_link,     // ← link público para el visor
      megaCuenta:    doc.mega_numero,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener info: ' + err.message });
  }
});


// ─── CARPETAS ─────────────────────────────────────────────────
router.get   ('/carpetas',     auth, carpCtrl.listar);
router.post  ('/carpetas',     auth, carpCtrl.crear);
router.put   ('/carpetas/:id', auth, carpCtrl.actualizar);
router.delete('/carpetas/:id', auth, carpCtrl.eliminar);

// ─── ACTIVIDAD ───────────────────────────────────────────────
router.get('/actividad', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT a.accion, a.descripcion, a.ip_address,
             TO_CHAR(a.created_at,'DD/MM/YYYY HH24:MI') AS fecha,
             adm.nombre AS admin_nombre
      FROM dv_actividad a
      LEFT JOIN dv_admins adm ON a.admin_id = adm.id
      ORDER BY a.created_at DESC
      LIMIT 100`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ─── ESTADO MEGA ─────────────────────────────────────────────
router.get('/mega/status', auth, async (req, res) => {
  try {
    const { estadoCuentas } = require('../config/megaManager');
    const estado = await estadoCuentas();
    res.json(estado);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Error handler multer ─────────────────────────────────────
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')  return res.status(400).json({ error: 'Archivo muy grande (máx 200MB)' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Máximo 50 archivos por carga' });
  res.status(400).json({ error: err.message });
});

module.exports = router;