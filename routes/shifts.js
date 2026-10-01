const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/shifts - List shifts
router.get('/', verifyToken, async (req, res) => {
  try {
    const { id_servicio, id_usuario, activos } = req.query;

    let sql = `
      SELECT t.*,
             u.nombre_completo as nombre_guardia,
             u.num_empleado_placa,
             s.nombre_cliente_o_lugar as nombre_servicio
      FROM asignaciones_turno t
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN servicios s ON t.id_servicio = s.id_servicio
      WHERE 1=1
    `;
    const params = [];

    if (id_servicio) {
      sql += ' AND t.id_servicio = ?';
      params.push(Number(id_servicio));
    }

    if (id_usuario) {
      sql += ' AND t.id_usuario = ?';
      params.push(Number(id_usuario));
    }

    if (activos === 'true') {
      sql += " AND datetime('now', 'localtime') BETWEEN datetime(t.fecha_inicio_turno) AND datetime(t.fecha_fin_turno)";
    }

    sql += ' ORDER BY t.fecha_inicio_turno DESC LIMIT 100';

    const shifts = await db.query(sql, params);
    return res.json({ shifts });
  } catch (error) {
    console.error('Error al listar turnos:', error);
    return res.status(500).json({ error: 'Error al consultar turnos' });
  }
});

// POST /api/shifts - Assign shift (Admin and Supervisor)
router.post('/', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { id_usuario, id_servicio, fecha_inicio_turno, fecha_fin_turno, notas } = req.body;

    if (!id_usuario || !id_servicio || !fecha_inicio_turno || !fecha_fin_turno) {
      return res.status(400).json({ error: 'Usuario, servicio y fechas de inicio/fin de turno son requeridos' });
    }

    const result = await db.run(
      `INSERT INTO asignaciones_turno (id_usuario, id_servicio, fecha_inicio_turno, fecha_fin_turno, notas)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(id_usuario), Number(id_servicio), fecha_inicio_turno, fecha_fin_turno, notas || null]
    );

    // Also update guard's active service pointer
    await db.run('UPDATE usuarios SET id_servicio_asignado = ? WHERE id_usuario = ?', [Number(id_servicio), Number(id_usuario)]);

    return res.status(201).json({
      message: 'Turno asignado exitosamente',
      id_asignacion: result.insertId
    });
  } catch (error) {
    console.error('Error al asignar turno:', error);
    return res.status(500).json({ error: 'Error al programar turno' });
  }
});

// DELETE /api/shifts/:id - Remove shift assignment
router.delete('/:id', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    await db.run('DELETE FROM asignaciones_turno WHERE id_asignacion = ?', [req.params.id]);
    return res.json({ message: 'Turno cancelado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar turno:', error);
    return res.status(500).json({ error: 'Error al eliminar el turno' });
  }
});

module.exports = router;
