using BarberBookSaaS.Application.DTOs.Services;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IServiceService
{
    Task<IEnumerable<Service>> GetAllAsync();
    Task<Service> CreateAsync(CreateServiceDto dto);
    Task<Service?> UpdateAsync(Guid id, UpdateServiceDto dto);
    Task<int?> DeleteAsync(Guid id);
    Task<bool?> HardDeleteAsync(Guid id);
    Task<bool> ActivateAsync(Guid id);
    Task<bool> UpdateImageAsync(Guid id, string base64Image);
}