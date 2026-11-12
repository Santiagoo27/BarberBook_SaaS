using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mscc.GenerativeAI;
using Mscc.GenerativeAI.Types;

namespace BarberBookSaaS.Infrastructure.Services;

public class GeminiService : IAIService
{
    private readonly string _apiKey;
    private readonly string _textModel;
    private readonly string _imageModel;
    private readonly ILogger<GeminiService> _logger;

    private const string AnalysisPrompt = """
        Eres un experto tricólogo y estilista.
        Analiza el rostro de esta persona con detalle.
        Responde ÚNICAMENTE con el JSON especificado,
        sin texto adicional, sin markdown, sin comillas
        de código. Todo en español excepto casting_brief
        y name_en que van en inglés.
        Los productos deben tener beneficios
        científicamente comprobados según tricología.

        JSON requerido:
        {
          "face": {
            "shape": "forma en español natural ej: Ovalada",
            "skin_tone": "tono en español ej: Medio cálido",
            "forehead": "descripción en español",
            "cheekbones": "descripción en español",
            "jawline": "descripción en español",
            "hair_current": "tipo cabello en español",
            "overall": "resumen en español max 15 palabras",
            "casting_brief": "physical description in English for image generation: age range, face shape, skin tone, hair color and texture, eye color, distinctive features, expression"
          },
          "styles": [
            { "name": "nombre en español", "name_en": "name in English for image generation", "reason": "razón en español max 8 palabras" },
            { "name": "...", "name_en": "...", "reason": "..." },
            { "name": "...", "name_en": "...", "reason": "..." },
            { "name": "...", "name_en": "...", "reason": "..." }
          ],
          "why_works": [
            "razón 1 en español max 12 palabras",
            "razón 2",
            "razón 3",
            "razón 4"
          ],
          "products": [
            { "name": "nombre producto en español", "benefit": "beneficio científico max 8 palabras", "how_to_use": "cómo usar max 8 palabras" },
            { "name": "...", "benefit": "...", "how_to_use": "..." },
            { "name": "...", "benefit": "...", "how_to_use": "..." }
          ],
          "maintenance": "frecuencia mantenimiento en español"
        }
        """;

    public GeminiService(IConfiguration configuration, ILogger<GeminiService> logger)
    {
        _logger = logger;
        _apiKey = configuration["Google:ApiKey"]!;
        _textModel = configuration["Google:TextModel"] ?? "gemini-2.5-flash";
        _imageModel = configuration["Google:ImageModel"] ?? "gemini-2.5-flash-image";
        _logger.LogInformation("GeminiService activo — text:{TextModel} image:{ImageModel}", _textModel, _imageModel);
    }

    public async Task<AIDiagnosisResult> GetHaircutDiagnosisAsync(string imageBase64)
    {
        try
        {
            var analysisJson = await AnalyzeFaceAsync(imageBase64);
            var imageBytes = await GenerateStyleImageAsync(imageBase64, analysisJson);
            return new AIDiagnosisResult
            {
                AnalysisJson = analysisJson,
                ImageUrl = string.Empty,
                ImageBase64 = Convert.ToBase64String(imageBytes),
            };
        }
        catch (InvalidOperationException) { throw; }
        catch (GeminiApiTimeoutException ex)
        {
            _logger.LogError("Gemini: timeout por reintentos agotados — {Message}", ex.Message);
            var isQuota = ex.Message.Contains("quota", StringComparison.OrdinalIgnoreCase)
                       || ex.Message.Contains("429");
            throw new InvalidOperationException(isQuota
                ? "Cuota de Gemini agotada. El modelo de imagen requiere un plan de pago en Google AI."
                : "Gemini tardó demasiado, intenta de nuevo");
        }
        catch (GeminiApiException ex) when (ex.Response?.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _logger.LogError("Gemini: API Key inválida (401)");
            throw new InvalidOperationException("API Key de Google inválida");
        }
        catch (GeminiApiException ex) when (ex.Response?.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            _logger.LogError("Gemini: acceso denegado (403)");
            throw new InvalidOperationException("La API Key de Google no tiene permisos. Verifica que la API 'Generative Language' esté habilitada en tu proyecto de Google Cloud.");
        }
        catch (GeminiApiException ex) when (ex.Response?.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            _logger.LogError("Gemini: cuota excedida (429)");
            throw new InvalidOperationException("Cuota de Gemini agotada. El modelo de imagen requiere un plan de pago en Google AI.");
        }
        catch (GeminiApiException ex) when (ex.Response?.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            _logger.LogError("Gemini: solicitud rechazada (400): {Message}", ex.Message);
            throw new InvalidOperationException("La imagen no es válida para el análisis. Usa una foto JPEG o PNG con buena iluminación.");
        }
        catch (GeminiApiException ex)
        {
            _logger.LogError(ex, "Gemini: error de API ({StatusCode})", ex.Response?.StatusCode);
            throw new InvalidOperationException($"Error de Gemini: {ex.Response?.StatusCode}. Intenta de nuevo.");
        }
        catch (TaskCanceledException)
        {
            _logger.LogError("Gemini: timeout");
            throw new InvalidOperationException("Gemini tardó demasiado, intenta de nuevo");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini: error inesperado");
            throw;
        }
    }

