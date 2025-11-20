using backendAPI.Models;

namespace backendAPI.Services
{
    public interface ITokenService
    {
        // Define que o serviço DEVE ter um método
        // que recebe um Usuário e devolve uma string (o token)
        string GenerateToken(User user);
    }
}