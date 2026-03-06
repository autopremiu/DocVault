// middleware/auth.js
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token requerido' });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      `SELECT id, nombre, email FROM dv_admins WHERE id = $1 AND activo = TRUE`,
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Acceso denegado' });

    req.admin = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Sesión expirada', expired: true });
    return res.status(401).json({ error: 'Token inválido' });
  }
};
