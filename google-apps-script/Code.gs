/**
 * Apps Script vinculado al spreadsheet bd_supervisor.
 * Desplegar como aplicación web: Ejecutar como "Yo", acceso "Cualquier persona".
 *
 * Hoja "usuarios": A=usuario, B=password, C=cargo, D=nombres, E=primerlogin (fila 1 encabezados).
 * Hoja "clientes": A=id_cliente, B=cliente, C=estado.
 * Hoja "unidades": A=id_unidad, B=id_cliente, C=unidad, D=supervisor, E=rondas_mensuales.
 * Hoja "supervision": A=id_supervision, B=fecha_hora, C=supervisor, D=id_cliente, E=cliente, F=id_unidad, G=unidad, H=datos_json.
 * Hoja "incidentes": A=id_incidente, B=fecha_hora, C=usuario, D=id_cliente, E=cliente, F=id_unidad, G=unidad, H=datos_json.
 * Hoja "kpis": A=id_kpi, B=nombre, C=meta_mensual, D=logro, E=mes (1-12), F=anio, G=usuario, H=fecha_creacion.
 * Hoja "control_servicio_personal": A=id_cliente, B=id_unidad, C=anio, D=mes, E=cantidad_personal.
 * Hoja "control_servicio_dias": A=id_cliente, B=id_unidad, C=anio, D=mes, E=tipo, F..AJ = día 1..31.
 */
var USUARIOS_SHEET = "usuarios";
var CLIENTES_SHEET = "clientes";
var UNIDADES_SHEET = "unidades";
var SUPERVISION_SHEET = "supervision";
var INCIDENTES_SHEET = "incidentes";
var KPIS_SHEET = "kpis";
var CONTROL_SRV_PERSONAL_SHEET = "control_servicio_personal";
var CONTROL_SRV_DETALLE_SHEET = "control_servicio_dias";
var CACHE_PREFIX = "pend_";
var CACHE_SECONDS = 600;

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeCargo_(cargo) {
  var c = String(cargo || "")
    .trim()
    .toLowerCase();
  if (c === "admin" || c === "administrador") return "administrador";
  if (c === "supervisor") return "supervisor";
  if (c === "gerencia") return "gerencia";
  return c;
}

function doGet(e) {
  var p = e.parameter || {};
  var action = p.action;
  try {
    switch (action) {
      case "getPendingResult":
        return handleGetPendingResult_(p.requestId);
      case "ping":
        return jsonOut_({ status: "success", data: { ok: true } });
      case "listUsers":
        return handleListUsers_(p.caller);
      case "listClientes":
        return handleListClientes_(p.caller);
      case "listUnidades":
        return handleListUnidades_(p.caller, p.idCliente);
      case "listSupervisores":
        return handleListSupervisores_(p.caller);
      case "listClientesSupervision":
        return handleListClientesSupervision_(p.caller);
      case "listUnidadesSupervision":
        return handleListUnidadesSupervision_(p.caller, p.idCliente);
      case "listSupervisiones":
        return handleListSupervisiones_(p.caller);
      case "getSupervision":
        return handleGetSupervision_(p.caller, p.id);
      case "listIncidentes":
        return handleListIncidentes_(p.caller);
      case "getIncidente":
        return handleGetIncidente_(p.caller, p.id);
      case "getDashboardData":
        return handleGetDashboardData_(p);
      case "getResumenSupervisor":
        return handleGetResumenSupervisor_(p.caller);
      case "listKPIs":
        return handleListKPIs_(p.caller, p.anio, p.mes);
      case "getControlServicio":
        return handleGetControlServicio_(p.caller, p.anio, p.mes, p.idCliente, p.idUnidad);
      default:
        return jsonOut_({ status: "error", message: "Acción GET no reconocida." });
    }
  } catch (err) {
    return jsonOut_({ status: "error", message: String(err) });
  }
}

function doPost(e) {
  var p = e.parameter || {};
  var action = p.action;
  try {
    switch (action) {
      case "login":
        return handleLoginPost_(p);
      case "createUser":
        return handleCreateUserPost_(p);
      case "createCliente":
        return handleCreateClientePost_(p);
      case "createUnidad":
        return handleCreateUnidadPost_(p);
      case "submitSupervision":
        return handleSubmitSupervisionPost_(p);
      case "submitIncidente":
        return handleSubmitIncidentePost_(p);
      case "createKPI":
        return handleCreateKPIPost_(p);
      case "saveControlServicio":
        return handleSaveControlServicioPost_(p);
      default:
        return jsonOut_({ status: "error", message: "Acción POST no reconocida." });
    }
  } catch (err) {
    return jsonOut_({ status: "error", message: String(err) });
  }
}

function handleGetPendingResult_(requestId) {
  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;
  var raw = cache.get(key);
  if (!raw) {
    return jsonOut_({ status: "pending" });
  }
  cache.remove(key);
  try {
    var obj = JSON.parse(raw);
    return jsonOut_(obj);
  } catch (ex) {
    return jsonOut_({ status: "error", message: "Resultado corrupto." });
  }
}

function getUsuarioRowByCaller_(caller) {
  var u = String(caller || "").trim();
  if (!u) {
    return null;
  }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return null;
  }
  var values = sh.getDataRange().getValues();
  var norm = u.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var cu = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    if (cu === norm) {
      return { row: values[r], index: r };
    }
  }
  return null;
}

function assertCallerIsSupervisorOrAdmin_(caller) {
  var info = getUsuarioRowByCaller_(caller);
  if (!info) {
    return { ok: false, message: "Usuario no encontrado." };
  }
  var cargo = normalizeCargo_(info.row[2]);
  if (cargo === "administrador" || cargo === "supervisor") {
    return { ok: true };
  }
  return { ok: false, message: "Solo supervisores o administradores pueden usar este módulo." };
}

/** Solo rol supervisor (no administrador). */
function assertCallerIsSupervisorOnly_(caller) {
  var u = String(caller || "").trim();
  if (!u) {
    return { ok: false, message: "Falta el usuario." };
  }
  var info = getUsuarioRowByCaller_(u);
  if (!info) {
    return { ok: false, message: "Usuario no encontrado." };
  }
  if (normalizeCargo_(info.row[2]) === "supervisor") {
    return { ok: true, nombres: String(info.row[3] || "").trim() };
  }
  return { ok: false, message: "Este resumen solo está disponible para supervisores." };
}

/**
 * Unidades a cargo del supervisor y cumplimiento de visitas (supervisiones) en el mes calendario vigente,
 * frente a rondas mensuales prorrateadas hasta hoy.
 */
function handleGetResumenSupervisor_(caller) {
  var c = String(caller || "").trim();
  var auth = assertCallerIsSupervisorOnly_(c);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }

  var ugot = getUnidadesSheetOrError_();
  if (!ugot.ok) {
    return jsonOut_({ status: "error", message: ugot.message });
  }
  var callerNorm = c.toLowerCase();
  var uvals = ugot.sheet.getDataRange().getValues();
  var misUnidades = [];
  for (var u = 1; u < uvals.length; u++) {
    var idU = String(uvals[u][0] || "").trim();
    if (!idU) {
      continue;
    }
    var sup = String(uvals[u][3] || "")
      .trim()
      .toLowerCase();
    if (sup !== callerNorm) {
      continue;
    }
    misUnidades.push({
      id_unidad: idU,
      id_cliente: String(uvals[u][1] || "").trim(),
      unidad: String(uvals[u][2] || "").trim(),
      rondas_mensuales: Number(uvals[u][4]) || 0,
    });
  }

  var cgot = getClientesSheetOrError_();
  var cname = {};
  if (cgot.ok) {
    var cvals = cgot.sheet.getDataRange().getValues();
    for (var ci = 1; ci < cvals.length; ci++) {
      var cid = String(cvals[ci][0] || "").trim();
      if (cid) {
        cname[cid] = String(cvals[ci][1] || "").trim();
      }
    }
  }

  var now = new Date();
  var y = now.getFullYear();
  var mo = now.getMonth();
  var mesNum = mo + 1;
  var monthStartMs = new Date(y, mo, 1, 0, 0, 0).getTime();
  var monthEndMs = new Date(y, mo + 1, 0, 23, 59, 59, 999).getTime();
  var todayEndMs = new Date(y, mo, now.getDate(), 23, 59, 59, 999).getTime();
  var spanTotal = Math.max(1, monthEndMs - monthStartMs);
  var spanHastaHoy = Math.min(todayEndMs - monthStartMs, spanTotal);
  var fraccionMes = Math.min(1, Math.max(0.08, spanHastaHoy / spanTotal));

  var sgot = getSupervisionSheetOrError_();
  var svals = sgot.ok ? sgot.sheet.getDataRange().getValues() : [];

  var out = [];
  for (var i = 0; i < misUnidades.length; i++) {
    var uo = misUnidades[i];
    var rondas = uo.rondas_mensuales;
    var esperadas = Math.round(rondas * fraccionMes * 100) / 100;
    var cnt = 0;
    if (sgot.ok) {
      for (var r = 1; r < svals.length; r++) {
        var idUni = String(svals[r][5] || "").trim();
        if (idUni !== uo.id_unidad) {
          continue;
        }
        var supR = String(svals[r][2] || "")
          .trim()
          .toLowerCase();
        if (supR !== callerNorm) {
          continue;
        }
        var fdt = sheetDateCellToMs_(svals[r][1]);
        if (isNaN(fdt) || fdt < monthStartMs || fdt > todayEndMs) {
          continue;
        }
        cnt++;
      }
    }
    var pct = esperadas <= 0 ? null : Math.min(150, Math.round((cnt / esperadas) * 1000) / 10);
    out.push({
      id_unidad: uo.id_unidad,
      id_cliente: uo.id_cliente,
      unidad: uo.unidad,
      cliente: cname[uo.id_cliente] || "",
      rondas_mensuales: rondas,
      rondas_esperadas_hasta_hoy: esperadas,
      supervisiones_mes: cnt,
      pct_cumplimiento: pct,
    });
  }
  out.sort(function (a, b) {
    return String(a.cliente + a.unidad).localeCompare(String(b.cliente + b.unidad));
  });

  return jsonOut_({
    status: "success",
    data: {
      supervisor: c,
      nombres: auth.nombres || "",
      periodo: {
        anio: y,
        mes: mesNum,
        mes_inicio_ms: monthStartMs,
        mes_fin_ms: monthEndMs,
        fraccion_mes_transcurrido: Math.round(fraccionMes * 100) / 100,
      },
      unidades: out,
    },
  });
}

