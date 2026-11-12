using BarberBookSaaS.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BarberBookSaaS.Tests;

public class AppointmentTokenServiceTests
{
    private static AppointmentTokenService CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "TestSecretKeyForUnitTests_AtLeast32Chars!"
            })
            .Build();

        return new AppointmentTokenService(config, NullLogger<AppointmentTokenService>.Instance);
    }

    [Fact]
    public void GenerateAndValidate_RoundTrip_ReturnsAppointmentId()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        var result = service.ValidateToken(token);

        Assert.Equal(appointmentId, result);
    }

    [Fact]
    public void Validate_ExpiredToken_ReturnsNull()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(-1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        var result = service.ValidateToken(token);

        Assert.Null(result);
    }

    [Fact]
    public void Validate_TamperedToken_ReturnsNull()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        // Tamper the first character of the signature portion (after the '.').
        // Avoid the last character which may only affect base64 padding bits.
        var dotIndex = token.IndexOf('.');
        var sigStart = dotIndex + 1;
        var tampered = token[..sigStart] + (token[sigStart] == 'A' ? 'B' : 'A') + token[(sigStart + 1)..];
        var result = service.ValidateToken(tampered);

        Assert.Null(result);
    }

    [Fact]
    public void Validate_MalformedToken_ReturnsNull()
    {
        var service = CreateService();

        Assert.Null(service.ValidateToken("not-a-valid-token"));
        Assert.Null(service.ValidateToken(""));
        Assert.Null(service.ValidateToken("onlyonepart"));
    }
}
