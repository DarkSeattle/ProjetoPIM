namespace backendAPI.DTOs
{
    public class LoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public UserDto? User { get; set; }

        // 👇 ESTA É A LINHA QUE FALTAVA
        public string? Token { get; set; }
    }
}