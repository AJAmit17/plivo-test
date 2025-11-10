/**
 * Plivo Resilience Layer
 * 
 * This layer adds resilience patterns on top of the PlivoManager.
 * Implements circuit breaker, retry with exponential backoff, and error handling.
 */

import CircuitBreaker from 'opossum';
import { PlivoManager, PlivoManagerConfig, InitiateRecordedCallRequest } from '@/lib/managers/plivo-manager';
import { GetCallDetailsResponse } from '@/lib/types/plivo.types';

export interface PlivoResilientConfig extends PlivoManagerConfig {
    // Circuit breaker settings
    circuitBreakerTimeout?: number;
    circuitBreakerErrorThresholdPercentage?: number;
    circuitBreakerResetTimeout?: number;
    circuitBreakerRollingCountTimeout?: number;
    circuitBreakerRollingCountBuckets?: number;

    // Retry settings
    maxRetries?: number;
    retryDelay?: number;
    retryMultiplier?: number;
    maxRetryDelay?: number;
}

export interface CallResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    retryCount?: number;
    circuitBreakerState?: string;
}

export class PlivoResilient {
    private manager: PlivoManager;
    private config: PlivoResilientConfig;

    // Circuit breakers for different operations
    private makeCallBreaker: CircuitBreaker;
    private getCallDetailsBreaker: CircuitBreaker;

    constructor(config: PlivoResilientConfig) {
        this.config = {
            circuitBreakerTimeout: 30000,
            circuitBreakerErrorThresholdPercentage: 50,
            circuitBreakerResetTimeout: 30000,
            circuitBreakerRollingCountTimeout: 10000,
            circuitBreakerRollingCountBuckets: 10,
            maxRetries: 3,
            retryDelay: 1000,
            retryMultiplier: 2,
            maxRetryDelay: 10000,
            ...config,
        };

        this.manager = new PlivoManager(config);

        // Initialize circuit breakers
        this.makeCallBreaker = this.createCircuitBreaker('makeCall');
        this.getCallDetailsBreaker = this.createCircuitBreaker('getCallDetails');

        // Setup event listeners for monitoring
        this.setupCircuitBreakerListeners(this.makeCallBreaker, 'makeCall');
        this.setupCircuitBreakerListeners(this.getCallDetailsBreaker, 'getCallDetails');
    }

    /**
     * Create a circuit breaker with configured settings
     * 
     * @param name - Circuit breaker name
     * @returns Configured CircuitBreaker instance
     */
    private createCircuitBreaker(name: string): CircuitBreaker {
        return new CircuitBreaker(async (fn: () => Promise<unknown>) => fn(), {
            timeout: this.config.circuitBreakerTimeout,
            errorThresholdPercentage: this.config.circuitBreakerErrorThresholdPercentage,
            resetTimeout: this.config.circuitBreakerResetTimeout,
            rollingCountTimeout: this.config.circuitBreakerRollingCountTimeout,
            rollingCountBuckets: this.config.circuitBreakerRollingCountBuckets,
            name,
        });
    }    /**
     * Setup event listeners for circuit breaker monitoring
     * 
     * @param breaker - Circuit breaker instance
     * @param name - Circuit breaker name
     */
    private setupCircuitBreakerListeners(breaker: CircuitBreaker, name: string): void {
        breaker.on('open', () => {
            console.warn(`[PlivoResilient] Circuit breaker '${name}' opened`);
        });

        breaker.on('halfOpen', () => {
            console.info(`[PlivoResilient] Circuit breaker '${name}' half-open`);
        });

        breaker.on('close', () => {
            console.info(`[PlivoResilient] Circuit breaker '${name}' closed`);
        });

        breaker.on('fallback', () => {
            console.warn(`[PlivoResilient] Circuit breaker '${name}' fallback triggered`);
        });
    }    /**
     * Execute operation with retry logic and exponential backoff
     * 
     * @param operation - Async operation to execute
     * @param operationName - Name of the operation for logging
     * @returns Promise with operation result
     */
    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        let lastError: Error | undefined;
        const maxRetries = this.config.maxRetries || 3;
        const retryDelay = this.config.retryDelay || 1000;
        const retryMultiplier = this.config.retryMultiplier || 2;
        const maxRetryDelay = this.config.maxRetryDelay || 10000;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    // Calculate exponential backoff delay
                    const delay = Math.min(retryDelay * Math.pow(retryMultiplier, attempt), maxRetryDelay);

