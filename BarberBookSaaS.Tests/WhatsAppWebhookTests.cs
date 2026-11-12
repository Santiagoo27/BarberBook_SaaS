using System.Net;
using System.Security.Cryptography;
using System.Text;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class WhatsAppWebhookTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "webhook-t1";
    private Guid _appointmentId;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant
        {
            Id = TenantId,
            Name = "Webhook Test",
            Subdomain = TenantId,
            WhatsAppEnabled = true
        });

        var barber = new Barber
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Barbero Webhook",
            Email = "barbero.webhook@test.com",
            Phone = "+573000000000",
            Specialty = "General"
        };
        db.Barbers.Add(barber);

        var service = new Service
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Corte",
            Price = 20000,
            DurationMinutes = 30
        };
        db.Services.Add(service);

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            BarberId = barber.Id,
            ServiceId = service.Id,
            CustomerName = "Cliente Webhook",
            CustomerPhone = "+573001234567",
            AppointmentDate = DateTime.UtcNow.AddDays(2),
            Status = AppointmentStatus.Pending
        };
        db.Appointments.Add(appointment);
        _appointmentId = appointment.Id;

        await db.SaveChangesAsync();
    }

    private static string ComputeSignature(string body, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        return "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();
    }

    [Fact]
    public async Task Verify_WithCorrectToken_ReturnsChallenge()
    {
        var response = await _client.GetAsync(
            "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("12345", body);
    }

    [Fact]
    public async Task Verify_WithIncorrectToken_ReturnsForbidden()
    {
        var response = await _client.GetAsync(
            "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=12345");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithInvalidSignature_ReturnsUnauthorized()
    {
        var json = "{\"entry\":[]}";
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/whatsapp/webhook")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", "sha256=invalid");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithCancelButtonPayload_CancelsAppointment()
    {
        var cancelPayload = $"CANCELAR:{TenantId}:{_appointmentId:N}";
        var json = $$"""
        {
          "entry": [
            {
              "changes": [
                {
                  "value": {
                    "messages": [
                      {
                        "from": "573001234567",
                        "type": "button",
                        "button": { "payload": "{{cancelPayload}}" }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
        """;

        var signature = ComputeSignature(json, "test-app-secret");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/whatsapp/webhook")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", signature);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var appointment = await db.Appointments.IgnoreQueryFilters().FirstAsync(a => a.Id == _appointmentId);

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
    }
}
