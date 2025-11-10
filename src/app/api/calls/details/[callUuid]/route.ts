/**
 * API Route: /api/calls/details/[callUuid]
 * 
 * This endpoint retrieves details for a specific call including transcription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlivoClient } from '@/lib/clients';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: { callUuid: string } }
) {
    try {
        // Check authentication
        // const user = await getUser();
        // if (!user) {
        //     return NextResponse.json(
        //         { error: 'Unauthorized' },
        //         { status: 401 }
        //     );
        // }

        const { callUuid } = params;

        if (!callUuid) {
            return NextResponse.json(
                { error: 'Missing callUuid parameter' },
                { status: 400 }
            );
        }

        // Get call details from Plivo
        const plivoClient = getPlivoClient();
        const plivoResult = await plivoClient.getCallDetails(callUuid);

        if (!plivoResult.success || !plivoResult.data) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch call details from Plivo',
                    message: plivoResult.error?.message,
                },
                { status: 500 }
            );
        }

        // Get transcription and additional data from database
        const { data: callData, error: dbError } = await supabase
            .from('calls')
            .select('*')
            .eq('call_uuid', callUuid)
            .single();

        if (dbError && dbError.code !== 'PGRST116') {
            console.error('[Call Details] Database error:', dbError);
        }

        // Combine Plivo data with database data
        const response = {
            callUuid,
            fromNumber: plivoResult.data.from_number,
            toNumber: plivoResult.data.to_number,
            callStatus: plivoResult.data.call_status,
            callDuration: plivoResult.data.call_duration,
            totalAmount: plivoResult.data.total_amount,
            hangupCause: plivoResult.data.hangup_cause_name,
            recordingUrl: plivoResult.data.recording_url || callData?.recording_url,
            transcript: callData?.transcript,
            transcriptionConfidence: callData?.transcription_confidence,
            transcriptionStatus: callData?.transcription_status,
            wordCount: callData?.word_count,
            utteranceCount: callData?.utterance_count,
            detectedLanguage: callData?.detected_language,
            scamStatus: callData?.scam_status,
            scamConfidence: callData?.scam_confidence,
            scamReason: callData?.scam_reason,
            createdAt: callData?.created_at,
            updatedAt: callData?.updated_at,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Call Details] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
