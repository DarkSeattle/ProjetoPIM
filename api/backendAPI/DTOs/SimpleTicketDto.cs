namespace backendAPI.DTOs
{
    public class SimpleTicketDto
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string Severity { get; set; }
        public string Description { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