function assertCallerIsAdmin_(caller) {
  var u = String(caller || "").trim();
  if (!u) {
    return { ok: false, message: "Falta el usuario que realiza la acción." };
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + USUARIOS_SHEET + '".' };
  }
  var values = sh.getDataRange().getValues();
  var norm = u.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var cu = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    if (cu === norm) {
      if (normalizeCargo_(values[r][2]) === "administrador") {
        return { ok: true };
      }
      return { ok: false, message: "Solo un administrador puede realizar esta acción." };
    }
  }
  return { ok: false, message: "Usuario solicitante no encontrado." };
}

/** Administrador o Gerencia (solo lectura de indicadores / filtros del dashboard). */
function assertCallerCanViewDashboard_(caller) {
  var u = String(caller || "").trim();
  if (!u) {
    return { ok: false, message: "Falta el usuario que realiza la acción." };
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + USUARIOS_SHEET + '".' };
  }
  var values = sh.getDataRange().getValues();
  var norm = u.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var cu = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    if (cu === norm) {
      var cg = normalizeCargo_(values[r][2]);
      if (cg === "administrador" || cg === "gerencia") {
        return { ok: true };
      }
      return { ok: false, message: "No tiene permiso para consultar el dashboard." };
    }
  }
  return { ok: false, message: "Usuario solicitante no encontrado." };
}

function handleListUsers_(caller) {
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return jsonOut_({ status: "error", message: 'No existe la hoja "' + USUARIOS_SHEET + '".' });
  }
  var values = sh.getDataRange().getValues();
  var users = [];
  for (var r = 1; r < values.length; r++) {
    var usuario = String(values[r][0] || "").trim();
    if (!usuario) {
      continue;
    }
    users.push({
      usuario: usuario,
      cargo: normalizeCargo_(values[r][2]),
      nombres: String(values[r][3] || "").trim(),
      primerlogin: String(values[r][4] || "").trim(),
    });
  }
  return jsonOut_({ status: "success", data: { users: users } });
}

function handleCreateUserPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var u = data.user || {};
  var nuevoUsuario = String(u.usuario || "").trim();
  var password = String(u.password || "");
  var nombres = String(u.nombres || "").trim();
  var primerlogin = String(u.primerlogin || "").trim();
  var cargo = normalizeCargo_(u.cargo);

  if (!nuevoUsuario) {
    return finish({ status: "error", message: "El usuario es obligatorio." });
  }
  if (!password) {
    return finish({ status: "error", message: "La contraseña es obligatoria." });
  }
  if (!nombres) {
    return finish({ status: "error", message: "Los nombres son obligatorios." });
  }
  if (cargo !== "administrador" && cargo !== "supervisor" && cargo !== "gerencia") {
    return finish({ status: "error", message: 'El cargo debe ser "administrador", "supervisor" o "gerencia".' });
  }

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return finish({ status: "error", message: 'No existe la hoja "' + USUARIOS_SHEET + '".' });
  }

  var values = sh.getDataRange().getValues();
  var norm = nuevoUsuario.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var existing = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    if (existing === norm) {
      return finish({ status: "error", message: "Ya existe un usuario con ese nombre." });
    }
  }

  sh.appendRow([nuevoUsuario, password, cargo, nombres, primerlogin]);

  return finish({
    status: "success",
    data: {
      usuario: nuevoUsuario,
      cargo: cargo,
      nombres: nombres,
      primerlogin: primerlogin,
    },
  });
}

function handleLoginPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var usuario = String(data.usuario || "").trim();
  var password = String(data.password || "");

  if (!usuario || !password) {
    return finish({ status: "error", message: "Usuario y contraseña son obligatorios." });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return finish({ status: "error", message: 'No existe la hoja "' + USUARIOS_SHEET + '".' });
  }

  var values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return finish({ status: "error", message: "No hay usuarios registrados." });
  }

  var usuarioNorm = usuario.toLowerCase();
  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    var u = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    var pw = String(values[r][1] || "");
    if (u === usuarioNorm && pw === password) {
      rowIndex = r + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return finish({ status: "error", message: "Usuario o contraseña incorrectos." });
  }

  var row = values[rowIndex - 1];
  var cargoRaw = row[2];
  var cargo = normalizeCargo_(cargoRaw);
  if (cargo !== "administrador" && cargo !== "supervisor" && cargo !== "gerencia") {
    return finish({
      status: "error",
      message: 'El cargo debe ser "administrador", "supervisor" o "gerencia". Valor actual: ' + String(cargoRaw),
    });
  }

  var nombres = String(row[3] || "").trim() || usuario;
  var primerloginCell = row[4];
  var primerloginOut = String(primerloginCell || "").trim();

  if (!primerloginOut) {
    sh.getRange(rowIndex, 5).setValue("SI");
    primerloginOut = "SI";
  }

  var usuarioGuardado = String(values[rowIndex - 1][0] || "").trim() || usuario;

  return finish({
    status: "success",
    data: {
      usuario: usuarioGuardado,
      cargo: cargo,
      nombres: nombres,
      primerlogin: primerloginOut,
    },
  });
}

/**
 * Ejecutar una vez desde el editor de Apps Script (menú Ejecutar):
 * crea las pestañas "clientes" y "unidades" con encabezados si no existen o están vacías.
 */
function crearPestanasClientesYUnidades() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, CLIENTES_SHEET, ["id_cliente", "cliente", "estado"]);
  ensureSheetWithHeaders_(ss, UNIDADES_SHEET, [
    "id_unidad",
    "id_cliente",
    "unidad",
    "supervisor",
    "rondas_mensuales",
  ]);
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }
  var a1 = String(sh.getRange(1, 1).getValue() || "").trim();
  if (!a1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
}

function normalizeEstadoCliente_(estado) {
  var e = String(estado || "")
    .trim()
    .toLowerCase();
  if (e === "activo") return "activo";
  if (e === "inactivo") return "inactivo";
  return e;
}

function getClientesSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTES_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + CLIENTES_SHEET + '". Ejecuta crearPestanasClientesYUnidades().' };
  }
  return { ok: true, sheet: sh };
}

function getUnidadesSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UNIDADES_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + UNIDADES_SHEET + '". Ejecuta crearPestanasClientesYUnidades().' };
  }
  return { ok: true, sheet: sh };
}

function findClienteRowById_(values, idCliente) {
  var id = String(idCliente || "").trim();
  if (!id) return -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0] || "").trim() === id) {
      return r;
    }
  }
  return -1;
}

function isSupervisorUsuario_(usuarioSupervisor) {
  var u = String(usuarioSupervisor || "").trim();
  if (!u) return false;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USUARIOS_SHEET);
  if (!sh) return false;
  var values = sh.getDataRange().getValues();
  var norm = u.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var cu = String(values[r][0] || "")
      .trim()
      .toLowerCase();
    if (cu === norm && normalizeCargo_(values[r][2]) === "supervisor") {
      return true;
    }
  }
  return false;
}

function handleListClientes_(caller) {
  var auth = assertCallerCanViewDashboard_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var got = getClientesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][0] || "").trim();
    var nombre = String(values[r][1] || "").trim();
    if (!id && !nombre) {
      continue;
    }
    list.push({
      id_cliente: id,
      cliente: nombre,
      estado: normalizeEstadoCliente_(values[r][2]) === "inactivo" ? "inactivo" : "activo",
    });
  }
  return jsonOut_({ status: "success", data: { clientes: list } });
}

function handleListUnidades_(caller, idCliente) {
  var auth = assertCallerCanViewDashboard_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var idc = String(idCliente || "").trim();
  if (!idc) {
    return jsonOut_({ status: "error", message: "Falta idCliente para listar unidades." });
  }
  var got = getUnidadesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var csh = getClientesSheetOrError_();
  if (!csh.ok) {
    return jsonOut_({ status: "error", message: csh.message });
  }
  var cvals = csh.sheet.getDataRange().getValues();
  if (findClienteRowById_(cvals, idc) < 0) {
    return jsonOut_({ status: "error", message: "Cliente no encontrado." });
  }
  var values = got.sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][1] || "").trim() !== idc) {
      continue;
    }
    var idu = String(values[r][0] || "").trim();
    if (!idu) {
      continue;
    }
    list.push({
      id_unidad: idu,
      id_cliente: idc,
      unidad: String(values[r][2] || "").trim(),
      supervisor: String(values[r][3] || "").trim(),
      rondas_mensuales: Number(values[r][4]) || 0,
    });
  }
  return jsonOut_({ status: "success", data: { unidades: list } });
}

