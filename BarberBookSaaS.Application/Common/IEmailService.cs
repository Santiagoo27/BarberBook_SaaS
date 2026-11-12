namespace BarberBookSaaS.Application.Common;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string tenantName, string resetLink);
}
