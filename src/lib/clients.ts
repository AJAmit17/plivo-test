/**
 * Factory functions to create configured resilient client instances
 */

import { PlivoResilient, createPlivoResilient } from '@/lib/resilience/plivo-resilient';
import { DeepgramResilient, createDeepgramResilient } from '@/lib/resilience/deepgram-resilient';

// Singleton instances
let plivoClient: PlivoResilient | null = null;
let deepgramClient: DeepgramResilient | null = null;

/**
 * Get or create Plivo resilient client
 * 
 * @returns PlivoResilient instance
 */
export function getPlivoClient(): PlivoResilient {
    if (!plivoClient) {
        const authId = process.env.PLIVO_AUTH_ID;
        const authToken = process.env.PLIVO_AUTH_TOKEN;
        const defaultPhoneNumber = process.env.PLIVO_PHONE_NUMBER;
        const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL;

        if (!authId || !authToken || !defaultPhoneNumber || !appBaseUrl) {
            throw new Error(
                'Missing required Plivo environment variables: PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER, APP_BASE_URL'
            );
        }

        plivoClient = createPlivoResilient({
            authId,
            authToken,
            defaultPhoneNumber,
            appBaseUrl,
            defaultTimeLimit: 3600,
            defaultRingTimeout: 30,
            // Circuit breaker settings
            circuitBreakerTimeout: 30000,
            circuitBreakerErrorThresholdPercentage: 50,
            circuitBreakerResetTimeout: 30000,
            // Retry settings
            maxRetries: 3,
            retryDelay: 1000,
            retryMultiplier: 2,
            maxRetryDelay: 10000,
        });
    }

    return plivoClient;
}

/**
 * Get or create Deepgram resilient client
 * 
 * @returns DeepgramResilient instance
 */
export function getDeepgramClient(): DeepgramResilient {
    if (!deepgramClient) {
        const apiKey = process.env.DEEPGRAM_API_KEY;

        if (!apiKey) {
            throw new Error('Missing required Deepgram environment variable: DEEPGRAM_API_KEY');
        }

        deepgramClient = createDeepgramResilient({
            apiKey,
            defaultModel: 'nova-2',
            defaultLanguage: 'en',
            enableSmartFormat: true,
            enableDiarization: true,
            enableUtterances: true,
            enableSentiment: false,
            // Circuit breaker settings
            circuitBreakerTimeout: 60000,
            circuitBreakerErrorThresholdPercentage: 50,
            circuitBreakerResetTimeout: 30000,
            // Retry settings
            maxRetries: 3,
            retryDelay: 2000,
            retryMultiplier: 2,
            maxRetryDelay: 20000,
        });
    }

    return deepgramClient;
}

/**
 * Reset all client instances (useful for testing)
 */
export function resetClients(): void {
    if (plivoClient) {
        plivoClient.shutdown();
        plivoClient = null;
    }

    if (deepgramClient) {
        deepgramClient.shutdown();
        deepgramClient = null;
    }
}
