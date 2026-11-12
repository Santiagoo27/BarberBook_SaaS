# BarberBook SaaS

Plataforma **multi-tenant** de agendamiento de citas para barberías. Cada barbería opera como un tenant aislado identificado por su subdominio: un solo despliegue de la API sirve a muchas barberías sin mezclar datos.

## Funcionalidades

- **Reservas en línea** — página pública `/book/{subdominio}` donde el cliente elige servicio, barbero y horario disponible, con validación de choques de horario.
- **Panel de administración** — gestión de barberos y horarios, servicios, citas, reseñas, sedes y métricas (incluida una gráfica de ingresos semanales).
- **Panel del barbero** — citas del día, completar/cancelar y registro de clientes sin cita (walk-in).
- **Panel SuperAdmin** — alta y gestión de barberías, planes y ciclo de facturación.
- **Branding por barbería** — temas, colores y logo propios.
- **Programa de fidelización** — acumulación de puntos por cliente.
- **Reseñas por QR** — página pública de calificación con estrellas.
- **WhatsApp Business (Meta Cloud API)** — recordatorios con botones para cancelar o reprogramar.
- **Diagnóstico de estilo con IA** (Google Gemini) — función del plan Premium.
- **Demo interactiva** en `/demo`, con datos ficticios y sin servidor.

## Stack

| Capa | Tecnologías |
|------|-------------|
| Backend | .NET 10, ASP.NET Core, Entity Framework Core |
| Base de datos | SQLite (desarrollo) · PostgreSQL / Supabase (producción) |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Axios, Recharts |
| Autenticación | JWT Bearer + refresh tokens, contraseñas con BCrypt |
| Tests | xUnit + `WebApplicationFactory` |

## Arquitectura

```
BarberBookSaaS.Domain/          Entidades y constantes
BarberBookSaaS.Application/     Interfaces de servicio y DTOs
BarberBookSaaS.Infrastructure/  EF Core, servicios e integraciones externas
BarberBookSaaS.WebApi/          API REST (controllers y middleware)
BarberBookSaaS.Web/             Frontend React
BarberBookSaaS.Tests/           Tests de integración
```

El aislamiento entre barberías funciona en tres capas:

1. `TenantMiddleware` obtiene el tenant del header `X-Tenant-Id` o del claim `TenantId` del JWT.
2. Los QueryFilters globales de EF Core filtran automáticamente por tenant en todas las consultas.
3. Un interceptor asigna el `TenantId` a las entidades nuevas antes de guardar.

## Puesta en marcha local

**Requisitos:** .NET 10 SDK y Node.js 20 o superior.

### 1. Configurar el backend

Copia el archivo de ejemplo y complétalo con tus valores. Este archivo está en `.gitignore` y nunca se sube al repositorio:

```bash
cp BarberBookSaaS.WebApi/appsettings.Development.example.json BarberBookSaaS.WebApi/appsettings.Development.json
```

Configuración mínima para desarrollo:

- `Jwt:Key` — una cadena aleatoria larga (por ejemplo `openssl rand -base64 48`).
- `SuperAdmin:Email` y `SuperAdmin:Password` — la cuenta SuperAdmin se crea con estos datos al primer arranque.
- Deja `ConnectionStrings:DefaultConnection` vacío para usar SQLite local (`barberbook.db`).

Las integraciones (Gmail, Gemini, Meta WhatsApp) son opcionales en desarrollo.

### 2. Ejecutar

```bash
# Backend — http://localhost:5299  (Swagger en /swagger)
cd BarberBookSaaS.WebApi
dotnet run

# Frontend — http://localhost:5173
cd BarberBookSaaS.Web
npm install
npm run dev
```

El frontend apunta a `http://localhost:5299` por defecto. Para otra URL, define `VITE_API_URL`.

### 3. Tests

```bash
dotnet test BarberBookSaaS.slnx
```

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Endpoints, bodies y respuestas |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/PRODUCCION.md`](docs/PRODUCCION.md) | Despliegue (Railway + Vercel + Supabase) y variables de entorno |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Medidas de seguridad aplicadas |
| [`docs/DECISIONES_DISENO.md`](docs/DECISIONES_DISENO.md) | Decisiones de arquitectura y UI |
| [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md) | Migraciones y modelo de datos |
| [`docs/HISTORIAL.md`](docs/HISTORIAL.md) | Historial de fases del proyecto |

## Autores

- Santiago Felipe Obando Rosero
- Juan Pablo Lopez Rodriguez
