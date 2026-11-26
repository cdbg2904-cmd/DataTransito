# 🧭 Bitácora de desarrollo — DataTransito (Equipo 5)

> Registro cronológico del trabajo realizado en el **Reto No. 2 — Control de mal
> parqueo e invasión del espacio público (Santa Marta)**.
> Rol que lleva esta bitácora: **Ingeniero de Lógica y Clasificación**.
>
> Esta bitácora de *desarrollo* alimenta la **Bitácora de ingeniería** (entregable
> PDF, máx. 3 páginas) y la **Bitácora de iteración** (fallos de la IA).

---

## 📌 Convenciones

- Cada entrada lleva **fecha**, **autor/rol**, **qué se hizo** y **decisiones**.
- Las decisiones de las reglas de criticidad se justifican aquí (criterio de
  evaluación: *"Reglas justificadas"*).
- Los fallos de la IA se registran con los 5 datos que pide el enunciado
  (sección *Bitácora de iteración* al final).

---

## 🗓️ 2026-11-23 — Lógica y clasificación (base del motor)

**Autor:** Ingeniero de Lógica y Clasificación · (apoyo IA: Claude)

### Qué se hizo
- Se corrigió la **extensión equivocada** de los archivos de lógica: estaban como
  `js/criticidad.json`, `js/filtros.json`, `js/resumen.json` (y contenían
  placeholders como `"hola, 0e91jud09"`). Se reemplazaron por archivos `.js`
  reales:
  - [`js/criticidad.js`](../js/criticidad.js) — motor de cálculo del índice (RF-02).
  - [`js/filtros.js`](../js/filtros.js) — filtrado combinable (RF-04).
  - [`js/resumen.js`](../js/resumen.js) — Top 5 de cuadras + recomendaciones (RF-05).
- Se escribieron **funciones puras** (no tocan el mapa ni la pantalla) para que
  `criticidad.js` *"se pueda probar sola"*, tal como pide el enunciado.
- Se dejó un bloque `module.exports` al final de cada archivo para poder correr
  pruebas automáticas con Node sin afectar el uso en el navegador (`<script>`).
- Se revisaron y **mantuvieron** los pesos de
  [`datos/criterios.json`](../datos/criterios.json) (ver justificación abajo).

### Verificación del cálculo (RF-02 — dos casos a mano)
El motor reproduce exactamente los puntajes guardados en `reportes.json`:

| Reporte | Cuadra | Categoría | Vía | Franja | Suma | Nivel | Guardado |
| :------ | :----- | :-------- | :-- | :----- | :--- | :---- | :------- |
| MP-001  | C29I-CR21-CR21D | doble fila (3) | secundaria (1) | pico (1) — 17:51 ∈ 17:00–19:30 | **5** | **Medio** | 5 / Medio ✅ |
| MP-007  | C29H-CR21B-CR21F | doble fila (3) | arterial (2) | pico (1) — 17:48 ∈ 17:00–19:30 | **6** | **Alto** | 6 / Alto ✅ |

> Estos son los **dos casos calculados a mano** que se presentan al jurado.
> Los campos `id_via` de los reportes se usan para buscar el tipo de vía en
> `vias.json`; por eso el cálculo funciona tanto con `id_via` como con `cuadra`.

### Decisiones y justificación de las reglas de criticidad
Pesos definidos en `datos/criterios.json` (se guardan en el JSON y **no** en el
código, para poder cambiar una regla sin tocar la lógica — esto se puede pedir en
la sustentación):

- **Categoría** — `doble_fila: 3`, `bloqueo_rampa_cebra_paradero: 3`,
  `invasion_anden: 2`.
  *Justificación:* la doble fila y el bloqueo de rampa/cebra/paradero quitan un
  carril o cierran el paso del peatón de forma inmediata (riesgo alto), mientras
  que la invasión de andén, siendo grave, suele dejar un paso parcial → peso 2.
- **Tipo de vía** — `arterial: 2`, `secundaria: 1`.
  *Justificación:* una obstrucción en vía arterial afecta a muchos más vehículos
  y rutas que en una secundaria; la diferencia se limita a un punto para que la
  ubicación no domine sobre el tipo de incidente.
- **Franja horaria** — `pico: 1`, `valle: 0`.
  *Justificación:* la hora pico aumenta la prioridad en un punto sin inflar por
  sí sola el nivel de criticidad.
