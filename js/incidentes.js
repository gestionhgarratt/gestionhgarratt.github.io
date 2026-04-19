/**
 * Registro de incidentes — supervisores y administradores.
 * Guardar envía el registro y deja el formulario vacío (mantiene cliente y unidad en datos generales).
 */
(function () {
  "use strict";

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
  var stack = document.getElementById("stack");

  if (!window.AppAuth.isSupervisorOrAdmin(session)) {
    blockDeny.hidden = false;
    return;
  }

  blockMain.hidden = false;

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

  function newBid() {
    return "b_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  }

  function setPhotoPreview(card, url) {
    var box = card.querySelector(".js-inc-preview");
    var st = card.querySelector(".js-inc-photo-status");
    if (!box) {
      return;
    }
    box.innerHTML = "";
    if (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Vista previa";
      box.appendChild(img);
      if (st) {
        st.textContent = "Imagen lista.";
      }
    } else {
      var sp = document.createElement("span");
      sp.className = "photo-preview__empty";
      sp.textContent = "Sin imagen (opcional)";
      box.appendChild(sp);
      if (st) {
        st.textContent = "";
      }
    }
  }

  function appendEditBlock() {
    var bid = newBid();
    var sec = document.createElement("section");
    sec.className = "inc-card";
    sec.setAttribute("data-bid", bid);
    sec.setAttribute("data-state", "edit");

    sec.innerHTML =
      '<h3 class="inc-card__title">Registro de incidente</h3>' +
      '<div class="inc-editable">' +
      '<div class="field">' +
      '<label>Tipo de incidente</label>' +
      '<select class="input" data-field="tipo" required>' +
      '<option value="">— Elegir —</option>' +
      '<option value="amenaza">Amenaza</option>' +
      '<option value="vulnerabilidad">Vulnerabilidad</option>' +
      '<option value="condicion_insegura">Condición insegura</option>' +
      "</select>" +
      "</div>" +
      '<div class="field">' +
      "<label>Detalle</label>" +
      '<textarea class="input" data-field="detalle" rows="5" style="min-height: 7rem; resize: vertical" required placeholder="Describe el incidente con el mayor detalle posible."></textarea>' +
      "</div>" +
      '<div class="field">' +
      "<label>Nivel de riesgo</label>" +
      '<select class="input" data-field="nivel" required>' +
      '<option value="">— Elegir —</option>' +
      '<option value="bajo">Bajo</option>' +
      '<option value="medio">Medio</option>' +
      '<option value="alto">Alto</option>' +
      "</select>" +
      "</div>" +
      '<div class="photo-group">' +
      '<span class="photo-group__label">Foto (opcional)</span>' +
      '<div class="photo-actions">' +
      '<label class="btn btn--ghost">Cámara<input type="file" accept="image/*" capture="environment" class="visually-hidden js-inc-photo" /></label>' +
      '<label class="btn btn--ghost">Galería<input type="file" accept="image/*" class="visually-hidden js-inc-photo" /></label>' +
      "</div>" +
      '<input type="hidden" data-field="foto_url" value="" />' +
      '<div class="photo-preview js-inc-preview">' +
      '<span class="photo-preview__empty">Sin imagen (opcional)</span>' +
      "</div>" +
      '<div class="photo-status js-inc-photo-status"></div>' +
      "</div>" +
      '<div class="inc-footer">' +
      '<button type="button" class="btn btn--primary" data-act="save">Guardar</button>' +
      "</div>" +
      "</div>";

    stack.appendChild(sec);
    return sec;
  }

  function validateMeta() {
    if (!selCliente.value) {
      return "Elige un cliente en datos generales.";
    }
    if (!selUnidad.value) {
      return "Elige una unidad en datos generales.";
    }
    return "";
  }

  function validateCard(card) {
    var tipo = card.querySelector('[data-field="tipo"]');
    var det = card.querySelector('[data-field="detalle"]');
    var niv = card.querySelector('[data-field="nivel"]');
    if (!tipo || !tipo.value) {
      return "Indica el tipo de incidente.";
    }
    if (!det || !String(det.value || "").trim()) {
      return "Escribe el detalle del incidente.";
    }
    if (!niv || !niv.value) {
      return "Indica el nivel de riesgo.";
    }
    return "";
  }

  function readCardData(card) {
    return {
      tipo_incidente: String(card.querySelector('[data-field="tipo"]').value || "").trim(),
      detalle: String(card.querySelector('[data-field="detalle"]').value || "").trim(),
      nivel_riesgo: String(card.querySelector('[data-field="nivel"]').value || "").trim(),
      foto: String(card.querySelector('[data-field="foto_url"]').value || "").trim(),
    };
  }

  async function submitIncidenteFromCard(card) {
    var m = validateMeta();
    if (m) {
      return { ok: false, message: m };
    }
    var v = validateCard(card);
    if (v) {
      return { ok: false, message: v };
    }
    var datos = readCardData(card);
    try {
      var res = await window.AppApi.postVerify(
        "submitIncidente",
        {
          caller: session.usuario,
          incidente: {
            id_cliente: selCliente.value,
            id_unidad: selUnidad.value,
            datos: datos,
          },
        },
        "getPendingResult",
        18,
        400
      );
      if (!res || res.status !== "success") {
        return { ok: false, message: (res && res.message) || "No se pudo guardar." };
      }
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: false, message: "Error de red." };
    }
  }

  async function onSave(card) {
    hideTop();
    var out = await submitIncidenteFromCard(card);
    if (!out.ok) {
      showTop(out.message);
      return;
    }
    stack.innerHTML = "";
    appendEditBlock();
    showTop("Incidente guardado. Formulario listo para un nuevo registro.", "success");
  }

  stack.addEventListener("click", function (ev) {
    var btn = ev.target.closest('[data-act="save"]');
    if (!btn) {
      return;
    }
    var card = btn.closest(".inc-card");
    if (!card || card.getAttribute("data-state") !== "edit") {
      return;
    }
    onSave(card);
  });

  stack.addEventListener("change", async function (ev) {
    var inp = ev.target;
    if (!inp || !inp.classList || !inp.classList.contains("js-inc-photo")) {
      return;
    }
    var card = inp.closest(".inc-card");
    if (!card || card.getAttribute("data-state") !== "edit") {
      return;
    }
    var hid = card.querySelector('[data-field="foto_url"]');
    var st = card.querySelector(".js-inc-photo-status");
    if (!hid || !inp.files || !inp.files[0]) {
      return;
    }
    if (st) {
      st.textContent = "Subiendo…";
    }
    try {
      var url = await window.CloudinaryUpload.uploadImage(inp.files[0]);
      hid.value = url;
      setPhotoPreview(card, url);
    } catch (e) {
      if (st) {
        st.textContent = String(e.message || e);
      }
      hid.value = "";
      setPhotoPreview(card, "");
    }
    inp.value = "";
  });

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
    } catch (e) {
      selCliente.innerHTML = '<option value="">— Error —</option>';
      showTop("Error de red al cargar clientes.");
    }
  }

  async function cargarUnidades(idCliente) {
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
      selUnidad.disabled = list.length === 0;
    } catch (e) {
      selUnidad.innerHTML = '<option value="">— Error —</option>';
      showTop("Error de red al cargar unidades.");
    }
  }

  selCliente.addEventListener("change", function () {
    hideTop();
    cargarUnidades(selCliente.value);
  });

  cargarClientes();
  appendEditBlock();
})();
