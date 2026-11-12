# Plan de Implementación: Sistema de Theming y Branding por Tenant

**Fecha:** 2026-05-26  
**Diseño aprobado en:** `docs/superpowers/specs/2026-05-26-theming-branding-design.md`  
**Estado:** Fase A ✅ completa (2026-05-26) — Fase B ⏳ pendiente

## Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase A** | Backend: campos en `Tenant`, DTOs, `IBrandingService`, `BrandingService`, `BrandingController`, migración `AgregarBrandingTenant` | ✅ Completa |
| **Fase B** | Frontend: `react-colorful`, `framer-motion`, `ThemeContext`, `BrandingPage`, CSS Variables, animaciones, ruta `/branding` | ⏳ Pendiente |

> **Nota para la próxima sesión:** La Fase 6 (backend robusto) tiene su propio spec aprobado en
> `docs/superpowers/specs/2026-05-26-backend-robustness-design.md`. Antes de implementar Fase B,
> verificar con el equipo si se prioriza Fase 6 primero o Fase 5B primero.

---

## Contexto y objetivo

Cada barbería (tenant) podrá personalizar su panel admin eligiendo:
1. Un **tema base** (Dark Premium / AntiGravity Glass / Light Modern)
2. Un **color primario** (botones, acciones principales)
3. Un **color secundario** (badges, estados, links)
4. Su **logo** en PNG

Los cambios se guardan en la base de datos y se aplican en tiempo real mediante CSS Variables inyectadas por un `ThemeContext` de React. El sistema está diseñado para que la futura página pública de agendamiento también consuma estos colores sin autenticación.

---

## Fase A — Backend: Campos, Migración y Endpoints

### A1. Agregar campos de branding a la entidad `Tenant`

**Archivo:** `BarberBookSaaS.Domain/Entities/Tenant.cs`

Agregar las siguientes propiedades a la clase `Tenant`:

```csharp
public string Theme { get; set; } = "dark-premium";
public string PrimaryColor { get; set; } = "#D4AF37";
public string SecondaryColor { get; set; } = "#6366F1";
public string? LogoBase64 { get; set; }
```

Los valores por defecto garantizan que cualquier tenant nuevo tenga el tema Dark Premium con dorado y violeta desde el primer login.

---

### A2. Crear los DTOs de branding

**Archivo nuevo:** `BarberBookSaaS.Application/DTOs/Branding/TenantBrandingDto.cs`

```csharp
namespace BarberBookSaaS.Application.DTOs.Branding;

public class TenantBrandingDto
{
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
}
```

**Archivo nuevo:** `BarberBookSaaS.Application/DTOs/Branding/UpdateBrandingDto.cs`

```csharp
namespace BarberBookSaaS.Application.DTOs.Branding;

public class UpdateBrandingDto
{
    public string Theme { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string SecondaryColor { get; set; } = string.Empty;
}
```

---

### A3. Crear la interfaz del servicio de branding

**Archivo nuevo:** `BarberBookSaaS.Application/Common/IBrandingService.cs`

```csharp
using BarberBookSaaS.Application.DTOs.Branding;

namespace BarberBookSaaS.Application.Common;

public interface IBrandingService
{
    Task<TenantBrandingDto?> GetBrandingAsync();
    Task<bool> UpdateBrandingAsync(UpdateBrandingDto dto);
    Task<bool> UpdateLogoAsync(string base64Logo);
    Task<TenantBrandingDto?> GetPublicBrandingAsync(string subdomain);
}
```

---

### A4. Implementar el servicio de branding

**Archivo nuevo:** `BarberBookSaaS.Infrastructure/Services/BrandingService.cs`

