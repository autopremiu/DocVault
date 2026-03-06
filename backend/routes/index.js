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
