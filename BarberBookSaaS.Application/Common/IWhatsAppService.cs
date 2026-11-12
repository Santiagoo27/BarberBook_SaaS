namespace BarberBookSaaS.Application.Common;

public interface IWhatsAppService
{
    Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId);

    Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId);

    Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string tenantId);

    Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId);

    Task SendPasswordResetAsync(string toPhone, string customerName, string tenantName, string resetLink);
}
