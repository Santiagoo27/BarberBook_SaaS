using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.WebApi;

public class AppointmentReminderHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AppointmentReminderHostedService> _logger;

    public AppointmentReminderHostedService(IServiceScopeFactory scopeFactory, ILogger<AppointmentReminderHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            try
            {
                await SendPendingRemindersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error en AppointmentReminderHostedService");
            }
        }
    }

    private async Task SendPendingRemindersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var whatsApp = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        var now = DateTime.SpecifyKind(colombiaNow, DateTimeKind.Utc);
        var windowStart = now.AddMinutes(55);
        var windowEnd   = now.AddMinutes(65);

        var appointments = await db.Appointments
            .IgnoreQueryFilters()
            .Include(a => a.Barber)
            .Where(a => a.Status == AppointmentStatus.Pending
                     && a.ReminderSentAt == null
                     && a.CustomerPhone != null
                     && a.AppointmentDate >= windowStart
                     && a.AppointmentDate <= windowEnd)
            .ToListAsync(ct);

        if (appointments.Count == 0) return;

        var tenantIds = appointments.Select(a => a.TenantId).Distinct().ToList();
        var tenants = await db.Tenants
            .IgnoreQueryFilters()
            .Where(t => tenantIds.Contains(t.Id) && t.WhatsAppEnabled)
            .ToDictionaryAsync(t => t.Id, ct);

        foreach (var appt in appointments)
        {
            if (!tenants.TryGetValue(appt.TenantId, out var tenant)) continue;

            await whatsApp.SendReminderAsync(
                appointmentId: appt.Id,
                toPhone: appt.CustomerPhone!,
                customerName: appt.CustomerName,
                tenantName: tenant.Name,
                appointmentDate: appt.AppointmentDate,
                barberName: appt.Barber?.Name ?? "tu barbero",
                tenantId: tenant.Id
            );

            appt.ReminderSentAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }
}
