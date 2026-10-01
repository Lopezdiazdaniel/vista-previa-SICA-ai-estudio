const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/services - List all services
router.get('/', verifyToken, async (req, res) => {
  try {
    const { estatus, tipo_servicio, search } = req.query;

    let sql = `
      SELECT s.*,
             (SELECT COUNT(*) FROM usuarios u WHERE u.id_servicio_asignado = s.id_servicio AND u.estatus = 'Activo') as guardias_asignados,
             (SELECT COUNT(*) FROM consignas c WHERE c.id_servicio = s.id_servicio AND c.estatus = 'Vigente') as consignas_activas,
             (SELECT COUNT(*) FROM accesos a WHERE a.id_servicio = s.id_servicio AND date(a.fecha_hora) = date('now', 'localtime')) as accesos_hoy
      FROM servicios s
      WHERE 1=1
    `;
    const params = [];

    if (estatus) {
      sql += ' AND s.estatus = ?';
      params.push(estatus);
    }
    if (tipo_servicio) {
      sql += ' AND s.tipo_servicio = ?';
      params.push(tipo_servicio);
    }
    if (search) {
      sql += ' AND (s.nombre_cliente_o_lugar LIKE ? OR s.contacto_principal LIKE ? OR s.direccion LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY s.id_servicio DESC';

    const services = await db.query(sql, params);
    return res.json({ services });
  } catch (error) {
    console.error('Error al listar servicios:', error);
    return res.status(500).json({ error: 'Error al consultar la lista de servicios' });
  }
});

// GET /api/services/:id - Get single service
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const service = await db.get(
      `SELECT s.*,
              (SELECT COUNT(*) FROM usuarios u WHERE u.id_servicio_asignado = s.id_servicio) as total_personal
       FROM servicios s
       WHERE s.id_servicio = ?`,
      [req.params.id]
    );

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    // Active consignas for this service
    const consignas = await db.query(
      `SELECT c.*, u.nombre_completo as autor_nombre
       FROM consignas c
       LEFT JOIN usuarios u ON c.creado_por = u.id_usuario
       WHERE c.id_servicio = ? AND c.estatus = 'Vigente'
       ORDER BY c.prioridad DESC, c.id_consigna DESC`,
      [req.params.id]
    );

    // Active assigned staff
    const personal = await db.query(
      `SELECT id_usuario, nombre_completo, rol, estatus, telefono, num_empleado_placa
       FROM usuarios
       WHERE id_servicio_asignado = ?`,
      [req.params.id]
    );

    return res.json({ service, consignas, personal });
  } catch (error) {
    console.error('Error al consultar servicio:', error);
    return res.status(500).json({ error: 'Error al obtener los detalles del servicio' });
  }
});

// POST /api/services - Create new service (Admin only)
router.post('/', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    const {
      nombre_cliente_o_lugar,
      tipo_servicio = 'Residencial',
      direccion_calle,
      direccion_numero,
      direccion_colonia,
      direccion_municipio,
      direccion_cp,
      contacto_principal,
      telefono_directo,
      correo_contacto,
      contacto_emergencia,
      instrucciones_iniciales,
      estatus = 'Activo',
      fecha_inicio_contratacion
    } = req.body;

    if (!nombre_cliente_o_lugar) {
      return res.status(400).json({ error: 'El nombre comercial del cliente o inmueble es requerido' });
    }

    // Formatted full address
    const fullDireccion = [
      direccion_calle ? `${direccion_calle} ${direccion_numero || 'S/N'}` : '',
      direccion_colonia ? `Col. ${direccion_colonia}` : '',
      direccion_municipio || '',
      direccion_cp ? `C.P. ${direccion_cp}` : ''
    ].filter(Boolean).join(', ');

    const result = await db.run(
      `INSERT INTO servicios (
        nombre_cliente_o_lugar, tipo_servicio, direccion_calle, direccion_numero,
        direccion_colonia, direccion_municipio, direccion_cp, direccion,
        contacto_principal, telefono_directo, correo_contacto, contacto_emergencia,
        instrucciones_iniciales, estatus, fecha_inicio_contratacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre_cliente_o_lugar.trim(),
        tipo_servicio,
        direccion_calle || null,
        direccion_numero || null,
        direccion_colonia || null,
        direccion_municipio || null,
        direccion_cp || null,
        fullDireccion || null,
        contacto_principal || null,
        telefono_directo || null,
        correo_contacto || null,
        contacto_emergencia || null,
        instrucciones_iniciales || null,
        estatus,
        fecha_inicio_contratacion || new Date().toISOString().split('T')[0]
      ]
    );

    return res.status(201).json({
      message: 'Servicio registrado exitosamente',
      id_servicio: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar servicio:', error);
    return res.status(500).json({ error: 'Error al registrar el servicio' });
  }
});

// PUT /api/services/:id - Update service (Admin only)
router.put('/:id', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    const {
      nombre_cliente_o_lugar,
      tipo_servicio,
      direccion_calle,
      direccion_numero,
      direccion_colonia,
      direccion_municipio,
      direccion_cp,
      contacto_principal,
      telefono_directo,
      correo_contacto,
      contacto_emergencia,
      instrucciones_iniciales,
      estatus,
      fecha_inicio_contratacion
    } = req.body;

    const fullDireccion = [
      direccion_calle ? `${direccion_calle} ${direccion_numero || 'S/N'}` : '',
      direccion_colonia ? `Col. ${direccion_colonia}` : '',
      direccion_municipio || '',
      direccion_cp ? `C.P. ${direccion_cp}` : ''
    ].filter(Boolean).join(', ');

    await db.run(
      `UPDATE servicios SET
        nombre_cliente_o_lugar = ?,
        tipo_servicio = ?,
        direccion_calle = ?,
        direccion_numero = ?,
        direccion_colonia = ?,
        direccion_municipio = ?,
        direccion_cp = ?,
        direccion = ?,
        contacto_principal = ?,
        telefono_directo = ?,
        correo_contacto = ?,
        contacto_emergencia = ?,
        instrucciones_iniciales = ?,
        estatus = ?,
        fecha_inicio_contratacion = ?
      WHERE id_servicio = ?`,
      [
        nombre_cliente_o_lugar.trim(),
        tipo_servicio,
        direccion_calle || null,
        direccion_numero || null,
        direccion_colonia || null,
        direccion_municipio || null,
        direccion_cp || null,
        fullDireccion || null,
        contacto_principal || null,
        telefono_directo || null,
        correo_contacto || null,
        contacto_emergencia || null,
        instrucciones_iniciales || null,
        estatus,
        fecha_inicio_contratacion || null,
        req.params.id
      ]
    );

    return res.json({ message: 'Servicio actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    return res.status(500).json({ error: 'Error al actualizar el servicio' });
  }
});

// DELETE /api/services/:id - Delete service (Admin only)
router.delete('/:id', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    await db.run('DELETE FROM servicios WHERE id_servicio = ?', [req.params.id]);
    return res.json({ message: 'Servicio eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    return res.status(500).json({ error: 'Error al eliminar el servicio' });
  }
});

module.exports = router;
