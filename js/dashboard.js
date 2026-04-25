/**
 * Dashboard ejecutivo — Chart.js + getDashboardData (administrador y gerencia).
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
  var chkRango = document.getElementById("chkRango");
  var inpDesde = document.getElementById("inpDesde");
  var inpHasta = document.getElementById("inpHasta");
  var selAnio = document.getElementById("selAnio");
  var selMes = document.getElementById("selMes");
  var selCliente = document.getElementById("selCliente");
  var selUnidad = document.getElementById("selUnidad");
  var selSupervisor = document.getElementById("selSupervisor");
  var btnAplicar = document.getElementById("btnAplicar");
  var dashPeriodo = document.getElementById("dashPeriodo");
  var dashFiltersShell = document.getElementById("dashFiltersShell");
  var btnToggleFilters = document.getElementById("btnToggleFilters");

  if (!window.AppAuth.isDashboardViewer(session)) {
    blockNoAdmin.hidden = false;
    return;
  }

  blockAdmin.hidden = false;
  var pageInner = document.querySelector(".page-inner.dash-page");
  if (pageInner) {
    pageInner.classList.add("dash-page--pro");
  }

  function syncFiltersCollapseUi() {
    if (!btnToggleFilters || !dashFiltersShell) {
      return;
    }
    var collapsed = dashFiltersShell.classList.contains("is-collapsed");
    btnToggleFilters.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  if (btnToggleFilters && dashFiltersShell) {
    btnToggleFilters.addEventListener("click", function () {
      dashFiltersShell.classList.toggle("is-collapsed");
      syncFiltersCollapseUi();
    });
  }
  syncFiltersCollapseUi();

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "setTitle", title: "Panel ejecutivo" }, "*");
    }
  } catch (e) {
    /* ignore */
  }

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function setLoading(on) {
    loading.hidden = !on;
  }

  function setMiniBar(id, pct) {
    var el = document.getElementById(id);
    if (!el) {
      return;
    }
    var v = typeof pct === "number" && !isNaN(pct) ? pct : 0;
    v = Math.min(100, Math.max(0, v));
    el.style.width = v + "%";
  }

  function setMiniIncidentes(pn) {
    var bajo = pn && pn.bajo ? pn.bajo : 0;
    var medio = pn && pn.medio ? pn.medio : 0;
    var alto = pn && pn.alto ? pn.alto : 0;
    var total = bajo + medio + alto;
    setMiniBar("kpiIncMiniBajo", total > 0 ? (bajo / total) * 100 : 0);
    setMiniBar("kpiIncMiniMedio", total > 0 ? (medio / total) * 100 : 0);
    setMiniBar("kpiIncMiniAlto", total > 0 ? (alto / total) * 100 : 0);
  }

  function fmtPct(p) {
    if (p === null || p === undefined || typeof p !== "number" || isNaN(p)) {
      return "—";
    }
    return p.toFixed(2) + "%";
  }

  function fmtNum(n, dec) {
    if (n === null || n === undefined || typeof n !== "number" || isNaN(n)) {
      return "—";
    }
    var d = dec === undefined ? 2 : dec;
    return n.toFixed(d);
  }

  function fillYears() {
    var y = new Date().getFullYear();
    selAnio.innerHTML = "";
    for (var i = y + 1; i >= y - 5; i--) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      if (i === y) {
        o.selected = true;
      }
      selAnio.appendChild(o);
    }
  }

  /** Mes y año calendario actuales (sin rango personalizado). */
  function applyDefaultMonthFilters() {
    var now = new Date();
    var m = String(now.getMonth() + 1);
    if (selMes && selMes.querySelector('option[value="' + m + '"]')) {
      selMes.value = m;
    }
    if (chkRango) {
      chkRango.checked = false;
    }
    if (inpDesde) {
      inpDesde.value = "";
    }
    if (inpHasta) {
      inpHasta.value = "";
    }
  }

  function toggleRangoUi() {
    var on = chkRango.checked;
    inpDesde.disabled = !on;
    inpHasta.disabled = !on;
    selMes.disabled = on;
    selAnio.disabled = on;
  }

  function formatPeriodoLabel(data) {
    if (!data || !data.periodo) {
      return "";
    }
    var a = new Date(data.periodo.inicio_ms);
    var b = new Date(data.periodo.fin_ms);
    var opt = { day: "2-digit", month: "short", year: "numeric" };
    try {
      return (
        "Periodo: " +
        a.toLocaleDateString("es-PE", opt) +
        " — " +
        b.toLocaleDateString("es-PE", opt) +
        " · fracción de mes para rondas: " +
        (data.periodo.meses_fraccion != null ? data.periodo.meses_fraccion : "—")
      );
    } catch (e2) {
      return "";
    }
  }

  function collectRadarSeries(sp) {
    if (!sp) {
      return { labels: [], values: [] };
    }
    var pairs = [
      ["Uniforme", sp.presentacion && sp.presentacion.uniforme],
      ["Aseo", sp.presentacion && sp.presentacion.aseo],
      ["Func. generales", sp.conocimiento && sp.conocimiento.funciones_generales],
      ["Func. específicas", sp.conocimiento && sp.conocimiento.funciones_especificas],
      ["Func. documentadas", sp.documentacion && sp.documentacion.funciones_puesto_documentadas],
      ["Cuaderno ocurrencias", sp.documentacion && sp.documentacion.cuaderno_ocurrencias],
      ["Personal seguridad", sp.percepcion_cliente && sp.percepcion_cliente.personal_seguridad],
      ["Supervisor (perc.)", sp.percepcion_cliente && sp.percepcion_cliente.supervisor],
      ["Resp. administrativa", sp.percepcion_cliente && sp.percepcion_cliente.respuesta_administrativa],
    ];
    var labels = [];
    var values = [];
    pairs.forEach(function (p) {
      var v = p[1];
      if (v !== null && v !== undefined && typeof v === "number" && !isNaN(v)) {
        labels.push(p[0]);
        values.push(v);
      }
    });
    return { labels: labels, values: values };
  }

  function avgOfValues(arr) {
    var s = 0;
    var n = 0;
    arr.forEach(function (v) {
      if (typeof v === "number" && !isNaN(v)) {
        s += v;
        n++;
      }
    });
    if (!n) {
      return null;
    }
    return Math.round((s / n) * 100) / 100;
  }

  function buildQueryParams() {
    var p = { caller: session.usuario, anio: selAnio.value };
    if (chkRango.checked) {
      if (inpDesde.value && inpHasta.value) {
        p.fechaDesde = inpDesde.value;
        p.fechaHasta = inpHasta.value;
      }
    } else if (selMes.value) {
      p.mes = selMes.value;
    }
    if (selCliente.value) {
      p.idCliente = selCliente.value;
    }
    if (selUnidad.value) {
      p.idUnidad = selUnidad.value;
    }
    if (selSupervisor.value) {
      p.supervisor = selSupervisor.value;
    }
    return p;
  }

  function renderKpis(data) {
    var c = data.cumplimiento && data.cumplimiento.global;
    var pctCumpl = c && c.pct;
    document.getElementById("kpiCumplPct").textContent = fmtPct(pctCumpl);
    document.getElementById("kpiCumplDetalle").textContent =
      c && c.rondas_esperadas != null
        ? "Realizadas: " +
          (c.supervisiones_realizadas != null ? c.supervisiones_realizadas : "—") +
          " · Esperadas (periodo): " +
          fmtNum(c.rondas_esperadas, 2)
        : "";
    setMiniBar("kpiCumplMini", pctCumpl);

    document.getElementById("kpiSupCount").textContent =
      c && c.supervisiones_realizadas != null ? String(c.supervisiones_realizadas) : "—";
    document.getElementById("kpiSupMeta").textContent =
      c && c.rondas_esperadas != null
        ? "Esperadas en periodo: " + fmtNum(c.rondas_esperadas, 2)
        : "";
    setMiniBar("kpiSupMini", pctCumpl);

    var inc = data.incidentes;
    document.getElementById("kpiIncCount").textContent =
      inc && inc.registros != null ? String(inc.registros) : "—";
    var pn = inc && inc.por_nivel;
    document.getElementById("kpiIncNivel").textContent = pn
      ? "Alto: " + (pn.alto || 0) + " · Medio: " + (pn.medio || 0) + " · Bajo: " + (pn.bajo || 0)
      : "";
    setMiniIncidentes(pn);
  }

  var MESES_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  function mesCorto(m) {
    var i = parseInt(String(m), 10);
    return MESES_CORTO[i] || String(m);
  }

  function createMiniDonut(value) {
    var wrap = document.createElement("div");
    wrap.className = "dash-kpi-mini dash-kpi-mini--donut";
    var v = typeof value === "number" && !isNaN(value) ? Math.min(100, Math.max(0, value)) : 0;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    var track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("cx", "18");
    track.setAttribute("cy", "18");
    track.setAttribute("r", "15.5");
    track.setAttribute("class", "mini-donut-track");
    var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", "18");
    ring.setAttribute("cy", "18");
    ring.setAttribute("r", "15.5");
    ring.setAttribute("class", "mini-donut-ring");
    var circ = 2 * Math.PI * 15.5;
    ring.setAttribute("stroke-dasharray", String(circ));
    ring.setAttribute("stroke-dashoffset", String(circ * (1 - v / 100)));
    svg.appendChild(track);
    svg.appendChild(ring);
    wrap.appendChild(svg);
    return wrap;
  }

  function createMiniViz(k) {
    var pct = k && typeof k.pct_vs_meta === "number" && !isNaN(k.pct_vs_meta) ? k.pct_vs_meta : 0;
    return createMiniDonut(pct);
  }

  function renderKpisTarjetas(data) {
    var wrap = document.getElementById("dashKpisTarjetas");
    if (!wrap) {
      return;
    }
    var list = (data && data.kpis) || [];
    wrap.innerHTML = "";
    if (!list.length) {
      var p = document.createElement("p");
      p.className = "dash-muted dash-kpis-empty";
      p.textContent =
        "No hay KPIs del libro ni datos de control de servicio para el periodo y filtros seleccionados. Use el módulo KPIs o Control de servicio (por mes, cliente y unidad).";
      wrap.appendChild(p);
      return;
    }
    list.forEach(function (k) {
      var art = document.createElement("article");
      art.className = "dash-card dash-card--kpi dash-kpi-card";
      var idKpi = String((k && k.id_kpi) || "").toLowerCase();
      if (idKpi === "cs_cobertura_dia" || idKpi === "cs_cobertura_noche") {
        art.classList.add("dash-kpi-card--coverage-highlight");
      }
      var pct = k.pct_vs_meta;
      var pctStr = fmtPct(pct);
      var barVal = k.bar_pct;
      if ((barVal === null || barVal === undefined || typeof barVal !== "number" || isNaN(barVal)) && pct != null && typeof pct === "number" && !isNaN(pct)) {
        barVal = Math.min(100, Math.max(0, pct));
      }
      var h3 = document.createElement("h3");
      h3.textContent = k.nombre || "KPI";
      var main = document.createElement("div");
      main.className = "dash-kpi-card__main";
      var left = document.createElement("div");
      left.className = "dash-kpi-card__left";
      var right = document.createElement("div");
      right.className = "dash-kpi-card__right";
      var metric = document.createElement("div");
      metric.className = "metric";
      metric.textContent = pctStr;
      var barWrap = document.createElement("div");
      barWrap.className = "dash-kpi-card__bar-wrap";
      barWrap.setAttribute("aria-hidden", "true");
      var barFill = document.createElement("div");
      barFill.className = "dash-kpi-card__bar-fill";
      if (barVal != null && typeof barVal === "number" && !isNaN(barVal)) {
        barFill.style.width = barVal + "%";
      } else {
        barFill.style.width = "0%";
      }
      barWrap.appendChild(barFill);
      var note = document.createElement("p");
      note.className = "dash-card-note";
      if (k.kpi_fuente === "control_servicio" && k.detalle_linea) {
        note.textContent = k.detalle_linea;
      } else {
        note.innerHTML =
          "Logro <strong>" +
          escapeHtml(String(k.logro != null ? k.logro : "—")) +
          "</strong> / meta <strong>" +
          escapeHtml(String(k.meta_mensual != null ? k.meta_mensual : "—")) +
          "</strong><br/>" +
          escapeHtml(mesCorto(k.mes) + " " + (k.anio != null ? k.anio : ""));
      }
      left.appendChild(metric);
      left.appendChild(note);
      right.appendChild(createMiniViz(k));
      main.appendChild(left);
      main.appendChild(right);
      art.appendChild(h3);
      art.appendChild(main);
      art.appendChild(barWrap);
      wrap.appendChild(art);
    });
  }

  function renderPanelAlto(list) {
    var el = document.getElementById("panelAlto");
    if (!list || !list.length) {
      el.innerHTML = '<p class="dash-muted">No hay incidentes de riesgo alto en el periodo filtrado.</p>';
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "dash-alto-list";
    list.forEach(function (u) {
      var li = document.createElement("li");
      li.innerHTML =
        "<strong>" +
        escapeHtml(u.unidad || u.id_unidad || "—") +
        "</strong> <span class=\"dash-muted\">(" +
        escapeHtml(u.cliente || "") +
        ")</span> — " +
        (u.cantidad || 0) +
        " incidente(s)";
      ul.appendChild(li);
    });
    el.innerHTML = "";
    el.appendChild(ul);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCharts(data) {
    // Este dashboard puede operar solo con tarjetas KPI.
    // Si no hay Chart.js o no existen canvases de gráficos, no mostramos error.
    if (typeof Chart === "undefined") {
      return;
    }
    if (!document.getElementById("chartCumplimiento")) {
      return;
    }

    var cumpl = (data.cumplimiento && data.cumplimiento.por_unidad) || [];
    var labelsU = cumpl.map(function (u) {
      var c = (u.cliente || "").slice(0, 18);
      var un = (u.unidad || "").slice(0, 22);
      return (c ? c + " / " : "") + un;
    });
    var pctU = cumpl.map(function (u) {
      return u.pct_cumplimiento != null ? u.pct_cumplimiento : 0;
    });

    if (charts.cumpl) charts.cumpl.destroy();
    var nU = labelsU.length;
    charts.cumpl = new Chart(document.getElementById("chartCumplimiento"), {
      type: "line",
      data: {
        labels: labelsU,
        datasets: [
          {
            label: "% cumplimiento",
            data: pctU,
            borderColor: "rgba(94, 160, 255, 1)",
            backgroundColor: "rgba(61, 139, 253, 0.18)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: nU > 24 ? 2 : nU > 12 ? 3 : 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "rgba(61, 139, 253, 0.95)",
            pointBorderColor: "rgba(15, 20, 25, 0.9)",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0,
            max: 100,
            border: { display: false },
            grid: { color: chartGridColor(), drawTicks: false },
            ticks: {
              callback: function (v) {
                return v + "%";
              },
            },
          },
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              maxRotation: 55,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: nU > 30 ? 16 : 24,
            },
          },
        },
      },
    });

    var g = data.cumplimiento && data.cumplimiento.global;
    var espVal = g && g.rondas_esperadas != null ? g.rondas_esperadas : 0;
    var realVal = g && g.supervisiones_realizadas != null ? g.supervisiones_realizadas : 0;
    renderGaugeRondas(espVal, realVal);

    var sp = data.supervision_promedios;
    var rad = collectRadarSeries(sp);
    if (charts.radar) charts.radar.destroy();
    var canvasRadar = document.getElementById("chartRadar");
    if (rad.labels.length) {
      charts.radar = new Chart(canvasRadar, {
        type: "radar",
        data: {
          labels: rad.labels,
          datasets: [
            {
              label: "Promedio",
              data: rad.values,
              fill: true,
              backgroundColor: "rgba(61, 139, 253, 0.25)",
              borderColor: "rgba(120, 185, 255, 1)",
              borderWidth: 2,
              pointBackgroundColor: "rgba(61, 139, 253, 1)",
              pointBorderColor: "#0f1419",
              pointBorderWidth: 2,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: 1,
              max: 5,
              ticks: { stepSize: 1, color: "#8b9cb3" },
              grid: { color: chartGridColor() },
              angleLines: { color: "rgba(61, 139, 253, 0.2)" },
              pointLabels: { font: { size: 11, weight: 500 }, color: "#b4c0d4" },
            },
          },
        },
      });
    } else if (canvasRadar && canvasRadar.getContext) {
      var crx = canvasRadar.getContext("2d");
      if (crx) crx.clearRect(0, 0, canvasRadar.width, canvasRadar.height);
    }

    var cs = sp && sp.carnet_sucamec;
    if (charts.carnet) charts.carnet.destroy();
    charts.carnet = new Chart(document.getElementById("chartCarnet"), {
      type: "doughnut",
      data: {
        labels: ["Cumple", "No cumple", "Otros / vacío"],
        datasets: [
          {
            data: [cs && cs.cumple ? cs.cumple : 0, cs && cs.no_cumple ? cs.no_cumple : 0, cs && cs.otros_o_vacio ? cs.otros_o_vacio : 0],
            backgroundColor: ["#2ee59b", "#ff5c57", "#6b7a90"],
            borderWidth: 2,
            borderColor: "#121a26",
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: { legend: { position: "bottom" } },
      },
    });

    var pn = (data.incidentes && data.incidentes.por_nivel) || {};
    if (charts.incNivel) charts.incNivel.destroy();
    charts.incNivel = new Chart(document.getElementById("chartIncNivel"), {
      type: "bar",
      data: {
        labels: ["Bajo", "Medio", "Alto"],
        datasets: [
          {
            label: "Cantidad",
            data: [pn.bajo || 0, pn.medio || 0, pn.alto || 0],
            backgroundColor: ["rgba(46, 220, 130, 0.88)", "rgba(255, 200, 60, 0.9)", "rgba(255, 95, 85, 0.9)"],
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { border: { display: false }, grid: { display: false } },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: chartGridColor() },
            ticks: {
              callback: function (val) {
                return Number.isFinite(val) ? Math.round(val) : val;
              },
            },
          },
        },
      },
    });

    var pt = (data.incidentes && data.incidentes.por_tipo) || {};
    if (charts.incTipo) charts.incTipo.destroy();
    charts.incTipo = new Chart(document.getElementById("chartIncTipo"), {
      type: "bar",
      data: {
        labels: ["Amenaza", "Vulnerabilidad", "Condición insegura"],
        datasets: [
          {
            label: "Cantidad",
            data: [pt.amenaza || 0, pt.vulnerabilidad || 0, pt.condicion_insegura || 0],
            backgroundColor: "rgba(80, 155, 255, 0.75)",
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { border: { display: false }, grid: { display: false } },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: chartGridColor() },
            ticks: {
              callback: function (val) {
                return Number.isFinite(val) ? Math.round(val) : val;
              },
            },
          },
        },
      },
    });

    renderPanelAlto((data.incidentes && data.incidentes.unidades_riesgo_alto) || []);
  }

  async function cargarClientes() {
    try {
      var res = await window.AppApi.get("listClientes", { caller: session.usuario });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.clientes) || [];
      selCliente.innerHTML = '<option value="">Todos</option>';
      list.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id_cliente;
        o.textContent = c.cliente || c.id_cliente;
        selCliente.appendChild(o);
      });
    } catch (e) {
      /* silent on init */
    }
  }

  async function cargarSupervisores() {
    try {
      var res = await window.AppApi.get("listSupervisores", { caller: session.usuario });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.supervisores) || [];
      selSupervisor.innerHTML = '<option value="">Todos</option>';
      list.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.usuario;
        o.textContent = (s.nombres || s.usuario) + " (" + s.usuario + ")";
        selSupervisor.appendChild(o);
      });
    } catch (e) {
      /* silent */
    }
  }

  async function cargarUnidadesPorCliente(idCliente) {
    selUnidad.innerHTML = '<option value="">Todas</option>';
    if (!idCliente) {
      selUnidad.disabled = true;
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
      /* silent */
    }
  }

  function periodoFiltrosValido(silent) {
    if (chkRango.checked && (!inpDesde.value || !inpHasta.value)) {
      if (!silent) {
        showMsg("Si usa rango de fechas, indique «Desde» y «Hasta».");
      }
      return false;
    }
    return true;
  }

  async function refrescarDashboard(opts) {
    var silent = opts && opts.silent;
    hideMsg();
    if (!periodoFiltrosValido(silent)) {
      return;
    }
    setLoading(true);
    try {
      var res = await window.AppApi.get("getDashboardData", buildQueryParams());
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudieron cargar los datos del dashboard.");
        setLoading(false);
        return;
      }
      var d = res.data;
      dashPeriodo.textContent = formatPeriodoLabel(d);
      renderKpis(d);
      renderKpisTarjetas(d);
      renderCharts(d);
    } catch (e) {
      showMsg("Error de red al consultar el dashboard.");
    }
    setLoading(false);
  }

  function aplicarFiltrosAuto() {
    refrescarDashboard({ silent: true });
  }

  fillYears();
  applyDefaultMonthFilters();
  toggleRangoUi();

  chkRango.addEventListener("change", function () {
    toggleRangoUi();
    aplicarFiltrosAuto();
  });

  selAnio.addEventListener("change", aplicarFiltrosAuto);
  selMes.addEventListener("change", aplicarFiltrosAuto);
  inpDesde.addEventListener("change", aplicarFiltrosAuto);
  inpHasta.addEventListener("change", aplicarFiltrosAuto);
  selUnidad.addEventListener("change", aplicarFiltrosAuto);
  selSupervisor.addEventListener("change", aplicarFiltrosAuto);

  selCliente.addEventListener("change", async function () {
    await cargarUnidadesPorCliente(selCliente.value);
    aplicarFiltrosAuto();
  });

  btnAplicar.addEventListener("click", function () {
    refrescarDashboard({ silent: false });
  });

  cargarClientes();
  cargarSupervisores();
  cargarUnidadesPorCliente("");
  refrescarDashboard({ silent: false });
})();
