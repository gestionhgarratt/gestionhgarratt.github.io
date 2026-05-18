/**
 * Resultados de análisis de seguridad — solo administrador.
 */
(function () {
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

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockNoAdmin = document.getElementById("blockNoAdmin");
  var blockAdmin = document.getElementById("blockAdmin");
  var msg = document.getElementById("msg");
  var loading = document.getElementById("loading");
  var tbody = document.getElementById("tbody");
  var btnRefrescar = document.getElementById("btnRefrescar");
  var dlg = document.getElementById("dlgDetalle");
  var dlgBody = document.getElementById("dlgDetalleBody");
  var btnDlgCerrar = document.getElementById("btnDlgCerrar");
  var btnDlgPdf = document.getElementById("btnDlgPdf");
  var dlgCurrentId = "";

  if (!window.AppAuth.isAdmin(session)) {
    blockNoAdmin.hidden = false;
    blockAdmin.hidden = true;
    return;
  }

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function esc(s) {
    var t = String(s == null ? "" : s);
    return t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isSafeImageUrl(u) {
    var s = String(u || "").trim();
    return s.indexOf("https://") === 0 || s.indexOf("http://") === 0;
  }

  function labelSiNo(v) {
    if (v === "si") {
      return "Sí";
    }
    if (v === "no") {
      return "No";
    }
    return v ? String(v) : "—";
  }

  function addMetaRow(dl, label, value) {
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value != null && value !== "" ? String(value) : "—";
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function addSection(container, title) {
    var sec = document.createElement("section");
    sec.className = "detail-section";
    var h = document.createElement("h4");
    h.textContent = title;
    sec.appendChild(h);
    container.appendChild(sec);
    return sec;
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

  function addLine(sec, label, value) {
    var div = document.createElement("div");
    div.className = "detail-row";
    var strong = document.createElement("strong");
    strong.textContent = label + ": ";
    div.appendChild(strong);
    div.appendChild(document.createTextNode(displayVal(value)));
    sec.appendChild(div);
  }

  function addPhotos(sec, fotos, caption) {
    var urls = [];
    if (Array.isArray(fotos)) {
      urls = fotos;
    } else if (fotos && typeof fotos === "object" && Array.isArray(fotos.fotos)) {
      urls = fotos.fotos;
    }
    if (!urls.length) {
      return;
    }
    var ph = document.createElement("div");
    ph.className = "detail-photos";
    urls.forEach(function (url, i) {
      if (!isSafeImageUrl(url)) {
        return;
      }
      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = url;
      img.alt = (caption || "Evidencia") + " " + (i + 1);
      img.loading = "lazy";
      fig.appendChild(img);
      ph.appendChild(fig);
    });
    if (ph.children.length) {
      sec.appendChild(ph);
    }
  }

  function labelsFromMap(arr, map) {
    if (!arr || !arr.length) {
      return "—";
    }
    return arr
      .map(function (k) {
        return map[k] || k;
      })
      .join(", ");
  }

  function textFromField(f) {
    if (f == null) {
      return "";
    }
    if (typeof f === "string" || typeof f === "number") {
      return String(f);
    }
    if (typeof f === "object") {
      return String(f.text != null ? f.text : f.value != null ? f.value : "");
    }
    return "";
  }

  function fotosFromField(f) {
    if (f && typeof f === "object" && Array.isArray(f.fotos)) {
      return f.fotos;
    }
    if (Array.isArray(f)) {
      return f;
    }
    return [];
  }

  function renderDetalle(rec) {
    dlgBody.textContent = "";
    var datos = rec.datos || {};
    var d = datos;

    var dl = document.createElement("dl");
    dl.className = "detail-meta";
    addMetaRow(dl, "ID", rec.id_analisis);
    addMetaRow(dl, "Fecha y hora", rec.fecha_hora);
    addMetaRow(dl, "Usuario", rec.usuario);
    addMetaRow(dl, "Cliente", rec.cliente);
    var esProspecto =
      window.AppConfig.isProspectoCliente(rec.id_cliente) ||
      (d.es_prospecto === true);
    addMetaRow(dl, esProspecto ? "Nombre" : "Unidad", rec.unidad);
    dlgBody.appendChild(dl);

    var s1 = addSection(dlgBody, "Identificación");
    addLine(s1, "Razón social", d.razon_social);
    addLine(s1, "R.U.C.", d.ruc);
    addLine(s1, "Giro del negocio", d.giro_negocio);

    var s2 = addSection(dlgBody, "Ambientes");
    addLine(s2, "Ambientes", labelsFromMap(d.ambientes, AMB_LABELS));
    addPhotos(s2, d.ambientes_evidencia, "Ambientes");
    addLine(s2, "Otros ambientes", textFromField(d.otros_ambientes));
    addPhotos(s2, d.otros_ambientes, "Otros ambientes");

    var s3 = addSection(dlgBody, "Instalación y actividades");
    var tipoLbl = TIPO_INST_LABELS[d.tipo_instalacion] || d.tipo_instalacion;
    if (d.tipo_instalacion === "otro" && d.tipo_instalacion_otro) {
      tipoLbl += " — " + d.tipo_instalacion_otro;
    }
    addLine(s3, "La instalación es", tipoLbl);
    addPhotos(s3, d.tipo_instalacion_evidencia, "Instalación");
    addLine(s3, "Actividades", textFromField(d.actividades));
    addPhotos(s3, d.actividades, "Actividades");

    var s4 = addSection(dlgBody, "Colindancias");
    addLine(s4, "Posterior", textFromField(d.colinda_posterior));
    addPhotos(s4, d.colinda_posterior, "Posterior");
    addLine(s4, "Derecha", textFromField(d.colinda_derecha));
    addPhotos(s4, d.colinda_derecha, "Derecha");
    addLine(s4, "Izquierda", textFromField(d.colinda_izquierda));
    addPhotos(s4, d.colinda_izquierda, "Izquierda");

    var s5 = addSection(dlgBody, "Personal y dotación");
    var pd = d.puestos_diurno || {};
    addLine(s5, "Puestos 12 h diurno", pd.cantidad);
    addLine(s5, "Esquema diurno", pd.esquema);
    addPhotos(s5, d.puestos_diurno_evidencia, "Puestos diurnos");
    var pn = d.puestos_nocturno || {};
    addLine(s5, "Puestos 12 h nocturno", pn.cantidad);
    addLine(s5, "Esquema nocturno", pn.esquema);
    addPhotos(s5, d.puestos_nocturno_evidencia, "Puestos nocturnos");
    addLine(s5, "Jefe de grupo", labelSiNo(d.jefe_grupo));
    addPhotos(s5, d.jefe_grupo_evidencia, "Jefe de grupo");
    addLine(s5, "Supervisor residente", labelSiNo(d.supervisor_residente));
    addPhotos(s5, d.supervisor_residente_evidencia, "Supervisor residente");
    addLine(s5, "Celulares asignados", d.celulares);
    addPhotos(s5, d.celulares_evidencia, "Celulares");
    addLine(s5, "Radios asignados", d.radios);
    addPhotos(s5, d.radios_evidencia, "Radios");
    addLine(s5, "Otros EPP", textFromField(d.otros_epp));
    addPhotos(s5, d.otros_epp, "EPP");

    var s6 = addSection(dlgBody, "CCTV y cámaras");
    addLine(s6, "Total cámaras", d.camaras_total);
    addLine(s6, "Cámaras operativas", d.camaras_operativas);
    addPhotos(s6, d.camaras_evidencia, "Cámaras");
    addLine(s6, "Personal CCTV", labelSiNo(d.personal_cctv));
    if (d.personal_cctv === "si") {
      addLine(s6, "CCTV Liderman", labelSiNo(d.cctv_liderman));
      addLine(s6, "Operadores CCTV", d.operadores_cctv);
    }
    addPhotos(s6, d.cctv_evidencia, "CCTV");

    var s7 = addSection(dlgBody, "Documentación");
    addLine(s7, "Documentos con acceso", labelsFromMap(d.documentos_acceso, DOC_LABELS));
    addPhotos(s7, d.documentos_evidencia, "Documentos");
  }

  async function fetchRecord(id) {
    var res = await window.AppApi.get("getAnalisisSeguridad", {
      caller: session.usuario,
      id: id,
    });
    if (!res || res.status !== "success" || !res.data || !res.data.record) {
      return { ok: false, message: (res && res.message) || "No se pudo cargar el registro." };
    }
    return { ok: true, record: res.data.record };
  }

  async function descargarInforme(id, btn) {
    hideMsg();
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generando…";
    }
    showMsg("Generando informe PDF…", "info");
    try {
      var out = await fetchRecord(id);
      if (!out.ok) {
        showMsg(out.message);
        return;
      }
      if (!window.AppAnalisisInforme || !window.AppAnalisisInforme.downloadPdf) {
        showMsg("No está disponible el generador de informes.");
        return;
      }
      await window.AppAnalisisInforme.downloadPdf(out.record);
      hideMsg();
      showMsg("Informe PDF descargado.", "success");
    } catch (e) {
      showMsg(String(e.message || e) || "Error al generar el PDF.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn === btnDlgPdf ? "Descargar PDF" : "PDF";
      }
    }
  }

  async function verDetalle(id) {
    hideMsg();
    dlgBody.innerHTML = '<p class="msg msg--info">Cargando…</p>';
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    }
    try {
      var out = await fetchRecord(id);
      if (!out.ok) {
        dlgBody.innerHTML = '<p class="msg msg--error">' + esc(out.message) + "</p>";
        return;
      }
      dlgCurrentId = id;
      if (btnDlgPdf) {
        btnDlgPdf.hidden = false;
      }
      renderDetalle(out.record);
    } catch (e) {
      dlgBody.innerHTML = '<p class="msg msg--error">Error de red.</p>';
    }
  }

  function renderTabla(rows) {
    tbody.innerHTML = "";
    if (!rows || !rows.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.textContent =
        "No hay registros. Ejecuta crearPestanasAnalisisSeguridad() en Apps Script y registra desde el módulo Análisis de seguridad.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      ["fecha_hora", "usuario", "cliente", "unidad", "razon_social"].forEach(function (k) {
        var td = document.createElement("td");
        td.textContent = row[k] != null ? String(row[k]) : "";
        tr.appendChild(td);
      });
      var tdAct = document.createElement("td");
      tdAct.className = "table-actions";

      var btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.className = "btn btn--ghost";
      btnVer.style.minHeight = "36px";
      btnVer.style.padding = "0.35rem 0.75rem";
      btnVer.textContent = "Ver";
      btnVer.addEventListener("click", function () {
        verDetalle(row.id_analisis);
      });
      tdAct.appendChild(btnVer);

      var btnPdf = document.createElement("button");
      btnPdf.type = "button";
      btnPdf.className = "btn btn--primary";
      btnPdf.style.minHeight = "36px";
      btnPdf.style.padding = "0.35rem 0.75rem";
      btnPdf.textContent = "PDF";
      btnPdf.addEventListener("click", function () {
        descargarInforme(row.id_analisis, btnPdf);
      });
      tdAct.appendChild(btnPdf);

      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }

  async function cargar() {
    hideMsg();
    loading.hidden = false;
    tbody.innerHTML = "";
    try {
      var res = await window.AppApi.get("listAnalisisSeguridad", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar el listado.");
        loading.hidden = true;
        return;
      }
      renderTabla((res.data && res.data.rows) || []);
    } catch (e) {
      showMsg("Error de red.");
    }
    loading.hidden = true;
  }

  btnRefrescar.addEventListener("click", cargar);

  btnDlgCerrar.addEventListener("click", function () {
    dlg.close();
  });

  if (btnDlgPdf) {
    btnDlgPdf.addEventListener("click", function () {
      if (dlgCurrentId) {
        descargarInforme(dlgCurrentId, btnDlgPdf);
      }
    });
  }

  dlg.addEventListener("click", function (ev) {
    if (ev.target === dlg) {
      dlg.close();
    }
  });

  cargar();
})();
