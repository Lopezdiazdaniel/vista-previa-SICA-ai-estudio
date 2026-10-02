const path = require('path');
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocFromServer
} = require('firebase/firestore');

// Load Firebase configuration
const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
let firebaseConfig = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, pathStr) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path: pathStr
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, message: 'Conexión a Firestore verificada correctamente' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, error: 'Cliente Firestore fuera de línea' };
    }
    // Connected to server even if doc does not exist
    return { ok: true, message: 'Conectado a Firestore' };
  }
}

// Seed initial SICA collections into Firestore from database
async function seedFirestoreCollections(databaseModule) {
  const results = {
    servicios: 0,
    usuarios: 0,
    accesos: 0,
    bitacoras: 0,
    consignas: 0,
    asignaciones_turno: 0
  };

  try {
    // 1. Servicios
    const servicios = await databaseModule.query('SELECT * FROM servicios');
    for (const serv of servicios) {
      const docId = String(serv.id_servicio);
      await setDoc(doc(db, 'servicios', docId), {
        id_servicio: serv.id_servicio,
        nombre_cliente_o_lugar: serv.nombre_cliente_o_lugar || '',
        tipo_servicio: serv.tipo_servicio || 'Residencial',
        direccion_calle: serv.direccion_calle || '',
        direccion_numero: serv.direccion_numero || '',
        direccion_colonia: serv.direccion_colonia || '',
        direccion_municipio: serv.direccion_municipio || '',
        direccion_cp: serv.direccion_cp || '',
        direccion: serv.direccion || '',
        contacto_principal: serv.contacto_principal || '',
        telefono_directo: serv.telefono_directo || '',
        correo_contacto: serv.correo_contacto || '',
        contacto_emergencia: serv.contacto_emergencia || '',
        instrucciones_iniciales: serv.instrucciones_iniciales || '',
        estatus: serv.estatus || 'Activo',
        fecha_inicio_contratacion: serv.fecha_inicio_contratacion || '',
        fecha_creacion: serv.fecha_creacion || new Date().toISOString()
      }, { merge: true });
      results.servicios++;
    }

    // 2. Usuarios
    const usuarios = await databaseModule.query('SELECT * FROM usuarios');
    for (const usr of usuarios) {
      const docId = String(usr.id_usuario);
      await setDoc(doc(db, 'usuarios', docId), {
        id_usuario: usr.id_usuario,
        nombre_completo: usr.nombre_completo || '',
        correo_electronico: usr.correo_electronico || '',
        contrasena_hash: usr.contrasena_hash || '',
        rol: usr.rol || 'Guardia',
        estatus: usr.estatus || 'Activo',
        curp: usr.curp || '',
        telefono: usr.telefono || '',
        num_empleado_placa: usr.num_empleado_placa || '',
        id_servicio_asignado: usr.id_servicio_asignado || null,
        fecha_alta: usr.fecha_alta || '',
        fecha_creacion: usr.fecha_creacion || new Date().toISOString()
      }, { merge: true });
      results.usuarios++;
    }

    // 3. Accesos
    const accesos = await databaseModule.query('SELECT * FROM accesos');
    for (const acc of accesos) {
      const docId = String(acc.id_acceso);
      await setDoc(doc(db, 'accesos', docId), {
        id_acceso: acc.id_acceso,
        id_servicio: acc.id_servicio,
        id_guardia: acc.id_guardia,
        tipo_movimiento: acc.tipo_movimiento,
        tipo_visitante: acc.tipo_visitante,
        nombre_visitante: acc.nombre_visitante,
        identificacion_tipo: acc.identificacion_tipo || '',
        identificacion_num: acc.identificacion_num || '',
        datos_vehiculo: acc.datos_vehiculo || '',
        placas: acc.placas || '',
        motivo_o_destino: acc.motivo_o_destino || '',
        fotografia_evidencia: acc.fotografia_evidencia || '',
        fecha_hora: acc.fecha_hora || new Date().toISOString(),
        observaciones: acc.observaciones || '',
        sincronizado_offline: acc.sincronizado_offline || 0
      }, { merge: true });
      results.accesos++;
    }

    // 4. Bitácoras
    const bitacoras = await databaseModule.query('SELECT * FROM bitacoras');
    for (const bit of bitacoras) {
      const docId = String(bit.id_bitacora);
      await setDoc(doc(db, 'bitacoras', docId), {
        id_bitacora: bit.id_bitacora,
        id_servicio: bit.id_servicio,
        id_guardia: bit.id_guardia,
        tipo_evento: bit.tipo_evento,
        descripcion: bit.descripcion,
        fotografia_adjunta: bit.fotografia_adjunta || '',
        nivel_prioridad: bit.nivel_prioridad || 'Baja',
        atendida_supervisor: bit.atendida_supervisor ? 1 : 0,
        fecha_hora_registro: bit.fecha_hora_registro || new Date().toISOString(),
        fecha_atencion: bit.fecha_atencion || '',
        notas_supervisor: bit.notas_supervisor || ''
      }, { merge: true });
      results.bitacoras++;
    }

    // 5. Consignas
    const consignas = await databaseModule.query('SELECT * FROM consignas');
    for (const cons of consignas) {
      const docId = String(cons.id_consigna);
      await setDoc(doc(db, 'consignas', docId), {
        id_consigna: cons.id_consigna,
        id_servicio: cons.id_servicio,
        titulo: cons.titulo,
        contenido: cons.contenido,
        fecha_vigencia_inicio: cons.fecha_vigencia_inicio,
        fecha_vigencia_fin: cons.fecha_vigencia_fin,
        creado_por: cons.creado_por,
        prioridad: cons.prioridad || 'Normal',
        estatus: cons.estatus || 'Vigente',
        fecha_creacion: cons.fecha_creacion || new Date().toISOString()
      }, { merge: true });
      results.consignas++;
    }

    // 6. Asignaciones de turno
    const turnos = await databaseModule.query('SELECT * FROM asignaciones_turno');
    for (const t of turnos) {
      const docId = String(t.id_asignacion);
      await setDoc(doc(db, 'asignaciones_turno', docId), {
        id_asignacion: t.id_asignacion,
        id_usuario: t.id_usuario,
        id_servicio: t.id_servicio,
        fecha_inicio_turno: t.fecha_inicio_turno,
        fecha_fin_turno: t.fecha_fin_turno,
        notas: t.notas || '',
        creado_en: t.creado_en || new Date().toISOString()
      }, { merge: true });
      results.asignaciones_turno++;
    }

    console.log('[Firestore] Sincronización exitosa con Firestore:', results);
    return { ok: true, results };
  } catch (error) {
    console.error('[Firestore] Error al sincronizar colecciones:', error);
    return { ok: false, error: error.message };
  }
}

