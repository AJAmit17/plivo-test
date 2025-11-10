/**
 * Plivo Manager Layer
 * 
 * This layer adds abstraction and business logic on top of the PlivoService.
 * It handles configuration, call setup, XML generation, and simplifies common operations.
 */

import { PlivoService } from '@/lib/services/plivo-service';
import {
  MakeCallRequest,
  MakeCallResponse,
  GetCallDetailsResponse,
  RecordXMLOptions,
} from '@/lib/types/plivo.types';

export interface PlivoManagerConfig {
  authId: string;
  authToken: string;
  defaultPhoneNumber: string;
  appBaseUrl: string;
  defaultTimeLimit?: number;
  defaultRingTimeout?: number;
}

export interface InitiateRecordedCallRequest {
  to: string;
  from?: string;
  callerName?: string;
  timeLimit?: number;
  recordingCallback?: string;
  answerCallback?: string;
}

export interface InitiateRecordedCallResponse {
  success: boolean;
  callUuid: string;
  message: string;
  apiId: string;
}

export class PlivoManager {
  private service: PlivoService;
  private config: PlivoManagerConfig;

  constructor(config: PlivoManagerConfig) {
    this.config = config;
    this.service = new PlivoService(config.authId, config.authToken);
  }

  /**
   * Initiate a recorded outbound call with automatic XML generation
   * 
   * @param request - Simplified call request with recording options
   * @returns Promise with call initiation result
   */
  async initiateRecordedCall(
    request: InitiateRecordedCallRequest
  ): Promise<InitiateRecordedCallResponse> {
    const from = request.from || this.config.defaultPhoneNumber;
    const answerUrl = request.answerCallback || `${this.config.appBaseUrl}/api/plivo/answer`;
    const recordingCallbackUrl =
      request.recordingCallback || `${this.config.appBaseUrl}/api/plivo/recording-callback`;

    // Build the answer URL with query parameters for recording callback
    const answerUrlWithParams = `${answerUrl}?recording_callback=${encodeURIComponent(
      recordingCallbackUrl
    )}`;

    const callRequest: MakeCallRequest = {
      from,
      to: request.to,
      answer_url: answerUrlWithParams,
      answer_method: 'POST',
      caller_name: request.callerName,
      time_limit: request.timeLimit || this.config.defaultTimeLimit || 3600,
      ring_timeout: this.config.defaultRingTimeout || 30,
    };

    const response = await this.service.makeCall(callRequest);

    return {
      success: true,
      callUuid: response.request_uuid,
      message: response.message,
      apiId: response.api_id,
    };
  }

  /**
   * Make a standard outbound call without recording
   * 
   * @param to - Destination phone number
   * @param from - Source phone number (optional, uses default)
   * @param answerUrl - URL to handle call answer
   * @returns Promise with call response
   */
  async makeCall(
    to: string,
    from?: string,
    answerUrl?: string
  ): Promise<MakeCallResponse> {
    const callRequest: MakeCallRequest = {
      from: from || this.config.defaultPhoneNumber,
      to,
      answer_url: answerUrl || `${this.config.appBaseUrl}/api/plivo/answer`,
      answer_method: 'POST',
      time_limit: this.config.defaultTimeLimit || 3600,
      ring_timeout: this.config.defaultRingTimeout || 30,
    };

    return await this.service.makeCall(callRequest);
  }

  /**
   * Get detailed information about a specific call
   * 
   * @param callUuid - UUID of the call
   * @returns Promise with call details
   */
  async getCallDetails(callUuid: string): Promise<GetCallDetailsResponse> {
    return await this.service.getCallDetails({ callUuid });
  }

