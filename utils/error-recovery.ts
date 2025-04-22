export interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const fullOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;
    let delay = fullOptions.initialDelay;

    for (let attempt = 1; attempt <= fullOptions.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt === fullOptions.maxAttempts) {
                break;
            }

            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * fullOptions.backoffFactor, fullOptions.maxDelay);
        }
    }

    throw lastError;
}