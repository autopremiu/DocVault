// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../config/database');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query(
      `SELECT id, nombre, email, password FROM dv_admins WHERE email = $1 AND activo = TRUE`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await query(`UPDATE dv_admins SET ultimo_acceso = NOW() WHERE id = $1`, [admin.id]);
    await query(
      `INSERT INTO dv_actividad (admin_id, accion, descripcion, ip_address) VALUES ($1,'LOGIN',$2,$3)`,
      [admin.id, 'Inicio de sesión', req.ip]
    );

    const token = jwt.sign(
      { id: admin.id, email: admin.email, nombre: admin.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;
    const { rows } = await query(`SELECT password FROM dv_admins WHERE id = $1`, [req.admin.id]);
    const valid = await bcrypt.compare(passwordActual, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(passwordNuevo, 10);
    await query(`UPDATE dv_admins SET password = $1 WHERE id = $2`, [hash, req.admin.id]);
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, cambiarPassword };
