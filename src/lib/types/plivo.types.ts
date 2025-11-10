/**
 * Plivo API Types and DTOs
 */

// ==================== Request DTOs ====================

export interface MakeCallRequest {
    from: string;
    to: string;
    answer_url: string;
    answer_method?: 'GET' | 'POST';
    ring_url?: string;
    ring_method?: 'GET' | 'POST';
    hangup_url?: string;
    hangup_method?: 'GET' | 'POST';
    fallback_url?: string;
    fallback_method?: 'GET' | 'POST';
    caller_name?: string;
    send_digits?: string;
    send_on_preanswer?: boolean;
    time_limit?: number;
    hangup_on_ring?: number;
    machine_detection?: 'true' | 'false' | 'hangup';
    machine_detection_time?: number;
    machine_detection_url?: string;
    machine_detection_method?: 'GET' | 'POST';
    sip_headers?: string;
    ring_timeout?: number;
    parent_call_uuid?: string;
    error_if_parent_not_found?: boolean;
}

export interface GetCallDetailsRequest {
    callUuid: string;
}

// ==================== Response DTOs ====================

export interface MakeCallResponse {
    message: string;
    request_uuid: string;
    api_id: string;
}

export interface CallDetail {
    call_uuid: string;
    call_status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'canceled';
    from_number: string;
    to_number: string;
    answer_time: string | null;
    end_time: string | null;
    total_duration: number;
    bill_duration: number;
    total_amount: string;
    parent_call_uuid: string | null;
    direction: 'inbound' | 'outbound';
    call_state: string;
    recording_url?: string;
    conference_uuid?: string | null;
    hangup_cause_code?: number;
    hangup_cause_name?: string;
    hangup_source?: string;
}

export interface GetCallDetailsResponse {
  api_id: string;
  call_uuid: string;
  from_number: string;
  to_number: string;
  call_direction: 'inbound' | 'outbound';
  call_duration: number;
  call_state: string;
  call_status: string;
  total_amount: string;
  total_rate: string;
  parent_call_uuid: string | null;
  hangup_cause_code: number;
  hangup_cause_name: string;
  hangup_source: string;
  resource_uri: string;
  recording_url?: string;
}// ==================== Recording Callback DTOs ====================

export interface RecordingCallbackPayload {
    RecordingID: string;
    RecordingUrl: string;
    RecordingDuration: string;
    RecordingDurationMs: string;
    RecordingStartMs: string;
    RecordingEndMs: string;
    CallUUID: string;
    RecordingFormat: string;
    From: string;
    To: string;
}

// ==================== XML Response Types ====================

export interface RecordXMLOptions {
    action?: string;
    method?: 'GET' | 'POST';
    fileFormat?: 'mp3' | 'wav';
    redirect?: boolean;
    timeout?: number;
    maxLength?: number;
    playBeep?: boolean;
    finishOnKey?: string;
    transcriptionType?: 'auto' | 'hybrid';
    transcriptionUrl?: string;
    transcriptionMethod?: 'GET' | 'POST';
    callbackUrl?: string;
    callbackMethod?: 'GET' | 'POST';
}

// ==================== Error Types ====================

export interface PlivoError {
    error: string;
    api_id?: string;
}

export interface PlivoServiceError extends Error {
    statusCode?: number;
    plivoError?: PlivoError;
}
