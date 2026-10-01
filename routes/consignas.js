const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/consignas - List consignas
router.get('/', verifyToken, async (req, res) => {
  try {
    const { id_servicio, estatus, vigentes } = req.query;

    let sql = `
      SELECT c.*,
             s.nombre_cliente_o_lugar as nombre_servicio,
             u.nombre_completo as nombre_creador
      FROM consignas c
      LEFT JOIN servicios s ON c.id_servicio = s.id_servicio
      LEFT JOIN usuarios u ON c.creado_por = u.id_usuario
      WHERE 1=1
    `;
    const params = [];

    // If Guard, restrict to assigned service
    if (req.user.rol === 'Guardia') {
      if (req.user.id_servicio_asignado) {
        sql += ' AND c.id_servicio = ?';
        params.push(req.user.id_servicio_asignado);
      } else {
        return res.json({ consignas: [] });
      }
    } else if (id_servicio) {
      sql += ' AND c.id_servicio = ?';
      params.push(Number(id_servicio));
    }

    if (estatus) {
      sql += ' AND c.estatus = ?';
      params.push(estatus);
    }

    if (vigentes === 'true' || req.user.rol === 'Guardia') {
      sql += " AND c.estatus = 'Vigente' AND date('now', 'localtime') BETWEEN date(c.fecha_vigencia_inicio) AND date(c.fecha_vigencia_fin)";
    }

    sql += " ORDER BY CASE c.prioridad WHEN 'Urgente' THEN 1 WHEN 'Alta' THEN 2 ELSE 3 END, c.id_consigna DESC";

    const consignas = await db.query(sql, params);
    return res.json({ consignas });
  } catch (error) {
    console.error('Error al listar consignas:', error);
    return res.status(500).json({ error: 'Error al consultar consignas' });
  }
});

// POST /api/consignas - Create consigna (Admin and Supervisor)
router.post('/', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const {
      id_servicio,
      titulo,
      contenido,
      fecha_vigencia_inicio,
      fecha_vigencia_fin,
      prioridad = 'Normal',
      estatus = 'Vigente'
    } = req.body;

    if (!id_servicio || !titulo || !contenido || !fecha_vigencia_inicio || !fecha_vigencia_fin) {
      return res.status(400).json({ error: 'Servicio, título, contenido y fechas de vigencia son obligatorios' });
    }

    const result = await db.run(
      `INSERT INTO consignas (
        id_servicio, titulo, contenido, fecha_vigencia_inicio,
        fecha_vigencia_fin, creado_por, prioridad, estatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(id_servicio),
        titulo.trim(),
        contenido.trim(),
        fecha_vigencia_inicio,
        fecha_vigencia_fin,
        req.user.id_usuario,
        prioridad,
        estatus
      ]
    );

    return res.status(201).json({
      message: 'Consigna operativa publicada exitosamente',
      id_consigna: result.insertId
    });
  } catch (error) {
    console.error('Error al crear consigna:', error);
    return res.status(500).json({ error: 'Error al registrar la consigna' });
  }
});

// PUT /api/consignas/:id - Update consigna (Admin and Supervisor)
router.put('/:id', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const {
      id_servicio,
      titulo,
      contenido,
      fecha_vigencia_inicio,
      fecha_vigencia_fin,
      prioridad,
      estatus
    } = req.body;

    await db.run(
      `UPDATE consignas SET
        id_servicio = ?,
        titulo = ?,
        contenido = ?,
        fecha_vigencia_inicio = ?,
        fecha_vigencia_fin = ?,
        prioridad = ?,
        estatus = ?
      WHERE id_consigna = ?`,
      [
        Number(id_servicio),
        titulo.trim(),
        contenido.trim(),
        fecha_vigencia_inicio,
        fecha_vigencia_fin,
        prioridad,
        estatus,
        req.params.id
      ]
    );

    return res.json({ message: 'Consigna actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar consigna:', error);
    return res.status(500).json({ error: 'Error al actualizar la consigna' });
  }
});

// DELETE /api/consignas/:id - Delete consigna (Admin only)
router.delete('/:id', verifyToken, requireRole('Administrador'), async (req, res) => {
  try {
    await db.run('DELETE FROM consignas WHERE id_consigna = ?', [req.params.id]);
    return res.json({ message: 'Consigna eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar consigna:', error);
    return res.status(500).json({ error: 'Error al eliminar consigna' });
  }
});

module.exports = router;
