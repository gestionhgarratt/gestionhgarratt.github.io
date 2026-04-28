/**
 * Listas de capacitación — filtros y exportación.
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
  var tbody = document.getElementById("tbodyReg");
  var fTema = document.getElementById("fTema");
  var fDoc = document.getElementById("fDoc");
  var fNom = document.getElementById("fNom");
  var fCliente = document.getElementById("fCliente");
  var fUnidad = document.getElementById("fUnidad");
  var fDesde = document.getElementById("fDesde");
  var fHasta = document.getElementById("fHasta");
  var btnFiltrar = document.getElementById("btnFiltrar");
  var btnExportar = document.getElementById("btnExportar");
  var lastRows = [];

  if (!window.AppAuth.isAdmin(session)) {
    blockNoAdmin.hidden = false;
    return;
  }
  blockAdmin.hidden = false;

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }
  function hideMsg() {
    msg.hidden = true;
  }

  function renderRows(list) {
    lastRows = list || [];
    tbody.innerHTML = "";
    if (!list || !list.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 7;
      td.style.color = "var(--color-text-muted)";
      td.textContent = "No hay registros para los filtros seleccionados.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    list.forEach(function (r) {
      var tr = document.createElement("tr");
      [r.tema, r.fecha_capacitacion, r.nro_documento, r.apellidos_nombres, r.cliente, r.unidad, r.fecha_registro].forEach(function (c) {
        var td = document.createElement("td");
        td.textContent = c || "—";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function buildFilters() {
    return {
      caller: session.usuario,
      tema: fTema.value.trim(),
      nroDocumento: fDoc.value.trim(),
      apellidosNombres: fNom.value.trim(),
      idCliente: fCliente.value,
      idUnidad: fUnidad.value,
      fechaDesde: fDesde.value,
      fechaHasta: fHasta.value,
    };
  }

  async function cargarClientes() {
    try {
      var res = await window.AppApi.get("listClientes", { caller: session.usuario });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.clientes) || [];
      fCliente.innerHTML = '<option value="">Todos</option>';
      list.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id_cliente;
        o.textContent = c.cliente || c.id_cliente;
        fCliente.appendChild(o);
      });
    } catch (e) {
      /* silent */
    }
  }

  async function cargarUnidades(idCliente) {
    fUnidad.innerHTML = '<option value="">Todas</option>';
    if (!idCliente) {
      fUnidad.disabled = true;
      return;
    }
    fUnidad.disabled = false;
    try {
      var res = await window.AppApi.get("listUnidades", { caller: session.usuario, idCliente: idCliente });
      if (!res || res.status !== "success") {
        return;
      }
      var list = (res.data && res.data.unidades) || [];
      list.forEach(function (u) {
        var o = document.createElement("option");
        o.value = u.id_unidad;
        o.textContent = u.unidad || u.id_unidad;
        fUnidad.appendChild(o);
      });
    } catch (e) {
      /* silent */
    }
  }

  async function cargarLista() {
    hideMsg();
    loading.hidden = false;
    try {
      var res = await window.AppApi.get("listCapacitacionRegistros", buildFilters());
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar la lista.");
        loading.hidden = true;
        return;
      }
      renderRows((res.data && res.data.registros) || []);
    } catch (e) {
      showMsg("Error de red al cargar registros.");
    }
    loading.hidden = true;
  }

  function exportarExcel() {
    if (!lastRows.length) {
      showMsg("No hay datos para exportar.", "info");
      return;
    }
    var html = '<table><tr><th>Tema</th><th>Fecha capacitación</th><th>Nro documento</th><th>Apellidos y nombres</th><th>Cliente</th><th>Unidad</th><th>Fecha registro</th></tr>';
    lastRows.forEach(function (r) {
      html +=
        "<tr><td>" +
        (r.tema || "") +
        "</td><td>" +
        (r.fecha_capacitacion || "") +
        "</td><td>" +
        (r.nro_documento || "") +
        "</td><td>" +
        (r.apellidos_nombres || "") +
        "</td><td>" +
        (r.cliente || "") +
        "</td><td>" +
        (r.unidad || "") +
        "</td><td>" +
        (r.fecha_registro || "") +
        "</td></tr>";
    });
    html += "</table>";
    var blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "listas-capacitacion.xls";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  btnFiltrar.addEventListener("click", cargarLista);
  btnExportar.addEventListener("click", exportarExcel);
  fCliente.addEventListener("change", async function () {
    await cargarUnidades(fCliente.value);
    cargarLista();
  });
  fUnidad.addEventListener("change", cargarLista);

  cargarClientes();
  cargarUnidades("");
  cargarLista();
})();
