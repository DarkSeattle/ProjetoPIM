// ========================================
// Controllers/TicketsController.cs
// ========================================
using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;

namespace backendAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TicketsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TicketsController(AppDbContext context)
        {
            _context = context;
        }

        private static bool ResolvedByIa(Ticket t)
        {
            return t.Status.ToLower() == "fechado" &&
                   !(t.Messages ?? Array.Empty<Message>()).Any(m => (m.SenderRole ?? string.Empty).ToLower() == "tech");
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<TicketDto>>>> GetAllTickets()
        {
            var tickets = await _context.Tickets
                .Include(t => t.Messages)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new TicketDto
                {
                    Id = t.Id,
                    UserId = t.UserId,
                    UserName = t.UserName,
                    Severity = t.Severity,
                    Description = t.Description,
                    Status = t.Status,
                    CreatedAt = t.CreatedAt,
                    ClosedAt = t.ClosedAt,
                    MessageCount = t.Messages!.Count,
                    ResolvedByIa = ResolvedByIa(t)
                })
                .ToListAsync();

            return Ok(ApiResponse<List<TicketDto>>.SuccessResponse(tickets));
        }

        [HttpGet("user/{userId}")]
        public async Task<ActionResult<ApiResponse<List<TicketDto>>>> GetTicketsByUser(int userId)
        {
            var tickets = await _context.Tickets
               .Include(t => t.Messages)
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new TicketDto
                {
                    Id = t.Id,
                    UserId = t.UserId,
                    UserName = t.UserName,
                    Severity = t.Severity,
                    Description = t.Description,
                    Status = t.Status,
                    CreatedAt = t.CreatedAt,
                    ClosedAt = t.ClosedAt,
                    MessageCount = t.Messages!.Count,
                    ResolvedByIa = ResolvedByIa(t)
                })
                .ToListAsync();

            return Ok(ApiResponse<List<TicketDto>>.SuccessResponse(tickets));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<TicketDetailsDto>>> GetTicket(int id)
        {
            var ticket = await _context.Tickets
                .Include(t => t.Messages)
                    .ThenInclude(m => m.Sender)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (ticket == null)
            {
                return NotFound(ApiResponse<TicketDetailsDto>.ErrorResponse("Ticket não encontrado."));
            }

            var ticketDetails = new TicketDetailsDto
            {
                Id = ticket.Id,
                UserId = ticket.UserId,
                UserName = ticket.UserName,
                Severity = ticket.Severity,
                Description = ticket.Description,
                Status = ticket.Status,
                CreatedAt = ticket.CreatedAt,
                ClosedAt = ticket.ClosedAt,
                Messages = ticket.Messages!.Select(m => new MessageDto
                {
                    Id = m.Id,
                    TicketId = m.TicketId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender!.Name,
                    SenderRole = m.SenderRole,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt
                }).OrderBy(m => m.CreatedAt).ToList()
            };

            return Ok(ApiResponse<TicketDetailsDto>.SuccessResponse(ticketDetails));
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<TicketDto>>> CreateTicket([FromBody] CreateTicketDto createDto)
        {
            var ticket = new Ticket
            {
                UserId = createDto.UserId,
                UserName = createDto.UserName,
                Severity = createDto.Severity,
                Description = createDto.Description,
                Status = "aberto",
                CreatedAt = DateTime.Now
            };

            _context.Tickets.Add(ticket);
            await _context.SaveChangesAsync();

            var ticketDto = new TicketDto
            {
                Id = ticket.Id,
                UserId = ticket.UserId,
                UserName = ticket.UserName,
                Severity = ticket.Severity,
                Description = ticket.Description,
                Status = ticket.Status,
                CreatedAt = ticket.CreatedAt,
                MessageCount = 0,
                ResolvedByIa = false
            };

            return CreatedAtAction(
                nameof(GetTicket),
                new { id = ticket.Id },
                ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Ticket criado com sucesso!")
            );
        }

        [HttpPut("{id}/status")]
        public async Task<ActionResult<ApiResponse<TicketDto>>> UpdateTicketStatus(
            int id,
            [FromBody] UpdateTicketStatusDto updateDto)
        {
            var ticket = await _context.Tickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound(ApiResponse<TicketDto>.ErrorResponse("Ticket não encontrado."));
            }

            ticket.Status = updateDto.Status;

            if (updateDto.Status.ToLower() == "fechado" && ticket.ClosedAt == null)
            {
                ticket.ClosedAt = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            var hasTechMessage = await _context.Messages.AnyAsync(m =>
                m.TicketId == ticket.Id && m.SenderRole.ToLower() == "tech");

            var ticketDto = new TicketDto
            {
                Id = ticket.Id,
                UserId = ticket.UserId,
                UserName = ticket.UserName,
                Severity = ticket.Severity,
                Description = ticket.Description,
                Status = ticket.Status,
                CreatedAt = ticket.CreatedAt,
                ClosedAt = ticket.ClosedAt,
                MessageCount = await _context.Messages.CountAsync(m => m.TicketId == ticket.Id),
                ResolvedByIa = ticket.Status.ToLower() == "fechado" && !hasTechMessage
            };

            return Ok(ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Status atualizado com sucesso!"));
        }

        [HttpPut("{id}/severity")]
        public async Task<ActionResult<ApiResponse<TicketDto>>> UpdateTicketSeverity(
            int id,
            [FromBody] UpdateTicketSeverityDto updateDto)
        {
            var ticket = await _context.Tickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound(ApiResponse<TicketDto>.ErrorResponse("Ticket não encontrado."));
            }

            var validSeverities = new[] { "low", "medium", "high" };
            if (!validSeverities.Contains(updateDto.Severity.ToLower()))
            {
                return BadRequest(ApiResponse<TicketDto>.ErrorResponse("Severity inválido. Use: low, medium ou high"));
            }

            ticket.Severity = updateDto.Severity.ToLower();
            await _context.SaveChangesAsync();

            var hasTechMessage = await _context.Messages.AnyAsync(m =>
                m.TicketId == ticket.Id && m.SenderRole.ToLower() == "tech");

            var ticketDto = new TicketDto
            {
                Id = ticket.Id,
                UserId = ticket.UserId,
                UserName = ticket.UserName,
                Severity = ticket.Severity,
                Description = ticket.Description,
                Status = ticket.Status,
                CreatedAt = ticket.CreatedAt,
                ClosedAt = ticket.ClosedAt,
                MessageCount = await _context.Messages.CountAsync(m => m.TicketId == ticket.Id),
                ResolvedByIa = ticket.Status.ToLower() == "fechado" && !hasTechMessage
            };

            return Ok(ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Prioridade atualizada com sucesso!"));
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteTicket(int id)
        {
            var ticket = await _context.Tickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Ticket não encontrado."));
            }

            _context.Tickets.Remove(ticket);
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<object>.SuccessResponse(null, "Ticket deletado com sucesso!"));
        }

        [HttpGet("user-simple/{userId}")]
        public async Task<ActionResult<ApiResponse<List<SimpleTicketDto>>>> GetUserTicketsSimple(int userId)
        {
            try
            {
                var tickets = await _context.Tickets
                    .Where(t => t.UserId == userId)
                    .Where(t => t.Status == "Aberto")
                    .OrderByDescending(t => t.CreatedAt)
                    .Select(t => new SimpleTicketDto
                    {
                        Id = t.Id,
                        UserName = t.UserName,
                        Severity = t.Severity,
                        Description = t.Description,
                        Status = t.Status,
                        CreatedAt = t.CreatedAt
                    })
                    .ToListAsync();

                return Ok(ApiResponse<List<SimpleTicketDto>>.SuccessResponse(tickets));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<List<SimpleTicketDto>>.ErrorResponse($"Erro ao buscar chamados: {ex.Message}"));
            }
        }

        [HttpGet("all-simple")]
        public async Task<ActionResult<ApiResponse<List<SimpleTicketDto>>>> GetAllTicketsSimple()
        {
            try
            {
                var tickets = await _context.Tickets
                    .Where(t => t.Status == "Aberto")
                    .OrderByDescending(t => t.CreatedAt)
                    .Select(t => new SimpleTicketDto
                    {
                        Id = t.Id,
                        UserName = t.UserName,
                        Severity = t.Severity,
                        Description = t.Description,
                        Status = t.Status,
                        CreatedAt = t.CreatedAt
                    })
                    .ToListAsync();

                return Ok(ApiResponse<List<SimpleTicketDto>>.SuccessResponse(tickets));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<List<SimpleTicketDto>>.ErrorResponse($"Erro: {ex.Message}"));
            }
        }

        [HttpGet("simples/{id}")]
        public async Task<ActionResult<ApiResponse<TicketDto>>> GetTicketById(int id)
        {
            try
            {
                var ticket = await _context.Tickets
                    .Include(t => t.Messages)
                    .Where(t => t.Id == id)
                    .Select(t => new TicketDto
                    {
                        Id = t.Id,
                        UserId = t.UserId,
                        UserName = t.UserName,
                        Severity = t.Severity,
                        Description = t.Description,
                        Status = t.Status,
                        CreatedAt = t.CreatedAt,
                        ClosedAt = t.ClosedAt,
                        MessageCount = t.Messages!.Count,
                        ResolvedByIa = ResolvedByIa(t)
                    })
                    .FirstOrDefaultAsync();

                if (ticket == null)
                {
                    return NotFound(ApiResponse<TicketDto>.ErrorResponse("Ticket não encontrado"));
                }

                return Ok(ApiResponse<TicketDto>.SuccessResponse(ticket));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<TicketDto>.ErrorResponse($"Erro ao buscar ticket: {ex.Message}"));
            }
        }

        [HttpGet("count")]
        public async Task<ActionResult<ApiResponse<int>>> GetTotalTickets()
        {
            var count = await _context.Tickets.CountAsync();
            return Ok(ApiResponse<int>.SuccessResponse(count));
        }

        [HttpGet("count/abertos")]
        public async Task<ActionResult<ApiResponse<int>>> GetTicketsAbertos()
        {
            var count = await _context.Tickets
                .Where(t => t.Status == "aberto" || t.Status == "em_andamento")
                .CountAsync();
            return Ok(ApiResponse<int>.SuccessResponse(count));
        }

        [HttpGet("count/concluidos")]
        public async Task<ActionResult<ApiResponse<int>>> GetTicketsConcluidos()
        {
            var count = await _context.Tickets
                .Where(t => t.Status == "fechado" || t.Status == "finalizado")
                .CountAsync();
            return Ok(ApiResponse<int>.SuccessResponse(count));
        }

        [HttpGet("stats/gravidade")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, int>>>> GetStatsByGravidade()
        {
            var stats = await _context.Tickets
                .GroupBy(t => t.Severity)
                .Select(g => new { Gravidade = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Gravidade, x => x.Count);

            return Ok(ApiResponse<Dictionary<string, int>>.SuccessResponse(stats));
        }

        [HttpGet("stats/status")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, int>>>> GetStatsByStatus()
        {
            var stats = await _context.Tickets
                .GroupBy(t => t.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count);

            return Ok(ApiResponse<Dictionary<string, int>>.SuccessResponse(stats));
        }

        [HttpGet("stats/top-usuarios")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, int>>>> GetTopUsuarios()
        {
            var stats = await _context.Tickets
                .GroupBy(t =>
                {
                    var name = string.IsNullOrWhiteSpace(t.UserName) ? "Desconhecido" : t.UserName.Trim();
                    return string.IsNullOrWhiteSpace(name) ? "Desconhecido" : name;
                })
                .Select(g => new { Usuario = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(10)
                .ToDictionaryAsync(x => x.Usuario, x => x.Count);

            return Ok(ApiResponse<Dictionary<string, int>>.SuccessResponse(stats));
        }
    }
}
