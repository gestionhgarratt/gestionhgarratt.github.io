/**
 * Resultados de incidentes — solo administrador.
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

  function labelTipo(t) {
    var m = {
      amenaza: "Amenaza",
      vulnerabilidad: "Vulnerabilidad",
      condicion_insegura: "Condición insegura",
    };
    var k = String(t || "")
      .trim()
      .toLowerCase();
    return m[k] || (t ? String(t) : "—");
  }

  function labelNivel(n) {
    var m = { bajo: "Bajo", medio: "Medio", alto: "Alto" };
    var k = String(n || "")
      .trim()
      .toLowerCase();
    return m[k] || (n ? String(n) : "—");
  }

  function renderDetalle(rec) {
    dlgBody.textContent = "";

    var dl = document.createElement("dl");
    dl.className = "detail-meta";
    addMetaRow(dl, "ID", rec.id_incidente);
    addMetaRow(dl, "Fecha y hora", rec.fecha_hora);
    addMetaRow(dl, "Usuario", rec.usuario);
    addMetaRow(dl, "Cliente", rec.cliente);
    addMetaRow(dl, "Unidad", rec.unidad);
    dlgBody.appendChild(dl);

    var d = rec.datos || {};
    var sec = addSection(dlgBody, "Incidente");
    addLine(sec, "Tipo de incidente", labelTipo(d.tipo_incidente));
    addLine(sec, "Detalle", d.detalle);
    addLine(sec, "Nivel de riesgo", labelNivel(d.nivel_riesgo));

    var ph = document.createElement("div");
    ph.className = "detail-photos";
    addPhotoRow(ph, d.foto, "Foto");
    sec.appendChild(ph);
  }

  async function verDetalle(id) {
    hideMsg();
    dlgBody.innerHTML = '<p class="msg msg--info">Cargando…</p>';
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    }
    try {
      var res = await window.AppApi.get("getIncidente", {
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
      td.textContent =
        "No hay registros. Crea la pestaña incidentes (crearPestanasIncidentes) y registra desde el módulo Incidentes.";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      ["fecha_hora", "usuario", "cliente", "unidad"].forEach(function (k) {
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
        verDetalle(row.id_incidente);
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
      var res = await window.AppApi.get("listIncidentes", { caller: session.usuario });
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
