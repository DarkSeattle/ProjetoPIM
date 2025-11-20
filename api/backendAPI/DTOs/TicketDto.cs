namespace backendAPI.DTOs
{
    public class CreateTicketDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Severity { get; set; } = "normal";
        public string Description { get; set; } = string.Empty;
    }

    public class UpdateTicketStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class TicketDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int MessageCount { get; set; }
    }

    public class TicketDetailsDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public List<MessageDto> Messages { get; set; } = new();
    }

    public class UpdateTicketSeverityDto
    {
        public string Severity { get; set; } = string.Empty;
    }
}
    