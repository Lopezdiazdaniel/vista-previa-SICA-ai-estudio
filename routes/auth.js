const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { correo_electronico, contrasena } = req.body;

    if (!correo_electronico || !contrasena) {
      return res.status(400).json({ error: 'Correo electrónico y contraseña requeridos' });
    }

    const user = await db.get(
      `SELECT u.*, s.nombre_cliente_o_lugar as nombre_servicio
       FROM usuarios u
       LEFT JOIN servicios s ON u.id_servicio_asignado = s.id_servicio
       WHERE LOWER(u.correo_electronico) = LOWER(?)`,
      [correo_electronico.trim()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas (usuario no encontrado)' });
    }

    if (user.estatus !== 'Activo') {
      return res.status(403).json({
        error: `Su cuenta está en estatus '${user.estatus}'. Comuníquese con la administración de SICA.`
      });
    }

    const isMatch = await bcrypt.compare(contrasena, user.contrasena_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas (contraseña incorrecta)' });
    }

    // Role-based redirect path according to Section 6
    let redirectUrl = '/admin';
    if (user.rol === 'Supervisor') {
      redirectUrl = '/supervisor';
    } else if (user.rol === 'Guardia') {
      redirectUrl = '/guardia';
    }

    const token = generateToken(user);

    // Sanitize user object for client
    const safeUser = {
      id_usuario: user.id_usuario,
      nombre_completo: user.nombre_completo,
      correo_electronico: user.correo_electronico,
      rol: user.rol,
      estatus: user.estatus,
      num_empleado_placa: user.num_empleado_placa,
      id_servicio_asignado: user.id_servicio_asignado,
      nombre_servicio: user.nombre_servicio,
      telefono: user.telefono
    };

    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: safeUser,
      redirectUrl
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor al procesar el inicio de sesión' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.id_usuario, u.nombre_completo, u.correo_electronico, u.rol, u.estatus,
              u.curp, u.telefono, u.num_empleado_placa, u.id_servicio_asignado, u.fecha_alta,
              s.nombre_cliente_o_lugar as nombre_servicio, s.direccion as direccion_servicio,
              s.contacto_emergencia as emergencia_servicio
       FROM usuarios u
       LEFT JOIN servicios s ON u.id_servicio_asignado = s.id_servicio
       WHERE u.id_usuario = ?`,
      [req.user.id_usuario]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Error en /auth/me:', error);
    return res.status(500).json({ error: 'Error al recuperar información del perfil' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { contrasena_actual, nueva_contrasena } = req.body;

    if (!contrasena_actual || !nueva_contrasena) {
      return res.status(400).json({ error: 'Contraseña actual y nueva contraseña requeridas' });
    }

    if (nueva_contrasena.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await db.get(
      'SELECT contrasena_hash FROM usuarios WHERE id_usuario = ?',
      [req.user.id_usuario]
    );

    const isMatch = await bcrypt.compare(contrasena_actual, user.contrasena_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const newHash = await bcrypt.hash(nueva_contrasena, 10);
    await db.run('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?', [newHash, req.user.id_usuario]);

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
});

module.exports = router;