    private async Task<string> AnalyzeFaceAsync(string imageBase64)
    {
        var googleAI = new GoogleAI(apiKey: _apiKey);
        var model = googleAI.GenerativeModel(model: _textModel);

        var request = new GenerateContentRequest(AnalysisPrompt);
        var mimeType = DetectMimeType(imageBase64);
        await request.AddMedia(imageBase64, mimeType: mimeType);

        var response = await model.GenerateContent(request);
        var raw = response.Text;

        _logger.LogInformation("Gemini análisis completado: {Chars} chars", raw?.Length ?? 0);

        if (string.IsNullOrWhiteSpace(raw) || HasNoFaceResponse(raw))
            throw new InvalidOperationException("No se detectó un rostro en la foto");

        var json = ExtractJson(raw);
        if (!json.TrimStart().StartsWith('{'))
            throw new InvalidOperationException("No se detectó un rostro en la foto");

        return json;
    }

    private async Task<byte[]> GenerateStyleImageAsync(string imageBase64, string analysisJson)
    {
        var root = JsonNode.Parse(analysisJson)!;
        var face = root["face"]!;
        var styles = root["styles"]!.AsArray();

        var castingBrief = face["casting_brief"]?.GetValue<string>() ?? "";

        string StyleEn(int i) => styles.Count > i
            ? styles[i]?["name_en"]?.GetValue<string>() ?? $"Style {i + 1}"
            : $"Style {i + 1}";

        var s0 = StyleEn(0);
        var s1 = StyleEn(1);
        var s2 = StyleEn(2);
        var s3 = StyleEn(3);

        var prompt = $"""
            You are looking at a photo of a person.
            Generate a 2x2 grid image showing this exact same person with 4 different hairstyles.

            The person has these characteristics:
            {castingBrief}

            Panel top-left: {s0} hairstyle
            Panel top-right: {s1} hairstyle
            Panel bottom-left: {s2} hairstyle
            Panel bottom-right: {s3} hairstyle

            CRITICAL rules:
            - Keep the EXACT same face in all 4 panels
            - Same skin tone, same eyes, same nose, same jaw
            - Only change the hairstyle
            - Dark gray background (#1a1a1a)
            - Professional barbershop studio photography
            - Photorealistic, not illustrated
            - NO text, NO labels, NO watermarks in the image
            """;

        var googleAI = new GoogleAI(apiKey: _apiKey);
        var model = googleAI.GenerativeModel(model: _imageModel);

        var generationConfig = new GenerationConfig
        {
            ResponseModalities = [ResponseModality.Image, ResponseModality.Text]
        };

        var request = new GenerateContentRequest(prompt);
        request.GenerationConfig = generationConfig;
        var mimeType = DetectMimeType(imageBase64);
        await request.AddMedia(imageBase64, mimeType: mimeType);

        var response = await model.GenerateContent(request);

        if (response.Candidates != null)
        {
            foreach (var candidate in response.Candidates)
            {
                if (candidate.Content?.Parts == null) continue;
                foreach (var part in candidate.Content.Parts)
                {
                    if (part.InlineData is { Data: not null, MimeType: not null } inlineData
                        && inlineData.MimeType.StartsWith("image/"))
                    {
                        var imageBytes = Convert.FromBase64String(inlineData.Data);
                        _logger.LogInformation("Imagen generada por Gemini: {Kb} KB", imageBytes.Length / 1024);
                        return imageBytes;
                    }
                }
            }
        }

        throw new InvalidOperationException("Gemini no generó la imagen de estilos. Intenta de nuevo.");
    }

    private static string ExtractJson(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```"))
        {
            var start = trimmed.IndexOf('\n') + 1;
            var end = trimmed.LastIndexOf("```");
            if (end > start) trimmed = trimmed[start..end].Trim();
        }
        if (trimmed.StartsWith('{') && trimmed.EndsWith('}')) return trimmed;
        var match = Regex.Match(trimmed, @"\{[\s\S]*\}");
        return match.Success ? match.Value.Trim() : trimmed;
    }

    private static string DetectMimeType(string base64)
    {
        if (base64.StartsWith("/9j/")) return "image/jpeg";
        if (base64.StartsWith("iVBO")) return "image/png";
        if (base64.StartsWith("R0lG")) return "image/gif";
        if (base64.StartsWith("UklG")) return "image/webp";
        return "image/jpeg";
    }

    private static bool HasNoFaceResponse(string text) =>
        text.Contains("no hay rostro", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no se puede ver", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no se puede identificar", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no contiene un rostro", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no hay un rostro", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no puedo analizar", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no puedo ver", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("no se detecta", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("I can't analyze", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("I cannot analyze", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("I'm unable to analyze", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("unable to process", StringComparison.OrdinalIgnoreCase);
}
