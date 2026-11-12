using System.ComponentModel.DataAnnotations.Schema;
using BarberBookSaaS.Domain.Common;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.Domain.Entities;

public class Appointment : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = AppointmentStatus.Pending;

    // Propiedad añadida para cumplir con los requisitos y solucionar el error CS0117
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsFree { get; set; } = false;
    public Guid? CustomerId { get; set; }

    public DateTime? CancelledAt { get; set; }
    public string? CancelledBy { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    public DateTime? RescheduleTokenUsedAt { get; set; }
    public string? AiDiagnosisJson { get; set; }
    public bool IsWalkIn { get; set; }
    public Guid? LocationId { get; set; }

    // Propiedades de navegación para Entity Framework
    public Barber? Barber { get; set; }
    public Service? Service { get; set; }
    public Location? Location { get; set; }

    [NotMapped] public int? CustomerLoyaltyCount { get; set; }
    [NotMapped] public int? CustomerLoyaltyThreshold { get; set; }
    [NotMapped] public bool? CustomerLoyaltyEnabled { get; set; }
}