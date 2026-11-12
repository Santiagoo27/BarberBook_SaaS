using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class AppointmentService : IAppointmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<AppointmentService> _logger;
    private readonly IBarberService _barberService;
    private readonly ITenantService _tenantService;

    public AppointmentService(
        ApplicationDbContext context,
        IWhatsAppService whatsAppService,
        ILogger<AppointmentService> logger,
        IBarberService barberService,
        ITenantService tenantService)
    {
        _context = context;
        _whatsAppService = whatsAppService;
        _logger = logger;
        _barberService = barberService;
        _tenantService = tenantService;
    }

    public async Task<BookingResult> CreateAppointmentAsync(CreateAppointmentDto request)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == request.ServiceId);
        if (service == null)
            return BookingResult.Fail("SERVICE_NOT_FOUND", "El servicio solicitado no existe.");
        if (!service.IsActive)
            return BookingResult.Fail("SERVICE_INACTIVE", "El servicio no está disponible actualmente.");

        var newStart = DateTime.SpecifyKind(request.AppointmentDate, DateTimeKind.Utc);
        var newEnd = newStart.AddMinutes(service.DurationMinutes);

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        if (newStart < colombiaNow)
            return BookingResult.Fail("PAST_DATE", "No se pueden agendar citas en horarios pasados.");

        var startOfDay = DateTime.SpecifyKind(newStart.Date, DateTimeKind.Utc);
        var endOfDay = startOfDay.AddDays(1);

        var existing = await _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.BarberId == request.BarberId
                        && a.AppointmentDate >= startOfDay
                        && a.AppointmentDate < endOfDay
                        && a.Status != AppointmentStatus.Cancelled)
            .ToListAsync();

        foreach (var appt in existing)
        {
            var eStart = appt.AppointmentDate;
            var eEnd = eStart.AddMinutes(appt.Service!.DurationMinutes);
            if (eStart < newEnd && newStart < eEnd)
                return BookingResult.Fail("SCHEDULE_CONFLICT", "El horario seleccionado ya fue reservado por otro cliente.");
        }

        var newAppointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = service.TenantId ?? string.Empty,
            BarberId = request.BarberId,
            ServiceId = request.ServiceId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            AppointmentDate = newStart,
            Status = AppointmentStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            LocationId = request.LocationId
        };

        await _context.Appointments.AddAsync(newAppointment);
        await _context.SaveChangesAsync();

        var tenant = await _context.Tenants.FindAsync(newAppointment.TenantId);
        _logger.LogInformation("[WhatsApp Check] TenantId={TenantId}, Tenant found={Found}, WhatsAppEnabled={Enabled}, CustomerPhone={Phone}",
            newAppointment.TenantId, tenant != null, tenant?.WhatsAppEnabled, newAppointment.CustomerPhone);

        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(newAppointment.CustomerPhone))
        {
            try
            {
                var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == newAppointment.BarberId);
                await _whatsAppService.SendConfirmationAsync(
                    appointmentId: newAppointment.Id,
                    toPhone: newAppointment.CustomerPhone!,
                    customerName: newAppointment.CustomerName,
                    tenantName: tenant.Name,
                    appointmentDate: newAppointment.AppointmentDate,
                    barberName: barber?.Name ?? "tu barbero",
                    tenantId: tenant.Id
                );
                _logger.LogInformation("[WhatsApp] Confirmation sent for appointment {Id}", newAppointment.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[WhatsApp] Failed to send confirmation for appointment {Id}", newAppointment.Id);
            }
        }

        return BookingResult.Ok(newAppointment);
    }

    public async Task<PagedResult<Appointment>> GetAllAsync(
        int page, int pageSize, string? status, DateTime? from, DateTime? to, Guid? filterByUserId = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status == status);

        if (from.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
            query = query.Where(a => a.AppointmentDate >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
            query = query.Where(a => a.AppointmentDate <= toUtc);
        }

        if (filterByUserId.HasValue)
            query = query.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(a => a.AppointmentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var tenantId = data.FirstOrDefault()?.TenantId;
        if (tenantId is not null)
        {
            var tenant = await _context.Tenants.FindAsync(tenantId);
            if (tenant is { LoyaltyEnabled: true })
            {
                var customerIds = data
                    .Where(a => a.CustomerId.HasValue)
                    .Select(a => a.CustomerId!.Value)
                    .Distinct()
                    .ToList();

                if (customerIds.Count > 0)
                {
                    var loyaltyCounts = await _context.Customers
                        .IgnoreQueryFilters()
                        .Where(c => customerIds.Contains(c.Id) && c.TenantId == tenantId)
                        .ToDictionaryAsync(c => c.Id, c => c.LoyaltyCount);

                    foreach (var appt in data)
                    {
                        if (appt.CustomerId.HasValue && loyaltyCounts.TryGetValue(appt.CustomerId.Value, out var count))
                        {
                            appt.CustomerLoyaltyCount = count;
                            appt.CustomerLoyaltyThreshold = tenant.LoyaltyThreshold;
                            appt.CustomerLoyaltyEnabled = true;
                        }
                    }
                }
            }
        }

        return new PagedResult<Appointment>
        {
            Data = data,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<Appointment?> UpdateStatusAsync(Guid id, string status, string? cancelledBy = null)
    {
        if (!AppointmentStatus.IsValid(status)) return null;

        var appointment = await _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment is null) return null;
        if (appointment.Status != AppointmentStatus.Pending) return null;

        appointment.Status = status;

        if (status == AppointmentStatus.Cancelled)
        {
            appointment.CancelledAt = DateTime.UtcNow;
            appointment.CancelledBy = cancelledBy;
        }

        if (status == AppointmentStatus.Completed)
        {
            if (appointment.CustomerId.HasValue && !appointment.IsFree)
            {
                var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
                if (tenant is { LoyaltyEnabled: true })
                {
                    var customer = await _context.Customers.FindAsync(appointment.CustomerId.Value);
                    if (customer is not null)
                        customer.LoyaltyCount += 1;
                }
            }

            appointment.AiDiagnosisJson = null;
        }

        await _context.SaveChangesAsync();

        if (status == AppointmentStatus.Cancelled && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
            if (tenant is { WhatsAppEnabled: true })
            {
                var appointmentId = appointment.Id;
                var customerPhone = appointment.CustomerPhone!;
                var customerName = appointment.CustomerName;
                var tenantName = tenant.Name;
                var appointmentDate = appointment.AppointmentDate;
                var barberName = appointment.Barber?.Name ?? "tu barbero";
                var tenantIdValue = tenant.Id;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _whatsAppService.SendCancellationAsync(
                            appointmentId: appointmentId,
                            toPhone: customerPhone,
                            customerName: customerName,
                            tenantName: tenantName,
                            appointmentDate: appointmentDate,
                            barberName: barberName,
                            tenantId: tenantIdValue
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[WhatsApp] Error al enviar cancelación en background para la cita {AppointmentId}", appointmentId);
                    }
                });
            }
        }

        return appointment;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var appointment = await _context.Appointments.FirstOrDefaultAsync(a => a.Id == id);
        if (appointment is null) return false;

        if (appointment.Status != AppointmentStatus.Completed &&
            appointment.Status != AppointmentStatus.Cancelled)
            return false;

        _context.Appointments.Remove(appointment);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<int> BulkDeleteAsync(IEnumerable<Guid> ids)
    {
        var idList = ids.ToList();
        var appointments = await _context.Appointments
            .Where(a => idList.Contains(a.Id) &&
                       (a.Status == AppointmentStatus.Completed || a.Status == AppointmentStatus.Cancelled))
            .ToListAsync();

        if (appointments.Count == 0) return 0;

        _context.Appointments.RemoveRange(appointments);
        await _context.SaveChangesAsync();
        return appointments.Count;
    }

    public async Task<int> DeleteOldTerminalAppointmentsAsync(int daysOld = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-daysOld);
        var old = await _context.Appointments
            .IgnoreQueryFilters()
            .Where(a => (a.Status == AppointmentStatus.Completed || a.Status == AppointmentStatus.Cancelled)
                        && a.AppointmentDate < cutoff)
            .ToListAsync();

        if (old.Count == 0) return 0;

        _context.Appointments.RemoveRange(old);
        await _context.SaveChangesAsync();
        return old.Count;
    }

    public async Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(
        Guid barberId, Guid serviceId, DateOnly date, int minimumLeadHours = 0, Guid? excludeAppointmentId = null, Guid? locationId = null)
    {
        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == serviceId);
        if (service is null) return [];

        if (locationId.HasValue)
        {
            var barberBelongsToLocation = await _context.Barbers
                .AnyAsync(b => b.Id == barberId && b.LocationId == locationId.Value);
            if (!barberBelongsToLocation) return [];
        }

        var tenant = await _context.Tenants.FindAsync(service.TenantId);
        if (tenant is { HolidaysEnabled: true } && ColombianHolidayService.IsHoliday(date))
            return [];

        var dayIndex = (int)date.DayOfWeek;
        var schedule = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == barberId && bs.DayOfWeek == dayIndex);

        if (schedule is null) return [];

        var dayStart = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        var existingAppointments = await _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.BarberId == barberId
                        && a.AppointmentDate >= dayStart
                        && a.AppointmentDate < dayEnd
                        && a.Status != AppointmentStatus.Cancelled
                        && (!excludeAppointmentId.HasValue || a.Id != excludeAppointmentId.Value))
            .ToListAsync();

        var slots = new List<AvailabilitySlotDto>();
        var duration = TimeSpan.FromMinutes(service.DurationMinutes);
        var scheduleEnd = new TimeSpan(schedule.EndHour, schedule.EndMinute, 0);
        var current = new TimeSpan(schedule.StartHour, schedule.StartMinute, 0);
        var colombiaOffset = TimeSpan.FromHours(-5);
        var now = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
        var minBookingTime = now.AddHours(minimumLeadHours);

        // Precalculate break window (null if not configured)
        TimeSpan? breakStart = schedule.BreakStartHour.HasValue && schedule.BreakStartMinute.HasValue
            ? new TimeSpan(schedule.BreakStartHour.Value, schedule.BreakStartMinute.Value, 0)
            : null;
        TimeSpan? breakEnd = schedule.BreakEndHour.HasValue && schedule.BreakEndMinute.HasValue
            ? new TimeSpan(schedule.BreakEndHour.Value, schedule.BreakEndMinute.Value, 0)
            : null;

        while (current.Add(duration) <= scheduleEnd)
        {
            var slotStart = dayStart.Add(current);
            var slotEnd = slotStart.Add(duration);

            var isPast = slotStart <= minBookingTime;

            // A slot overlaps the break if slotStart < breakEnd && slotEnd > breakStart
            // Guard: only apply if breakEnd > breakStart (ignore zero-length or inverted windows)
            var isDuringBreak = breakStart.HasValue && breakEnd.HasValue
                && breakEnd.Value > breakStart.Value
                && current < breakEnd.Value
                && current.Add(duration) > breakStart.Value;

            var hasConflict = !isPast && !isDuringBreak && existingAppointments.Any(a =>
            {
                var aStart = a.AppointmentDate;
                var aEnd = aStart.AddMinutes(a.Service!.DurationMinutes);
                return aStart < slotEnd && slotStart < aEnd;
            });

            slots.Add(new AvailabilitySlotDto
            {
                Time = $"{current.Hours:D2}:{current.Minutes:D2}",
                Available = !isPast && !isDuringBreak && !hasConflict
            });

            current = current.Add(TimeSpan.FromMinutes(30));
        }

        return slots;
    }

    public async Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Barber)
            .FirstOrDefaultAsync(a => a.Id == appointmentId);

        if (appointment is null)
            return RescheduleResult.Fail("NOT_FOUND", "Cita no encontrada.");

        if (appointment.Status != AppointmentStatus.Pending)
            return RescheduleResult.Fail("NOT_PENDING", "Solo se pueden reprogramar citas en estado Pendiente.");

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;

        if ((appointment.AppointmentDate - colombiaNow).TotalHours <= 6)
            return RescheduleResult.Fail("TOO_LATE", "No es posible reprogramar con menos de 6 horas de antelación.");

        if (newAppointmentDate <= colombiaNow)
            return RescheduleResult.Fail("PAST_DATE", "La nueva fecha debe ser en el futuro.");

        var slots = await GetAvailabilityAsync(
            appointment.BarberId, appointment.ServiceId,
            DateOnly.FromDateTime(newAppointmentDate),
            minimumLeadHours: 3,
            excludeAppointmentId: appointmentId);

        var requestedTime = newAppointmentDate.ToString("HH:mm");
        var slot = slots.FirstOrDefault(s => s.Time == requestedTime);
        if (slot is null || !slot.Available)
            return RescheduleResult.Fail("SCHEDULE_CONFLICT", "El horario seleccionado no está disponible.");

        appointment.AppointmentDate = DateTime.SpecifyKind(newAppointmentDate, DateTimeKind.Utc);
        appointment.ReminderSentAt = null;
        appointment.RescheduleTokenUsedAt = null;
        await _context.SaveChangesAsync();

        var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            await _whatsAppService.SendRescheduleAsync(
                appointmentId: appointment.Id,
                toPhone: appointment.CustomerPhone!,
                customerName: appointment.CustomerName,
                tenantName: tenant.Name,
                newAppointmentDate: appointment.AppointmentDate,
                barberName: appointment.Barber?.Name ?? "tu barbero",
                tenantId: tenant.Id
            );
        }

        return RescheduleResult.Ok(appointment);
    }

    public async Task<BookingResult> CreateWalkInAsync(CreateWalkInDto dto, Guid userId)
    {
        var barber = await _barberService.GetByUserIdAsync(userId);
        if (barber is null)
            return BookingResult.Fail("BARBER_NOT_FOUND", "No se encontró un barbero asociado a este usuario.");

        var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == dto.ServiceId);
        if (service is null)
            return BookingResult.Fail("SERVICE_NOT_FOUND", "El servicio solicitado no existe.");
        if (!service.IsActive)
            return BookingResult.Fail("SERVICE_INACTIVE", "El servicio no está disponible actualmente.");

        var appointmentDate = dto.AppointmentDate.HasValue
            ? DateTime.SpecifyKind(dto.AppointmentDate.Value, DateTimeKind.Utc)
            : DateTime.UtcNow;

        var isAiService = service.Name == "Corte + Diagnóstico IA";

        // Upsert ghost Customer si hay teléfono
        Customer? customer = null;
        if (!string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            customer = await _context.Customers
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.TenantId == _tenantService.TenantId && c.Phone == dto.CustomerPhone);

            if (customer is null)
            {
                customer = new Customer
                {
                    Id = Guid.NewGuid(),
                    Name = dto.CustomerName,
                    Phone = dto.CustomerPhone,
                    PasswordHash = string.Empty,
                    LoyaltyCount = 0,
                    CreatedAt = DateTime.UtcNow,
                };
                await _context.Customers.AddAsync(customer);
            }
        }

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            BarberId = barber.Id,
            ServiceId = dto.ServiceId,
            CustomerId = customer?.Id,
            CustomerName = dto.CustomerName,
            CustomerPhone = dto.CustomerPhone,
            AppointmentDate = appointmentDate,
            Status = isAiService ? AppointmentStatus.Pending : AppointmentStatus.Completed,
            CreatedAt = DateTime.UtcNow,
            IsWalkIn = true
        };

        await _context.Appointments.AddAsync(appointment);
        await _context.SaveChangesAsync(); // interceptor fija TenantId en ambas entidades

        // Loyalty: walk-ins quedan Completed directamente — no pasan por UpdateStatusAsync
        if (!isAiService && customer is not null)
        {
            var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
            if (tenant is { LoyaltyEnabled: true })
            {
                customer.LoyaltyCount += 1;
                await _context.SaveChangesAsync();
            }
        }

        var saved = await _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .FirstAsync(a => a.Id == appointment.Id);

        return BookingResult.Ok(saved);
    }
}