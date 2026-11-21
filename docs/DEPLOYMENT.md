# Publicación

## Archivos publicados

Los archivos de interfaz en `dist/` se mantienen en Git. La vista local sirve esos archivos directamente y puede consultar repositorios públicos de GitHub.

El despliegue de Sites usa un Worker. Ejecuta `node scripts/build-worker.mjs` para generar `dist/server/index.js` a partir de la interfaz y de `worker/index.mjs`.

## Sitio existente en Sites

- URL: https://nodo-lienzo-migue.milkycarat1.chatgpt.site/
- ID: `appgprj_6af3e37acb3081919d53684829837297`.
- Configuración: `.openai/hosting.json`.
- Audiencia de la publicación inicial: privada.

El identificador de proyecto es una referencia de configuración; no es una credencial. Consérvalo para actualizar el sitio existente. Para desplegar un sitio independiente hay que registrar uno nuevo y usar el identificador que devuelva Sites.

## Flujo de actualización con Sites

1. Editar los archivos y comprobar la sintaxis con `npm run check` o los comandos directos de Node documentados en el README.
2. Revisar la aplicación en la vista previa local.
3. Abrir el sitio existente con las herramientas de Sites y obtener acceso a su repositorio de publicación.
4. Generar el Worker con `node scripts/build-worker.mjs` y empaquetar el resultado usando los auxiliares del plugin.
5. Guardar y desplegar esa versión mediante la operación privada correspondiente.
6. Verificar que el despliegue haya terminado correctamente.

Las credenciales de Sites se obtienen en cada sesión y no deben guardarse en archivos ni en Git. El repositorio de GitHub conserva el proyecto para desarrollo; subir cambios a GitHub por sí solo no actualiza la web publicada. No se ha configurado GitHub Actions ni despliegue automático desde GitHub.

## Repositorios privados de GitHub

Configura `GITHUB_READ_TOKEN` como secreto de Sites. Usa un token de GitHub de alcance limitado a los repositorios que quieres vincular, con permiso **Contents: read**. Configura también `GITHUB_VIEWER_EMAIL` con el correo de la cuenta autorizada en Sites. Mantén el sitio privado. La ruta de lectura valida la identidad de Sites y usa el token exclusivamente del lado del servidor.

Los repositorios públicos se pueden vincular sin configurar estas variables.
