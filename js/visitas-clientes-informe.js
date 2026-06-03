/**
 * Informe PDF diario — visitas a clientes.
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isSafeImageUrl(u) {
    var s = String(u || "").trim();
    return s.indexOf("https://") === 0 || s.indexOf("http://") === 0;
  }

  function loadImageAsDataUrl(url) {
    return new Promise(function (resolve) {
      var src = String(url || "").trim();
      if (!isSafeImageUrl(src)) {
        resolve("");
        return;
      }
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (e) {
          resolve(src);
        }
      };
      img.onerror = function () {
        resolve(src);
      };
      img.src = src;
    });
  }

  async function resolvePhotoMap(urls) {
    var map = {};
    var list = (urls || []).filter(isSafeImageUrl);
    await Promise.all(
      list.map(async function (url) {
        map[url] = await loadImageAsDataUrl(url);
      })
    );
    return map;
  }

  function collectAllUrls(payload) {
    var urls = [];
    function add(u) {
      if (isSafeImageUrl(u) && urls.indexOf(u) < 0) {
        urls.push(u);
      }
    }
    (payload.visitas || []).forEach(function (v) {
      var d = v.datos || {};
      (d.fotos_visita || []).forEach(add);
      (d.novedades || []).forEach(function (n) {
        add(n.foto);
      });
    });
    return urls;
  }

  function photosHtml(urls, caption, photoMap) {
    if (!urls || !urls.length) {
      return "";
    }
    var h = '<div class="as-pdf-photos">';
    urls.forEach(function (u, i) {
      if (!isSafeImageUrl(u)) {
        return;
      }
      var src = (photoMap && photoMap[u]) || u;
      h +=
        '<figure class="as-pdf-photo"><img src="' +
        esc(src) +
        '" alt="' +
        esc(caption + " " + (i + 1)) +
        '" /><figcaption>' +
        esc(caption + " " + (i + 1)) +
        "</figcaption></figure>";
    });
    h += "</div>";
    return h;
  }

  function formatFechaDisplay(f) {
    if (!f) {
      return "—";
    }
    var p = String(f).split("-");
    if (p.length === 3) {
      return p[2] + "/" + p[1] + "/" + p[0];
    }
    return f;
  }

  function buildReportHtml(payload, photoMap) {
    var logo = global.AppConfig ? global.AppConfig.getCompanyLogoUrl() : "";
    var j = payload.jornada || {};
    var kmIni = j.km_inicio != null && j.km_inicio !== "" ? String(j.km_inicio) : "—";
    var kmFin = j.km_fin != null && j.km_fin !== "" ? String(j.km_fin) : "—";
    var kmRec = "—";
    if (j.km_inicio !== "" && j.km_fin !== "" && !isNaN(parseFloat(j.km_inicio)) && !isNaN(parseFloat(j.km_fin))) {
      var diff = parseFloat(j.km_fin) - parseFloat(j.km_inicio);
      if (!isNaN(diff)) {
        kmRec = diff.toFixed(1) + " km";
      }
    }

    var html =
      '<div class="as-pdf-root">' +
      '<header class="as-pdf-header">' +
      (logo
        ? '<img class="as-pdf-logo" src="' + esc(logo) + '" alt="Logo" crossorigin="anonymous" />'
        : "") +
      '<div class="as-pdf-header-text">' +
      "<h1>Informe de visitas a clientes</h1>" +
      "<p>" +
      esc(formatFechaDisplay(payload.fecha)) +
      " · " +
      esc(payload.usuario || "") +
      "</p></div></header>" +
      '<section class="as-pdf-section"><h2>Resumen de jornada</h2>' +
      '<table class="as-pdf-table"><tbody>' +
      "<tr><th scope=\"row\">Fecha</th><td>" +
      esc(formatFechaDisplay(payload.fecha)) +
      "</td></tr>" +
      "<tr><th scope=\"row\">Supervisor</th><td>" +
      esc(payload.usuario || "") +
      "</td></tr>" +
      "<tr><th scope=\"row\">Visitas registradas</th><td>" +
      String((payload.visitas || []).length) +
      "</td></tr>" +
      "<tr><th scope=\"row\">Km inicio</th><td>" +
      esc(kmIni) +
      "</td></tr>" +
      "<tr><th scope=\"row\">Km fin</th><td>" +
      esc(kmFin) +
      "</td></tr>" +
      "<tr><th scope=\"row\">Km recorrido</th><td>" +
      esc(kmRec) +
      "</td></tr></tbody></table></section>";

    (payload.visitas || []).forEach(function (v, idx) {
      var d = v.datos || {};
      var novHtml = "";
      (d.novedades || []).forEach(function (n, ni) {
        novHtml +=
          '<div class="vis-pdf-nov">' +
          "<strong>Novedad " +
          (ni + 1) +
          ":</strong> " +
          esc(n.texto || "—");
        if (n.foto && isSafeImageUrl(n.foto)) {
          novHtml += photosHtml([n.foto], "Novedad " + (ni + 1), photoMap);
        }
        novHtml += "</div>";
      });
      if (!novHtml) {
        novHtml = "<p>Sin novedades registradas.</p>";
      }

      html +=
        '<section class="as-pdf-section vis-pdf-visita">' +
        "<h2>Visita " +
        (idx + 1) +
        ": " +
        esc(v.cliente || "") +
        " — " +
        esc(v.unidad || "") +
        "</h2>" +
        '<table class="as-pdf-table"><tbody>' +
        "<tr><th scope=\"row\">Hora inicio</th><td>" +
        esc(v.hora_inicio || "—") +
        "</td></tr>" +
        "<tr><th scope=\"row\">Cliente</th><td>" +
        esc(v.cliente || "") +
        "</td></tr>" +
        "<tr><th scope=\"row\">Unidad</th><td>" +
        esc(v.unidad || "") +
        "</td></tr></tbody></table>" +
        "<h3 style=\"font-size:0.9rem;margin:0.75rem 0 0.35rem;color:#1e4a7a\">Fotos de la visita</h3>" +
        (d.fotos_visita && d.fotos_visita.length
          ? photosHtml(d.fotos_visita, "Visita", photoMap)
          : "<p>Sin fotos.</p>") +
        "<h3 style=\"font-size:0.9rem;margin:0.75rem 0 0.35rem;color:#1e4a7a\">Novedades</h3>" +
        novHtml +
        "</section>";
    });

    html +=
      '<footer class="as-pdf-footer">Generado el ' +
      esc(new Date().toLocaleString("es-PE")) +
      "</footer></div>";
    return html;
  }

  async function downloadPdf(payload) {
    if (!global.html2pdf) {
      throw new Error("No se cargó la librería de PDF.");
    }
    if (!payload || !payload.visitas || !payload.visitas.length) {
      throw new Error("No hay visitas guardadas para esta fecha.");
    }

    var photoMap = await resolvePhotoMap(collectAllUrls(payload));

    var host = document.getElementById("visPdfHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "visPdfHost";
      host.className = "as-pdf-host";
      host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host);
    }
    host.innerHTML = buildReportHtml(payload, photoMap);

    if (global.AppConfig && global.AppConfig.getCompanyLogoUrl) {
      var logoEl = host.querySelector(".as-pdf-logo");
      if (logoEl) {
        try {
          logoEl.src = await loadImageAsDataUrl(global.AppConfig.getCompanyLogoUrl());
        } catch (e) {
          /* ok */
        }
      }
    }

    var fname =
      "Informe_Visitas_" +
      String(payload.fecha || "dia").replace(/-/g, "") +
      ".pdf";

    await global
      .html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename: fname,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(host.querySelector(".as-pdf-root"))
      .save();
    host.innerHTML = "";
  }

  global.AppVisitasInforme = {
    downloadPdf: downloadPdf,
  };
})(typeof window !== "undefined" ? window : this);