function handleListSupervisores_(caller) {
  var auth = assertCallerCanViewDashboard_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USUARIOS_SHEET);
  if (!sh) {
    return jsonOut_({ status: "error", message: 'No existe la hoja "' + USUARIOS_SHEET + '".' });
  }
  var values = sh.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    if (normalizeCargo_(values[r][2]) !== "supervisor") {
      continue;
    }
    var usuario = String(values[r][0] || "").trim();
    if (!usuario) {
      continue;
    }
    list.push({
      usuario: usuario,
      nombres: String(values[r][3] || "").trim() || usuario,
    });
  }
  return jsonOut_({ status: "success", data: { supervisores: list } });
}

function handleCreateClientePost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var got = getClientesSheetOrError_();
  if (!got.ok) {
    return finish({ status: "error", message: got.message });
  }
  var sh = got.sheet;

  var c = data.cliente || {};
  var nombre = String(c.cliente || "").trim();
  var estado = normalizeEstadoCliente_(c.estado);

  if (!nombre) {
    return finish({ status: "error", message: "El nombre del cliente es obligatorio." });
  }
  if (estado !== "activo" && estado !== "inactivo") {
    return finish({ status: "error", message: 'El estado debe ser "activo" o "inactivo".' });
  }

  var values = sh.getDataRange().getValues();
  var normNombre = nombre.toLowerCase();
  for (var r = 1; r < values.length; r++) {
    var ex = String(values[r][1] || "")
      .trim()
      .toLowerCase();
    if (ex && ex === normNombre) {
      return finish({ status: "error", message: "Ya existe un cliente con ese nombre." });
    }
  }

  var id = Utilities.getUuid();
  sh.appendRow([id, nombre, estado]);

  return finish({
    status: "success",
    data: {
      id_cliente: id,
      cliente: nombre,
      estado: estado,
    },
  });
}

function handleCreateUnidadPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var u = data.unidad || {};
  var idCliente = String(u.idCliente || "").trim();
  var nombreUnidad = String(u.unidad || "").trim();
  var supervisor = String(u.supervisor || "").trim();
  var rondasRaw = u.rondasMensuales;

  if (!idCliente) {
    return finish({ status: "error", message: "Debe indicarse el cliente (id_cliente)." });
  }
  if (!nombreUnidad) {
    return finish({ status: "error", message: "El nombre de la unidad es obligatorio." });
  }
  if (!supervisor) {
    return finish({ status: "error", message: "Debe asignarse un supervisor." });
  }

  var rondas = parseInt(String(rondasRaw), 10);
  if (isNaN(rondas) || rondas < 0) {
    return finish({ status: "error", message: "Las rondas mensuales deben ser un número entero mayor o igual a 0." });
  }

  if (!isSupervisorUsuario_(supervisor)) {
    return finish({
      status: "error",
      message: "El supervisor debe ser un usuario existente con cargo supervisor.",
    });
  }

  var cgot = getClientesSheetOrError_();
  if (!cgot.ok) {
    return finish({ status: "error", message: cgot.message });
  }
  var cvals = cgot.sheet.getDataRange().getValues();
  if (findClienteRowById_(cvals, idCliente) < 0) {
    return finish({ status: "error", message: "Cliente no encontrado." });
  }

  var ugot = getUnidadesSheetOrError_();
  if (!ugot.ok) {
    return finish({ status: "error", message: ugot.message });
  }
  var ush = ugot.sheet;

  var id = Utilities.getUuid();
  ush.appendRow([id, idCliente, nombreUnidad, supervisor, rondas]);

  return finish({
    status: "success",
    data: {
      id_unidad: id,
      id_cliente: idCliente,
      unidad: nombreUnidad,
      supervisor: supervisor,
      rondas_mensuales: rondas,
    },
  });
}

/** Ejecutar una vez desde el editor: crea la pestaña "supervision" con encabezados. */
function crearPestanasSupervision() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, SUPERVISION_SHEET, [
    "id_supervision",
    "fecha_hora",
    "supervisor",
    "id_cliente",
    "cliente",
    "id_unidad",
    "unidad",
    "datos_json",
  ]);
}

function getSupervisionSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUPERVISION_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + SUPERVISION_SHEET + '". Ejecuta crearPestanasSupervision().' };
  }
  return { ok: true, sheet: sh };
}

function getClienteNombreById_(idCliente) {
  var got = getClientesSheetOrError_();
  if (!got.ok) {
    return "";
  }
  var vals = got.sheet.getDataRange().getValues();
  var r = findClienteRowById_(vals, idCliente);
  if (r < 0) {
    return "";
  }
  return String(vals[r][1] || "").trim();
}

function getUnidadInfoByIds_(idUnidad, idCliente) {
  var ugot = getUnidadesSheetOrError_();
  if (!ugot.ok) {
    return null;
  }
  var vals = ugot.sheet.getDataRange().getValues();
  var idu = String(idUnidad || "").trim();
  var idc = String(idCliente || "").trim();
  for (var r = 1; r < vals.length; r++) {
    if (String(vals[r][0] || "").trim() === idu && String(vals[r][1] || "").trim() === idc) {
      return { unidad: String(vals[r][2] || "").trim() };
    }
  }
  return null;
}

function scoreRequired_(v) {
  var n = parseInt(String(v), 10);
  return !isNaN(n) && n >= 1 && n <= 5;
}

function scoreOptional_(v) {
  if (v === null || v === undefined || v === "") {
    return true;
  }
  return scoreRequired_(v);
}

function clipText_(s, maxLen) {
  var t = String(s || "");
  if (t.length > maxLen) {
    return t.substring(0, maxLen);
  }
  return t;
}

function emptyOrHttpsUrl_(s) {
  var t = String(s || "").trim();
  if (!t) {
    return true;
  }
  return t.indexOf("https://") === 0 || t.indexOf("http://") === 0;
}

/** Carnet / L4: "cumple" | "no_cumple" */
function normalizeCumple_(v) {
  var s = String(v || "").trim().toLowerCase();
  if (s === "cumple") {
    return "cumple";
  }
  if (s === "no_cumple" || s === "no cumple" || s === "nocumple") {
    return "no_cumple";
  }
  return "";
}

function cumpleRequired_(v) {
  return normalizeCumple_(v) !== "";
}

function handleListClientesSupervision_(caller) {
  var auth = assertCallerIsSupervisorOrAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var got = getClientesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][0] || "").trim();
    var nombre = String(values[r][1] || "").trim();
    if (!id && !nombre) {
      continue;
    }
    var est = normalizeEstadoCliente_(values[r][2]) === "inactivo" ? "inactivo" : "activo";
    list.push({
      id_cliente: id,
      cliente: nombre,
      estado: est,
    });
  }
  return jsonOut_({ status: "success", data: { clientes: list } });
}

function handleListUnidadesSupervision_(caller, idCliente) {
  var auth = assertCallerIsSupervisorOrAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var idc = String(idCliente || "").trim();
  if (!idc) {
    return jsonOut_({ status: "error", message: "Falta idCliente para listar unidades." });
  }
  var got = getUnidadesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var cgot = getClientesSheetOrError_();
  if (!cgot.ok) {
    return jsonOut_({ status: "error", message: cgot.message });
  }
  var cvals = cgot.sheet.getDataRange().getValues();
  if (findClienteRowById_(cvals, idc) < 0) {
    return jsonOut_({ status: "error", message: "Cliente no encontrado." });
  }
  var values = got.sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][1] || "").trim() !== idc) {
      continue;
    }
    var idu = String(values[r][0] || "").trim();
    if (!idu) {
      continue;
    }
    list.push({
      id_unidad: idu,
      id_cliente: idc,
      unidad: String(values[r][2] || "").trim(),
      supervisor: String(values[r][3] || "").trim(),
      rondas_mensuales: Number(values[r][4]) || 0,
    });
  }
  return jsonOut_({ status: "success", data: { unidades: list } });
}

function handleSubmitSupervisionPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsSupervisorOrAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var s = data.supervision || {};
  var idCliente = String(s.id_cliente || "").trim();
  var idUnidad = String(s.id_unidad || "").trim();
  if (!idCliente || !idUnidad) {
    return finish({ status: "error", message: "Debe elegir cliente y unidad." });
  }

  var cvals = getClientesSheetOrError_();
  if (!cvals.ok) {
    return finish({ status: "error", message: cvals.message });
  }
  if (findClienteRowById_(cvals.sheet.getDataRange().getValues(), idCliente) < 0) {
    return finish({ status: "error", message: "Cliente no válido." });
  }
  var uinfo = getUnidadInfoByIds_(idUnidad, idCliente);
  if (!uinfo) {
    return finish({ status: "error", message: "La unidad no pertenece al cliente indicado." });
  }

  var d = s.datos || {};
  var pr = d.presentacion || {};
  var co = d.conocimiento || {};
  var doc = d.documentacion || {};
  var pe = d.percepcion_cliente || {};

  if (!scoreRequired_(pr.uniforme) || !scoreRequired_(pr.aseo)) {
    return finish({ status: "error", message: "Presentación: valora Uniforme y Aseo (1–5)." });
  }
  if (!emptyOrHttpsUrl_(pr.foto_uniforme) || !emptyOrHttpsUrl_(pr.foto_aseo)) {
    return finish({ status: "error", message: "URLs de fotos de presentación no válidas." });
  }

  if (!scoreRequired_(co.funciones_generales) || !scoreRequired_(co.funciones_especificas)) {
    return finish({ status: "error", message: "Conocimiento: valora ambas preguntas (1–5)." });
  }

  if (!cumpleRequired_(doc.carnet_sucamec)) {
    return finish({
      status: "error",
      message: "Documentación: indica Cumple o No cumple para Carnet SUCAMEC.",
    });
  }
  var licRaw = doc.licencia_l4;
  var licL4Out = null;
  if (licRaw !== null && licRaw !== undefined && String(licRaw).trim() !== "") {
    licL4Out = normalizeCumple_(licRaw);
    if (!licL4Out) {
      return finish({
        status: "error",
        message: "Documentación: Licencia L4 debe ser Cumple o No cumple (o dejar vacío si no aplica).",
      });
    }
  }
  if (!scoreRequired_(doc.funciones_puesto_documentadas) || !scoreRequired_(doc.cuaderno_ocurrencias)) {
    return finish({ status: "error", message: "Documentación: completa todas las valoraciones obligatorias (1–5)." });
  }
  if (!emptyOrHttpsUrl_(doc.foto)) {
    return finish({ status: "error", message: "URL de foto de documentación no válida." });
  }

  if (!scoreRequired_(pe.personal_seguridad) || !scoreRequired_(pe.supervisor) || !scoreRequired_(pe.respuesta_administrativa)) {
    return finish({ status: "error", message: "Percepción del cliente: valora las tres preguntas (1–5)." });
  }
  if (!emptyOrHttpsUrl_(pe.foto)) {
    return finish({ status: "error", message: "URL de foto de percepción no válida." });
  }

  var datosClean = {
    presentacion: {
      uniforme: parseInt(String(pr.uniforme), 10),
      aseo: parseInt(String(pr.aseo), 10),
      foto_uniforme: String(pr.foto_uniforme || "").trim(),
      foto_aseo: String(pr.foto_aseo || "").trim(),
      observacion: clipText_(pr.observacion, 6000),
    },
    conocimiento: {
      funciones_generales: parseInt(String(co.funciones_generales), 10),
      funciones_especificas: parseInt(String(co.funciones_especificas), 10),
      observacion: clipText_(co.observacion, 6000),
    },
    documentacion: {
      carnet_sucamec: normalizeCumple_(doc.carnet_sucamec),
      licencia_l4: licL4Out,
      funciones_puesto_documentadas: parseInt(String(doc.funciones_puesto_documentadas), 10),
      cuaderno_ocurrencias: parseInt(String(doc.cuaderno_ocurrencias), 10),
      foto: String(doc.foto || "").trim(),
      observacion: clipText_(doc.observacion, 6000),
    },
    percepcion_cliente: {
      personal_seguridad: parseInt(String(pe.personal_seguridad), 10),
      supervisor: parseInt(String(pe.supervisor), 10),
      respuesta_administrativa: parseInt(String(pe.respuesta_administrativa), 10),
      foto: String(pe.foto || "").trim(),
      observacion: clipText_(pe.observacion, 6000),
    },
  };

  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "America/Lima";
  var fechaHora = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

  var clienteNombre = getClienteNombreById_(idCliente);
  var unidadNombre = uinfo.unidad || "";

  var sgot = getSupervisionSheetOrError_();
  if (!sgot.ok) {
    return finish({ status: "error", message: sgot.message });
  }
  var idSup = Utilities.getUuid();
  sgot.sheet.appendRow([
    idSup,
    fechaHora,
    caller,
    idCliente,
    clienteNombre,
    idUnidad,
    unidadNombre,
    JSON.stringify(datosClean),
  ]);

  return finish({
    status: "success",
    data: {
      id_supervision: idSup,
      fecha_hora: fechaHora,
    },
  });
}

function handleListSupervisiones_(caller) {
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var got = getSupervisionSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][0] || "").trim();
    if (!id) {
      continue;
    }
    rows.push({
      id_supervision: id,
      fecha_hora: String(values[r][1] || ""),
      supervisor: String(values[r][2] || ""),
      id_cliente: String(values[r][3] || ""),
      cliente: String(values[r][4] || ""),
      id_unidad: String(values[r][5] || ""),
      unidad: String(values[r][6] || ""),
    });
  }
  rows.reverse();
  return jsonOut_({ status: "success", data: { rows: rows } });
}

function handleGetSupervision_(caller, id) {
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var idSup = String(id || "").trim();
  if (!idSup) {
    return jsonOut_({ status: "error", message: "Falta el identificador de la supervisión." });
  }
  var got = getSupervisionSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0] || "").trim() !== idSup) {
      continue;
    }
    var datos = {};
    try {
      datos = JSON.parse(String(values[r][7] || "{}"));
    } catch (ex) {
      datos = {};
    }
    return jsonOut_({
      status: "success",
      data: {
        record: {
          id_supervision: idSup,
          fecha_hora: String(values[r][1] || ""),
          supervisor: String(values[r][2] || ""),
          id_cliente: String(values[r][3] || ""),
          cliente: String(values[r][4] || ""),
          id_unidad: String(values[r][5] || ""),
          unidad: String(values[r][6] || ""),
          datos: datos,
        },
      },
    });
  }
  return jsonOut_({ status: "error", message: "Supervisión no encontrada." });
}

/** Ejecutar una vez: crea la pestaña "incidentes" con encabezados. */
function crearPestanasIncidentes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, INCIDENTES_SHEET, [
    "id_incidente",
    "fecha_hora",
    "usuario",
    "id_cliente",
    "cliente",
    "id_unidad",
    "unidad",
    "datos_json",
  ]);
}

/** Ejecutar una vez: crea la pestaña "kpis" con encabezados. */
function crearPestanasKPIs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, KPIS_SHEET, [
    "id_kpi",
    "nombre",
    "meta_mensual",
    "logro",
    "mes",
    "anio",
    "usuario",
    "fecha_creacion",
  ]);
}

/** Ejecutar una vez: hojas de control de servicio (personal + cuadrícula por día, por cliente/unidad). */
function crearPestanasControlServicio() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, CONTROL_SRV_PERSONAL_SHEET, ["id_cliente", "id_unidad", "anio", "mes", "cantidad_personal"]);
  var hdrDet = ["id_cliente", "id_unidad", "anio", "mes", "tipo"];
  for (var d = 1; d <= 31; d++) {
    hdrDet.push(String(d));
  }
  ensureSheetWithHeaders_(ss, CONTROL_SRV_DETALLE_SHEET, hdrDet);
}

/**
 * Migra hojas antiguas (sin cliente/unidad): inserta columnas A-B vacías y encabezados nuevos.
 * Ejecutar al guardar/cargar control de servicio, o manualmente una vez.
 */
function migrarControlServicioColumnasClienteUnidad() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureControlServicioMigracionUnidad_(ss.getSheetByName(CONTROL_SRV_PERSONAL_SHEET), true);
  ensureControlServicioMigracionUnidad_(ss.getSheetByName(CONTROL_SRV_DETALLE_SHEET), false);
}

function ensureControlServicioMigracionUnidad_(sh, isPersonal) {
  if (!sh) {
    return;
  }
  var a1 = String(sh.getRange(1, 1).getValue() || "")
    .trim()
    .toLowerCase();
  if (a1 === "id_cliente") {
    return;
  }
  if (a1 !== "anio") {
    return;
  }
  sh.insertColumnsBefore(1, 2);
  if (isPersonal) {
    sh.getRange(1, 1, 1, 5).setValues([["id_cliente", "id_unidad", "anio", "mes", "cantidad_personal"]]);
  } else {
    var hdr = ["id_cliente", "id_unidad", "anio", "mes", "tipo"];
    for (var d = 1; d <= 31; d++) {
      hdr.push(String(d));
    }
    sh.getRange(1, 1, 1, hdr.length).setValues([hdr]);
  }
  var last = sh.getLastRow();
  if (last > 1) {
    var nCol = sh.getLastColumn();
    var rng = sh.getRange(2, 1, last, nCol);
    var vals = rng.getValues();
    for (var r = 0; r < vals.length; r++) {
      vals[r][0] = "";
      vals[r][1] = "";
    }
    rng.setValues(vals);
  }
}

var TIPOS_CONTROL_SERVICIO_ = ["faltas", "suspensiones", "permisos", "vacaciones", "descanso_medico", "bajas"];

function controlServicioSheetsReady_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureControlServicioMigracionUnidad_(ss.getSheetByName(CONTROL_SRV_PERSONAL_SHEET), true);
  ensureControlServicioMigracionUnidad_(ss.getSheetByName(CONTROL_SRV_DETALLE_SHEET), false);
}

function getControlServicioPersonalSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_SRV_PERSONAL_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + CONTROL_SRV_PERSONAL_SHEET + '". Ejecuta crearPestanasControlServicio().' };
  }
  return { ok: true, sheet: sh };
}

function getControlServicioDetalleSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_SRV_DETALLE_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + CONTROL_SRV_DETALLE_SHEET + '". Ejecuta crearPestanasControlServicio().' };
  }
  return { ok: true, sheet: sh };
}

function diasEnMesControl_(anio, mes) {
  return new Date(parseInt(String(anio), 10), parseInt(String(mes), 10), 0).getDate();
}

