# Diseño: Sistema de Theming y Branding por Tenant

**Fecha:** 2026-05-26  
**Estado:** Aprobado por usuario  
**Alcance:** Frontend (React) + Backend (ASP.NET Core)

---

## Resumen

Implementar un sistema de personalización visual por tenant que permita a cada barbería elegir un tema base, definir sus colores de marca y subir su logo. Los cambios se reflejan en tiempo real en el panel admin y quedan disponibles para la futura página pública de agendamiento de clientes.

---

## Decisiones de Diseño

| Pregunta | Decisión |
|----------|----------|
| ¿Cuántos temas base? | 3: Dark Premium, AntiGravity Glass, Light Modern |
| ¿Dónde está la configuración? | Página dedicada "Mi Barbería" en el sidebar |
| ¿Cuántos colores personalizables? | 2: primario (botones CTA) y secundario (badges, estados) |
| ¿Cómo se aplica el theming? | ThemeContext React + CSS Variables en `:root` |
| ¿Alcance del tema? | Panel admin + futura página pública (endpoint público sin JWT) |
| ¿Cómo se guarda el logo? | Base64 en la columna `LogoBase64` de la tabla `Tenants` |

---

## Arquitectura

### Backend

#### Nuevos campos en `Tenant`
```
Theme         string  (default: "dark-premium")
PrimaryColor  string  (default: "#D4AF37")
SecondaryColor string (default: "#6366F1")
LogoBase64    string? (nullable)
```

#### Nuevos endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/tenant/branding` | JWT Admin | Obtiene config de branding del tenant activo |
| PUT | `/api/tenant/branding` | JWT Admin | Actualiza tema y colores |
| POST | `/api/tenant/logo` | JWT Admin | Sube logo PNG (multipart/form-data), lo convierte a base64 |
| GET | `/api/public/{subdomain}/branding` | Sin JWT | Para la página pública del cliente |

#### Nueva migración
`AgregarBrandingTenant` — agrega los 4 campos a la tabla `Tenants`.

---

### Frontend

#### `ThemeContext` (`src/context/ThemeContext.tsx`)
- Almacena: `theme`, `primaryColor`, `secondaryColor`, `logoBase64`
- Al cambiar cualquier valor, inyecta CSS Variables en `document.documentElement`:
  ```css
  --color-primary: #D4AF37;
  --color-secondary: #6366F1;
  --color-bg: #0f0f0f;          /* varía por tema */
  --color-sidebar: #111111;     /* varía por tema */
  --color-surface: #161616;     /* varía por tema */
  --color-border: #222222;      /* varía por tema */
  --color-text: #FFFFFF;        /* varía por tema */
  --color-text-muted: #555555;  /* varía por tema */
  ```
- Se carga al iniciar sesión llamando a `GET /api/tenant/branding`
- Persiste en `localStorage` como fallback

#### Definición de los 3 temas

```typescript
const THEMES = {
  "dark-premium": {
    "--color-bg": "#0f0f0f",
    "--color-sidebar": "#111111",
    "--color-surface": "#161616",
    "--color-border": "#222222",
    "--color-text": "#FFFFFF",
    "--color-text-muted": "#555555",
  },
  "antigravity": {
    "--color-bg": "#0d0d1a",
    "--color-sidebar": "linear-gradient(180deg, #0d0d1a, #1a0d2e)",
    "--color-surface": "rgba(255,255,255,0.04)",
    "--color-border": "rgba(255,255,255,0.08)",
    "--color-text": "#F0E6FF",
    "--color-text-muted": "#6B7280",
  },
  "light-modern": {
    "--color-bg": "#F8FAFC",
    "--color-sidebar": "#FFFFFF",
    "--color-surface": "#FFFFFF",
    "--color-border": "#E2E8F0",
    "--color-text": "#1E293B",
    "--color-text-muted": "#64748B",
  },
}
```

#### Página `BrandingPage` (`src/features/branding/BrandingPage.tsx`)
Secciones:
1. **Logo** — preview circular + botón "Subir PNG" + botón "Eliminar"
2. **Tema base** — 3 cards con preview miniatura, la activa con borde del color primario
3. **Colores de marca** — dos sliders + input HEX para primario y secundario
4. **Preview en vivo** — muestra botones, badges y links con los colores elegidos en tiempo real
5. **Acciones** — "Restablecer" y "Guardar cambios"

#### Dependencias nuevas
- `react-colorful` — color picker ligero (2.5kb gzip)

#### Animaciones (`framer-motion`)
- Transición de páginas al navegar en el sidebar: fade + slide sutil
- Cards de estadísticas en Dashboard: aparecen con stagger (una tras otra)
- Botones: efecto de escala al hacer click (`whileTap={{ scale: 0.97 }}`)
- Sidebar items: highlight animado al activarse

#### Refactor de componentes existentes
Todos los colores hardcodeados en Sidebar, Dashboard, AppointmentManagement, BarberManagement y ServiceManagement se reemplazan por las CSS Variables correspondientes.

---

## Flujo de datos

```
Login
  └─> AuthContext.loginGlobal()
        └─> ThemeContext.loadBranding()
              └─> GET /api/tenant/branding
                    └─> aplica CSS Variables en :root
                          └─> App se pinta con colores del tenant

Mi Barbería (admin cambia colores)
  └─> BrandingPage onChange
        └─> ThemeContext.setColors() → CSS Variables actualizadas en vivo
              └─> Guardar → PUT /api/tenant/branding
                              POST /api/tenant/logo (si hay logo nuevo)
```

---

## Consideraciones

- El logo se guarda como base64 en la DB para el MVP. En producción mover a almacenamiento externo (Azure Blob / S3).
- El endpoint `GET /api/public/{subdomain}/branding` no requiere JWT para que la futura página del cliente pueda obtener los colores sin autenticarse.
- Los valores por defecto garantizan que un tenant nuevo tenga el tema Dark Premium con dorado y violeta — la misma estética premium desde el primer login.