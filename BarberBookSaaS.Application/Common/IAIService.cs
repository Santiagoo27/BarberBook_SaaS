namespace BarberBookSaaS.Application.Common;

public class AIDiagnosisResult
{
    public string AnalysisJson { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string ImageBase64 { get; set; } = string.Empty;
}

public interface IAIService
{
    Task<AIDiagnosisResult> GetHaircutDiagnosisAsync(string imageBase64);
}