function handleGetControlServicio_(caller, anioStr, mesStr, idClienteStr, idUnidadStr) {
  var auth = assertCallerIsAdmin_(String(caller || "").trim());
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var idCliente = String(idClienteStr || "").trim();
  var idUnidad = String(idUnidadStr || "").trim();
  if (!idCliente || !idUnidad) {
    return jsonOut_({ status: "error", message: "Debe indicar cliente y unidad." });
  }
  var anio = parseInt(String(anioStr || ""), 10);
  var mes = parseInt(String(mesStr || ""), 10);
  if (isNaN(anio) || anio < 2000 || anio > 2100) {
    return jsonOut_({ status: "error", message: "Año inválido." });
  }
  if (isNaN(mes) || mes < 1 || mes > 12) {
    return jsonOut_({ status: "error", message: "Mes inválido." });
  }
  var dMax = diasEnMesControl_(anio, mes);

  controlServicioSheetsReady_();

  var pg = getControlServicioPersonalSheetOrError_();
  var dg = getControlServicioDetalleSheetOrError_();

  var cant = 0;
  if (pg.ok) {
    var pv = pg.sheet.getDataRange().getValues();
    var h1 = String(pv[0][0] || "")
      .trim()
      .toLowerCase();
    var v2 = h1 === "id_cliente";
    for (var i = 1; i < pv.length; i++) {
      var rowAnio = parseInt(String(pv[i][v2 ? 2 : 0] || ""), 10);
      var rowMes = parseInt(String(pv[i][v2 ? 3 : 1] || ""), 10);
      var rowC = v2 ? String(pv[i][0] || "").trim() : "";
      var rowU = v2 ? String(pv[i][1] || "").trim() : "";
      if (rowAnio === anio && rowMes === mes && rowC === idCliente && rowU === idUnidad) {
        cant = Number(pv[i][v2 ? 4 : 2]) || 0;
        break;
      }
    }
  }

  var det = {};
  for (var t = 0; t < TIPOS_CONTROL_SERVICIO_.length; t++) {
    var tk = TIPOS_CONTROL_SERVICIO_[t];
    det[tk] = [];
    for (var z = 0; z < dMax; z++) {
      det[tk].push(0);
    }
  }

  if (dg.ok) {
    var vals = dg.sheet.getDataRange().getValues();
    var h1d = String(vals[0][0] || "")
      .trim()
      .toLowerCase();
    var v2d = h1d === "id_cliente";
    for (var r = 1; r < vals.length; r++) {
      var ra = parseInt(String(vals[r][v2d ? 2 : 0] || ""), 10);
      var rm = parseInt(String(vals[r][v2d ? 3 : 1] || ""), 10);
      var rc = v2d ? String(vals[r][0] || "").trim() : "";
      var ru = v2d ? String(vals[r][1] || "").trim() : "";
      if (ra !== anio || rm !== mes || rc !== idCliente || ru !== idUnidad) {
        continue;
      }
      var tipo = String(vals[r][v2d ? 4 : 2] || "")
        .trim()
        .toLowerCase();
      if (TIPOS_CONTROL_SERVICIO_.indexOf(tipo) < 0) {
        continue;
      }
      var base = v2d ? 4 : 2;
      for (var d = 1; d <= dMax; d++) {
        det[tipo][d - 1] = Number(vals[r][base + d]) || 0;
      }
    }
  }

  return jsonOut_({
    status: "success",
    data: {
      id_cliente: idCliente,
      id_unidad: idUnidad,
      anio: anio,
      mes: mes,
      dias_en_mes: dMax,
      cantidad_personal: cant,
      detalle: det,
    },
  });
}

function handleSaveControlServicioPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var idCliente = String(data.id_cliente || "").trim();
  var idUnidad = String(data.id_unidad || "").trim();
  if (!idCliente || !idUnidad) {
    return finish({ status: "error", message: "Debe indicar cliente y unidad." });
  }

  var anio = parseInt(String(data.anio || ""), 10);
  var mes = parseInt(String(data.mes || ""), 10);
  if (isNaN(anio) || anio < 2000 || anio > 2100) {
    return finish({ status: "error", message: "Año inválido." });
  }
  if (isNaN(mes) || mes < 1 || mes > 12) {
    return finish({ status: "error", message: "Mes inválido." });
  }
  var dMax = diasEnMesControl_(anio, mes);

  var cant = Number(data.cantidad_personal);
  if (isNaN(cant) || cant < 0) {
    return finish({ status: "error", message: "La cantidad de personal debe ser un número mayor o igual a 0." });
  }

  var detIn = data.detalle || {};
  var pg = getControlServicioPersonalSheetOrError_();
  if (!pg.ok) {
    return finish({ status: "error", message: pg.message });
  }
  var dg = getControlServicioDetalleSheetOrError_();
  if (!dg.ok) {
    return finish({ status: "error", message: dg.message });
  }

  controlServicioSheetsReady_();

  var pv = pg.sheet.getDataRange().getValues();
  var rowPersonal = -1;
  for (var i = 1; i < pv.length; i++) {
    if (
      String(pv[i][0] || "").trim() === idCliente &&
      String(pv[i][1] || "").trim() === idUnidad &&
      parseInt(String(pv[i][2] || ""), 10) === anio &&
      parseInt(String(pv[i][3] || ""), 10) === mes
    ) {
      rowPersonal = i + 1;
      break;
    }
  }
  if (rowPersonal > 0) {
    pg.sheet.getRange(rowPersonal, 5).setValue(cant);
  } else {
    pg.sheet.appendRow([idCliente, idUnidad, anio, mes, cant]);
  }

  for (var ti = 0; ti < TIPOS_CONTROL_SERVICIO_.length; ti++) {
    var tipo = TIPOS_CONTROL_SERVICIO_[ti];
    var arr = detIn[tipo];
    if (!arr || !(arr instanceof Array)) {
      return finish({ status: "error", message: "Falta el arreglo detalle para " + tipo + "." });
    }
    if (arr.length !== dMax) {
      return finish({ status: "error", message: "El tipo " + tipo + " debe tener " + dMax + " valores (días del mes)." });
    }
    var rowOut = [idCliente, idUnidad, anio, mes, tipo];
    for (var d = 1; d <= 31; d++) {
      if (d <= dMax) {
        var n = Number(arr[d - 1]);
        if (isNaN(n) || n < 0) {
          return finish({ status: "error", message: "Valor inválido en " + tipo + " día " + d + "." });
        }
        rowOut.push(n);
      } else {
        rowOut.push("");
      }
    }

    var vals = dg.sheet.getDataRange().getValues();
    var rowDet = -1;
    for (var r = 1; r < vals.length; r++) {
      if (
        String(vals[r][0] || "").trim() === idCliente &&
        String(vals[r][1] || "").trim() === idUnidad &&
        parseInt(String(vals[r][2] || ""), 10) === anio &&
        parseInt(String(vals[r][3] || ""), 10) === mes &&
        String(vals[r][4] || "")
          .trim()
          .toLowerCase() === tipo
      ) {
        rowDet = r + 1;
        break;
      }
    }
    if (rowDet > 0) {
      dg.sheet.getRange(rowDet, 1, rowDet, rowOut.length).setValues([rowOut]);
    } else {
      dg.sheet.appendRow(rowOut);
    }
  }

  return finish({
    status: "success",
    data: {
      id_cliente: idCliente,
      id_unidad: idUnidad,
      anio: anio,
      mes: mes,
    },
  });
}

function getKpisSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KPIS_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + KPIS_SHEET + '". Ejecuta crearPestanasKPIs().' };
  }
  return { ok: true, sheet: sh };
}

function startOfCalendarMonthMs_(y, m) {
  var yy = parseInt(String(y), 10);
  var mm = parseInt(String(m), 10);
  if (isNaN(yy) || isNaN(mm)) {
    return NaN;
  }
  return new Date(yy, mm - 1, 1, 0, 0, 0).getTime();
}

function endOfCalendarMonthMs_(y, m) {
  var yy = parseInt(String(y), 10);
  var mm = parseInt(String(m), 10);
  if (isNaN(yy) || isNaN(mm)) {
    return NaN;
  }
  return new Date(yy, mm, 0, 23, 59, 59, 999).getTime();
}

function controlServicioMonthInDashboardRange_(y, m, startMs, endMs) {
  var ms = startOfCalendarMonthMs_(y, m);
  var me = endOfCalendarMonthMs_(y, m);
  if (isNaN(ms) || isNaN(me)) {
    return false;
  }
  return !(me < startMs || ms > endMs);
}

function controlServicioIncludeKeyForDashboard_(idCliente, idUnidad, filtCliente, filtUnidad, unitsMap) {
  var idC = String(idCliente || "").trim();
  var idU = String(idUnidad || "").trim();
  if (filtCliente && idC !== filtCliente) {
    return false;
  }
  if (filtUnidad && idU !== filtUnidad) {
    return false;
  }
  if (!idU && (filtCliente || filtUnidad)) {
    return false;
  }
  if (idU && unitsMap && !unitsMap[idU]) {
    return false;
  }
  return true;
}

function sumControlServicioDiasEnFila_(row, dMax, col0FirstDay) {
  var s = 0;
  for (var d = 0; d < dMax; d++) {
    s += Number(row[col0FirstDay + d]) || 0;
  }
  return s;
}

/**
 * KPIs derivados del control de servicio para el dashboard (agregado del periodo y filtros).
 */
