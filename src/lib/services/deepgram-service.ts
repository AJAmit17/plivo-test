/**
 * Deepgram Service Layer
 * 
 * This layer handles direct communication with the Deepgram API.
 * It provides basic REST operations for transcribing audio from URLs.
 * No business logic or resilience patterns - pure API interaction.
 */

import { createClient, DeepgramClient, PrerecordedSchema } from '@deepgram/sdk';
import {
    TranscribeUrlRequest,
    DeepgramTranscriptionResponse,
    TranscriptionResult,
    DeepgramServiceError,
    DeepgramTranscriptionOptions,
} from '@/lib/types/deepgram.types';

export class DeepgramService {
    private client: DeepgramClient;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = createClient(apiKey);
    }

    /**
     * Transcribe audio from a URL using Deepgram's prerecorded API
     * 
     * @param request - Transcription request with URL and options
     * @returns Promise with full Deepgram transcription response
     * @throws DeepgramServiceError if the API request fails
     */
    async transcribeFromUrl(
        request: TranscribeUrlRequest
    ): Promise<DeepgramTranscriptionResponse> {
        try {
            const { url, options } = request;

            // Build the request options
            const replaceValue =
                options?.replace && Array.isArray(options.replace)
                    ? (options.replace as { find: string; replace: string }[]).map(
                        (r) => `${r.find}:${r.replace}`
                    )
                    : (options?.replace as string | undefined);

            const deepgramOptions: PrerecordedSchema = {
                model: options?.model || 'nova-2',
                language: options?.language || 'en',
                punctuate: options?.punctuate !== false,
                smart_format: options?.smart_format !== false,
                utterances: options?.utterances !== false,
                diarize: options?.diarize !== false,
                profanity_filter: options?.profanity_filter || false,
                redact: options?.redact,
                paragraphs: options?.paragraphs || false,
                summarize: options?.summarize,
                detect_topics: options?.detect_topics || false,
                intents: options?.intents || false,
                sentiment: options?.sentiment || false,
                keywords: options?.keywords,
                replace: replaceValue,
                search: options?.search,
                callback: options?.callback,
                callback_method: options?.callback_method
                    ? (String(options.callback_method).toLowerCase() as 'post' | 'put')
                    : undefined,
            };

            // Make the API call
            const { result, error } = await this.client.listen.prerecorded.transcribeUrl(
                { url },
                deepgramOptions
            );

            if (error) {
                throw this.createError(error.message, 'transcribeFromUrl', error);
            }

            if (!result) {
                throw this.createError('No result returned from Deepgram', 'transcribeFromUrl');
            }

            return result as DeepgramTranscriptionResponse;
        } catch (error) {
            throw this.handleError(error, 'transcribeFromUrl');
        }
    }

    /**
     * Transcribe audio from a URL and return simplified result
     * 
     * @param request - Transcription request with URL and options
     * @returns Promise with simplified transcription result
     * @throws DeepgramServiceError if the API request fails
     */
    async transcribeFromUrlSimplified(
        request: TranscribeUrlRequest
    ): Promise<TranscriptionResult> {
        try {
            const response = await this.transcribeFromUrl(request);

            // Extract the primary transcript and metadata
            const channel = response.results.channels[0];
            const alternative = channel.alternatives[0];

            const result: TranscriptionResult = {
                transcript: alternative.transcript,
                confidence: alternative.confidence,
                duration: response.metadata.duration,
                words: alternative.words,
                utterances: response.results.utterances,
                language: channel.detected_language,
                metadata: {
                    transaction_key: response.metadata.transaction_key,
                    request_id: response.metadata.request_id,
                    created: response.metadata.created,
                },
            };

            return result;
        } catch (error) {
            throw this.handleError(error, 'transcribeFromUrlSimplified');
        }
    }

    /**
     * Transcribe audio file buffer
     * 
     * @param audioBuffer - Audio file as Buffer
     * @param options - Transcription options
     * @returns Promise with full Deepgram transcription response
     * @throws DeepgramServiceError if the API request fails
     */
    async transcribeBuffer(
        audioBuffer: Buffer,
        options?: DeepgramTranscriptionOptions
    ): Promise<DeepgramTranscriptionResponse> {
        try {
            const deepgramOptions: PrerecordedSchema = {
                model: options?.model || 'nova-2',
                language: options?.language || 'en',
                punctuate: options?.punctuate !== false,
                smart_format: options?.smart_format !== false,
                utterances: options?.utterances !== false,
                diarize: options?.diarize !== false,
                profanity_filter: options?.profanity_filter || false,
                redact: options?.redact,
                paragraphs: options?.paragraphs || false,
                summarize: options?.summarize,
                detect_topics: options?.detect_topics || false,
                intents: options?.intents || false,
                sentiment: options?.sentiment || false,
                keywords: options?.keywords,
            };

            const { result, error } = await this.client.listen.prerecorded.transcribeFile(
                audioBuffer,
                deepgramOptions
            );

            if (error) {
                throw this.createError(error.message, 'transcribeBuffer', error);
            }

            if (!result) {
                throw this.createError('No result returned from Deepgram', 'transcribeBuffer');
            }

            return result as DeepgramTranscriptionResponse;
        } catch (error) {
            throw this.handleError(error, 'transcribeBuffer');
        }
    }

    /**
     * Get usage summary for the API key
     * 
     * @param startDate - Start date for usage query (ISO format)
     * @param endDate - End date for usage query (ISO format)
     * @returns Promise with usage data
     * @throws DeepgramServiceError if the API request fails
     */
    // async getUsage(startDate: string, endDate: string): Promise<unknown> {
    //     try {
    //         const { result, error } = await this.client.manage.getUsage({
    //             start: startDate,
    //             end: endDate,
    //         });

    //         if (error) {
    //             throw this.createError(error.message, 'getUsage', error);
    //         }

    //         return result;
    //     } catch (error) {
    //         throw this.handleError(error, 'getUsage');
    //     }
    // }

    /**
     * Validate the API key
     * 
     * @returns Promise<boolean> - true if API key is valid
     */
    async validateApiKey(): Promise<boolean> {
        try {
            // Make a minimal API call to test credentials
            const testUrl = 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';
            const { error } = await this.client.listen.prerecorded.transcribeUrl(
                { url: testUrl },
                { model: 'nova-2', smart_format: true }
            );

            return !error;
        } catch {
            return false;
        }
    }

    /**
     * Create a standardized DeepgramServiceError
     * 
     * @param message - Error message
     * @param method - Method name where error occurred
     * @param originalError - Original error object
     * @returns DeepgramServiceError
     */
    private createError(
        message: string,
        method: string,
        originalError?: Error | { code?: string; message?: string; request_id?: string }
    ): DeepgramServiceError {
        const error = new Error(
            `Deepgram API error in ${method}: ${message}`
        ) as DeepgramServiceError;
        error.name = 'DeepgramServiceError';

        if (originalError) {
            error.deepgramError = {
                err_code: ('code' in originalError && originalError.code) || 'UNKNOWN',
                err_msg: ('message' in originalError && originalError.message) || message,
                request_id: 'request_id' in originalError ? originalError.request_id : undefined,
            };
        }

        return error;
    }    /**
     * Handle errors and convert to DeepgramServiceError
     * 
     * @param error - The caught error
     * @param method - The method name where error occurred
     * @returns DeepgramServiceError with detailed error information
     */
    private handleError(error: unknown, method: string): DeepgramServiceError {
        if (error instanceof Error && error.name === 'DeepgramServiceError') {
            return error as DeepgramServiceError;
        }

        if (error instanceof Error) {
            return this.createError(error.message, method, error);
        }

        return this.createError(String(error), method);
    }
}

/**
 * Factory function to create a DeepgramService instance
 * 
 * @param apiKey - Deepgram API key
 * @returns Configured DeepgramService instance
 */
export function createDeepgramService(apiKey: string): DeepgramService {
    if (!apiKey) {
        throw new Error('Deepgram API key is required');
    }
    return new DeepgramService(apiKey);
}
