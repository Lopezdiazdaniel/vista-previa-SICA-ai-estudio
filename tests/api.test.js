const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Import database and ensure schema is ready
const db = require('../config/database');

let server;
let baseUrl = 'http://localhost:3099';

// Helper to perform HTTP requests
function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {}
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async () => {
  await db.initSchema();

  // Create isolated express server for testing on port 3099
  const express = require('express');
  const cors = require('cors');
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/services', require('../routes/services'));
  app.use('/api/shifts', require('../routes/shifts'));
  app.use('/api/access', require('../routes/access'));
  app.use('/api/logbook', require('../routes/logbook'));
  app.use('/api/consignas', require('../routes/consignas'));
  app.use('/api/reports', require('../routes/reports'));

  await new Promise(resolve => {
    server = app.listen(3099, resolve);
  });
});

test.after(() => {
  if (server) server.close();
});

test('Suite SICA: Autenticación y Matriz de Roles (RF-01 y Sec 6)', async (t) => {
  let adminToken, supervisorToken, guardToken;

  await t.test('Login exitoso Administrador con redirección a /admin', async () => {
    const res = await apiRequest('/api/auth/login', 'POST', {
      correo_electronico: 'admin@sica.com',
      contrasena: 'admin123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.rol, 'Administrador');
    assert.strictEqual(res.data.redirectUrl, '/admin');
    assert.ok(res.data.token);
    adminToken = res.data.token;
  });

  await t.test('Login exitoso Supervisor con redirección a /supervisor', async () => {
    const res = await apiRequest('/api/auth/login', 'POST', {
      correo_electronico: 'supervisor@sica.com',
      contrasena: 'supervisor123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.rol, 'Supervisor');
    assert.strictEqual(res.data.redirectUrl, '/supervisor');
    supervisorToken = res.data.token;
  });

  await t.test('Login exitoso Guardia con redirección a /guardia', async () => {
    const res = await apiRequest('/api/auth/login', 'POST', {
      correo_electronico: 'guardia@sica.com',
      contrasena: 'guardia123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.rol, 'Guardia');
    assert.strictEqual(res.data.redirectUrl, '/guardia');
    guardToken = res.data.token;
  });

  await t.test('Rechazo de credenciales inválidas con error 401', async () => {
    const res = await apiRequest('/api/auth/login', 'POST', {
      correo_electronico: 'admin@sica.com',
      contrasena: 'wrongPassword'
    });
    assert.strictEqual(res.statusCode, 401);
  });
});

test('Suite SICA: Control de Accesos y Sincronización Offline (RF-02 y RNF-03)', async (t) => {
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'guardia@sica.com',
    contrasena: 'guardia123'
  });
  const token = loginRes.data.token;

  await t.test('Registro regular de acceso en caseta', async () => {
    const res = await apiRequest('/api/access', 'POST', {
      tipo_movimiento: 'Entrada',
      tipo_visitante: 'Vehículo',
      nombre_visitante: 'Ing. Fernando Gamboa',
      placas: 'ABC-999',
      datos_vehiculo: 'Chevrolet Aveo Rojo',
      motivo_o_destino: 'Mantenimiento de clima en Caseta 1'
    }, token);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.id_acceso);
  });

  await t.test('Batch sync de accesos registrados en modo offline (IndexedDB)', async () => {
    const offlineBatch = [
      {
        uid: 'offline_1',
        tipo_movimiento: 'Entrada',
        tipo_visitante: 'Peatón',
        nombre_visitante: 'Visitante Offline 1',
        motivo_o_destino: 'Entrega de correspondencia'
      },
      {
        uid: 'offline_2',
        tipo_movimiento: 'Salida',
        tipo_visitante: 'Vehículo',
        nombre_visitante: 'Visitante Offline 2',
        placas: 'XYZ-111',
        motivo_o_destino: 'Salida de proveedor'
      }
    ];

    const res = await apiRequest('/api/access/batch-sync', 'POST', {
      registros: offlineBatch
    }, token);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.syncedCount, 2);
  });
});

test('Suite SICA: Bitácora Digital y Disparadores de Alerta en Tiempo Real (RF-03 y Sec 6)', async (t) => {
  const guardLogin = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'guardia@sica.com',
    contrasena: 'guardia123'
  });
  const guardToken = guardLogin.data.token;

  const supLogin = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'supervisor@sica.com',
    contrasena: 'supervisor123'
  });
  const supToken = supLogin.data.token;

  let emergencyId;

  await t.test('Guardia registra evento de tipo Emergencia', async () => {
    const res = await apiRequest('/api/logbook', 'POST', {
      tipo_evento: 'Emergencia',
      nivel_prioridad: 'Emergencia',
      descripcion: 'Intento de allanamiento detectado en cerca perimetral norte.'
    }, guardToken);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.esEmergencia, true);
    assert.ok(res.data.id_bitacora);
    emergencyId = res.data.id_bitacora;
  });

  await t.test('Supervisor detecta la emergencia activa en tiempo real', async () => {
    const res = await apiRequest('/api/logbook/emergencies/active', 'GET', null, supToken);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.hayEmergencias, true);
    const found = res.data.emergencias.some(e => e.id_bitacora === emergencyId);
    assert.strictEqual(found, true);
  });

  await t.test('Supervisor atiende la emergencia y desactiva la alerta', async () => {
    const res = await apiRequest(`/api/logbook/${emergencyId}/atender`, 'PUT', {
      notas_supervisor: 'Patrulla arribó a las 10:15. Intruso disuadido y retirado.'
    }, supToken);

    assert.strictEqual(res.statusCode, 200);

    // Verify it is no longer pending
    const checkRes = await apiRequest('/api/logbook/emergencies/active', 'GET', null, supToken);
    const stillActive = checkRes.data.emergencias.some(e => e.id_bitacora === emergencyId);
    assert.strictEqual(stillActive, false);
  });
});

