/**
 * login.html — validación local + POST/GET vía AppApi.
 */
(function () {
  "use strict";

  if (window.AppAuth.readSession()) {
    window.location.replace("main.html");
    return;
  }

  var form = document.getElementById("formLogin");
  var msg = document.getElementById("msg");
  var btnSubmit = document.getElementById("btnSubmit");
  var btnLabel = document.getElementById("btnLabel");
  var btnSpinner = document.getElementById("btnSpinner");

  function showError(text) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = "msg msg--error";
  }

  function hideMsg() {
    msg.hidden = true;
  }

  function setLoading(on) {
    btnSubmit.disabled = on;
    btnLabel.hidden = on;
    btnSpinner.hidden = !on;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMsg();

    var usuario = document.getElementById("usuario").value.trim();
    var password = document.getElementById("password").value;

    if (!usuario) {
      showError("Indica tu usuario.");
      return;
    }
    if (!password) {
      showError("Indica tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      var res = await window.AppApi.postVerify(
        "login",
        { usuario: usuario, password: password },
        "getPendingResult",
        15,
        350
      );

      if (!res || res.status !== "success") {
        showError((res && res.message) || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }

      var d = res.data || {};
      window.AppAuth.writeSession({
        usuario: d.usuario,
        cargo: window.AppAuth.normalizeCargo(d.cargo),
        nombres: d.nombres || d.usuario,
        primerlogin: d.primerlogin,
        ts: Date.now(),
      });

      window.location.replace("main.html");
    } catch (err) {
      showError("Error de red. Comprueba la conexión y la URL del script.");
      setLoading(false);
    }
  });
})();
