// controllers/documentosController.js
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const mega = require('../config/megaManager');

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

      const ext = file.originalname.split('.').pop().toLowerCase();
      const tipo = TIPOS[ext] || 'otro';
      const fileUuid = uuidv4();

      const { megaCuentaId, megaNodeId, megaLink } = await mega.subirArchivo({
        buffer: file.buffer,
        nombre: `${fileUuid}_${file.originalname}`,
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
        file.originalname,
        file.originalname,
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
        nombre:file.originalname,
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

// ===============================
// EXPORTS
// ===============================
module.exports = {
  listar,
  upload,
  descargar,
  eliminar,
  stats,
  previewDocumento
};