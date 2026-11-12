namespace BarberBookSaaS.Infrastructure.Services;

public static class ColombianHolidayService
{
    public static bool IsHoliday(DateOnly date) => GetHolidayName(date) is not null;

    public static string? GetHolidayName(DateOnly date)
    {
        var holidays = GetHolidays(date.Year);
        var index = holidays.FindIndex(h => h.Date == date);
        return index >= 0 ? holidays[index].Name : null;
    }

    public static List<(DateOnly Date, string Name)> GetHolidays(int year)
    {
        var easter = CalculateEaster(year);
        var holidays = new List<(DateOnly Date, string Name)>
        {
            // Festivos fijos (no se mueven)
            (new DateOnly(year, 1, 1), "Año Nuevo"),
            (new DateOnly(year, 5, 1), "Día del Trabajo"),
            (new DateOnly(year, 7, 20), "Independencia de Colombia"),
            (new DateOnly(year, 8, 7), "Batalla de Boyacá"),
            (new DateOnly(year, 12, 8), "Inmaculada Concepción"),
            (new DateOnly(year, 12, 25), "Navidad"),

            // Festivos Ley Emiliani (se mueven al lunes siguiente)
            (MoveToMonday(new DateOnly(year, 1, 6)), "Reyes Magos"),
            (MoveToMonday(new DateOnly(year, 3, 19)), "San José"),
            (MoveToMonday(new DateOnly(year, 6, 29)), "San Pedro y San Pablo"),
            (MoveToMonday(new DateOnly(year, 8, 15)), "Asunción de la Virgen"),
            (MoveToMonday(new DateOnly(year, 10, 12)), "Día de la Raza"),
            (MoveToMonday(new DateOnly(year, 11, 1)), "Todos los Santos"),
            (MoveToMonday(new DateOnly(year, 11, 11)), "Independencia de Cartagena"),

            // Festivos basados en Pascua
            (easter.AddDays(-3), "Jueves Santo"),
            (easter.AddDays(-2), "Viernes Santo"),
            (MoveToMonday(easter.AddDays(43)), "Ascensión del Señor"),
            (MoveToMonday(easter.AddDays(64)), "Corpus Christi"),
            (MoveToMonday(easter.AddDays(71)), "Sagrado Corazón de Jesús"),
        };

        holidays.Sort((a, b) => a.Date.CompareTo(b.Date));
        return holidays;
    }

    public static List<string> GetHolidayDatesIso(int year) =>
        GetHolidays(year).Select(h => h.Date.ToString("yyyy-MM-dd")).ToList();

    private static DateOnly MoveToMonday(DateOnly date)
    {
        if (date.DayOfWeek == DayOfWeek.Monday) return date;
        var daysUntilMonday = ((int)DayOfWeek.Monday - (int)date.DayOfWeek + 7) % 7;
        if (daysUntilMonday == 0) daysUntilMonday = 7;
        return date.AddDays(daysUntilMonday);
    }

    private static DateOnly CalculateEaster(int year)
    {
        var a = year % 19;
        var b = year / 100;
        var c = year % 100;
        var d = b / 4;
        var e = b % 4;
        var f = (b + 8) / 25;
        var g = (b - f + 1) / 3;
        var h = (19 * a + b - d - g + 15) % 30;
        var i = c / 4;
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = (a + 11 * h + 22 * l) / 451;
        var month = (h + l - 7 * m + 114) / 31;
        var day = (h + l - 7 * m + 114) % 31 + 1;
        return new DateOnly(year, month, day);
    }
}
