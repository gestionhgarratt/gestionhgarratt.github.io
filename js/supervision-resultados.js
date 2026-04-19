/**
 * Resultados de supervisión — solo administrador.
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
  var tbody = document.getElementById("tbody");
  var btnRefrescar = document.getElementById("btnRefrescar");
  var dlg = document.getElementById("dlgDetalle");
  var dlgBody = document.getElementById("dlgDetalleBody");
  var btnDlgCerrar = document.getElementById("btnDlgCerrar");

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

  function esc(s) {
    var t = String(s == null ? "" : s);
    return t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isSafeImageUrl(u) {
    var s = String(u || "").trim();
    return s.indexOf("https://") === 0 || s.indexOf("http://") === 0;
  }

  function addMetaRow(dl, label, value) {
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value != null && value !== "" ? String(value) : "—";
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function addPhotoRow(container, url, caption) {
    if (!url || !isSafeImageUrl(url)) {
      return;
    }
    var fig = document.createElement("figure");
    var img = document.createElement("img");
    img.src = url;
    img.alt = caption || "Evidencia";
    img.loading = "lazy";
    var cap = document.createElement("figcaption");
    cap.textContent = caption || "";
    fig.appendChild(img);
    fig.appendChild(cap);
    container.appendChild(fig);
  }

  function addSection(container, title) {
    var sec = document.createElement("section");
    sec.className = "detail-section";
    var h = document.createElement("h4");
    h.textContent = title;
    sec.appendChild(h);
    container.appendChild(sec);
    return sec;
  }

  function addLine(sec, label, value) {
    var div = document.createElement("div");
    div.className = "detail-row";
    var strong = document.createElement("strong");
    strong.textContent = label + ": ";
    div.appendChild(strong);
    div.appendChild(document.createTextNode(value != null && value !== "" ? String(value) : "—"));
    sec.appendChild(div);
  }

  function labelCumpleOLegacy(v) {
    if (v === null || v === undefined || v === "") {
      return "No aplica";
    }
    var s = String(v).trim().toLowerCase();
    if (s === "cumple") {
      return "Cumple";
    }
    if (s === "no_cumple" || s === "no cumple" || s === "nocumple") {
      return "No cumple";
    }
    var n = parseInt(String(v), 10);
    if (!isNaN(n) && n >= 1 && n <= 5) {
      return "Registro anterior (1–5): " + n;
    }
    return String(v);
  }

  function renderDetalle(rec) {
    dlgBody.textContent = "";

    var dl = document.createElement("dl");
    dl.className = "detail-meta";
    addMetaRow(dl, "ID", rec.id_supervision);
    addMetaRow(dl, "Fecha y hora", rec.fecha_hora);
    addMetaRow(dl, "Supervisor", rec.supervisor);
    addMetaRow(dl, "Cliente", rec.cliente);
    addMetaRow(dl, "Unidad", rec.unidad);
    dlgBody.appendChild(dl);

    var d = rec.datos || {};
    var pr = d.presentacion || {};
    var co = d.conocimiento || {};
    var doc = d.documentacion || {};
    var pe = d.percepcion_cliente || {};

    var s1 = addSection(dlgBody, "Presentación");
    addLine(s1, "Uniforme (1–5)", pr.uniforme);
    addLine(s1, "Aseo (1–5)", pr.aseo);
    addLine(s1, "Observación", pr.observacion);
    var ph1 = document.createElement("div");
    ph1.className = "detail-photos";
    addPhotoRow(ph1, pr.foto_uniforme, "Foto — uniforme");
    addPhotoRow(ph1, pr.foto_aseo, "Foto — aseo");
    s1.appendChild(ph1);

    var s2 = addSection(dlgBody, "Conocimiento");
    addLine(s2, "Funciones generales (1–5)", co.funciones_generales);
    addLine(s2, "Funciones específicas (1–5)", co.funciones_especificas);
    addLine(s2, "Observación", co.observacion);

    var s3 = addSection(dlgBody, "Documentación");
    addLine(s3, "Carnet SUCAMEC vigente", labelCumpleOLegacy(doc.carnet_sucamec));
    addLine(s3, "Licencia L4 vigente", labelCumpleOLegacy(doc.licencia_l4));
    addLine(s3, "Funciones del puesto documentadas (1–5)", doc.funciones_puesto_documentadas);
    addLine(s3, "Cuaderno de ocurrencias (1–5)", doc.cuaderno_ocurrencias);
    addLine(s3, "Observación", doc.observacion);
    var ph3 = document.createElement("div");
    ph3.className = "detail-photos";
    addPhotoRow(ph3, doc.foto, "Foto — documentación");
    s3.appendChild(ph3);

    var s4 = addSection(dlgBody, "Percepción del cliente");
    addLine(s4, "Personal de seguridad (1–5)", pe.personal_seguridad);
    addLine(s4, "Supervisor (1–5)", pe.supervisor);
    addLine(s4, "Respuesta administrativa (1–5)", pe.respuesta_administrativa);
    addLine(s4, "Observación", pe.observacion);
    var ph4 = document.createElement("div");
    ph4.className = "detail-photos";
    addPhotoRow(ph4, pe.foto, "Foto — percepción del cliente");
    s4.appendChild(ph4);
  }

  async function verDetalle(id) {
    hideMsg();
    dlgBody.innerHTML = '<p class="msg msg--info">Cargando…</p>';
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    }
    try {
      var res = await window.AppApi.get("getSupervision", {
        caller: session.usuario,
        id: id,
      });
      if (!res || res.status !== "success" || !res.data || !res.data.record) {
        dlgBody.innerHTML =
          '<p class="msg msg--error">' + esc((res && res.message) || "No se pudo cargar el detalle.") + "</p>";
        return;
      }
      renderDetalle(res.data.record);
    } catch (e) {
      dlgBody.innerHTML = '<p class="msg msg--error">Error de red.</p>';
    }
  }

  function renderTabla(rows) {
    tbody.innerHTML = "";
    if (!rows || !rows.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "No hay registros. Asegúrate de haber creado la pestaña supervision y de tener envíos.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      ["fecha_hora", "supervisor", "cliente", "unidad"].forEach(function (k) {
        var td = document.createElement("td");
        td.textContent = row[k] != null ? String(row[k]) : "";
        tr.appendChild(td);
      });
      var tdAct = document.createElement("td");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--ghost";
      btn.style.minHeight = "36px";
      btn.style.padding = "0.35rem 0.75rem";
      btn.textContent = "Ver";
      btn.addEventListener("click", function () {
        verDetalle(row.id_supervision);
      });
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }

  async function cargar() {
    hideMsg();
    loading.hidden = false;
    tbody.innerHTML = "";
    try {
      var res = await window.AppApi.get("listSupervisiones", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar el listado.");
        loading.hidden = true;
        return;
      }
      renderTabla((res.data && res.data.rows) || []);
    } catch (e) {
      showMsg("Error de red.");
    }
    loading.hidden = true;
  }

  btnRefrescar.addEventListener("click", cargar);

  btnDlgCerrar.addEventListener("click", function () {
    dlg.close();
  });

  dlg.addEventListener("click", function (ev) {
    if (ev.target === dlg) {
      dlg.close();
    }
  });

  cargar();
})();
