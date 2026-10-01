const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure destination folders exist
const expedientesDir = path.join(__dirname, '..', 'uploads', 'expedientes');
const evidenciasDir = path.join(__dirname, '..', 'uploads', 'evidencias');

if (!fs.existsSync(expedientesDir)) {
  fs.mkdirSync(expedientesDir, { recursive: true });
}
if (!fs.existsSync(evidenciasDir)) {
  fs.mkdirSync(evidenciasDir, { recursive: true });
}

// Storage for Expedientes (User Dossiers)
const expedienteStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, expedientesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  }
});

// Storage for Evidencias (Access & Logbook photos)
const evidenciaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, evidenciasDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `evidencia_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  }
});

// File filter: only pdf, jpg, jpeg, png
const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato no permitido (${ext}). Solo se admiten archivos .pdf, .jpg, .jpeg, .png`));
  }
};

const uploadExpediente = multer({
  storage: expedienteStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter
});

const uploadEvidencia = multer({
  storage: evidenciaStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter
});

module.exports = {
  uploadExpediente,
  uploadEvidencia,
  expedientesDir,
  evidenciasDir
};
