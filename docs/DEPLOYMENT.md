# Deployment — BarberBook SaaS

## Variables de entorno requeridas en Railway

Todas las variables usan `__` (doble guion bajo) para separar secciones anidadas del JSON de configuracion.
Ejemplo: `Jwt:Key` en appsettings.json se convierte en `Jwt__Key` en Railway.

### JWT (obligatorio)

```
Jwt__Key=[clave aleatoria de minimo 32 caracteres]
```

Generar con:

```bash
openssl rand -base64 32
```

O con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

O con PowerShell:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Base de datos (obligatorio)

```
ConnectionStrings__DefaultConnection=[URL de conexion PostgreSQL de Supabase]
```

### SuperAdmin (obligatorio)

```
SuperAdmin__Email=[email del superadmin]
SuperAdmin__Password=[contrasena segura del superadmin]
```

### Google Gemini (obligatorio para diagnostico IA)

```
Google__ApiKey=[API Key de Google AI Studio]
Google__TextModel=gemini-2.5-flash
Google__ImageModel=gemini-2.5-flash-image
```

### Email — Gmail (una de las dos opciones)

```
Email__GmailUser=[email de Gmail]
Email__GmailAppPassword=[App Password de Gmail]
Email__FromName=BarberBook
```

### Email — Mailtrap (alternativa a Gmail)

```
Email__MailtrapToken=[token de Mailtrap]
Email__MailtrapInboxId=[ID del inbox]
```

### WhatsApp Meta Cloud API (opcional)

```
Meta__AccessToken=[token de acceso permanente de Meta]
Meta__AppSecret=[secret de la app de Meta]
Meta__VerifyToken=[token de verificacion del webhook]
Meta__PhoneNumberId=[ID del numero de telefono de Meta]
Meta__ApiVersion=v21.0
Meta__TemplateLanguage=es_EC
```

### OpenAI (opcional)

```
OpenAI__ApiKey=[API Key de OpenAI]
OpenAI__Model=gpt-4o
OpenAI__ImageModel=gpt-image-1
```

### Frontend

```
FrontendBaseUrl=https://www.barberbook.dev
```

### CORS

```
CorsOrigins__0=https://www.barberbook.dev
CorsOrigins__1=https://barberbook.dev
```

## Notas de seguridad

- **Nunca** commitear secretos en `appsettings.json` — debe tener valores vacios
- `appsettings.Development.json` contiene secretos locales y esta en `.gitignore`
- La JWT Key debe tener minimo 32 caracteres para HMAC-SHA256
- Rotar la JWT Key invalida todos los tokens activos — los usuarios tendran que re-autenticarse