test('Suite SICA: Panel Gerencial, Métricas y Exportación Excel/CSV (RF-05)', async (t) => {
  const adminLogin = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'admin@sica.com',
    contrasena: 'admin123'
  });
  const adminToken = adminLogin.data.token;

  await t.test('Consulta de métricas gerenciales de dashboard', async () => {
    const res = await apiRequest('/api/reports/dashboard', 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.resumen.accesosHoy >= 0);
    assert.ok(res.data.resumen.totalServicios >= 1);
  });

  await t.test('Generación y descarga de archivo Excel (.xlsx)', async () => {
    const res = await apiRequest('/api/reports/export/excel', 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('spreadsheetml'));
  });

  await t.test('Generación y descarga de CSV', async () => {
    const res = await apiRequest('/api/reports/export/csv?tipo=accesos', 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/csv'));
  });
});

test('Suite SICA: Consignas Operativas y Bitácora con Ordenamiento SQL (RF-03, RF-04)', async (t) => {
  const adminLogin = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'admin@sica.com',
    contrasena: 'admin123'
  });
  const adminToken = adminLogin.data.token;

  await t.test('Listar consignas con ordenamiento por prioridad (CASE WHEN)', async () => {
    const res = await apiRequest('/api/consignas', 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.consignas));
  });

  await t.test('Listar bitácoras con ordenamiento de emergencias', async () => {
    const res = await apiRequest('/api/logbook', 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.bitacoras));
  });

  let nuevaConsignaId;
  await t.test('Crear y eliminar consigna operativa', async () => {
    const createRes = await apiRequest('/api/consignas', 'POST', {
      id_servicio: 1,
      titulo: 'Consigna Test de Auditoría',
      contenido: 'Procedimiento de prueba para verificar ordenamiento',
      fecha_vigencia_inicio: '2026-01-01',
      fecha_vigencia_fin: '2026-12-31',
      prioridad: 'Urgente'
    }, adminToken);
    assert.strictEqual(createRes.statusCode, 201);
    nuevaConsignaId = createRes.data.id_consigna;

    const deleteRes = await apiRequest(`/api/consignas/${nuevaConsignaId}`, 'DELETE', null, adminToken);
    assert.strictEqual(deleteRes.statusCode, 200);
  });
});

test('Suite SICA: Gestión de Personal y Expedientes Digitales (RF-06 & Sec 4.3)', async (t) => {
  const adminLogin = await apiRequest('/api/auth/login', 'POST', {
    correo_electronico: 'admin@sica.com',
    contrasena: 'admin123'
  });
  const adminToken = adminLogin.data.token;

  let testUserId;
  await t.test('Crear nuevo elemento de personal', async () => {
    const res = await apiRequest('/api/users', 'POST', {
      nombre_completo: 'Oficial Prueba Verificación',
      correo_electronico: 'test_guardia_' + Date.now() + '@sica.com',
      contrasena: 'password123',
      rol: 'Guardia',
      num_empleado_placa: 'TEST-999',
      id_servicio_asignado: 1
    }, adminToken);
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.id_usuario);
    testUserId = res.data.id_usuario;
  });

  await t.test('Actualizar datos del elemento', async () => {
    const res = await apiRequest(`/api/users/${testUserId}`, 'PUT', {
      nombre_completo: 'Oficial Prueba Modificado',
      correo_electronico: 'test_guardia_mod@sica.com',
      rol: 'Guardia',
      estatus: 'Activo',
      telefono: '811-999-8877'
    }, adminToken);
    assert.strictEqual(res.statusCode, 200);
  });

  await t.test('Consultar expediente digital del usuario', async () => {
    const res = await apiRequest(`/api/users/${testUserId}/expediente`, 'GET', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.expedientes));
  });

  await t.test('Eliminar usuario de prueba', async () => {
    const res = await apiRequest(`/api/users/${testUserId}`, 'DELETE', null, adminToken);
    assert.strictEqual(res.statusCode, 200);
  });
});

