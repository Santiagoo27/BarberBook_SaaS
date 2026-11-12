using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Infrastructure;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Infrastructure.Services;
using BarberBookSaaS.WebApi;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using BarberBookSaaS.WebApi.Middleware;

var builder = WebApplication.CreateBuilder(args);

// =========================================================================
// 1. REGISTRO DE SERVICIOS
// =========================================================================

builder.Services.AddControllers();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
}

var corsOrigins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("BarberBookCorsPolicy", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .WithHeaders("Content-Type", "Authorization", "X-Tenant-Id")
              .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
              .AllowCredentials()
              .WithExposedHeaders("X-Tenant-Id");
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
        options.UseNpgsql(connectionString);
    else
        options.UseSqlite("Data Source=../BarberBookSaaS.WebApi/barberbook.db");
});

builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAppointmentService, AppointmentService>();
builder.Services.AddScoped<IBrandingService, BrandingService>();
builder.Services.AddScoped<IBarberService, BarberService>();
builder.Services.AddScoped<IServiceService, ServiceService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<ILoyaltyService, LoyaltyService>();
builder.Services.AddScoped<ICustomerAuthService, CustomerAuthService>();
builder.Services.AddScoped<ISuperAdminService, SuperAdminService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddSingleton<IAppointmentTokenService, AppointmentTokenService>();
var gmailUser = builder.Configuration["Email:GmailUser"];
if (!string.IsNullOrEmpty(gmailUser))
    builder.Services.AddScoped<IEmailService, GmailEmailService>();
else
    builder.Services.AddHttpClient<IEmailService, MailtrapEmailService>();

var googleApiKey = builder.Configuration["Google:ApiKey"];
if (string.IsNullOrEmpty(googleApiKey))
    builder.Services.AddScoped<IAIService, MockAIService>();
else
    builder.Services.AddScoped<IAIService, GeminiService>();

var metaAccessToken = builder.Configuration["Meta:AccessToken"];
if (!string.IsNullOrEmpty(metaAccessToken))
    builder.Services.AddHttpClient<IWhatsAppService, MetaWhatsAppService>();
else
    builder.Services.AddSingleton<IWhatsAppService, ConsoleWhatsAppService>();

builder.Services.AddHostedService<AppointmentReminderHostedService>();
builder.Services.AddHostedService<AppointmentCleanupService>();
builder.Services.AddResponseCompression(o => o.EnableForHttps = true);

var isTestEnv = builder.Environment.IsEnvironment("Testing");
var isProd = builder.Environment.IsProduction();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isTestEnv ? int.MaxValue : isProd ? 30 : 50,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    options.AddPolicy("public-register", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isTestEnv ? int.MaxValue : isProd ? 20 : 100,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    options.AddPolicy("public-review", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isTestEnv ? int.MaxValue : isProd ? 5 : 30,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IConfiguration>((options, configuration) =>
    {
        var jwtKey = configuration["Jwt:Key"];
        if (string.IsNullOrEmpty(jwtKey))
            throw new InvalidOperationException(
                "JWT key 'Jwt:Key' is not configured. Set it in appsettings.Development.json or environment variables.");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = configuration["Jwt:Issuer"] ?? "BarberBookSaaS",
            ValidateAudience = true,
            ValidAudience = configuration["Jwt:Audience"] ?? "BarberBookSaaS",
            ClockSkew = TimeSpan.Zero
        };
    });

var app = builder.Build();

// =========================================================================
// 2. MIDDLEWARES
// =========================================================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "BarberBook API v1");
    });
}

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseResponseCompression();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (app.Environment.IsProduction())
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

app.UseCors("BarberBookCorsPolicy");
app.UseMiddleware<TenantMiddleware>();
app.UseMiddleware<TenantStatusMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<MustChangePasswordMiddleware>();
app.UseRateLimiter();
app.MapControllers();

// Seed SuperAdmin on startup if not present (skip in Testing — DB schema may not exist yet)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await DataSeeder.SeedSuperAdminAsync(db, app.Configuration);
}

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
