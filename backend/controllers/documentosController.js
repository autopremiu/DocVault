// controllers/documentosController.js
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const mega = require('../config/megaManager');
const drive = require('../config/googleDriveManager');

// ── Corregir encoding de nombres (multer entrega latin-1, necesitamos UTF-8) ──
function fixNombre(originalname) {
  try {
    // multer decodifica como latin-1 por defecto; re-encodificar a UTF-8
    return Buffer.from(originalname, 'latin1').toString('utf8');
  } catch {
    return originalname;
  }
}


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

// ===============================
// GET /api/documentos
// ===============================
const listar = async (req, res) => {
  try {
    const { carpeta_id, tipo, buscar, page = 1, limit = 50, orden = 'created_at', dir = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds = ['d.activo = TRUE'];

    if (carpeta_id) { params.push(carpeta_id); conds.push(`d.carpeta_id = $${params.length}`); }
    if (tipo) { params.push(tipo); conds.push(`d.tipo = $${params.length}`); }

    if (buscar) {
      const like = `%${buscar.toLowerCase()}%`;
      params.push(like); const p1 = params.length;
      params.push(like); const p2 = params.length;
      conds.push(`(LOWER(d.nombre_display) LIKE $${p1} OR LOWER(COALESCE(d.tags,'')) LIKE $${p2})`);
    }

    const where = conds.join(' AND ');
    const validOrden = ['created_at','nombre_display','tamanio_bytes','descargas'].includes(orden) ? orden : 'created_at';
    const validDir = dir === 'ASC' ? 'ASC' : 'DESC';

    params.push(parseInt(limit)); const pLimit = params.length;
    params.push(offset); const pOffset = params.length;

    const sql = `
      SELECT d.id, d.uuid, d.nombre_display, d.tipo, d.extension,
             d.tamanio_display, d.descargas, d.descripcion, d.tags,
             TO_CHAR(d.created_at,'DD/MM/YYYY HH24:MI') AS fecha,
             c.nombre AS carpeta_nombre, c.icono AS carpeta_icono,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_carpetas c ON d.carpeta_id = c.id
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE ${where}
      ORDER BY d.${validOrden} ${validDir}
      LIMIT $${pLimit} OFFSET $${pOffset}
    `;

    const countParams = params.slice(0, params.length - 2);
    const countSql = `SELECT COUNT(*) FROM dv_documentos d WHERE ${where}`;

    const [docsRes, countRes] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({
      docs: docsRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit))
    });

  } catch (err) {
    console.error('Error listar documentos:', err);
    res.status(500).json({ error: 'Error al obtener documentos', detalle: err.message });
  }
};

