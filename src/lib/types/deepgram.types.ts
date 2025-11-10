/**
 * Deepgram API Types and DTOs
 */

// ==================== Request DTOs ====================

export interface TranscribeUrlRequest {
    url: string;
    options?: DeepgramTranscriptionOptions;
}

export interface DeepgramTranscriptionOptions {
    model?: 'nova-2' | 'nova' | 'enhanced' | 'base' | 'whisper';
    language?: string;
    punctuate?: boolean;
    profanity_filter?: boolean;
    redact?: string[];
    diarize?: boolean;
    diarize_version?: string;
    smart_format?: boolean;
    utterances?: boolean;
    detect_language?: boolean;
    paragraphs?: boolean;
    summarize?: boolean | 'v2';
    detect_topics?: boolean;
    intents?: boolean;
    sentiment?: boolean;
    keywords?: string[];
    replace?: Array<{ find: string; replace: string }>;
    search?: string[];
    callback?: string;
    callback_method?: 'POST' | 'PUT';
}

// ==================== Response DTOs ====================

export interface DeepgramTranscriptionResponse {
    metadata: DeepgramMetadata;
    results: DeepgramResults;
}

export interface DeepgramMetadata {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info?: Record<string, DeepgramModelInfo>;
}

export interface DeepgramModelInfo {
    name: string;
    version: string;
    arch: string;
}

export interface DeepgramResults {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
    summary?: DeepgramSummary;
    topics?: DeepgramTopic[];
    intents?: DeepgramIntent[];
    sentiments?: DeepgramSentiment[];
}

export interface DeepgramChannel {
    alternatives: DeepgramAlternative[];
    detected_language?: string;
    language_confidence?: number;
    search?: DeepgramSearch[];
}

export interface DeepgramAlternative {
    transcript: string;
    confidence: number;
    words: DeepgramWord[];
    paragraphs?: DeepgramParagraphs;
}

export interface DeepgramWord {
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word?: string;
    speaker?: number;
    speaker_confidence?: number;
}

export interface DeepgramParagraphs {
    transcript: string;
    paragraphs: Array<{
        sentences: Array<{
            text: string;
            start: number;
            end: number;
        }>;
        start: number;
        end: number;
        num_words: number;
    }>;
}

export interface DeepgramUtterance {
    start: number;
    end: number;
    confidence: number;
    channel: number;
    transcript: string;
    words: DeepgramWord[];
    speaker: number;
    id: string;
}

export interface DeepgramSummary {
    result: 'success' | 'failure';
    short: string;
}

export interface DeepgramTopic {
    topic: string;
    confidence: number;
}

export interface DeepgramIntent {
    intent: string;
    confidence: number;
}

export interface DeepgramSentiment {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    start?: number;
    end?: number;
}

export interface DeepgramSearch {
    query: string;
    hits: Array<{
        confidence: number;
        start: number;
        end: number;
        snippet: string;
    }>;
}

// ==================== Simplified Response ====================

export interface TranscriptionResult {
    transcript: string;
    confidence: number;
    duration: number;
    words: DeepgramWord[];
    utterances?: DeepgramUtterance[];
    language?: string;
    metadata: {
        transaction_key: string;
        request_id: string;
        created: string;
    };
}

// ==================== Error Types ====================

export interface DeepgramError {
    err_code: string;
    err_msg: string;
    request_id?: string;
}

export interface DeepgramServiceError extends Error {
    statusCode?: number;
    deepgramError?: DeepgramError;
}

// ==================== Configuration Types ====================

export interface DeepgramConfig {
    apiKey: string;
    defaultOptions?: DeepgramTranscriptionOptions;
    timeout?: number;
    retries?: number;
}
