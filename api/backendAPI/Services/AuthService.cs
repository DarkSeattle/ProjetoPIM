// Services/AuthService.cs
using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace backendAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly ITokenService _tokenService;

        // ✅ REMOVER a dependência do PasswordService
        public AuthService(AppDbContext context, ITokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        public async Task<LoginResponseDto> LoginAsync(LoginDto loginDto)
        {
            // Buscar usuário por email
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

            if (user == null)
            {
                return new LoginResponseDto
                {
                    Success = false,
                    Message = "Email não encontrado."
                };
            }

            // ✅ SIMPLES: Comparação direta da senha em texto puro
            if (loginDto.Password != user.PasswordHash)
            {
                return new LoginResponseDto
                {
                    Success = false,
                    Message = "Senha incorreta."
                };
            }

            // Gerar token
            var token = _tokenService.GenerateToken(user);

            return new LoginResponseDto
            {
                Success = true,
                Message = "Login realizado com sucesso!",
                User = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    CreatedAt = user.CreatedAt
                },
                Token = token
            };
        }

        public async Task<ApiResponse<UserDto>> RegisterAsync(RegisterDto registerDto)
        {
            // Verificar se o email já existe
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == registerDto.Email);

            if (existingUser != null)
            {
                return ApiResponse<UserDto>.ErrorResponse(
                    "Este email já está cadastrado.",
                    new List<string> { "Email já existe no sistema." }
                );
            }

            // Criar novo usuário
            var user = new User
            {
                Name = registerDto.Name,
                Email = registerDto.Email,
                // ✅ SIMPLES: Salvar senha diretamente
                PasswordHash = registerDto.Password,
                Role = registerDto.Role,
                CreatedAt = DateTime.Now.ToUniversalTime()
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return ApiResponse<UserDto>.SuccessResponse(
                new UserDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    CreatedAt = user.CreatedAt
                },
                "Usuário cadastrado com sucesso!"
            );
        }

        public async Task<User?> GetUserByEmailAsync(string email)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Email == email);
        }
    }
}