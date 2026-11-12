namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class DailyRevenueDto
{
    public string Day { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int Appointments { get; set; }
}
