/**
 * Configuración global — reemplaza SCRIPT_URL tras desplegar Apps Script como Web App.
 * El script debe estar vinculado al mismo spreadsheet (bd_supervisor).
 */
(function (global) {
  "use strict";

  /** @type {string} URL del deploy (termina en /exec) */
  var SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycby8r9az1F8Q8Or0ZAzsiaO3SfSLW4LMBNhJI9u68EKYlgvmHqVmccEWCiQUFPQZ90lk/exec";

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
      { id: "capacitaciones", label: "Capacitaciones", file: "pages/capacitaciones.html" },
      { id: "listasCapacitacion", label: "Listas de capacitación", file: "pages/listas-capacitacion.html" },
      {
        id: "controlServicio",
        label: "Control de servicio",
        file: "pages/control-servicio.html",
      },
      { id: "supervision", label: "Supervisión", file: "pages/supervision.html" },
      { id: "incidentes", label: "Incidentes", file: "pages/incidentes.html" },
      {
        id: "analisisSeguridad",
        label: "Análisis de seguridad",
        file: "pages/analisis-seguridad.html",
      },
      {
        id: "resultadosAnalisisSeguridad",
        label: "Resultados análisis seguridad",
        file: "pages/analisis-seguridad-resultados.html",
      },
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
      {
        id: "analisisSeguridad",
        label: "Análisis de seguridad",
        file: "pages/analisis-seguridad.html",
      },
    ],
    gerencia: [{ id: "dashboard", label: "Dashboard ejecutivo", file: "pages/dashboard.html" }],
  };

  /** Subida directa (preset sin firmar en Cloudinary). */
  var CLOUDINARY = {
    cloudName: "dcxezyakl",
    uploadPreset: "KLO_GOES",
  };

  var STORAGE_KEY = "cs_kpis_session_v1";

  /** Valor de id_cliente / id_unidad para prospectos (no están en la hoja clientes). */
  var PROSPECTO_CLIENTE_ID = "__prospecto__";

  /** Logo corporativo (informes PDF y dashboard). */
  var COMPANY_LOGO_URL =
    "https://res.cloudinary.com/drunurx3a/image/upload/v1767735454/paestextil/products/r9n4oib5wmaby9vsq3yh.png";

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
    getProspectoClienteId: function () {
      return PROSPECTO_CLIENTE_ID;
    },
    getCompanyLogoUrl: function () {
      return COMPANY_LOGO_URL;
    },
    isProspectoCliente: function (id) {
      return String(id || "").trim() === PROSPECTO_CLIENTE_ID;
    },
  };
})(typeof window !== "undefined" ? window : this);
