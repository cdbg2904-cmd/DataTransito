# Bitácora de iteración: mapa y reporte ciudadano

**Proyecto:** Control vial de Santa Marta · **Equipo:** 5 · **Fecha:** 24 de noviembre de 2026  
**Propósito:** registrar decisiones, hallazgos y correcciones durante la integración del mapa y el formulario ciudadano.

## Decisiones y justificación

- Se construyó una interfaz de prueba con **Leaflet y OpenStreetMap** y una imagen cartográfica para simular el modo sin conexión. El modo en línea conserva la navegación libre; en modo offline se limita el zoom y el desplazamiento para no salir de la imagen. Se centró la vista inicial en la Universidad del Magdalena y se aumentó un nivel el zoom en línea.
- El mapa de calor continúa representando la criticidad de los reportes. En offline se redujeron a la mitad el radio y el difuminado del calor, sin escalar la imagen base ni mover las coordenadas.
- En la vista de puntos se agrupan reportes con coordenadas idénticas y se muestra su cantidad. Al seleccionar un marcador se consultan los registros agrupados. Así se evita superponer marcadores indistinguibles sin alterar la vista de calor.
- Se conservó el cálculo de criticidad existente: categoría, tipo de vía y franja horaria aportan al puntaje; el actor se registra para consulta, pero no suma al puntaje. Los pesos y rangos permanecen configurables en `datos/criterios.json`.
- Se añadió un formulario ciudadano breve con incidente, cuadra, actor y **foto obligatoria**. La imagen se comprime en el navegador (hasta 800 px y 500 KB). El reporte actualiza mapa y resumen y se guarda en `localStorage`; es una prueba local, no un envío a un servidor ni una base compartida.

## Hallazgos y fallos de iteración con IA

- **Verificación inicial insuficiente:** se concluyó que las ubicaciones eran correctas porque los reportes coincidían con `vias.json`. Esa comprobación solo confirmaba consistencia entre dos archivos, no correspondencia con las calles reales. La consulta posterior a OpenStreetMap mostró discrepancias. A solicitud del usuario, se ajustaron los puntos al segmento OSM más cercano; algunos cruces no estaban disponibles y dos cuadras terminaron compartiendo punto. Esas posiciones son aproximadas y requieren validación con datos de campo antes de considerarlas precisas.
- La coincidencia de coordenadas explica por qué se ven menos marcadores que reportes: actualmente pueden agruparse 30 reportes en 7 ubicaciones. Se verificó que los contadores sumen el total y que el popup permita consultar los registros.
- Al alternar la capa de calor se detectó una llamada a `setOptions` mientras la capa estaba desmontada; Leaflet.heat lanzaba un error. Se corrigió el orden de montaje y actualización.
- En GitHub Pages el formulario apareció sin estilos porque el navegador reutilizó una copia anterior de `style.css`. Se verificó que el CSS publicado sí contenía las reglas y se añadió una versión al enlace para invalidar caché; el cambio debe incluirse en el siguiente despliegue. Una recarga forzada (`Ctrl + F5`) también actualiza la copia local del navegador.

## Verificación y limitaciones

Se probaron la carga y actualización de reportes, el modo online/offline, la suma de contadores, el formulario con y sin foto, la compresión y persistencia de evidencia después de recargar, y la presentación responsive. `git diff --check` pasó. La captura offline no incluye necesariamente todas las ubicaciones aproximadas actuales; hace falta una imagen que cubra el área completa y validar las coordenadas con el equipo de campo.
