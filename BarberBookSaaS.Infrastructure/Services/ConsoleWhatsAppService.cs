using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class ConsoleWhatsAppService : IWhatsAppService
{
    private readonly ILogger<ConsoleWhatsAppService> _logger;

    public ConsoleWhatsAppService(ILogger<ConsoleWhatsAppService> logger)
    {
        _logger = logger;
    }

    public Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId)
    {
        var message = $"Hola {customerName}, te recordamos tu cita en {tenantName} hoy a las {appointmentDate:HH:mm} con {barberName}. ¿Confirmas tu asistencia?";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} quedó confirmada para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName}. Puedes cancelarla o reprogramarla hasta 1 hora antes. ¡Te esperamos!";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string tenantId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} fue reprogramada para el {newAppointmentDate:dd/MM} a las {newAppointmentDate:HH:mm} con {barberName}. ¡Te esperamos!";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName} fue cancelada. Si fue un error, puedes agendar de nuevo cuando quieras.";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(string toPhone, string customerName, string tenantName, string resetLink)
    {
        _logger.LogInformation("[WhatsApp SIMULADO] Reset password → {Phone}: Hola {Name}, usa este link para recuperar tu acceso en {Tenant}: {Link}", toPhone, customerName, tenantName, resetLink);
        return Task.CompletedTask;
    }
}
