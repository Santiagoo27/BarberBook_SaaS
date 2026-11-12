namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class PeriodStatsDto
{
    public int TotalAppointments { get; set; }
    public decimal TotalRevenue { get; set; }
    public int NewCustomers { get; set; }
    public int TotalWalkIns { get; set; }
}
