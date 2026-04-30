/**
 * Comunicación con Google Apps Script — GET JSON y POST no-cors + verificación GET.
 */
(function (global) {
  "use strict";

  function getConfig() {
    return global.AppConfig;
  }

  function buildQuery(params) {
    var parts = [];
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])));
      }
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  /**
   * GET al script — espera JSON { status, data?, message? }
   */
  async function apiGet(action, extraParams) {
    var cfg = getConfig();
    var url = cfg.getScriptUrl() + buildQuery(Object.assign({ action: action }, extraParams || {}));
    var res = await fetch(url, { method: "GET", cache: "no-store" });
    var text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { status: "error", message: "Respuesta no válida del servidor." };
    }
  }

  /**
   * GET por JSONP (evita CORS en frontends estáticos).
   */
  function apiGetJsonp(action, extraParams, timeoutMs) {
    return new Promise(function (resolve) {
      var cfg = getConfig();
      var scriptUrl = cfg.getScriptUrl();
      if (!scriptUrl || scriptUrl.indexOf("PEGA_AQUI") !== -1) {
        resolve({ status: "error", message: "Configura SCRIPT_URL en js/config.js" });
        return;
      }
      var cbName = "__appJsonp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      var cleaned = false;
      var to = null;
      var script = document.createElement("script");
      function cleanup() {
        if (cleaned) {
          return;
        }
        cleaned = true;
        if (to) {
          clearTimeout(to);
        }
        try {
          delete global[cbName];
        } catch (eDel) {
          global[cbName] = undefined;
        }
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }
      global[cbName] = function (payload) {
        cleanup();
        resolve(payload || { status: "error", message: "Respuesta vacía." });
      };
      script.onerror = function () {
        cleanup();
        resolve({ status: "error", message: "No se pudo completar la consulta JSONP." });
      };
      var params = Object.assign({ action: action, callback: cbName }, extraParams || {});
      script.src = scriptUrl + buildQuery(params);
      to = setTimeout(function () {
        cleanup();
        resolve({ status: "error", message: "Tiempo de espera agotado (JSONP)." });
      }, timeoutMs || 10000);
      document.head.appendChild(script);
    });
  }

  function generateRequestId() {
    if (global.crypto && global.crypto.randomUUID) {
      return global.crypto.randomUUID();
    }
    return "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
  }

  /**
   * POST application/x-www-form-urlencoded en mode no-cors, luego GET de verificación.
   */
  async function apiPostVerify(action, payload, verifyAction, maxAttempts, delayMs) {
    var cfg = getConfig();
    var scriptUrl = cfg.getScriptUrl();
    if (!scriptUrl || scriptUrl.indexOf("PEGA_AQUI") !== -1) {
      return { status: "error", message: "Configura SCRIPT_URL en js/config.js" };
    }

    var requestId = generateRequestId();
    var body = new URLSearchParams();
    body.set("action", action);
    body.set("requestId", requestId);
    body.set("data", JSON.stringify(payload || {}));

    await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString(),
    });

    var attempts = maxAttempts || 12;
    var delay = delayMs || 400;
    var verify = verifyAction || "getPendingResult";

    for (var i = 0; i < attempts; i++) {
      if (i > 0) {
        await new Promise(function (r) {
          setTimeout(r, delay);
        });
      }
      var out = await apiGet(verify, { requestId: requestId });
      if (out && out.status === "pending") {
        continue;
      }
      return out;
    }

    return { status: "error", message: "Tiempo de espera agotado. Intenta de nuevo." };
  }

  /**
   * POST via form+iframe + verificación por JSONP (sin CORS).
   */
  async function apiPostVerifyJsonp(action, payload, verifyAction, maxAttempts, delayMs) {
    var cfg = getConfig();
    var scriptUrl = cfg.getScriptUrl();
    if (!scriptUrl || scriptUrl.indexOf("PEGA_AQUI") !== -1) {
      return { status: "error", message: "Configura SCRIPT_URL en js/config.js" };
    }
    var requestId = generateRequestId();
    var iframeName = "__appPostIframe_" + requestId.replace(/[^a-z0-9_]/gi, "");
    var iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    var form = document.createElement("form");
    form.method = "POST";
    form.action = scriptUrl;
    form.target = iframeName;
    form.style.display = "none";
    function addHidden(name, value) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    addHidden("action", action);
    addHidden("requestId", requestId);
    addHidden("data", JSON.stringify(payload || {}));
    document.body.appendChild(form);
    try {
      form.submit();
    } catch (ePost) {
      if (form.parentNode) form.parentNode.removeChild(form);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      return { status: "error", message: "No se pudo enviar el formulario POST." };
    }
    if (form.parentNode) form.parentNode.removeChild(form);

    var attempts = maxAttempts || 12;
    var delay = delayMs || 400;
    var verify = verifyAction || "getPendingResult";
    for (var i = 0; i < attempts; i++) {
      if (i > 0) {
        await new Promise(function (r) {
          setTimeout(r, delay);
        });
      }
      var out = await apiGetJsonp(verify, { requestId: requestId }, 12000);
      if (out && out.status === "pending") {
        continue;
      }
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      return out;
    }
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return { status: "error", message: "Tiempo de espera agotado. Intenta de nuevo." };
  }

  global.AppApi = {
    get: apiGet,
    postVerify: apiPostVerify,
    getJsonp: apiGetJsonp,
    postVerifyJsonp: apiPostVerifyJsonp,
  };
})(typeof window !== "undefined" ? window : this);