function collectControlServicioKpisForDashboard_(startMs, endMs, filtCliente, filtUnidad, unitsMap) {
  var pg = getControlServicioPersonalSheetOrError_();
  var dg = getControlServicioDetalleSheetOrError_();
  if (!pg.ok || !dg.ok) {
    return [];
  }
  controlServicioSheetsReady_();

  var totals = {
    faltas: 0,
    suspensiones: 0,
    permisos: 0,
    vacaciones: 0,
    descanso_medico: 0,
    bajas: 0,
  };
  var personDays = 0;
  var sumPersonal = 0;

  var pv = pg.sheet.getDataRange().getValues();
  if (pv.length < 2) {
    return [];
  }
  var h1p = String(pv[0][0] || "")
    .trim()
    .toLowerCase();
  if (h1p !== "id_cliente") {
    return [];
  }

  for (var i = 1; i < pv.length; i++) {
    var idC = String(pv[i][0] || "").trim();
    var idU = String(pv[i][1] || "").trim();
    var y = parseInt(String(pv[i][2] || ""), 10);
    var m = parseInt(String(pv[i][3] || ""), 10);
    if (isNaN(y) || isNaN(m)) {
      continue;
    }
    if (!controlServicioMonthInDashboardRange_(y, m, startMs, endMs)) {
      continue;
    }
    if (!controlServicioIncludeKeyForDashboard_(idC, idU, filtCliente, filtUnidad, unitsMap)) {
      continue;
    }
    var P = Number(pv[i][4]) || 0;
    var dM = diasEnMesControl_(y, m);
    personDays += P * dM;
    sumPersonal += P;
  }

  var vals = dg.sheet.getDataRange().getValues();
  var h1d = String(vals[0][0] || "")
    .trim()
    .toLowerCase();
  if (h1d !== "id_cliente") {
    return [];
  }

  for (var r = 1; r < vals.length; r++) {
    var idC2 = String(vals[r][0] || "").trim();
    var idU2 = String(vals[r][1] || "").trim();
    var y2 = parseInt(String(vals[r][2] || ""), 10);
    var m2 = parseInt(String(vals[r][3] || ""), 10);
    if (isNaN(y2) || isNaN(m2)) {
      continue;
    }
    if (!controlServicioMonthInDashboardRange_(y2, m2, startMs, endMs)) {
      continue;
    }
    if (!controlServicioIncludeKeyForDashboard_(idC2, idU2, filtCliente, filtUnidad, unitsMap)) {
      continue;
    }
    var tipo = String(vals[r][4] || "")
      .trim()
      .toLowerCase();
    if (TIPOS_CONTROL_SERVICIO_.indexOf(tipo) < 0) {
      continue;
    }
    var dM2 = diasEnMesControl_(y2, m2);
    totals[tipo] += sumControlServicioDiasEnFila_(vals[r], dM2, 5);
  }

  var hayNumeros = false;
  Object.keys(totals).forEach(function (k) {
    if (totals[k] > 0) {
      hayNumeros = true;
    }
  });
  if (!hayNumeros && personDays <= 0 && sumPersonal <= 0) {
    return [];
  }

  function pctRate(num, den) {
    if (den == null || isNaN(den) || den <= 0) {
      return null;
    }
    return Math.round((num / den) * 100000) / 1000;
  }

  function barPct(pct) {
    if (pct == null || isNaN(pct)) {
      return null;
    }
    return Math.min(100, Math.max(0, pct));
  }

  var aus = pctRate(totals.faltas, personDays);
  var idxDm = pctRate(totals.descanso_medico, personDays);
  var idxPer = pctRate(totals.permisos, personDays);
  var idxSus = pctRate(totals.suspensiones, personDays);
  var idxVac = pctRate(totals.vacaciones, personDays);
  var rotPct = pctRate(totals.bajas, sumPersonal);

  var out = [];

  function pushCard(id, nombre, pct, bar, absLabel, absVal) {
    var n = Number(absVal);
    if (isNaN(n)) {
      n = 0;
    }
    n = Math.round(n);
    out.push({
      id_kpi: id,
      nombre: nombre,
      meta_mensual: null,
      logro: absVal,
      mes: null,
      anio: null,
      pct_vs_meta: pct,
      bar_pct: bar,
      kpi_fuente: "control_servicio",
      detalle_linea: absLabel + ": " + String(n),
    });
  }

  pushCard("cs_rotacion", "Rotación (bajas / personal)", rotPct, barPct(rotPct), "Bajas", totals.bajas);
  pushCard("cs_ausentismo", "Ausentismo", aus, barPct(aus), "Faltos", totals.faltas);
  pushCard("cs_idx_dm", "Índice descansos médicos", idxDm, barPct(idxDm), "Descansos médicos", totals.descanso_medico);
  pushCard("cs_idx_perm", "Índice permisos", idxPer, barPct(idxPer), "Permisos", totals.permisos);
  pushCard("cs_idx_susp", "Índice suspensiones", idxSus, barPct(idxSus), "Suspensiones", totals.suspensiones);
  pushCard("cs_idx_vac", "Índice vacaciones", idxVac, barPct(idxVac), "Vacaciones", totals.vacaciones);

  return out;
}

function collectKpisForDashboard_(startMs, endMs) {
  var got = getKpisSheetOrError_();
  if (!got.ok) {
    return [];
  }
  var vals = got.sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var id = String(vals[r][0] || "").trim();
    if (!id) {
      continue;
    }
    var ky = parseInt(String(vals[r][5] || ""), 10);
    var km = parseInt(String(vals[r][4] || ""), 10);
    if (isNaN(ky) || isNaN(km) || km < 1 || km > 12) {
      continue;
    }
    var ms = startOfCalendarMonthMs_(ky, km);
    var me = endOfCalendarMonthMs_(ky, km);
    if (isNaN(ms) || isNaN(me) || me < startMs || ms > endMs) {
      continue;
    }
    var meta = Number(vals[r][2]);
    var logro = Number(vals[r][3]);
    var pct = meta > 0 ? Math.round((logro / meta) * 1000) / 10 : null;
    out.push({
      id_kpi: id,
      nombre: String(vals[r][1] || "").trim(),
      meta_mensual: meta,
      logro: logro,
      mes: km,
      anio: ky,
      pct_vs_meta: pct,
    });
  }
  out.sort(function (a, b) {
    return String(a.nombre).localeCompare(String(b.nombre));
  });
  return out;
}

function handleListKPIs_(caller, anioStr, mesStr) {
  var auth = assertCallerIsAdmin_(String(caller || "").trim());
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var got = getKpisSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var vals = got.sheet.getDataRange().getValues();
  var anioF = anioStr === undefined || anioStr === "" ? NaN : parseInt(String(anioStr), 10);
  var mesF = mesStr === undefined || mesStr === "" ? NaN : parseInt(String(mesStr), 10);
  var list = [];
  for (var r = 1; r < vals.length; r++) {
    var ky = parseInt(String(vals[r][5] || ""), 10);
    var km = parseInt(String(vals[r][4] || ""), 10);
    if (isNaN(ky) || isNaN(km)) {
      continue;
    }
    if (!isNaN(anioF) && ky !== anioF) {
      continue;
    }
    if (!isNaN(mesF) && km !== mesF) {
      continue;
    }
    var meta = Number(vals[r][2]);
    var logro = Number(vals[r][3]);
    var pct = meta > 0 ? Math.round((logro / meta) * 1000) / 10 : null;
    list.push({
      id_kpi: String(vals[r][0] || "").trim(),
      nombre: String(vals[r][1] || "").trim(),
      meta_mensual: meta,
      logro: logro,
      mes: km,
      anio: ky,
      usuario: String(vals[r][6] || "").trim(),
      fecha_creacion: String(vals[r][7] || "").trim(),
      pct_vs_meta: pct,
    });
  }
  list.sort(function (a, b) {
    if (a.anio !== b.anio) {
      return b.anio - a.anio;
    }
    if (a.mes !== b.mes) {
      return b.mes - a.mes;
    }
    return String(a.nombre).localeCompare(String(b.nombre));
  });
  return jsonOut_({ status: "success", data: { kpis: list } });
}

function handleCreateKPIPost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var got = getKpisSheetOrError_();
  if (!got.ok) {
    return finish({ status: "error", message: got.message });
  }

  var k = data.kpi || {};
  var nombre = String(k.nombre || "").trim();
  var meta = Number(k.meta_mensual);
  var logro = Number(k.logro);
  var mes = parseInt(String(k.mes || ""), 10);
  var anio = parseInt(String(k.anio || ""), 10);

  if (!nombre) {
    return finish({ status: "error", message: "El nombre del KPI es obligatorio." });
  }
  if (isNaN(meta) || meta < 0) {
    return finish({ status: "error", message: "La meta mensual debe ser un número mayor o igual a 0." });
  }
  if (isNaN(logro) || logro < 0) {
    return finish({ status: "error", message: "El logro debe ser un número mayor o igual a 0." });
  }
  if (isNaN(mes) || mes < 1 || mes > 12) {
    return finish({ status: "error", message: "Indique un mes válido (1 a 12)." });
  }
  if (isNaN(anio) || anio < 2000 || anio > 2100) {
    return finish({ status: "error", message: "Indique un año válido." });
  }

  var id = Utilities.getUuid();
  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  got.sheet.appendRow([id, nombre, meta, logro, mes, anio, caller, fecha]);

  return finish({
    status: "success",
    data: {
      id_kpi: id,
      nombre: nombre,
      meta_mensual: meta,
      logro: logro,
      mes: mes,
      anio: anio,
    },
  });
}

function getIncidentesSheetOrError_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INCIDENTES_SHEET);
  if (!sh) {
    return { ok: false, message: 'No existe la hoja "' + INCIDENTES_SHEET + '". Ejecuta crearPestanasIncidentes().' };
  }
  return { ok: true, sheet: sh };
}

function normalizeTipoIncidente_(v) {
  var s = String(v || "")
    .trim()
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/é/g, "e")
    .replace(/ú/g, "u")
    .replace(/\s+/g, " ");
  if (s === "amenaza") {
    return "amenaza";
  }
  if (s === "vulnerabilidad") {
    return "vulnerabilidad";
  }
  if (s === "condicion insegura" || s === "condicion_insegura") {
    return "condicion_insegura";
  }
  return "";
}

function normalizeNivelRiesgo_(v) {
  var s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "bajo") {
    return "bajo";
  }
  if (s === "medio") {
    return "medio";
  }
  if (s === "alto") {
    return "alto";
  }
  return "";
}

