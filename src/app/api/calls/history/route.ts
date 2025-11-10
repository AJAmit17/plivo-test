/**
 * API Route: /api/calls/history
 * 
 * Returns the authenticated user's call history with scam detection results
 */

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        // Check authentication
        const user = await getUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Fetch user's calls from database
        const { data: calls, error } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('[Call History] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch call history' },
                { status: 500 }
            );
        }

        // Format response
        const formattedCalls = calls?.map((call) => ({
            id: call.id,
            callUuid: call.call_uuid,
            fromNumber: call.from_number,
            toNumber: call.to_number,
            duration: call.duration,
            status: call.status,
            recordingUrl: call.recording_url,
            transcript: call.transcript,
            transcriptionStatus: call.transcription_status,
            transcriptionConfidence: call.transcription_confidence,
            scamStatus: call.scam_status,
            scamConfidence: call.scam_confidence,
            scamReason: call.scam_reason,
            createdAt: call.created_at,
            updatedAt: call.updated_at,
        })) || [];

        return NextResponse.json({
            success: true,
            calls: formattedCalls,
            total: formattedCalls.length,
        });
    } catch (error) {
        console.error('[Call History] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
