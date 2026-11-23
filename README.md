# 🚦 Control de Mal Parqueo e Invasión del Espacio Público - Santa Marta

> **Universidad del Magdalena** | Facultad de Ingeniería — Programa de Ingeniería de Sistemas  
> **Asignatura:** Introducción a la Ingeniería de Sistemas (2026-2)  
> **Docente:** Aquiles Cohen  
> **Equipo:** `5`

---

## 📋 Descripción del Proyecto

Prototipo de aplicación web *mobile-first* diseñada para registrar incidentes de mal parqueo e invasión de andenes en zonas críticas de Santa Marta (Centro Histórico / Av. Campo Serrano / Mercado Público / El Rodadero). 

El sistema calcula automáticamente un **índice de criticidad** basado en reglas explícitas y visualiza la reincidencia mediante un **mapa de calor** y un **resumen operativo**, permitiendo a los supervisores de movilidad priorizar dónde intervenir.

### 🔗 Enlaces del Proyecto
* **Prototipo en vivo (GitHub Pages):** `https://github.com/cdbg2904-cmd/proyecto-intro-grupo5/tree/main`
* **Video de contingencia (Demostración):** `[Enlace a Google Drive / YouTube]`

---

## 👥 Integrantes y Roles

| Integrante | Usuario GitHub | Rol en el Equipo | Responsabilidad Principal |
| :--- | :--- | :--- | :--- |
| `[Nombre Integrante 1]` | `[@usuario1]` | Analista de Campo y Privacidad | Clasificación de cuadras, levantamiento de 30 registros y anonimización de fotos (`vias.json`, `reportes.json`). |
| `[Nombre Integrante 2]` | `[@usuario2]` | Ingeniero de Lógica y Clasificación | Reglas del índice de criticidad, filtros y recomendaciones (`criterios.json`, `criticidad.js`, `filtros.js`, `resumen.js`). |
| `[Nombre Integrante 3]` | `[@usuario3]` | Integrador de Mapa e IA | Mapa base, capa de calor (`Leaflet.heat`), marcadores y control de *prompts* (`mapa.js`). |
| `[Nombre Integrante 4]` | `[@usuario4]` | Diseñador de Interfaz y Documentador | Formulario móvil (< 30s), compresión de fotos, tablero y documentación (`index.html`, `captura.js`). |

---

## ⚙️ Funcionalidades Principales

* **Captura Rápida (< 30 segundos):** Registro georreferenciado desde el celular (GPS o selección manual en mapa) con compresión automática de imagen a máximo `800px` de ancho.
* **Cálculo Automático de Criticidad:** Evaluación transparente basada en tres variables (`categoría`, `tipo de vía` y `franja horaria`) parametrizadas en `datos/criterios.json`, clasificando cada reporte en **Bajo**, **Medio** o **Alto**.
* **Mapa de Calor e Individual:** Visualización geoespacial con *OpenStreetMap* y `Leaflet.heat` ponderada por criticidad, con opción para alternar hacia puntos individuales con evidencia fotográfica anonimizada.
* **Filtros Dinámicos:** Filtrado en tiempo real sin recargar la página por sector/cuadra, franja horaria (pico/valle), categoría de obstrucción y actor vial.
* **Resumen Operativo Imprimible:** Ranking automático del **Top 5 de cuadras más críticas** con recomendaciones accionables generadas por reglas explícitas.
* **Portabilidad de Datos (Offline/Multi-dispositivo):** Exportación e importación de reportes en formato `.json` desde `localStorage`, evitando duplicados mediante validación de `id`.

---

## 📂 Estructura del Repositorio

```text
├── index.html                  # Interfaz principal (vista de captura móvil y tablero de análisis)
├── captura.js                  # Lógica de geolocalización, validación y compresión de imágenes
├── criticidad.js               # Motor de cálculo de puntaje y nivel de criticidad
├── filtros.js                  # Lógica de filtrado combinable sobre los registros
├── resumen.js                  # Agrupación por cuadra, Top 5 y motor de reglas de recomendación
├── mapa.js                     # Inicialización de Leaflet, capa de calor y marcadores
├── datos/
│   ├── reportes.json           # Base de datos precargada (30 registros reales de campo)
│   ├── vias.json               # Catálogo de cuadras evaluadas y su clasificación (arterial/secundaria)
│   ├── criterios.json          # Pesos, rangos de criticidad y definición de horas pico
│   └── fotos/                  # Evidencia fotográfica anonimizada (sin placas ni rostros)
├── documentos/
│   ├── anexo_campo.pdf         # Mapa del recorrido, tabla de registros y muestra fotográfica (1 pág.)
│   ├── arquitectura.pdf        # Diagrama de arquitectura real implementado por el equipo (1 pág.)
│   └── bitacora.pdf            # Justificación de reglas, hallazgos y fallos de IA documentados (máx. 3 págs.)
└── README.md                   # Documentación general del proyecto
```

---

## 🚀 Instrucciones de Ejecución Local

Dado que la aplicación carga archivos `.json` locales mediante `fetch()`, los navegadores bloquean su apertura directa mediante doble clic (`file://`) por políticas de seguridad (CORS). Para ejecutarlo localmente:

1. Clona este repositorio en tu equipo:
   ```bash
   git clone https://github.com/cdbg2904-cmd/proyecto-intro-grupo5.git
   ```
2. Abre la carpeta del proyecto en **Visual Studio Code**.
3. Instala y ejecuta la extensión **Live Server** (clic derecho sobre `index.html` $\rightarrow$ *"Open with Live Server"*).
4. Alternativamente, puedes iniciar un servidor local con Python desde la terminal en la raíz del proyecto:
   ```bash
   python -m http.server 8000
   ```
   Y abrir `http://localhost:8000` en tu navegador.

---

## 🔒 Privacidad y Cumplimiento Normativo

En cumplimiento con la **Ley 1581 de 2012** (Protección de Datos Personales en Colombia), todas las fotografías incluidas en este repositorio y visualizadas en el prototipo han sido previamente **anonimizadas** (pixelado de rostros y placas vehiculares). El sistema no almacena ni procesa información personal identificable de ciudadanos o conductores.

---

## 🤖 Declaración de Uso de Inteligencia Artificial

Para el desarrollo de este prototipo se utilizaron herramientas de asistencia basadas en IA (`[ChatGPT, Claude, Gemini, GitHub Copilot]`) como apoyo en la generación de estructura HTML/CSS, configuración de la librería `Leaflet.heat` y depuración de funciones en JavaScript. El proceso de iteración, los errores detectados y sus respectivas correcciones se encuentran documentados en `documentos/bitacora.pdf`.
