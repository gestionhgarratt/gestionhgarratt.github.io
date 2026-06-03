/**
 * Informe PDF y vistas previas — visitas a clientes.
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

  function attrSrc(url) {
    var s = String(url || "").trim();
    if (!s) {
      return "";
    }
    if (s.indexOf("data:image") === 0) {
      return s.replace(/"/g, "%22");
    }
    return esc(s);
  }

  function parseDatos(raw) {
    if (!raw) {
      return {};
    }
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return {};
      }
    }
    return raw;
  }

  function formatHoraVisita(h) {
    if (h instanceof Date) {
      var pad = function (n) {
        return n < 10 ? "0" + n : String(n);
      };
      return pad(h.getHours()) + ":" + pad(h.getMinutes());
    }
    var s = String(h == null ? "" : h).trim();
    if (!s) {
      return "—";
    }
    var m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      var hh = parseInt(m[1], 10);
      var mm = parseInt(m[2], 10);
      if (!isNaN(hh) && !isNaN(mm)) {
        return (hh < 10 ? "0" + hh : String(hh)) + ":" + (mm < 10 ? "0" + mm : String(mm));
      }
    }
    var n = parseFloat(s.replace(",", "."));
    if (!isNaN(n) && n >= 0 && n < 1) {
      var totalMin = Math.round(n * 24 * 60);
      var h2 = Math.floor(totalMin / 60) % 24;
      var mi = totalMin % 60;
      return (h2 < 10 ? "0" + h2 : String(h2)) + ":" + (mi < 10 ? "0" + mi : String(mi));
    }
    return s;
  }

  function normalizeVisitaDatos(raw) {
    var d = parseDatos(raw);
    var fotos = [];
    if (Array.isArray(d.fotos_visita)) {
      d.fotos_visita.forEach(function (u) {
        var url = typeof u === "string" ? u : u && u.url ? u.url : "";
        if (isSafeImageUrl(url)) {
          fotos.push(url);
        }
      });
    }
    var novedades = [];
    if (Array.isArray(d.novedades)) {
      d.novedades.forEach(function (n) {
        if (!n || typeof n !== "object") {
          return;
        }
        var texto = String(n.texto != null ? n.texto : n.text != null ? n.text : "").trim();
        var foto = String(n.foto || "").trim();
        if (texto || (foto && isSafeImageUrl(foto))) {
          novedades.push({ texto: texto, foto: foto });
        }
      });
    }
    return { fotos_visita: fotos, novedades: novedades };
  }

  function cloudinaryFetchUrl(url) {
    var u = String(url || "").trim();
    if (u.indexOf("res.cloudinary.com") < 0 || u.indexOf("/upload/") < 0) {
      return u;
    }
    if (u.indexOf("/upload/f_auto") >= 0) {
      return u;
    }
    return u.replace("/upload/", "/upload/f_auto,q_85/");
  }

  function loadImageAsDataUrl(url, timeoutMs) {
    var src = cloudinaryFetchUrl(url);
    var ms = timeoutMs || 12000;
    return new Promise(function (resolve) {
      if (!isSafeImageUrl(src)) {
        resolve("");
        return;
      }
      var settled = false;
      function done(val) {
        if (!settled) {
          settled = true;
          resolve(val || src);
        }
      }
      var timer = setTimeout(function () {
        done(src);
      }, ms);

      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        clearTimeout(timer);
        try {
          var canvas = document.createElement("canvas");
          var maxW = 1100;
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          if (!w || !h) {
            done(src);
            return;
          }
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          done(canvas.toDataURL("image/jpeg", 0.9));
        } catch (e) {
          done(src);
        }
      };
      img.onerror = function () {
        clearTimeout(timer);
        done(src);
      };
      img.src = src;
    });
  }

  async function resolvePhotoMap(urls) {
    var map = {};
    var list = (urls || []).filter(isSafeImageUrl);
    await Promise.all(
      list.map(async function (url) {
        map[url] = await loadImageAsDataUrl(url, 10000);
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
      var d = normalizeVisitaDatos(v.datos);
      d.fotos_visita.forEach(add);
      d.novedades.forEach(function (n) {
        add(n.foto);
      });
    });
    return urls;
  }

  function imgSrc(url, photoMap, forPdf) {
    if (!isSafeImageUrl(url)) {
      return "";
    }
    if (forPdf && photoMap && photoMap[url]) {
      return photoMap[url];
    }
    return url;
  }

  function photosHtml(urls, caption, photoMap, forPdf) {
    if (!urls || !urls.length) {
      return '<p class="vis-pdf-empty">Sin fotos.</p>';
    }
    var h = '<div class="vis-pdf-photos">';
    urls.forEach(function (u, i) {
      var src = imgSrc(u, photoMap, forPdf);
      if (!src) {
        return;
      }
      h +=
        '<figure class="vis-pdf-photo">' +
        '<img src="' +
        attrSrc(src) +
        '" alt="' +
        esc(caption + " " + (i + 1)) +
        '" crossorigin="anonymous" loading="eager" />' +
        "<figcaption>" +
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

  function buildVisitaSectionHtml(v, idx, payload, photoMap, forPdf) {
    var d = normalizeVisitaDatos(v.datos);
    var hora = formatHoraVisita(v.hora_inicio);
    var novHtml = "";

    if (!d.novedades.length) {
      novHtml = '<p class="vis-pdf-empty">Sin novedades registradas.</p>';
    } else {
      d.novedades.forEach(function (n, ni) {
        novHtml += '<div class="vis-pdf-nov-block">';
        novHtml += '<p class="vis-pdf-nov-title">Novedad ' + (ni + 1) + "</p>";
        novHtml +=
          '<p class="vis-pdf-nov-text">' +
          esc(n.texto || "—").replace(/\n/g, "<br />") +
          "</p>";
        if (n.foto && isSafeImageUrl(n.foto)) {
          novHtml += photosHtml([n.foto], "Evidencia novedad " + (ni + 1), photoMap, forPdf);
        }
        novHtml += "</div>";
      });
    }

    return (
      '<section class="as-pdf-section vis-pdf-visita">' +
      '<div class="vis-pdf-visita-head">' +
      "<h2>Visita " +
      (idx + 1) +
      "</h2>" +
      '<p class="vis-pdf-hora-badge">Hora de inicio: <strong>' +
      esc(hora) +
      "</strong></p>" +
      "</div>" +
      '<table class="as-pdf-table"><tbody>' +
      '<tr><th scope="row">Hora de inicio</th><td><strong>' +
      esc(hora) +
      "</strong></td></tr>" +
      '<tr><th scope="row">Cliente</th><td>' +
      esc(v.cliente || "—") +
      "</td></tr>" +
      '<tr><th scope="row">Unidad</th><td>' +
      esc(v.unidad || "—") +
      "</td></tr>" +
      '<tr><th scope="row">Fecha jornada</th><td>' +
      esc(formatFechaDisplay(v.fecha || payload.fecha)) +
      "</td></tr></tbody></table>" +
      '<h3 class="vis-pdf-subtitle">Fotos de la visita (' +
      d.fotos_visita.length +
      ")</h3>" +
      photosHtml(d.fotos_visita, "Foto visita", photoMap, forPdf) +
      '<h3 class="vis-pdf-subtitle">Novedades encontradas (' +
      d.novedades.length +
      ")</h3>" +
      novHtml +
      "</section>"
    );
  }

  function buildReportHtml(payload, photoMap, forPdf) {
    var logo = global.AppConfig ? global.AppConfig.getCompanyLogoUrl() : "";
    var j = payload.jornada || {};
    var kmIni = j.km_inicio != null && j.km_inicio !== "" ? String(j.km_inicio) : "—";
    var kmFin = j.km_fin != null && j.km_fin !== "" ? String(j.km_fin) : "—";
    var kmRec = "—";
    if (
      j.km_inicio !== "" &&
      j.km_fin !== "" &&
      !isNaN(parseFloat(j.km_inicio)) &&
      !isNaN(parseFloat(j.km_fin))
    ) {
      var diff = parseFloat(j.km_fin) - parseFloat(j.km_inicio);
      if (!isNaN(diff)) {
        kmRec = diff.toFixed(1) + " km";
      }
    }

    var html =
      '<div class="as-pdf-root vis-pdf-root">' +
      '<header class="as-pdf-header">' +
      (logo
        ? '<img class="as-pdf-logo" src="' + esc(logo) + '" alt="Logo" crossorigin="anonymous" />'
        : "") +
      '<div class="as-pdf-header-text">' +
      "<h1>Informe de visitas a clientes</h1>" +
      "<p>Jornada del " +
      esc(formatFechaDisplay(payload.fecha)) +
      " · " +
      esc(payload.usuario || "") +
      "</p></div></header>" +
      '<section class="as-pdf-section"><h2>Resumen de jornada</h2>' +
      '<table class="as-pdf-table"><tbody>' +
      '<tr><th scope="row">Fecha</th><td>' +
      esc(formatFechaDisplay(payload.fecha)) +
      "</td></tr>" +
      '<tr><th scope="row">Supervisor</th><td>' +
      esc(payload.usuario || "") +
      "</td></tr>" +
      '<tr><th scope="row">Total visitas</th><td>' +
      String((payload.visitas || []).length) +
      "</td></tr>" +
      '<tr><th scope="row">Km inicio</th><td>' +
      esc(kmIni) +
      "</td></tr>" +
      '<tr><th scope="row">Km fin</th><td>' +
      esc(kmFin) +
      "</td></tr>" +
      '<tr><th scope="row">Km recorrido</th><td>' +
      esc(kmRec) +
      "</td></tr></tbody></table></section>";

    (payload.visitas || []).forEach(function (v, idx) {
      html += buildVisitaSectionHtml(v, idx, payload, photoMap, forPdf);
    });

    html +=
      '<footer class="as-pdf-footer">Documento generado el ' +
      esc(new Date().toLocaleString("es-PE")) +
      "</footer></div>";
    return html;
  }

  function buildVisitaDetailHtml(visita, idx, fechaJornada) {
    var payload = {
      fecha: fechaJornada,
      usuario: "",
      visitas: [visita],
      jornada: {},
    };
    return (
      '<div class="vis-detail-root">' +
      buildVisitaSectionHtml(visita, idx, payload, null, false) +
      "</div>"
    );
  }

  function waitForImages(root, maxMs) {
    return new Promise(function (resolve) {
      var imgs = root ? root.querySelectorAll("img") : [];
      if (!imgs.length) {
        resolve();
        return;
      }
      var pending = imgs.length;
      var done = false;
      function check() {
        pending--;
        if (pending <= 0 && !done) {
          done = true;
          resolve();
        }
      }
      setTimeout(function () {
        if (!done) {
          done = true;
          resolve();
        }
      }, maxMs || 20000);
      imgs.forEach(function (img) {
        if (img.complete && img.naturalWidth > 0) {
          check();
        } else {
          img.onload = check;
          img.onerror = check;
        }
      });
    });
  }

  /** A4 retrato a 96 dpi: 210 mm ≈ 794 px de ancho total. */
  var A4_WIDTH_PX = 794;
  var PDF_PAD_MM = 10;

  /** Documento donde renderizar (ventana principal, no el iframe estrecho). */
  function getPdfDocument() {
    try {
      if (global.parent && global.parent !== global && global.parent.document) {
        return global.parent.document;
      }
    } catch (e) {
      /* mismo origen esperado */
    }
    return document;
  }

  function applyPdfLayout(host, root) {
    if (host) {
      host.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        "width:" + A4_WIDTH_PX + "px",
        "max-width:" + A4_WIDTH_PX + "px",
        "min-width:" + A4_WIDTH_PX + "px",
        "z-index:2147483646",
        "opacity:0.01",
        "pointer-events:none",
        "overflow:visible",
        "background:#fff",
        "margin:0",
        "padding:0",
        "box-sizing:border-box",
      ].join(";");
    }
    if (root) {
      root.style.width = A4_WIDTH_PX + "px";
      root.style.maxWidth = A4_WIDTH_PX + "px";
      root.style.minWidth = A4_WIDTH_PX + "px";
      root.style.boxSizing = "border-box";
      root.style.padding = PDF_PAD_MM + "mm";
      root.style.margin = "0";
      root.style.background = "#fff";
    }
  }

  function getPdfHost() {
    var doc = getPdfDocument();
    var host = doc.getElementById("visPdfHost");
    if (!host) {
      host = doc.createElement("div");
      host.id = "visPdfHost";
      doc.body.appendChild(host);
    }
    host.className = "as-pdf-host vis-pdf-print-host";
    host.setAttribute("aria-hidden", "true");
    return host;
  }

  async function downloadPdf(payload) {
    if (!global.html2pdf) {
      throw new Error("No se cargó la librería de PDF. Recargue la página.");
    }
    if (!payload || !payload.visitas || !payload.visitas.length) {
      throw new Error("No hay visitas guardadas para esta fecha.");
    }

    var photoMap = await resolvePhotoMap(collectAllUrls(payload));
    var host = getPdfHost();
    host.innerHTML = buildReportHtml(payload, photoMap, true);

    var root = host.querySelector(".as-pdf-root");
    if (!root) {
      throw new Error("No se pudo armar el contenido del informe.");
    }

    if (global.AppConfig && global.AppConfig.getCompanyLogoUrl) {
      var logoEl = host.querySelector(".as-pdf-logo");
      if (logoEl) {
        try {
          var logoData = await loadImageAsDataUrl(global.AppConfig.getCompanyLogoUrl(), 8000);
          if (logoData) {
            logoEl.src = logoData;
          }
        } catch (eLogo) {
          /* mantener URL */
        }
      }
    }

    applyPdfLayout(host, root);
    await waitForImages(host, 25000);

    var fname =
      "Informe_Visitas_" + String(payload.fecha || "dia").replace(/-/g, "") + ".pdf";

    var worker = global.html2pdf().set({
      margin: 0,
      filename: fname,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollY: 0,
        scrollX: 0,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".vis-pdf-photo", ".vis-pdf-nov-block"],
      },
    });

    await worker.from(root).save();
    host.innerHTML = "";
    host.removeAttribute("style");
  }

  function renderVisitaDetail(container, visita, idx, fechaJornada) {
    if (!container) {
      return;
    }
    container.innerHTML = buildVisitaDetailHtml(visita, idx, fechaJornada);
  }

  function renderInformePreview(container, payload) {
    if (!container) {
      return;
    }
    container.innerHTML = buildReportHtml(payload, null, false);
  }

  global.AppVisitasInforme = {
    downloadPdf: downloadPdf,
    formatHoraVisita: formatHoraVisita,
    normalizeVisitaDatos: normalizeVisitaDatos,
    renderVisitaDetail: renderVisitaDetail,
    renderInformePreview: renderInformePreview,
    buildReportHtml: buildReportHtml,
  };
})(typeof window !== "undefined" ? window : this);