- **Horas pico** — `06:30–08:30`, `11:30–14:00`, `17:00–19:30`.
  *Justificación:* entrada laboral/escolar, almuerzo y salida; confirmar con los
  dos recorridos de campo.
- **Niveles** — `Bajo [0–3]`, `Medio [4–5]`, `Alto [6–7]`.
  *Justificación:* el puntaje máximo posible es 3+2+1 = 6; los rangos permiten
  distinguir los incidentes en vías arteriales de los demás casos.

> ℹ️ **Nota:** el `actor` (vehículo particular, moto, carga, mobiliario) **no**
> suma al puntaje; solo se usa para los **filtros** y para las **recomendaciones**
> del resumen. El puntaje usa únicamente categoría + vía + franja.

### Reglas de recomendación (RF-05) implementadas en `resumen.js`
Se evalúan por prioridad y cada recomendación muestra la regla que la produjo:

| Regla | Condición | Recomendación |
| :---- | :-------- | :------------ |
| R1 | ≥ 3 reportes **Alto** en **hora pico** | Patrullaje prioritario en hora pico |
| R2 | Predomina **invasión de andén** | Operativo de espacio público |
| R3 | Predomina **vehículo de carga** | Revisar horario de cargue y descargue |
| R0 | Ninguna anterior | Monitoreo regular (por defecto) |

### Pendientes / handoff a otros roles
- [ ] **Analista de campo:** entregar los datos **reales** de campo. Por ahora
      `reportes.json` (30) y `vias.json` (8) tienen datos **de prueba sintéticos**
      (ver entrada del 2026-11-23 abajo); se deben reemplazar por los reales. La
      cuadra de cada reporte debe existir como `id` en `vias.json`.
- [ ] **Integrador de mapa:** `js/mapa.json` tiene extensión equivocada; debería
      ser `js/mapa.js`. La capa de calor debe ponderar la intensidad por
      `reporte.criticidad.puntaje`.
- [ ] **Diseñador de interfaz:** en `index.html`, cargar los scripts en este
      orden para que las dependencias existan:
      `criticidad.js` → `filtros.js` → `resumen.js` → `captura.js` → `mapa.js`.
- [ ] Instalar **Node.js** para poder correr las pruebas automáticas de la lógica
      (los archivos ya exportan sus funciones).

---

## 🗓️ 2026-11-23 — Datos de PRUEBA (sintéticos) para validar la lógica

**Autor:** Ingeniero de Lógica y Clasificación · (apoyo IA: Claude)

> ⚠️ **IMPORTANTE:** los datos actuales de `datos/vias.json` (8 cuadras) y
> `datos/reportes.json` (30 registros) son **sintéticos, solo para probar la
> lógica**. Están **ubicados alrededor de la Universidad del Magdalena** (Cra 32 /
> Av. del Ferrocarril, sector San Pedro Alejandrino, ≈ 11.226, -74.187). Deben
> reemplazarse por los **datos reales de campo** que entregue el **Analista de
> Campo**. El motor ya está listo; al cambiar los datos no hay que tocar el código.

### Cómo están diseñados
Los 30 reportes de prueba están armados para que se **dispare cada regla** de
recomendación y se vea un Top 5 claro. Puntajes calculados a mano con
`criterios.json`. Resultado esperado del resumen operativo (Top 5):

| # | Cuadra | Puntaje acumulado | Regla que aplica | Recomendación |
| :- | :----- | :---------------- | :--------------- | :------------ |
| 1 | CR32-C22-C23 — Entrada Unimagdalena (arterial) | **42** | R1 (4 Alto en hora pico) | Patrullaje prioritario en hora pico |
| 2 | CR33-C21-C22 — Los Alcázares (secundaria) | **27** | R2 (predomina invasión de andén) | Operativo de espacio público |
| 3 | AVLIB-C23-C24 — Av. del Libertador (arterial) | **25** | R3 (predomina vehículo de carga) | Revisar horario de cargue y descargue |
| 4 | CR32-C21-C22 — Av. del Ferrocarril (arterial) | **24** | R0 | Monitoreo regular |
| 5 | CR32-C23-C24 — Av. del Ferrocarril (arterial) | **24** | R0 | Monitoreo regular |

