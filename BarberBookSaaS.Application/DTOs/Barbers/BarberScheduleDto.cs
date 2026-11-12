namespace BarberBookSaaS.Application.DTOs.Barbers;

public class BarberScheduleDto
{
    public int DayOfWeek { get; set; }
    public int StartHour { get; set; }
    public int StartMinute { get; set; }
    public int EndHour { get; set; }
    public int EndMinute { get; set; }

    public int? BreakStartHour { get; set; }
    public int? BreakStartMinute { get; set; }
    public int? BreakEndHour { get; set; }
    public int? BreakEndMinute { get; set; }
}
