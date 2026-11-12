# Festivos Colombianos — Spec

## Resumen

Toggle por tenant "Descansar en festivos colombianos". Cuando está activo, los días festivos no permiten agendar citas. Los festivos se calculan algorítmicamente (Ley 51/1983 + Pascua).

## Backend

### `ColombianHolidayService`

Servicio estático/singleton sin dependencias. Calcula los 18 festivos anuales de Colombia:

**Festivos fijos (no se mueven):**
- 1 de enero (Año Nuevo)
- 1 de mayo (Día del Trabajo)
- 20 de julio (Independencia)
- 7 de agosto (Batalla de Boyacá)
- 8 de diciembre (Inmaculada Concepción)
- 25 de diciembre (Navidad)

**Festivos Ley Emiliani (se mueven al lunes siguiente si no caen en lunes):**
- 6 de enero (Reyes Magos)
- 19 de marzo (San José)
- 29 de junio (San Pedro y San Pablo)
- 15 de agosto (Asunción de la Virgen)
- 12 de octubre (Día de la Raza)
- 1 de noviembre (Todos los Santos)
- 11 de noviembre (Independencia de Cartagena)

**Festivos basados en Pascua:**
- Jueves Santo (Pascua - 3 días)
- Viernes Santo (Pascua - 2 días)
- Ascensión del Señor (Pascua + 43 días, movido a lunes)
- Corpus Christi (Pascua + 64 días, movido a lunes)
- Sagrado Corazón de Jesús (Pascua + 71 días, movido a lunes)

**Métodos:**
- `bool IsHoliday(DateOnly date)`
- `List<DateOnly> GetHolidays(int year)`
- `string? GetHolidayName(DateOnly date)`

Pascua se calcula con el algoritmo anónimo de Gauss/Meeus.

### Tenant

Nuevo campo: `bool HolidaysEnabled { get; set; } = false;`

Requiere migración + SQL para Supabase: `ALTER TABLE "Tenants" ADD COLUMN "HolidaysEnabled" boolean NOT NULL DEFAULT false;`

### Disponibilidad (`GetAvailabilityAsync`)

Al inicio del método, después de verificar que el servicio existe:
1. Obtener el tenant del contexto
2. Si `tenant.HolidaysEnabled && ColombianHolidayService.IsHoliday(date)` → retornar lista vacía

Aplica tanto para booking público como para reprogramación.

### Branding DTO

Agregar `HolidaysEnabled` a `TenantBrandingDto` (GET/PUT).

### Endpoint público

Agregar `holidaysEnabled` al response de branding público para que el frontend pueda mostrar el mensaje de festivo.

## Frontend

### BrandingPage (Admin)

Toggle "Descansar en festivos colombianos" con texto explicativo: "Los días festivos colombianos no estarán disponibles para agendar citas."

### BookingPage (Cliente)

Cuando el usuario selecciona una fecha festiva y `holidaysEnabled` es true:
- Mostrar mensaje en la zona de slots: "🎉 Este día es festivo — la barbería no trabaja."
- No mostrar slots vacíos, mostrar el mensaje festivo.

Para esto, el frontend necesita saber si una fecha es festiva. Opciones:
- Incluir la lista de festivos del año en el response de branding público
- O detectar "0 slots" y mostrar un mensaje genérico

**Decisión:** Incluir `holidays: string[]` (array de fechas ISO "YYYY-MM-DD") en el response de branding público. El frontend chequea localmente antes de llamar a la API de disponibilidad.

## Migración

```sql
ALTER TABLE "Tenants" ADD COLUMN "HolidaysEnabled" boolean NOT NULL DEFAULT false;
```

## Fuera de alcance

- Festivos personalizados por tenant
- Configuración por barbero individual
- Festivos de otros países