function handleSubmitIncidentePost_(p) {
  var requestId = p.requestId;
  var cache = CacheService.getScriptCache();
  var key = CACHE_PREFIX + requestId;

  function finish(resultObj) {
    cache.put(key, JSON.stringify(resultObj), CACHE_SECONDS);
    return jsonOut_({ status: "ok", message: "Procesado (consulta con GET)." });
  }

  if (!requestId || String(requestId).length > 200) {
    return jsonOut_({ status: "error", message: "requestId inválido." });
  }

  var dataStr = p.data || "{}";
  var data;
  try {
    data = JSON.parse(dataStr);
  } catch (ex) {
    return finish({ status: "error", message: "JSON inválido." });
  }

  var caller = String(data.caller || "").trim();
  var auth = assertCallerIsSupervisorOrAdmin_(caller);
  if (!auth.ok) {
    return finish({ status: "error", message: auth.message });
  }

  var inc = data.incidente || {};
  var idCliente = String(inc.id_cliente || "").trim();
  var idUnidad = String(inc.id_unidad || "").trim();
  if (!idCliente || !idUnidad) {
    return finish({ status: "error", message: "Debe elegir cliente y unidad." });
  }

  var cvals = getClientesSheetOrError_();
  if (!cvals.ok) {
    return finish({ status: "error", message: cvals.message });
  }
  if (findClienteRowById_(cvals.sheet.getDataRange().getValues(), idCliente) < 0) {
    return finish({ status: "error", message: "Cliente no válido." });
  }
  var uinfo = getUnidadInfoByIds_(idUnidad, idCliente);
  if (!uinfo) {
    return finish({ status: "error", message: "La unidad no pertenece al cliente indicado." });
  }

  var d = inc.datos || {};
  var tipo = normalizeTipoIncidente_(d.tipo_incidente);
  if (!tipo) {
    return finish({
      status: "error",
      message: 'Tipo de incidente inválido. Use: Amenaza, Vulnerabilidad o Condición insegura.',
    });
  }

  var detalle = String(d.detalle || "").trim();
  if (!detalle) {
    return finish({ status: "error", message: "El detalle del incidente es obligatorio." });
  }

  var nivel = normalizeNivelRiesgo_(d.nivel_riesgo);
  if (!nivel) {
    return finish({ status: "error", message: "El nivel de riesgo debe ser Bajo, Medio o Alto." });
  }

  var foto = String(d.foto || "").trim();
  if (!emptyOrHttpsUrl_(foto)) {
    return finish({ status: "error", message: "URL de foto no válida." });
  }

  var datosClean = {
    tipo_incidente: tipo,
    detalle: clipText_(detalle, 15000),
    nivel_riesgo: nivel,
    foto: foto,
  };

  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "America/Lima";
  var fechaHora = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");
  var clienteNombre = getClienteNombreById_(idCliente);
  var unidadNombre = uinfo.unidad || "";

  var igot = getIncidentesSheetOrError_();
  if (!igot.ok) {
    return finish({ status: "error", message: igot.message });
  }
  var idInc = Utilities.getUuid();
  igot.sheet.appendRow([
    idInc,
    fechaHora,
    caller,
    idCliente,
    clienteNombre,
    idUnidad,
    unidadNombre,
    JSON.stringify(datosClean),
  ]);

  return finish({
    status: "success",
    data: {
      id_incidente: idInc,
      fecha_hora: fechaHora,
    },
  });
}

function handleListIncidentes_(caller) {
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var got = getIncidentesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][0] || "").trim();
    if (!id) {
      continue;
    }
    rows.push({
      id_incidente: id,
      fecha_hora: String(values[r][1] || ""),
      usuario: String(values[r][2] || ""),
      id_cliente: String(values[r][3] || ""),
      cliente: String(values[r][4] || ""),
      id_unidad: String(values[r][5] || ""),
      unidad: String(values[r][6] || ""),
    });
  }
  rows.reverse();
  return jsonOut_({ status: "success", data: { rows: rows } });
}

function handleGetIncidente_(caller, id) {
  var auth = assertCallerIsAdmin_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }
  var idInc = String(id || "").trim();
  if (!idInc) {
    return jsonOut_({ status: "error", message: "Falta el identificador del incidente." });
  }
  var got = getIncidentesSheetOrError_();
  if (!got.ok) {
    return jsonOut_({ status: "error", message: got.message });
  }
  var values = got.sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0] || "").trim() !== idInc) {
      continue;
    }
    var datos = {};
    try {
      datos = JSON.parse(String(values[r][7] || "{}"));
    } catch (ex) {
      datos = {};
    }
    return jsonOut_({
      status: "success",
      data: {
        record: {
          id_incidente: idInc,
          fecha_hora: String(values[r][1] || ""),
          usuario: String(values[r][2] || ""),
          id_cliente: String(values[r][3] || ""),
          cliente: String(values[r][4] || ""),
          id_unidad: String(values[r][5] || ""),
          unidad: String(values[r][6] || ""),
          datos: datos,
        },
      },
    });
  }
  return jsonOut_({ status: "error", message: "Incidente no encontrado." });
}

function parseFechaHoraDashboard_(s) {
  var str = String(s || "").trim();
  if (!str) {
    return null;
  }
  var parts = str.split(/[\s\-:]/);
  if (parts.length < 3) {
    return null;
  }
  var y = parseInt(parts[0], 10);
  var mo = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var h = parseInt(parts[3] || "0", 10);
  var mi = parseInt(parts[4] || "0", 10);
  var se = parseInt(parts[5] || "0", 10);
  if (isNaN(y) || isNaN(mo) || isNaN(d)) {
    return null;
  }
  return new Date(y, mo, d, h, mi, se || 0);
}

/** Celda de hoja: Date de Sheets o texto "yyyy-MM-dd HH:mm:ss". */
function sheetDateCellToMs_(cell) {
  if (cell instanceof Date) {
    var t = cell.getTime();
    return isNaN(t) ? NaN : t;
  }
  var parsed = parseFechaHoraDashboard_(String(cell || ""));
  return parsed ? parsed.getTime() : NaN;
}

function dashboardWindowMs_(p) {
  var now = new Date();
  var y = parseInt(String(p.anio || ""), 10);
  if (isNaN(y)) {
    y = now.getFullYear();
  }
  var mesRaw = p.mes;
  var mes = mesRaw === undefined || mesRaw === "" ? NaN : parseInt(String(mesRaw), 10);
  var fd = String(p.fechaDesde || "").trim();
  var fh = String(p.fechaHasta || "").trim();
  var start;
  var end;
  if (fd && fh) {
    start = parseFechaHoraDashboard_(fd + " 00:00:00");
    end = parseFechaHoraDashboard_(fh + " 23:59:59");
  } else if (!isNaN(mes) && mes >= 1 && mes <= 12) {
    start = new Date(y, mes - 1, 1, 0, 0, 0);
    end = new Date(y, mes, 0, 23, 59, 59);
  } else {
    start = new Date(y, 0, 1, 0, 0, 0);
    end = new Date(y, 11, 31, 23, 59, 59);
  }
  if (!start || !end || start.getTime() > end.getTime()) {
    return null;
  }
  return { startMs: start.getTime(), endMs: end.getTime(), startStr: fd, endStr: fh };
}

function accAdd_(acc, v) {
  if (v === null || v === undefined || v === "") {
    return;
  }
  var x = parseFloat(String(v));
  if (isNaN(x)) {
    return;
  }
  acc.sum += x;
  acc.n++;
}

function accAvg_(acc) {
  if (!acc.n) {
    return null;
  }
  return Math.round((acc.sum / acc.n) * 100) / 100;
}

function monthsFracFromRange_(startMs, endMs) {
  var span = Math.max(0, endMs - startMs);
  var dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0.25, span / (dayMs * 30.44));
}

