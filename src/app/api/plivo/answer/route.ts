/**
 * API Route: /api/plivo/answer
 * 
 * This endpoint is called by Plivo when a call is answered.
 * It returns XML to instruct Plivo to record the call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlivoClient } from '@/lib/clients';

export async function POST(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const recordingCallback = searchParams.get('recording_callback');

        const plivoClient = getPlivoClient();
        const manager = plivoClient.getManager();

        // Generate XML to record the call
        const xml = manager.generateRecordingXML({
            callbackUrl: recordingCallback || undefined,
            callbackMethod: 'POST',
            fileFormat: 'mp3',
            redirect: true,
            timeout: 4,
            maxLength: 3600,
            playBeep: true,
            finishOnKey: '#',
        });

        return new NextResponse(xml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
            },
        });
    } catch (error) {
        console.error('[Plivo Answer] Error:', error);

        // Return a simple hangup XML on error
        const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>We're sorry, there was an error processing your call.</Speak>
  <Hangup/>
</Response>`;

        return new NextResponse(errorXml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
            },
        });
    }
}

// Handle GET requests (in case Plivo uses GET)
export async function GET(request: NextRequest) {
    return POST(request);
}
