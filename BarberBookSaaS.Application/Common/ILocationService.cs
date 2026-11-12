using BarberBookSaaS.Application.DTOs.Locations;

namespace BarberBookSaaS.Application.Common;

public interface ILocationService
{
    Task<List<LocationDto>> GetAllAsync();
    Task<LocationDetailDto?> GetByIdAsync(Guid id);
    Task<LocationDto> CreateAsync(CreateLocationDto dto);
    Task<LocationDto?> UpdateAsync(Guid id, UpdateLocationDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<bool> AssignBarberAsync(Guid locationId, Guid barberId);
    Task<bool> RemoveBarberAsync(Guid locationId, Guid barberId);
    Task<bool> AssignServiceAsync(Guid locationId, Guid serviceId);
    Task<bool> RemoveServiceAsync(Guid locationId, Guid serviceId);
    Task<List<LocationDto>> GetPublicLocationsAsync(string subdomain);
}
