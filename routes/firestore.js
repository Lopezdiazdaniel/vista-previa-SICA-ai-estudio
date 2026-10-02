const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const firestoreService = require('../config/firestore');

// GET /api/firestore/config - Return client-safe Firebase config
router.get('/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: 'Configuración de Firebase no encontrada' });
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/firestore/status - Check Firestore connectivity and stats
router.get('/status', async (req, res) => {
  try {
    const testResult = await firestoreService.testConnection();
    return res.json({
      connected: testResult.ok,
      message: testResult.message,
      projectId: firestoreService.firebaseConfig.projectId,
      firestoreDatabaseId: firestoreService.firebaseConfig.firestoreDatabaseId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});

// GET /api/firestore/initial-data - Get all system data formatted for Firestore seeding
router.get('/initial-data', async (req, res) => {
  try {
    const servicios = await db.query('SELECT * FROM servicios');
    const usuarios = await db.query('SELECT * FROM usuarios');
    const accesos = await db.query('SELECT * FROM accesos ORDER BY id_acceso DESC LIMIT 50');
    const bitacoras = await db.query('SELECT * FROM bitacoras ORDER BY id_bitacora DESC LIMIT 50');
    const consignas = await db.query('SELECT * FROM consignas ORDER BY id_consigna DESC');
    const turnos = await db.query('SELECT * FROM asignaciones_turno');

    return res.json({
      servicios,
      usuarios: usuarios.map(u => {
        const { contrasena_hash, ...safe } = u;
        return safe;
      }),
      accesos,
      bitacoras,
      consignas,
      asignaciones_turno: turnos
    });
  } catch (err) {
    console.error('Error fetching initial data for Firestore:', err);
    return res.status(500).json({ error: 'Error al preparar datos de inicialización' });
  }
});

module.exports = router;
