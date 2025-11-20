using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backendAPI.Models
{
    [Table("users")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Column("email")]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [Column("password_hash")]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [Column("role")]
        [MaxLength(20)]
        public string Role { get; set; } = "user"; // user, tecnico, admin

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Navegação
        public ICollection<Ticket>? Tickets { get; set; }
        public ICollection<Message>? Messages { get; set; }
    }
}