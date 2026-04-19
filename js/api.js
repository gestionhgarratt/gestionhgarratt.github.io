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

  global.AppApi = {
    get: apiGet,
    postVerify: apiPostVerify,
  };
})(typeof window !== "undefined" ? window : this);
