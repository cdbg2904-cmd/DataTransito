/* =====================================================================
   filtros.js  —  Lógica de filtrado combinable
   Rol: Ingeniero de Lógica y Clasificación
   ---------------------------------------------------------------------
   Responsabilidad (RF-04):
     Recibir la lista COMPLETA de reportes y los filtros activos, y
     devolver la lista FILTRADA. No toca el mapa ni la pantalla.

   El filtro es una REPETICIÓN CON CONDICIÓN:
     "para cada reporte, si cumple TODAS las opciones elegidas, se muestra".

   Filtros soportados: sector, cuadra, franja horaria, categoria y actor.
   Un filtro vacío ("" / null / "todos") significa "no filtrar por eso".
   ===================================================================== */

/**
 * Indica si un valor de filtro está "vacío" (es decir, no se debe aplicar).
 * Consideramos vacío: undefined, null, "" y la palabra "todos".
 */
function filtroVacio(valor) {
  return valor === undefined || valor === null || valor === "" || valor === "todos";
}

/**
 * Devuelve el sector de un reporte buscando su cuadra en vias.json.
 * Se usa solo cuando el usuario filtra por "sector".
 */
function obtenerSector(reporte, vias) {
  const via = vias.find((v) => v.id === reporte.cuadra);
  return via ? via.sector : null;
}

/**
 * FUNCIÓN PRINCIPAL del filtrado.
 *
 * ENTRADAS:
 *   reportes -> lista completa de reportes
 *   filtros  -> objeto con las opciones activas, por ejemplo:
 *               { sector: "Centro Histórico", franja: "pico",
 *                 categoria: "doble_fila", actor: "", cuadra: "" }
 *   criterios -> criterios.json (necesario para deducir la franja por hora)
 *   vias      -> vias.json (necesario para filtrar por sector)
 *
 * SALIDA:
 *   Nueva lista con SOLO los reportes que cumplen todos los filtros activos.
 */
function filtrarReportes(reportes, filtros = {}, criterios = null, vias = []) {
  return reportes.filter((reporte) => {
    // Filtro por CUADRA (comparación directa del id).
    if (!filtroVacio(filtros.cuadra) && reporte.cuadra !== filtros.cuadra) {
      return false;
    }

    // Filtro por SECTOR (se deduce de vias.json).
    if (!filtroVacio(filtros.sector)) {
      const sector = obtenerSector(reporte, vias);
      if (sector !== filtros.sector) return false;
    }

    // Filtro por CATEGORÍA (doble_fila, invasion_anden, etc.).
    if (!filtroVacio(filtros.categoria) && reporte.categoria !== filtros.categoria) {
      return false;
    }

    // Filtro por ACTOR (vehiculo_particular, motocicleta, etc.).
    if (!filtroVacio(filtros.actor) && reporte.actor !== filtros.actor) {
      return false;
    }

    // Filtro por FRANJA (pico / valle): se deduce de la hora del reporte.
    // Reutiliza obtenerFranja() definida en criticidad.js.
    if (!filtroVacio(filtros.franja) && criterios) {
      const franja = obtenerFranja(reporte.fecha_hora, criterios.horas_pico);
      if (franja !== filtros.franja) return false;
    }

    // Si pasó todas las condiciones activas, el reporte SÍ se muestra.
    return true;
  });
}

/* ---------------------------------------------------------------------
   Exportación para pruebas en Node (ver nota en criticidad.js).
   En Node importamos obtenerFranja desde criticidad.js.
   --------------------------------------------------------------------- */
if (typeof module !== "undefined" && module.exports) {
  // eslint-disable-next-line no-global-assign, no-undef
  if (typeof obtenerFranja === "undefined") {
    global.obtenerFranja = require("./criticidad.js").obtenerFranja;
  }
  module.exports = { filtroVacio, obtenerSector, filtrarReportes };
}
