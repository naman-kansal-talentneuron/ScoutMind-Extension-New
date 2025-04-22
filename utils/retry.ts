// utils/retry.ts
export interface RetryOptions {
    maxAttempts: number;
    delay: number;
    backoffFactor: number;
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    let lastError: Error = new Error('Operation failed');
    let delay = options.delay;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === options.maxAttempts) break;
            
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= options.backoffFactor;
        }
    }

    throw lastError;
}