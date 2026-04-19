/**
 * Clientes y unidades — solo administrador.
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var selectedIdCliente = null;
  var selectedNombreCliente = "";
  var supervisoresCache = [];

  var blockNoAdmin = document.getElementById("blockNoAdmin");
  var blockAdmin = document.getElementById("blockAdmin");
  var msg = document.getElementById("msg");
  var tbodyClientes = document.getElementById("tbodyClientes");
  var loadingClientes = document.getElementById("loadingClientes");
  var btnNuevoCliente = document.getElementById("btnNuevoCliente");
  var btnRefrescarClientes = document.getElementById("btnRefrescarClientes");

  var sectionUnidades = document.getElementById("sectionUnidades");
  var unidadesClienteNombre = document.getElementById("unidadesClienteNombre");
  var tbodyUnidades = document.getElementById("tbodyUnidades");
  var loadingUnidades = document.getElementById("loadingUnidades");
  var btnNuevaUnidad = document.getElementById("btnNuevaUnidad");
  var btnRefrescarUnidades = document.getElementById("btnRefrescarUnidades");

  var dlgCliente = document.getElementById("dlgCliente");
  var formCliente = document.getElementById("formCliente");
  var dlgClienteMsg = document.getElementById("dlgClienteMsg");
  var btnDlgClienteCancelar = document.getElementById("btnDlgClienteCancelar");
  var btnDlgClienteGuardar = document.getElementById("btnDlgClienteGuardar");
  var btnDlgClienteLabel = document.getElementById("btnDlgClienteLabel");
  var btnDlgClienteSpinner = document.getElementById("btnDlgClienteSpinner");

  var dlgUnidad = document.getElementById("dlgUnidad");
  var formUnidad = document.getElementById("formUnidad");
  var dlgUnidadMsg = document.getElementById("dlgUnidadMsg");
  var dlgUnidadCliente = document.getElementById("dlgUnidadCliente");
  var fUnidadSupervisor = document.getElementById("fUnidadSupervisor");
  var btnDlgUnidadCancelar = document.getElementById("btnDlgUnidadCancelar");
  var btnDlgUnidadGuardar = document.getElementById("btnDlgUnidadGuardar");
  var btnDlgUnidadLabel = document.getElementById("btnDlgUnidadLabel");
  var btnDlgUnidadSpinner = document.getElementById("btnDlgUnidadSpinner");

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

  function estadoLabel(e) {
    return e === "inactivo" ? "Inactivo" : "Activo";
  }

  function setClienteLoading(on) {
    loadingClientes.hidden = !on;
  }

  function setUnidadLoading(on) {
    loadingUnidades.hidden = !on;
  }

  function setDlgClienteLoading(on) {
    btnDlgClienteGuardar.disabled = on;
    btnDlgClienteLabel.hidden = on;
    btnDlgClienteSpinner.hidden = !on;
  }

  function setDlgUnidadLoading(on) {
    btnDlgUnidadGuardar.disabled = on;
    btnDlgUnidadLabel.hidden = on;
    btnDlgUnidadSpinner.hidden = !on;
  }

  function hideDlgClienteMsg() {
    dlgClienteMsg.hidden = true;
  }

  function showDlgClienteMsg(text) {
    dlgClienteMsg.textContent = text;
    dlgClienteMsg.hidden = false;
  }

  function hideDlgUnidadMsg() {
    dlgUnidadMsg.hidden = true;
  }

  function showDlgUnidadMsg(text) {
    dlgUnidadMsg.textContent = text;
    dlgUnidadMsg.hidden = false;
  }

  function renderClientes(clientes) {
    tbodyClientes.innerHTML = "";
    if (!clientes || !clientes.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "No hay clientes. Crea la pestaña en Sheets y ejecuta crearPestanasClientesYUnidades() en Apps Script.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbodyClientes.appendChild(tr);
      return;
    }
    clientes.forEach(function (c) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-id", c.id_cliente);
      if (selectedIdCliente === c.id_cliente) {
        tr.style.background = "rgba(61, 139, 253, 0.12)";
      }

      var tdNombre = document.createElement("td");
      tdNombre.textContent = c.cliente || "";
      tr.appendChild(tdNombre);

      var tdEstado = document.createElement("td");
      tdEstado.textContent = estadoLabel(c.estado);
      tr.appendChild(tdEstado);

      var tdAcc = document.createElement("td");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--ghost";
      btn.style.minHeight = "36px";
      btn.style.padding = "0.35rem 0.65rem";
      btn.textContent = selectedIdCliente === c.id_cliente ? "Seleccionado" : "Ver unidades";
      btn.addEventListener("click", function () {
        selectedIdCliente = c.id_cliente;
        selectedNombreCliente = c.cliente || "";
        sectionUnidades.hidden = false;
        unidadesClienteNombre.textContent = "Cliente: " + selectedNombreCliente;
        btnNuevaUnidad.disabled = false;
        renderClientes(clientes);
        cargarUnidades();
      });
      tdAcc.appendChild(btn);
      tr.appendChild(tdAcc);

      tbodyClientes.appendChild(tr);
    });
  }

  function renderUnidades(unidades) {
    tbodyUnidades.innerHTML = "";
    if (!unidades || !unidades.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "Este cliente no tiene unidades aún.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbodyUnidades.appendChild(tr);
      return;
    }
    unidades.forEach(function (u) {
      var tr = document.createElement("tr");
      [["unidad"], ["supervisor"], ["rondas_mensuales"]].forEach(function (keys) {
        var td = document.createElement("td");
        var k = keys[0];
        td.textContent = k === "rondas_mensuales" ? String(u[k] != null ? u[k] : 0) : String(u[k] || "");
        tr.appendChild(td);
      });
      tbodyUnidades.appendChild(tr);
    });
  }

  async function cargarClientes() {
    hideMsg();
    setClienteLoading(true);
    tbodyClientes.innerHTML = "";
    try {
      var res = await window.AppApi.get("listClientes", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudieron cargar los clientes.");
        setClienteLoading(false);
        return;
      }
      var list = (res.data && res.data.clientes) || [];
      renderClientes(list);
      if (selectedIdCliente) {
        var still = list.some(function (c) {
          return c.id_cliente === selectedIdCliente;
        });
        if (!still) {
          selectedIdCliente = null;
          selectedNombreCliente = "";
          sectionUnidades.hidden = true;
          btnNuevaUnidad.disabled = true;
        } else {
          renderClientes(list);
        }
      }
    } catch (e) {
      showMsg("Error de red al cargar clientes.");
    }
    setClienteLoading(false);
  }

  async function cargarSupervisores() {
    try {
      var res = await window.AppApi.get("listSupervisores", { caller: session.usuario });
      if (res && res.status === "success") {
        supervisoresCache = (res.data && res.data.supervisores) || [];
      } else {
        supervisoresCache = [];
      }
    } catch (e) {
      supervisoresCache = [];
    }
  }

  function fillSupervisorSelect() {
    fUnidadSupervisor.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = supervisoresCache.length ? "— Elegir —" : "No hay supervisores en usuarios";
    fUnidadSupervisor.appendChild(opt0);
    supervisoresCache.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.usuario;
      o.textContent = (s.nombres || s.usuario) + " (" + s.usuario + ")";
      fUnidadSupervisor.appendChild(o);
    });
  }

  async function cargarUnidades() {
    if (!selectedIdCliente) {
      return;
    }
    hideMsg();
    setUnidadLoading(true);
    tbodyUnidades.innerHTML = "";
    try {
      var res = await window.AppApi.get("listUnidades", {
        caller: session.usuario,
        idCliente: selectedIdCliente,
      });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudieron cargar las unidades.");
        setUnidadLoading(false);
        return;
      }
      renderUnidades((res.data && res.data.unidades) || []);
    } catch (e) {
      showMsg("Error de red al cargar unidades.");
    }
    setUnidadLoading(false);
  }

  btnRefrescarClientes.addEventListener("click", cargarClientes);
  btnRefrescarUnidades.addEventListener("click", cargarUnidades);

  btnNuevoCliente.addEventListener("click", function () {
    hideDlgClienteMsg();
    document.getElementById("fClienteNombre").value = "";
    document.getElementById("fClienteEstado").value = "activo";
    if (typeof dlgCliente.showModal === "function") {
      dlgCliente.showModal();
    }
  });

  btnDlgClienteCancelar.addEventListener("click", function () {
    dlgCliente.close();
  });

  formCliente.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideDlgClienteMsg();
    var nombre = document.getElementById("fClienteNombre").value.trim();
    var estado = document.getElementById("fClienteEstado").value;
    if (!nombre) {
      showDlgClienteMsg("Indica el nombre del cliente.");
      return;
    }
    setDlgClienteLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "createCliente",
        { caller: session.usuario, cliente: { cliente: nombre, estado: estado } },
        "getPendingResult",
        15,
        350
      );
      if (!res || res.status !== "success") {
        showDlgClienteMsg((res && res.message) || "No se pudo crear el cliente.");
        setDlgClienteLoading(false);
        return;
      }
      dlgCliente.close();
      hideMsg();
      showMsg("Cliente creado correctamente.", "success");
      await cargarClientes();
    } catch (err) {
      showDlgClienteMsg("Error de red.");
    }
    setDlgClienteLoading(false);
  });

  btnNuevaUnidad.addEventListener("click", async function () {
    if (!selectedIdCliente) {
      return;
    }
    hideDlgUnidadMsg();
    document.getElementById("fUnidadNombre").value = "";
    document.getElementById("fUnidadRondas").value = "0";
    dlgUnidadCliente.textContent = "Cliente: " + selectedNombreCliente;
    await cargarSupervisores();
    fillSupervisorSelect();
    if (typeof dlgUnidad.showModal === "function") {
      dlgUnidad.showModal();
    }
  });

  btnDlgUnidadCancelar.addEventListener("click", function () {
    dlgUnidad.close();
  });

  formUnidad.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideDlgUnidadMsg();
    if (!selectedIdCliente) {
      showDlgUnidadMsg("Selecciona un cliente primero.");
      return;
    }
    var nombre = document.getElementById("fUnidadNombre").value.trim();
    var supervisor = fUnidadSupervisor.value.trim();
    var rondas = parseInt(document.getElementById("fUnidadRondas").value, 10);
    if (!nombre) {
      showDlgUnidadMsg("Indica el nombre de la unidad.");
      return;
    }
    if (!supervisor) {
      showDlgUnidadMsg("Elige un supervisor.");
      return;
    }
    if (isNaN(rondas) || rondas < 0) {
      showDlgUnidadMsg("Las rondas deben ser un número entero ≥ 0.");
      return;
    }
    setDlgUnidadLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "createUnidad",
        {
          caller: session.usuario,
          unidad: {
            idCliente: selectedIdCliente,
            unidad: nombre,
            supervisor: supervisor,
            rondasMensuales: rondas,
          },
        },
        "getPendingResult",
        15,
        350
      );
      if (!res || res.status !== "success") {
        showDlgUnidadMsg((res && res.message) || "No se pudo crear la unidad.");
        setDlgUnidadLoading(false);
        return;
      }
      dlgUnidad.close();
      hideMsg();
      showMsg("Unidad creada correctamente.", "success");
      await cargarUnidades();
    } catch (err) {
      showDlgUnidadMsg("Error de red.");
    }
    setDlgUnidadLoading(false);
  });

  cargarClientes();
})();
