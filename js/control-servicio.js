/**
 * Control de servicio — cuadrícula por día, por cliente y unidad (solo administrador).
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockNoAdmin = document.getElementById("blockNoAdmin");
  var blockAdmin = document.getElementById("blockAdmin");
  var msg = document.getElementById("msg");
  var loading = document.getElementById("loading");
  var selCliente = document.getElementById("selCliente");
  var selUnidad = document.getElementById("selUnidad");
  var selMes = document.getElementById("selMes");
  var selAnio = document.getElementById("selAnio");
  var btnPlanPersonal = document.getElementById("btnPlanPersonal");
  var planPersonalResumen = document.getElementById("planPersonalResumen");
  var btnCargar = document.getElementById("btnCargar");
  var wrapGrid = document.getElementById("wrapGrid");
  var tblGrid = document.getElementById("tblGrid");
  var btnGuardar = document.getElementById("btnGuardar");
  var btnGuardarLabel = document.getElementById("btnGuardarLabel");
  var btnGuardarSpinner = document.getElementById("btnGuardarSpinner");
  var dlgPlanPersonal = document.getElementById("dlgPlanPersonal");
  var tblPlanPersonal = document.getElementById("tblPlanPersonal");
  var btnPlanCancelar = document.getElementById("btnPlanCancelar");
  var btnPlanGuardar = document.getElementById("btnPlanGuardar");

  if (!window.AppAuth.isAdmin(session)) {
    blockNoAdmin.hidden = false;
    return;
  }

  blockAdmin.hidden = false;

  var TIPOS = ["asistencias_dia", "asistencias_noche", "faltas", "suspensiones", "permisos", "vacaciones", "descanso_medico", "bajas"];
  var LABELS = {
    asistencias_dia: "Asistencias día",
    asistencias_noche: "Asistencias noche",
    faltas: "Faltas",
    suspensiones: "Suspensiones",
    permisos: "Permisos",
    vacaciones: "Vacaciones",
    descanso_medico: "Descanso médico",
    bajas: "Bajas",
  };

  var MESES = [
    { v: "1", t: "Enero" },
    { v: "2", t: "Febrero" },
    { v: "3", t: "Marzo" },
    { v: "4", t: "Abril" },
    { v: "5", t: "Mayo" },
    { v: "6", t: "Junio" },
    { v: "7", t: "Julio" },
    { v: "8", t: "Agosto" },
    { v: "9", t: "Septiembre" },
    { v: "10", t: "Octubre" },
    { v: "11", t: "Noviembre" },
    { v: "12", t: "Diciembre" },
  ];

  var diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var diasSemanaPlan = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  var stateDias = 0;
  var statePlanPersonal = makeDefaultPlanPersonal();

  function makeDefaultPlanPersonal() {
    return {
      dia: [0, 0, 0, 0, 0, 0, 0],
      noche: [0, 0, 0, 0, 0, 0, 0],
    };
  }

  function normalizePlanPersonal(src) {
    var out = makeDefaultPlanPersonal();
    if (!src || typeof src !== "object") {
      return out;
    }
    ["dia", "noche"].forEach(function (turno) {
      var inArr = src[turno];
      if (!inArr || !(inArr instanceof Array)) {
        return;
      }
      for (var i = 0; i < 7; i++) {
        var n = Number(inArr[i]);
        if (isNaN(n) || n < 0) {
          n = 0;
        }
        out[turno][i] = Math.round(n);
      }
    });
    return out;
  }

  function buildPlanTable() {
    tblPlanPersonal.innerHTML = "";
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var th0 = document.createElement("th");
    th0.textContent = "Turno";
    trh.appendChild(th0);
    diasSemanaPlan.forEach(function (d) {
      var th = document.createElement("th");
      th.textContent = d;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tblPlanPersonal.appendChild(thead);

    var tbody = document.createElement("tbody");
    [
      { key: "dia", label: "Día" },
      { key: "noche", label: "Noche" },
    ].forEach(function (turno) {
      var tr = document.createElement("tr");
      var tdLbl = document.createElement("td");
      tdLbl.style.fontWeight = "600";
      tdLbl.textContent = turno.label;
      tr.appendChild(tdLbl);
      for (var i = 0; i < 7; i++) {
        var td = document.createElement("td");
        td.style.padding = "0.25rem";
        var inp = document.createElement("input");
        inp.type = "number";
        inp.min = "0";
        inp.step = "1";
        inp.className = "input";
        inp.style.width = "4.2rem";
        inp.style.padding = "0.25rem 0.35rem";
        inp.setAttribute("data-turno", turno.key);
        inp.setAttribute("data-dow", String(i));
        inp.value = String(statePlanPersonal[turno.key][i] || 0);
        td.appendChild(inp);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    tblPlanPersonal.appendChild(tbody);
  }

  function readPlanTable() {
    var out = makeDefaultPlanPersonal();
    ["dia", "noche"].forEach(function (turno) {
      for (var i = 0; i < 7; i++) {
        var inp = tblPlanPersonal.querySelector('input[data-turno="' + turno + '"][data-dow="' + i + '"]');
        var n = inp ? Number(String(inp.value).replace(",", ".")) : 0;
        if (isNaN(n) || n < 0) {
          n = 0;
        }
        out[turno][i] = Math.round(n);
      }
    });
    return out;
  }

  function renderPlanResumen() {
    var sumDia = 0;
    var sumNoche = 0;
    for (var i = 0; i < 7; i++) {
      sumDia += Number(statePlanPersonal.dia[i]) || 0;
      sumNoche += Number(statePlanPersonal.noche[i]) || 0;
    }
    planPersonalResumen.textContent =
      "Turno día (semana): " +
      sumDia +
      " · Turno noche (semana): " +
      sumNoche;
  }

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function fillMesSelect() {
    selMes.innerHTML = "";
    MESES.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.v;
      o.textContent = m.t;
      selMes.appendChild(o);
    });
  }

  function fillAnioSelect() {
    var y = new Date().getFullYear();
    selAnio.innerHTML = "";
    for (var i = y + 1; i >= y - 6; i--) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      if (i === y) {
        o.selected = true;
      }
      selAnio.appendChild(o);
    }
  }

  function applyMesActual() {
    var m = String(new Date().getMonth() + 1);
    selMes.value = m;
  }

  function headerLabelDia(anio, mes, dia) {
    var dt = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, dia);
    return dia + "<br><small>" + diasSemana[dt.getDay()] + "</small>";
  }

  function buildGrid(dMax, detalle, planPersonal) {
    tblGrid.innerHTML = "";
    stateDias = dMax;
    statePlanPersonal = normalizePlanPersonal(planPersonal);
    renderPlanResumen();

    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var th0 = document.createElement("th");
    th0.textContent = "Concepto";
    th0.style.minWidth = "9rem";
    trh.appendChild(th0);
    var anio = selAnio.value;
    var mes = selMes.value;
    for (var d = 1; d <= dMax; d++) {
      var th = document.createElement("th");
      th.innerHTML = headerLabelDia(anio, mes, d);
      th.style.textAlign = "center";
      th.style.fontSize = "0.8rem";
      th.style.whiteSpace = "nowrap";
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    tblGrid.appendChild(thead);

    var tbody = document.createElement("tbody");
    TIPOS.forEach(function (tipo, idxTipo) {
      var tr = document.createElement("tr");
      if (idxTipo === 1) {
        tr.className = "control-srv-row-divider";
      }
      var tdL = document.createElement("td");
      tdL.textContent = LABELS[tipo] || tipo;
      tdL.style.fontWeight = "600";
      tr.appendChild(tdL);
      var vals = (detalle && detalle[tipo]) || [];
      for (var d = 1; d <= dMax; d++) {
        var td = document.createElement("td");
        td.style.padding = "0.25rem";
        var inp = document.createElement("input");
        inp.type = "number";
        inp.min = "0";
        inp.step = "1";
        inp.className = "input";
        inp.style.width = "3rem";
        inp.style.minWidth = "2.5rem";
        inp.style.padding = "0.25rem 0.35rem";
        inp.setAttribute("data-tipo", tipo);
        inp.setAttribute("data-dia", String(d));
        var v = vals[d - 1];
        inp.value = v != null && !isNaN(Number(v)) ? String(Number(v)) : "0";
        td.appendChild(inp);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    tblGrid.appendChild(tbody);
  }

  function collectDetalle() {
    var out = {};
    TIPOS.forEach(function (tipo) {
      out[tipo] = [];
    });
    for (var d = 1; d <= stateDias; d++) {
      TIPOS.forEach(function (tipo) {
        var inp = tblGrid.querySelector('input[data-tipo="' + tipo + '"][data-dia="' + d + '"]');
        var n = inp ? parseFloat(String(inp.value).replace(",", ".")) : 0;
        if (isNaN(n) || n < 0) {
          n = 0;
        }
        out[tipo].push(Math.round(n));
      });
    }
    return out;
  }

  function idsClienteUnidadOk() {
    return !!(selCliente.value && selUnidad.value);
  }

  async function cargarClientes() {
    selCliente.innerHTML = '<option value="">— Cliente —</option>';
    try {
      var res = await window.AppApi.get("listClientes", { caller: session.usuario });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.clientes) || [];
      list.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id_cliente;
        o.textContent = c.cliente || c.id_cliente;
        selCliente.appendChild(o);
      });
    } catch (e) {
      /* ignore */
    }
  }

  async function cargarUnidades(idCliente) {
    selUnidad.innerHTML = '<option value="">— Unidad —</option>';
    selUnidad.disabled = true;
    if (!idCliente) {
      return;
    }
    selUnidad.disabled = false;
    try {
      var res = await window.AppApi.get("listUnidades", {
        caller: session.usuario,
        idCliente: idCliente,
      });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.unidades) || [];
      list.forEach(function (u) {
        var o = document.createElement("option");
        o.value = u.id_unidad;
        o.textContent = u.unidad || u.id_unidad;
        selUnidad.appendChild(o);
      });
    } catch (e) {
      /* ignore */
    }
  }

  async function cargarPeriodo() {
    hideMsg();
    if (!idsClienteUnidadOk()) {
      wrapGrid.hidden = true;
      stateDias = 0;
      showMsg("Seleccione cliente y unidad para cargar o guardar la cuadrícula.");
      return;
    }
    wrapGrid.hidden = true;
    loading.hidden = false;
    var anio = parseInt(selAnio.value, 10);
    var mes = parseInt(selMes.value, 10);
    try {
      var res = await window.AppApi.get("getControlServicio", {
        caller: session.usuario,
        anio: String(anio),
        mes: String(mes),
        idCliente: selCliente.value,
        idUnidad: selUnidad.value,
      });
      if (!res || res.status !== "success" || !res.data) {
        showMsg((res && res.message) || "No se pudo cargar el control de servicio.");
        loading.hidden = true;
        return;
      }
      var d = res.data.dias_en_mes || 31;
      buildGrid(d, res.data.detalle, res.data.plan_personal);
      wrapGrid.hidden = false;
    } catch (e) {
      showMsg("Error de red al cargar.");
    }
    loading.hidden = true;
  }

  function setGuardarLoading(on) {
    btnGuardar.disabled = on;
    btnGuardarLabel.hidden = on;
    btnGuardarSpinner.hidden = !on;
  }

  fillMesSelect();
  fillAnioSelect();
  applyMesActual();

  selCliente.addEventListener("change", async function () {
    wrapGrid.hidden = true;
    stateDias = 0;
    hideMsg();
    await cargarUnidades(selCliente.value);
  });

  selUnidad.addEventListener("change", function () {
    if (idsClienteUnidadOk()) {
      cargarPeriodo();
    } else {
      wrapGrid.hidden = true;
      stateDias = 0;
    }
  });

  selMes.addEventListener("change", function () {
    if (idsClienteUnidadOk()) {
      cargarPeriodo();
    }
  });

  selAnio.addEventListener("change", function () {
    if (idsClienteUnidadOk()) {
      cargarPeriodo();
    }
  });

  btnCargar.addEventListener("click", cargarPeriodo);

  btnPlanPersonal.addEventListener("click", function () {
    if (!dlgPlanPersonal || !dlgPlanPersonal.showModal) {
      showMsg("Este navegador no soporta el modal de configuración.");
      return;
    }
    buildPlanTable();
    dlgPlanPersonal.showModal();
  });

  btnPlanCancelar.addEventListener("click", function () {
    if (dlgPlanPersonal && dlgPlanPersonal.open) {
      dlgPlanPersonal.close();
    }
  });

  btnPlanGuardar.addEventListener("click", function () {
    statePlanPersonal = readPlanTable();
    renderPlanResumen();
    if (dlgPlanPersonal && dlgPlanPersonal.open) {
      dlgPlanPersonal.close();
    }
  });

  btnGuardar.addEventListener("click", async function () {
    hideMsg();
    if (!idsClienteUnidadOk()) {
      showMsg("Seleccione cliente y unidad.");
      return;
    }
    if (!stateDias) {
      showMsg("Cargue la cuadrícula (mes y año) antes de guardar.");
      return;
    }
    var detalle = collectDetalle();
    var anio = parseInt(selAnio.value, 10);
    var mes = parseInt(selMes.value, 10);
    setGuardarLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "saveControlServicio",
        {
          caller: session.usuario,
          id_cliente: selCliente.value,
          id_unidad: selUnidad.value,
          anio: anio,
          mes: mes,
          plan_personal: statePlanPersonal,
          detalle: detalle,
        },
        "getPendingResult",
        15,
        350
      );
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo guardar.");
        setGuardarLoading(false);
        return;
      }
      showMsg("Datos guardados. Puede cambiar de unidad o seguir editando.", "success");
      await cargarPeriodo();
    } catch (err) {
      showMsg("Error de red. Intenta de nuevo.");
    }
    setGuardarLoading(false);
  });

  cargarClientes();
})();
