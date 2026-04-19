/**
 * KPIs — alta (POST) y listado (GET) por mes/año. Solo administrador.
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
  var tbody = document.getElementById("tbodyKpis");
  var formKpi = document.getElementById("formKpi");
  var fNombre = document.getElementById("fNombre");
  var fMeta = document.getElementById("fMeta");
  var fLogro = document.getElementById("fLogro");
  var fMes = document.getElementById("fMes");
  var fAnio = document.getElementById("fAnio");
  var filtAnio = document.getElementById("filtAnio");
  var filtMes = document.getElementById("filtMes");
  var btnGuardarKpi = document.getElementById("btnGuardarKpi");
  var btnKpiLabel = document.getElementById("btnKpiLabel");
  var btnKpiSpinner = document.getElementById("btnKpiSpinner");
  var btnRefrescar = document.getElementById("btnRefrescar");

  if (!window.AppAuth.isAdmin(session)) {
    blockNoAdmin.hidden = false;
    return;
  }

  blockAdmin.hidden = false;

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

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function fillMesSelect(sel) {
    sel.innerHTML = "";
    MESES.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.v;
      o.textContent = m.t;
      sel.appendChild(o);
    });
  }

  function fillAnioSelect(sel) {
    var y = new Date().getFullYear();
    sel.innerHTML = "";
    for (var i = y + 1; i >= y - 6; i--) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      if (i === y) {
        o.selected = true;
      }
      sel.appendChild(o);
    }
  }

  function applyMesAnioVigente() {
    var now = new Date();
    var m = String(now.getMonth() + 1);
    if (fMes) {
      fMes.value = m;
    }
    if (filtMes) {
      filtMes.value = m;
    }
  }

  function setFormLoading(on) {
    btnGuardarKpi.disabled = on;
    btnKpiLabel.hidden = on;
    btnKpiSpinner.hidden = !on;
  }

  function renderRows(list) {
    tbody.innerHTML = "";
    if (!list || !list.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "No hay KPIs para el año y mes seleccionados.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    list.forEach(function (k) {
      var tr = document.createElement("tr");
      var periodo = MESES[(k.mes || 1) - 1] ? MESES[k.mes - 1].t : "Mes " + k.mes;
      periodo += " " + (k.anio != null ? k.anio : "");
      [
        k.nombre || "—",
        periodo,
        k.meta_mensual != null ? String(k.meta_mensual) : "—",
        k.logro != null ? String(k.logro) : "—",
        k.pct_vs_meta != null && !isNaN(k.pct_vs_meta) ? k.pct_vs_meta + "%" : "—",
        k.usuario || "—",
        k.fecha_creacion || "—",
      ].forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function cargarLista() {
    hideMsg();
    loading.hidden = false;
    tbody.innerHTML = "";
    try {
      var res = await window.AppApi.get("listKPIs", {
        caller: session.usuario,
        anio: filtAnio.value,
        mes: filtMes.value,
      });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar la lista de KPIs.");
        loading.hidden = true;
        return;
      }
      renderRows((res.data && res.data.kpis) || []);
    } catch (e) {
      showMsg("Error de red al cargar KPIs.");
    }
    loading.hidden = true;
  }

  fillMesSelect(fMes);
  fillMesSelect(filtMes);
  fillAnioSelect(fAnio);
  fillAnioSelect(filtAnio);
  applyMesAnioVigente();

  btnRefrescar.addEventListener("click", cargarLista);
  filtAnio.addEventListener("change", cargarLista);
  filtMes.addEventListener("change", cargarLista);

  formKpi.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMsg();
    var nombre = fNombre.value.trim();
    var meta = parseFloat(String(fMeta.value).replace(",", "."));
    var logro = parseFloat(String(fLogro.value).replace(",", "."));
    var mes = parseInt(fMes.value, 10);
    var anio = parseInt(fAnio.value, 10);
    if (!nombre) {
      showMsg("Indique el nombre del KPI.");
      return;
    }
    if (isNaN(meta) || meta < 0) {
      showMsg("La meta mensual debe ser un número válido mayor o igual a 0.");
      return;
    }
    if (isNaN(logro) || logro < 0) {
      showMsg("El logro debe ser un número válido mayor o igual a 0.");
      return;
    }
    setFormLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "createKPI",
        {
          caller: session.usuario,
          kpi: {
            nombre: nombre,
            meta_mensual: meta,
            logro: logro,
            mes: mes,
            anio: anio,
          },
        },
        "getPendingResult",
        15,
        350
      );
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo guardar el KPI.");
        setFormLoading(false);
        return;
      }
      fNombre.value = "";
      fMeta.value = "";
      fLogro.value = "";
      showMsg("KPI guardado correctamente.", "success");
      filtAnio.value = fAnio.value;
      filtMes.value = String(mes);
      await cargarLista();
    } catch (err) {
      showMsg("Error de red. Intenta de nuevo.");
    }
    setFormLoading(false);
  });

  cargarLista();
})();
