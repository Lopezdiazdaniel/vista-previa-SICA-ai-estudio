-- =====================================================================
-- SISTEMA DE GESTIÓN Y CONTROL DE ACCESO PARA SEGURIDAD PRIVADA (SICA)
-- Script DDL de Base de Datos Relacional (Compatible con MySQL 8.0+ / MariaDB)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS sica_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sica_db;

-- 1. Tabla de Servicios (Inmuebles / Casetas)
CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente_o_lugar VARCHAR(150) NOT NULL,
    tipo_servicio ENUM('Residencial', 'Industrial', 'Corporativo', 'Comercio') NOT NULL DEFAULT 'Residencial',
    direccion_calle VARCHAR(100),
    direccion_numero VARCHAR(30),
    direccion_colonia VARCHAR(100),
    direccion_municipio VARCHAR(100),
    direccion_cp VARCHAR(10),
    direccion TEXT,
    contacto_principal VARCHAR(120),
    telefono_directo VARCHAR(30),
    correo_contacto VARCHAR(120),
    contacto_emergencia VARCHAR(150),
    instrucciones_iniciales TEXT,
    estatus ENUM('Activo', 'Suspendido', 'Finalizado') NOT NULL DEFAULT 'Activo',
    fecha_inicio_contratacion DATE NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_servicio_estatus (estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Usuarios (Personal Operativo y Administrativo)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    correo_electronico VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    rol ENUM('Administrador', 'Supervisor', 'Guardia') NOT NULL,
    estatus ENUM('Activo', 'En descanso', 'Baja') NOT NULL DEFAULT 'Activo',
    curp VARCHAR(20),
    telefono VARCHAR(25),
    num_empleado_placa VARCHAR(50),
    id_servicio_asignado INT NULL,
    fecha_alta DATE NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuario_rol (rol),
    INDEX idx_usuario_estatus (estatus),
    FOREIGN KEY (id_servicio_asignado) REFERENCES servicios(id_servicio) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla de Expedientes Digitales del Personal
CREATE TABLE IF NOT EXISTS expedientes (
    id_expediente INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_documento ENUM('ine', 'comprobante_domicilio', 'curp_rfc', 'antecedentes_no_penales', 'cartilla_militar', 'fotografia_rostro') NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(255) NOT NULL,
    tamano_bytes INT,
    estatus_validacion ENUM('Pendiente', 'Aprobado', 'Rechazado') NOT NULL DEFAULT 'Pendiente',
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expediente_usuario (id_usuario),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de Asignaciones de Turno
CREATE TABLE IF NOT EXISTS asignaciones_turno (
    id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_servicio INT NOT NULL,
    fecha_inicio_turno DATETIME NOT NULL,
    fecha_fin_turno DATETIME NOT NULL,
    notas TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_turno_usuario (id_usuario),
    INDEX idx_turno_servicio (id_servicio),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabla de Registro de Accesos (Control Peatonal y Vehicular)
CREATE TABLE IF NOT EXISTS accesos (
    id_acceso INT AUTO_INCREMENT PRIMARY KEY,
    id_servicio INT NOT NULL,
    id_guardia INT NOT NULL,
    tipo_movimiento ENUM('Entrada', 'Salida') NOT NULL,
    tipo_visitante ENUM('Peatón', 'Vehículo', 'Proveedor', 'Visita', 'Residente', 'Empleado') NOT NULL,
    nombre_visitante VARCHAR(150) NOT NULL,
    identificacion_tipo VARCHAR(50),
    identificacion_num VARCHAR(50),
    datos_vehiculo TEXT,
    placas VARCHAR(20),
    motivo_o_destino VARCHAR(200),
    fotografia_evidencia VARCHAR(255),
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    sincronizado_offline TINYINT(1) DEFAULT 0,
    INDEX idx_accesos_servicio_fecha (id_servicio, fecha_hora),
    INDEX idx_accesos_guardia (id_guardia),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
    FOREIGN KEY (id_guardia) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabla de Bitácora Digital de Incidencias y Novedades
CREATE TABLE IF NOT EXISTS bitacoras (
    id_bitacora INT AUTO_INCREMENT PRIMARY KEY,
    id_servicio INT NOT NULL,
    id_guardia INT NOT NULL,
    tipo_evento ENUM('Rondín', 'Relevo de Turno', 'Novedad Menor', 'Incidencia Operativa', 'Emergencia') NOT NULL,
    descripcion TEXT NOT NULL,
    fotografia_adjunta VARCHAR(255),
    nivel_prioridad ENUM('Baja', 'Media', 'Alta', 'Emergencia') DEFAULT 'Baja',
    atendida_supervisor TINYINT(1) DEFAULT 0,
    fecha_hora_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_atencion DATETIME NULL,
    notas_supervisor TEXT,
    INDEX idx_bitacora_servicio_fecha (id_servicio, fecha_hora_registro),
    INDEX idx_bitacora_prioridad (nivel_prioridad),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
    FOREIGN KEY (id_guardia) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Tabla de Consignas Operativas
CREATE TABLE IF NOT EXISTS consignas (
    id_consigna INT AUTO_INCREMENT PRIMARY KEY,
    id_servicio INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    contenido TEXT NOT NULL,
    fecha_vigencia_inicio DATE NOT NULL,
    fecha_vigencia_fin DATE NOT NULL,
    creado_por INT NOT NULL,
    prioridad ENUM('Normal', 'Alta', 'Urgente') DEFAULT 'Normal',
    estatus ENUM('Vigente', 'Vencida', 'Cancelada') DEFAULT 'Vigente',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_consignas_servicio_vigencia (id_servicio, fecha_vigencia_inicio, fecha_vigencia_fin),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
