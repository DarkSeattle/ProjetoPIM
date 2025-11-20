// ========================================
// Controllers/MessagesController.cs
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
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MessagesController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Obter todas as mensagens de um ticket específico
        /// </summary>
        [HttpGet("ticket/{ticketId}")]
        public async Task<ActionResult<ApiResponse<List<MessageDto>>>> GetMessagesByTicket(int ticketId)
        {
            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Where(m => m.TicketId == ticketId)
                .OrderBy(m => m.CreatedAt)
                .Select(m => new MessageDto
                {
                    Id = m.Id,
                    TicketId = m.TicketId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender!.Name,
                    SenderRole = m.SenderRole,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt
                })
                .ToListAsync();

            return Ok(ApiResponse<List<MessageDto>>.SuccessResponse(messages));
        }

        /// <summary>
        /// Enviar nova mensagem em um ticket
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<ApiResponse<MessageDto>>> CreateMessage([FromBody] CreateMessageDto createDto)
        {
            // Verificar se o ticket existe
            var ticketExists = await _context.Tickets.AnyAsync(t => t.Id == createDto.TicketId);
            if (!ticketExists)
            {
                return NotFound(ApiResponse<MessageDto>.ErrorResponse("Ticket não encontrado."));
            }

            // Verificar se o usuário existe
            var sender = await _context.Users.FindAsync(createDto.SenderId);
            if (sender == null)
            {
                return NotFound(ApiResponse<MessageDto>.ErrorResponse("Usuário não encontrado."));
            }

            var message = new Message
            {
                TicketId = createDto.TicketId,
                SenderId = createDto.SenderId,
                SenderRole = createDto.SenderRole,
                Content = createDto.Content,
                CreatedAt = DateTime.Now
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var messageDto = new MessageDto
            {
                Id = message.Id,
                TicketId = message.TicketId,
                SenderId = message.SenderId,
                SenderName = sender.Name,
                SenderRole = message.SenderRole,
                Content = message.Content,
                CreatedAt = message.CreatedAt
            };

            return CreatedAtAction(
                nameof(GetMessagesByTicket),
                new { ticketId = message.TicketId },
                ApiResponse<MessageDto>.SuccessResponse(messageDto, "Mensagem enviada com sucesso!")
            );
        }

        /// <summary>
        /// Obter mensagem específica por ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<MessageDto>>> GetMessage(int id)
        {
            var message = await _context.Messages
                .Include(m => m.Sender)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (message == null)
            {
                return NotFound(ApiResponse<MessageDto>.ErrorResponse("Mensagem não encontrada."));
            }

            var messageDto = new MessageDto
            {
                Id = message.Id,
                TicketId = message.TicketId,
                SenderId = message.SenderId,
                SenderName = message.Sender!.Name,
                SenderRole = message.SenderRole,
                Content = message.Content,
                CreatedAt = message.CreatedAt
            };

            return Ok(ApiResponse<MessageDto>.SuccessResponse(messageDto));
        }

        /// <summary>
        /// Deletar mensagem
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteMessage(int id)
        {
            var message = await _context.Messages.FindAsync(id);

            if (message == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Mensagem não encontrada."));
            }

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<object>.SuccessResponse(null, "Mensagem deletada com sucesso!"));
        }
    }
}