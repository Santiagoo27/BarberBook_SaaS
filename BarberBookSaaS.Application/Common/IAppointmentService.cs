using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IAppointmentService
{
    Task<BookingResult> CreateAppointmentAsync(CreateAppointmentDto request);
    Task<PagedResult<Appointment>> GetAllAsync(int page, int pageSize, string? status, DateTime? from, DateTime? to, Guid? filterByUserId = null);
    Task<Appointment?> UpdateStatusAsync(Guid id, string status, string? cancelledBy = null);
    Task<bool> DeleteAsync(Guid id);
    Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(Guid barberId, Guid serviceId, DateOnly date, int minimumLeadHours = 0, Guid? excludeAppointmentId = null, Guid? locationId = null);
    Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate);
    Task<BookingResult> CreateWalkInAsync(CreateWalkInDto dto, Guid userId);
    Task<int> BulkDeleteAsync(IEnumerable<Guid> ids);
    Task<int> DeleteOldTerminalAppointmentsAsync(int daysOld = 30);
}