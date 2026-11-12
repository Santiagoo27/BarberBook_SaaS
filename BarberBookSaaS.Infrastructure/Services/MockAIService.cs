using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.Infrastructure.Services;

public class MockAIService : IAIService
{
    public Task<AIDiagnosisResult> GetHaircutDiagnosisAsync(string imageBase64)
    {
        const string mockJson = """
            {
              "face": {
                "shape": "Ovalado con frente amplia",
                "skin_tone": "Tono oliva mediterráneo",
                "forehead": "Amplia y ligeramente prominente",
                "cheekbones": "Pómulos bien definidos",
                "jawline": "Mandíbula moderadamente definida",
                "hair_current": "Cabello liso, grueso y de color oscuro",
                "overall": "Hombre de rostro ovalado con tono oliva, frente amplia y cabello liso grueso"
              },
              "styles": [
                { "name": "Crop con Fade", "name_en": "Textured Crop Fade", "reason": "Define frente y aporta volumen superior" },
                { "name": "Quiff con Degradado", "name_en": "Mid Fade Quiff", "reason": "Alarga visualmente el rostro ovalado" },
                { "name": "Taper Clásico", "name_en": "Classic Taper Cut", "reason": "Elegante y atemporal para forma ovalada" },
                { "name": "Fade Natural", "name_en": "Low Fade Natural Top", "reason": "Versátil y de bajo mantenimiento" }
              ],
              "why_works": [
                "La forma ovalada es compatible con prácticamente cualquier corte",
                "Los fades laterales armonizan con los pómulos definidos",
                "El volumen superior equilibra la amplitud de la frente",
                "Los cortes texturizados potencian el cabello grueso natural"
              ],
              "products": [
                { "name": "Pomada de arcilla", "benefit": "Control de textura sin residuo graso", "how_to_use": "Aplicar en cabello seco con los dedos" },
                { "name": "Aceite de argán", "benefit": "Hidratación y brillo sin efecto graso", "how_to_use": "Dos gotas en puntas antes de secar" },
                { "name": "Spray voluminizador", "benefit": "Incremento de volumen en raíz comprobado", "how_to_use": "Aplicar en raíz con cabello húmedo" }
              ],
              "maintenance": "Visita a la barbería cada 3 a 4 semanas"
            }
            """;

        return Task.FromResult(new AIDiagnosisResult
        {
            AnalysisJson = mockJson,
            ImageUrl = string.Empty,
            ImageBase64 = string.Empty,
        });
    }
}
