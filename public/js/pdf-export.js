/**
 * SICA - Motor de Generación y Descarga de Documentos PDF Oficiales
 * Utiliza jsPDF y jsPDF-AutoTable con respaldo automático al endpoint del servidor
 */

window.SICA_PDF = {
  getJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) {
      return window.jspdf.jsPDF;
    }
    if (window.jsPDF) {
      return window.jsPDF;
    }
    return null;
  },

  runAutoTable(doc, options) {
    if (typeof doc.autoTable === 'function') {
      return doc.autoTable(options);
    }
    if (typeof window.jspdfAutoTable === 'function') {
      return window.jspdfAutoTable(doc, options);
    }
    if (typeof window.autoTable === 'function') {
      return window.autoTable(doc, options);
    }
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      return window.jspdf.autoTable(doc, options);
    }
  },

  /**
   * Genera el encabezado oficial institucional en cualquier documento PDF
   */
  agregarEncabezado(doc, titulo, subtitulo = 'Seguridad Privada y Vigilancia Operativa') {
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentUser = window.SICA_API ? window.SICA_API.getStoredUser() : null;

    // Barra superior decorativa
    doc.setFillColor(15, 23, 42); // Navy 900
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFillColor(2, 132, 199); // Sky 600 accent
    doc.rect(0, 28, pageWidth, 2, 'F');

    // Logo / Emblema y Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('SICA · SEGURIDAD PRIVADA', 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(186, 230, 253);
    doc.text(subtitulo.toUpperCase(), 14, 21);

    // Metadata a la derecha
    const nowStr = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`EMISIÓN: ${nowStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`USUARIO: ${currentUser ? `${currentUser.nombre_completo} (${currentUser.rol})` : 'Sistema SICA'}`, pageWidth - 14, 19, { align: 'right' });

    // Título principal del reporte
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(titulo, 14, 38);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 41, pageWidth - 14, 41);

    return 46;
  },

  /**
   * Agrega pie de página con paginación
   */
  agregarPiePagina(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Documento Oficial de Control y Auditoría Patrimonial · SICA Plataforma de Seguridad', 14, pageHeight - 7);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    }
  },

  /**
   * Exporta e imprime en PDF el Registro de Control de Accesos
   */
  async exportarAccesosPDF(accesos, opciones = {}) {
    const jsPDFClass = this.getJsPDF();
    const fechaHoy = new Date().toISOString().split('T')[0];
    const filename = `SICA_Reporte_Accesos_${fechaHoy}.pdf`;

    if (!jsPDFClass) {
      // Respaldo directo en el servidor
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'accesos', id_servicio: opciones.id_servicio });
      return await window.SICA_API.downloadExport(url, filename);
    }

    try {
      const doc = new jsPDFClass({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const titulo = opciones.titulo || 'REPORTE OFICIAL DE CONTROL DE ACCESOS (ENTRADAS Y SALIDAS)';
      const startY = this.agregarEncabezado(doc, titulo, 'Bitácora Vehicular y Peatonal de Caseta');

      const tableBody = (accesos || []).map((a) => [
        `#${a.id_acceso}`,
        a.fecha_hora || '-',
        a.nombre_servicio || 'Caseta Principal',
        a.tipo_movimiento || 'Entrada',
        a.tipo_visitante || 'Visitante',
        a.nombre_visitante || '-',
        a.placas || a.identificacion_num || '-',
        a.motivo_o_destino || 'Ingreso general',
        a.nombre_guardia || 'Oficial en turno'
      ]);

      this.runAutoTable(doc, {
        startY,
        head: [['FOLIO', 'FECHA / HORA', 'INMUEBLE / CASETA', 'MOVIMIENTO', 'TIPO', 'VISITANTE / CONDUCTOR', 'PLACAS / ID', 'DESTINO / ASUNTO', 'OFICIAL RECEPTOR']],
        body: tableBody,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          1: { cellWidth: 32 },
          2: { cellWidth: 36 },
          3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
          4: { cellWidth: 20 },
          5: { fontStyle: 'bold', cellWidth: 42 },
          6: { cellWidth: 28 },
          7: { cellWidth: 42 },
          8: { cellWidth: 32 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'Entrada') {
              data.cell.styles.textColor = [16, 185, 129];
            } else {
              data.cell.styles.textColor = [2, 132, 199];
            }
          }
        },
        margin: { left: 14, right: 14, bottom: 18 }
      });

      this.agregarPiePagina(doc);
      doc.save(filename);
      return filename;
    } catch (err) {
      console.warn('Error en generación cliente jsPDF, usando respaldo de servidor:', err);
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'accesos', id_servicio: opciones.id_servicio });
      return await window.SICA_API.downloadExport(url, filename);
    }
  },

  /**
   * Exporta e imprime en PDF la Bitácora de Novedades e Incidencias
   */
  async exportarBitacorasPDF(bitacoras, opciones = {}) {
    const jsPDFClass = this.getJsPDF();
    const fechaHoy = new Date().toISOString().split('T')[0];
    const filename = `SICA_Bitacora_Operativa_${fechaHoy}.pdf`;

    if (!jsPDFClass) {
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'bitacora', id_servicio: opciones.id_servicio });
      return await window.SICA_API.downloadExport(url, filename);
    }

    try {
      const doc = new jsPDFClass({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const titulo = opciones.titulo || 'REPORTE OFICIAL DE BITÁCORA DIGITAL E INCIDENCIAS';
      const startY = this.agregarEncabezado(doc, titulo, 'Eventos, Rondines y Gestión de Seguridad Operativa');

      const tableBody = (bitacoras || []).map((b) => [
        `#${b.id_bitacora}`,
        b.fecha_hora_registro || '-',
        b.nombre_servicio || 'Caseta Principal',
        b.tipo_evento || 'Rondín',
        b.nivel_prioridad || 'Baja',
        b.descripcion || '',
        b.nombre_guardia || 'Oficial en turno',
        b.atendida_supervisor ? 'Atendida / Validada' : 'Pendiente Revisión',
        b.notas_supervisor || '-'
      ]);

      this.runAutoTable(doc, {
        startY,
        head: [['FOLIO', 'FECHA / HORA', 'INMUEBLE / CASETA', 'EVENTO', 'PRIORIDAD', 'DESCRIPCIÓN DEL EVENTO', 'OFICIAL', 'SUPERVISIÓN', 'NOTAS SUPERVISOR']],
        body: tableBody,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          1: { cellWidth: 32 },
          2: { cellWidth: 34 },
          3: { fontStyle: 'bold', cellWidth: 26 },
          4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
          5: { cellWidth: 55 },
          6: { cellWidth: 30 },
          7: { halign: 'center', cellWidth: 28 },
          8: { cellWidth: 35 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            if (data.cell.raw === 'Emergencia' || data.cell.raw === 'Alta') {
              data.cell.styles.textColor = [239, 68, 68];
            } else if (data.cell.raw === 'Media') {
              data.cell.styles.textColor = [245, 158, 11];
            }
          }
        },
        margin: { left: 14, right: 14, bottom: 18 }
      });

      this.agregarPiePagina(doc);
      doc.save(filename);
      return filename;
    } catch (err) {
      console.warn('Error en generación cliente jsPDF, usando respaldo de servidor:', err);
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'bitacora', id_servicio: opciones.id_servicio });
      return await window.SICA_API.downloadExport(url, filename);
    }
  },

  /**
   * Exporta reporte gerencial consolidado en PDF con métricas y tablas
   */
  async exportarReporteGerencialPDF(reporteData) {
    const jsPDFClass = this.getJsPDF();
    const fechaHoy = new Date().toISOString().split('T')[0];
    const filename = `SICA_Reporte_Gerencial_${fechaHoy}.pdf`;

    if (!jsPDFClass) {
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'general' });
      return await window.SICA_API.downloadExport(url, filename);
    }

    try {
      const doc = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = this.agregarEncabezado(doc, 'REPORTE GERENCIAL CONSOLIDADO DE SEGURIDAD', 'Auditoría Integral y Resumen Ejecutivo');

      const r = reporteData.resumen || {};

      // Caja de Resumen Ejecutivo
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, currentY, pageWidth - 28, 32, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('RESUMEN DE OPERACIÓN Y FLUJO DEL PERÍODO', 18, currentY + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const colW = (pageWidth - 36) / 4;
      doc.text(`Accesos Hoy: ${r.accesosHoy || 0}`, 18, currentY + 16);
      doc.text(`Entradas: ${r.entradasHoy || 0}`, 18 + colW, currentY + 16);
      doc.text(`Salidas: ${r.salidasHoy || 0}`, 18 + colW * 2, currentY + 16);
      doc.text(`Personal Activo: ${r.guardiasActivos || 0}`, 18 + colW * 3, currentY + 16);

      doc.text(`Emergencias Activas: ${r.emergenciasActivas || 0}`, 18, currentY + 24);
      doc.text(`Incidencias Hoy: ${r.incidenciasHoy || 0}`, 18 + colW, currentY + 24);
      doc.text(`Casetas Activas: ${r.totalServicios || 0}`, 18 + colW * 2, currentY + 24);

      currentY += 40;

      // Sección de Accesos Recientes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('ÚLTIMOS REGISTROS DE ACCESO', 14, currentY);

      const accesosRows = (reporteData.ultimosAccesos || []).map(a => [
        `#${a.id_acceso}`,
        a.fecha_hora || '-',
        a.nombre_servicio || 'Caseta',
        a.tipo_movimiento,
        `${a.nombre_visitante} (${a.tipo_visitante})`,
        a.placas || '-'
      ]);

      this.runAutoTable(doc, {
        startY: currentY + 4,
        head: [['FOLIO', 'FECHA/HORA', 'CASETA', 'MOVIMIENTO', 'VISITANTE', 'PLACAS']],
        body: accesosRows.length ? accesosRows : [['-', '-', '-', 'Sin accesos recientes', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // Sección de Bitácoras Recientes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('NOVEDADES Y EVENTOS DE BITÁCORA RECIENTES', 14, currentY);

      const bitacoraRows = (reporteData.ultimasBitacoras || []).map(b => [
        `#${b.id_bitacora}`,
        b.fecha_hora_registro || '-',
        b.nombre_servicio || 'Caseta',
        b.tipo_evento,
        b.nivel_prioridad,
        b.descripcion || '-'
      ]);

      this.runAutoTable(doc, {
        startY: currentY + 4,
        head: [['FOLIO', 'FECHA/HORA', 'CASETA', 'EVENTO', 'PRIORIDAD', 'DESCRIPCIÓN']],
        body: bitacoraRows.length ? bitacoraRows : [['-', '-', '-', 'Sin eventos recientes', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14, bottom: 18 }
      });

      this.agregarPiePagina(doc);
      doc.save(filename);
      return filename;
    } catch (err) {
      console.warn('Error en generación cliente jsPDF, usando respaldo de servidor:', err);
      const url = window.SICA_API.getPdfExportUrl({ tipo: 'general' });
      return await window.SICA_API.downloadExport(url, filename);
    }
  }
};
