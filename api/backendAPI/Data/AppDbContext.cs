using BCrypt.Net;
using backendAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace backendAPI.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Ticket> Tickets { get; set; }
        public DbSet<Message> Messages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ========================================
            // Configurar relacionamentos
            // ========================================

            // Ticket -> User (muitos tickets para um usuário)
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.User)
                .WithMany(u => u.Tickets)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Message -> Ticket (muitas mensagens para um ticket)
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Ticket)
                .WithMany(t => t.Messages)
                .HasForeignKey(m => m.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            // Message -> User (muitas mensagens de um usuário)
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany(u => u.Messages)
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            // ========================================
            // Índices para performance
            // ========================================

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<Ticket>()
                .HasIndex(t => t.UserId);

            modelBuilder.Entity<Ticket>()
                .HasIndex(t => t.Status);

            modelBuilder.Entity<Message>()
                .HasIndex(m => m.TicketId);

            // ========================================
            // Seed Data (dados iniciais)
            // ========================================

            // Criar um usuário admin padrão
            modelBuilder.Entity<User>().HasData(
                new User
                {
                    Id = 1,
                    Name = "Administrador",
                    Email = "admin@suporte.com",
                    PasswordHash = "$2a$11$Xj8xGJ5M3q3Z1aK8L5K5K.5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K", // Senha: admin123
                    Role = "admin",
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                }
            );
        }
    }
}