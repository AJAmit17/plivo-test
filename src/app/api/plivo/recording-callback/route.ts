/**
 * API Route: /api/plivo/recording-callback
 * 
 * This endpoint receives callbacks from Plivo when a recording is complete.
 * It triggers the Deepgram transcription and stores the results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeepgramClient } from '@/lib/clients';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // Extract Plivo recording callback data
        const recordingId = formData.get('RecordingID') as string;
        const recordingUrl = formData.get('RecordingUrl') as string;
        const recordingDuration = formData.get('RecordingDuration') as string;
        const callUuid = formData.get('CallUUID') as string;
        const from = formData.get('From') as string;
        const to = formData.get('To') as string;

        console.log('[Plivo Recording Callback] Received:', {
            recordingId,
            recordingUrl,
            callUuid,
            from,
            to,
        });

        if (!recordingUrl || !callUuid) {
            return NextResponse.json(
                { error: 'Missing required fields: RecordingUrl or CallUUID' },
                { status: 400 }
            );
        }

        // Store initial call record in database
        const { error: insertError } = await supabase.from('calls').upsert({
            call_uuid: callUuid,
            from_number: from,
            to_number: to,
            recording_url: recordingUrl,
            recording_id: recordingId,
            duration: parseInt(recordingDuration) || 0,
            status: 'completed',
            transcription_status: 'pending',
            created_at: new Date().toISOString(),
        });

        if (insertError) {
            console.error('[Plivo Recording Callback] Database error:', insertError);
        }

        // Trigger transcription asynchronously (don't wait for it)
        transcribeRecordingAsync(recordingUrl, callUuid).catch((error) => {
            console.error('[Plivo Recording Callback] Transcription error:', error);
        });

        return NextResponse.json({
            success: true,
            message: 'Recording received, transcription in progress',
            callUuid,
        });
    } catch (error) {
        console.error('[Plivo Recording Callback] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Asynchronously transcribe recording and update database
 */
async function transcribeRecordingAsync(recordingUrl: string, callUuid: string) {
    try {
        const deepgramClient = getDeepgramClient();

        console.log(`[Transcription] Starting for call ${callUuid}`);

        // Transcribe the recording
        const result = await deepgramClient.transcribeRecording({
            recordingUrl,
            callUuid,
        });

        if (!result.success || !result.data) {
            throw new Error(result.error?.message || 'Transcription failed');
        }

        const transcription = result.data;

        console.log(`[Transcription] Completed for call ${callUuid}:`, {
            transcript: transcription.transcript.substring(0, 100),
            confidence: transcription.confidence,
            wordCount: transcription.wordCount,
        });

        // Update database with transcription results
        const { error: updateError } = await supabase
            .from('calls')
            .update({
                transcript: transcription.transcript,
                transcription_confidence: transcription.confidence,
                transcription_duration: transcription.duration,
                word_count: transcription.wordCount,
                utterance_count: transcription.utteranceCount,
                detected_language: transcription.language,
                transcription_status: 'completed',
                transcription_metadata: transcription.metadata,
                updated_at: new Date().toISOString(),
            })
            .eq('call_uuid', callUuid);

        if (updateError) {
            console.error('[Transcription] Database update error:', updateError);
            throw updateError;
        }

        console.log(`[Transcription] Database updated for call ${callUuid}`);
    } catch (error) {
        console.error(`[Transcription] Error for call ${callUuid}:`, error);

        // Update database with error status
        await supabase
            .from('calls')
            .update({
                transcription_status: 'failed',
                transcription_error: error instanceof Error ? error.message : String(error),
                updated_at: new Date().toISOString(),
            })
            .eq('call_uuid', callUuid);
    }
}

// Handle GET requests (for testing)
export async function GET() {
    return NextResponse.json({
        message: 'Plivo recording callback endpoint',
        method: 'POST',
    });
}
