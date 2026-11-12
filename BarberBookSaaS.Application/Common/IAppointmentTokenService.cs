namespace BarberBookSaaS.Application.Common;

public interface IAppointmentTokenService
{
    string GenerateToken(Guid appointmentId, DateTime expiresAtUtc);

    Guid? ValidateToken(string token);
}
