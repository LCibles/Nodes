# Desarrollo

## Organización

La interfaz se sirve desde `dist/`. Los analizadores de HTML y CSS se empaquetan desde `src/code-map.mjs`. Instala las dependencias con `pnpm install --frozen-lockfile` y genera ese paquete con `node scripts/build-code-map.mjs` antes de iniciar la vista local.

- `index.html`: estructura del tablero, botones, panel de propiedades, ayuda e iconos SVG embebidos.
- `style.css`: tipografía, paleta, cuadrícula, nodos, herramientas y reglas para pantallas estrechas.
- `app.js`: estado de nodos y conexiones, selección, modos de interacción, arrastre, zoom, edición, historial y guardado.
- `scripts/serve.cjs`: adaptación del servidor temporal de vista previa utilizado al crear el proyecto; ahora reside dentro del repositorio y sirve `dist/` desde cualquier directorio de trabajo.

## Modelo del tablero

Cada nodo tiene `id`, `label`, `x`, `y` y `color`. Cada conexión tiene `id`, `from` y `to`. La vista contiene `x`, `y` y `zoom`.

Las posiciones están en coordenadas del lienzo. La transformación de `#world` aplica desplazamiento y escala; las conexiones se dibujan con curvas SVG. El índice `color` referencia la paleta definida en `app.js`.

El archivo exportado contiene `version`, `nodes`, `edges` y `view`. El almacenamiento local contiene `nodes`, `edges` y `view`. Al arrancar, se recuperan datos válidos o se muestran tres nodos de ejemplo.

## Comandos

```sh
node scripts/serve.cjs
node --check dist/app.js
node --check scripts/serve.cjs
```

También se incluyen los alias `npm start`, `npm run dev` y `npm run check` para instalaciones que tengan npm. La comprobación revisa la sintaxis JavaScript; no sustituye las pruebas de interacción. El puerto predeterminado es 4173. Para cambiarlo en PowerShell:

```powershell
$env:PORT = '4174'
node scripts/serve.cjs
```

El servidor escucha únicamente en `127.0.0.1` y está destinado al desarrollo local.

## Comprobación manual

1. Crear un nodo, cambiar nombre y color, y moverlo.
2. Conectar dos nodos y verificar que la curva acompaña el movimiento.
3. Duplicar y eliminar un nodo; comprobar deshacer y la eliminación de sus conexiones.
4. Probar desplazamiento, zoom, ajuste de vista y los atajos.
5. Recargar y verificar la recuperación del tablero.
6. Exportar JSON y comprobar sus nodos y conexiones.
7. Revisar la distribución con un panel estrecho y una pantalla amplia.

Durante la creación inicial se comprobó la sintaxis con Node.js y se verificaron creación, edición de nombre, conexión, persistencia al recargar y distribución adaptable en el navegador de Codex.

## Herramientas utilizadas

- Codex para implementar y editar el proyecto.
- Git para versionar el código.
- Node.js para el servidor de vista previa y las comprobaciones de sintaxis.
- Navegador integrado de Codex para revisar la interfaz y las interacciones.
- Sites para alojar y publicar la versión inicial privada.

Los auxiliares de publicación de Sites pertenecen a ese plugin y se ejecutan fuera de este repositorio. No son dependencias necesarias para desarrollar ni servir esta aplicación. El repositorio no incluye credenciales, cachés ni archivos temporales de esas herramientas.
