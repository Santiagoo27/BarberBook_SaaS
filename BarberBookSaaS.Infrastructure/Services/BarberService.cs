using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Barbers;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Domain.Constants;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class BarberService : IBarberService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public BarberService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<IEnumerable<Barber>> GetAllAsync()
        => await _context.Barbers.ToListAsync();

    public async Task<Barber?> GetByUserIdAsync(Guid userId)
        => await _context.Barbers.FirstOrDefaultAsync(b => b.UserId == userId && b.IsActive);

    public async Task<CreateBarberResponseDto> CreateAsync(CreateBarberDto dto)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();

        var tempPassword = TemporaryPasswordGenerator.Generate();

        var tenantId = _tenantService.TenantId;
        if (string.IsNullOrEmpty(tenantId))
            throw new InvalidOperationException("No hay tenant activo. El admin debe estar autenticado con un subdominio válido.");

        var emailLower = dto.Email.ToLower();
        var emailExists = await _context.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Email == emailLower && u.TenantId == tenantId);
        if (emailExists)
            throw new InvalidOperationException("Ya existe un usuario con este correo en la barbería.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = dto.Email.ToLower(),
            Role = UserRoles.Barber,
            PasswordHash = BCryptNet.HashPassword(tempPassword),
            IsActive = true,
            MustChangePassword = true
        };

        var barber = new Barber
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = dto.Name,
            Email = dto.Email.ToLower(),
            Phone = dto.Phone,
            Specialty = dto.Specialty,
            IsActive = true,
            UserId = user.Id
        };

        // Auto-asignar a Sede Principal si el tenant tiene exactamente 1 sede activa.
        // Con 0 o 2+ sedes, la asignación queda manual desde el panel de Sedes.
        // Se traen solo los Ids (no las entidades completas) para evitar que EF Core
        // trackee la Location y genere fixup de navegación Barber<->Location<->Barbers,
        // lo cual produce un ciclo al serializar la respuesta a JSON.
        var sedeIds = await _context.Locations.Where(l => l.IsActive).Select(l => l.Id).ToListAsync();
        if (sedeIds.Count == 1)
            barber.LocationId = sedeIds[0];

        await _context.Users.AddAsync(user);
        await _context.Barbers.AddAsync(barber);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return new CreateBarberResponseDto
        {
            Barber = barber,
            TemporaryPassword = tempPassword
        };
    }

    public async Task<Barber?> UpdateAsync(Guid id, UpdateBarberDto dto)
    {
        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == id);
        if (barber is null) return null;

        barber.Name = dto.Name;
        barber.Email = dto.Email.ToLower();
        barber.Phone = dto.Phone;
        barber.Specialty = dto.Specialty;

        await _context.SaveChangesAsync();
        return barber;
    }

    public async Task<int?> DeleteAsync(Guid id)
    {
        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == id);
        if (barber is null) return null;

        using var transaction = await _context.Database.BeginTransactionAsync();

        var pendingAppointments = await _context.Appointments
            .Where(a => a.BarberId == id && a.Status == AppointmentStatus.Pending)
            .ToListAsync();

        foreach (var appt in pendingAppointments)
            appt.Status = AppointmentStatus.Cancelled;

        barber.IsActive = false;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return pendingAppointments.Count;
    }

    public async Task<bool?> HardDeleteAsync(Guid id)
    {
        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == id);
        if (barber is null) return null;

        var hasAppointments = await _context.Appointments.AnyAsync(a => a.BarberId == id);
        if (hasAppointments) return false;

        using var transaction = await _context.Database.BeginTransactionAsync();

        var schedules = await _context.BarberSchedules.Where(bs => bs.BarberId == id).ToListAsync();
        _context.BarberSchedules.RemoveRange(schedules);

        if (barber.UserId.HasValue)
        {
            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == barber.UserId.Value);
            if (user is not null)
                _context.Users.Remove(user);
        }

        _context.Barbers.Remove(barber);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    public async Task<bool> ActivateAsync(Guid id)
    {
        var barber = await _context.Barbers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == _tenantService.TenantId);
        if (barber is null) return false;

        barber.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateImageAsync(Guid id, string base64Image)
    {
        var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == id);
        if (barber is null) return false;

        barber.ImageBase64 = base64Image;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<BarberSchedule>> GetScheduleAsync(Guid id)
        => await _context.BarberSchedules
            .Where(bs => bs.BarberId == id)
            .OrderBy(bs => bs.DayOfWeek)
            .ToListAsync();

    public async Task UpsertScheduleDayAsync(Guid id, BarberScheduleDto request)
    {
        var barberExists = await _context.Barbers.AnyAsync(b => b.Id == id);
        if (!barberExists) return;

        var existing = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == id && bs.DayOfWeek == request.DayOfWeek);

        if (existing is not null)
        {
            existing.StartHour = request.StartHour;
            existing.StartMinute = request.StartMinute;
            existing.EndHour = request.EndHour;
            existing.EndMinute = request.EndMinute;
            existing.BreakStartHour = request.BreakStartHour;
            existing.BreakStartMinute = request.BreakStartMinute;
            existing.BreakEndHour = request.BreakEndHour;
            existing.BreakEndMinute = request.BreakEndMinute;
        }
        else
        {
            await _context.BarberSchedules.AddAsync(new BarberSchedule
            {
                Id = Guid.NewGuid(),
                BarberId = id,
                DayOfWeek = request.DayOfWeek,
                StartHour = request.StartHour,
                StartMinute = request.StartMinute,
                EndHour = request.EndHour,
                EndMinute = request.EndMinute,
                BreakStartHour = request.BreakStartHour,
                BreakStartMinute = request.BreakStartMinute,
                BreakEndHour = request.BreakEndHour,
                BreakEndMinute = request.BreakEndMinute,
            });
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteScheduleDayAsync(Guid id, int day)
    {
        var existing = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == id && bs.DayOfWeek == day);

        if (existing is not null)
        {
            _context.BarberSchedules.Remove(existing);
            await _context.SaveChangesAsync();
        }
    }

}