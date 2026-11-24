/* =====================================================================
   resumen.js  —  Resumen operativo: Top 5 de cuadras + recomendaciones
   Rol: Ingeniero de Lógica y Clasificación
   ---------------------------------------------------------------------
   Responsabilidad (RF-05):
     Agrupar los reportes por cuadra, sumar sus puntajes de criticidad,
     ordenar de mayor a menor y quedarnos con las 5 cuadras más críticas.
     A cada cuadra se le asigna una recomendación producida por REGLAS
     ESCRITAS, y se muestra cuál regla la produjo.

   Reglas de recomendación (se evalúan en orden de prioridad):
     R1. 3 o más reportes de nivel Alto en hora pico
         -> "Patrullaje prioritario en hora pico"
     R2. Predomina la invasión de andén
         -> "Operativo de espacio público"
     R3. Predomina el vehículo de carga descargando
         -> "Revisar horario de cargue y descargue"
     R0. (por defecto) Ninguna regla anterior aplica
         -> "Monitoreo regular"
   ===================================================================== */

/**
 * Devuelve el valor que MÁS se repite en una lista (la "moda").
 * Sirve para saber qué categoría o qué actor "predomina" en una cuadra.
 * Ej: ["a","b","a"] -> "a".  Lista vacía -> null.
 */
function valorPredominante(lista) {
  if (lista.length === 0) return null;
  const conteo = {};
  let ganador = lista[0];
  for (const valor of lista) {
    conteo[valor] = (conteo[valor] || 0) + 1;
    if (conteo[valor] > (conteo[ganador] || 0)) {
      ganador = valor;
    }
  }
  return ganador;
}

/**
 * Agrupa los reportes por cuadra y calcula, para cada una:
 *   - total de reportes
 *   - suma de puntajes de criticidad
 *   - cuántos reportes son Alto en hora pico
 *   - la categoría y el actor predominantes
 *
 * ENTRADAS: reportes, criterios (para deducir la franja por hora).
 * SALIDA  : objeto { idCuadra: {datos agregados...}, ... }
 */
function agruparPorCuadra(reportes, criterios) {
  const grupos = {};

  for (const reporte of reportes) {
    const cuadra = reporte.cuadra;

    // Si es la primera vez que vemos esta cuadra, la inicializamos.
    if (!grupos[cuadra]) {
      grupos[cuadra] = {
        cuadra,
        totalReportes: 0,
        puntajeAcumulado: 0,
        altosEnHoraPico: 0,
        categorias: [],
        actores: [],
      };
    }

    const g = grupos[cuadra];
    g.totalReportes += 1;
    g.puntajeAcumulado += reporte.criticidad ? reporte.criticidad.puntaje : 0;
    g.categorias.push(reporte.categoria);
    g.actores.push(reporte.actor);

    // ¿Es un reporte de nivel Alto que además cae en hora pico?
    const franja = obtenerFranja(reporte.fecha_hora, criterios.horas_pico);
    const esAlto = reporte.criticidad && reporte.criticidad.nivel === "Alto";
    if (esAlto && franja === "pico") {
      g.altosEnHoraPico += 1;
    }
  }

  return grupos;
}

/**
 * Aplica las REGLAS DE RECOMENDACIÓN a una cuadra ya agregada.
 * Devuelve { recomendacion, regla } para que la vista muestre la
 * recomendación JUNTO con la regla que la sustenta.
 */
function recomendarParaCuadra(grupo) {
  // R1 — Seguridad en hora pico (máxima prioridad).
  if (grupo.altosEnHoraPico >= 3) {
    return {
      recomendacion: "Patrullaje prioritario en hora pico",
      regla: "R1: 3 o más reportes de nivel Alto en hora pico",
    };
  }

  // R2 — Predomina la invasión de andén.
  if (valorPredominante(grupo.categorias) === "invasion_anden") {
    return {
      recomendacion: "Operativo de espacio público",
      regla: "R2: predomina la invasión de andén",
    };
  }

  // R3 — Predomina el vehículo de carga descargando.
  if (valorPredominante(grupo.actores) === "vehiculo_carga") {
    return {
      recomendacion: "Revisar horario de cargue y descargue",
      regla: "R3: predomina el vehículo de carga descargando",
    };
  }

  // R0 — Caso por defecto (ninguna regla anterior aplica).
  return {
    recomendacion: "Monitoreo regular",
    regla: "R0: ninguna regla prioritaria aplica",
  };
}

/**
 * FUNCIÓN PRINCIPAL del resumen operativo.
 *
 * ENTRADAS: reportes (ya filtrados o completos), criterios.
 * PASOS   : agrupar por cuadra -> ordenar por puntaje -> tomar 5 -> recomendar.
 * SALIDA  : arreglo ORDENADO (mayor a menor) con las 5 cuadras más críticas,
 *           cada una con su recomendación y la regla que la produjo.
 */
function generarResumen(reportes, criterios, vias = []) {
  const grupos = agruparPorCuadra(reportes, criterios);

  // Convertimos el objeto de grupos en una lista para poder ordenarla.
  const lista = Object.values(grupos).map((grupo) => {
    const { recomendacion, regla } = recomendarParaCuadra(grupo);
    // Nombre legible de la cuadra (si está en vias.json).
    const via = vias.find((v) => v.id === grupo.cuadra);
    return {
      cuadra: grupo.cuadra,
      nombre: via ? via.nombre : grupo.cuadra,
      sector: via ? via.sector : "—",
      totalReportes: grupo.totalReportes,
      puntajeAcumulado: grupo.puntajeAcumulado,
      altosEnHoraPico: grupo.altosEnHoraPico,
      recomendacion,
      regla,
    };
  });

  // Ordenamos de MAYOR a menor puntaje acumulado y tomamos el Top 5.
  lista.sort((a, b) => b.puntajeAcumulado - a.puntajeAcumulado);
  return lista.slice(0, 5);
}

/* ---------------------------------------------------------------------
   Exportación para pruebas en Node (ver nota en criticidad.js).
   --------------------------------------------------------------------- */
if (typeof module !== "undefined" && module.exports) {
  // eslint-disable-next-line no-global-assign, no-undef
  if (typeof obtenerFranja === "undefined") {
    global.obtenerFranja = require("./criticidad.js").obtenerFranja;
  }
  module.exports = {
    valorPredominante,
    agruparPorCuadra,
    recomendarParaCuadra,
    generarResumen,
  };
}
