/**
 * Inicio supervisor — resumen de unidades a cargo y visitas del mes vs meta prorrateada.
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockNoSupervisor = document.getElementById("blockNoSupervisor");
  var blockSupervisor = document.getElementById("blockSupervisor");
  var msg = document.getElementById("msg");
  var loading = document.getElementById("loading");
  var lista = document.getElementById("listaUnidades");
  var supPeriodo = document.getElementById("supPeriodo");

  var MESES = [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  if (window.AppAuth.normalizeCargo(session.cargo) !== "supervisor") {
    blockNoSupervisor.hidden = false;
    return;
  }

  blockSupervisor.hidden = false;

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "setTitle", title: "Inicio" }, "*");
    }
  } catch (e) {
    /* ignore */
  }

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function barClass(pct) {
    if (pct == null || isNaN(pct)) {
      return "sup-bar-fill--muted";
    }
    if (pct >= 100) {
      return "sup-bar-fill--ok";
    }
    if (pct >= 70) {
      return "sup-bar-fill--warn";
    }
    return "sup-bar-fill--low";
  }

  function render(data) {
    lista.innerHTML = "";
    var p = data.periodo || {};
    var m = p.mes != null ? MESES[p.mes] || String(p.mes) : "";
    supPeriodo.textContent =
      "Mes en curso: " + (m ? m.charAt(0).toUpperCase() + m.slice(1) : "—") + " " + (p.anio || "") +
      " · Meta de visitas prorrateada hasta hoy (" +
      (p.fraccion_mes_transcurrido != null ? p.fraccion_mes_transcurrido : "—") +
      " del mes).";

    var units = data.unidades || [];
    if (!units.length) {
      var empty = document.createElement("p");
      empty.className = "sup-inicio__empty";
      empty.textContent =
        "No tiene unidades asignadas en la hoja «Unidades» (columna supervisor). Solicite al administrador que vincule su usuario como supervisor.";
      lista.appendChild(empty);
      return;
    }

    units.forEach(function (u) {
      var pct = u.pct_cumplimiento;
      var pctNum = pct != null && !isNaN(pct) ? pct : 0;
      var w = Math.min(100, Math.round(pctNum * 10) / 10);

      var card = document.createElement("article");
      card.className = "sup-unit-card card";

      var h = document.createElement("h3");
      h.className = "sup-unit-card__title";
      h.textContent = u.unidad || u.id_unidad || "—";

      var sub = document.createElement("p");
      sub.className = "sup-unit-card__cliente";
      sub.textContent = u.cliente ? "Cliente: " + u.cliente : "";

      var track = document.createElement("div");
      track.className = "sup-bar-track";
      var fill = document.createElement("div");
      fill.className = "sup-bar-fill " + barClass(pct);
      fill.style.width = w + "%";
      fill.setAttribute("role", "progressbar");
      fill.setAttribute("aria-valuenow", String(Math.round(pctNum)));
      fill.setAttribute("aria-valuemin", "0");
      fill.setAttribute("aria-valuemax", "150");
      track.appendChild(fill);

      var foot = document.createElement("p");
      foot.className = "sup-unit-card__stats";
      var esp = u.rondas_esperadas_hasta_hoy != null ? u.rondas_esperadas_hasta_hoy : "—";
      var cnt = u.supervisiones_mes != null ? u.supervisiones_mes : "—";
      var metaM = u.rondas_mensuales != null ? u.rondas_mensuales : "—";
      var s0 = document.createElement("strong");
      s0.textContent = String(cnt);
      foot.appendChild(s0);
      foot.appendChild(document.createTextNode(" visitas registradas · meta prorrateada: "));
      var s1 = document.createElement("strong");
      s1.textContent = String(esp);
      foot.appendChild(s1);
      foot.appendChild(document.createTextNode(" (rondas mensuales: " + String(metaM) + ")"));
      if (pct != null && !isNaN(pct)) {
        foot.appendChild(document.createTextNode(" · "));
        var s2 = document.createElement("strong");
        s2.textContent = pct + "% del objetivo";
        foot.appendChild(s2);
      }

      card.appendChild(h);
      if (sub.textContent) {
        card.appendChild(sub);
      }
      card.appendChild(track);
      card.appendChild(foot);
      lista.appendChild(card);
    });
  }

  async function cargar() {
    hideMsg();
    loading.hidden = false;
    lista.innerHTML = "";
    try {
      var res = await window.AppApi.get("getResumenSupervisor", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar el resumen.");
        loading.hidden = true;
        return;
      }
      render(res.data || {});
    } catch (e) {
      showMsg("Error de red al cargar el resumen.");
    }
    loading.hidden = true;
  }

  cargar();
})();
