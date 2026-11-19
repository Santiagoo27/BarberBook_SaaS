# BarberBook SaaS

**Multi-tenant** appointment scheduling platform for barbershops. Each barbershop runs as an isolated tenant identified by its subdomain: a single API deployment serves many barbershops without mixing their data.

*Versión en español: [README.es.md](README.es.md)*

## Features

- **Online booking** — public page `/book/{subdomain}` where customers pick a service, a barber and an available time slot, with overlap validation.
- **Admin dashboard** — manage barbers and schedules, services, appointments, reviews, locations and metrics (including a weekly revenue chart).
- **Barber dashboard** — today's appointments, complete/cancel actions and walk-in customer registration.
- **SuperAdmin dashboard** — onboard and manage barbershops, plans and billing cycles.
- **Per-shop branding** — custom themes, colors and logo.
- **Loyalty program** — points accumulated per customer.
- **QR reviews** — public star-rating page.
- **WhatsApp Business (Meta Cloud API)** — reminders with buttons to cancel or reschedule.
- **AI style diagnosis** (Google Gemini) — a Premium plan feature.
- **Interactive demo** at `/demo`, with mock data and no server required.

## Stack

| Layer | Technologies |
|-------|--------------|
| Backend | .NET 10, ASP.NET Core, Entity Framework Core |
| Database | SQLite (development) · PostgreSQL / Supabase (production) |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Axios, Recharts |
| Authentication | JWT Bearer + refresh tokens, BCrypt password hashing |
| Tests | xUnit + `WebApplicationFactory` |

## Architecture

```
BarberBookSaaS.Domain/          Entities and constants
BarberBookSaaS.Application/     Service interfaces and DTOs
BarberBookSaaS.Infrastructure/  EF Core, services and external integrations
BarberBookSaaS.WebApi/          REST API (controllers and middleware)
BarberBookSaaS.Web/             React frontend
BarberBookSaaS.Tests/           Integration tests
```

Tenant isolation works in three layers:

1. `TenantMiddleware` resolves the tenant from the `X-Tenant-Id` header or the JWT `TenantId` claim.
2. Global EF Core query filters automatically scope every query to the tenant.
3. An interceptor assigns the `TenantId` to new entities before saving.

## Local setup

**Requirements:** .NET 10 SDK and Node.js 20 or later.

### 1. Configure the backend

Copy the example file and fill in your values. This file is in `.gitignore` and is never committed:

```bash
cp BarberBookSaaS.WebApi/appsettings.Development.example.json BarberBookSaaS.WebApi/appsettings.Development.json
```

Minimum development configuration:

- `Jwt:Key` — a long random string (for example `openssl rand -base64 48`).
- `SuperAdmin:Email` and `SuperAdmin:Password` — the SuperAdmin account is created with these on first start.
- Leave `ConnectionStrings:DefaultConnection` empty to use local SQLite (`barberbook.db`).

Integrations (Gmail, Gemini, Meta WhatsApp) are optional in development.

### 2. Run

```bash
# Backend — http://localhost:5299  (Swagger at /swagger)
cd BarberBookSaaS.WebApi
dotnet run

# Frontend — http://localhost:5173
cd BarberBookSaaS.Web
npm install
npm run dev
```

The frontend points to `http://localhost:5299` by default. To use another URL, set `VITE_API_URL`.

### 3. Tests

```bash
dotnet test BarberBookSaaS.slnx
```

## Documentation

The documents below are written in Spanish.

| Document | Contents |
|----------|----------|
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Endpoints, request bodies and responses |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/PRODUCCION.md`](docs/PRODUCCION.md) | Deployment (Railway + Vercel + Supabase) and environment variables |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Security measures |
| [`docs/DECISIONES_DISENO.md`](docs/DECISIONES_DISENO.md) | Architecture and UI decisions |
| [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md) | Migrations and data model |
| [`docs/HISTORIAL.md`](docs/HISTORIAL.md) | Project phase history |

## Authors

- Santiago Felipe Obando Rosero
- Juan Pablo Lopez Rodriguez
