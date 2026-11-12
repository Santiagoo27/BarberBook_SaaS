using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface ITokenService
{
    string CreateToken(User user);
    string CreateTokenForUser(Guid userId, string email, string role, string tenantId);
}