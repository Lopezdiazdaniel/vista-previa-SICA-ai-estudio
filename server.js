const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./config/database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const servicesRoutes = require('./routes/services');
const shiftsRoutes = require('./routes/shifts');
const accessRoutes = require('./routes/access');
const logbookRoutes = require('./routes/logbook');
const consignasRoutes = require('./routes/consignas');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON and form bodies
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve evidencias images (access and logbook photos)
app.use('/uploads/evidencias', express.static(path.join(__dirname, 'uploads', 'evidencias')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'SICA - Sistema de Gestión y Control de Acceso',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/consignas', consignasRoutes);
app.use('/api/reports', reportsRoutes);

// Fallback to index.html for Single Page Application navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Error en la carga de archivo: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// Start server after database initialization
async function startServer() {
  try {
    await db.initSchema();
    app.listen(PORT, () => {
      console.log('================================================================');
      console.log(`🛡️  SICA - Sistema de Gestión y Control de Acceso`);
      console.log(`🚀  Servidor activo en: http://localhost:${PORT}`);
      console.log(`📱  PWA y API listas para operar en línea y fuera de línea`);
      console.log('================================================================');
      console.log('Cuentas demo disponibles:');
      console.log(' - Administrador: admin@sica.com      / admin123');
      console.log(' - Supervisor:    supervisor@sica.com / supervisor123');
      console.log(' - Guardia:       guardia@sica.com    / guardia123');
      console.log('================================================================');
    });
  } catch (err) {
    console.error('Error al iniciar el servidor SICA:', err);
    process.exit(1);
  }
}

startServer();