// ===============================
// POST /api/documentos/upload
// ===============================
const upload = async (req, res) => {

  try {

    if (!req.files?.length) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    const { carpeta_id } = req.body;

    if (!carpeta_id) {
      return res.status(400).json({ error: 'carpeta_id requerido' });
    }

    const carpeta = await query(
      `SELECT id FROM dv_carpetas WHERE id = $1 AND activo = TRUE`,
      [carpeta_id]
    );

    if (!carpeta.rows.length) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    const resultados = [];

    for (const file of req.files) {

      const ext = fixNombre(file.originalname).split('.').pop().toLowerCase();
      const tipo = TIPOS[ext] || 'otro';
      const fileUuid = uuidv4();

      const { megaCuentaId, megaNodeId, megaLink } = await mega.subirArchivo({
        buffer: file.buffer,
        nombre: `${fileUuid}_${fixNombre(file.originalname)}`,
        tamanioBytes: file.size
      });

      await query(`
        INSERT INTO dv_documentos
        (uuid,nombre_original,nombre_display,tipo,extension,
        tamanio_bytes,tamanio_display,carpeta_id,admin_id,
        mega_cuenta_id,mega_node_id,mega_link)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,[
        fileUuid,
        fixNombre(file.originalname),
        fixNombre(file.originalname),
        tipo,
        ext,
        file.size,
        fmtBytes(file.size),
        carpeta_id,
        req.admin.id,
        megaCuentaId,
        megaNodeId,
        megaLink
      ]);

      resultados.push({
        nombre:fixNombre(file.originalname),
        uuid:fileUuid
      });
    }

    res.json({ archivos: resultados });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error:'Error al subir archivos' });

  }

};

// ===============================
// GET /api/documentos/:uuid/download
// ===============================
const descargar = async (req,res)=>{

  try{

    const {rows} = await query(`
      SELECT d.nombre_original,d.mega_link,d.mega_node_id,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id=m.id
      WHERE d.uuid=$1 AND d.activo=TRUE
    `,[req.params.uuid]);

    if(!rows.length){
      return res.status(404).json({error:"Documento no encontrado"});
    }

    const doc = rows[0];

    const buffer = await mega.descargarArchivo({
      megaLink:doc.mega_link,
      megaNodeId:doc.mega_node_id,
      megaCuentaNumero:doc.mega_numero
    });

    res.setHeader("Content-Disposition",`attachment; filename="${encodeURIComponent(doc.nombre_original)}"`);
    res.setHeader("Content-Type","application/octet-stream");
    res.send(buffer);

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error al descargar"});

  }

};

// ===============================
// GET /api/documentos/:uuid/preview
// ===============================
const previewDocumento = async (req,res)=>{

  try{

    const {rows} = await query(`
      SELECT d.nombre_original,d.mega_link,d.mega_node_id,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id=m.id
      WHERE d.uuid=$1 AND d.activo=TRUE
    `,[req.params.uuid]);

    if(!rows.length){
      return res.status(404).json({error:"Documento no encontrado"});
    }

    const doc = rows[0];

    const buffer = await mega.descargarArchivo({
      megaLink:doc.mega_link,
      megaNodeId:doc.mega_node_id,
      megaCuentaNumero:doc.mega_numero
    });

    const ext = doc.nombre_original.split('.').pop().toLowerCase();

    const mime = {
      pdf:"application/pdf",
      docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };

    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    res.setHeader("Content-Disposition","inline");

    res.send(buffer);

  }catch(err){

    console.error("Error preview:",err);
    res.status(500).json({error:"Error al visualizar documento"});

  }

};


//delete
const eliminar = async (req, res) => {
  try {

    const { rows } = await query(`
      SELECT d.nombre_original, d.mega_node_id, d.mega_cuenta_id, d.tamanio_bytes,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE
    `, [req.params.uuid]);

    if (!rows.length) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const doc = rows[0];

    // eliminar archivo en MEGA
    await mega.eliminarArchivo({
      megaNodeId: doc.mega_node_id,
      megaCuentaNumero: doc.mega_numero,
      megaCuentaId: doc.mega_cuenta_id,
      tamanioBytes: doc.tamanio_bytes
    });

    // soft delete en base de datos
    await query(
      `UPDATE dv_documentos
       SET activo = FALSE, updated_at = NOW()
       WHERE uuid = $1`,
      [req.params.uuid]
    );

    // registrar actividad
    await query(
      `INSERT INTO dv_actividad
      (admin_id, accion, descripcion, ip_address)
      VALUES ($1,'DELETE',$2,$3)`,
      [
        req.admin.id,
        `Eliminado: ${doc.nombre_original}`,
        req.ip
      ]
    );

    res.json({
      message: "Documento eliminado correctamente"
    });

  } catch (err) {

    console.error("Error eliminar:", err);
    res.status(500).json({
      error: "Error al eliminar documento"
    });

  }
};


// ===============================
// GET /api/documentos/stats
// ===============================
const stats = async (req, res) => {
  try {

    const docs = await query(`
      SELECT COUNT(*) AS total,
      SUM(CASE WHEN tipo='excel' THEN 1 ELSE 0 END) AS excel,
      SUM(CASE WHEN tipo='word' THEN 1 ELSE 0 END) AS word,
      SUM(CASE WHEN tipo='ppt' THEN 1 ELSE 0 END) AS ppt,
      SUM(tamanio_bytes) AS storage
      FROM dv_documentos
      WHERE activo = TRUE
    `);

    const carpetas = await query(`
      SELECT COUNT(*) AS total
      FROM dv_carpetas
      WHERE activo = TRUE
    `);

    const r = docs.rows[0];

    res.json({
      totalDocs: parseInt(r.total) || 0,
      totalExcel: parseInt(r.excel) || 0,
      totalWord: parseInt(r.word) || 0,
      totalPpt: parseInt(r.ppt) || 0,
      storageBytes: parseInt(r.storage) || 0,
      totalCarpetas: parseInt(carpetas.rows[0].total) || 0
    });

  } catch (err) {

    console.error("Error stats:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });

  }
};


// ===============================
// POST /api/documentos/:uuid/editar
// Sube el archivo a Google Drive y devuelve el link de edición
// ===============================
const abrirEnDrive = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.uuid, d.nombre_original, d.extension, d.mega_link, d.mega_node_id,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE
    `, [req.params.uuid]);

    if (!rows.length) return res.status(404).json({ error: 'Documento no encontrado' });

    const doc = rows[0];
    const ext = doc.extension || doc.nombre_original.split('.').pop().toLowerCase();

    // Descargar de MEGA
    const buffer = await mega.descargarArchivo({
      megaLink: doc.mega_link,
      megaNodeId: doc.mega_node_id,
      megaCuentaNumero: doc.mega_numero,
    });

    // Subir a Google Drive (con conversión a Google Docs/Sheets/Slides)
    const { fileId, webViewLink, esEditable } = await drive.subirADrive(buffer, doc.nombre_original, ext);

    // Guardar el fileId en BD para poder recuperar el archivo editado después
    await query(
      `UPDATE dv_documentos SET drive_file_id = $1, drive_abierto_at = NOW() WHERE uuid = $2`,
      [fileId, doc.uuid]
    );

    res.json({ fileId, webViewLink, esEditable, nombre: doc.nombre_original, ext });

  } catch (err) {
    console.error('Error abrirEnDrive:', err);
    res.status(500).json({ error: 'Error al abrir en Google Drive: ' + err.message });
  }
};

// ===============================
// POST /api/documentos/:uuid/guardar-drive
// Descarga el archivo editado de Drive y lo reemplaza en MEGA
// ===============================
const guardarDesdeDrive = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.uuid, d.nombre_original, d.extension, d.drive_file_id,
             d.mega_node_id, d.mega_cuenta_id, d.tamanio_bytes,
             m.numero AS mega_numero
      FROM dv_documentos d
      LEFT JOIN dv_mega_cuentas m ON d.mega_cuenta_id = m.id
      WHERE d.uuid = $1 AND d.activo = TRUE
    `, [req.params.uuid]);

    if (!rows.length) return res.status(404).json({ error: 'Documento no encontrado' });

    const doc = rows[0];
    if (!doc.drive_file_id) return res.status(400).json({ error: 'Este documento no tiene una sesión de edición activa' });

    const ext = doc.extension || doc.nombre_original.split('.').pop().toLowerCase();

    // Descargar el archivo editado de Google Drive
    const bufferEditado = await drive.descargarDeDrive(doc.drive_file_id, ext);
    const nuevoTamanio  = bufferEditado.length;
    const fmtBytes      = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : b < 1073741824 ? (b/1048576).toFixed(1)+' MB' : (b/1073741824).toFixed(2)+' GB';

    // Eliminar el archivo viejo de MEGA
    await mega.eliminarArchivo({
      megaNodeId:    doc.mega_node_id,
      megaCuentaNumero: doc.mega_numero,
      megaCuentaId:  doc.mega_cuenta_id,
      tamanioBytes:  doc.tamanio_bytes,
    });

    // Subir la versión nueva a MEGA
    const { megaCuentaId, megaNodeId, megaLink } = await mega.subirArchivo({
      buffer:       bufferEditado,
      nombre:       `${doc.uuid}_${doc.nombre_original}`,
      tamanioBytes: nuevoTamanio,
    });

    // Actualizar registro en BD
    await query(`
      UPDATE dv_documentos
      SET mega_node_id    = $1,
          mega_cuenta_id  = $2,
          mega_link       = $3,
          tamanio_bytes   = $4,
          tamanio_display = $5,
          drive_file_id   = NULL,
          drive_abierto_at= NULL,
          updated_at      = NOW()
      WHERE uuid = $6
    `, [megaNodeId, megaCuentaId, megaLink, nuevoTamanio, fmtBytes(nuevoTamanio), doc.uuid]);

    // Registrar actividad
    await query(
      `INSERT INTO dv_actividad (admin_id, accion, descripcion, ip_address) VALUES ($1,'EDIT',$2,$3)`,
      [req.admin.id, `Editado: ${doc.nombre_original}`, req.ip]
    );

    // Limpiar de Google Drive (ya no lo necesitamos)
    await drive.eliminarDeDrive(doc.drive_file_id);

    res.json({ message: 'Documento guardado correctamente', tamanio: fmtBytes(nuevoTamanio) });

  } catch (err) {
    console.error('Error guardarDesdeDrive:', err);
    res.status(500).json({ error: 'Error al guardar: ' + err.message });
  }
};

// ===============================
// DELETE /api/documentos/:uuid/cancelar-drive
// Cancela la edición y limpia el archivo de Drive sin guardar
// ===============================
const cancelarEdicion = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT drive_file_id FROM dv_documentos WHERE uuid = $1 AND activo = TRUE`,
      [req.params.uuid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Documento no encontrado' });

    const { drive_file_id } = rows[0];
    if (drive_file_id) {
      await drive.eliminarDeDrive(drive_file_id);
      await query(
        `UPDATE dv_documentos SET drive_file_id = NULL, drive_abierto_at = NULL WHERE uuid = $1`,
        [req.params.uuid]
      );
    }
    res.json({ message: 'Edición cancelada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar: ' + err.message });
  }
};

// ===============================
// EXPORTS
// ===============================
module.exports = {
  listar,
  upload,
  descargar,
  eliminar,
  stats,
  previewDocumento,
  abrirEnDrive,
  guardarDesdeDrive,
  cancelarEdicion
};