using System;
using System.Threading;
using System.Threading.Tasks;

namespace Resilience;

public sealed class RetryPolicy
{
    private readonly int _maxAttempts;
    private readonly TimeSpan _baseDelay;
    private readonly Func<Exception, bool> _isTransient;
    private readonly Random _random = new();

    public RetryPolicy(int maxAttempts, TimeSpan baseDelay, Func<Exception, bool>? isTransient = null)
    {
        if (maxAttempts < 1) throw new ArgumentOutOfRangeException(nameof(maxAttempts));
        _maxAttempts = maxAttempts;
        _baseDelay = baseDelay;
        _isTransient = isTransient ?? (ex => ex is TimeoutException);
    }

    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await action(ct).ConfigureAwait(false);
            }
            catch (Exception ex) when (attempt < _maxAttempts && _isTransient(ex))
            {
                await Task.Delay(DelayFor(attempt), ct).ConfigureAwait(false);
            }
        }
    }

    // Exponential backoff with full jitter.
    private TimeSpan DelayFor(int attempt)
    {
        var ceiling = _baseDelay.TotalMilliseconds * Math.Pow(2, attempt - 1);
        double jitter;
        lock (_random)
        {
            jitter = _random.NextDouble();
        }
        return TimeSpan.FromMilliseconds(ceiling * jitter);
    }
}
