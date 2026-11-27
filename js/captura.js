/* =====================================================================
   captura.js — Captura rápida (< 30 s), ubicación y persistencia local
   Rol: Persona D — Diseñador de Interfaz y Documentador
   ---------------------------------------------------------------------
   Responsabilidad (RF-01 y RF-06):
     - Capturar coordenadas por GPS del celular o toque en el mini-mapa.
     - Asociar la cuadra más cercana de vias.json (para calcular tipo_via).
     - Comprimir la foto opcional con <canvas> a máximo 800 px de ancho.
     - Invocar a window.calcularCriticidad() (criticidad.js) y guardar el
       reporte en localStorage.
     - Fusionar reportes importados sin duplicar por id.
   ===================================================================== */

export const CLAVE_REPORTES_COMUNIDAD = "control-vial-reportes-comunidad-v1";
const CENTRO_SANTA_MARTA = [11.226, -74.185];
const LIMITES_OFFLINE = [
  [11.216122, -74.201660],
  [11.243062, -74.168701]
];

export function leerReportesComunidad() {
  const raw = localStorage.getItem(CLAVE_REPORTES_COMUNIDAD);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Formato inválido en almacenamiento local.");
  }
  return parsed;
}

export function guardarReportesComunidad(reportes) {
  localStorage.setItem(CLAVE_REPORTES_COMUNIDAD, JSON.stringify(reportes));
}

/**
 * Une dos listas de reportes evitando duplicados por el campo "id" (RF-06).
 */
export function fusionarReportesSinDuplicados(actuales, entrantes) {
  const mapaIds = new Map();
  actuales.forEach((rep) => {
    if (rep && rep.id) mapaIds.set(rep.id, rep);
  });

  let nuevos = 0;
  let duplicados = 0;

  entrantes.forEach((rep) => {
    if (!rep || !rep.id) return;
    if (mapaIds.has(rep.id)) {
      duplicados += 1;
    } else {
      mapaIds.set(rep.id, rep);
      nuevos += 1;
    }
  });

  return {
    combinados: Array.from(mapaIds.values()),
    nuevos,
    duplicados
  };
}

/**
 * Comprime una imagen usando <canvas> a un máximo de 800 px de ancho.
 */
export function comprimirFoto(file) {
  if (!file || !file.size) return Promise.resolve("");
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("El archivo adjunto debe ser una imagen."));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error("La foto supera los 10 MB antes de comprimir."));
  }

  return createImageBitmap(file).then(async (imagen) => {
    try {
      const escala = Math.min(1, 800 / imagen.width);
      let ancho = Math.max(1, Math.round(imagen.width * escala));
      let alto = Math.max(1, Math.round(imagen.height * escala));
      const lienzo = document.createElement("canvas");
      const ctx = lienzo.getContext("2d");
      if (!ctx) throw new Error("No se pudo iniciar canvas para comprimir la foto.");

      for (let intento = 0; intento < 6; intento += 1) {
        lienzo.width = ancho;
        lienzo.height = alto;
        ctx.drawImage(imagen, 0, 0, ancho, alto);

        const calidad = Math.max(0.42, 0.78 - intento * 0.08);
        const blob = await new Promise((resolve) => lienzo.toBlob(resolve, "image/jpeg", calidad));
        if (!blob) throw new Error("No se pudo generar la foto comprimida.");

        if (blob.size <= 450 * 1024) {
          return await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = () => reject(new Error("No se pudo leer la foto comprimida."));
            lector.readAsDataURL(blob);
          });
        }
        ancho = Math.max(1, Math.round(ancho * 0.8));
        alto = Math.max(1, Math.round(alto * 0.8));
      }
      throw new Error("La foto sigue siendo muy pesada al comprimirla.");
    } finally {
      imagen.close();
    }
  });
}

function encontrarCuadraMasCercana(lat, lng, vias) {
  if (!vias.length) return null;
  let mejor = vias[0];
  let menorDist = Infinity;

  vias.forEach((via) => {
    const dLat = via.lat - lat;
    const dLng = via.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < menorDist) {
      menorDist = dist;
      mejor = via;
    }
  });
  return mejor;
}

