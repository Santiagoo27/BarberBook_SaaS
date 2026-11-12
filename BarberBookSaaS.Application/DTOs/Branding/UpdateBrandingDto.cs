namespace BarberBookSaaS.Application.DTOs.Branding;

public class UpdateBrandingDto
{
    public string Theme { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string SecondaryColor { get; set; } = string.Empty;
}