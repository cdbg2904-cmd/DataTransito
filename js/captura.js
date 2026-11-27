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
function crearLienzoPixelado(imagen, nivelPixelado, mascara = null) {
  const escala = Math.min(1, 800 / imagen.width);
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));
  const lienzoOriginal = document.createElement("canvas");
  lienzoOriginal.width = ancho;
  lienzoOriginal.height = alto;
  const ctxOriginal = lienzoOriginal.getContext("2d");
  if (!ctxOriginal) throw new Error("No se pudo iniciar canvas para editar la foto.");
  ctxOriginal.drawImage(imagen, 0, 0, ancho, alto);
  if (!mascara) return lienzoOriginal;

  const tamanoBloque = Math.max(1, Number(nivelPixelado) || 1);
  if (tamanoBloque === 1) return lienzoOriginal;

  const lienzoPixelado = document.createElement("canvas");
  lienzoPixelado.width = ancho;
  lienzoPixelado.height = alto;
  const ctxPixelado = lienzoPixelado.getContext("2d");
  if (!ctxPixelado) throw new Error("No se pudo iniciar canvas para pixelar la foto.");
  const miniatura = document.createElement("canvas");
  miniatura.width = Math.max(1, Math.ceil(ancho / tamanoBloque));
  miniatura.height = Math.max(1, Math.ceil(alto / tamanoBloque));
  const ctxMiniatura = miniatura.getContext("2d");
  if (!ctxMiniatura) throw new Error("No se pudo iniciar canvas para pixelar la foto.");
  ctxMiniatura.drawImage(imagen, 0, 0, miniatura.width, miniatura.height);
  ctxPixelado.imageSmoothingEnabled = false;
  ctxPixelado.drawImage(miniatura, 0, 0, miniatura.width, miniatura.height, 0, 0, ancho, alto);

  ctxPixelado.globalCompositeOperation = "destination-in";
  ctxPixelado.drawImage(mascara, 0, 0, ancho, alto);
  ctxOriginal.drawImage(lienzoPixelado, 0, 0);
  return lienzoOriginal;
}

