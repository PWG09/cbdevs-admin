# CBDEVS — Internal Admin Dashboard

Dashboard privado de operación para CBDEVS.

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- Firebase Auth
- Firestore
- Realtime chat con `onSnapshot`
- Recharts
- API Route de Next.js + Firebase Admin para crear usuarios desde el panel

## 1. Instalar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

## 2. Firebase

Puedes reutilizar tu proyecto existente `cbdev-a74dc`.

En Firebase Console:

1. Authentication → Sign-in method → habilita Email/Password.
2. Crea manualmente el primer usuario admin.
3. Firestore Database → crea la base de datos.
4. Copia la configuración de la Web App a `.env.local`.
5. Publica `firestore.rules`.

### Crear el primer admin

Crea el usuario en Authentication y después crea manualmente:

`users/{UID}`

con:

```json
{
  "name": "Carlos Wiebe",
  "email": "TU_CORREO",
  "role": "admin",
  "active": true
}
```

El UID debe ser exactamente el UID del usuario en Firebase Authentication.

## 3. Crear usuarios desde el dashboard

La pantalla Equipo usa `/api/admin/create-user`.

El servidor necesita las variables `FIREBASE_ADMIN_*` de `.env.local`.

Para obtenerlas:

Firebase Console → Project Settings → Service accounts → Generate new private key.

No subas ese JSON ni la private key a GitHub.

## 4. Seed de proyectos

Opcional:

```bash
npm run seed
```

El seed necesita las mismas variables Admin.

## 5. Seguridad

`firestore.rules`:

- admin: acceso global y gestión de usuarios.
- empleado: proyectos, chat y su propio perfil.
- ningún cliente puede crear usuarios Auth directamente desde Firestore.
- la creación de usuarios se hace con Firebase Admin en servidor.

## 6. Estructura

```text
app/
  (protected)/
    dashboard/
    projects/
    chat/
    team/
    settings/
  api/admin/create-user/
  login/
components/
lib/
scripts/
firestore.rules
```

## 7. Producción

### Vercel

Configura todas las variables de `.env.local` en Project Settings → Environment Variables y despliega.

### Firebase Hosting

El frontend Next.js requiere configurar el hosting/framework de Next.js o usar una plataforma compatible con Next.js. Para este proyecto, Vercel es la opción más sencilla.

## Importante

El modo inicial del dashboard tiene datos mock en `lib/mock-data.ts`, por lo que la interfaz puede visualizarse antes de llenar Firestore.

Cuando existen documentos reales en `projects`, `users` o `messages`, las vistas usan Firestore en tiempo real.

## Siguientes mejoras recomendadas

- canales por proyecto
- mensajes directos 1 a 1
- presencia online
- notificaciones de mensajes no leídos
- subcolección `payments` con historial real
- auditoría de cambios de proyectos
- drag-and-drop con persistencia de orden
- Storage para avatares y documentos