function crearIdReporte(reportesExistentes) {
  let id;
  do {
    id = `WEB-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  } while (reportesExistentes.some((r) => r.id === id));
  return id;
}

export function inicializarCaptura({ onReporteGuardado }) {
  const formulario = document.getElementById("formulario-reporte");
  const selectorCuadra = document.getElementById("reporte-cuadra");
  const btnGps = document.getElementById("btn-gps");
  const estadoUbicacion = document.getElementById("estado-ubicacion");
  const inputFoto = document.getElementById("reporte-foto");
  const previewBox = document.getElementById("preview-foto-box");
  const previewImg = document.getElementById("preview-foto-img");
  const btnQuitarFoto = document.getElementById("btn-quitar-foto");
  const btnEnviar = document.getElementById("btn-enviar-reporte");
  const estadoFormulario = document.getElementById("estado-formulario");
  const resultadoBox = document.getElementById("resultado-criticidad-captura");

  let vias = [];
  let criterios = null;
  let obtenerExistentes = () => [];
  let ubicacionMarcada = null; // { lat, lng }

  // Mini-mapa para marcar el punto exacto con un toque
  const miniMapa = L.map("mapa-captura", { zoomControl: true }).setView(CENTRO_SANTA_MARTA, 14);
  if (navigator.onLine) {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OSM"
    }).addTo(miniMapa);
  } else {
    L.imageOverlay("datos/mapa-offline.png", LIMITES_OFFLINE).addTo(miniMapa);
  }
  const marcador = L.marker(CENTRO_SANTA_MARTA).addTo(miniMapa);

  // Cuando la ventana cambia (ej. al cambiar de pestaña), reajusta el mini-mapa
  window.addEventListener("resize", () => miniMapa.invalidateSize());

  function fijarUbicacion(lat, lng, textoEtiqueta) {
    ubicacionMarcada = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    marcador.setLatLng([ubicacionMarcada.lat, ubicacionMarcada.lng]);
    miniMapa.panTo([ubicacionMarcada.lat, ubicacionMarcada.lng]);
    estadoUbicacion.textContent = textoEtiqueta;
  }

  miniMapa.on("click", (ev) => {
    if (!vias.length) return;
    const { lat, lng } = ev.latlng;
    const cercana = encontrarCuadraMasCercana(lat, lng, vias);
    if (cercana) {
      selectorCuadra.value = cercana.id;
      fijarUbicacion(lat, lng, `Punto marcado · ${cercana.id}`);
    }
  });

  selectorCuadra.addEventListener("change", () => {
    const via = vias.find((v) => v.id === selectorCuadra.value);
    if (via) {
      fijarUbicacion(via.lat, via.lng, `Cuadra: ${via.id}`);
    }
  });

  btnGps.addEventListener("click", () => {
    if (!navigator.geolocation) {
      estadoUbicacion.textContent = "Tu navegador no soporta GPS; toca el mapa.";
      return;
    }
    btnGps.disabled = true;
    estadoUbicacion.textContent = "Obteniendo GPS...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const cercana = encontrarCuadraMasCercana(latitude, longitude, vias);
        if (cercana) {
          selectorCuadra.value = cercana.id;
          fijarUbicacion(latitude, longitude, `GPS activo · cuadra cercana: ${cercana.id}`);
        } else {
          fijarUbicacion(latitude, longitude, "GPS activo");
        }
        btnGps.disabled = false;
      },
      () => {
        estadoUbicacion.textContent = "No se pudo obtener GPS. Toca el mapa o elige cuadra.";
        btnGps.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // Vista previa de foto
  inputFoto.addEventListener("change", () => {
    const file = inputFoto.files?.[0];
    if (!file) {
      previewBox.classList.add("hidden");
      return;
    }
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewBox.classList.remove("hidden");
  });

  btnQuitarFoto.addEventListener("click", () => {
    inputFoto.value = "";
    previewImg.src = "";
    previewBox.classList.add("hidden");
  });

  formulario.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const datos = new FormData(formulario);
    const idCuadra = datos.get("cuadra");
    const categoria = datos.get("categoria");
    const actor = datos.get("actor");

    if (!idCuadra || !categoria || !actor) {
      estadoFormulario.textContent = "Completa los pasos 1, 2 y 3 (ubicación, qué ocurrió y actor).";
      return;
    }

    const via = vias.find((v) => v.id === idCuadra);
    if (!via) {
      estadoFormulario.textContent = "Selecciona una cuadra válida.";
      return;
    }

    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    const franja = window.obtenerFranja(fechaLocal, criterios.horas_pico);
    const fechaVisible = ahora.toLocaleString("es-CO", {
      dateStyle: "short",
      timeStyle: "short"
    });
    const nombreFranja = franja === "pico" ? "hora pico" : "hora valle";
    if (!window.confirm(
      `Hora del reporte: ${fechaVisible}\nClasificación: ${nombreFranja}.\n¿Deseas enviar el reporte?`
    )) {
      estadoFormulario.textContent = "Envío cancelado. Puedes revisar el reporte antes de enviarlo.";
      return;
    }

    btnEnviar.disabled = true;
    resultadoBox.classList.add("hidden");

    try {
      const archivoFoto = inputFoto.files?.[0];
      estadoFormulario.textContent = archivoFoto
        ? "Comprimiendo foto y guardando..."
        : "Calculando criticidad y guardando...";

      const fotoBase64 = archivoFoto ? await comprimirFoto(archivoFoto) : "";

      const coord = ubicacionMarcada || { lat: via.lat, lng: via.lng };
      if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) {
        throw new Error("La cuadra seleccionada no tiene coordenadas válidas. Marca el punto en el mapa e inténtalo de nuevo.");
      }

      const reporte = {
        id: crearIdReporte(obtenerExistentes()),
        origen: "ciudadano",
        fecha_hora: fechaLocal,
        lat: coord.lat,
        lng: coord.lng,
        cuadra: via.id,
        categoria,
        actor,
        foto: fotoBase64
      };

      reporte.criticidad = window.calcularCriticidad(reporte, criterios, vias);

      const guardados = leerReportesComunidad();
      guardarReportesComunidad([...guardados, reporte]);

      if (onReporteGuardado) onReporteGuardado(reporte);

      estadoFormulario.textContent = `¡Listo! Reporte ${reporte.id} guardado.`;
      const d = reporte.criticidad.desglose;
      resultadoBox.innerHTML = `
        <strong>Criticidad calculada: ${reporte.criticidad.nivel} (${reporte.criticidad.puntaje} pts)</strong><br>
        Categoría (${d.categoria.aporte}) + Vía ${d.via.valor} (${d.via.aporte}) + Franja ${d.franja.valor} (${d.franja.aporte})
      `;
      resultadoBox.classList.remove("hidden");

      // Limpiar selección rápida para permitir otro reporte inmediato
      formulario.reset();
      previewImg.src = "";
      previewBox.classList.add("hidden");
      ubicacionMarcada = null;
      estadoUbicacion.textContent = "Toca el mapa o elige una cuadra";
    } catch (err) {
      estadoFormulario.textContent =
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "Almacenamiento local lleno; exporta los reportes y libera espacio."
          : `Error: ${err.message}`;
    } finally {
      btnEnviar.disabled = false;
    }
  });

  return {
    configurarDatos(nuevasVias, nuevosCriterios, fnExistentes) {
      vias = nuevasVias;
      criterios = nuevosCriterios;
      obtenerExistentes = fnExistentes;

      selectorCuadra.replaceChildren(new Option("Selecciona una cuadra...", ""));
      vias.forEach((via) => {
        selectorCuadra.append(new Option(via.nombre, via.id));
      });

      formulario.querySelectorAll("input, select, button").forEach((el) => {
        el.disabled = false;
      });
      estadoFormulario.textContent = "completa los campos y envía tu reporte.";
    }
  };
}