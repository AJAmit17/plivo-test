/**
 * API Route: /api/calls/initiate
 * 
 * This endpoint initiates a new call with recording enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlivoClient } from '@/lib/clients';
import { getUser } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        // const user = await getUser();
        // if (!user) {
        //     return NextResponse.json(
        //         { error: 'Unauthorized' },
        //         { status: 401 }
        //     );
        // }

        const body = await request.json();
        const { to_number, from_number } = body;

        if (!to_number) {
            return NextResponse.json(
                { error: 'Missing required field: to_number' },
                { status: 400 }
            );
        }

        // Validate phone number format (basic validation)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(to_number)) {
            return NextResponse.json(
                { error: 'Invalid phone number format' },
                { status: 400 }
            );
        }

        const plivoClient = getPlivoClient();

        // console.log('[Call Initiate] Initiating call:', {
        //     userId: user.id,
        //     to: to_number,
        //     from: from_number,
        // });

        // Initiate the call with recording
        const result = await plivoClient.initiateRecordedCall({
            to: to_number,
            from: from_number,
            callerName: undefined,
            timeLimit: undefined,
        });

        if (!result.success || !result.data) {
            console.error('[Call Initiate] Failed:', result.error);
            return NextResponse.json(
                {
                    error: 'Failed to initiate call',
                    message: result.error?.message || 'Unknown error',
                },
                { status: 500 }
            );
        }

        console.log('[Call Initiate] Success:', {
            callUuid: result.data.callUuid,
            message: result.data.message,
        });

        return NextResponse.json({
            success: true,
            callUuid: result.data.callUuid,
            message: result.data.message,
            apiId: result.data.apiId,
            retryCount: result.retryCount,
            circuitBreakerState: result.circuitBreakerState,
        });
    } catch (error) {
        console.error('[Call Initiate] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