> Otras cuadras fuera del Top 5: AVLIB-C24-C25 (24, R0), C22-CR30-CR31 (22, R2),
> C22-CR31-CR32 (20, R0).

### Cómo reemplazar por los datos reales
1. Pedir al Analista el `vias.json` real (6–10 cuadras clasificadas) y el
   `reportes.json` real (30 registros de dos recorridos).
2. Verificar que **cada `cuadra` de un reporte exista como `id` en `vias.json`**
   (si no, el componente de vía suma 0).
3. Reemplazar ambos archivos. No se toca `criticidad.js`, `filtros.js` ni
   `resumen.js`.

### Pruebas rápidas sugeridas (para la sustentación)
- **RF-02:** recalcular a mano MP-001 (`3+1+1=5/Medio`) y MP-007
  (`3+2+1=6/Alto`, arterial en hora pico) y comparar con el sistema.
- **RF-04:** filtrar `categoria=invasion_anden` + `franja=valle` y contar a mano.
- **RF-05:** subir en `criterios.json` el peso de `invasion_anden` de 2 a 4 y
  mostrar cómo CR33-C21-C22 (Los Alcázares) sube en el ranking (demuestra que las
  reglas viven en el JSON, no en el código).

---

## 🗓️ 2026-11-24 — Arreglo del mapa de calor en modo OFFLINE

**Autor:** apoyo al Integrador de Mapa · (apoyo IA: Claude) · archivo: `js/mapa.js`

### Síntoma
En modo offline el mapa de calor aparecía en **ubicaciones distintas** a las del
mapa en línea.

### Causa
El modo offline usa el PNG `datos/mapa-offline.png` como `L.imageOverlay`. Leaflet
**estira** ese PNG para llenar el rectángulo `LIMITES_MAPA_OFFLINE`. Esos límites
estaban puestos "a ojo" y **no correspondían** al área real de la imagen; además,
el PNG viejo **ni siquiera cubría** todos los reportes (los del este, sobre la Av.
del Libertador, y los del norte quedaban fuera). Como el mapa de calor usa
`lat/lng` reales, al no coincidir los límites con la imagen, los puntos caían
corridos.

> ❌ No se deben "convertir" las coordenadas de cada punto (eso dañaría el online).
> La solución correcta es **georreferenciar bien la imagen**.

### Solución
Se **regeneró** `datos/mapa-offline.png` como un **mosaico de teselas
OpenStreetMap (zoom 16)** que cubre toda la zona de estudio (30 teselas →
1536×1280 px). Como son teselas Web Mercator completas, sus límites geográficos
son **exactos** y coinciden pixel a pixel con la imagen:

```js
const LIMITES_MAPA_OFFLINE = [
  [11.216122, -74.201660], // SW
  [11.243062, -74.168701]  // NE
];
```

Verificación: se proyectaron varios reportes a píxeles del nuevo PNG y caen justo
sobre sus calles (U. del Magdalena al centro, Av. del Ferrocarril al oeste, Av.
del Libertador al este). Offline y online ahora coinciden.

> 📝 Atribución: el PNG proviene de **© OpenStreetMap contributors** (ODbL). El
> control de atribución del mapa ya lo muestra; conviene conservarlo.
> Nota de rol: `js/mapa.js` es del **Integrador de Mapa** — coordinar el cambio.

---

## 🧪 Bitácora de iteración (fallos de la IA) — mínimo 2

> Plantilla a completar durante el desarrollo. El enunciado pide documentar al
> menos **dos fallos reales** de la IA con estos 5 datos y anexar las capturas.

### Fallo #1 — _(título corto)_
- **Lo que se pidió:** …
- **Lo que entregó:** … (captura / fragmento)
- **Cómo lo notaron:** …
- **Cómo lo corrigieron:** …
- **Instrucción final:** …

### Fallo #2 — _(título corto)_
- **Lo que se pidió:** …
- **Lo que entregó:** … (captura / fragmento)
- **Cómo lo notaron:** …
- **Cómo lo corrigieron:** …
- **Instrucción final:** …

---

## 🤖 Declaración de uso de IA (parte de lógica)
Para el diseño del motor de criticidad, los filtros y las reglas de recomendación
se usó **Claude** como apoyo para estructurar las funciones y comentar el código.
El entendimiento de las reglas, los pesos y su justificación es del equipo.
