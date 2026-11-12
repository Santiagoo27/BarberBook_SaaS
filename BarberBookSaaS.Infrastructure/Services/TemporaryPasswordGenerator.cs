using System.Security.Cryptography;

namespace BarberBookSaaS.Infrastructure.Services;

public static class TemporaryPasswordGenerator
{
    public static string Generate()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        const string symbols = "!@#$%&*";
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[11];
        rng.GetBytes(bytes);
        var password = new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
        var symbolByte = new byte[1];
        rng.GetBytes(symbolByte);
        return password + symbols[symbolByte[0] % symbols.Length];
    }
}
