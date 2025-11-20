// ========================================
// Controllers/TicketsController.cs
// ========================================
using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        /// <summary>
        /// Listar todos os tickets (Admin/Técnico)
        /// </summary>
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
                    MessageCount = t.Messages!.Count
                })
                .ToListAsync();

            return Ok(ApiResponse<List<TicketDto>>.SuccessResponse(tickets));
        }

        /// <summary>
        /// Listar tickets de um usuário específico
        /// </summary>
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
                    MessageCount = t.Messages!.Count
                })
                .ToListAsync();

            return Ok(ApiResponse<List<TicketDto>>.SuccessResponse(tickets));
        }

        /// <summary>
        /// Obter detalhes de um ticket específico (com mensagens)
        /// </summary>
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

        /// <summary>
        /// Criar novo ticket
        /// </summary>
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
                MessageCount = 0
            };

            return CreatedAtAction(
                nameof(GetTicket),
                new { id = ticket.Id },
                ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Ticket criado com sucesso!")
            );
        }

        /// <summary>
        /// Atualizar status do ticket
        /// </summary>
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

            // Se o status for "fechado", definir a data de fechamento
            if (updateDto.Status.ToLower() == "fechado" && ticket.ClosedAt == null)
            {
                ticket.ClosedAt = DateTime.Now;
            }

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
                ClosedAt = ticket.ClosedAt,
                MessageCount = await _context.Messages.CountAsync(m => m.TicketId == ticket.Id)
            };

            return Ok(ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Status atualizado com sucesso!"));
        }

        /// <summary>
        /// Atualizar prioridade (severity) do ticket
        /// </summary>
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

            // Valida severity
            var validSeverities = new[] { "low", "medium", "high" };
            if (!validSeverities.Contains(updateDto.Severity.ToLower()))
            {
                return BadRequest(ApiResponse<TicketDto>.ErrorResponse("Severity inválido. Use: low, medium ou high"));
            }

            ticket.Severity = updateDto.Severity.ToLower();
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
                ClosedAt = ticket.ClosedAt,
                MessageCount = await _context.Messages.CountAsync(m => m.TicketId == ticket.Id)
            };

            return Ok(ApiResponse<TicketDto>.SuccessResponse(ticketDto, "Prioridade atualizada com sucesso!"));
        }

        /// <summary>
        /// Deletar ticket
        /// </summary>
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
    }
}