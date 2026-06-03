/**
 * Visitas a clientes — registro diario por supervisor/administrador.
 */
(function () {
  "use strict";

  var MAX_FOTOS_VISITA = 3;

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockDeny = document.getElementById("blockDeny");
  var blockMain = document.getElementById("blockMain");
  var msgTop = document.getElementById("msgTop");
  var inpFecha = document.getElementById("inpFecha");
  var usuarioDisplay = document.getElementById("usuarioDisplay");
  var savedSection = document.getElementById("savedSection");
  var savedList = document.getElementById("savedList");
  var draftStack = document.getElementById("draftStack");
  var btnNuevaVisita = document.getElementById("btnNuevaVisita");
  var kmInicio = document.getElementById("kmInicio");
  var kmFin = document.getElementById("kmFin");
  var btnGuardarKm = document.getElementById("btnGuardarKm");
  var btnInforme = document.getElementById("btnInforme");

  var clientesCache = [];
  var visitasDiaCache = [];
  var jornadaCache = { km_inicio: "", km_fin: "" };

  if (!window.AppAuth.isSupervisorOrAdmin(session)) {
    blockDeny.hidden = false;
    return;
  }

  blockMain.hidden = false;
  usuarioDisplay.textContent =
    (session.nombres || "").trim() + " (" + (session.usuario || "") + ")";

  function todayYmd() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function showTop(text, kind) {
    msgTop.textContent = text;
    msgTop.hidden = false;
    msgTop.className = "msg msg--" + (kind || "error");
  }

  function hideTop() {
    msgTop.hidden = true;
  }

  function newBid() {
    return "v_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function readPhotos(card) {
    var hid = card.querySelector('[data-field="fotos_visita"]');
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

  function setPhotos(card, urls) {
    var hid = card.querySelector('[data-field="fotos_visita"]');
    if (hid) {
      hid.value = JSON.stringify(urls || []);
    }
    renderPhotoPreview(card);
    updateFotoLimitMsg(card);
  }

  function renderPhotoPreview(card) {
    var box = card.querySelector(".js-vis-fotos-preview");
    if (!box) {
      return;
    }
    var urls = readPhotos(card);
    box.innerHTML = "";
    if (!urls.length) {
      box.innerHTML = '<span class="photo-preview__empty">Sin fotos de visita</span>';
      return;
    }
    urls.forEach(function (url, i) {
      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Visita " + (i + 1);
      fig.appendChild(img);
      box.appendChild(fig);
    });
  }

  function updateFotoLimitMsg(card) {
    var st = card.querySelector(".js-vis-fotos-status");
    var urls = readPhotos(card);
    if (st) {
      st.textContent = urls.length + " / " + MAX_FOTOS_VISITA + " foto(s)";
    }
    var inputs = card.querySelectorAll(".js-vis-foto-file");
    inputs.forEach(function (inp) {
      inp.disabled = urls.length >= MAX_FOTOS_VISITA;
    });
  }

  function appendNovedadBlock(card, texto, foto) {
    var list = card.querySelector(".js-nov-list");
    if (!list) {
      return;
    }
    var nid = newBid();
    var block = document.createElement("div");
    block.className = "vis-nov-block";
    block.setAttribute("data-nid", nid);
    block.innerHTML =
      '<div class="vis-nov-block__head">' +
      "<span>Novedad</span>" +
      '<button type="button" class="btn btn--ghost btn--tiny" data-act="del-nov">Quitar</button>' +
      "</div>" +
      '<textarea class="input js-nov-text" rows="3" placeholder="Describa la novedad encontrada"></textarea>' +
      '<div class="photo-group">' +
      '<span class="photo-group__label">Foto (opcional)</span>' +
      '<div class="photo-actions">' +
      '<label class="btn btn--ghost">Cámara<input type="file" accept="image/*" capture="environment" class="visually-hidden js-nov-photo" /></label>' +
      '<label class="btn btn--ghost">Galería<input type="file" accept="image/*" class="visually-hidden js-nov-photo" /></label>' +
      "</div>" +
      '<input type="hidden" class="js-nov-foto-url" value="" />' +
      '<div class="photo-preview js-nov-preview">' +
      '<span class="photo-preview__empty">Sin imagen</span>' +
      "</div>" +
      '<div class="photo-status js-nov-photo-status"></div>' +
      "</div>";
    list.appendChild(block);
    if (texto) {
      block.querySelector(".js-nov-text").value = texto;
    }
    if (foto) {
      block.querySelector(".js-nov-foto-url").value = foto;
      setNovPreview(block, foto);
    }
  }

  function setNovPreview(block, url) {
    var box = block.querySelector(".js-nov-preview");
    if (!box) {
      return;
    }
    box.innerHTML = "";
    if (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Novedad";
      box.appendChild(img);
    } else {
      box.innerHTML = '<span class="photo-preview__empty">Sin imagen</span>';
    }
  }

  function readNovedades(card) {
    var out = [];
    card.querySelectorAll(".vis-nov-block").forEach(function (block) {
      var texto = String((block.querySelector(".js-nov-text") || {}).value || "").trim();
      var foto = String((block.querySelector(".js-nov-foto-url") || {}).value || "").trim();
      if (texto || foto) {
        out.push({ texto: texto, foto: foto });
      }
    });
    return out;
  }

  function buildClienteOptions(selected) {
    var h = '<option value="">— Elija cliente —</option>';
    clientesCache.forEach(function (c) {
      var suf = c.estado === "inactivo" ? " (inactivo)" : "";
      var sel = c.id_cliente === selected ? " selected" : "";
      h +=
        '<option value="' +
        esc(c.id_cliente) +
        '"' +
        sel +
        ">" +
        esc(c.cliente || c.id_cliente) +
        suf +
        "</option>";
    });
    return h;
  }

  function appendDraftCard() {
    var bid = newBid();
    var sec = document.createElement("section");
    sec.className = "card vis-card";
    sec.setAttribute("data-bid", bid);
    sec.setAttribute("data-state", "edit");

    sec.innerHTML =
      '<div class="vis-card__head">' +
      "<h3 style=\"margin:0;font-size:1.05rem\">Nueva visita</h3>" +
      "</div>" +
      '<div class="vis-editable">' +
      '<div class="as-field-row">' +
      '<div class="field"><label>Cliente</label>' +
      '<select class="input js-vis-cliente" required>' +
      buildClienteOptions("") +
      "</select></div>" +
      '<div class="field"><label>Unidad</label>' +
      '<select class="input js-vis-unidad" required disabled>' +
      '<option value="">— Elija cliente —</option></select></div>' +
      "</div>" +
      '<div class="field"><label>Hora de inicio</label>' +
      '<input class="input js-vis-hora" type="time" required /></div>' +
      '<div class="photo-group">' +
      '<span class="photo-group__label">Fotos de la visita (máx. 3)</span>' +
      '<div class="photo-actions">' +
      '<label class="btn btn--ghost">Cámara<input type="file" accept="image/*" capture="environment" class="visually-hidden js-vis-foto-file" /></label>' +
      '<label class="btn btn--ghost">Galería<input type="file" accept="image/*" class="visually-hidden js-vis-foto-file" /></label>' +
      "</div>" +
      '<input type="hidden" data-field="fotos_visita" value="[]" />' +
      '<div class="photo-preview-grid js-vis-fotos-preview">' +
      '<span class="photo-preview__empty">Sin fotos de visita</span></div>' +
      '<div class="photo-status js-vis-fotos-status"></div></div>' +
      '<div class="vis-nov-section">' +
      '<div class="vis-nov-section__head">' +
      "<span class=\"photo-group__label\">Novedades encontradas</span>" +
      '<button type="button" class="btn btn--ghost btn--tiny" data-act="add-nov">+ Agregar novedad</button>' +
      "</div>" +
      '<div class="js-nov-list"></div></div>' +
      '<div class="vis-card__footer">' +
      '<button type="button" class="btn btn--primary" data-act="save-visita">Guardar y cerrar visita</button>' +
      '<button type="button" class="btn btn--ghost" data-act="cancel-visita">Descartar</button>' +
      "</div></div>";

    draftStack.appendChild(sec);
    appendNovedadBlock(sec, "", "");
    updateFotoLimitMsg(sec);

    var now = new Date();
    var horaInp = sec.querySelector(".js-vis-hora");
    if (horaInp) {
      horaInp.value =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");
    }
    return sec;
  }

  async function cargarUnidadesEnCard(card, idCliente, selectedUnidad) {
    var sel = card.querySelector(".js-vis-unidad");
    if (!sel) {
      return;
    }
    sel.innerHTML = '<option value="">— Cargando —</option>';
    sel.disabled = true;
    if (!idCliente) {
      sel.innerHTML = '<option value="">— Elija cliente —</option>';
      return;
    }
    try {
      var res = await window.AppApi.get("listUnidadesSupervision", {
        caller: session.usuario,
        idCliente: idCliente,
      });
      if (!res || res.status !== "success") {
        sel.innerHTML = '<option value="">— Error —</option>';
        return;
      }
      var list = (res.data && res.data.unidades) || [];
      sel.innerHTML = '<option value="">— Elija unidad —</option>';
      list.forEach(function (u) {
        var o = document.createElement("option");
        o.value = u.id_unidad;
        o.textContent = u.unidad || u.id_unidad;
        if (selectedUnidad && u.id_unidad === selectedUnidad) {
          o.selected = true;
        }
        sel.appendChild(o);
      });
      sel.disabled = false;
    } catch (e) {
      sel.innerHTML = '<option value="">— Error —</option>';
    }
  }

  async function cargarClientes() {
    try {
      var res = await window.AppApi.get("listClientesSupervision", {
        caller: session.usuario,
      });
      if (!res || res.status !== "success") {
        showTop((res && res.message) || "No se pudieron cargar los clientes.");
        return;
      }
      clientesCache = (res.data && res.data.clientes) || [];
    } catch (e) {
      showTop("Error de red al cargar clientes.");
    }
  }

  function renderSavedVisitas(visitas) {
    visitasDiaCache = visitas || [];
    savedList.innerHTML = "";
    if (!visitasDiaCache.length) {
      savedSection.hidden = true;
      return;
    }
    savedSection.hidden = false;
    visitasDiaCache.forEach(function (v, idx) {
      var d = v.datos || {};
      var div = document.createElement("article");
      div.className = "vis-saved-item";
      var novCount = (d.novedades || []).length;
      var fotoCount = (d.fotos_visita || []).length;
      div.innerHTML =
        "<strong>Visita " +
        (idx + 1) +
        "</strong> · " +
        esc(v.hora_inicio) +
        " — " +
        esc(v.cliente) +
        " / " +
        esc(v.unidad) +
        "<br /><span class=\"vis-saved-meta\">" +
        fotoCount +
        " foto(s) · " +
        novCount +
        " novedad(es)</span>";
      savedList.appendChild(div);
    });
  }

  function applyJornada(j) {
    jornadaCache = j || { km_inicio: "", km_fin: "" };
    if (kmInicio) {
      kmInicio.value =
        jornadaCache.km_inicio != null && jornadaCache.km_inicio !== ""
          ? String(jornadaCache.km_inicio)
          : "";
    }
    if (kmFin) {
      kmFin.value =
        jornadaCache.km_fin != null && jornadaCache.km_fin !== ""
          ? String(jornadaCache.km_fin)
          : "";
    }
  }

  async function cargarDia() {
    hideTop();
    var fecha = inpFecha.value;
    if (!fecha) {
      return;
    }
    try {
      var res = await window.AppApi.get("getVisitasDia", {
        caller: session.usuario,
        fecha: fecha,
      });
      if (!res || res.status !== "success") {
        showTop((res && res.message) || "No se pudo cargar el día.");
        return;
      }
      renderSavedVisitas((res.data && res.data.visitas) || []);
      applyJornada((res.data && res.data.jornada) || {});
    } catch (e) {
      showTop("Error de red al cargar visitas del día.");
    }
  }

  function validateCard(card) {
    var cli = card.querySelector(".js-vis-cliente");
    var uni = card.querySelector(".js-vis-unidad");
    var hora = card.querySelector(".js-vis-hora");
    if (!cli || !cli.value) {
      return "Elija un cliente.";
    }
    if (!uni || !uni.value) {
      return "Elija una unidad.";
    }
    if (!hora || !hora.value) {
      return "Indique la hora de inicio.";
    }
    if (!inpFecha.value) {
      return "Indique la fecha de la jornada.";
    }
    return "";
  }

  async function saveVisita(card) {
    var err = validateCard(card);
    if (err) {
      return { ok: false, message: err };
    }
    var btn = card.querySelector('[data-act="save-visita"]');
    if (btn) {
      btn.disabled = true;
    }
    try {
      var res = await window.AppApi.postVerify(
        "submitVisitaCliente",
        {
          caller: session.usuario,
          visita: {
            fecha: inpFecha.value,
            id_cliente: card.querySelector(".js-vis-cliente").value,
            id_unidad: card.querySelector(".js-vis-unidad").value,
            hora_inicio: card.querySelector(".js-vis-hora").value,
            datos: {
              fotos_visita: readPhotos(card),
              novedades: readNovedades(card),
            },
          },
        },
        "getPendingResult",
        18,
        400
      );
      if (!res || res.status !== "success") {
        return { ok: false, message: (res && res.message) || "No se pudo guardar." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "Error de red." };
    } finally {
      if (btn) {
        btn.disabled = false;
      }
    }
  }

  draftStack.addEventListener("click", async function (ev) {
    var btn = ev.target.closest("[data-act]");
    if (!btn) {
      return;
    }
    var card = btn.closest(".vis-card");
    if (!card) {
      return;
    }
    var act = btn.getAttribute("data-act");

    if (act === "add-nov") {
      appendNovedadBlock(card, "", "");
      return;
    }

    if (act === "del-nov") {
      var block = btn.closest(".vis-nov-block");
      var list = card.querySelector(".js-nov-list");
      if (block && list && list.children.length > 1) {
        block.remove();
      } else if (block) {
        block.querySelector(".js-nov-text").value = "";
        block.querySelector(".js-nov-foto-url").value = "";
        setNovPreview(block, "");
      }
      return;
    }

    if (act === "cancel-visita") {
      card.remove();
      return;
    }

    if (act === "save-visita") {
      hideTop();
      var out = await saveVisita(card);
      if (!out.ok) {
        showTop(out.message);
        return;
      }
      card.remove();
      showTop("Visita guardada.", "success");
      await cargarDia();
    }
  });

  draftStack.addEventListener("change", async function (ev) {
    var inp = ev.target;

    if (inp && inp.classList && inp.classList.contains("js-vis-cliente")) {
      var cardC = inp.closest(".vis-card");
      if (cardC) {
        await cargarUnidadesEnCard(cardC, inp.value, "");
      }
      return;
    }

    if (inp && inp.classList && inp.classList.contains("js-vis-foto-file")) {
      var cardF = inp.closest(".vis-card");
      if (!cardF || !inp.files || !inp.files[0]) {
        return;
      }
      var urls = readPhotos(cardF);
      if (urls.length >= MAX_FOTOS_VISITA) {
        showTop("Máximo " + MAX_FOTOS_VISITA + " fotos por visita.");
        inp.value = "";
        return;
      }
      var st = cardF.querySelector(".js-vis-fotos-status");
      if (st) {
        st.textContent = "Subiendo…";
      }
      try {
        var url = await window.CloudinaryUpload.uploadImage(inp.files[0]);
        urls.push(url);
        setPhotos(cardF, urls);
      } catch (e) {
        if (st) {
          st.textContent = String(e.message || e);
        }
      }
      inp.value = "";
      return;
    }

    if (inp && inp.classList && inp.classList.contains("js-nov-photo")) {
      var block = inp.closest(".vis-nov-block");
      if (!block || !inp.files || !inp.files[0]) {
        return;
      }
      var stN = block.querySelector(".js-nov-photo-status");
      if (stN) {
        stN.textContent = "Subiendo…";
      }
      try {
        var urlN = await window.CloudinaryUpload.uploadImage(inp.files[0]);
        block.querySelector(".js-nov-foto-url").value = urlN;
        setNovPreview(block, urlN);
        if (stN) {
          stN.textContent = "Imagen lista.";
        }
      } catch (e) {
        if (stN) {
          stN.textContent = String(e.message || e);
        }
      }
      inp.value = "";
    }
  });

  btnNuevaVisita.addEventListener("click", function () {
    hideTop();
    if (!clientesCache.length) {
      showTop("Espere a que carguen los clientes o recargue la página.");
      return;
    }
    appendDraftCard();
  });

  inpFecha.addEventListener("change", function () {
    draftStack.innerHTML = "";
    cargarDia();
  });

  btnGuardarKm.addEventListener("click", async function () {
    hideTop();
    if (!inpFecha.value) {
      showTop("Indique la fecha.");
      return;
    }
    btnGuardarKm.disabled = true;
    try {
      var res = await window.AppApi.postVerify(
        "saveJornadaVisitas",
        {
          caller: session.usuario,
          jornada: {
            fecha: inpFecha.value,
            km_inicio: kmInicio.value,
            km_fin: kmFin.value,
          },
        },
        "getPendingResult",
        18,
        400
      );
      if (!res || res.status !== "success") {
        showTop((res && res.message) || "No se pudo guardar el kilometraje.");
        return;
      }
      showTop("Kilometraje guardado.", "success");
      await cargarDia();
    } catch (e) {
      showTop("Error de red.");
    } finally {
      btnGuardarKm.disabled = false;
    }
  });

  btnInforme.addEventListener("click", async function () {
    hideTop();
    if (!visitasDiaCache.length) {
      showTop("No hay visitas guardadas para esta fecha.");
      return;
    }
    btnInforme.disabled = true;
    try {
      if (!window.AppVisitasInforme || !window.AppVisitasInforme.downloadPdf) {
        showTop("Generador de informe no disponible.");
        return;
      }
      await window.AppVisitasInforme.downloadPdf({
        fecha: inpFecha.value,
        usuario: session.usuario,
        visitas: visitasDiaCache,
        jornada: {
          km_inicio: kmInicio.value,
          km_fin: kmFin.value,
        },
      });
      showTop("Informe descargado.", "success");
    } catch (e) {
      showTop(String(e.message || e) || "Error al generar el PDF.");
    } finally {
      btnInforme.disabled = false;
    }
  });

  inpFecha.value = todayYmd();
  cargarClientes().then(function () {
    cargarDia();
  });
})();
