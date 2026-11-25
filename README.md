# Viajes por Chile — Frontend

Interfaz web de Viajes por Chile, desarrollada con React y Vite.

## Requisitos

- Node.js LTS y npm.
- API Spring Boot iniciada en `http://localhost:8080`.

## Instalación y ejecución

Desde esta carpeta (`frontend`):

```powershell
npm install
npm run dev
```

Vite muestra la dirección local; el puerto predeterminado es **5173**:
`http://localhost:5173`

Para una instalación reproducible también puedes ejecutar `npm ci`, que usa el `package-lock.json`.

## Conexión con el backend

En desarrollo, Vite reenvía las solicitudes `/api` a `http://localhost:8080`. La API base usada por el frontend es:

```text
http://localhost:8080/api/v1
```

Para definir explícitamente otra URL, crea `.env.local` en esta carpeta:

```dotenv
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

No agregues `.env.local` ni credenciales al repositorio. Para un despliegue, configura `VITE_API_BASE_URL` con la URL pública de Spring Boot antes de generar el build:

```powershell
npm run build
```

El proxy de `vite.config.js` solo aplica al servidor de desarrollo. El backend debe permitir el origen del frontend en su configuración CORS. Para alojar el sitio en la raíz de un dominio, la ruta base predeterminada es `/`; para GitHub Pages en un subdirectorio, define `VITE_BASE_PATH=/viajes-por-chile-frontend/` antes del build.

## Administración y vendedor

Los reportes y el perfil se organizan por pestañas. El reporte completo exporta seis hojas Excel; la bandeja de mensajes permite filtrar por tipo, estado, fechas y texto y exportar el resultado. Los campos históricos no registrados aparecen como «No disponible».

El panel de vendedor permite emitir ventas simuladas, consultar y anular órdenes o boletos y reprogramar boletos a una salida publicada sin cambiar su precio ni clase. No se realiza ningún cobro ni reembolso real. Requiere el backend actualizado y sus migraciones aplicadas.

## Pruebas

```powershell
npm test -- --run
npm run coverage
```
