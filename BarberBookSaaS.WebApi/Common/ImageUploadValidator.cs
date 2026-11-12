namespace BarberBookSaaS.WebApi.Common;

public static class ImageUploadValidator
{
    private const long MaxSizeBytes = 2 * 1024 * 1024;
    private static readonly string[] AllowedMimeTypes = { "image/png", "image/jpeg", "image/jpg", "image/webp" };

    public static async Task<(string? Base64, string? Error)> ValidateAndConvertAsync(IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return (null, "No se recibió ningún archivo.");

        if (file.Length > MaxSizeBytes)
            return (null, "La imagen no puede superar los 2MB.");

        // SVG can embed scripts — only accept raster image formats
        if (!AllowedMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
            return (null, "Solo se aceptan imágenes PNG, JPEG o WebP.");

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var bytes = memoryStream.ToArray();

        // Validate magic bytes — Content-Type is client-supplied and cannot be trusted alone
        if (!IsAllowedImageMagicBytes(bytes))
            return (null, "El archivo no es una imagen válida.");

        var base64 = $"data:{file.ContentType};base64,{Convert.ToBase64String(bytes)}";
        return (base64, null);
    }

    private static bool IsAllowedImageMagicBytes(byte[] bytes)
    {
        if (bytes.Length < 4) return false;
        // PNG: 89 50 4E 47
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        // JPEG: FF D8 FF
        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        // WebP: RIFF....WEBP
        if (bytes.Length >= 12 &&
            bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
            bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return true;
        return false;
    }
}