```csharp
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Branding;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.Infrastructure.Services;

public class BrandingService : IBrandingService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public BrandingService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    // GET /api/tenant/branding — devuelve branding del tenant activo
    public async Task<TenantBrandingDto?> GetBrandingAsync()
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return null;

        return new TenantBrandingDto
        {
            Theme = tenant.Theme,
            PrimaryColor = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64 = tenant.LogoBase64
        };
    }

    // PUT /api/tenant/branding — actualiza tema y colores
    public async Task<bool> UpdateBrandingAsync(UpdateBrandingDto dto)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.Theme = dto.Theme;
        tenant.PrimaryColor = dto.PrimaryColor;
        tenant.SecondaryColor = dto.SecondaryColor;

        await _context.SaveChangesAsync();
        return true;
    }

    // POST /api/tenant/logo — guarda logo en base64
    public async Task<bool> UpdateLogoAsync(string base64Logo)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.LogoBase64 = base64Logo;
        await _context.SaveChangesAsync();
        return true;
    }

    // GET /api/public/{subdomain}/branding — sin JWT, para la página pública del cliente
    public async Task<TenantBrandingDto?> GetPublicBrandingAsync(string subdomain)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == subdomain);

        if (tenant is null) return null;

        return new TenantBrandingDto
        {
            Theme = tenant.Theme,
            PrimaryColor = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64 = tenant.LogoBase64
        };
    }
}
```

---

### A5. Registrar el servicio en Program.cs

**Archivo:** `BarberBookSaaS.WebApi/Program.cs`

Agregar junto a los otros `AddScoped`:

```csharp
builder.Services.AddScoped<IBrandingService, BrandingService>();
```

---

### A6. Crear el controlador de branding

**Archivo nuevo:** `BarberBookSaaS.WebApi/Controllers/BrandingController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Branding;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api")]
public class BrandingController : ControllerBase
{
    private readonly IBrandingService _brandingService;

    public BrandingController(IBrandingService brandingService)
    {
        _brandingService = brandingService;
    }

    // GET /api/tenant/branding — requiere JWT
    [HttpGet("tenant/branding")]
    [Authorize]
    public async Task<IActionResult> GetBranding()
    {
        var branding = await _brandingService.GetBrandingAsync();
        if (branding is null) return NotFound();
        return Ok(branding);
    }

    // PUT /api/tenant/branding — requiere JWT Admin
    [HttpPut("tenant/branding")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateBranding([FromBody] UpdateBrandingDto dto)
    {
        var success = await _brandingService.UpdateBrandingAsync(dto);
        if (!success) return NotFound();
        return NoContent();
    }

    // POST /api/tenant/logo — recibe PNG como multipart/form-data
    [HttpPost("tenant/logo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UploadLogo(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No se recibió ningún archivo.");

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest("El logo no puede superar los 2MB.");

        if (!file.ContentType.StartsWith("image/"))
            return BadRequest("Solo se aceptan imágenes.");

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var base64 = $"data:{file.ContentType};base64,{Convert.ToBase64String(memoryStream.ToArray())}";

        var success = await _brandingService.UpdateLogoAsync(base64);
        if (!success) return NotFound();

        return Ok(new { logoBase64 = base64 });
    }

    // GET /api/public/{subdomain}/branding — sin JWT, para la página pública del cliente
    [HttpGet("public/{subdomain}/branding")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicBranding(string subdomain)
    {
        var branding = await _brandingService.GetPublicBrandingAsync(subdomain);
        if (branding is null) return NotFound();
        return Ok(branding);
    }
}
```

---

### A7. Crear la migración de base de datos

Ejecutar en terminal desde la raíz del proyecto:

```bash
cd BarberBookSaaS.Infrastructure
dotnet ef migrations add AgregarBrandingTenant --startup-project ../BarberBookSaaS.WebApi
dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
```

Verificar que la migración agrega correctamente las columnas `Theme`, `PrimaryColor`, `SecondaryColor` y `LogoBase64` a la tabla `Tenants`.

---

### A8. Verificación del backend

