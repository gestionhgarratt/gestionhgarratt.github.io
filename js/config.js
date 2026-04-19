/**
 * Configuración global — reemplaza SCRIPT_URL tras desplegar Apps Script como Web App.
 * El script debe estar vinculado al mismo spreadsheet (bd_supervisor).
 */
(function (global) {
  "use strict";

  /** @type {string} URL del deploy (termina en /exec) */
  var SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxwTcXQDcZp_vbZSCw5H3228ouASsEtc6ER3VlBc06__ES0E8UNs2O_YuaOnXrifLMl/exec";

  /** Navegación por rol (Usuarios solo administrador). */
  var MODULE_ACCESS = {
    administrador: [
      { id: "dashboard", label: "Dashboard", file: "pages/dashboard.html" },
      {
        id: "clientes",
        label: "Clientes y unidades",
        file: "pages/clientes-unidades.html",
      },
      { id: "usuarios", label: "Usuarios", file: "pages/usuarios.html" },
      { id: "kpis", label: "KPIs", file: "pages/kpis.html" },
      {
        id: "controlServicio",
        label: "Control de servicio",
        file: "pages/control-servicio.html",
      },
      { id: "supervision", label: "Supervisión", file: "pages/supervision.html" },
      { id: "incidentes", label: "Incidentes", file: "pages/incidentes.html" },
      {
        id: "resultadosSupervision",
        label: "Resultados supervisión",
        file: "pages/supervision-resultados.html",
      },
      {
        id: "resultadosIncidentes",
        label: "Resultados incidentes",
        file: "pages/incidentes-resultados.html",
      },
    ],
    supervisor: [
      { id: "inicio", label: "Inicio", file: "pages/inicio.html" },
      { id: "supervision", label: "Supervisión", file: "pages/supervision.html" },
      { id: "incidentes", label: "Incidentes", file: "pages/incidentes.html" },
    ],
    gerencia: [{ id: "dashboard", label: "Dashboard ejecutivo", file: "pages/dashboard.html" }],
  };

  /** Subida directa (preset sin firmar en Cloudinary). */
  var CLOUDINARY = {
    cloudName: "dcxezyakl",
    uploadPreset: "KLO_GOES",
  };

  var STORAGE_KEY = "cs_kpis_session_v1";

  global.AppConfig = {
    getScriptUrl: function () {
      return SCRIPT_URL;
    },
    setScriptUrl: function (url) {
      SCRIPT_URL = url;
    },
    getModuleAccess: function () {
      return MODULE_ACCESS;
    },
    getStorageKey: function () {
      return STORAGE_KEY;
    },
    getCloudinary: function () {
      return CLOUDINARY;
    },
  };
})(typeof window !== "undefined" ? window : this);
