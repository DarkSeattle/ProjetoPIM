using backendAPI.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace backendAPI.Services
{
    public class TokenService : ITokenService
    {
        private readonly IConfiguration _configuration;

        public TokenService(IConfiguration configuration)
        {
            // Precisamos da IConfiguration para ler o "Secret" do appsettings.json
            _configuration = configuration;
        }

        public string GenerateToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();

            // Pegamos a chave secreta que definimos no appsettings.json
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"]);

            // Definimos as "Claims" (informações que vão dentro do token)
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    // Informações que queremos guardar no token
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Name),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                // Define o tempo de expiração do token (ex: 8 horas)
                Expires = DateTime.UtcNow.AddHours(8),

                // Define a credencial de assinatura (usando nossa chave secreta)
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            // Cria o token
            var token = tokenHandler.CreateToken(tokenDescriptor);

            // Escreve o token como uma string
            return tokenHandler.WriteToken(token);
        }
    }
}