// Get collection summary and document counts
async function getFirestoreStats() {
  const collectionsList = ['servicios', 'usuarios', 'accesos', 'bitacoras', 'consignas', 'asignaciones_turno'];
  const stats = {};

  for (const colName of collectionsList) {
    try {
      const snap = await getDocs(collection(db, colName));
      stats[colName] = snap.size;
    } catch (err) {
      stats[colName] = 0;
    }
  }

  return {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    collections: stats,
    connected: true
  };
}

// Get all documents in a collection
async function getCollectionDocs(collectionName) {
  try {
    const snap = await getDocs(collection(db, collectionName));
    const items = [];
    snap.forEach((d) => items.push({ _docId: d.id, ...d.data() }));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

// Upsert a document into Firestore
async function upsertDoc(collectionName, docId, data) {
  try {
    const ref = doc(db, collectionName, String(docId));
    await setDoc(ref, data, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

// Delete a document from Firestore
async function removeDoc(collectionName, docId) {
  try {
    const ref = doc(db, collectionName, String(docId));
    await deleteDoc(ref);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${docId}`);
  }
}

module.exports = {
  db,
  firebaseConfig,
  testConnection,
  seedFirestoreCollections,
  getFirestoreStats,
  getCollectionDocs,
  upsertDoc,
  removeDoc,
  OperationType,
  handleFirestoreError
};
