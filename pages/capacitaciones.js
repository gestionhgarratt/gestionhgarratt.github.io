/**
 * Capacitaciones — alta y generación de URL pública.
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
  var form = document.getElementById("formCap");
  var fTema = document.getElementById("fTema");
  var fFecha = document.getElementById("fFecha");
  var fLink = document.getElementById("fLink");
  var tbody = document.getElementById("tbodyCaps");
  var btnGuardar = document.getElementById("btnGuardarCap");
  var btnLabel = document.getElementById("btnCapLabel");
  var btnSpinner = document.getElementById("btnCapSpinner");

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

  function setLoading(on) {
    btnGuardar.disabled = on;
    btnLabel.hidden = on;
    btnSpinner.hidden = !on;
  }

  function getPublicBaseUrl() {
    var path = window.location.pathname || "";
    var basePath = path.replace(/\/pages\/[^/]*$/, "/capacitacion.html");
    return window.location.origin + basePath;
  }

  function buildPublicUrl(token) {
    return getPublicBaseUrl() + "?token=" + encodeURIComponent(token);
  }

  function renderRows(list) {
    tbody.innerHTML = "";
    if (!list || !list.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.style.color = "var(--color-text-muted)";
      td.textContent = "No hay capacitaciones registradas.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    list.forEach(function (c) {
      var tr = document.createElement("tr");
      var pub = buildPublicUrl(c.token_publico || "");
      var tdTema = document.createElement("td");
      tdTema.textContent = c.tema || "—";
      var tdFecha = document.createElement("td");
      tdFecha.textContent = c.fecha || "—";
      var tdLink = document.createElement("td");
      var a1 = document.createElement("a");
      a1.href = c.link_capacitacion || "#";
      a1.textContent = c.link_capacitacion || "—";
      a1.target = "_blank";
      a1.rel = "noopener noreferrer";
      tdLink.appendChild(a1);
      var tdPub = document.createElement("td");
      var a2 = document.createElement("a");
      a2.href = pub;
      a2.textContent = pub;
      a2.target = "_blank";
      a2.rel = "noopener noreferrer";
      tdPub.appendChild(a2);
      var tdUsr = document.createElement("td");
      tdUsr.textContent = c.usuario || "—";
      var tdCre = document.createElement("td");
      tdCre.textContent = c.fecha_creacion || "—";
      [tdTema, tdFecha, tdLink, tdPub, tdUsr, tdCre].forEach(function (td) {
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function cargarLista() {
    try {
      var res = await window.AppApi.get("listCapacitaciones", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar la lista.");
        return;
      }
      renderRows((res.data && res.data.capacitaciones) || []);
    } catch (e) {
      showMsg("Error de red al cargar capacitaciones.");
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMsg();
    var tema = fTema.value.trim();
    var fecha = fFecha.value;
    var link = fLink.value.trim();
    if (!tema || !fecha || !link) {
      showMsg("Complete tema, fecha y link.");
      return;
    }
    setLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "createCapacitacion",
        {
          caller: session.usuario,
          capacitacion: { tema: tema, fecha: fecha, link_capacitacion: link },
        },
        "getPendingResult",
        15,
        350
      );
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo guardar la capacitación.");
        setLoading(false);
        return;
      }
      var token = res.data && res.data.token_publico ? res.data.token_publico : "";
      var pub = token ? buildPublicUrl(token) : "";
      form.reset();
      showMsg("Capacitación guardada. URL pública: " + pub, "success");
      await cargarLista();
    } catch (err) {
      showMsg("Error de red al guardar.");
    }
    setLoading(false);
  });

  cargarLista();
})();
