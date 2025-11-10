export interface User {
    id: string;
    email: string;
    full_name?: string;
}

export interface Call {
    id: string;
    call_uuid: string;
    from_number: string;
    to_number: string;
    started_at: string | null;
    ended_at: string | null;
    duration_seconds: number | null;
    status: string;
    created_at: string;
}

export interface AdminCall extends Call {
    user_id: string;
    recording_url: string | null;
    transcript: string | null;
    scam_score: number | null;
    scam_tags: string[] | null;
    scam_reason: string | null;
    flagged: boolean;
    profiles?: {
        email: string;
        full_name: string | null;
    };
}

export interface CallInitiateRequest {
    to_number: string;
    from_number?: string;
}

export interface CallInitiateResponse {
    success: boolean;
    call_uuid: string;
    message: string;
}

export interface PlivoCredentials {
    username: string;
    password: string;
}
