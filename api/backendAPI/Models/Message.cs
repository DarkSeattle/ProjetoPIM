using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backendAPI.Models
{
    [Table("messages")]
    public class Message
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("ticket_id")]
        public int TicketId { get; set; }

        [Required]
        [Column("sender_id")]
        public int SenderId { get; set; }

        [Required]
        [Column("sender_role")]
        [MaxLength(20)]
        public string SenderRole { get; set; } = "user"; // user, tecnico, admin, ai

        [Required]
        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Navegação
        [ForeignKey("TicketId")]
        public Ticket? Ticket { get; set; }

        [ForeignKey("SenderId")]
        public User? Sender { get; set; }
    }
}