```bash
cd BarberBookSaaS.WebApi
dotnet build   # Debe compilar con 0 errores y 0 advertencias
dotnet run     # API en http://localhost:5299
```

Probar en Swagger (`http://localhost:5299/swagger`):
1. Login con un admin → obtener el JWT
2. `GET /api/tenant/branding` → debe retornar los valores por defecto
3. `PUT /api/tenant/branding` → cambiar tema y colores
4. `GET /api/public/juanpablo/branding` → debe retornar branding sin JWT

---

## Fase B — Frontend: Dependencias e Infraestructura

### B1. Instalar dependencias nuevas

```bash
cd BarberBookSaaS.Web
npm install react-colorful framer-motion
```

- **`react-colorful`**: color picker ligero (2.5kb gzip). Se usa para los sliders de color primario y secundario.
- **`framer-motion`**: librería de animaciones. Se usa para transiciones de página, stagger de cards y feedback de botones.

---

### B2. Crear los tipos de branding

**Archivo nuevo:** `src/features/branding/brandingTypes.ts`

```typescript
export interface TenantBrandingDto {
  theme: 'dark-premium' | 'antigravity' | 'light-modern';
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
}

export interface UpdateBrandingDto {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
}

export const THEME_DEFAULTS = {
  'dark-premium': {
    '--color-bg': '#0f0f0f',
    '--color-sidebar': '#111111',
    '--color-surface': '#161616',
    '--color-border': '#222222',
    '--color-text': '#FFFFFF',
    '--color-text-muted': '#555555',
  },
  'antigravity': {
    '--color-bg': '#0d0d1a',
    '--color-sidebar': '#0d0d1a',
    '--color-surface': 'rgba(255,255,255,0.04)',
    '--color-border': 'rgba(255,255,255,0.08)',
    '--color-text': '#F0E6FF',
    '--color-text-muted': '#6B7280',
  },
  'light-modern': {
    '--color-bg': '#F8FAFC',
    '--color-sidebar': '#FFFFFF',
    '--color-surface': '#FFFFFF',
    '--color-border': '#E2E8F0',
    '--color-text': '#1E293B',
    '--color-text-muted': '#64748B',
  },
} as const;
```

---

### B3. Crear el servicio de branding

**Archivo nuevo:** `src/features/branding/brandingService.ts`

```typescript
import apiClient from '../../api/apiClient';
import type { TenantBrandingDto, UpdateBrandingDto } from './brandingTypes';

export const brandingService = {
  getBranding: async (): Promise<TenantBrandingDto> => {
    const res = await apiClient.get<TenantBrandingDto>('/tenant/branding');
    return res.data;
  },

  updateBranding: async (dto: UpdateBrandingDto): Promise<void> => {
    await apiClient.put('/tenant/branding', dto);
  },

  uploadLogo: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ logoBase64: string }>('/tenant/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.logoBase64;
  },
};
```

---

### B4. Crear el ThemeContext

**Archivo nuevo:** `src/context/ThemeContext.tsx`

Este es el núcleo del sistema. Lee el branding al hacer login y aplica las CSS Variables al documento.

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TenantBrandingDto } from '../features/branding/brandingTypes';
import { THEME_DEFAULTS } from '../features/branding/brandingTypes';
import { brandingService } from '../features/branding/brandingService';

interface ThemeContextValue {
  branding: TenantBrandingDto;
  setBranding: (b: TenantBrandingDto) => void;
  loadBranding: () => Promise<void>;
}

const DEFAULT_BRANDING: TenantBrandingDto = {
  theme: 'dark-premium',
  primaryColor: '#D4AF37',
  secondaryColor: '#6366F1',
};

const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue);

