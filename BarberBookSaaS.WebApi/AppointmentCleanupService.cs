using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.WebApi;

public class AppointmentCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AppointmentCleanupService> _logger;

    public AppointmentCleanupService(IServiceScopeFactory scopeFactory, ILogger<AppointmentCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Run once at startup, then every 24 hours
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IAppointmentService>();
                var deleted = await svc.DeleteOldTerminalAppointmentsAsync(daysOld: 30);
                if (deleted > 0)
                    _logger.LogInformation("Limpieza automática: {Count} citas eliminadas (>30 días).", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error en la limpieza automática de citas.");
            }

            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}
