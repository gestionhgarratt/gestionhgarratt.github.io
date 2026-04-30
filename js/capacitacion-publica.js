/**
 * P?gina p?blica de acceso a capacitaci?n.
 */
(function () {
  "use strict";

  var tituloCap = document.getElementById("tituloCap");
  var fechaCap = document.getElementById("fechaCap");
  var msg = document.getElementById("msg");
  var form = document.getElementById("formAcceso");
  var fDoc = document.getElementById("fDoc");
  var fNom = document.getElementById("fNom");
  var fCliente = document.getElementById("fCliente");
  var fUnidad = document.getElementById("fUnidad");
  var btn = document.getElementById("btnAcceder");
  var btnLbl = document.getElementById("btnLbl");
  var btnSp = document.getElementById("btnSp");
  var dlg = document.getElementById("dlgLink");
  var capLink = document.getElementById("capLink");
  var btnCerrar = document.getElementById("btnCerrarDlg");

  var token = new URLSearchParams(window.location.search).get("token") || "";
  var capActual = null;

  function showMsg(text, kind) {
    if (!msg) {
      return;
    }
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
    msg.textContent = text;
  }
  function hideMsg() {
    msg.hidden = true;
  }
  function setLoading(on) {
    btn.disabled = on;
    btnLbl.hidden = on;
    btnSp.hidden = !on;
  }

  async function cargarClientes() {
    if (!window.AppApi || !window.AppApi.get) {
      throw new Error("No se carg? api.js (AppApi). Revise la consola del navegador.");
    }
    var getter = window.AppApi.getJsonp || window.AppApi.get;
    var res = await getter("listClientesPublic", {});
    if (!res || res.status !== "success") {
      throw new Error((res && res.message) || "No se pudo cargar clientes.");
    }
    var list = (res.data && res.data.clientes) || [];
    fCliente.innerHTML = '<option value="">Seleccione cliente</option>';
    list.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id_cliente;
      o.textContent = c.cliente || c.id_cliente;
      fCliente.appendChild(o);
    });
    if (!list.length) {
      showMsg("No hay clientes registrados en el sistema. Cargue clientes en el m?dulo correspondiente.", "info");
    }
  }

  async function cargarUnidades() {
    fUnidad.innerHTML = '<option value="">Seleccione unidad</option>';
    var idC = fCliente.value;
    if (!idC) {
      fUnidad.disabled = true;
      return;
    }
    fUnidad.disabled = false;
    var getter = window.AppApi.getJsonp || window.AppApi.get;
    var res = await getter("listUnidadesPublic", { idCliente: idC });
    if (!res || res.status !== "success") {
      throw new Error((res && res.message) || "No se pudo cargar unidades.");
    }
    var list = (res.data && res.data.unidades) || [];
    list.forEach(function (u) {
      var o = document.createElement("option");
      o.value = u.id_unidad;
      o.textContent = u.unidad || u.id_unidad;
      fUnidad.appendChild(o);
    });
  }

  async function cargarCapacitacion() {
    if (!token) {
      throw new Error("URL inv?lida: falta token.");
    }
    if (!window.AppApi || !window.AppApi.get) {
      throw new Error("No se carg? api.js (AppApi).");
    }
    var cfg = window.AppConfig && window.AppConfig.getScriptUrl ? window.AppConfig.getScriptUrl() : "";
    if (!cfg || String(cfg).indexOf("PEGA_AQUI") !== -1) {
      throw new Error("Falta configurar SCRIPT_URL en js/config.js en el sitio publicado.");
    }
    var getter = window.AppApi.getJsonp || window.AppApi.get;
    var res = await getter("getCapacitacionPublica", { token: token });
    if (!res || res.status !== "success") {
      throw new Error((res && res.message) || "Capacitaci?n no disponible.");
    }
    capActual = res.data && res.data.capacitacion ? res.data.capacitacion : null;
    if (!capActual) {
      throw new Error("No se encontr? la capacitaci?n.");
    }
    tituloCap.textContent = capActual.tema || "Capacitaci?n";
    fechaCap.textContent = capActual.fecha ? "Fecha: " + capActual.fecha : "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMsg();
    if (!capActual) {
      showMsg("Capacitaci?n no disponible.");
      return;
    }
    var idCliente = fCliente.value;
    var idUnidad = fUnidad.value;
    var clienteTxt = fCliente.options[fCliente.selectedIndex] ? fCliente.options[fCliente.selectedIndex].textContent : "";
    var unidadTxt = fUnidad.options[fUnidad.selectedIndex] ? fUnidad.options[fUnidad.selectedIndex].textContent : "";
    if (!fDoc.value.trim() || !fNom.value.trim() || !idCliente || !idUnidad) {
      showMsg("Complete todos los campos.");
      return;
    }
    setLoading(true);
    try {
      var poster = window.AppApi.postVerifyJsonp || window.AppApi.postVerify;
      var out = await poster(
        "registrarAccesoCapacitacion",
        {
          token: token,
          nro_documento: fDoc.value.trim(),
          apellidos_nombres: fNom.value.trim(),
          id_cliente: idCliente,
          cliente: clienteTxt,
          id_unidad: idUnidad,
          unidad: unidadTxt,
        },
        "getPendingResult",
        15,
        350
      );
      if (!out || out.status !== "success") {
        showMsg((out && out.message) || "No se pudo registrar el acceso.");
        setLoading(false);
        return;
      }
      var link = out.data && out.data.link_capacitacion ? out.data.link_capacitacion : capActual.link_capacitacion;
      capLink.href = link || "#";
      capLink.textContent = link || "";
      if (dlg && dlg.showModal) {
        dlg.showModal();
      }
      form.reset();
      fUnidad.innerHTML = '<option value="">Seleccione</option>';
      fUnidad.disabled = true;
    } catch (err) {
      showMsg(err && err.message ? err.message : "Error de red.");
    }
    setLoading(false);
  });

  fCliente.addEventListener("change", function () {
    cargarUnidades().catch(function (err) {
      showMsg(err && err.message ? err.message : "No se pudo cargar unidades.");
    });
  });

  if (btnCerrar) {
    btnCerrar.addEventListener("click", function () {
      if (dlg && dlg.close) {
        dlg.close();
      }
    });
  }

  (async function init() {
    try {
      await cargarCapacitacion();
    } catch (e1) {
      if (tituloCap) {
        tituloCap.textContent = "No disponible";
      }
      if (fechaCap) {
        fechaCap.textContent = "";
      }
      showMsg(
        (e1 && e1.message ? e1.message : "No se pudo cargar la capacitaci?n.") +
          " Si el error menciona red o CORS, verifique el despliegue del Web App (acceso: cualquier persona) y SCRIPT_URL.",
        "error"
      );
      return;
    }
    try {
      await cargarClientes();
    } catch (e2) {
      showMsg((e2 && e2.message ? e2.message : "No se pudieron cargar los clientes.") + " Revise SCRIPT_URL y la consola (F12).", "error");
    }
    try {
      await cargarUnidades();
    } catch (e3) {
      showMsg(e3 && e3.message ? e3.message : "No se pudieron cargar las unidades.", "error");
    }
  })();
})();