// Aplica todas las CSS Variables al :root del documento
function applyTheme(branding: TenantBrandingDto) {
  const root = document.documentElement;
  const themeVars = THEME_DEFAULTS[branding.theme] ?? THEME_DEFAULTS['dark-premium'];

  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-secondary', branding.secondaryColor);

  Object.entries(themeVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializa desde localStorage para evitar flash de colores por defecto
  const [branding, setBrandingState] = useState<TenantBrandingDto>(() => {
    const saved = localStorage.getItem('barber_branding');
    const initial = saved ? JSON.parse(saved) : DEFAULT_BRANDING;
    applyTheme(initial);
    return initial;
  });

  const setBranding = useCallback((b: TenantBrandingDto) => {
    setBrandingState(b);
    applyTheme(b);
    localStorage.setItem('barber_branding', JSON.stringify(b));
  }, []);

  const loadBranding = useCallback(async () => {
    try {
      const data = await brandingService.getBranding();
      setBranding(data);
    } catch {
      // Si falla, mantiene el branding del localStorage o el por defecto
    }
  }, [setBranding]);

  return (
    <ThemeContext.Provider value={{ branding, setBranding, loadBranding }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
```

---

### B5. Integrar ThemeProvider y cargar branding al login

**Archivo:** `src/main.tsx`

Envolver la app con `ThemeProvider` (junto a `AuthProvider`):

```tsx
// Agregar ThemeProvider envolviendo la app, dentro de AuthProvider
<AuthProvider>
  <ThemeProvider>
    <App />
  </ThemeProvider>
</AuthProvider>
```

**Archivo:** `src/context/AuthContext.tsx`

En la función `loginGlobal`, después de guardar en localStorage, llamar a `loadBranding()` del ThemeContext:

```typescript
// Después del login exitoso, cargar el branding del tenant
await themeContext.loadBranding();
```

> Nota: para acceder al ThemeContext desde AuthContext sin crear dependencia circular, pasar `loadBranding` como parámetro a `loginGlobal`, o usar un efecto en `App.tsx` que llame a `loadBranding()` cuando el token esté disponible.

---

### B6. Actualizar el Sidebar para mostrar el logo del tenant

**Archivo:** `src/components/Sidebar.tsx`

- Agregar el ítem "Mi Barbería" en el menú (solo visible para `role === 'Admin'`)
- Mostrar el logo del tenant en la parte superior (si `branding.logoBase64` existe, mostrar la imagen; si no, mostrar las iniciales del tenant)
- Reemplazar los colores hardcodeados por CSS Variables

```tsx
// Logo del tenant — reemplaza el texto "BarberBook"
{branding.logoBase64 ? (
  <img src={branding.logoBase64} alt="Logo" className="w-12 h-12 rounded-xl object-contain" />
) : (
  <div style={{ background: 'var(--color-primary)' }} className="w-12 h-12 rounded-xl flex items-center justify-center">
    <span className="font-black text-black text-lg">{tenantId?.substring(0, 2).toUpperCase()}</span>
  </div>
)}

// Item del menú (solo Admin)
{user?.role === 'Admin' && (
  <Link to="/branding" className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive('/branding') ? 'text-black font-semibold' : 'hover:bg-white/5'
  }`}
  style={isActive('/branding') ? { background: 'var(--color-primary)' } : {}}>
    ⚙ Mi Barbería
  </Link>
)}
```

**Reemplazar todos los colores hardcodeados del Sidebar:**

| Color actual (Tailwind) | Reemplazar por CSS Variable |
|-------------------------|----------------------------|
| `bg-gray-900` | `style={{ background: 'var(--color-sidebar)' }}` |
| `bg-amber-500` (item activo) | `style={{ background: 'var(--color-primary)' }}` |
| `text-amber-400` | `style={{ color: 'var(--color-primary)' }}` |
| `bg-amber-400/10` (badge rol) | `style={{ background: 'var(--color-primary)20' }}` |
| `text-amber-400` (badge rol) | `style={{ color: 'var(--color-primary)' }}` |

---

### B7. Refactorizar colores hardcodeados en componentes existentes

Los siguientes componentes usan colores Tailwind fijos que deben reemplazarse por CSS Variables. Seguir el mismo patrón que en B6.

**`src/components/AdminLayout.tsx`**
- `bg-gray-100` (fondo) → `style={{ background: 'var(--color-bg)' }}`

**`src/features/dashboard/Dashboard.tsx`**
- `bg-amber-400` (StatCard highlight) → `style={{ background: 'var(--color-primary)' }}`
- `border-amber-300` → `style={{ borderColor: 'var(--color-primary)' }}`
- `text-amber-900` / `text-amber-800` → adaptar al contraste del color primario
- `bg-white` (cards) → `style={{ background: 'var(--color-surface)' }}`
- `border-gray-100` / `border-gray-200` → `style={{ borderColor: 'var(--color-border)' }}`
- `text-gray-900` / `text-gray-950` → `style={{ color: 'var(--color-text)' }}`
- `text-gray-400` / `text-gray-500` → `style={{ color: 'var(--color-text-muted)' }}`

**`src/features/appointments/AppointmentManagement.tsx`**, **`BarberManagement.tsx`**, **`ServiceManagement.tsx`**
- Aplicar el mismo patrón: `bg-white` → surface, `border-gray-*` → border, textos grises → text/text-muted

---

### B8. Agregar animaciones con Framer Motion

**En `src/components/AdminLayout.tsx`** — transición de páginas:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const location = useLocation();

// Envolver el contenido principal:
<AnimatePresence mode="wait">
  <motion.main
    key={location.pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
    <Outlet />
  </motion.main>
</AnimatePresence>
```

**En `src/features/dashboard/Dashboard.tsx`** — stagger de StatCards:

```tsx
import { motion } from 'framer-motion';

// Reemplazar el div grid de StatCards por:
<motion.div
  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
  initial="hidden"
  animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
>
  {/* Cada StatCard envuelta en: */}
  <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
    <StatCard ... />
  </motion.div>
</motion.div>
```

**En botones de acción principales** — feedback táctil:

```tsx
import { motion } from 'framer-motion';

// Reemplazar <button> por <motion.button> en modales y acciones:
<motion.button
  whileTap={{ scale: 0.97 }}
  whileHover={{ scale: 1.02 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  Guardar
</motion.button>
```

---

### B9. Crear la página BrandingPage

**Archivo nuevo:** `src/features/branding/BrandingPage.tsx`

Esta es la página completa de "Mi Barbería". Tiene 4 secciones:

**Sección 1 — Logo:**
- Muestra el logo actual (imagen si existe, o iniciales si no)
- Botón "Subir nuevo logo" → abre `<input type="file" accept="image/png,image/jpeg">` → llama a `brandingService.uploadLogo(file)` → actualiza `ThemeContext`
- Botón "Eliminar" → llama a `PUT /api/tenant/branding` con `logoBase64: null`

**Sección 2 — Tema base:**
- 3 cards clickeables (Dark Premium, AntiGravity, Light Modern)
- La card activa tiene borde con `var(--color-primary)` y un check mark
- Al hacer click → `setBranding({ ...branding, theme: selectedTheme })` (preview inmediato, sin guardar aún)

**Sección 3 — Colores de marca:**
- Usar `HexColorPicker` de `react-colorful` para primario y secundario
- Input de texto HEX editable manualmente
- Cada cambio → `setBranding({ ...branding, primaryColor: newColor })` (preview en vivo)

**Sección 4 — Preview en vivo:**
- Muestra botones, badges y links usando `var(--color-primary)` y `var(--color-secondary)` reales

**Acciones:**
- "Restablecer" → recarga desde backend (`loadBranding()`)
- "Guardar cambios" → llama a `brandingService.updateBranding({ theme, primaryColor, secondaryColor })` → muestra toast de éxito

---

### B10. Registrar la ruta de BrandingPage

**Archivo:** `src/App.tsx` (o donde estén las rutas)

```tsx
import { BrandingPage } from './features/branding/BrandingPage';

// Dentro del layout protegido, agregar:
<Route path="/branding" element={<BrandingPage />} />
```

---

### B11. Verificación final del frontend

```bash
cd BarberBookSaaS.Web
npm run build   # Debe compilar con 0 errores TypeScript
npm run dev     # App en http://localhost:5173
```

Flujo de prueba completo:
1. Login como Admin → verificar que el tema Dark Premium se aplica correctamente
2. Ir a "Mi Barbería"
3. Cambiar el tema a "AntiGravity" → verificar que toda la app cambia en tiempo real
4. Cambiar el color primario → verificar que botones y el sidebar se actualizan en tiempo real
5. Subir un PNG como logo → verificar que aparece en el sidebar
6. Hacer click en "Guardar cambios" → verificar respuesta 204 del backend
7. Refrescar la página → verificar que los cambios persisten (localStorage + backend)
8. Probar `GET http://localhost:5299/api/public/juanpablo/branding` sin JWT → debe devolver el branding guardado

---

## Resumen de archivos nuevos / modificados

### Archivos NUEVOS

| Archivo | Propósito |
|---------|-----------|
| `BarberBookSaaS.Domain/Entities/Tenant.cs` | +4 propiedades de branding |
| `BarberBookSaaS.Application/DTOs/Branding/TenantBrandingDto.cs` | DTO de respuesta |
| `BarberBookSaaS.Application/DTOs/Branding/UpdateBrandingDto.cs` | DTO de actualización |
| `BarberBookSaaS.Application/Common/IBrandingService.cs` | Interfaz del servicio |
| `BarberBookSaaS.Infrastructure/Services/BrandingService.cs` | Implementación del servicio |
| `BarberBookSaaS.WebApi/Controllers/BrandingController.cs` | 4 endpoints |
| `src/context/ThemeContext.tsx` | Context React + inyección CSS Variables |
| `src/features/branding/brandingTypes.ts` | Tipos TS + definición de los 3 temas |
| `src/features/branding/brandingService.ts` | Llamadas a la API de branding |
| `src/features/branding/BrandingPage.tsx` | Página "Mi Barbería" completa |

### Archivos MODIFICADOS

| Archivo | Qué cambia |
|---------|------------|
| `BarberBookSaaS.WebApi/Program.cs` | Registrar `IBrandingService` |
| `src/main.tsx` | Agregar `ThemeProvider` |
| `src/context/AuthContext.tsx` | Llamar `loadBranding()` tras login |
| `src/components/Sidebar.tsx` | Logo tenant, ítem "Mi Barbería", CSS Variables |
| `src/components/AdminLayout.tsx` | Animación de páginas, CSS Variable de fondo |
| `src/features/dashboard/Dashboard.tsx` | CSS Variables + stagger de cards con Framer Motion |
| `src/features/appointments/AppointmentManagement.tsx` | CSS Variables |
| `src/features/barbers/BarberManagement.tsx` | CSS Variables |
| `src/features/services/ServiceManagement.tsx` | CSS Variables |
| `src/App.tsx` | Nueva ruta `/branding` |

### Migración de base de datos

| Migración | Qué hace |
|-----------|----------|
| `AgregarBrandingTenant` | Agrega `Theme`, `PrimaryColor`, `SecondaryColor`, `LogoBase64` a tabla `Tenants` |

---

## Comandos para arrancar el proyecto en desarrollo

```bash
# Terminal 1 — Backend
cd BarberBookSaaS.WebApi
dotnet run
# API disponible en: http://localhost:5299
# Swagger en: http://localhost:5299/swagger

# Terminal 2 — Frontend
cd BarberBookSaaS.Web
npm run dev
# App disponible en: http://localhost:5173
```

**Usuario de prueba:** registra una barbería nueva desde `/register` (o vía SuperAdmin) y usa esas credenciales.