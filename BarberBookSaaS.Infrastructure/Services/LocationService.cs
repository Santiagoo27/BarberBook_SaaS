using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Locations;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.Infrastructure.Services;

public class LocationService : ILocationService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public LocationService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<List<LocationDto>> GetAllAsync()
    {
        return await _context.Locations
            .Where(l => l.IsActive)
            .Select(l => new LocationDto
            {
                Id = l.Id,
                Name = l.Name,
                Address = l.Address,
                IsActive = l.IsActive,
                BarberCount = l.Barbers.Count(b => b.IsActive),
                ServiceCount = l.LocationServices.Count(ls => ls.Service.IsActive)
            })
            .ToListAsync();
    }

    public async Task<LocationDetailDto?> GetByIdAsync(Guid id)
    {
        var location = await _context.Locations
            .Include(l => l.Barbers)
            .Include(l => l.LocationServices).ThenInclude(ls => ls.Service)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (location is null) return null;

        var activeBarbers = location.Barbers.Where(b => b.IsActive).ToList();
        var activeServices = location.LocationServices.Where(ls => ls.Service.IsActive).Select(ls => ls.Service).ToList();

        return new LocationDetailDto
        {
            Id = location.Id,
            Name = location.Name,
            Address = location.Address,
            IsActive = location.IsActive,
            BarberCount = activeBarbers.Count,
            ServiceCount = activeServices.Count,
            Barbers = activeBarbers.Select(b => new BarberSummaryDto
            {
                Id = b.Id,
                Name = b.Name,
                Specialty = b.Specialty,
                ImageBase64 = b.ImageBase64
            }).ToList(),
            Services = activeServices.Select(s => new ServiceSummaryDto
            {
                Id = s.Id,
                Name = s.Name,
                Price = s.Price,
                DurationMinutes = s.DurationMinutes
            }).ToList()
        };
    }

    public async Task<LocationDto> CreateAsync(CreateLocationDto dto)
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Address = dto.Address,
            IsActive = true
        };

        await _context.Locations.AddAsync(location);
        await _context.SaveChangesAsync();

        return new LocationDto
        {
            Id = location.Id,
            Name = location.Name,
            Address = location.Address,
            IsActive = location.IsActive,
            BarberCount = 0,
            ServiceCount = 0
        };
    }

    public async Task<LocationDto?> UpdateAsync(Guid id, UpdateLocationDto dto)
    {
        var location = await _context.Locations.FirstOrDefaultAsync(l => l.Id == id);
        if (location is null) return null;

        location.Name = dto.Name;
        location.Address = dto.Address;
        await _context.SaveChangesAsync();

        var barberCount = await _context.Barbers.CountAsync(b => b.LocationId == id && b.IsActive);
        var serviceCount = await _context.LocationServices.CountAsync(ls => ls.LocationId == id && ls.Service.IsActive);

        return new LocationDto
        {
            Id = location.Id,
            Name = location.Name,
            Address = location.Address,
            IsActive = location.IsActive,
            BarberCount = barberCount,
            ServiceCount = serviceCount
        };
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var location = await _context.Locations.FirstOrDefaultAsync(l => l.Id == id);
        if (location is null) return false;

        location.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AssignBarberAsync(Guid locationId, Guid barberId)
    {
        var location = await _context.Locations.FirstOrDefaultAsync(l => l.Id == locationId);
        if (location is null) return false;

        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == barberId);
        if (barber is null) return false;

        barber.LocationId = locationId;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveBarberAsync(Guid locationId, Guid barberId)
    {
        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == barberId && b.LocationId == locationId);
        if (barber is null) return false;

        barber.LocationId = null;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AssignServiceAsync(Guid locationId, Guid serviceId)
    {
        var location = await _context.Locations.FirstOrDefaultAsync(l => l.Id == locationId);
        if (location is null) return false;

        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == serviceId);
        if (service is null) return false;

        var alreadyAssigned = await _context.LocationServices
            .AnyAsync(ls => ls.LocationId == locationId && ls.ServiceId == serviceId);
        if (alreadyAssigned) return true;

        await _context.LocationServices.AddAsync(new Domain.Entities.LocationService
        {
            LocationId = locationId,
            ServiceId = serviceId
        });
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveServiceAsync(Guid locationId, Guid serviceId)
    {
        var link = await _context.LocationServices
            .FirstOrDefaultAsync(ls => ls.LocationId == locationId && ls.ServiceId == serviceId);
        if (link is null) return false;

        _context.LocationServices.Remove(link);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<LocationDto>> GetPublicLocationsAsync(string subdomain)
    {
        return await _context.Locations
            .IgnoreQueryFilters()
            .Where(l => l.TenantId == subdomain && l.IsActive)
            .Select(l => new LocationDto
            {
                Id = l.Id,
                Name = l.Name,
                Address = l.Address,
                IsActive = l.IsActive,
                BarberCount = l.Barbers.Count(b => b.IsActive),
                ServiceCount = l.LocationServices.Count(ls => ls.Service.IsActive)
            })
            .ToListAsync();
    }
}
