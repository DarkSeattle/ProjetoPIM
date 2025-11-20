using backendAPI.DTOs;
using backendAPI.Models;

namespace backendAPI.Services
{
    public interface IAuthService
    {
        Task<LoginResponseDto> LoginAsync(LoginDto loginDto);
        Task<ApiResponse<UserDto>> RegisterAsync(RegisterDto registerDto);
        Task<User?> GetUserByEmailAsync(string email);
    }
}