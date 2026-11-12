# Publicación

## Archivos publicados

Este proyecto sirve `dist/` como sitio estático. Los archivos de ese directorio son código fuente y se mantienen en Git. No se necesita una compilación.

Puede alojarse en cualquier servicio que permita servir HTML, CSS y JavaScript estáticos. Configura `dist/` como directorio de publicación.

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
4. Sincronizar el código y empaquetar `dist/` junto con `.openai/hosting.json`, usando los auxiliares del plugin.
5. Guardar y desplegar esa versión mediante la operación privada correspondiente.
6. Verificar que el despliegue haya terminado correctamente.

Las credenciales de Sites se obtienen en cada sesión y no deben guardarse en archivos ni en Git. El repositorio de GitHub conserva el proyecto para desarrollo; subir cambios a GitHub por sí solo no actualiza la web publicada. No se ha configurado GitHub Actions ni despliegue automático desde GitHub.
