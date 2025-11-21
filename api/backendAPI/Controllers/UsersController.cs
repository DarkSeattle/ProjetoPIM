// ========================================
// Controllers/UsersController.cs
// ========================================
using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using backendAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backendAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        // ✅ REMOVER a dependência do PasswordService
        public UsersController(AppDbContext context)
        {
            _context = context;
        }


        /// <summary>
        /// Listar todos os usuários (Admin)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAllUsers()
        {
            var users = await _context.Users
                .OrderBy(u => u.Name)
                .Select(u => new UserDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Email = u.Email,
                    Role = u.Role,
                    CreatedAt = u.CreatedAt
                })
                .ToListAsync();

            return Ok(ApiResponse<List<UserDto>>.SuccessResponse(users));
        }

        /// <summary>
        /// Obter usuário específico por ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<UserDto>>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(ApiResponse<UserDto>.ErrorResponse("Usuário não encontrado."));
            }

            var userDto = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };

            return Ok(ApiResponse<UserDto>.SuccessResponse(userDto));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(int id, [FromBody] RegisterDto updateDto)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(ApiResponse<UserDto>.ErrorResponse("Usuário não encontrado."));
            }

            // Verificar se o email já está sendo usado por outro usuário
            var emailExists = await _context.Users
                .AnyAsync(u => u.Email == updateDto.Email && u.Id != id);

            if (emailExists)
            {
                return BadRequest(ApiResponse<UserDto>.ErrorResponse(
                    "Este email já está sendo usado por outro usuário."
                ));
            }

            // Validar role
            var validRoles = new[] { "user", "tecnico", "admin" };
            if (!validRoles.Contains(updateDto.Role.ToLower()))
            {
                return BadRequest(ApiResponse<UserDto>.ErrorResponse(
                    "Role inválido. Use: user, tecnico ou admin"));
            }

            // Atualizar dados
            user.Name = updateDto.Name;
            user.Email = updateDto.Email;
            user.Role = updateDto.Role;

            // ✅ SIMPLES: Atualizar senha diretamente
            if (!string.IsNullOrEmpty(updateDto.Password))
            {
                user.PasswordHash = updateDto.Password;
            }

            await _context.SaveChangesAsync();

            var userDto = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };

            return Ok(ApiResponse<UserDto>.SuccessResponse(userDto, "Usuário atualizado com sucesso!"));
        }
        /// <summary>
        /// Deletar usuário (Admin)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Usuário não encontrado."));
            }

            // Verificar se o usuário tem tickets
            var hasTickets = await _context.Tickets.AnyAsync(t => t.UserId == id);

            if (hasTickets)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(
                    "Não é possível deletar usuário que possui tickets cadastrados.",
                    new List<string> { "Remova ou reatribua os tickets antes de deletar o usuário." }
                ));
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<object>.SuccessResponse(null, "Usuário deletado com sucesso!"));
        }

        /// <summary>
        /// Contar usuários por role
        /// </summary>
        [HttpGet("stats/by-role")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, int>>>> GetUserStatsByRole()
        {
            var stats = await _context.Users
                .GroupBy(u => u.Role)
                .Select(g => new { Role = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Role, x => x.Count);

            return Ok(ApiResponse<Dictionary<string, int>>.SuccessResponse(stats));
        }
    }
}