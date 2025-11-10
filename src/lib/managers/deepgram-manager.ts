/**
 * Deepgram Manager Layer
 * 
 * This layer adds business logic and abstraction on top of the DeepgramService.
 * It handles configuration, result processing, and simplifies transcription workflows.
 */

import { DeepgramService } from '@/lib/services/deepgram-service';
import {
    TranscribeUrlRequest,
    TranscriptionResult,
    DeepgramTranscriptionOptions,
    DeepgramTranscriptionResponse,
} from '@/lib/types/deepgram.types';

export interface DeepgramManagerConfig {
    apiKey: string;
    defaultModel?: 'nova-2' | 'nova' | 'enhanced' | 'base' | 'whisper';
    defaultLanguage?: string;
    enableSmartFormat?: boolean;
    enableDiarization?: boolean;
    enableUtterances?: boolean;
    enableSentiment?: boolean;
}

export interface TranscribeRecordingRequest {
    recordingUrl: string;
    callUuid?: string;
    language?: string;
    options?: DeepgramTranscriptionOptions;
}

export interface TranscribeRecordingResponse {
    success: boolean;
    transcript: string;
    confidence: number;
    duration: number;
    wordCount: number;
    utteranceCount?: number;
    language?: string;
    metadata: {
        transactionKey: string;
        requestId: string;
        created: string;
    };
    fullResponse?: TranscriptionResult;
}

export class DeepgramManager {
    private service: DeepgramService;
    private config: DeepgramManagerConfig;

    constructor(config: DeepgramManagerConfig) {
        this.config = config;
        this.service = new DeepgramService(config.apiKey);
    }

    /**
     * Transcribe a call recording from URL
     * 
     * @param request - Recording transcription request
     * @returns Promise with simplified transcription response
     */
    async transcribeRecording(
        request: TranscribeRecordingRequest
    ): Promise<TranscribeRecordingResponse> {
        const options: DeepgramTranscriptionOptions = {
            model: this.config.defaultModel || 'nova-2',
            language: request.language || this.config.defaultLanguage || 'en',
            smart_format: this.config.enableSmartFormat !== false,
            punctuate: true,
            diarize: this.config.enableDiarization !== false,
            utterances: this.config.enableUtterances !== false,
            sentiment: this.config.enableSentiment || false,
            ...request.options,
        };

        const transcribeRequest: TranscribeUrlRequest = {
            url: request.recordingUrl,
            options,
        };

        const result = await this.service.transcribeFromUrlSimplified(transcribeRequest);

        const response: TranscribeRecordingResponse = {
            success: true,
            transcript: result.transcript,
            confidence: result.confidence,
            duration: result.duration,
            wordCount: result.words.length,
            utteranceCount: result.utterances?.length,
            language: result.language,
            metadata: {
                transactionKey: result.metadata.transaction_key,
                requestId: result.metadata.request_id,
                created: result.metadata.created,
            },
            fullResponse: result,
        };

        return response;
    }

    /**
     * Transcribe a call recording and extract conversation insights
     * 
     * @param recordingUrl - URL of the recording
     * @returns Promise with transcript and insights
     */
    async transcribeWithInsights(recordingUrl: string): Promise<{
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
    }> {
        const options: DeepgramTranscriptionOptions = {
            model: this.config.defaultModel || 'nova-2',
            language: this.config.defaultLanguage || 'en',
            smart_format: true,
            punctuate: true,
            diarize: true,
            utterances: true,
            sentiment: true,
        };

        const result = await this.service.transcribeFromUrlSimplified({
            url: recordingUrl,
            options,
        });

        // Extract unique speakers
        const speakers = new Set(
            result.utterances?.map((u) => u.speaker) || []
        );

        // Map utterances to simplified format
        const utterances =
            result.utterances?.map((u) => ({
                speaker: u.speaker,
                text: u.transcript,
                start: u.start,
                end: u.end,
                confidence: u.confidence,
            })) || [];

        return {
            transcript: result.transcript,
            confidence: result.confidence,
            duration: result.duration,
            speakers: speakers.size,
            utterances,
            sentiment: undefined, // Sentiment would come from full response if enabled
        };
    }

