const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbDriver = null;
let isSQLite = true;

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlitePath = path.join(dataDir, 'sica.db');

// Check if MySQL configuration is provided
const useMySQL = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

if (useMySQL) {
  const mysql = require('mysql2/promise');
  isSQLite = false;
  console.log(`[DB] Conectando a MySQL en ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}...`);
  
  dbDriver = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  // Use Node.js 22+ built-in DatabaseSync
  const { DatabaseSync } = require('node:sqlite');
  console.log(`[DB] Utilizando base de datos relacional integrada SQLite en: ${sqlitePath}`);
  const sqliteDb = new DatabaseSync(sqlitePath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');

  dbDriver = sqliteDb;
}

// Convert parameterized query if needed
function normalizeSql(sql) {
  // SQLite and MySQL both use ? for parameter markers in standard prepared statements
  return sql;
}

async function query(sql, params = []) {
  if (isSQLite) {
    const stmt = dbDriver.prepare(normalizeSql(sql));
    const rows = stmt.all(...params);
    return rows;
  } else {
    const [rows] = await dbDriver.query(sql, params);
    return rows;
  }
}

async function get(sql, params = []) {
  if (isSQLite) {
    const stmt = dbDriver.prepare(normalizeSql(sql));
    const row = stmt.get(...params);
    return row || null;
  } else {
    const [rows] = await dbDriver.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}

async function run(sql, params = []) {
  if (isSQLite) {
    const stmt = dbDriver.prepare(normalizeSql(sql));
    const result = stmt.run(...params);
    return {
      insertId: Number(result.lastInsertRowid),
      affectedRows: result.changes,
      changes: result.changes
    };
  } else {
    const [result] = await dbDriver.execute(sql, params);
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
      changes: result.affectedRows
    };
  }
}

async function exec(sql) {
  if (isSQLite) {
    dbDriver.exec(sql);
  } else {
    await dbDriver.query(sql);
  }
}

// Initialize tables in SQLite if not existing
async function initSchema() {
  if (isSQLite) {
    dbDriver.exec(`
      CREATE TABLE IF NOT EXISTS servicios (
        id_servicio INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_cliente_o_lugar TEXT NOT NULL,
        tipo_servicio TEXT NOT NULL DEFAULT 'Residencial',
        direccion_calle TEXT,
        direccion_numero TEXT,
        direccion_colonia TEXT,
        direccion_municipio TEXT,
        direccion_cp TEXT,
        direccion TEXT,
        contacto_principal TEXT,
        telefono_directo TEXT,
        correo_contacto TEXT,
        contacto_emergencia TEXT,
        instrucciones_iniciales TEXT,
        estatus TEXT NOT NULL DEFAULT 'Activo',
        fecha_inicio_contratacion TEXT,
        fecha_creacion DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_completo TEXT NOT NULL,
        correo_electronico TEXT NOT NULL UNIQUE,
        contrasena_hash TEXT NOT NULL,
        rol TEXT NOT NULL,
        estatus TEXT NOT NULL DEFAULT 'Activo',
        curp TEXT,
        telefono TEXT,
        num_empleado_placa TEXT,
        id_servicio_asignado INTEGER,
        fecha_alta TEXT,
        fecha_creacion DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (id_servicio_asignado) REFERENCES servicios(id_servicio) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS expedientes (
        id_expediente INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario INTEGER NOT NULL,
        tipo_documento TEXT NOT NULL,
        nombre_archivo TEXT NOT NULL,
        ruta_archivo TEXT NOT NULL,
        tamano_bytes INTEGER,
        estatus_validacion TEXT DEFAULT 'Pendiente',
        fecha_subida DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS asignaciones_turno (
        id_asignacion INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario INTEGER NOT NULL,
        id_servicio INTEGER NOT NULL,
        fecha_inicio_turno DATETIME NOT NULL,
        fecha_fin_turno DATETIME NOT NULL,
        notas TEXT,
        creado_en DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS accesos (
        id_acceso INTEGER PRIMARY KEY AUTOINCREMENT,
        id_servicio INTEGER NOT NULL,
        id_guardia INTEGER NOT NULL,
        tipo_movimiento TEXT NOT NULL,
        tipo_visitante TEXT NOT NULL,
        nombre_visitante TEXT NOT NULL,
        identificacion_tipo TEXT,
        identificacion_num TEXT,
        datos_vehiculo TEXT,
        placas TEXT,
        motivo_o_destino TEXT,
        fotografia_evidencia TEXT,
        fecha_hora DATETIME DEFAULT (datetime('now', 'localtime')),
        observaciones TEXT,
        sincronizado_offline INTEGER DEFAULT 0,
        FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
        FOREIGN KEY (id_guardia) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bitacoras (
        id_bitacora INTEGER PRIMARY KEY AUTOINCREMENT,
        id_servicio INTEGER NOT NULL,
        id_guardia INTEGER NOT NULL,
        tipo_evento TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        fotografia_adjunta TEXT,
        nivel_prioridad TEXT DEFAULT 'Baja',
        atendida_supervisor INTEGER DEFAULT 0,
        fecha_hora_registro DATETIME DEFAULT (datetime('now', 'localtime')),
        fecha_atencion DATETIME,
        notas_supervisor TEXT,
        FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
        FOREIGN KEY (id_guardia) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS consignas (
        id_consigna INTEGER PRIMARY KEY AUTOINCREMENT,
        id_servicio INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        contenido TEXT NOT NULL,
        fecha_vigencia_inicio TEXT NOT NULL,
        fecha_vigencia_fin TEXT NOT NULL,
        creado_por INTEGER NOT NULL,
        prioridad TEXT DEFAULT 'Normal',
        estatus TEXT DEFAULT 'Vigente',
        fecha_creacion DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
        FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      );
    `);
  }

  // Seed default data if users table is empty
  await seedInitialData();
}

async function seedInitialData() {
  const adminUser = await get("SELECT id_usuario FROM usuarios WHERE correo_electronico = ?", ['admin@sica.com']);
  if (adminUser) {
    return; // Already seeded
  }

  console.log('[DB] Inicializando datos demo para SICA (Administrador, Supervisor, Guardia, Servicios y Consignas)...');

  // Password hashes:
  // admin@sica.com / admin123
  // supervisor@sica.com / supervisor123
  // guardia@sica.com / guardia123
  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashSupervisor = await bcrypt.hash('supervisor123', 10);
  const hashGuardia1 = await bcrypt.hash('guardia123', 10);
  const hashGuardia2 = await bcrypt.hash('guardia123', 10);

  // 1. Inmuebles / Casetas
  const serv1 = await run(`
    INSERT INTO servicios (
      nombre_cliente_o_lugar, tipo_servicio, direccion_calle, direccion_numero,
      direccion_colonia, direccion_municipio, direccion_cp, direccion,
      contacto_principal, telefono_directo, correo_contacto, contacto_emergencia,
      instrucciones_iniciales, estatus, fecha_inicio_contratacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Parque Industrial Norte - Caseta Principal',
    'Industrial',
    'Av. de la Industria',
    '500',
    'Zona Industrial',
    'Monterrey',
    '64000',
    'Av. de la Industria #500, Zona Industrial, Monterrey, C.P. 64000',
    'Ing. Roberto Garza',
    '8112345678',
    'rgarza@industrialnorte.com',
    '911 / Seguridad Interna Ext. 101',
    'Revisión obligatoria de cajuelas a todo vehículo de carga. Solicitud de EPP en accesos peatonales.',
    'Activo',
    '2026-01-15'
  ]);

  const serv2 = await run(`
    INSERT INTO servicios (
      nombre_cliente_o_lugar, tipo_servicio, direccion_calle, direccion_numero,
      direccion_colonia, direccion_municipio, direccion_cp, direccion,
      contacto_principal, telefono_directo, correo_contacto, contacto_emergencia,
      instrucciones_iniciales, estatus, fecha_inicio_contratacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Residencial Los Pinos - Acceso Principal',
    'Residencial',
    'Paseo de los Pinos',
    '120',
    'Col. Bosques del Valle',
    'San Pedro',
    '66220',
    'Paseo de los Pinos #120, Col. Bosques del Valle, San Pedro, C.P. 66220',
    'Lic. Patricia Morales (Administradora)',
    '8187654321',
    'admin@lospinos.com',
    'Vigilancia Privada Móvil (811-999-0000)',
    'Todo visitante debe identificarse con INE vigente y confirmar con el residente antes de aperturar pluma vehicular.',
    'Activo',
    '2026-02-01'
  ]);

  const serv3 = await run(`
    INSERT INTO servicios (
      nombre_cliente_o_lugar, tipo_servicio, direccion_calle, direccion_numero,
      direccion_colonia, direccion_municipio, direccion_cp, direccion,
      contacto_principal, telefono_directo, correo_contacto, contacto_emergencia,
      instrucciones_iniciales, estatus, fecha_inicio_contratacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Torre Corporativa Reforma 222',
    'Corporativo',
    'Paseo de la Reforma',
    '222',
    'Juárez',
    'Cuauhtémoc',
    '06600',
    'Paseo de la Reforma #222, Juárez, Cuauhtémoc, CDMX, C.P. 06600',
    'Mtro. Carlos Slim V.',
    '5551239876',
    'seguridad@reforma222.com',
    'Protección Civil Torre (555-432-1111)',
    'Gafete visible en todo momento. Prohibido el ingreso de repartidores a elevadores ejecutivos.',
    'Activo',
    '2026-03-01'
  ]);

  // 2. Usuarios
  // Admin
  await run(`
    INSERT INTO usuarios (
      nombre_completo, correo_electronico, contrasena_hash, rol, estatus,
      curp, telefono, num_empleado_placa, fecha_alta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Lic. Alejandro Morales (Director de Operaciones)',
    'admin@sica.com',
    hashAdmin,
    'Administrador',
    'Activo',
    'MORA850101HNL001',
    '8110001122',
    'DIR-001',
    '2025-01-01'
  ]);

  // Supervisor
  const sup = await run(`
    INSERT INTO usuarios (
      nombre_completo, correo_electronico, contrasena_hash, rol, estatus,
      curp, telefono, num_empleado_placa, id_servicio_asignado, fecha_alta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Cmdte. Fernando Valdez (Supervisor Zona Norte)',
    'supervisor@sica.com',
    hashSupervisor,
    'Supervisor',
    'Activo',
    'VALF800512HNL002',
    '8115554433',
    'SUP-104',
    serv1.insertId,
    '2025-03-10'
  ]);

  // Guardia 1 (Asignado al Parque Industrial)
  const g1 = await run(`
    INSERT INTO usuarios (
      nombre_completo, correo_electronico, contrasena_hash, rol, estatus,
      curp, telefono, num_empleado_placa, id_servicio_asignado, fecha_alta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Oficial Juan Manuel Pérez',
    'guardia@sica.com',
    hashGuardia1,
    'Guardia',
    'Activo',
    'PERJ920405HNL003',
    '8123337788',
    'GDA-501',
    serv1.insertId,
    '2025-05-20'
  ]);

  // Guardia 2 (Asignado a Residencial Los Pinos)
  const g2 = await run(`
    INSERT INTO usuarios (
      nombre_completo, correo_electronico, contrasena_hash, rol, estatus,
      curp, telefono, num_empleado_placa, id_servicio_asignado, fecha_alta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Oficial María Estela Hernández',
    'guardia2@sica.com',
    hashGuardia2,
    'Guardia',
    'Activo',
    'HERM941118MNL004',
    '8129996655',
    'GDA-502',
    serv2.insertId,
    '2025-08-01'
  ]);

  // 3. Asignaciones de turno
  await run(`
    INSERT INTO asignaciones_turno (id_usuario, id_servicio, fecha_inicio_turno, fecha_fin_turno, notas)
    VALUES (?, ?, datetime('now', 'start of day', '+6 hours'), datetime('now', 'start of day', '+18 hours'), ?)
  `, [g1.insertId, serv1.insertId, 'Turno matutino 12x12 - Control de acceso vehiculos pesados']);

  await run(`
    INSERT INTO asignaciones_turno (id_usuario, id_servicio, fecha_inicio_turno, fecha_fin_turno, notas)
    VALUES (?, ?, datetime('now', 'start of day', '+6 hours'), datetime('now', 'start of day', '+18 hours'), ?)
  `, [g2.insertId, serv2.insertId, 'Turno matutino 12x12 - Caseta peatonal y vehicular Los Pinos']);

  // 4. Consignas Operativas
  await run(`
    INSERT INTO consignas (id_servicio, titulo, contenido, fecha_vigencia_inicio, fecha_vigencia_fin, creado_por, prioridad, estatus)
    VALUES (?, ?, ?, '2026-01-01', '2026-12-31', 1, 'Urgente', 'Vigente')
  `, [
    serv1.insertId,
    'Protocolo de Revisión a Transportistas y EPP',
    'Queda estrictamente prohibido permitir el acceso a patios a transportistas que no cuenten con casco, chaleco reflejante y botas de casquillo. Registrar número de placa del tracto y del remolque.',
  ]);

  await run(`
    INSERT INTO consignas (id_servicio, titulo, contenido, fecha_vigencia_inicio, fecha_vigencia_fin, creado_por, prioridad, estatus)
    VALUES (?, ?, ?, '2026-02-01', '2026-12-31', 1, 'Alta', 'Vigente')
  `, [
    serv2.insertId,
    'Control de Proveedores de Mudanza y Mantenimiento',
    'Las mudanzas y trabajos ruidosos solo están permitidos de lunes a viernes de 09:00 a 18:00 hrs. Los sábados de 09:00 a 13:00 hrs. Domingos terminantemente prohibido.',
  ]);

  // 5. Accesos de Muestra
  await run(`
    INSERT INTO accesos (id_servicio, id_guardia, tipo_movimiento, tipo_visitante, nombre_visitante, identificacion_tipo, identificacion_num, datos_vehiculo, placas, motivo_o_destino, observaciones)
    VALUES (?, ?, 'Entrada', 'Vehículo', 'Ing. Carlos Mendoza (DHL Express)', 'INE', 'ID-MEX-98124', 'Camioneta Ford Transit Blanca', 'NL-548-P', 'Entrega de refacciones a Almacén B', 'Documentos en regla')
  `, [serv1.insertId, g1.insertId]);

  await run(`
    INSERT INTO accesos (id_servicio, id_guardia, tipo_movimiento, tipo_visitante, nombre_visitante, identificacion_tipo, identificacion_num, datos_vehiculo, placas, motivo_o_destino, observaciones)
    VALUES (?, ?, 'Entrada', 'Peatón', 'Sra. Lucia Morales', 'INE', 'ID-MEX-11234', 'N/A', 'N/A', 'Visita a Lote 45 (Familia Santos)', 'Autorizado por llamada del residente')
  `, [serv2.insertId, g2.insertId]);

  // 6. Bitácora de Muestra
  await run(`
    INSERT INTO bitacoras (id_servicio, id_guardia, tipo_evento, descripcion, nivel_prioridad, atendida_supervisor)
    VALUES (?, ?, 'Rondín', 'Rondín perimetral de las 08:00 hrs completado sin anomalías. Cercado eléctrico y luminarias funcionando adecuadamente.', 'Baja', 1)
  `, [serv1.insertId, g1.insertId]);

  await run(`
    INSERT INTO bitacoras (id_servicio, id_guardia, tipo_evento, descripcion, nivel_prioridad, atendida_supervisor)
    VALUES (?, ?, 'Novedad Menor', 'Se presenta proveedor de agua purificada fuera de horario habitual. Se autoriza acceso con previo visto bueno de administración.', 'Media', 1)
  `, [serv2.insertId, g2.insertId]);

  console.log('[DB] Inicialización completada con éxito.');
}

module.exports = {
  query,
  get,
  run,
  exec,
  initSchema,
  isSQLite
};
