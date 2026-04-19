/**
 * Formulario de supervisión — supervisores y administradores.
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockDeny = document.getElementById("blockDeny");
  var form = document.getElementById("formSupervision");
  var msgTop = document.getElementById("msgTop");
  var fechaHoraDisplay = document.getElementById("fechaHoraDisplay");
  var supervisorDisplay = document.getElementById("supervisorDisplay");
  var selCliente = document.getElementById("selCliente");
  var selUnidad = document.getElementById("selUnidad");
  var chkL4Na = document.getElementById("chk_l4_na");
  var rowL4Choice = document.getElementById("rowL4Choice");
  var wrapL4Binary = document.getElementById("wrapL4Binary");
  var btnEnviar = document.getElementById("btnEnviar");
  var btnEnviarLabel = document.getElementById("btnEnviarLabel");
  var btnEnviarSpinner = document.getElementById("btnEnviarSpinner");
  var btnLimpiar = document.getElementById("btnLimpiar");

  if (!window.AppAuth.isSupervisorOrAdmin(session)) {
    blockDeny.hidden = false;
    return;
  }

  form.hidden = false;

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
    var txt =
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
    fechaHoraDisplay.textContent = txt;
  }

  supervisorDisplay.textContent =
    (session.nombres || "").trim() + " (" + (session.usuario || "") + ")";

  tickClock();
  setInterval(tickClock, 1000);

  function fillRatingContainers() {
    document.querySelectorAll(".js-rating").forEach(function (wrap) {
      if (wrap.querySelector(".rate__btn")) {
        return;
      }
      for (var i = 1; i <= 5; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "rate__btn";
        b.setAttribute("data-v", String(i));
        b.textContent = String(i);
        wrap.appendChild(b);
      }
    });
  }

  function syncRatingVisual(hidId) {
    var hid = document.getElementById(hidId);
    var wrap = document.querySelector('.js-rating[data-hid="' + hidId + '"]');
    if (!hid || !wrap) {
      return;
    }
    var v = String(hid.value || "");
    wrap.querySelectorAll(".rate__btn").forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-v") === v);
    });
  }

  function bindRatings() {
    document.querySelectorAll(".js-rating").forEach(function (wrap) {
      var hidId = wrap.getAttribute("data-hid");
      wrap.addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t || !t.classList || !t.classList.contains("rate__btn")) {
          return;
        }
        var hid = document.getElementById(hidId);
        if (!hid) {
          return;
        }
        hid.value = t.getAttribute("data-v") || "";
        syncRatingVisual(hidId);
      });
    });
  }

  function setL4Disabled(on) {
    rowL4Choice.classList.toggle("rate-row--disabled", on);
    wrapL4Binary.querySelectorAll(".binary__btn").forEach(function (b) {
      b.disabled = on;
    });
    if (on) {
      document.getElementById("hid_doc_l4").value = "";
      syncBinaryVisual("hid_doc_l4");
    }
  }

  function syncBinaryVisual(hidId) {
    var hid = document.getElementById(hidId);
    var wrap = document.querySelector('.binary[data-hid="' + hidId + '"]');
    if (!hid || !wrap) {
      return;
    }
    var v = String(hid.value || "");
    wrap.querySelectorAll(".binary__btn").forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-v") === v);
    });
  }

  function bindBinary() {
    document.querySelectorAll(".binary").forEach(function (wrap) {
      var hidId = wrap.getAttribute("data-hid");
      wrap.addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t || !t.classList || !t.classList.contains("binary__btn")) {
          return;
        }
        var hid = document.getElementById(hidId);
        if (!hid) {
          return;
        }
        hid.value = t.getAttribute("data-v") || "";
        syncBinaryVisual(hidId);
      });
    });
  }

  function clearBinary(hidId) {
    var hid = document.getElementById(hidId);
    if (hid) {
      hid.value = "";
    }
    syncBinaryVisual(hidId);
  }

  function bindL4() {
    chkL4Na.addEventListener("change", function () {
      setL4Disabled(chkL4Na.checked);
    });
    setL4Disabled(chkL4Na.checked);
  }

  function setPhotoPreview(urlId, url) {
    var box = document.querySelector('.js-photo-preview[data-url="' + urlId + '"]');
    var st = document.querySelector('.js-photo-status[data-url="' + urlId + '"]');
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
        st.textContent = "Imagen lista para enviar.";
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

  function bindPhotos() {
    document.querySelectorAll(".js-photo-file").forEach(function (inp) {
      inp.addEventListener("change", async function () {
        var urlId = inp.getAttribute("data-url");
        var hid = document.getElementById(urlId);
        var st = document.querySelector('.js-photo-status[data-url="' + urlId + '"]');
        if (!hid || !inp.files || !inp.files[0]) {
          return;
        }
        if (st) {
          st.textContent = "Subiendo…";
        }
        try {
          var url = await window.CloudinaryUpload.uploadImage(inp.files[0]);
          hid.value = url;
          setPhotoPreview(urlId, url);
        } catch (e) {
          if (st) {
            st.textContent = String(e.message || e);
          }
          hid.value = "";
          setPhotoPreview(urlId, "");
        }
        inp.value = "";
      });
    });
  }

  function requireRating(id, label) {
    var v = parseInt(String(document.getElementById(id).value || ""), 10);
    if (isNaN(v) || v < 1 || v > 5) {
      return label;
    }
    return "";
  }

  function requireCumple(id, label) {
    var v = String(document.getElementById(id).value || "").toLowerCase();
    if (v !== "cumple" && v !== "no_cumple") {
      return label;
    }
    return "";
  }

  function validate() {
    if (!selCliente.value) {
      return "Elige un cliente.";
    }
    if (!selUnidad.value) {
      return "Elige una unidad.";
    }
    var err =
      requireRating("hid_pr_uniforme", "Presentación: valora Uniforme.") ||
      requireRating("hid_pr_aseo", "Presentación: valora Aseo.") ||
      requireRating("hid_co_gen", "Conocimiento: valora funciones generales.") ||
      requireRating("hid_co_esp", "Conocimiento: valora funciones específicas.") ||
      requireCumple("hid_doc_sucamec", "Documentación: indica Cumple o No cumple para Carnet SUCAMEC.") ||
      requireRating("hid_doc_fun", "Documentación: valora funciones del puesto documentadas.") ||
      requireRating("hid_doc_cuad", "Documentación: valora cuaderno de ocurrencias.") ||
      requireRating("hid_pe_pers", "Percepción: valora personal de seguridad.") ||
      requireRating("hid_pe_sup", "Percepción: valora supervisor.") ||
      requireRating("hid_pe_resp", "Percepción: valora respuesta administrativa.");
    if (err) {
      return err;
    }
    if (!chkL4Na.checked) {
      var e2 = requireCumple(
        "hid_doc_l4",
        "Documentación: indica Cumple o No cumple para Licencia L4, o marca «no aplica»."
      );
      if (e2) {
        return e2;
      }
    }
    return "";
  }

  function collectDatos() {
    var lic = null;
    if (!chkL4Na.checked) {
      lic = String(document.getElementById("hid_doc_l4").value || "").trim().toLowerCase() || null;
    }
    return {
      presentacion: {
        uniforme: parseInt(document.getElementById("hid_pr_uniforme").value, 10),
        aseo: parseInt(document.getElementById("hid_pr_aseo").value, 10),
        foto_uniforme: String(document.getElementById("url_pr_uniforme").value || "").trim(),
        foto_aseo: String(document.getElementById("url_pr_aseo").value || "").trim(),
        observacion: String(document.getElementById("txt_pr_obs").value || "").trim(),
      },
      conocimiento: {
        funciones_generales: parseInt(document.getElementById("hid_co_gen").value, 10),
        funciones_especificas: parseInt(document.getElementById("hid_co_esp").value, 10),
        observacion: String(document.getElementById("txt_co_obs").value || "").trim(),
      },
      documentacion: {
        carnet_sucamec: String(document.getElementById("hid_doc_sucamec").value || "").trim().toLowerCase(),
        licencia_l4: lic,
        funciones_puesto_documentadas: parseInt(document.getElementById("hid_doc_fun").value, 10),
        cuaderno_ocurrencias: parseInt(document.getElementById("hid_doc_cuad").value, 10),
        foto: String(document.getElementById("url_doc").value || "").trim(),
        observacion: String(document.getElementById("txt_doc_obs").value || "").trim(),
      },
      percepcion_cliente: {
        personal_seguridad: parseInt(document.getElementById("hid_pe_pers").value, 10),
        supervisor: parseInt(document.getElementById("hid_pe_sup").value, 10),
        respuesta_administrativa: parseInt(document.getElementById("hid_pe_resp").value, 10),
        foto: String(document.getElementById("url_pe").value || "").trim(),
        observacion: String(document.getElementById("txt_pe_obs").value || "").trim(),
      },
    };
  }

  function clearRating(hidId) {
    var hid = document.getElementById(hidId);
    if (hid) {
      hid.value = "";
    }
    syncRatingVisual(hidId);
  }

  function resetForm() {
    hideTop();
    selUnidad.innerHTML = '<option value="">— Elija primero un cliente —</option>';
    selUnidad.disabled = true;
    selCliente.value = "";
    ["hid_pr_uniforme", "hid_pr_aseo", "hid_co_gen", "hid_co_esp", "hid_doc_fun", "hid_doc_cuad", "hid_pe_pers", "hid_pe_sup", "hid_pe_resp"].forEach(
      clearRating
    );
    clearBinary("hid_doc_sucamec");
    clearBinary("hid_doc_l4");
    [
      "url_pr_uniforme",
      "url_pr_aseo",
      "url_doc",
      "url_pe",
    ].forEach(function (id) {
      var h = document.getElementById(id);
      if (h) {
        h.value = "";
      }
      setPhotoPreview(id, "");
    });
    document.getElementById("txt_pr_obs").value = "";
    document.getElementById("txt_co_obs").value = "";
    document.getElementById("txt_doc_obs").value = "";
    document.getElementById("txt_pe_obs").value = "";
    chkL4Na.checked = true;
    setL4Disabled(true);
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

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideTop();
    var vmsg = validate();
    if (vmsg) {
      showTop(vmsg);
      return;
    }
    btnEnviar.disabled = true;
    btnEnviarLabel.hidden = true;
    btnEnviarSpinner.hidden = false;
    try {
      var res = await window.AppApi.postVerify(
        "submitSupervision",
        {
          caller: session.usuario,
          supervision: {
            id_cliente: selCliente.value,
            id_unidad: selUnidad.value,
            datos: collectDatos(),
          },
        },
        "getPendingResult",
        18,
        400
      );
      if (!res || res.status !== "success") {
        showTop((res && res.message) || "No se pudo registrar la supervisión.");
        btnEnviar.disabled = false;
        btnEnviarLabel.hidden = false;
        btnEnviarSpinner.hidden = true;
        return;
      }
      showTop("Supervisión registrada correctamente.", "success");
      resetForm();
      await cargarClientes();
    } catch (err) {
      showTop("Error de red al enviar.");
    }
    btnEnviar.disabled = false;
    btnEnviarLabel.hidden = false;
    btnEnviarSpinner.hidden = true;
  });

  btnLimpiar.addEventListener("click", function () {
    hideTop();
    resetForm();
    cargarClientes();
  });

  fillRatingContainers();
  bindRatings();
  bindBinary();
  bindL4();
  bindPhotos();
  cargarClientes();
})();
