using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.SuperAdmin;

public class UpdateTenantPlanDto
{
    [Required]
    [RegularExpression("^(Standard|Premium|PremiumUnlimited)$", ErrorMessage = "Plan must be 'Standard', 'Premium', or 'PremiumUnlimited'.")]
    public string Plan { get; set; } = "Standard";
}
