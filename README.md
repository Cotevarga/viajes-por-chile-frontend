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

El proxy de `vite.config.js` solo aplica al servidor de desarrollo. El backend debe permitir el origen del frontend en su configuración CORS.

## Pruebas

```powershell
npm test -- --run
npm run coverage
```
