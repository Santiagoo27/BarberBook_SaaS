using System.Security.Cryptography;
using System.Text;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class AppointmentTokenService : IAppointmentTokenService
{
    private readonly byte[] _key;
    private readonly ILogger<AppointmentTokenService> _logger;

    public AppointmentTokenService(IConfiguration config, ILogger<AppointmentTokenService> logger)
    {
        _logger = logger;
        var jwtKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key 'Jwt:Key' is not configured in appsettings.json.");

        _key = Encoding.UTF8.GetBytes(jwtKey);
    }

    public string GenerateToken(Guid appointmentId, DateTime expiresAtUtc)
    {
        var payload = $"{appointmentId:N}|{expiresAtUtc.Ticks}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);

        using var hmac = new HMACSHA256(_key);
        var signatureBytes = hmac.ComputeHash(payloadBytes);

        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(signatureBytes)}";
    }

    public Guid? ValidateToken(string token)
    {
        var segments = token.Split('.');
        if (segments.Length != 2)
        {
            _logger.LogWarning("[TokenValidation] Token no tiene 2 segmentos (tiene {Count}). Token: {Token}", segments.Length, token);
            return null;
        }

        byte[] payloadBytes;
        byte[] signatureBytes;
        try
        {
            payloadBytes = Base64UrlDecode(segments[0]);
            signatureBytes = Base64UrlDecode(segments[1]);
        }
        catch (FormatException ex)
        {
            _logger.LogWarning("[TokenValidation] Error decodificando base64: {Error}", ex.Message);
            return null;
        }

        using var hmac = new HMACSHA256(_key);
        var expectedSignature = hmac.ComputeHash(payloadBytes);

        if (!CryptographicOperations.FixedTimeEquals(expectedSignature, signatureBytes))
        {
            _logger.LogWarning("[TokenValidation] Firma HMAC no coincide");
            return null;
        }

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var parts = payload.Split('|');
        if (parts.Length != 2)
        {
            _logger.LogWarning("[TokenValidation] Payload no tiene 2 partes: {Payload}", payload);
            return null;
        }

        if (!Guid.TryParseExact(parts[0], "N", out var appointmentId))
        {
            _logger.LogWarning("[TokenValidation] GUID inválido: {Guid}", parts[0]);
            return null;
        }
        if (!long.TryParse(parts[1], out var expiresAtTicks))
        {
            _logger.LogWarning("[TokenValidation] Ticks inválidos: {Ticks}", parts[1]);
            return null;
        }

        var expiresAt = new DateTime(expiresAtTicks, DateTimeKind.Unspecified);
        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        if (colombiaNow > expiresAt)
        {
            _logger.LogWarning("[TokenValidation] Token expirado. Expira: {Expires}, ColombiaNow: {Now}", expiresAt, colombiaNow);
            return null;
        }

        return appointmentId;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
