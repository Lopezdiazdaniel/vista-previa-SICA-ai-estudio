const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sica_seguridad_privada_super_secret_token_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id_usuario: user.id_usuario,
      nombre_completo: user.nombre_completo,
      correo_electronico: user.correo_electronico,
      rol: user.rol,
      id_servicio_asignado: user.id_servicio_asignado,
      num_empleado_placa: user.num_empleado_placa
    },
    JWT_SECRET,
    { expiresIn: '12h' } // Typical shift duration
  );
}

function verifyToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token expirado o inválido' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Standardize comparison
    const userRole = (req.user.rol || '').toLowerCase();
    const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole);

    if (!hasRole) {
      return res.status(403).json({
        error: `Acceso denegado: El rol '${req.user.rol}' no tiene permisos para esta acción`
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  requireRole,
  JWT_SECRET
};