    /**
     * Transcribe from URL and get full Deepgram response
     * 
     * @param url - URL of the audio file
     * @param options - Transcription options
     * @returns Promise with full Deepgram transcription response
     */
    async transcribeUrl(
        url: string,
        options?: DeepgramTranscriptionOptions
    ): Promise<DeepgramTranscriptionResponse> {
        const mergedOptions: DeepgramTranscriptionOptions = {
            model: this.config.defaultModel || 'nova-2',
            language: this.config.defaultLanguage || 'en',
            smart_format: this.config.enableSmartFormat !== false,
            punctuate: true,
            diarize: this.config.enableDiarization !== false,
            utterances: this.config.enableUtterances !== false,
            ...options,
        };

        return await this.service.transcribeFromUrl({
            url,
            options: mergedOptions,
        });
    }

    /**
     * Transcribe audio buffer
     * 
     * @param buffer - Audio file buffer
     * @param options - Transcription options
     * @returns Promise with transcription response
     */
    async transcribeBuffer(
        buffer: Buffer,
        options?: DeepgramTranscriptionOptions
    ): Promise<DeepgramTranscriptionResponse> {
        const mergedOptions: DeepgramTranscriptionOptions = {
            model: this.config.defaultModel || 'nova-2',
            language: this.config.defaultLanguage || 'en',
            smart_format: this.config.enableSmartFormat !== false,
            punctuate: true,
            ...options,
        };

        return await this.service.transcribeBuffer(buffer, mergedOptions);
    }

    /**
     * Extract conversation summary from transcript
     * 
     * @param transcript - Full transcript text
     * @param maxLength - Maximum summary length
     * @returns Truncated summary
     */
    extractSummary(transcript: string, maxLength: number = 200): string {
        if (transcript.length <= maxLength) {
            return transcript;
        }

        const truncated = transcript.substring(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');

        return lastSpaceIndex > 0
            ? truncated.substring(0, lastSpaceIndex) + '...'
            : truncated + '...';
    }

    /**
     * Calculate average confidence across all words
     * 
     * @param result - Transcription result
     * @returns Average confidence score (0-1)
     */
    calculateAverageConfidence(result: TranscriptionResult): number {
        if (!result.words || result.words.length === 0) {
            return result.confidence;
        }

        const sum = result.words.reduce((acc, word) => acc + word.confidence, 0);
        return sum / result.words.length;
    }

    /**
     * Detect if transcript quality is acceptable
     * 
     * @param result - Transcription result
     * @param minConfidence - Minimum acceptable confidence (default 0.7)
     * @returns boolean - true if quality is acceptable
     */
    isQualityAcceptable(result: TranscriptionResult, minConfidence: number = 0.7): boolean {
        return result.confidence >= minConfidence;
    }

    /**
     * Extract speaker turns from utterances
     * 
     * @param utterances - Array of utterances
     * @returns Array of speaker turns with speaker changes
     */
    extractSpeakerTurns(
        utterances: Array<{ speaker: number; transcript: string; start: number; end: number }>
    ): Array<{ speaker: number; text: string; duration: number }> {
        return utterances.map((u) => ({
            speaker: u.speaker,
            text: u.transcript,
            duration: u.end - u.start,
        }));
    }

    /**
     * Calculate conversation duration and speaker statistics
     * 
     * @param utterances - Array of utterances
     * @returns Statistics about the conversation
     */
    calculateConversationStats(
        utterances: Array<{ speaker: number; start: number; end: number }>
    ): {
        totalDuration: number;
        speakerCount: number;
        speakerDurations: Map<number, number>;
    } {
        const speakerDurations = new Map<number, number>();
        let totalDuration = 0;

        utterances.forEach((u) => {
            const duration = u.end - u.start;
            totalDuration += duration;

            const currentDuration = speakerDurations.get(u.speaker) || 0;
            speakerDurations.set(u.speaker, currentDuration + duration);
        });

        return {
            totalDuration,
            speakerCount: speakerDurations.size,
            speakerDurations,
        };
    }

    /**
     * Validate the Deepgram API key
     * 
     * @returns Promise<boolean> - true if API key is valid
     */
    async validateApiKey(): Promise<boolean> {
        return await this.service.validateApiKey();
    }

    /**
     * Get the service instance for advanced operations
     * 
     * @returns DeepgramService instance
     */
    getService(): DeepgramService {
        return this.service;
    }
}

/**
 * Factory function to create a DeepgramManager instance
 * 
 * @param config - Manager configuration
 * @returns Configured DeepgramManager instance
 */
export function createDeepgramManager(config: DeepgramManagerConfig): DeepgramManager {
    return new DeepgramManager(config);
}
