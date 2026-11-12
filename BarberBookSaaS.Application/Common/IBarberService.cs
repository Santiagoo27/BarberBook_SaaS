using BarberBookSaaS.Application.DTOs.Barbers;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IBarberService
{
    Task<IEnumerable<Barber>> GetAllAsync();
    Task<Barber?> GetByUserIdAsync(Guid userId);
    Task<CreateBarberResponseDto> CreateAsync(CreateBarberDto dto);
    Task<Barber?> UpdateAsync(Guid id, UpdateBarberDto dto);
    Task<int?> DeleteAsync(Guid id);
    Task<bool?> HardDeleteAsync(Guid id);
    Task<bool> ActivateAsync(Guid id);
    Task<bool> UpdateImageAsync(Guid id, string base64Image);
    Task<IEnumerable<BarberSchedule>> GetScheduleAsync(Guid id);
    Task UpsertScheduleDayAsync(Guid id, BarberScheduleDto dto);
    Task DeleteScheduleDayAsync(Guid id, int day);
}