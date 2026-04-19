/**
 * Subida de imágenes a Cloudinary (preset sin firmar).
 */
(function (global) {
  "use strict";

  async function uploadImage(file) {
    if (!file || !file.size) {
      throw new Error("Archivo vacío.");
    }
    var cfg = global.AppConfig.getCloudinary();
    if (!cfg || !cfg.cloudName || !cfg.uploadPreset) {
      throw new Error("Falta configuración de Cloudinary en js/config.js");
    }
    var fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cfg.uploadPreset);
    var url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(cfg.cloudName) + "/image/upload";
    var res = await fetch(url, { method: "POST", body: fd });
    var j = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = (j.error && (j.error.message || j.error)) || "Error al subir la imagen.";
      throw new Error(typeof err === "string" ? err : "Error Cloudinary");
    }
    return j.secure_url || j.url || "";
  }

  global.CloudinaryUpload = {
    uploadImage: uploadImage,
  };
})(typeof window !== "undefined" ? window : this);
