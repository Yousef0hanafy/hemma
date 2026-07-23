// Simple in-memory rate limiter for API endpoints
// For multi-instance deployments, replace with Redis-based implementation

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;      // Max requests per window
}

class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.store = new Map();
    this.config = config;
    
    // Cleanup expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  public check(identifier: string): { success: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || entry.resetTime <= now) {
      // Create new entry
      const resetTime = now + this.config.windowMs;
      this.store.set(identifier, { count: 1, resetTime });
      return {
        success: true,
        remaining: this.config.max - 1,
        resetTime,
      };
    }

    if (entry.count >= this.config.max) {
      // Rate limit exceeded - log the violation
      console.warn(
        `[RateLimiter] Rate limit exceeded for identifier: ${identifier}, ` +
        `count: ${entry.count}, max: ${this.config.max}, ` +
        `resetTime: ${new Date(entry.resetTime).toISOString()}`
      );
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    return {
      success: true,
      remaining: this.config.max - entry.count,
      resetTime: entry.resetTime,
    };
  }

  public reset(identifier: string): void {
    this.store.delete(identifier);
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Pre-configured rate limiters
export const aiRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  max: 20,         // 20 requests per minute per user
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  max: 60,         // 60 requests per minute per user
});

// Helper to get client identifier (IP or user ID)
// Sanitizes input to prevent header injection attacks
export function getClientIdentifier(request: Request): string {
  // Try to get user ID from session (more accurate than IP)
  // In practice, you'd use getServerSession here
  // For now, fall back to IP-based identification
  
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIP = forwardedFor?.split(",")[0]?.trim() || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  
  // Sanitize to prevent header injection - only allow alphanumeric, dots, dashes
  const sanitized = clientIP.replace(/[^a-zA-Z0-9.\-:]/g, "");
  
  // Limit length to prevent abuse
  return sanitized.slice(0, 45) || "unknown";
}

// Rate limit response helper
export function rateLimitResponse(result: { success: boolean; remaining: number; resetTime: number }) {
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة مرة أخرى لاحقاً.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(result.resetTime).toUTCString(),
          "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  return null;
}
