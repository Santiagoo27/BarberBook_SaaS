using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class BarberSchedule : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid BarberId { get; set; }
    public int DayOfWeek { get; set; }   // 0=Domingo, 1=Lunes, ..., 6=Sábado
    public int StartHour { get; set; }
    public int StartMinute { get; set; }
    public int EndHour { get; set; }
    public int EndMinute { get; set; }

    // Bloque de descanso opcional (ej. almuerzo)
    public int? BreakStartHour { get; set; }
    public int? BreakStartMinute { get; set; }
    public int? BreakEndHour { get; set; }
    public int? BreakEndMinute { get; set; }

    public Barber? Barber { get; set; }
}
