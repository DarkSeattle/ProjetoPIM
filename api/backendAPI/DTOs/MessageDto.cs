namespace backendAPI.DTOs
{
    public class CreateMessageDto
    {
        public int TicketId { get; set; }
        public int SenderId { get; set; }
        public string SenderRole { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
    }

    public class MessageDto
    {
        public int Id { get; set; }
        public int TicketId { get; set; }
        public int SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderRole { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
