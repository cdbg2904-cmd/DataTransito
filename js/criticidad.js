/* =====================================================================
   criticidad.js  —  Motor de cálculo del Índice de Criticidad
   Rol: Ingeniero de Lógica y Clasificación
   ---------------------------------------------------------------------
   Responsabilidad (RF-02):
     Recibir UN reporte y devolver su puntaje y nivel (Bajo/Medio/Alto).
     NO toca el mapa ni la pantalla, por eso se puede probar sola.

   El puntaje es la SUMA de tres componentes:
     1. categoria  -> peso tomado de criterios.json
     2. tipo_via   -> se busca la cuadra en vias.json (el usuario NO lo escribe)
     3. franja     -> se deduce de la hora del reporte (pico / valle)

   Pensamiento computacional:
     ENTRADAS : reporte, criterios, vias
     PASOS    : buscar via -> deducir franja -> sumar pesos
     CONDICION: ¿la hora cae en una franja pico?
     SALIDA   : { puntaje, nivel, desglose }
   ===================================================================== */

/**
 * Convierte un texto "HH:MM" a la cantidad de minutos desde medianoche.
 * Ej: "14:00" -> 840.  Sirve para comparar horas de forma numérica.
 */
function horaAMinutos(textoHora) {
  const [h, m] = textoHora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Decide si una hora dada pertenece a una franja PICO o VALLE.
 *
 * ENTRADA: fecha_hora del reporte ("2026-11-24T12:15") y la lista
 *          de rangos "horas_pico" de criterios.json.
 * SALIDA : "pico" o "valle".
 *
 * Idea (repetición con condición): para cada rango pico, si la hora
 * del reporte cae dentro de ese rango, es "pico". Si no cae en ninguno,
 * es "valle".
 */
function obtenerFranja(fechaHora, horasPico) {
  // De "2026-11-24T12:15" tomamos solo "12:15" (lo que va después de la T).
  const horaTexto = fechaHora.split("T")[1].slice(0, 5);
  const minutos = horaAMinutos(horaTexto);

  for (const rango of horasPico) {
    const [inicio, fin] = rango.split("-");
    if (minutos >= horaAMinutos(inicio) && minutos <= horaAMinutos(fin)) {
      return "pico";
    }
  }
  return "valle";
}

/**
 * Busca el tipo de vía de una cuadra dentro de vias.json.
 *
 * ENTRADA: id de la cuadra (ej. "CR5-C14-C15") y el arreglo de vias.
 * SALIDA : "arterial", "secundaria" o null si la cuadra no está catalogada.
 */
function obtenerTipoVia(idCuadra, vias) {
  const via = vias.find((v) => v.id === idCuadra);
  return via ? via.tipo_via : null;
}

/**
 * Convierte un puntaje numérico en un nivel (Bajo / Medio / Alto)
 * usando los rangos definidos en criterios.json -> "niveles".
 *
 * Ej. con niveles { "Bajo":[0,4], "Medio":[5,6], "Alto":[7,9] }:
 *   puntaje 3 -> "Bajo", 5 -> "Medio", 8 -> "Alto".
 */
function obtenerNivel(puntaje, niveles) {
  for (const [nombre, [min, max]] of Object.entries(niveles)) {
    if (puntaje >= min && puntaje <= max) {
      return nombre;
    }
  }
  return "Desconocido"; // El puntaje quedó fuera de todos los rangos definidos.
}

/**
 * FUNCIÓN PRINCIPAL del motor de criticidad.
 *
 * ENTRADAS:
 *   reporte   -> objeto con al menos { fecha_hora, cuadra, categoria }
 *   criterios -> contenido de criterios.json (pesos, horas_pico, niveles)
 *   vias      -> contenido de vias.json (catálogo de cuadras)
 *
 * SALIDA:
 *   { puntaje, nivel, desglose }
 *   donde "desglose" explica cuánto aportó cada componente. Esto permite
 *   hacer la "cuenta a mano" frente al jurado y ver de dónde salió el total.
 */
function calcularCriticidad(reporte, criterios, vias) {
  // 1) Componente CATEGORÍA (peso directo desde criterios.json).
  const pesoCategoria = criterios.categoria[reporte.categoria] ?? 0;

  // 2) Componente VÍA: se deduce buscando la cuadra en vias.json.
  const tipoVia = obtenerTipoVia(reporte.cuadra, vias);
  const pesoVia = tipoVia ? (criterios.via[tipoVia] ?? 0) : 0;

  // 3) Componente FRANJA: se deduce de la hora del reporte.
  const franja = obtenerFranja(reporte.fecha_hora, criterios.horas_pico);
  const pesoFranja = criterios.franja[franja] ?? 0;

  // Suma de los tres componentes = puntaje total.
  const puntaje = pesoCategoria + pesoVia + pesoFranja;

  // Traducción del puntaje a nivel (Bajo / Medio / Alto).
  const nivel = obtenerNivel(puntaje, criterios.niveles);

  return {
    puntaje,
    nivel,
    desglose: {
      categoria: { valor: reporte.categoria, aporte: pesoCategoria },
      via: { valor: tipoVia, aporte: pesoVia },
      franja: { valor: franja, aporte: pesoFranja },
    },
  };
}

/* ---------------------------------------------------------------------
   Exportación:
   - En el navegador, las funciones quedan disponibles de forma global
     (window) porque este archivo se carga con <script src="...">.
   - El bloque de abajo permite además importarlas en Node para pruebas
     automáticas (criticidad.js "se puede probar sola").
   --------------------------------------------------------------------- */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    horaAMinutos,
    obtenerFranja,
    obtenerTipoVia,
    obtenerNivel,
    calcularCriticidad,
  };
}
