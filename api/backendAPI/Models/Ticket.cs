using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backendAPI.Models
{
    [Table("tickets")]
    public class Ticket
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("user_name")]
        [MaxLength(100)]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [Column("severity")]
        [MaxLength(20)]
        public string Severity { get; set; } = "normal"; // baixa, normal, alta, urgente

        [Required]
        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Required]
        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "aberto"; // aberto, em_andamento, resolvido, fechado

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("closed_at")]
        public DateTime? ClosedAt { get; set; }

        // Navegação
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public ICollection<Message>? Messages { get; set; }
    }
}