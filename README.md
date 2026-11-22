# Nodes — Tablero de nodos

Un lienzo para crear ideas como nodos circulares, moverlas y conectarlas.

[Abrir el tablero publicado](https://nodo-lienzo-migue.milkycarat1.chatgpt.site/)

## Ejecutar localmente

Requiere Node.js 22 o posterior y pnpm. El mapa de código se genera con las dependencias fijadas en el proyecto.

```sh
git clone https://github.com/LCibles/Nodes.git
cd Nodes
pnpm install --frozen-lockfile
node scripts/build-code-map.mjs
node scripts/serve.cjs
```

Abre `http://127.0.0.1:4173`. Detén el servidor con `Ctrl+C`. Para comprobar la sintaxis:

```sh
node --check dist/app.js
node --check scripts/serve.cjs
```

Si tu instalación de Node incluye npm, también puedes usar `npm start`, `npm run dev` y `npm run check`.

## Funcionalidades

- Crear nodos con el botón, la tecla `N` o doble clic en el lienzo.
- Arrastrar círculos; editar sus nombres y colores en el panel de propiedades.
- Conectar dos nodos, duplicar o eliminar nodos y eliminar conexiones.
- Desplazar el lienzo, cambiar el zoom y ajustar la vista al tablero.
- Deshacer cambios durante la sesión.
- Guardar el tablero en el navegador y exportarlo a JSON.
- Desplegar la jerarquía de HTML y los grupos de reglas CSS a partir de los nodos de archivo.
- Abrir fragmentos y sus rangos en GitHub. Las líneas moradas unen grupos de CSS con los elementos que coinciden en el HTML que enlaza esa hoja.

## Estructura

```text
Nodes/
├── dist/
│   ├── index.html          # Interfaz e iconos SVG
│   ├── style.css           # Diseño, colores y adaptación de pantalla
│   └── app.js              # Nodos, conexiones, gestos y persistencia
├── scripts/
│   └── serve.cjs           # Servidor local sin dependencias
├── docs/
│   ├── DEVELOPMENT.md      # Arquitectura, herramientas y comprobaciones
│   └── DEPLOYMENT.md       # Publicación estática y configuración de Sites
├── .openai/hosting.json    # Identidad del sitio existente y directorio estático
├── .gitignore
└── package.json
```

`dist/` contiene el código fuente editable y los archivos que se sirven directamente; no es un resultado generado por una compilación.

## Atajos

| Tecla | Acción |
| --- | --- |
| `N` | Agregar nodo |
| `V` | Seleccionar y mover nodos |
| `H` | Mover el lienzo |
| `C` | Conectar: seleccionar origen y destino |
| `Supr` / `Backspace` | Eliminar la selección |
| `Ctrl+Z` / `Cmd+Z` | Deshacer |
| `Esc` | Cancelar conexión o cerrar selección |
| `?` | Mostrar ayuda |
| `Ctrl` / `Cmd` + rueda | Cambiar zoom |

## Datos y alcance

Los cambios se guardan en `localStorage` con la clave `nodo-board-v1`, por navegador y por origen. El sitio publicado y la vista local tienen tableros independientes. No hay base de datos, sincronización entre dispositivos ni colaboración simultánea. El historial de deshacer no sobrevive a una recarga.

La exportación descarga `mi-tablero.nodo.json` con nodos, conexiones y posición de la vista. Esta primera versión todavía no tiene importación de archivos.

## Tecnologías

HTML, CSS, JavaScript del navegador y SVG, sin framework. El servidor de desarrollo utiliza módulos integrados de Node.js. Las fuentes DM Sans y Manrope se solicitan a Google Fonts; hay fuentes alternativas si no están disponibles. Los círculos y los iconos están definidos en el código, sin imágenes generadas ni bibliotecas de iconos externas.

Consulta [desarrollo](docs/DEVELOPMENT.md) y [publicación](docs/DEPLOYMENT.md) para continuar el proyecto.
