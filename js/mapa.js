let mapa;
let capaCalor;
let capaPuntos;
let capaOSM;
let capaOffline;
let controlZoom;
let mostrandoCalor = true;
let modoOffline = false;

const CENTRO_UNIVERSIDAD = [11.2233, -74.1865];
const LIMITES_MAPA_OFFLINE = [
  [11.2131, -74.2246],
  [11.2374, -74.1781]
];
const ZOOM_INICIAL = 15.5;
const ZOOM_EN_LINEA = ZOOM_INICIAL + 1;
const ZOOM_OUT_MAXIMO_OFFLINE = 0.3;
const ZOOM_IN_MAXIMO_OFFLINE = 2.5;
const RADIO_CALOR = 28;
const DIFUMINADO_CALOR = 18;

function opcionesCalorSegunModo() {
  const escala = modoOffline ? 0.5 : 1;
  return {
    radius: RADIO_CALOR * escala,
    blur: DIFUMINADO_CALOR * escala
  };
}

/**
 * Inicializa el mapa base con OpenStreetMap o respaldo offline
 */
export function inicializarMapa() {
  mapa = L.map('mapa', {
    zoomControl: false,
    zoomSnap: 0.1,
    maxBoundsViscosity: 1
  });
  controlZoom = L.control.zoom().addTo(mapa);

  capaOffline = L.imageOverlay('datos/mapa-offline.png?v=university-center', LIMITES_MAPA_OFFLINE);
  capaOffline.on('error', (evento) => {
    console.error('No se pudo cargar datos/mapa-offline.png', evento);
  });
  mapa.setView(CENTRO_UNIVERSIDAD, ZOOM_EN_LINEA);

  capaOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  });
  capaOSM.on('tileerror', () => establecerModoOffline(true));

  capaPuntos = L.layerGroup();

  if (navigator.onLine) {
    capaOSM.addTo(mapa);
  } else {
    establecerModoOffline(true);
  }
}

/**
 * Alterna entre el mapa de teselas y la imagen offline para facilitar las pruebas.
 */
export function establecerModoOffline(activar) {
  if (modoOffline === activar) return modoOffline;

  if (activar) {
    if (mapa.hasLayer(capaOSM)) mapa.removeLayer(capaOSM);
    capaOffline.addTo(mapa);
    mapa.setMaxBounds(capaOffline.getBounds());
    mapa.setMinZoom(ZOOM_INICIAL - ZOOM_OUT_MAXIMO_OFFLINE);
    mapa.setMaxZoom(ZOOM_INICIAL + ZOOM_IN_MAXIMO_OFFLINE);
    mapa.setView(CENTRO_UNIVERSIDAD, ZOOM_EN_LINEA, { animate: false });
  } else {
    if (capaOffline && mapa.hasLayer(capaOffline)) mapa.removeLayer(capaOffline);
    capaOSM.addTo(mapa);
    mapa.setMaxBounds(null);
    mapa.setMinZoom(0);
    mapa.setMaxZoom(19);
    mapa.setView(CENTRO_UNIVERSIDAD, ZOOM_INICIAL, { animate: false });
  }

  modoOffline = activar;
  if (capaCalor) capaCalor.setOptions(opcionesCalorSegunModo());
  window.dispatchEvent(new CustomEvent('mapa:modo-offline', {
    detail: { activo: modoOffline }
  }));
  return modoOffline;
}

export function estaModoOffline() {
  return modoOffline;
}

/**
 * Actualiza el mapa de calor y los marcadores individuales según los reportes filtrados
 */
export function actualizarCapasMapa(reportes) {
  // Limpiar capas anteriores antes de redibujar (clave para los filtros sin recargar)
  if (capaCalor) mapa.removeLayer(capaCalor);
  capaPuntos.clearLayers();

  // 1. Preparar datos para Leaflet.heat: [lat, lng, intensidad_normalizada]
  // Como el puntaje máximo es 9, dividimos entre 9 para que Leaflet.heat escale bien (0.0 a 1.0)
  const puntosCalor = reportes.map(rep => [
    rep.lat,
    rep.lng,
    (rep.criticidad?.puntaje || 1) / 9
  ]);

  capaCalor = L.heatLayer(puntosCalor, {
    ...opcionesCalorSegunModo(),
    maxZoom: 17,
    gradient: { 0.4: 'blue', 0.65: 'lime', 0.8: 'orange', 1.0: 'red' }
  });

  // 2. Preparar marcadores individuales con popup informativo
  reportes.forEach(rep => {
    const color = rep.criticidad?.nivel === 'Alto' ? '#d32f2f'
                : rep.criticidad?.nivel === 'Medio' ? '#f57c00' : '#388e3c';

    const marcador = L.circleMarker([rep.lat, rep.lng], {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    });

    marcador.bindPopup(`
      <strong>Cuadra:</strong> ${rep.cuadra}<br>
      <strong>Categoría:</strong> ${rep.categoria}<br>
      <strong>Actor:</strong> ${rep.actor}<br>
      <strong>Criticidad:</strong> ${rep.criticidad?.nivel} (${rep.criticidad?.puntaje} pts)<br>
      ${rep.foto ? `<img src="${rep.foto}" alt="Evidencia" style="width:140px; margin-top:6px; border-radius:4px;">` : ''}
    `);

    marcador.addTo(capaPuntos);
  });

  // Mostrar la capa que el usuario tenga activa
  if (mostrandoCalor) {
    capaCalor.addTo(mapa);
  } else {
    capaPuntos.addTo(mapa);
  }
}

/**
 * Alterna entre vista de Mapa de Calor y vista de Puntos Individuales (RF-03)
 */
export function alternarVistaMapa() {
  mostrandoCalor = !mostrandoCalor;
  if (mostrandoCalor) {
    mapa.removeLayer(capaPuntos);
    if (capaCalor) capaCalor.setOptions(opcionesCalorSegunModo());
    if (capaCalor) capaCalor.addTo(mapa);
  } else {
    if (capaCalor) mapa.removeLayer(capaCalor);
    capaPuntos.addTo(mapa);
  }
  return mostrandoCalor;
}