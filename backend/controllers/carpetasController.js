// controllers/carpetasController.js
const { query } = require('../config/database');

const listar = async (req, res) => {
  try {
    const { departamento } = req.query;
    const params = [];
    let where = 'WHERE c.activo = TRUE';
    if (departamento) { params.push(departamento); where += ` AND c.departamento = $1`; }

    const { rows } = await query(`
      SELECT c.id, c.nombre, c.descripcion, c.icono, c.departamento,
        TO_CHAR(c.created_at,'DD/MM/YYYY') AS fecha_creacion,
        COUNT(d.id)                                         AS total_docs,
        SUM(CASE WHEN d.tipo='excel' THEN 1 ELSE 0 END)    AS total_excel,
        SUM(CASE WHEN d.tipo='word'  THEN 1 ELSE 0 END)    AS total_word,
        SUM(CASE WHEN d.tipo='ppt'   THEN 1 ELSE 0 END)    AS total_ppt,
        COALESCE(SUM(d.tamanio_bytes),0)                   AS storage_bytes
      FROM dv_carpetas c
      LEFT JOIN dv_documentos d ON c.id = d.carpeta_id AND d.activo = TRUE
      ${where}
      GROUP BY c.id, c.nombre, c.descripcion, c.icono, c.departamento, c.created_at
      ORDER BY c.nombre`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener carpetas' });
  }
};

const crear = async (req, res) => {
  try {
    const { nombre, descripcion, icono, departamento } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    await query(
      `INSERT INTO dv_carpetas (nombre, descripcion, icono, departamento, admin_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [nombre.trim(), descripcion || null, icono || '📁', departamento || null, req.admin.id]
    );
    await query(
      `INSERT INTO dv_actividad (admin_id, accion, descripcion) VALUES ($1,'CREATE_FOLDER',$2)`,
      [req.admin.id, `Carpeta creada: ${nombre}`]
    );
    res.status(201).json({ message: 'Carpeta creada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear carpeta' });
  }
};

const actualizar = async (req, res) => {
  try {
    const { nombre, descripcion, icono, departamento } = req.body;
    await query(
      `UPDATE dv_carpetas SET nombre=$1, descripcion=$2, icono=$3, departamento=$4 WHERE id=$5 AND activo=TRUE`,
      [nombre, descripcion, icono, departamento, req.params.id]
    );
    res.json({ message: 'Actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

const eliminar = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) FROM dv_documentos WHERE carpeta_id = $1 AND activo = TRUE`,
      [req.params.id]
    );
    if (parseInt(rows[0].count) > 0)
      return res.status(400).json({ error: `No se puede eliminar: contiene ${rows[0].count} documento(s)` });
    await query(`UPDATE dv_carpetas SET activo = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Carpeta eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
};

module.exports = { listar, crear, actualizar, eliminar };
