using backendAPI.DTOs;
using backendAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace backendAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        /// <summary>
        /// Login de usuário
        /// </summary>
        /// <param name="loginDto">Email e senha</param>
        /// <returns>Dados do usuário se login for bem-sucedido</returns>
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto loginDto)
        {
            if (string.IsNullOrEmpty(loginDto.Email) || string.IsNullOrEmpty(loginDto.Password))
            {
                return BadRequest(new LoginResponseDto
                {
                    Success = false,
                    Message = "Email e senha são obrigatórios."
                });
            }

            var result = await _authService.LoginAsync(loginDto);

            if (!result.Success)
            {
                return Unauthorized(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Registro de novo usuário
        /// </summary>
        /// <param name="registerDto">Dados do novo usuário</param>
        /// <returns>Usuário criado</returns>
        [HttpPost("register")]
        public async Task<ActionResult<ApiResponse<UserDto>>> Register([FromBody] RegisterDto registerDto)
        {
            if (string.IsNullOrEmpty(registerDto.Name) ||
                string.IsNullOrEmpty(registerDto.Email) ||
                string.IsNullOrEmpty(registerDto.Password))
            {
                return BadRequest(ApiResponse<UserDto>.ErrorResponse(
                    "Todos os campos são obrigatórios.",
                    new List<string> { "Nome, email e senha devem ser preenchidos." }
                ));
            }

            var result = await _authService.RegisterAsync(registerDto);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(nameof(Register), result);
        }



    }
}