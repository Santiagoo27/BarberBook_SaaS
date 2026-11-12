namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class DashboardStatsDto
{
    public int TodayAppointments { get; set; }
    public decimal TodayRevenue { get; set; }
    public int PendingAppointments { get; set; }
    public int TotalActiveBarbers { get; set; }
    public BusiestBarberDto? BusiestBarber { get; set; }
    public int UpcomingAppointments { get; set; }
    public decimal WeekRevenue { get; set; }
    public int TodayWalkIns { get; set; }
    public int TotalWalkIns { get; set; }
}

public class BusiestBarberDto
{
    public string Name { get; set; } = string.Empty;
    public int AppointmentsToday { get; set; }
}