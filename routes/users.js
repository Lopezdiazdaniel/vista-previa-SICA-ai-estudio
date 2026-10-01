const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadExpediente, expedientesDir } = require('../middleware/upload');

// GET /api/users - List users (Admin and Supervisor)
router.get('/', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { rol, estatus, id_servicio, search } = req.query;

    let sql = `
      SELECT u.id_usuario, u.nombre_completo, u.correo_electronico, u.rol, u.estatus,
             u.curp, u.telefono, u.num_empleado_placa, u.id_servicio_asignado, u.fecha_alta, u.fecha_creacion,
             s.nombre_cliente_o_lugar as nombre_servicio,
             (SELECT COUNT(*) FROM expedientes e WHERE e.id_usuario = u.id_usuario) as total_documentos
      FROM usuarios u
      LEFT JOIN servicios s ON u.id_servicio_asignado = s.id_servicio
      WHERE 1=1
    `;
    const params = [];

    if (rol) {
      sql += ' AND u.rol = ?';
      params.push(rol);
    }
    if (estatus) {
      sql += ' AND u.estatus = ?';
      params.push(estatus);
    }
    if (id_servicio) {
      sql += ' AND u.id_servicio_asignado = ?';
      params.push(Number(id_servicio));
    }
    if (search) {
      sql += ' AND (u.nombre_completo LIKE ? OR u.correo_electronico LIKE ? OR u.num_empleado_placa LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY u.id_usuario DESC';

    const users = await db.query(sql, params);
    return res.json({ users });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
  }
});

// GET /api/users/:id - Single user details
router.get('/:id', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.id_usuario, u.nombre_completo, u.correo_electronico, u.rol, u.estatus,
              u.curp, u.telefono, u.num_empleado_placa, u.id_servicio_asignado, u.fecha_alta, u.fecha_creacion,
              s.nombre_cliente_o_lugar as nombre_servicio
       FROM usuarios u
       LEFT JOIN servicios s ON u.id_servicio_asignado = s.id_servicio
       WHERE u.id_usuario = ?`,
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const expedientes = await db.query(
      'SELECT id_expediente, tipo_documento, nombre_archivo, tamano_bytes, estatus_validacion, fecha_subida FROM expedientes WHERE id_usuario = ? ORDER BY fecha_subida DESC',
      [req.params.id]
    );

    return res.json({ user, expedientes });
  } catch (error) {
    console.error('Error al consultar usuario:', error);
    return res.status(500).json({ error: 'Error al obtener los detalles del usuario' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    const {
      nombre_completo,
      correo_electronico,
      contrasena,
      rol,
      estatus = 'Activo',
      curp,
      telefono,
      num_empleado_placa,
      id_servicio_asignado,
      fecha_alta
    } = req.body;

    if (!nombre_completo || !correo_electronico || !contrasena || !rol) {
      return res.status(400).json({ error: 'Nombre completo, correo, contraseña y rol son requeridos' });
    }

    const existing = await db.get('SELECT id_usuario FROM usuarios WHERE LOWER(correo_electronico) = LOWER(?)', [correo_electronico.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    const result = await db.run(
      `INSERT INTO usuarios (
        nombre_completo, correo_electronico, contrasena_hash, rol, estatus,
        curp, telefono, num_empleado_placa, id_servicio_asignado, fecha_alta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre_completo.trim(),
        correo_electronico.trim().toLowerCase(),
        hash,
        rol,
        estatus,
        curp || null,
        telefono || null,
        num_empleado_placa || null,
        id_servicio_asignado ? Number(id_servicio_asignado) : null,
        fecha_alta || new Date().toISOString().split('T')[0]
      ]
    );

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      id_usuario: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    const {
      nombre_completo,
      correo_electronico,
      contrasena,
      rol,
      estatus,
      curp,
      telefono,
      num_empleado_placa,
      id_servicio_asignado,
      fecha_alta
    } = req.body;

    const user = await db.get('SELECT id_usuario FROM usuarios WHERE id_usuario = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let updateSql = `
      UPDATE usuarios SET
        nombre_completo = ?,
        correo_electronico = ?,
        rol = ?,
        estatus = ?,
        curp = ?,
        telefono = ?,
        num_empleado_placa = ?,
        id_servicio_asignado = ?,
        fecha_alta = ?
    `;
    const params = [
      nombre_completo.trim(),
      correo_electronico.trim().toLowerCase(),
      rol,
      estatus,
      curp || null,
      telefono || null,
      num_empleado_placa || null,
      id_servicio_asignado ? Number(id_servicio_asignado) : null,
      fecha_alta || null
    ];

    if (contrasena && contrasena.trim() !== '') {
      const hash = await bcrypt.hash(contrasena, 10);
      updateSql += ', contrasena_hash = ?';
      params.push(hash);
    }

    updateSql += ' WHERE id_usuario = ?';
    params.push(req.params.id);

    await db.run(updateSql, params);

    return res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id_usuario) {
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta de administrador activa' });
    }

    await db.run('DELETE FROM usuarios WHERE id_usuario = ?', [req.params.id]);
    return res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ==========================================
// Módulo de Expediente Digital (Sección 4.3)
// ==========================================

// POST /api/users/:id/expediente - Upload document to employee dossier (Admin only)
router.post(
  '/:id/expediente',
  verifyToken,
  requireRole('Administrador'),
  uploadExpediente.single('archivo'),
  async (req, res) => {
    try {
      const { tipo_documento, estatus_validacion = 'Aprobado' } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo para subir' });
      }

      const validTypes = [
        'ine',
        'comprobante_domicilio',
        'curp_rfc',
        'antecedentes_no_penales',
        'cartilla_militar',
        'fotografia_rostro'
      ];

      if (!validTypes.includes(tipo_documento)) {
        // Delete uploaded file to avoid orphaned storage
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: `Tipo de documento inválido. Tipos permitidos: ${validTypes.join(', ')}`
        });
      }

      const user = await db.get('SELECT id_usuario FROM usuarios WHERE id_usuario = ?', [req.params.id]);
      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const result = await db.run(
        `INSERT INTO expedientes (
          id_usuario, tipo_documento, nombre_archivo, ruta_archivo, tamano_bytes, estatus_validacion
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          tipo_documento,
          req.file.originalname,
          req.file.filename,
          req.file.size,
          estatus_validacion
        ]
      );

      return res.status(201).json({
        message: 'Documento cargado al expediente digital exitosamente',
        id_expediente: result.insertId,
        archivo: {
          nombre_archivo: req.file.originalname,
          tamano_bytes: req.file.size,
          tipo_documento
        }
      });
    } catch (error) {
      console.error('Error al subir documento de expediente:', error);
      return res.status(500).json({ error: 'Error al subir el documento' });
    }
  }
);

