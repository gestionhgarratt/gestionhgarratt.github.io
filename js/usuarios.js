/**
 * Módulo Usuarios — listado (GET) y alta (POST + verificación).
 */
(function () {
  "use strict";

  var session = window.AppAuth.readSession();
  if (!session) {
    return;
  }

  var blockNoAdmin = document.getElementById("blockNoAdmin");
  var blockAdmin = document.getElementById("blockAdmin");
  var msg = document.getElementById("msg");
  var loading = document.getElementById("loading");
  var tbody = document.getElementById("tbody");
  var btnNuevo = document.getElementById("btnNuevo");
  var btnRefrescar = document.getElementById("btnRefrescar");
  var dlg = document.getElementById("dlg");
  var formNuevo = document.getElementById("formNuevo");
  var dlgMsg = document.getElementById("dlgMsg");
  var btnDlgCancelar = document.getElementById("btnDlgCancelar");
  var btnDlgGuardar = document.getElementById("btnDlgGuardar");
  var btnDlgLabel = document.getElementById("btnDlgLabel");
  var btnDlgSpinner = document.getElementById("btnDlgSpinner");

  if (!window.AppAuth.isAdmin(session)) {
    blockNoAdmin.hidden = false;
    blockAdmin.hidden = true;
    return;
  }

  function showMsg(text, kind) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--" + (kind || "error");
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function showDlgMsg(text) {
    dlgMsg.textContent = text;
    dlgMsg.hidden = false;
    dlgMsg.className = "msg msg--error";
  }

  function hideDlgMsg() {
    dlgMsg.hidden = true;
  }

  function setDlgLoading(on) {
    btnDlgGuardar.disabled = on;
    btnDlgLabel.hidden = on;
    btnDlgSpinner.hidden = !on;
  }

  function cargoLabel(c) {
    if (c === "administrador") return "Administrador";
    if (c === "supervisor") return "Supervisor";
    if (c === "gerencia") return "Gerencia";
    return c ? String(c) : "—";
  }

  function renderRows(users) {
    tbody.innerHTML = "";
    if (!users || !users.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "No hay filas de datos (solo encabezado o hoja vacía).";
      td.style.color = "var(--color-text-muted)";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    users.forEach(function (u) {
      var tr = document.createElement("tr");
      ["usuario", "cargo", "nombres", "primerlogin"].forEach(function (key) {
        var td = document.createElement("td");
        if (key === "cargo") {
          td.textContent = cargoLabel(u.cargo);
        } else {
          td.textContent = u[key] != null ? String(u[key]) : "";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function cargarLista() {
    hideMsg();
    loading.hidden = false;
    tbody.innerHTML = "";
    try {
      var res = await window.AppApi.get("listUsers", { caller: session.usuario });
      if (!res || res.status !== "success") {
        showMsg((res && res.message) || "No se pudo cargar la lista.");
        loading.hidden = true;
        return;
      }
      renderRows((res.data && res.data.users) || []);
    } catch (e) {
      showMsg("Error de red al cargar usuarios.");
    }
    loading.hidden = true;
  }

  btnRefrescar.addEventListener("click", function () {
    cargarLista();
  });

  btnNuevo.addEventListener("click", function () {
    hideDlgMsg();
    formNuevo.reset();
    document.getElementById("fCargo").value = "supervisor";
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      showMsg("Tu navegador no soporta ventanas modales nativas; actualiza el navegador.", "info");
    }
  });

  btnDlgCancelar.addEventListener("click", function () {
    dlg.close();
  });

  formNuevo.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideDlgMsg();

    var usuario = document.getElementById("fUsuario").value.trim();
    var password = document.getElementById("fPassword").value;
    var cargo = document.getElementById("fCargo").value;
    var nombres = document.getElementById("fNombres").value.trim();
    var primerlogin = document.getElementById("fPrimerlogin").value.trim();

    if (!usuario) {
      showDlgMsg("Indica el usuario.");
      return;
    }
    if (!password) {
      showDlgMsg("Indica la contraseña.");
      return;
    }
    if (!nombres) {
      showDlgMsg("Indica los nombres.");
      return;
    }

    setDlgLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "createUser",
        {
          caller: session.usuario,
          user: {
            usuario: usuario,
            password: password,
            cargo: cargo,
            nombres: nombres,
            primerlogin: primerlogin,
          },
        },
        "getPendingResult",
        15,
        350
      );

      if (!res || res.status !== "success") {
        showDlgMsg((res && res.message) || "No se pudo crear el usuario.");
        setDlgLoading(false);
        return;
      }

      dlg.close();
      hideMsg();
      showMsg("Usuario creado correctamente.", "success");
      await cargarLista();
    } catch (err) {
      showDlgMsg("Error de red. Intenta de nuevo.");
    }
    setDlgLoading(false);
  });

  cargarLista();
})();