  /**
   * Get all calls with optional filters
   * 
   * @param filters - Optional filtering parameters
   * @returns Promise with list of calls
   */
  async getAllCalls(filters?: {
    call_direction?: 'inbound' | 'outbound';
    from_number?: string;
    to_number?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.service.getCalls(filters);
  }

  /**
   * Terminate an active call
   * 
   * @param callUuid - UUID of the call to terminate
   * @returns Promise with termination result
   */
  async terminateCall(callUuid: string): Promise<{ success: boolean; message: string }> {
    const result = await this.service.terminateCall(callUuid);
    return {
      success: true,
      message: result.message,
    };
  }

  /**
   * Check if a call is still active
   * 
   * @param callUuid - UUID of the call
   * @returns Promise<boolean> - true if call is active
   */
  async isCallActive(callUuid: string): Promise<boolean> {
    try {
      const details = await this.service.getCallDetails({ callUuid });
      return ['queued', 'ringing', 'in-progress'].includes(details.call_status);
    } catch {
      return false;
    }
  }

  /**
   * Generate Plivo XML for answering a call with recording
   * 
   * @param options - Recording configuration options
   * @returns XML string for Plivo response
   */
  generateRecordingXML(options: RecordXMLOptions = {}): string {
    const {
      action = options.callbackUrl,
      method = options.callbackMethod || 'POST',
      fileFormat = 'mp3',
      redirect = true,
      timeout = 4,
      maxLength = 3600,
      playBeep = true,
      finishOnKey = '#',
      transcriptionType,
      transcriptionUrl,
      transcriptionMethod,
    } = options;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    xml += '  <Speak>This call will be recorded for quality and training purposes.</Speak>\n';
    xml += '  <Record';

    if (action) xml += ` action="${action}"`;
    if (method) xml += ` method="${method}"`;
    if (fileFormat) xml += ` fileFormat="${fileFormat}"`;
    if (redirect !== undefined) xml += ` redirect="${redirect}"`;
    if (timeout !== undefined) xml += ` timeout="${timeout}"`;
    if (maxLength !== undefined) xml += ` maxLength="${maxLength}"`;
    if (playBeep !== undefined) xml += ` playBeep="${playBeep}"`;
    if (finishOnKey) xml += ` finishOnKey="${finishOnKey}"`;
    if (transcriptionType) xml += ` transcriptionType="${transcriptionType}"`;
    if (transcriptionUrl) xml += ` transcriptionUrl="${transcriptionUrl}"`;
    if (transcriptionMethod) xml += ` transcriptionMethod="${transcriptionMethod}"`;

    xml += '/>\n';
    xml += '</Response>';

    return xml;
  }

  /**
   * Generate simple speak XML
   * 
   * @param text - Text to speak
   * @param voice - Voice to use (optional)
   * @returns XML string for Plivo response
   */
  generateSpeakXML(text: string, voice?: string): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    xml += '  <Speak';
    if (voice) xml += ` voice="${voice}"`;
    xml += `>${text}</Speak>\n`;
    xml += '</Response>';

    return xml;
  }

  /**
   * Generate XML for hanging up a call
   * 
   * @param reason - Optional reason for hangup
   * @returns XML string for Plivo response
   */
  generateHangupXML(reason?: string): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    if (reason) {
      xml += `  <Speak>${reason}</Speak>\n`;
    }
    xml += '  <Hangup/>\n';
    xml += '</Response>';

    return xml;
  }

  /**
   * Wait for a call recording to be available
   * 
   * @param callUuid - UUID of the call
   * @param maxAttempts - Maximum number of polling attempts
   * @param delayMs - Delay between attempts in milliseconds
   * @returns Promise with call details including recording URL
   */
  async waitForRecording(
    callUuid: string,
    maxAttempts: number = 30,
    delayMs: number = 2000
  ): Promise<GetCallDetailsResponse | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const details = await this.service.getCallDetails({ callUuid });

      if (details.call_status === 'completed' && details.recording_url) {
        return details;
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
  }

  /**
   * Validate the Plivo credentials
   * 
   * @returns Promise<boolean> - true if credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    return await this.service.validateCredentials();
  }

  /**
   * Get the service instance for advanced operations
   * 
   * @returns PlivoService instance
   */
  getService(): PlivoService {
    return this.service;
  }
}

/**
 * Factory function to create a PlivoManager instance
 * 
 * @param config - Manager configuration
 * @returns Configured PlivoManager instance
 */
export function createPlivoManager(config: PlivoManagerConfig): PlivoManager {
  return new PlivoManager(config);
}