export function comprimirFoto(file, nivelPixelado = 14, mascaraPixelado = null) {
  if (!file || !file.size) return Promise.resolve("");
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("El archivo adjunto debe ser una imagen."));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error("La foto supera los 10 MB antes de comprimir."));
  }

  return createImageBitmap(file).then(async (imagen) => {
    try {
      const lienzoEditado = crearLienzoPixelado(imagen, nivelPixelado, mascaraPixelado);
      let ancho = lienzoEditado.width;
      let alto = lienzoEditado.height;
      const lienzo = document.createElement("canvas");
      const ctx = lienzo.getContext("2d");
      if (!ctx) throw new Error("No se pudo iniciar canvas para comprimir la foto.");

      for (let intento = 0; intento < 6; intento += 1) {
        lienzo.width = ancho;
        lienzo.height = alto;
        ctx.drawImage(lienzoEditado, 0, 0, ancho, alto);

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
  const btnEditarFoto = document.getElementById("btn-editar-foto");
  const editorFoto = document.getElementById("dialogo-editor-foto");
  const btnCerrarEditor = document.getElementById("btn-cerrar-editor");
  const btnAplicarFoto = document.getElementById("btn-aplicar-foto");
  const nivelPixelado = document.getElementById("nivel-pixelado");
  const valorPixelado = document.getElementById("valor-pixelado");
  const tamanoPincel = document.getElementById("tamano-pincel");
  const valorPincel = document.getElementById("valor-pincel");
  const btnLimpiarPixelado = document.getElementById("btn-limpiar-pixelado");
  const canvasEditor = document.getElementById("canvas-editor-foto");
  const btnEnviar = document.getElementById("btn-enviar-reporte");
  const estadoFormulario = document.getElementById("estado-formulario");
  const resultadoBox = document.getElementById("resultado-criticidad-captura");

  let vias = [];
  let criterios = null;
  let obtenerExistentes = () => [];
  let ubicacionMarcada = null; // { lat, lng }
  let imagenSeleccionada = null;
  let mascaraPixelado = null;
  let hayZonasPixeladas = false;
  let dibujandoPixelado = false;

  function dibujarVistaPrevia() {
    if (!imagenSeleccionada) return;
    const lienzoEditado = crearLienzoPixelado(
      imagenSeleccionada,
      nivelPixelado.value,
      hayZonasPixeladas ? mascaraPixelado : null
    );
    canvasEditor.width = lienzoEditado.width;
    canvasEditor.height = lienzoEditado.height;
    const ctx = canvasEditor.getContext("2d");
    if (!ctx) throw new Error("No se pudo mostrar la vista previa de la foto.");
    ctx.drawImage(lienzoEditado, 0, 0);
    previewImg.src = lienzoEditado.toDataURL("image/jpeg", 0.84);
    valorPixelado.textContent = `${nivelPixelado.value} px`;
  }

  function obtenerPuntoPincel(evento) {
    const limites = canvasEditor.getBoundingClientRect();
    return {
      x: (evento.clientX - limites.left) * canvasEditor.width / limites.width,
      y: (evento.clientY - limites.top) * canvasEditor.height / limites.height
    };
  }

  function pintarZonaPixelada(evento, iniciar) {
    if (!imagenSeleccionada || !mascaraPixelado) return;
    const ctx = mascaraPixelado.getContext("2d");
    if (!ctx) throw new Error("No se pudo iniciar el pincel de pixelado.");
    const punto = obtenerPuntoPincel(evento);
    const limites = canvasEditor.getBoundingClientRect();
    const factorEscala = canvasEditor.width / limites.width;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = Number(tamanoPincel.value) * factorEscala;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (iniciar) {
      ctx.beginPath();
      ctx.arc(punto.x, punto.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(punto.x, punto.y);
    } else {
      ctx.lineTo(punto.x, punto.y);
      ctx.stroke();
    }
    hayZonasPixeladas = true;
    dibujarVistaPrevia();
  }

  canvasEditor.addEventListener("pointerdown", (evento) => {
    if (!imagenSeleccionada) return;
    evento.preventDefault();
    dibujandoPixelado = true;
    canvasEditor.setPointerCapture(evento.pointerId);
    pintarZonaPixelada(evento, true);
  });
  canvasEditor.addEventListener("pointermove", (evento) => {
    if (dibujandoPixelado) pintarZonaPixelada(evento, false);
  });
  canvasEditor.addEventListener("pointerup", () => { dibujandoPixelado = false; });
  canvasEditor.addEventListener("pointercancel", () => { dibujandoPixelado = false; });
  btnEditarFoto.addEventListener("click", () => {
    if (imagenSeleccionada && !editorFoto.open) editorFoto.showModal();
  });
  [btnCerrarEditor, btnAplicarFoto].forEach((boton) => {
    boton.addEventListener("click", () => editorFoto.close());
  });

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
  inputFoto.addEventListener("change", async () => {
    const file = inputFoto.files?.[0];
    if (!file) {
      previewBox.classList.add("hidden");
      btnEditarFoto.classList.add("hidden");
      if (imagenSeleccionada) imagenSeleccionada.close();
      imagenSeleccionada = null;
      mascaraPixelado = null;
      hayZonasPixeladas = false;
      return;
    }
    try {
      if (!file.type.startsWith("image/")) throw new Error("El archivo adjunto debe ser una imagen.");
      if (file.size > 10 * 1024 * 1024) throw new Error("La foto supera los 10 MB antes de comprimir.");
      if (imagenSeleccionada) imagenSeleccionada.close();
      imagenSeleccionada = null;
      imagenSeleccionada = await createImageBitmap(file);
      nivelPixelado.value = "14";
      tamanoPincel.value = "48";
      valorPincel.textContent = "48 px";
      mascaraPixelado = document.createElement("canvas");
      mascaraPixelado.width = Math.max(1, Math.round(imagenSeleccionada.width * Math.min(1, 800 / imagenSeleccionada.width)));
      mascaraPixelado.height = Math.max(1, Math.round(imagenSeleccionada.height * Math.min(1, 800 / imagenSeleccionada.width)));
      hayZonasPixeladas = false;
      dibujarVistaPrevia();
      previewBox.classList.remove("hidden");
      btnEditarFoto.classList.remove("hidden");
    } catch (error) {
      inputFoto.value = "";
      estadoFormulario.textContent = `Error: ${error.message}`;
      btnEditarFoto.classList.add("hidden");
      previewBox.classList.add("hidden");
      if (imagenSeleccionada) imagenSeleccionada.close();
      imagenSeleccionada = null;
      mascaraPixelado = null;
      hayZonasPixeladas = false;
    }
  });

  nivelPixelado.addEventListener("input", dibujarVistaPrevia);
  nivelPixelado.addEventListener("input", () => {
    valorPixelado.textContent = `${nivelPixelado.value} px`;
  });
  tamanoPincel.addEventListener("input", () => {
    valorPincel.textContent = `${tamanoPincel.value} px`;
  });

  btnLimpiarPixelado.addEventListener("click", () => {
    if (!mascaraPixelado) return;
    const ctx = mascaraPixelado.getContext("2d");
    if (!ctx) throw new Error("No se pudo limpiar las marcas de pixelado.");
    ctx.clearRect(0, 0, mascaraPixelado.width, mascaraPixelado.height);
    hayZonasPixeladas = false;
    dibujarVistaPrevia();
  });

  btnQuitarFoto.addEventListener("click", () => {
    inputFoto.value = "";
    previewImg.src = "";
    previewBox.classList.add("hidden");
    btnEditarFoto.classList.add("hidden");
    if (editorFoto.open) editorFoto.close();
    if (imagenSeleccionada) imagenSeleccionada.close();
    imagenSeleccionada = null;
    mascaraPixelado = null;
    hayZonasPixeladas = false;
    nivelPixelado.value = "14";
    valorPixelado.textContent = "14 px";
    tamanoPincel.value = "48";
    valorPincel.textContent = "48 px";
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
        ? "Aplicando edición y guardando foto..."
        : "Calculando criticidad y guardando...";

      const fotoBase64 = archivoFoto
        ? await comprimirFoto(archivoFoto, nivelPixelado.value, hayZonasPixeladas ? mascaraPixelado : null)
        : "";

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
      btnEditarFoto.classList.add("hidden");
      if (editorFoto.open) editorFoto.close();
      if (imagenSeleccionada) imagenSeleccionada.close();
      imagenSeleccionada = null;
      mascaraPixelado = null;
      hayZonasPixeladas = false;
      nivelPixelado.value = "14";
      tamanoPincel.value = "48";
      valorPixelado.textContent = "14 px";
      valorPincel.textContent = "48 px";
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