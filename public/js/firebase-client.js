/**
 * SICA - Integración Cliente de Firebase Firestore & Google Auth
 * Configurado según la especificación de Firebase Integration RPC
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

let app = null;
let db = null;
let auth = null;
let currentAuthUser = null;
let isInitialized = false;

// Context-aware error handling conforming to FirestoreErrorInfo
function handleFirestoreError(error, operationType, pathStr) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path: pathStr
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore server
async function testConnection() {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Conexión establecida con éxito con el servidor.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Server responded
    return true;
  }
}

// Initialize Firebase using server config endpoint
async function initFirebase() {
  if (isInitialized) return { db, auth };

  try {
    const res = await fetch('/api/firestore/config');
    if (!res.ok) throw new Error('No se pudo obtener la configuración de Firebase');
    const firebaseConfig = await res.json();

    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);

const OWNER_EMAIL = 'lopzcecy@gmail.com';

    onAuthStateChanged(auth, async (user) => {
      if (user && user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        console.warn(`[Firestore Auth] Usuario no autorizado: ${user.email}. Cerrando sesión.`);
        await signOut(auth);
        currentAuthUser = null;
        window.dispatchEvent(new CustomEvent('sica:firebase-auth-changed', { detail: { user: null } }));
        return;
      }
      currentAuthUser = user;
      window.dispatchEvent(new CustomEvent('sica:firebase-auth-changed', { detail: { user } }));
    });

    await testConnection();
    isInitialized = true;
    console.log('[Firestore] Inicializado correctamente en base de datos:', firebaseConfig.firestoreDatabaseId);
    return { db, auth };
  } catch (err) {
    console.error('[Firestore] Error al inicializar Firebase:', err);
    throw err;
  }
}

// Google Sign-In with popup strictly restricted to owner
async function loginWithGoogle() {
  if (!auth) await initFirebase();
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      login_hint: OWNER_EMAIL
    });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      await signOut(auth);
      currentAuthUser = null;
      throw new Error(`Acceso denegado: Esta base de datos pertenece exclusivamente a la cuenta de ${OWNER_EMAIL}. La cuenta seleccionada (${user.email}) no tiene acceso.`);
    }

    currentAuthUser = user;
    return user;
  } catch (err) {
    console.error('[Firestore Auth] Error al autenticar con Google:', err);
    throw err;
  }
}

// Sign out
async function logoutGoogle() {
  if (!auth) return;
  await signOut(auth);
  currentAuthUser = null;
}

// Seed all SICA collections into Firestore from API
async function seedAllToFirestore(onProgress) {
  if (!db) await initFirebase();
  const pathForWrite = 'servicios';

  try {
    const res = await fetch('/api/firestore/initial-data');
    if (!res.ok) throw new Error('No se pudieron obtener los datos iniciales del sistema');
    const data = await res.json();

    const summary = {
      servicios: 0,
      usuarios: 0,
      consignas: 0,
      accesos: 0,
      bitacoras: 0,
      asignaciones_turno: 0
    };

    // 1. Servicios
    if (data.servicios && data.servicios.length > 0) {
      if (onProgress) onProgress('Guardando servicios e inmuebles en Firestore...');
      for (const item of data.servicios) {
        const docRef = doc(db, 'servicios', String(item.id_servicio));
        await setDoc(docRef, {
          id_servicio: item.id_servicio,
          nombre_cliente_o_lugar: item.nombre_cliente_o_lugar,
          tipo_servicio: item.tipo_servicio || 'Residencial',
          direccion: item.direccion || '',
          contacto_principal: item.contacto_principal || '',
          telefono_directo: item.telefono_directo || '',
          correo_contacto: item.correo_contacto || '',
          contacto_emergencia: item.contacto_emergencia || '',
          instrucciones_iniciales: item.instrucciones_iniciales || '',
          estatus: item.estatus || 'Activo',
          fecha_inicio_contratacion: item.fecha_inicio_contratacion || '',
          fecha_creacion: item.fecha_creacion || new Date().toISOString()
        }, { merge: true });
        summary.servicios++;
      }
    }

    // 2. Consignas
    if (data.consignas && data.consignas.length > 0) {
      if (onProgress) onProgress('Guardando consignas operativas...');
      for (const item of data.consignas) {
        const docRef = doc(db, 'consignas', String(item.id_consigna));
        await setDoc(docRef, {
          id_consigna: item.id_consigna,
          id_servicio: item.id_servicio,
          titulo: item.titulo,
          contenido: item.contenido,
          fecha_vigencia_inicio: item.fecha_vigencia_inicio,
          fecha_vigencia_fin: item.fecha_vigencia_fin,
          creado_por: item.creado_por || 1,
          prioridad: item.prioridad || 'Normal',
          estatus: item.estatus || 'Vigente',
          fecha_creacion: item.fecha_creacion || new Date().toISOString()
        }, { merge: true });
        summary.consignas++;
      }
    }

    // 3. Accesos
    if (data.accesos && data.accesos.length > 0) {
      if (onProgress) onProgress('Guardando registros de acceso vehicular/peatonal...');
      for (const item of data.accesos) {
        const docRef = doc(db, 'accesos', String(item.id_acceso));
        await setDoc(docRef, {
          id_acceso: item.id_acceso,
          id_servicio: item.id_servicio,
          id_guardia: item.id_guardia,
          tipo_movimiento: item.tipo_movimiento,
          tipo_visitante: item.tipo_visitante,
          nombre_visitante: item.nombre_visitante,
          identificacion_tipo: item.identificacion_tipo || '',
          identificacion_num: item.identificacion_num || '',
          datos_vehiculo: item.datos_vehiculo || '',
          placas: item.placas || '',
          motivo_o_destino: item.motivo_o_destino || '',
          fotografia_evidencia: item.fotografia_evidencia || '',
          fecha_hora: item.fecha_hora || new Date().toISOString(),
          observaciones: item.observaciones || '',
          sincronizado_offline: item.sincronizado_offline || 0
        }, { merge: true });
        summary.accesos++;
      }
    }

    // 4. Bitácoras
    if (data.bitacoras && data.bitacoras.length > 0) {
      if (onProgress) onProgress('Guardando novedades y eventos de bitácora...');
      for (const item of data.bitacoras) {
        const docRef = doc(db, 'bitacoras', String(item.id_bitacora));
        await setDoc(docRef, {
          id_bitacora: item.id_bitacora,
          id_servicio: item.id_servicio,
          id_guardia: item.id_guardia,
          tipo_evento: item.tipo_evento,
          descripcion: item.descripcion,
          fotografia_adjunta: item.fotografia_adjunta || '',
          nivel_prioridad: item.nivel_prioridad || 'Baja',
          atendida_supervisor: item.atendida_supervisor ? 1 : 0,
          fecha_hora_registro: item.fecha_hora_registro || new Date().toISOString(),
          fecha_atencion: item.fecha_atencion || '',
          notas_supervisor: item.notas_supervisor || ''
        }, { merge: true });
        summary.bitacoras++;
      }
    }

    // 5. Asignaciones de turno
    if (data.asignaciones_turno && data.asignaciones_turno.length > 0) {
      if (onProgress) onProgress('Guardando cuadrantes de turno...');
      for (const item of data.asignaciones_turno) {
        const docRef = doc(db, 'asignaciones_turno', String(item.id_asignacion));
        await setDoc(docRef, {
          id_asignacion: item.id_asignacion,
          id_usuario: item.id_usuario,
          id_servicio: item.id_servicio,
          fecha_inicio_turno: item.fecha_inicio_turno,
          fecha_fin_turno: item.fecha_fin_turno,
          notas: item.notas || '',
          creado_en: item.creado_en || new Date().toISOString()
        }, { merge: true });
        summary.asignaciones_turno++;
      }
    }

    if (onProgress) onProgress('¡Sincronización con Firestore completada con éxito!');
    return { ok: true, summary };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

// Fetch documents from a collection
async function getCollectionDocs(collectionName, maxItems = 50) {
  if (!db) await initFirebase();
  const pathForGetDocs = collectionName;
  try {
    const q = query(collection(db, collectionName), limit(maxItems));
    const snap = await getDocs(q);
    const docs = [];
    snap.forEach((d) => docs.push({ _id: d.id, ...d.data() }));
    return docs;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGetDocs);
  }
}

// Listen to real-time emergencies in Firestore
function listenToEmergencies(callback) {
  if (!db) return () => {};
  const pathForOnSnapshot = 'bitacoras';
  const q = query(
    collection(db, 'bitacoras'),
    where('tipo_evento', '==', 'Emergencia')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const emergencies = [];
      snapshot.forEach((docSnap) => emergencies.push({ _id: docSnap.id, ...docSnap.data() }));
      callback(emergencies);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    }
  );
}

// Listen to real-time access log in Firestore
function listenToAccesses(callback) {
  if (!db) return () => {};
  const pathForOnSnapshot = 'accesos';
  const q = query(collection(db, 'accesos'), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = [];
      snapshot.forEach((docSnap) => records.push({ _id: docSnap.id, ...docSnap.data() }));
      callback(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    }
  );
}

// Add an access record directly into Firestore
async function addAccessToFirestore(accessData) {
  if (!db) await initFirebase();
  const pathForWrite = 'accesos';
  try {
    const id = accessData.id_acceso ? String(accessData.id_acceso) : `acc_${Date.now()}`;
    await setDoc(doc(db, 'accesos', id), {
      ...accessData,
      id_acceso: accessData.id_acceso || Date.now()
    }, { merge: true });
    return { ok: true, id };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

// Add an incident/emergency to Firestore
async function addLogbookToFirestore(logbookData) {
  if (!db) await initFirebase();
  const pathForWrite = 'bitacoras';
  try {
    const id = logbookData.id_bitacora ? String(logbookData.id_bitacora) : `bit_${Date.now()}`;
    await setDoc(doc(db, 'bitacoras', id), {
      ...logbookData,
      id_bitacora: logbookData.id_bitacora || Date.now()
    }, { merge: true });
    return { ok: true, id };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

// Export global SICA_FIRESTORE namespace
window.SICA_FIRESTORE = {
  initFirebase,
  testConnection,
  loginWithGoogle,
  logoutGoogle,
  seedAllToFirestore,
  getCollectionDocs,
  listenToEmergencies,
  listenToAccesses,
  addAccessToFirestore,
  addLogbookToFirestore,
  getCurrentUser: () => currentAuthUser,
  getDb: () => db,
  getAuth: () => auth,
  handleFirestoreError,
  OperationType
};

// Auto-initialize when script loads
initFirebase().catch((e) => console.log('[Firestore] Inicialización diferida:', e.message));
