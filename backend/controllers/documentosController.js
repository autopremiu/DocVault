// controllers/documentosController.js
const { v4: uuidv4 } = require('uuid');
const { query }      = require('../config/database');
const mega           = require('../config/megaManager');

const TIPOS = {
  xlsx:'excel', xls:'excel', xlsm:'excel',
  docx:'word',  doc:'word',
  pptx:'ppt',   ppt:'ppt',
  pdf:'pdf',
};

function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(2) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}

// GET /api/documentos
const listar = async (req, res) => {
  try {
    const { carpeta_id, tipo, buscar, page = 1, limit = 50, orden = 'created_at', dir = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds  = ['d.activo = TRUE'];

    if (carpeta_id) { params.push(carpeta_id); conds.push(`d.carpeta_id = $${params.length}`); }
    if (tipo)       { params.push(tipo);        conds.push(`d.tipo = $${params.length}`); }
    if (buscar) {
      const like = `%${buscar.toLowerCase()}%`;
      params.push(like); const p1 = params.length;
      params.push(like); const p2 = params.length;
      conds.push(`(LOWER(d.nombre_display) LIKE $${p1} OR LOWER(COALESCE(d.tags,'')) LIKE $${p2})`);
    }

    const where = conds.join(' AND ');
    const validOrden = ['created_at','nombre_display','tamanio_bytes','descargas'].includes(orden) ? orden : 'created_at';
    const validDir   = dir === 'ASC' ? 'ASC' : 'DESC';

    params.push(parseInt(limit)); const pLimit  = params.length;
    params.push(offset);          const pOffset = params.length;

    const sql = `
      SELECT d.id, d.uuid, d.nombre_display, d.tipo, d.extension,
             d.tamanio_display, d.descargas, d.descripcion, d.tags,
             TO_CHAR(d.created_at, 'DD/MM/YYYY HH24:MI') AS fecha,
             c.nombre AS carpeta_nombre, c.icono AS carpeta_icono,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_carpetas c      ON d.carpeta_id     = c.id
      LEFT JOIN dv_mega_cuentas m  ON d.mega_cuenta_id = m.id
      WHERE ${where}
      ORDER BY d.${validOrden} ${validDir}
      LIMIT $${pLimit} OFFSET $${pOffset}
    `;

    const countParams = params.slice(0, params.length - 2);
    const countSql    = `SELECT COUNT(*) FROM dv_documentos d WHERE ${where}`;

    const [docsRes, countRes] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    res.json({
      docs:  docsRes.rows,
      total: parseInt(countRes.rows[0].count),
      page:  parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error('Error listar documentos:', err);
    res.status(500).json({ error: 'Error al obtener documentos', detalle: err.message });
  }
};

// POST /api/documentos/upload (carga masiva)
const upload = async (req, res) => {
  console.log('📥 UPLOAD iniciado');
  console.log('   files recibidos:', req.files?.length || 0);
  console.log('   body:', JSON.stringify(req.body));
  console.log('   admin:', req.admin?.id, req.admin?.email);

  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No se recibieron archivos' });
    const { carpeta_id } = req.body;
    if (!carpeta_id) return res.status(400).json({ error: 'carpeta_id requerido' });

    console.log('🔍 Verificando carpeta:', carpeta_id);
    const carpeta = await query(`SELECT id, nombre FROM dv_carpetas WHERE id = $1 AND activo = TRUE`, [carpeta_id]);
    console.log('   carpeta encontrada:', carpeta.rows.length, carpeta.rows[0] || 'NINGUNA');
    if (!carpeta.rows.length) return res.status(404).json({ error: `Carpeta ${carpeta_id} no encontrada` });

    const resultados = [];
    const errores    = [];

    for (const file of req.files) {
      console.log(`\n📄 Procesando: ${file.originalname} (${fmtBytes(file.size)})`);
      try {
        const ext          = file.originalname.split('.').pop().toLowerCase();
        const tipo         = TIPOS[ext] || 'otro';
        const fileUuid     = uuidv4();
        const nombreDisplay = file.originalname;

        console.log(`   ⬆️  Subiendo a MEGA...`);
        const { megaCuentaId, megaNodeId, megaLink } = await mega.subirArchivo({
          buffer:       file.buffer,
          nombre:       `${fileUuid}_${file.originalname}`,
          tamanioBytes: file.size,
        });
        console.log(`   ✅ MEGA OK — cuenta:${megaCuentaId} nodeId:${megaNodeId?.slice(0,12)}... link:${megaLink?.slice(0,40)}...`);

        console.log(`   💾 Guardando en Supabase...`);
        console.log(`   params: uuid=${fileUuid} tipo=${tipo} ext=${ext} carpeta=${carpeta_id} admin=${req.admin.id} megaCuenta=${megaCuentaId}`);

        await query(`
          INSERT INTO dv_documentos
            (uuid, nombre_original, nombre_display, tipo, extension,
             tamanio_bytes, tamanio_display, carpeta_id, admin_id,
             mega_cuenta_id, mega_node_id, mega_link,
             descripcion, tags)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            fileUuid, file.originalname, nombreDisplay, tipo, ext,
            file.size, fmtBytes(file.size),
            parseInt(carpeta_id), req.admin.id,
            megaCuentaId, megaNodeId, megaLink,
            req.body.descripcion || null,
            req.body.tags || null,
          ]
        );
        console.log(`   ✅ Supabase INSERT OK`);

        await query(
          `INSERT INTO dv_actividad (admin_id, accion, descripcion, ip_address) VALUES ($1,'UPLOAD',$2,$3)`,
          [req.admin.id, `Subido: ${file.originalname} → MEGA cuenta ${megaCuentaId}`, req.ip]
        );
        console.log(`   ✅ Actividad registrada`);

        resultados.push({ nombre: file.originalname, uuid: fileUuid, tipo, tamanio: fmtBytes(file.size), megaLink });
      } catch (fileErr) {
        console.error(`   ❌ ERROR en ${file.originalname}:`);
        console.error(`      mensaje: ${fileErr.message}`);
        console.error(`      stack: ${fileErr.stack}`);
        errores.push({ nombre: file.originalname, error: fileErr.message });
      }
    }

    console.log(`\n📊 RESULTADO: ${resultados.length} OK, ${errores.length} errores`);
    if (errores.length) console.error('   Errores:', JSON.stringify(errores));

    res.json({
      message:  `${resultados.length} subido(s), ${errores.length} error(es)`,
      archivos: resultados,
      errores,
    });
  } catch (err) {
    console.error('❌ ERROR GENERAL upload:', err.message, err.stack);
    res.status(500).json({ error: 'Error al subir archivos', detalle: err.message });
  }
};

// GET /api/documentos/:uuid/download
const descargar = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.nombre_original, d.mega_link, d.mega_node_id, d.tamanio_bytes,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE`,
      [req.params.uuid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Documento no encontrado' });

    const doc = rows[0];
    const buffer = await mega.descargarArchivo({
      megaLink:         doc.mega_link,
      megaNodeId:       doc.mega_node_id,
      megaCuentaNumero: doc.mega_numero,
    });

    await query(`UPDATE dv_documentos SET descargas = descargas + 1 WHERE uuid = $1`, [req.params.uuid]);
    await query(
      `INSERT INTO dv_actividad (admin_id, accion, descripcion, ip_address) VALUES ($1,'DOWNLOAD',$2,$3)`,
      [req.admin.id, `Descargado: ${doc.nombre_original}`, req.ip]
    );

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nombre_original)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al descargar: ' + err.message });
  }
};

// DELETE /api/documentos/:uuid
const eliminar = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.nombre_original, d.mega_node_id, d.mega_cuenta_id, d.tamanio_bytes,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE`,
      [req.params.uuid]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const doc = rows[0];

    // Eliminar de MEGA
    await mega.eliminarArchivo({
      megaNodeId:       doc.mega_node_id,
      megaCuentaNumero: doc.mega_numero,
      megaCuentaId:     doc.mega_cuenta_id,
      tamanioBytes:     doc.tamanio_bytes,
    });

    // Soft delete en BD
    await query(`UPDATE dv_documentos SET activo = FALSE, updated_at = NOW() WHERE uuid = $1`, [req.params.uuid]);
    await query(
      `INSERT INTO dv_actividad (admin_id, accion, descripcion, ip_address) VALUES ($1,'DELETE',$2,$3)`,
      [req.admin.id, `Eliminado: ${doc.nombre_original}`, req.ip]
    );

    res.json({ message: 'Documento eliminado de MEGA y BD' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
};

// GET /api/documentos/stats
const stats = async (req, res) => {
  try {
    const [docsRes, cuentasRes, huerfanosRes] = await Promise.all([
      query(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN tipo='excel' THEN 1 ELSE 0 END) AS excel,
          SUM(CASE WHEN tipo='word'  THEN 1 ELSE 0 END) AS word,
          SUM(CASE WHEN tipo='ppt'   THEN 1 ELSE 0 END) AS ppt,
          SUM(tamanio_bytes) AS storage
        FROM dv_documentos WHERE activo = TRUE`),
      query(`SELECT COUNT(*) AS total FROM dv_carpetas WHERE activo = TRUE`),
      // Detectar documentos huérfanos (carpeta_id no existe o está inactiva)
      query(`
        SELECT COUNT(*) AS total FROM dv_documentos d
        WHERE d.activo = TRUE
          AND NOT EXISTS (SELECT 1 FROM dv_carpetas c WHERE c.id = d.carpeta_id AND c.activo = TRUE)
      `),
    ]);

    const megaStatus = await mega.estadoCuentas();

    const r = docsRes.rows[0];
    const huerfanos = parseInt(huerfanosRes.rows[0].total) || 0;
    res.json({
      totalDocs:     parseInt(r.total) || 0,
      totalExcel:    parseInt(r.excel) || 0,
      totalWord:     parseInt(r.word)  || 0,
      totalPpt:      parseInt(r.ppt)   || 0,
      storageBytes:  parseInt(r.storage) || 0,
      storageDisplay: fmtBytes(parseInt(r.storage) || 0),
      totalCarpetas: parseInt(cuentasRes.rows[0].total) || 0,
      megaCuentas:   megaStatus,
      // Si este número > 0, hay documentos subidos pero sin carpeta válida
      docsHuerfanos: huerfanos,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};


exports.previewDocumento = async (req, res) => {
  try {

    const { uuid } = req.params;

    const doc = await Documento.findOne({ where: { uuid } });

    if (!doc) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const stream = await megaManager.obtenerStream(doc.mega_file_id);

    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Type", doc.mime_type);

    stream.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al visualizar documento");
  }
};
module.exports = { listar, upload, descargar, eliminar, stats };