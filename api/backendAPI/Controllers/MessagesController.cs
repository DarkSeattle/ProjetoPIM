// ========================================
// Controllers/MessagesController.cs
// ========================================
using backendAPI.Data;
using backendAPI.DTOs;
using backendAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.IO;

namespace backendAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MessagesController> _logger;
        private readonly string _geminiLogPath = Path.Combine(Path.GetTempPath(), "backendAPI-gemini.log");
        private const int AiUserId = 1; // reutiliza o usuário admin seedado

        public MessagesController(
            AppDbContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<MessagesController> logger)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
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
                    SenderName = m.SenderRole == "ai" ? "Gemini" : m.Sender!.Name,
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

            await TryCreateAiReply(createDto);

            return CreatedAtAction(
                nameof(GetMessagesByTicket),
                new { ticketId = message.TicketId },
                ApiResponse<MessageDto>.SuccessResponse(messageDto, "Mensagem enviada com sucesso!")
            );
        }

        private async Task TryCreateAiReply(CreateMessageDto createDto)
        {
            var apiKey = _configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Gemini API key ausente. Defina Gemini:ApiKey no appsettings ou a variável de ambiente GEMINI_API_KEY.");
                WriteGeminiLog("WARN - API key ausente");
                return;
            }

            var prompt = $"Você é um assistente de suporte. Responda de forma curta e cordial em português.\nPergunta do usuário: \"{createDto.Content}\"";
            var aiText = await CallGeminiAsync(prompt, apiKey);
            if (string.IsNullOrWhiteSpace(aiText))
            {
                _logger.LogWarning("Gemini não retornou texto para o ticket {TicketId}.", createDto.TicketId);
                WriteGeminiLog($"WARN - Sem texto retornado para ticket {createDto.TicketId}");
                return;
            }

            var aiMessage = new Message
            {
                TicketId = createDto.TicketId,
                SenderId = AiUserId,
                SenderRole = "ai",
                Content = aiText.Trim(),
                CreatedAt = DateTime.Now
            };

            _context.Messages.Add(aiMessage);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Resposta da IA registrada no ticket {TicketId} (mensagem {MessageId}).", aiMessage.TicketId, aiMessage.Id);
            WriteGeminiLog($"INFO - Resposta salva para ticket {aiMessage.TicketId}, mensagem {aiMessage.Id}");
        }

        private async Task<string?> CallGeminiAsync(string prompt, string apiKey)
        {
            try
            {
                var model = _configuration["Gemini:Model"] ?? "gemini-2.0-flash";
                var client = _httpClientFactory.CreateClient();
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}")
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini retornou status {StatusCode}: {Body}", (int)response.StatusCode, body);
                    WriteGeminiLog($"WARN - Status {(int)response.StatusCode}: {body}");
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                WriteGeminiLog($"DEBUG - Resposta bruta: {responseJson}");
                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textElement))
                {
                    return textElement.GetString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Gemini] Falha ao gerar resposta");
                WriteGeminiLog($"ERROR - Exceção: {ex}");
            }

            return null;
        }

        private void WriteGeminiLog(string message)
        {
            try
            {
                var line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff zzz} {message}{Environment.NewLine}";
                System.IO.File.AppendAllText(_geminiLogPath, line);
            }
            catch
            {
                // ignora falha de log para não quebrar fluxo
            }
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
