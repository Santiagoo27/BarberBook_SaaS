namespace BarberBookSaaS.Application.DTOs.SuperAdmin;

public class TenantSummaryDto
{
    public string Id           { get; set; } = string.Empty;
    public string Name         { get; set; } = string.Empty;
    public string? Phone       { get; set; }
    public string? Address     { get; set; }
    public string? Theme       { get; set; }
    public string AdminEmail   { get; set; } = "—";
    public int TotalAppointments { get; set; }
    public int TotalBarbers      { get; set; }
    public string Plan           { get; set; } = "Standard";
    public bool IsWebActive      { get; set; } = true;
    public bool WhatsAppEnabled  { get; set; } = false;
    public int TotalDiagnoses    { get; set; }
    public DateTime CreatedAt        { get; set; }
    public DateTime CurrentPeriodStart { get; set; }
    public int DiagnosisRemaining    { get; set; } = -2; // -2=N/A (Standard), -1=unlimited, 0-100=remaining
}
