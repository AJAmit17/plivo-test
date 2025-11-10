/**
 * API Route: /api/plivo/endpoint-credentials
 * 
 * Returns Plivo endpoint credentials for browser SDK authentication
 */

import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase';

export async function GET() {
    try {
        const username = process.env.PLIVO_ENDPOINT_USERNAME;
        const password = process.env.PLIVO_ENDPOINT_PASSWORD;

        if (!username || !password) {
            console.error('[Plivo Credentials] Missing endpoint credentials in environment');
            return NextResponse.json(
                { error: 'Plivo endpoint credentials not configured' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            username,
            password,
        });
    } catch (error) {
        console.error('[Plivo Credentials] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