function handleGetDashboardData_(p) {
  var caller = String(p.caller || "").trim();
  var auth = assertCallerCanViewDashboard_(caller);
  if (!auth.ok) {
    return jsonOut_({ status: "error", message: auth.message });
  }

  var win = dashboardWindowMs_(p);
  if (!win) {
    return jsonOut_({ status: "error", message: "Rango de fechas inválido." });
  }
  var startMs = win.startMs;
  var endMs = win.endMs;
  var monthsFrac = monthsFracFromRange_(startMs, endMs);

  var filtCliente = String(p.idCliente || "").trim();
  var filtUnidad = String(p.idUnidad || "").trim();
  var filtSupervisor = String(p.supervisor || "")
    .trim()
    .toLowerCase();

  var ugot = getUnidadesSheetOrError_();
  if (!ugot.ok) {
    return jsonOut_({ status: "error", message: ugot.message });
  }
  var uvals = ugot.sheet.getDataRange().getValues();
  var unitsMap = {};
  for (var u = 1; u < uvals.length; u++) {
    var idU = String(uvals[u][0] || "").trim();
    var idC = String(uvals[u][1] || "").trim();
    if (!idU) {
      continue;
    }
    if (filtCliente && idC !== filtCliente) {
      continue;
    }
    if (filtUnidad && idU !== filtUnidad) {
      continue;
    }
    unitsMap[idU] = {
      id_unidad: idU,
      id_cliente: idC,
      unidad: String(uvals[u][2] || "").trim(),
      cliente: "",
      rondas_mensuales: Number(uvals[u][4]) || 0,
      supervisor_unidad: String(uvals[u][3] || "").trim(),
    };
  }

  var cgot = getClientesSheetOrError_();
  if (cgot.ok) {
    var cvals = cgot.sheet.getDataRange().getValues();
    var cname = {};
    for (var c = 1; c < cvals.length; c++) {
      var cid = String(cvals[c][0] || "").trim();
      if (cid) {
        cname[cid] = String(cvals[c][1] || "").trim();
      }
    }
    Object.keys(unitsMap).forEach(function (k) {
      unitsMap[k].cliente = cname[unitsMap[k].id_cliente] || "";
    });
  }

  var sgot = getSupervisionSheetOrError_();
  var supRowsFiltered = 0;
  var countByUnidad = {};
  Object.keys(unitsMap).forEach(function (k) {
    countByUnidad[k] = 0;
  });

  var accPrU = { sum: 0, n: 0 };
  var accPrA = { sum: 0, n: 0 };
  var accCoG = { sum: 0, n: 0 };
  var accCoE = { sum: 0, n: 0 };
  var accDocFun = { sum: 0, n: 0 };
  var accDocCu = { sum: 0, n: 0 };
  var accDocCarnetNum = { sum: 0, n: 0 };
  var accPeP = { sum: 0, n: 0 };
  var accPeS = { sum: 0, n: 0 };
  var accPeR = { sum: 0, n: 0 };
  var l4Cumple = 0;
  var l4No = 0;
  var l4Na = 0;
  var carnetCumple = 0;
  var carnetNoCumple = 0;
  var carnetOtro = 0;

  if (sgot.ok) {
    var svals = sgot.sheet.getDataRange().getValues();
    for (var r = 1; r < svals.length; r++) {
      var idCli = String(svals[r][3] || "").trim();
      var idUni = String(svals[r][5] || "").trim();
      var sup = String(svals[r][2] || "")
        .trim()
        .toLowerCase();
      if (filtCliente && idCli !== filtCliente) {
        continue;
      }
      if (filtUnidad && idUni !== filtUnidad) {
        continue;
      }
      if (filtSupervisor && sup !== filtSupervisor) {
        continue;
      }
      var fdt = sheetDateCellToMs_(svals[r][1]);
      if (isNaN(fdt) || fdt < startMs || fdt > endMs) {
        continue;
      }
      if (!unitsMap[idUni]) {
        continue;
      }

      supRowsFiltered++;
      countByUnidad[idUni] = (countByUnidad[idUni] || 0) + 1;

      var datos = {};
      try {
        datos = JSON.parse(String(svals[r][7] || "{}"));
      } catch (ex1) {
        datos = {};
      }
      var pr = datos.presentacion || {};
      var co = datos.conocimiento || {};
      var doc = datos.documentacion || {};
      var pe = datos.percepcion_cliente || {};
      accAdd_(accPrU, pr.uniforme);
      accAdd_(accPrA, pr.aseo);
      accAdd_(accCoG, co.funciones_generales);
      accAdd_(accCoE, co.funciones_especificas);
      accAdd_(accDocFun, doc.funciones_puesto_documentadas);
      accAdd_(accDocCu, doc.cuaderno_ocurrencias);
      accAdd_(accPeP, pe.personal_seguridad);
      accAdd_(accPeS, pe.supervisor);
      accAdd_(accPeR, pe.respuesta_administrativa);

      var cs = doc.carnet_sucamec;
      var csStr = String(cs != null ? cs : "")
        .trim()
        .toLowerCase();
      if (csStr === "cumple") {
        carnetCumple++;
      } else if (csStr === "no_cumple" || csStr === "no cumple" || csStr === "nocumple") {
        carnetNoCumple++;
      } else if (csStr !== "") {
        accAdd_(accDocCarnetNum, cs);
      } else {
        carnetOtro++;
      }

      var l4 = doc.licencia_l4;
      var l4Str = String(l4 != null ? l4 : "")
        .trim()
        .toLowerCase();
      if (l4Str === "cumple") {
        l4Cumple++;
      } else if (l4Str === "no_cumple" || l4Str === "no cumple" || l4Str === "nocumple") {
        l4No++;
      } else {
        l4Na++;
      }
    }
  }

  var cumplimientoUnidades = [];
  var totalEsp = 0;
  var totalReal = 0;
  Object.keys(unitsMap).forEach(function (idU) {
    var uo = unitsMap[idU];
    var rondas = uo.rondas_mensuales;
    var esp = Math.round(rondas * monthsFrac * 100) / 100;
    var real = countByUnidad[idU] || 0;
    totalEsp += esp;
    totalReal += real;
    var pct = esp <= 0 ? null : Math.min(100, Math.round((real / esp) * 1000) / 10);
    cumplimientoUnidades.push({
      id_unidad: idU,
      id_cliente: uo.id_cliente,
      unidad: uo.unidad,
      cliente: uo.cliente,
      rondas_mensuales: rondas,
      rondas_esperadas_periodo: esp,
      supervisiones_realizadas: real,
      pct_cumplimiento: pct,
    });
  });
  cumplimientoUnidades.sort(function (a, b) {
    return String(a.cliente + a.unidad).localeCompare(String(b.cliente + b.unidad));
  });

  var pctGlobal = totalEsp <= 0 ? null : Math.min(100, Math.round((totalReal / totalEsp) * 1000) / 10);

  var igot = getIncidentesSheetOrError_();
  var incByNivel = { bajo: 0, medio: 0, alto: 0 };
  var incByTipo = { amenaza: 0, vulnerabilidad: 0, condicion_insegura: 0 };
  var altoMap = {};
  var incFiltered = 0;

  if (igot.ok) {
    var ivals = igot.sheet.getDataRange().getValues();
    for (var ir = 1; ir < ivals.length; ir++) {
      var iCli = String(ivals[ir][3] || "").trim();
      var iUni = String(ivals[ir][5] || "").trim();
      var iUsr = String(ivals[ir][2] || "")
        .trim()
        .toLowerCase();
      if (filtCliente && iCli !== filtCliente) {
        continue;
      }
      if (filtUnidad && iUni !== filtUnidad) {
        continue;
      }
      if (filtSupervisor && iUsr !== filtSupervisor) {
        continue;
      }
      var ifdt = sheetDateCellToMs_(ivals[ir][1]);
      if (isNaN(ifdt) || ifdt < startMs || ifdt > endMs) {
        continue;
      }
      incFiltered++;
      var idat = {};
      try {
        idat = JSON.parse(String(ivals[ir][7] || "{}"));
      } catch (ex2) {
        idat = {};
      }
      var nv = normalizeNivelRiesgo_(idat.nivel_riesgo);
      if (nv === "bajo") {
        incByNivel.bajo++;
      } else if (nv === "medio") {
        incByNivel.medio++;
      } else if (nv === "alto") {
        incByNivel.alto++;
        var ukey = iUni;
        if (!altoMap[ukey]) {
          altoMap[ukey] = {
            id_unidad: iUni,
            unidad: String(ivals[ir][6] || "").trim(),
            cliente: String(ivals[ir][4] || "").trim(),
            cantidad: 0,
          };
        }
        altoMap[ukey].cantidad++;
      }
      var ti = normalizeTipoIncidente_(idat.tipo_incidente);
      if (ti === "amenaza") {
        incByTipo.amenaza++;
      } else if (ti === "vulnerabilidad") {
        incByTipo.vulnerabilidad++;
      } else if (ti === "condicion_insegura") {
        incByTipo.condicion_insegura++;
      }
    }
  }

  var unidadesRiesgoAlto = [];
  Object.keys(altoMap).forEach(function (k) {
    unidadesRiesgoAlto.push(altoMap[k]);
  });
  unidadesRiesgoAlto.sort(function (a, b) {
    return b.cantidad - a.cantidad;
  });

  var kpisSheet = collectKpisForDashboard_(startMs, endMs);
  var kpisServicio = collectControlServicioKpisForDashboard_(startMs, endMs, filtCliente, filtUnidad, unitsMap);
  var kpisDashboard = kpisSheet.concat(kpisServicio);

  return jsonOut_({
    status: "success",
    data: {
      periodo: {
        inicio_ms: startMs,
        fin_ms: endMs,
        meses_fraccion: Math.round(monthsFrac * 100) / 100,
      },
      filtros: {
        id_cliente: filtCliente,
        id_unidad: filtUnidad,
        supervisor: filtSupervisor ? p.supervisor : "",
      },
      cumplimiento: {
        global: {
          rondas_esperadas: Math.round(totalEsp * 100) / 100,
          supervisiones_realizadas: totalReal,
          pct: pctGlobal,
        },
        por_unidad: cumplimientoUnidades,
      },
      supervision_promedios: {
        presentacion: { uniforme: accAvg_(accPrU), aseo: accAvg_(accPrA) },
        conocimiento: {
          funciones_generales: accAvg_(accCoG),
          funciones_especificas: accAvg_(accCoE),
        },
        documentacion: {
          funciones_puesto_documentadas: accAvg_(accDocFun),
          cuaderno_ocurrencias: accAvg_(accDocCu),
          licencia_l4: {
            cumple: l4Cumple,
            no_cumple: l4No,
            no_aplica_o_vacio: l4Na,
          },
          carnet_valor_numerico_legacy_promedio: accAvg_(accDocCarnetNum),
        },
        percepcion_cliente: {
          personal_seguridad: accAvg_(accPeP),
          supervisor: accAvg_(accPeS),
          respuesta_administrativa: accAvg_(accPeR),
        },
        carnet_sucamec: {
          cumple: carnetCumple,
          no_cumple: carnetNoCumple,
          otros_o_vacio: carnetOtro,
        },
        registros_con_datos: supRowsFiltered,
      },
      incidentes: {
        por_nivel: incByNivel,
        por_tipo: incByTipo,
        unidades_riesgo_alto: unidadesRiesgoAlto,
        registros: incFiltered,
      },
      kpis: kpisDashboard,
      meta: {
        unidades_en_scope: Object.keys(unitsMap).length,
      },
    },
  });
}
