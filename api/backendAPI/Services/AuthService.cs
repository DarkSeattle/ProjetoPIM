using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace backendAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IPasswordService _passwordService;

        // 👇 PASSO 1: INJETAR O SERVIÇO DE TOKEN
        private readonly ITokenService _tokenService; // Assumindo que você tenha um ITokenService

        public AuthService(AppDbContext context, IPasswordService passwordService, ITokenService tokenService) // E adicionar ele aqui
        {
            _context = context;
            _passwordService = passwordService;
            _tokenService = tokenService; // E aqui
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
                    Message = "Email ou senha inválidos."
                };
            }

            // Verificar senha
            if (!_passwordService.VerifyPassword(loginDto.Password, user.PasswordHash))
            {
                return new LoginResponseDto
                {
                    Success = false,
                    Message = "Email ou senha inválidos."
                };
            }

            // 👇 PASSO 2: GERAR O TOKEN APÓS O LOGIN
            var token = _tokenService.GenerateToken(user); // Gerar o token para o usuário

            // Login bem-sucedido
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
                // 👇 PASSO 3: INCLUIR O TOKEN NA RESPOSTA
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
                PasswordHash = _passwordService.HashPassword(registerDto.Password),
                Role = registerDto.Role, // O Role deve vir do DTO
                CreatedAt = DateTime.Now.ToUniversalTime() // Usar UTC é uma boa prática
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