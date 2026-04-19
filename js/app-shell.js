/**
 * main.html — administrador: sidebar + iframe; supervisor: barra inferior + iframe.
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    window.location.replace("login.html");
    return;
  }

  var modules = window.AppAuth.getModulesForUser(session);
  if (!modules.length) {
    window.AppAuth.clearSession();
    window.location.replace("login.html");
    return;
  }

  var cargoNorm = window.AppAuth.normalizeCargo(session.cargo);
  var isAdmin = cargoNorm === "administrador";
  var isGerencia = cargoNorm === "gerencia";
  var useAdminShell = isAdmin || isGerencia;

  var appShell = document.querySelector(".app-shell");
  if (isGerencia && appShell) {
    appShell.classList.add("app-shell--gerencia");
  }
  var sidebar = document.getElementById("sidebar");
  var backdrop = document.getElementById("backdrop");
  var nav = document.getElementById("nav");
  var bottomNav = document.getElementById("bottomNav");
  var frame = document.getElementById("contentFrame");
  var topTitle = document.getElementById("topTitle");
  var userLine = document.getElementById("userLine");
  var cargoLine = document.getElementById("cargoLine");
  var btnMenu = document.getElementById("btnMenu");
  var btnLogout = document.getElementById("btnLogout");
  var topUserSlot = document.getElementById("topUserSlot");
  var topUserLabel = document.getElementById("topUserLabel");
  var btnLogoutTop = document.getElementById("btnLogoutTop");

  userLine.textContent = session.nombres || session.usuario;
  cargoLine.textContent = isAdmin ? "Administrador" : isGerencia ? "Gerencia" : "Supervisor";

  function closeSidebar() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
  }

  function openSidebar() {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-visible");
  }

  if (btnMenu) {
    btnMenu.addEventListener("click", function () {
      if (sidebar.classList.contains("is-open")) closeSidebar();
      else openSidebar();
    });
  }

  backdrop.addEventListener("click", closeSidebar);

  function doLogout() {
    window.AppAuth.clearSession();
    window.location.replace("login.html");
  }

  btnLogout.addEventListener("click", doLogout);
  if (btnLogoutTop) {
    btnLogoutTop.addEventListener("click", doLogout);
  }

  function setActiveModule(id) {
    [nav, bottomNav].forEach(function (container) {
      if (!container) return;
      container.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-module") === id);
      });
    });
  }

  function loadModule(mod) {
    if (!mod || !frame) return;
    topTitle.textContent = mod.label;
    setActiveModule(mod.id);
    frame.src = mod.file;
    closeSidebar();
  }

  if (useAdminShell) {
    modules.forEach(function (mod) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-module", mod.id);
      btn.textContent = mod.label;
      btn.addEventListener("click", function () {
        loadModule(mod);
      });
      nav.appendChild(btn);
    });
    if (bottomNav) {
      bottomNav.hidden = true;
    }
    if (topUserSlot) {
      topUserSlot.hidden = true;
    }
  } else {
    appShell.classList.add("app-shell--supervisor");
    if (topUserSlot && topUserLabel) {
      topUserSlot.hidden = false;
      topUserLabel.textContent = session.usuario || "—";
    }
    if (bottomNav) {
      bottomNav.hidden = false;
      modules.forEach(function (mod) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-module", mod.id);
        btn.className = "app-shell__bottomnav-btn";
        var lab = document.createElement("span");
        lab.className = "app-shell__bottomnav-label";
        lab.textContent = mod.label;
        btn.appendChild(lab);
        btn.addEventListener("click", function () {
          loadModule(mod);
        });
        bottomNav.appendChild(btn);
      });
    }
    nav.innerHTML = "";
  }

  window.addEventListener("message", function (ev) {
    if (!ev.data || ev.data.type !== "setTitle") return;
    if (typeof ev.data.title === "string") topTitle.textContent = ev.data.title;
  });

  loadModule(modules[0]);
})();
