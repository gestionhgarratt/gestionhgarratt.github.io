/**
 * Sesión en localStorage y helpers de rol.
 */
(function (global) {
  "use strict";

  function readSession() {
    var cfg = global.AppConfig;
    if (!cfg) return null;
    try {
      var raw = global.localStorage.getItem(cfg.getStorageKey());
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.usuario || !s.cargo) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function writeSession(obj) {
    global.localStorage.setItem(global.AppConfig.getStorageKey(), JSON.stringify(obj));
  }

  function clearSession() {
    global.localStorage.removeItem(global.AppConfig.getStorageKey());
  }

  function normalizeCargo(cargo) {
    var c = String(cargo || "")
      .trim()
      .toLowerCase();
    if (c === "administrador" || c === "admin") return "administrador";
    if (c === "supervisor") return "supervisor";
    if (c === "gerencia") return "gerencia";
    return c;
  }

  function isAdmin(session) {
    var s = session || readSession();
    return normalizeCargo(s && s.cargo) === "administrador";
  }

  function isGerencia(session) {
    var s = session || readSession();
    return normalizeCargo(s && s.cargo) === "gerencia";
  }

  /** Administrador o Gerencia: acceso al dashboard ejecutivo. */
  function isDashboardViewer(session) {
    return isAdmin(session) || isGerencia(session);
  }

  function isSupervisorOrAdmin(session) {
    var s = session || readSession();
    var c = normalizeCargo(s && s.cargo);
    return c === "administrador" || c === "supervisor";
  }

  function getModulesForUser(session) {
    var s = session || readSession();
    var cargo = normalizeCargo(s && s.cargo);
    var map = global.AppConfig.getModuleAccess();
    if (cargo === "administrador") return map.administrador.slice();
    if (cargo === "gerencia" && map.gerencia) return map.gerencia.slice();
    if (cargo === "supervisor") return map.supervisor.slice();
    return [];
  }

  global.AppAuth = {
    readSession: readSession,
    writeSession: writeSession,
    clearSession: clearSession,
    normalizeCargo: normalizeCargo,
    isAdmin: isAdmin,
    isGerencia: isGerencia,
    isDashboardViewer: isDashboardViewer,
    isSupervisorOrAdmin: isSupervisorOrAdmin,
    getModulesForUser: getModulesForUser,
  };
})(typeof window !== "undefined" ? window : this);
