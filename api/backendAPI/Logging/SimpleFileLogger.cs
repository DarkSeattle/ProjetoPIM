using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Globalization;
using System.Text;

namespace backendAPI.Logging
{
    /// <summary>
    /// File logger simples para registrar todos os logs em um arquivo especificado.
    /// </summary>
    public class SimpleFileLoggerProvider : ILoggerProvider
    {
        private readonly string _filePath;
        private readonly LogLevel _minLevel;
        private readonly ConcurrentDictionary<string, SimpleFileLogger> _loggers = new();
        private readonly object _writeLock = new();

        public SimpleFileLoggerProvider(string filePath, LogLevel minLevel)
        {
            _filePath = filePath;
            _minLevel = minLevel;

            var directory = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrWhiteSpace(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }

        public ILogger CreateLogger(string categoryName)
        {
            return _loggers.GetOrAdd(categoryName, name => new SimpleFileLogger(name, _filePath, _minLevel, _writeLock));
        }

        public void Dispose()
        {
            _loggers.Clear();
        }
    }

    internal class SimpleFileLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly string _filePath;
        private readonly LogLevel _minLevel;
        private readonly object _writeLock;

        public SimpleFileLogger(string categoryName, string filePath, LogLevel minLevel, object writeLock)
        {
            _categoryName = categoryName;
            _filePath = filePath;
            _minLevel = minLevel;
            _writeLock = writeLock;
        }

        public IDisposable? BeginScope<TState>(TState state) => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= _minLevel;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var message = formatter(state, exception);
            var sb = new StringBuilder();
            sb.Append(DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss.fff zzz", CultureInfo.InvariantCulture));
            sb.Append(" [");
            sb.Append(logLevel);
            sb.Append("] ");
            sb.Append(_categoryName);
            sb.Append(" - ");
            sb.AppendLine(message);

            if (exception != null)
            {
                sb.AppendLine(exception.ToString());
            }

            lock (_writeLock)
            {
                File.AppendAllText(_filePath, sb.ToString());
            }
        }
    }
}