// GET /api/users/:id/expediente - List documents in employee dossier (Admin & Supervisor)
router.get('/:id/expediente', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const docs = await db.query(
      `SELECT id_expediente, tipo_documento, nombre_archivo, ruta_archivo, tamano_bytes, estatus_validacion, fecha_subida
       FROM expedientes
       WHERE id_usuario = ?
       ORDER BY fecha_subida DESC`,
      [req.params.id]
    );

    return res.json({ expedientes: docs });
  } catch (error) {
    console.error('Error al obtener expediente:', error);
    return res.status(500).json({ error: 'Error al consultar expediente digital' });
  }
});

// GET /api/users/:id/expediente/:docId/download - Protected file download
router.get('/:id/expediente/:docId/download', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const doc = await db.get(
      'SELECT * FROM expedientes WHERE id_expediente = ? AND id_usuario = ?',
      [req.params.docId, req.params.id]
    );

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const filePath = path.join(expedientesDir, doc.ruta_archivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'El archivo físico no existe en el almacenamiento' });
    }

    return res.download(filePath, doc.nombre_archivo);
  } catch (error) {
    console.error('Error al descargar documento:', error);
    return res.status(500).json({ error: 'Error al descargar el archivo' });
  }
});

// DELETE /api/users/:id/expediente/:docId - Delete document (Admin only)
router.delete('/:id/expediente/:docId', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    const doc = await db.get(
      'SELECT * FROM expedientes WHERE id_expediente = ? AND id_usuario = ?',
      [req.params.docId, req.params.id]
    );

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const filePath = path.join(expedientesDir, doc.ruta_archivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.run('DELETE FROM expedientes WHERE id_expediente = ?', [req.params.docId]);

    return res.json({ message: 'Documento eliminado del expediente exitosamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    return res.status(500).json({ error: 'Error al eliminar el documento' });
  }
});

module.exports = router;
