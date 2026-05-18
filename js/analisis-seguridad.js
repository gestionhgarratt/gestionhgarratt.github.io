/**
 * Análisis de seguridad — formulario de levantamiento (supervisores y administradores).
 */
(function () {
  "use strict";

  var AMBIENTES = [
    { id: "estacionamiento_interno", label: "Estacionamiento interno" },
    { id: "estacionamiento_externo", label: "Estacionamiento externo" },
    { id: "comedor", label: "Comedor" },
    { id: "almacen", label: "Almacén" },
    { id: "loading_docks", label: "Loading docks" },
    { id: "patio_maniobras", label: "Patio de maniobras" },
    { id: "area_produccion", label: "Área de producción" },
    { id: "aulas", label: "Aulas" },
    { id: "biblioteca", label: "Biblioteca" },
    { id: "laboratorios_computo", label: "Laboratorios de cómputo" },
    { id: "zona_calderos", label: "Zona de calderos" },
    { id: "lactario", label: "Lactario" },
    { id: "topico", label: "Tópico" },
  ];

  var DOCUMENTOS = [
    { id: "politicas_liderman", label: "Políticas de la empresa (Liderman)" },
    { id: "control_acceso_peatonal", label: "Procedimientos para el control de acceso peatonal" },
    { id: "control_acceso_vehicular", label: "Procedimiento para el control de acceso vehicular" },
    { id: "control_materiales", label: "Procedimientos para el control de ingreso y salida de materiales" },
    { id: "directorio_emergencia", label: "Directorio de números de emergencia" },
    { id: "matriz_comunicacion", label: "Matriz de escala de comunicación de eventos" },
    { id: "programa_capacitacion", label: "Programa de capacitación" },
    { id: "formato_sctr", label: "Formato para activación de SCTR" },
    { id: "material_capacitacion", label: "Material de capacitación impreso" },
    { id: "iperc_puestos", label: "IPERC de los puestos existentes en la unidad" },
  ];

  var TIPOS_INSTALACION = [
    { value: "", label: "— Elegir —" },
    { value: "corporativo", label: "Edificio corporativo / oficinas" },
    { value: "industrial", label: "Planta industrial / manufactura" },
    { value: "educativo", label: "Centro educativo" },
    { value: "comercial", label: "Centro comercial / retail" },
    { value: "logistico", label: "Instalación logística" },
    { value: "salud", label: "Centro de salud" },
    { value: "residencial", label: "Residencial / condominio" },
    { value: "otro", label: "Otro" },
  ];

  var SI_NO_OPTS =
    '<option value="">— Elegir —</option><option value="si">Sí</option><option value="no">No</option>';

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockDeny = document.getElementById("blockDeny");
  var blockMain = document.getElementById("blockMain");
  var msgTop = document.getElementById("msgTop");
  var fechaHoraDisplay = document.getElementById("fechaHoraDisplay");
  var usuarioDisplay = document.getElementById("usuarioDisplay");
  var selCliente = document.getElementById("selCliente");
  var selUnidad = document.getElementById("selUnidad");
  var wrapUnidadSelect = document.getElementById("wrapUnidadSelect");
  var wrapUnidadNombre = document.getElementById("wrapUnidadNombre");
  var txtUnidadNombre = document.getElementById("txtUnidadNombre");
  var formSections = document.getElementById("formSections");
  var formAnalisis = document.getElementById("formAnalisis");
  var btnGuardar = document.getElementById("btnGuardar");

  if (!window.AppAuth.isSupervisorOrAdmin(session)) {
    blockDeny.hidden = false;
    return;
  }

  blockMain.hidden = false;

  function prospectoId() {
    return window.AppConfig.getProspectoClienteId();
  }

  function isProspectoSelected() {
    return selCliente.value === prospectoId();
  }

  function syncUnidadProspectoUi() {
    var esProspecto = isProspectoSelected();
    if (wrapUnidadSelect) {
      wrapUnidadSelect.hidden = esProspecto;
    }
    if (wrapUnidadNombre) {
      wrapUnidadNombre.hidden = !esProspecto;
    }
    if (selUnidad) {
      selUnidad.required = !esProspecto;
      if (esProspecto) {
        selUnidad.value = "";
      }
    }
    if (txtUnidadNombre) {
      txtUnidadNombre.required = esProspecto;
      if (!esProspecto) {
        txtUnidadNombre.value = "";
      }
    }
  }

  function showTop(text, kind) {
    msgTop.textContent = text;
    msgTop.hidden = false;
    msgTop.className = "msg msg--" + (kind || "error");
  }

  function hideTop() {
    msgTop.hidden = true;
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function tickClock() {
    var d = new Date();
    fechaHoraDisplay.textContent =
      pad(d.getDate()) +
      "/" +
      pad(d.getMonth() + 1) +
      "/" +
      d.getFullYear() +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds());
  }

  usuarioDisplay.textContent =
    (session.nombres || "").trim() + " (" + (session.usuario || "") + ")";

  tickClock();
  setInterval(tickClock, 1000);

  function photoBlockHtml(photoKey, label) {
    return (
      '<div class="photo-group" data-photo-key="' +
      photoKey +
      '">' +
      '<span class="photo-group__label">' +
      (label || "Fotos (opcional)") +
      "</span>" +
      '<div class="photo-actions">' +
      '<label class="btn btn--ghost">Cámara<input type="file" accept="image/*" capture="environment" class="visually-hidden js-as-photo" data-photo-key="' +
      photoKey +
      '" /></label>' +
      '<label class="btn btn--ghost">Galería<input type="file" accept="image/*" class="visually-hidden js-as-photo" data-photo-key="' +
      photoKey +
      '" /></label>' +
      "</div>" +
      '<input type="hidden" data-photos="' +
      photoKey +
      '" value="[]" />' +
      '<div class="photo-preview-grid js-as-preview" data-photo-key="' +
      photoKey +
      '">' +
      '<span class="photo-preview__empty">Sin fotos</span>' +
      "</div>" +
      '<div class="photo-status js-as-photo-status" data-photo-key="' +
      photoKey +
      '"></div>' +
      "</div>"
    );
  }

  function checkboxesHtml(name, items) {
    var h = '<div class="check-grid" data-check-group="' + name + '">';
    items.forEach(function (it) {
      h +=
        '<label><input type="checkbox" value="' +
        it.id +
        '" data-check="' +
        name +
        '" /> ' +
        it.label +
        "</label>";
    });
    h += "</div>";
    return h;
  }

  function buildForm() {
    var ambChecks = checkboxesHtml("ambientes", AMBIENTES);
    var docChecks = checkboxesHtml("documentos_acceso", DOCUMENTOS);
    var tipoOpts = TIPOS_INSTALACION.map(function (o) {
      return '<option value="' + o.value + '">' + o.label + "</option>";
    }).join("");

    formSections.innerHTML =
      '<section class="card as-form-section">' +
      "<h3>Identificación del establecimiento</h3>" +
      '<div class="field"><label for="razon_social">Razón social</label>' +
      '<input class="input" id="razon_social" data-field="razon_social" maxlength="500" /></div>' +
      '<div class="field"><label for="ruc">R.U.C.</label>' +
      '<input class="input" id="ruc" data-field="ruc" maxlength="80" /></div>' +
      '<div class="field"><label for="giro_negocio">Giro del negocio</label>' +
      '<input class="input" id="giro_negocio" data-field="giro_negocio" maxlength="500" /></div>' +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>Ambientes de la instalación</h3>" +
      "<p style=\"margin:0 0 0.5rem;font-size:0.9rem;color:var(--color-text-muted)\">La instalación cuenta con los siguientes ambientes:</p>" +
      ambChecks +
      photoBlockHtml("ambientes_evidencia", "Fotos de ambientes") +
      '<div class="field" style="margin-top:1rem"><label for="otros_ambientes">¿Con qué otros ambientes cuenta?</label>' +
      '<textarea class="input" id="otros_ambientes" data-field-text="otros_ambientes" rows="3" placeholder="Describa otros ambientes no listados"></textarea></div>' +
      photoBlockHtml("otros_ambientes", "Fotos — otros ambientes") +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>Instalación y actividades</h3>" +
      '<div class="field"><label for="tipo_instalacion">La instalación es</label>' +
      '<select class="input" id="tipo_instalacion" data-field="tipo_instalacion">' +
      tipoOpts +
      "</select></div>" +
      '<div class="field" id="wrapTipoOtro" hidden><label for="tipo_instalacion_otro">Especifique (otro)</label>' +
      '<input class="input" id="tipo_instalacion_otro" data-field="tipo_instalacion_otro" maxlength="300" /></div>' +
      photoBlockHtml("tipo_instalacion_evidencia", "Fotos — tipo de instalación") +
      '<div class="field"><label for="actividades">Actividades que se llevan a cabo en la instalación</label>' +
      '<textarea class="input" id="actividades" data-field-text="actividades" rows="4" placeholder="Describa las actividades principales"></textarea></div>' +
      photoBlockHtml("actividades", "Fotos — actividades") +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>Colindancias</h3>" +
      '<div class="field"><label for="colinda_posterior">Colinda por la parte posterior</label>' +
      '<input class="input" id="colinda_posterior" data-field-text="colinda_posterior" maxlength="2000" /></div>' +
      photoBlockHtml("colinda_posterior", "Fotos — colinda posterior") +
      '<div class="field"><label for="colinda_derecha">Colinda hacia la derecha</label>' +
      '<input class="input" id="colinda_derecha" data-field-text="colinda_derecha" maxlength="2000" /></div>' +
      photoBlockHtml("colinda_derecha", "Fotos — colinda derecha") +
      '<div class="field"><label for="colinda_izquierda">Colinda a la izquierda</label>' +
      '<input class="input" id="colinda_izquierda" data-field-text="colinda_izquierda" maxlength="2000" /></div>' +
      photoBlockHtml("colinda_izquierda", "Fotos — colinda izquierda") +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>Personal y dotación</h3>" +
      '<p style="margin:0 0 0.75rem;font-size:0.9rem;color:var(--color-text-muted)">Puestos de 12 horas</p>' +
      '<div class="as-field-row">' +
      '<div class="field"><label for="puestos_diurno_cantidad">Cantidad — turno diurno</label>' +
      '<input class="input" type="number" min="0" max="9999" id="puestos_diurno_cantidad" data-field="puestos_diurno_cantidad" value="0" /></div>' +
      '<div class="field"><label for="puestos_diurno_esquema">Característica especial del puesto (esquema) — diurno</label>' +
      '<input class="input" id="puestos_diurno_esquema" data-field="puestos_diurno_esquema" maxlength="500" placeholder="Ej. 4x3, 6x1…" /></div>' +
      "</div>" +
      photoBlockHtml("puestos_diurno_evidencia", "Fotos — puestos diurnos") +
      '<div class="as-field-row" style="margin-top:0.75rem">' +
      '<div class="field"><label for="puestos_nocturno_cantidad">Cantidad — turno nocturno</label>' +
      '<input class="input" type="number" min="0" max="9999" id="puestos_nocturno_cantidad" data-field="puestos_nocturno_cantidad" value="0" /></div>' +
      '<div class="field"><label for="puestos_nocturno_esquema">Característica especial del puesto (esquema) — nocturno</label>' +
      '<input class="input" id="puestos_nocturno_esquema" data-field="puestos_nocturno_esquema" maxlength="500" /></div>' +
      "</div>" +
      photoBlockHtml("puestos_nocturno_evidencia", "Fotos — puestos nocturnos") +
      '<div class="as-field-row" style="margin-top:0.75rem">' +
      '<div class="field"><label for="jefe_grupo">¿Cuentan con jefe de grupo?</label>' +
      '<select class="input" id="jefe_grupo" data-field="jefe_grupo">' +
      SI_NO_OPTS +
      "</select></div>" +
      '<div class="field"><label for="supervisor_residente">¿Cuentan con supervisor residente?</label>' +
      '<select class="input" id="supervisor_residente" data-field="supervisor_residente">' +
      SI_NO_OPTS +
      "</select></div>" +
      "</div>" +
      photoBlockHtml("jefe_grupo_evidencia", "Fotos — jefe de grupo") +
      photoBlockHtml("supervisor_residente_evidencia", "Fotos — supervisor residente") +
      '<div class="as-field-row" style="margin-top:0.75rem">' +
      '<div class="field"><label for="celulares">Equipos de comunicación (celulares) asignados</label>' +
      '<input class="input" type="number" min="0" max="9999" id="celulares" data-field="celulares" value="0" /></div>' +
      '<div class="field"><label for="radios">Equipos de comunicación (radios) asignados</label>' +
      '<input class="input" type="number" min="0" max="9999" id="radios" data-field="radios" value="0" /></div>' +
      "</div>" +
      photoBlockHtml("celulares_evidencia", "Fotos — celulares") +
      photoBlockHtml("radios_evidencia", "Fotos — radios") +
      '<div class="field" style="margin-top:0.75rem"><label for="otros_epp_text">Otros EPP asignados a la operación</label>' +
      '<textarea class="input" id="otros_epp_text" data-field-text="otros_epp" rows="3"></textarea></div>' +
      photoBlockHtml("otros_epp", "Fotos — otros EPP") +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>CCTV y cámaras</h3>" +
      '<div class="as-field-row">' +
      '<div class="field"><label for="camaras_total">¿Cuántas cámaras hay en la unidad?</label>' +
      '<input class="input" type="number" min="0" max="99999" id="camaras_total" data-field="camaras_total" value="0" /></div>' +
      '<div class="field"><label for="camaras_operativas">¿Cuántas cámaras están operativas?</label>' +
      '<input class="input" type="number" min="0" max="99999" id="camaras_operativas" data-field="camaras_operativas" value="0" /></div>' +
      "</div>" +
      photoBlockHtml("camaras_evidencia", "Fotos — cámaras") +
      '<div class="field" style="margin-top:0.75rem"><label for="personal_cctv">¿Cuentan con personal de CCTV?</label>' +
      '<select class="input" id="personal_cctv" data-field="personal_cctv">' +
      SI_NO_OPTS +
      "</select></div>" +
      '<div id="wrapCctvDetalle" hidden>' +
      '<div class="as-field-row">' +
      '<div class="field"><label for="cctv_liderman">¿El personal de CCTV es de Liderman?</label>' +
      '<select class="input" id="cctv_liderman" data-field="cctv_liderman">' +
      SI_NO_OPTS +
      "</select></div>" +
      '<div class="field"><label for="operadores_cctv">Operadores de CCTV en el equipo</label>' +
      '<input class="input" type="number" min="0" max="9999" id="operadores_cctv" data-field="operadores_cctv" value="0" /></div>' +
      "</div>" +
      "</div>" +
      photoBlockHtml("cctv_evidencia", "Fotos — CCTV") +
      "</section>" +

      '<section class="card as-form-section">' +
      "<h3>Documentación de acceso</h3>" +
      "<p style=\"margin:0 0 0.5rem;font-size:0.9rem;color:var(--color-text-muted)\">Señale a qué documentos tiene acceso el personal asignado a la operación:</p>" +
      docChecks +
      photoBlockHtml("documentos_evidencia", "Fotos — documentación") +
      "</section>";

    bindFormUi();
  }

  function bindFormUi() {
    var tipoSel = document.getElementById("tipo_instalacion");
    var wrapOtro = document.getElementById("wrapTipoOtro");
    if (tipoSel && wrapOtro) {
      tipoSel.addEventListener("change", function () {
        wrapOtro.hidden = tipoSel.value !== "otro";
      });
    }
    var persCctv = document.getElementById("personal_cctv");
    var wrapCctv = document.getElementById("wrapCctvDetalle");
    if (persCctv && wrapCctv) {
      function syncCctv() {
        wrapCctv.hidden = persCctv.value !== "si";
      }
      persCctv.addEventListener("change", syncCctv);
      syncCctv();
    }
  }

  function readPhotos(key) {
    var hid = document.querySelector('[data-photos="' + key + '"]');
    if (!hid) {
      return [];
    }
    try {
      var arr = JSON.parse(hid.value || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function setPhotos(key, urls) {
    var hid = document.querySelector('[data-photos="' + key + '"]');
    if (hid) {
      hid.value = JSON.stringify(urls || []);
    }
    renderPhotoPreview(key);
  }

  function renderPhotoPreview(key) {
    var box = document.querySelector('.js-as-preview[data-photo-key="' + key + '"]');
    if (!box) {
      return;
    }
    var urls = readPhotos(key);
    box.innerHTML = "";
    if (!urls.length) {
      var sp = document.createElement("span");
      sp.className = "photo-preview__empty";
      sp.textContent = "Sin fotos";
      box.appendChild(sp);
      return;
    }
    urls.forEach(function (url, idx) {
      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Foto " + (idx + 1);
      fig.appendChild(img);
      box.appendChild(fig);
    });
  }

  function readFieldText(key) {
    var el = document.querySelector('[data-field-text="' + key + '"]');
    return el ? String(el.value || "").trim() : "";
  }

  function readFieldValue(key) {
    var el = document.querySelector('[data-field="' + key + '"]');
    return el ? String(el.value || "").trim() : "";
  }

  function readCheckGroup(name) {
    var out = [];
    document.querySelectorAll('[data-check="' + name + '"]:checked').forEach(function (cb) {
      out.push(cb.value);
    });
    return out;
  }

  function fieldWithFotos(textKey, photoKey) {
    return {
      text: readFieldText(textKey),
      fotos: readPhotos(photoKey),
    };
  }

  function parseCountField(key) {
    var s = String(readFieldValue(key) || "").trim();
    if (s === "") {
      return 0;
    }
    var n = parseInt(s, 10);
    return isNaN(n) ? NaN : n;
  }

  function validateForm() {
    if (!selCliente.value) {
      return "Elige un cliente en datos generales.";
    }
    if (isProspectoSelected()) {
      if (!txtUnidadNombre || !String(txtUnidadNombre.value || "").trim()) {
        return "Indica el nombre del prospecto.";
      }
    } else if (!selUnidad.value) {
      return "Elige una unidad en datos generales.";
    }
    var camTot = parseCountField("camaras_total");
    var camOp = parseCountField("camaras_operativas");
    if (!isNaN(camTot) && !isNaN(camOp) && camOp > camTot) {
      return "Las cámaras operativas no pueden superar el total.";
    }
    return "";
  }

  function collectDatos() {
    return {
      razon_social: readFieldValue("razon_social"),
      ruc: readFieldValue("ruc"),
      giro_negocio: readFieldValue("giro_negocio"),
      ambientes: readCheckGroup("ambientes"),
      ambientes_evidencia: { text: "", fotos: readPhotos("ambientes_evidencia") },
      otros_ambientes: fieldWithFotos("otros_ambientes", "otros_ambientes"),
      tipo_instalacion: readFieldValue("tipo_instalacion"),
      tipo_instalacion_otro: readFieldValue("tipo_instalacion_otro"),
      tipo_instalacion_evidencia: { text: "", fotos: readPhotos("tipo_instalacion_evidencia") },
      actividades: fieldWithFotos("actividades", "actividades"),
      colinda_posterior: fieldWithFotos("colinda_posterior", "colinda_posterior"),
      colinda_derecha: fieldWithFotos("colinda_derecha", "colinda_derecha"),
      colinda_izquierda: fieldWithFotos("colinda_izquierda", "colinda_izquierda"),
      puestos_diurno: {
        cantidad: parseCountField("puestos_diurno_cantidad") || 0,
        esquema: readFieldValue("puestos_diurno_esquema"),
      },
      puestos_diurno_evidencia: { text: "", fotos: readPhotos("puestos_diurno_evidencia") },
      puestos_nocturno: {
        cantidad: parseCountField("puestos_nocturno_cantidad") || 0,
        esquema: readFieldValue("puestos_nocturno_esquema"),
      },
      puestos_nocturno_evidencia: { text: "", fotos: readPhotos("puestos_nocturno_evidencia") },
      jefe_grupo: readFieldValue("jefe_grupo"),
      jefe_grupo_evidencia: { text: "", fotos: readPhotos("jefe_grupo_evidencia") },
      supervisor_residente: readFieldValue("supervisor_residente"),
      supervisor_residente_evidencia: { text: "", fotos: readPhotos("supervisor_residente_evidencia") },
      celulares: parseCountField("celulares") || 0,
      celulares_evidencia: { text: "", fotos: readPhotos("celulares_evidencia") },
      radios: parseCountField("radios") || 0,
      radios_evidencia: { text: "", fotos: readPhotos("radios_evidencia") },
      otros_epp: fieldWithFotos("otros_epp", "otros_epp"),
      camaras_total: parseCountField("camaras_total") || 0,
      camaras_operativas: parseCountField("camaras_operativas") || 0,
      camaras_evidencia: { text: "", fotos: readPhotos("camaras_evidencia") },
      personal_cctv: readFieldValue("personal_cctv"),
      cctv_liderman: readFieldValue("personal_cctv") === "si" ? readFieldValue("cctv_liderman") : "",
      operadores_cctv:
        readFieldValue("personal_cctv") === "si"
          ? parseCountField("operadores_cctv") || 0
          : 0,
      cctv_evidencia: { text: "", fotos: readPhotos("cctv_evidencia") },
      documentos_acceso: readCheckGroup("documentos_acceso"),
      documentos_evidencia: { text: "", fotos: readPhotos("documentos_evidencia") },
    };
  }

  function resetForm() {
    formAnalisis.reset();
    document.querySelectorAll("[data-photos]").forEach(function (hid) {
      var key = hid.getAttribute("data-photos");
      setPhotos(key, []);
    });
    var wrapOtro = document.getElementById("wrapTipoOtro");
    if (wrapOtro) {
      wrapOtro.hidden = true;
    }
    var wrapCctv = document.getElementById("wrapCctvDetalle");
    if (wrapCctv) {
      wrapCctv.hidden = true;
    }
    document.querySelectorAll('[data-field="puestos_diurno_cantidad"], [data-field="puestos_nocturno_cantidad"], [data-field="celulares"], [data-field="radios"], [data-field="camaras_total"], [data-field="camaras_operativas"]').forEach(function (el) {
      el.value = "0";
    });
    if (txtUnidadNombre) {
      txtUnidadNombre.value = "";
    }
    syncUnidadProspectoUi();
  }

  async function cargarClientes() {
    selCliente.innerHTML = '<option value="">— Cargando —</option>';
    try {
      var res = await window.AppApi.get("listClientesSupervision", { caller: session.usuario });
      if (!res || res.status !== "success") {
        selCliente.innerHTML = '<option value="">— Error —</option>';
        showTop((res && res.message) || "No se pudieron cargar los clientes.");
        return;
      }
      var list = (res.data && res.data.clientes) || [];
      selCliente.innerHTML = '<option value="">— Elija cliente —</option>';
      list.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id_cliente;
        var suf = c.estado === "inactivo" ? " (inactivo)" : "";
        o.textContent = (c.cliente || c.id_cliente) + suf;
        selCliente.appendChild(o);
      });
      var oPros = document.createElement("option");
      oPros.value = prospectoId();
      oPros.textContent = "Prospecto de cliente";
      selCliente.appendChild(oPros);
    } catch (e) {
      selCliente.innerHTML = '<option value="">— Error —</option>';
      showTop("Error de red al cargar clientes.");
    }
  }

  async function cargarUnidades(idCliente) {
    syncUnidadProspectoUi();
    if (isProspectoSelected()) {
      return;
    }
    selUnidad.innerHTML = '<option value="">— Cargando —</option>';
    selUnidad.disabled = true;
    if (!idCliente) {
      selUnidad.innerHTML = '<option value="">— Elija primero un cliente —</option>';
      return;
    }
    try {
      var res = await window.AppApi.get("listUnidadesSupervision", {
        caller: session.usuario,
        idCliente: idCliente,
      });
      if (!res || res.status !== "success") {
        selUnidad.innerHTML = '<option value="">— Error —</option>';
        showTop((res && res.message) || "No se pudieron cargar las unidades.");
        return;
      }
      var list = (res.data && res.data.unidades) || [];
      selUnidad.innerHTML = '<option value="">— Elija unidad —</option>';
      list.forEach(function (u) {
        var o = document.createElement("option");
        o.value = u.id_unidad;
        o.textContent = u.unidad || u.id_unidad;
        selUnidad.appendChild(o);
      });
      selUnidad.disabled = false;
    } catch (e) {
      selUnidad.innerHTML = '<option value="">— Error —</option>';
      showTop("Error de red al cargar unidades.");
    }
  }

  formAnalisis.addEventListener("change", async function (ev) {
    var inp = ev.target;
    if (!inp || !inp.classList || !inp.classList.contains("js-as-photo")) {
      return;
    }
    var key = inp.getAttribute("data-photo-key");
    var st = document.querySelector('.js-as-photo-status[data-photo-key="' + key + '"]');
    if (!inp.files || !inp.files[0]) {
      return;
    }
    if (st) {
      st.textContent = "Subiendo…";
    }
    try {
      var url = await window.CloudinaryUpload.uploadImage(inp.files[0]);
      var urls = readPhotos(key);
      urls.push(url);
      setPhotos(key, urls);
      if (st) {
        st.textContent = urls.length + " foto(s).";
      }
    } catch (e) {
      if (st) {
        st.textContent = String(e.message || e);
      }
    }
    inp.value = "";
  });

  formAnalisis.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    hideTop();
    var err = validateForm();
    if (err) {
      showTop(err);
      return;
    }
    btnGuardar.disabled = true;
    try {
      var esProspecto = isProspectoSelected();
      var payload = {
        caller: session.usuario,
        registro: {
          id_cliente: selCliente.value,
          id_unidad: esProspecto ? prospectoId() : selUnidad.value,
          prospecto_nombre: esProspecto ? String(txtUnidadNombre.value || "").trim() : "",
          datos: collectDatos(),
        },
      };
      var res = await window.AppApi.postVerify(
        "submitAnalisisSeguridad",
        payload,
        "getPendingResult",
        18,
        400
      );
      if (!res || res.status !== "success") {
        showTop((res && res.message) || "No se pudo guardar.");
        return;
      }
      resetForm();
      showTop("Análisis de seguridad guardado. Puede registrar otro.", "success");
    } catch (e) {
      showTop("Error de red al guardar.");
    } finally {
      btnGuardar.disabled = false;
    }
  });

  selCliente.addEventListener("change", function () {
    syncUnidadProspectoUi();
    cargarUnidades(selCliente.value);
  });

  buildForm();
  syncUnidadProspectoUi();
  cargarClientes();
})();
