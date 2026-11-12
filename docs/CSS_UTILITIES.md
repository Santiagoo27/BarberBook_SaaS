# Clases CSS Utilitarias — `index.css`

| Clase | Breakpoint | Descripción |
|-------|-----------|-------------|
| `appt-grid` | — / ≤900px / ≤560px | Grid de tarjetas de citas: 3→2→1 columna |
| `appt-header-actions` | ≤540px | Contenedor de botones del header: `flex-wrap:wrap; justify-content:flex-end` — evita overflow de "+ Nueva Cita" |
| `appt-filter-bar` | ≤640px | Barra de filtros: `overflow-x:auto; scrollbar-width:none` — todos los tabs accesibles con scroll |
| `agenda-row` | ≤640px | Fila de cita en vista Agenda: `flex-wrap:wrap` para layout de múltiples filas |
| `agenda-row-customer` | ≤640px | Columna nombre+teléfono: `flex:1 1 auto; order:1` |
| `agenda-row-time` | ≤640px | Hora de la cita: `order:2` — se queda en Row 1 junto al nombre |
| `agenda-row-middle` | ≤640px | Barbero/Servicio + badge cancelación: `order:3; flex:1 1 100%; padding-left:58px` |
| `agenda-row-status` | ≤640px | StatusPill: `order:4; flex:1 1 100%; padding-left:58px` — Row 3 indentada |
| `agenda-row-actions` | ≤640px | Botones Completar/Cancelar/Eliminar: `order:5; flex:1 1 100%; padding-left:58px` |
| `barber-appt-row` / `barber-appt-meta` | ≤640px | Fila de cita en BarberDashboard — mismo patrón wrap+indent |
| `customer-row` | ≤640px | Fila de cliente en lista: wrap+indent bajo avatar |
| `stat-grid` | ≤560px | Grid de stat cards: `auto-fit minmax(190px,1fr)` → columna única |
| `service-grid` / `barber-grid` | ≤900/≤640px | Grids de tarjetas con breakpoints equivalentes a `appt-grid` |
| `gallery-container` | ≤1024px / ≤640px | Altura del carrusel circular: 550px → 450px → 320px |
| `gallery-title` | ≤1024px | Tamaño del título de sección del carrusel: 24px → 18px |
