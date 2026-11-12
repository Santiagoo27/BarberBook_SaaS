using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Services;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.Infrastructure.Services;

public class ServiceService : IServiceService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public ServiceService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<IEnumerable<Service>> GetAllAsync()
        => await _context.Services.ToListAsync();

    public async Task<Service> CreateAsync(CreateServiceDto dto)
    {
        var service = new Service
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Price = dto.Price,
            DurationMinutes = dto.DurationMinutes,
            ImageBase64 = dto.ImageBase64,
            IsActive = true
        };
        await _context.Services.AddAsync(service);
        await _context.SaveChangesAsync();

        // Auto-vincular a Sede Principal si el tenant tiene exactamente 1 sede activa.
        // Con 0 o 2+ sedes, la vinculación queda manual desde el panel de Sedes.
        // Se traen solo los Ids (no las entidades completas) para evitar que EF Core
        // trackee la Location y genere fixup de navegación (ver misma nota en BarberService).
        var sedeIds = await _context.Locations.Where(l => l.IsActive).Select(l => l.Id).ToListAsync();
        if (sedeIds.Count == 1)
        {
            await _context.LocationServices.AddAsync(new Domain.Entities.LocationService
            {
                LocationId = sedeIds[0],
                ServiceId = service.Id
            });
            await _context.SaveChangesAsync();
        }

        return service;
    }

    public async Task<Service?> UpdateAsync(Guid id, UpdateServiceDto dto)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == id);
        if (service is null) return null;

        service.Name = dto.Name;
        service.Price = dto.Price;
        service.DurationMinutes = dto.DurationMinutes;
        if (dto.ImageBase64 is not null)
            service.ImageBase64 = dto.ImageBase64;

        await _context.SaveChangesAsync();
        return service;
    }

    public async Task<int?> DeleteAsync(Guid id)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == id);
        if (service is null) return null;

        using var transaction = await _context.Database.BeginTransactionAsync();

        var pendingAppointments = await _context.Appointments
            .Where(a => a.ServiceId == id && a.Status == AppointmentStatus.Pending)
            .ToListAsync();

        foreach (var appt in pendingAppointments)
            appt.Status = AppointmentStatus.Cancelled;

        service.IsActive = false;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return pendingAppointments.Count;
    }

    public async Task<bool?> HardDeleteAsync(Guid id)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == id);
        if (service is null) return null;

        var hasAppointments = await _context.Appointments.AnyAsync(a => a.ServiceId == id);
        if (hasAppointments) return false;

        _context.Services.Remove(service);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ActivateAsync(Guid id)
    {
        var service = await _context.Services
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == _tenantService.TenantId);
        if (service is null) return false;

        service.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateImageAsync(Guid id, string base64Image)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == id);
        if (service is null) return false;

        service.ImageBase64 = base64Image;
        await _context.SaveChangesAsync();
        return true;
    }
}