                    console.warn(
                        `[PlivoResilient] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
                        `Retrying in ${delay}ms...`,
                        lastError.message
                    );

                    await this.sleep(delay);
                } else {
                    console.error(
                        `[PlivoResilient] ${operationName} failed after ${maxRetries + 1} attempts`,
                        lastError.message
                    );
                }
            }
        }

        throw lastError;
    }

    /**
     * Sleep for specified milliseconds
     * 
     * @param ms - Milliseconds to sleep
     * @returns Promise that resolves after delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Initiate a recorded call with full resilience
     * 
     * @param request - Call initiation request
     * @returns Promise with call result including resilience metadata
     */
    async initiateRecordedCall(
        request: InitiateRecordedCallRequest
    ): Promise<CallResult<{ callUuid: string; message: string; apiId: string }>> {
        try {
            let retryCount = 0;

            const result = await this.makeCallBreaker.fire(async () => {
                return await this.executeWithRetry(
                    async () => {
                        retryCount++;
                        return await this.manager.initiateRecordedCall(request);
                    },
                    'initiateRecordedCall'
                );
            }) as Awaited<ReturnType<PlivoManager['initiateRecordedCall']>>;

            return {
                success: true,
                data: {
                    callUuid: result.callUuid,
                    message: result.message,
                    apiId: result.apiId,
                },
                retryCount,
                circuitBreakerState: String(this.makeCallBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.makeCallBreaker.opened),
            };
        }
    }    /**
     * Make a call with resilience
     * 
     * @param to - Destination phone number
     * @param from - Source phone number
     * @param answerUrl - Answer URL
     * @returns Promise with call result
     */
    async makeCall(
        to: string,
        from?: string,
        answerUrl?: string
    ): Promise<CallResult<{ request_uuid: string; message: string; api_id: string }>> {
        try {
            let retryCount = 0;

            const result = await this.makeCallBreaker.fire(async () => {
                return await this.executeWithRetry(
                    async () => {
                        retryCount++;
                        return await this.manager.makeCall(to, from, answerUrl);
                    },
                    'makeCall'
                );
            }) as Awaited<ReturnType<PlivoManager['makeCall']>>;

            return {
                success: true,
                data: {
                    request_uuid: result.request_uuid,
                    message: result.message,
                    api_id: result.api_id,
                },
                retryCount,
                circuitBreakerState: String(this.makeCallBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.makeCallBreaker.opened),
            };
        }
    }

    /**
     * Get call details with resilience
     * 
     * @param callUuid - Call UUID
     * @returns Promise with call details result
     */
    async getCallDetails(callUuid: string): Promise<CallResult<GetCallDetailsResponse>> {
        try {
            let retryCount = 0;

            const result = await this.getCallDetailsBreaker.fire(async () => {
                return await this.executeWithRetry(
                    async () => {
                        retryCount++;
                        return await this.manager.getCallDetails(callUuid);
                    },
                    'getCallDetails'
                );
            }) as GetCallDetailsResponse;

            return {
                success: true,
                data: result,
                retryCount,
                circuitBreakerState: String(this.getCallDetailsBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.getCallDetailsBreaker.opened),
            };
        }
    }    /**
     * Terminate a call with resilience
     * 
     * @param callUuid - Call UUID
     * @returns Promise with termination result
     */
    async terminateCall(callUuid: string): Promise<CallResult<{ message: string }>> {
        try {
            let retryCount = 0;

            const result = await this.executeWithRetry(
                async () => {
                    retryCount++;
                    return await this.manager.terminateCall(callUuid);
                },
                'terminateCall'
            );

            return {
                success: true,
                data: { message: result.message },
                retryCount,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * Wait for recording with resilience
     * 
     * @param callUuid - Call UUID
     * @param maxAttempts - Maximum polling attempts
     * @param delayMs - Delay between attempts
     * @returns Promise with call details or null
     */
    async waitForRecording(
        callUuid: string,
        maxAttempts: number = 30,
        delayMs: number = 2000
    ): Promise<GetCallDetailsResponse | null> {
        try {
            return await this.executeWithRetry(
                async () => {
                    const result = await this.manager.waitForRecording(callUuid, maxAttempts, delayMs);
                    if (!result) {
                        throw new Error('Recording not available after maximum attempts');
                    }
                    return result;
                },
                'waitForRecording'
            );
        } catch (error) {
            console.error('[PlivoResilient] Failed to get recording:', error);
            return null;
        }
    }

    /**
     * Get circuit breaker statistics
     * 
     * @returns Object with circuit breaker stats
     */
    getCircuitBreakerStats(): {
        makeCall: CircuitBreaker.Status;
        getCallDetails: CircuitBreaker.Status;
    } {
        return {
            makeCall: this.makeCallBreaker.status,
            getCallDetails: this.getCallDetailsBreaker.status,
        };
    }

    /**
     * Reset all circuit breakers
     */
    resetCircuitBreakers(): void {
        this.makeCallBreaker.close();
        this.getCallDetailsBreaker.close();
        console.info('[PlivoResilient] All circuit breakers reset');
    }

    /**
     * Get the manager instance for direct access
     * 
     * @returns PlivoManager instance
     */
    getManager(): PlivoManager {
        return this.manager;
    }

    /**
     * Shutdown and clean up resources
     */
    shutdown(): void {
        this.makeCallBreaker.shutdown();
        this.getCallDetailsBreaker.shutdown();
    }
}

/**
 * Factory function to create a PlivoResilient instance
 * 
 * @param config - Resilient configuration
 * @returns Configured PlivoResilient instance
 */
export function createPlivoResilient(config: PlivoResilientConfig): PlivoResilient {
    return new PlivoResilient(config);
}
