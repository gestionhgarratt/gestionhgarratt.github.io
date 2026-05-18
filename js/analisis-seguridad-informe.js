/**
 * Generación de informe PDF — análisis de seguridad.
 * Requiere html2pdf.js (cargado en la página de resultados).
 */
(function (global) {
  "use strict";

  var AMB_LABELS = {
    estacionamiento_interno: "Estacionamiento interno",
    estacionamiento_externo: "Estacionamiento externo",
    comedor: "Comedor",
    almacen: "Almacén",
    loading_docks: "Loading docks",
    patio_maniobras: "Patio de maniobras",
    area_produccion: "Área de producción",
    aulas: "Aulas",
    biblioteca: "Biblioteca",
    laboratorios_computo: "Laboratorios de cómputo",
    zona_calderos: "Zona de calderos",
    lactario: "Lactario",
    topico: "Tópico",
  };

  var DOC_LABELS = {
    politicas_liderman: "Políticas de la empresa (Liderman)",
    control_acceso_peatonal: "Control de acceso peatonal",
    control_acceso_vehicular: "Control de acceso vehicular",
    control_materiales: "Control de ingreso y salida de materiales",
    directorio_emergencia: "Directorio de números de emergencia",
    matriz_comunicacion: "Matriz de escala de comunicación de eventos",
    programa_capacitacion: "Programa de capacitación",
    formato_sctr: "Formato para activación de SCTR",
    material_capacitacion: "Material de capacitación impreso",
    iperc_puestos: "IPERC de los puestos existentes",
  };

  var TIPO_INST_LABELS = {
    corporativo: "Edificio corporativo / oficinas",
    industrial: "Planta industrial / manufactura",
    educativo: "Centro educativo",
    comercial: "Centro comercial / retail",
    logistico: "Instalación logística",
    salud: "Centro de salud",
    residencial: "Residencial / condominio",
    otro: "Otro",
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function labelSiNo(v) {
    if (v === "si") return "Sí";
    if (v === "no") return "No";
    return v ? String(v) : "—";
  }

  function textFromField(f) {
    if (f == null) return "";
    if (typeof f === "string" || typeof f === "number") return String(f);
    if (typeof f === "object") {
      return String(f.text != null ? f.text : f.value != null ? f.value : "");
    }
    return "";
  }

  function fotosFromField(f) {
    if (f && typeof f === "object" && Array.isArray(f.fotos)) return f.fotos;
    if (Array.isArray(f)) return f;
    return [];
  }

  function labelsFromMap(arr, map) {
    if (!arr || !arr.length) return "—";
    return arr
      .map(function (k) {
        return map[k] || k;
      })
      .join(", ");
  }

  function isSafeImageUrl(u) {
    var s = String(u || "").trim();
    return s.indexOf("https://") === 0 || s.indexOf("http://") === 0;
  }

  function loadImageAsDataUrl(url) {
    return new Promise(function (resolve) {
      var src = String(url || "").trim();
      if (!isSafeImageUrl(src)) {
        resolve("");
        return;
      }
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (e) {
          resolve(src);
        }
      };
      img.onerror = function () {
        resolve(src);
      };
      img.src = src;
    });
  }

  async function resolvePhotoMap(urls) {
    var map = {};
    var list = urls.filter(isSafeImageUrl);
    await Promise.all(
      list.map(async function (url) {
        map[url] = await loadImageAsDataUrl(url);
      })
    );
    return map;
  }

  function collectAllPhotoUrls(d) {
    var urls = [];
    function addField(f) {
      fotosFromField(f).forEach(function (u) {
        if (isSafeImageUrl(u) && urls.indexOf(u) < 0) urls.push(u);
      });
    }
    addField(d.ambientes_evidencia);
    addField(d.otros_ambientes);
    addField(d.tipo_instalacion_evidencia);
    addField(d.actividades);
    addField(d.colinda_posterior);
    addField(d.colinda_derecha);
    addField(d.colinda_izquierda);
    addField(d.puestos_diurno_evidencia);
    addField(d.puestos_nocturno_evidencia);
    addField(d.jefe_grupo_evidencia);
    addField(d.supervisor_residente_evidencia);
    addField(d.celulares_evidencia);
    addField(d.radios_evidencia);
    addField(d.otros_epp);
    addField(d.camaras_evidencia);
    addField(d.cctv_evidencia);
    addField(d.documentos_evidencia);
    return urls;
  }

  function imgHtml(url, caption, photoMap) {
    if (!isSafeImageUrl(url)) return "";
    var src = (photoMap && photoMap[url]) || url;
    return (
      '<figure class="as-pdf-photo">' +
      '<img src="' +
      esc(src) +
      '" alt="' +
      esc(caption) +
      '" />' +
      (caption ? '<figcaption>' + esc(caption) + "</figcaption>" : "") +
      "</figure>"
    );
  }

  function photosBlock(f, caption, photoMap) {
    var urls = fotosFromField(f);
    if (!urls.length) return "";
    var h = '<div class="as-pdf-photos">';
    urls.forEach(function (u, i) {
      h += imgHtml(u, caption + " " + (i + 1), photoMap);
    });
    h += "</div>";
    return h;
  }

  function displayVal(value) {
    if (typeof value === "number" && !isNaN(value)) {
      return String(value);
    }
    if (value === 0 || value === "0") {
      return "0";
    }
    if (value == null || value === "") {
      return "—";
    }
    return String(value);
  }

  function rowHtml(label, value) {
    return (
      '<tr><th scope="row">' +
      esc(label) +
      "</th><td>" +
      esc(displayVal(value)) +
      "</td></tr>"
    );
  }

  function sectionHtml(title, body) {
    return (
      '<section class="as-pdf-section">' +
      "<h2>" +
      esc(title) +
      "</h2>" +
      body +
      "</section>"
    );
  }

  function tableHtml(rows) {
    return '<table class="as-pdf-table"><tbody>' + rows.join("") + "</tbody></table>";
  }

  function buildReportHtml(rec, photoMap) {
    var d = rec.datos || {};
    var logo = global.AppConfig ? global.AppConfig.getCompanyLogoUrl() : "";
    var esProspecto =
      (global.AppConfig && global.AppConfig.isProspectoCliente(rec.id_cliente)) ||
      d.es_prospecto === true;
    var unidadLbl = esProspecto ? "Nombre" : "Unidad";
    var unidadVal = rec.unidad || d.prospecto_nombre || "";

    var tipoLbl = TIPO_INST_LABELS[d.tipo_instalacion] || d.tipo_instalacion;
    if (d.tipo_instalacion === "otro" && d.tipo_instalacion_otro) {
      tipoLbl += " — " + d.tipo_instalacion_otro;
    }

    var pd = d.puestos_diurno || {};
    var pn = d.puestos_nocturno || {};

    var html =
      '<div class="as-pdf-root">' +
      '<header class="as-pdf-header">' +
      (logo
        ? '<img class="as-pdf-logo" src="' + esc(logo) + '" alt="Logo empresa" crossorigin="anonymous" />'
        : "") +
      '<div class="as-pdf-header-text">' +
      "<h1>Informe de análisis de seguridad</h1>" +
      "<p>Control Supervisión y KPIs</p>" +
      "</div>" +
      "</header>" +
      sectionHtml(
        "Datos del registro",
        tableHtml([
          rowHtml("ID", rec.id_analisis),
          rowHtml("Fecha y hora", rec.fecha_hora),
          rowHtml("Registrado por", rec.usuario),
          rowHtml("Cliente", rec.cliente),
          rowHtml(unidadLbl, unidadVal),
        ])
      ) +
      sectionHtml(
        "Identificación del establecimiento",
        tableHtml([
          rowHtml("Razón social", d.razon_social),
          rowHtml("R.U.C.", d.ruc),
          rowHtml("Giro del negocio", d.giro_negocio),
        ])
      ) +
      sectionHtml(
        "Ambientes de la instalación",
        tableHtml([
          rowHtml("Ambientes", labelsFromMap(d.ambientes, AMB_LABELS)),
          rowHtml("Otros ambientes", textFromField(d.otros_ambientes)),
        ]) +
          photosBlock(d.ambientes_evidencia, "Ambientes", photoMap) +
          photosBlock(d.otros_ambientes, "Otros ambientes", photoMap)
      ) +
      sectionHtml(
        "Instalación y actividades",
        tableHtml([
          rowHtml("La instalación es", tipoLbl),
          rowHtml("Actividades", textFromField(d.actividades)),
        ]) +
          photosBlock(d.tipo_instalacion_evidencia, "Instalación", photoMap) +
          photosBlock(d.actividades, "Actividades", photoMap)
      ) +
      sectionHtml(
        "Colindancias",
        tableHtml([
          rowHtml("Posterior", textFromField(d.colinda_posterior)),
          rowHtml("Derecha", textFromField(d.colinda_derecha)),
          rowHtml("Izquierda", textFromField(d.colinda_izquierda)),
        ]) +
          photosBlock(d.colinda_posterior, "Posterior", photoMap) +
          photosBlock(d.colinda_derecha, "Derecha", photoMap) +
          photosBlock(d.colinda_izquierda, "Izquierda", photoMap)
      ) +
      sectionHtml(
        "Personal y dotación",
        tableHtml([
          rowHtml("Puestos 12 h diurno", pd.cantidad),
          rowHtml("Esquema diurno", pd.esquema),
          rowHtml("Puestos 12 h nocturno", pn.cantidad),
          rowHtml("Esquema nocturno", pn.esquema),
          rowHtml("Jefe de grupo", labelSiNo(d.jefe_grupo)),
          rowHtml("Supervisor residente", labelSiNo(d.supervisor_residente)),
          rowHtml("Celulares asignados", d.celulares),
          rowHtml("Radios asignados", d.radios),
          rowHtml("Otros EPP", textFromField(d.otros_epp)),
        ]) +
          photosBlock(d.puestos_diurno_evidencia, "Puestos diurnos", photoMap) +
          photosBlock(d.puestos_nocturno_evidencia, "Puestos nocturnos", photoMap) +
          photosBlock(d.jefe_grupo_evidencia, "Jefe de grupo", photoMap) +
          photosBlock(d.supervisor_residente_evidencia, "Supervisor", photoMap) +
          photosBlock(d.celulares_evidencia, "Celulares", photoMap) +
          photosBlock(d.radios_evidencia, "Radios", photoMap) +
          photosBlock(d.otros_epp, "EPP", photoMap)
      ) +
      sectionHtml(
        "CCTV y cámaras",
        tableHtml(
          [
            rowHtml("Total cámaras", d.camaras_total),
            rowHtml("Cámaras operativas", d.camaras_operativas),
            rowHtml("Personal CCTV", labelSiNo(d.personal_cctv)),
          ].concat(
            d.personal_cctv === "si"
              ? [
                  rowHtml("CCTV Liderman", labelSiNo(d.cctv_liderman)),
                  rowHtml("Operadores CCTV", d.operadores_cctv),
                ]
              : []
          )
        ) +
          photosBlock(d.camaras_evidencia, "Cámaras", photoMap) +
          photosBlock(d.cctv_evidencia, "CCTV", photoMap)
      ) +
      sectionHtml(
        "Documentación de acceso",
        tableHtml([rowHtml("Documentos", labelsFromMap(d.documentos_acceso, DOC_LABELS))]) +
          photosBlock(d.documentos_evidencia, "Documentos", photoMap)
      ) +
      '<footer class="as-pdf-footer">Documento generado el ' +
      esc(new Date().toLocaleString("es-PE")) +
      "</footer>" +
      "</div>";

    return html;
  }

  function sanitizeFilename(s) {
    return String(s || "informe")
      .trim()
      .replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 60);
  }

  async function downloadPdf(record) {
    if (!global.html2pdf) {
      throw new Error("No se cargó la librería de PDF. Recargue la página.");
    }
    var d = record.datos || {};
    var photoMap = await resolvePhotoMap(collectAllPhotoUrls(d));

    var host = document.getElementById("asPdfHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "asPdfHost";
      host.className = "as-pdf-host";
      host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host);
    }
    host.innerHTML = buildReportHtml(record, photoMap);

    if (global.AppConfig && global.AppConfig.getCompanyLogoUrl) {
      var logoEl = host.querySelector(".as-pdf-logo");
      if (logoEl) {
        try {
          logoEl.src = await loadImageAsDataUrl(global.AppConfig.getCompanyLogoUrl());
        } catch (e) {
          /* mantener URL */
        }
      }
    }

    var nombre = sanitizeFilename(d.razon_social || record.cliente || "analisis");
    var fname = "Informe_Analisis_Seguridad_" + nombre + ".pdf";

    var opt = {
      margin: [10, 10, 12, 10],
      filename: fname,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    await global.html2pdf().set(opt).from(host.querySelector(".as-pdf-root")).save();
    host.innerHTML = "";
  }

  global.AppAnalisisInforme = {
    downloadPdf: downloadPdf,
  };
})(typeof window !== "undefined" ? window : this);
