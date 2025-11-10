/**
 * Deepgram Resilience Layer
 * 
 * This layer adds resilience patterns on top of the DeepgramManager.
 * Implements circuit breaker, retry with exponential backoff, and error handling.
 */

import CircuitBreaker from 'opossum';
import {
    DeepgramManager,
    DeepgramManagerConfig,
    TranscribeRecordingRequest,
    TranscribeRecordingResponse,
} from '@/lib/managers/deepgram-manager';
import { DeepgramTranscriptionResponse, DeepgramTranscriptionOptions } from '@/lib/types/deepgram.types';

export interface DeepgramResilientConfig extends DeepgramManagerConfig {
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

export interface TranscriptionResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    retryCount?: number;
    circuitBreakerState?: string;
}

export class DeepgramResilient {
    private manager: DeepgramManager;
    private config: DeepgramResilientConfig;

    // Circuit breakers for different operations
    private transcribeBreaker: CircuitBreaker;

    constructor(config: DeepgramResilientConfig) {
        this.config = {
            circuitBreakerTimeout: 60000, // 60 seconds for transcription
            circuitBreakerErrorThresholdPercentage: 50,
            circuitBreakerResetTimeout: 30000,
            circuitBreakerRollingCountTimeout: 10000,
            circuitBreakerRollingCountBuckets: 10,
            maxRetries: 3,
            retryDelay: 2000, // Start with 2 seconds for transcription
            retryMultiplier: 2,
            maxRetryDelay: 20000, // Max 20 seconds between retries
            ...config,
        };

        this.manager = new DeepgramManager(config);

        // Initialize circuit breaker
        this.transcribeBreaker = this.createCircuitBreaker('transcribe');

        // Setup event listeners for monitoring
        this.setupCircuitBreakerListeners(this.transcribeBreaker, 'transcribe');
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
    }

    /**
     * Setup event listeners for circuit breaker monitoring
     * 
     * @param breaker - Circuit breaker instance
     * @param name - Circuit breaker name
     */
    private setupCircuitBreakerListeners(breaker: CircuitBreaker, name: string): void {
        breaker.on('open', () => {
            console.warn(`[DeepgramResilient] Circuit breaker '${name}' opened`);
        });

        breaker.on('halfOpen', () => {
            console.info(`[DeepgramResilient] Circuit breaker '${name}' half-open`);
        });

        breaker.on('close', () => {
            console.info(`[DeepgramResilient] Circuit breaker '${name}' closed`);
        });

        breaker.on('fallback', () => {
            console.warn(`[DeepgramResilient] Circuit breaker '${name}' fallback triggered`);
        });
    }

    /**
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
        const retryDelay = this.config.retryDelay || 2000;
        const retryMultiplier = this.config.retryMultiplier || 2;
        const maxRetryDelay = this.config.maxRetryDelay || 20000;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    // Calculate exponential backoff delay
                    const delay = Math.min(retryDelay * Math.pow(retryMultiplier, attempt), maxRetryDelay);

                    console.warn(
                        `[DeepgramResilient] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
                        `Retrying in ${delay}ms...`,
                        lastError.message
                    );

                    await this.sleep(delay);
                } else {
                    console.error(
                        `[DeepgramResilient] ${operationName} failed after ${maxRetries + 1} attempts`,
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
     * Transcribe a recording with full resilience
     * 
     * @param request - Transcription request
     * @returns Promise with transcription result including resilience metadata
     */
    async transcribeRecording(
        request: TranscribeRecordingRequest
    ): Promise<TranscriptionResult<TranscribeRecordingResponse>> {
        try {
            let retryCount = 0;

            const result = (await this.transcribeBreaker.fire(async () => {
                return await this.executeWithRetry(async () => {
                    retryCount++;
                    return await this.manager.transcribeRecording(request);
                }, 'transcribeRecording');
            })) as TranscribeRecordingResponse;

            return {
                success: true,
                data: result,
                retryCount,
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        }
    }

    /**
     * Transcribe from URL with resilience
     * 
     * @param url - URL of the audio file
     * @param options - Transcription options
     * @returns Promise with transcription result
     */
    async transcribeUrl(
        url: string,
        options?: DeepgramTranscriptionOptions
    ): Promise<TranscriptionResult<DeepgramTranscriptionResponse>> {
        try {
            let retryCount = 0;

            const result = (await this.transcribeBreaker.fire(async () => {
                return await this.executeWithRetry(async () => {
                    retryCount++;
                    return await this.manager.transcribeUrl(url, options);
                }, 'transcribeUrl');
            })) as DeepgramTranscriptionResponse;

            return {
                success: true,
                data: result,
                retryCount,
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        }
    }

    /**
     * Transcribe with conversation insights and resilience
     * 
     * @param recordingUrl - URL of the recording
     * @returns Promise with transcript and insights
     */
    async transcribeWithInsights(recordingUrl: string): Promise<
        TranscriptionResult<{
            transcript: string;
            confidence: number;
            duration: number;
            speakers: number;
            utterances: Array<{
                speaker: number;
                text: string;
                start: number;
                end: number;
                confidence: number;
            }>;
            sentiment?: 'positive' | 'negative' | 'neutral';
        }>
    > {
        try {
            let retryCount = 0;

            const result = (await this.transcribeBreaker.fire(async () => {
                return await this.executeWithRetry(async () => {
                    retryCount++;
                    return await this.manager.transcribeWithInsights(recordingUrl);
                }, 'transcribeWithInsights');
            })) as Awaited<ReturnType<DeepgramManager['transcribeWithInsights']>>;

            return {
                success: true,
                data: result,
                retryCount,
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        }
    }

    /**
     * Transcribe buffer with resilience
     * 
     * @param buffer - Audio buffer
     * @param options - Transcription options
     * @returns Promise with transcription result
     */
    async transcribeBuffer(
        buffer: Buffer,
        options?: DeepgramTranscriptionOptions
    ): Promise<TranscriptionResult<DeepgramTranscriptionResponse>> {
        try {
            let retryCount = 0;

            const result = (await this.transcribeBreaker.fire(async () => {
                return await this.executeWithRetry(async () => {
                    retryCount++;
                    return await this.manager.transcribeBuffer(buffer, options);
                }, 'transcribeBuffer');
            })) as DeepgramTranscriptionResponse;

            return {
                success: true,
                data: result,
                retryCount,
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                circuitBreakerState: String(this.transcribeBreaker.opened),
            };
        }
    }

    /**
     * Get circuit breaker statistics
     * 
     * @returns Object with circuit breaker stats
     */
    getCircuitBreakerStats(): {
        transcribe: CircuitBreaker.Status;
    } {
        return {
            transcribe: this.transcribeBreaker.status,
        };
    }

    /**
     * Reset all circuit breakers
     */
    resetCircuitBreakers(): void {
        this.transcribeBreaker.close();
        console.info('[DeepgramResilient] All circuit breakers reset');
    }

    /**
     * Get the manager instance for direct access
     * 
     * @returns DeepgramManager instance
     */
    getManager(): DeepgramManager {
        return this.manager;
    }

    /**
     * Shutdown and clean up resources
     */
    shutdown(): void {
        this.transcribeBreaker.shutdown();
    }
}

/**
 * Factory function to create a DeepgramResilient instance
 * 
 * @param config - Resilient configuration
 * @returns Configured DeepgramResilient instance
 */
export function createDeepgramResilient(config: DeepgramResilientConfig): DeepgramResilient {
    return new DeepgramResilient(config);
}
