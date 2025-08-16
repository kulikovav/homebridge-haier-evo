# Rate Limiting and Retry Logic

This document describes the comprehensive rate limiting and retry functionality implemented in the HaierAPI class to handle API rate limiting scenarios gracefully.

## Overview

The rate limiting system provides:

- **429 Error Handling**: Automatic handling of "Too Many Requests" responses
- **Retry-After Header Support**: Respects server-specified retry delays
- **Exponential Backoff**: Intelligent retry timing with jitter
- **Configurable Behavior**: Customizable retry limits and delays
- **Request Throttling**: Minimum intervals between requests

## Features

### 🚦 Automatic 429 Handling

- Detects rate limiting responses (HTTP 429)
- Automatically retries requests after appropriate delays
- Respects `Retry-After` headers from the server

### ⏱️ Smart Retry Logic

- **Exponential Backoff**: Delay increases exponentially with each retry
- **Jitter**: Adds randomness to prevent thundering herd problems
- **Configurable Limits**: Set maximum retry attempts and delays
- **Graceful Degradation**: Fails gracefully after max retries

### 🔧 Flexible Configuration

- Adjust retry parameters at runtime
- Configure minimum request intervals
- Enable/disable specific features
- Monitor rate limiting status

## Configuration

### Default Settings

```typescript
{
  maxRetries: 3,           // Maximum retry attempts
  baseDelay: 1000,         // Base delay in milliseconds
  maxDelay: 30000,         // Maximum delay in milliseconds
  jitter: 0.1,             // Jitter factor (10%)
  respectRetryAfter: true, // Respect Retry-After headers
  queueRetries: true       // Queue retry requests
}
```

### Customizing Rate Limiting

```typescript
// Update configuration at runtime
api.configureRateLimit({
  maxRetries: 5,        // Allow more retries
  baseDelay: 500,       // Faster initial retry
  maxDelay: 15000,      // Lower maximum delay
  jitter: 0.2           // More jitter for distribution
});
```

## How It Works

### 1. Request Execution

All HTTP requests are wrapped with `executeWithRateLimit()` which:

- Ensures minimum intervals between requests
- Catches and handles 429 errors
- Manages retry logic automatically

### 2. 429 Error Detection

When a 429 response is received:

- Parses the `Retry-After` header
- Supports both seconds and HTTP date formats
- Falls back to calculated delays if header is missing

### 3. Retry Logic

- **Immediate Retry**: For transient errors (non-429)
- **Delayed Retry**: For rate limiting (429) with server-specified delay
- **Exponential Backoff**: For repeated failures
- **Jitter**: Prevents synchronized retry attempts

### 4. Request Throttling

- Maintains minimum 100ms between requests
- Prevents overwhelming the API
- Configurable via `minRequestInterval`

## API Methods

### `executeWithRateLimit<T>(requestFn, retryCount?)`

Internal method that wraps HTTP requests with rate limiting logic.

### `configureRateLimit(config)`

Update rate limiting configuration at runtime.

**Parameters:**

- `config`: Partial configuration object

**Example:**

```typescript
api.configureRateLimit({
  maxRetries: 5,
  baseDelay: 500
});
```

### `getRateLimitStatus()`

Get current rate limiting status and configuration.

**Returns:**

```typescript
{
  queueLength: number,        // Current request queue length
  isProcessingQueue: boolean, // Whether queue is being processed
  lastRequestTime: number,    // Timestamp of last request
  config: {                   // Current configuration
    maxRetries: number,
    baseDelay: number,
    maxDelay: number,
    jitter: number,
    respectRetryAfter: boolean,
    queueRetries: boolean
  }
}
```

## Retry-After Header Support

The system automatically parses and respects `Retry-After` headers:

### Supported Formats

1. **Seconds**: `Retry-After: 30` (retry after 30 seconds)
2. **HTTP Date**: `Retry-After: Wed, 13 Aug 2025 16:30:00 GMT`

### Fallback Behavior

If `Retry-After` is missing or invalid:

- Uses exponential backoff calculation
- Applies jitter for distribution
- Respects maximum delay limits

## Error Handling

### Rate Limit Exceeded

After maximum retries:

- Throws descriptive error message
- Includes retry count information
- Suggests waiting before retrying

### Configuration Errors

- Validates configuration parameters
- Provides helpful error messages
- Maintains system stability

## Testing

### Standalone Test

```bash
npm run test:rate-limiting
```

### Integration Test

```bash
RUN_REAL_API_TESTS=1 npm run test:standalone:api
```

The integration test includes rate limiting configuration validation.

## Best Practices

### 1. Monitor Rate Limiting

```typescript
const status = api.getRateLimitStatus();
console.log('Queue length:', status.queueLength);
console.log('Last request:', new Date(status.lastRequestTime));
```

### 2. Adjust for Your Use Case

```typescript
// For high-frequency operations
api.configureRateLimit({
  maxRetries: 2,
  baseDelay: 200,
  minRequestInterval: 50
});

// For conservative operations
api.configureRateLimit({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000
});
```

### 3. Handle Failures Gracefully

```typescript
try {
  const result = await api.someMethod();
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Wait and retry later
    await new Promise(resolve => setTimeout(resolve, 60000));
    return await api.someMethod();
  }
  throw error;
}
```

## Troubleshooting

### Common Issues

1. **Too Many Retries**
   - Reduce `maxRetries` value
   - Increase `baseDelay` for slower retries
   - Check API rate limits

2. **Slow Response Times**
   - Reduce `minRequestInterval`
   - Check network latency
   - Monitor server performance

3. **Rate Limiting Still Occurs**
   - Verify `respectRetryAfter` is enabled
   - Check server `Retry-After` headers
   - Increase delays between requests

### Debug Mode

Enable debug logging to see rate limiting behavior:

```typescript
const api = new HaierAPI({
  // ... other config
  debug: true
});
```

## Performance Considerations

- **Memory Usage**: Minimal overhead for request tracking
- **CPU Impact**: Negligible for most use cases
- **Network Efficiency**: Prevents unnecessary failed requests
- **Scalability**: Handles high request volumes gracefully

## Device List Caching

The plugin now implements device list caching to reduce the frequency of API calls:

### How Caching Works

- Device list is cached for a configurable period (default: 300 seconds)
- Subsequent requests use the cached data if it's still valid
- If cache is expired, a fresh request is made
- If API request fails, falls back to cached data even if expired

### Cache Configuration

```json
{
  "deviceCacheTTL": 300  // Time in seconds to cache device list
}
```

## Request Randomization

To make API requests appear more natural and avoid detection:

### Randomization Features

- **Random URL Parameters**: Adds random parameters to avoid server-side caching
- **Random Delays**: Adds variable delays between requests
- **Configurable Ranges**: Set minimum and maximum delay values

### Randomization Configuration

```json
{
  "requestRandomization": true,  // Enable/disable randomization
  "minRequestDelay": 100,        // Minimum delay in milliseconds
  "maxRequestDelay": 1000        // Maximum delay in milliseconds
}
```

## Future Enhancements

Potential improvements:

- **Adaptive Delays**: Learn from server response patterns
- **Distributed Coordination**: Coordinate retries across instances
- **Metrics Collection**: Track rate limiting statistics
- **Circuit Breaker**: Prevent cascading failures
- **Smarter Caching**: Cache individual device statuses

## Conclusion

The rate limiting system provides robust, configurable handling of API rate limits while maintaining good performance and user experience. It automatically handles most rate limiting scenarios and provides tools for fine-tuning behavior based on specific requirements.
