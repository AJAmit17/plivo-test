/**
 * Global type declarations for Plivo Browser SDK
 * Loaded via CDN: https://cdn.plivo.com/sdk/browser/v2/plivo.min.js
 */

declare global {
    interface Window {
        Plivo: {
            Client: new (options: PlivoClientOptions) => PlivoClient;
        };
    }
}

export interface PlivoClientOptions {
    debug?: 'ALL' | 'ERROR' | 'INFO' | 'WARN';
    permOnClick?: boolean;
    enableIPV6?: boolean;
    audioConstraints?: {
        optional?: Array<{ [key: string]: boolean }>;
    };
    enableTracking?: boolean;
    closeProtection?: boolean;
    maxAverageBitrate?: number;
}

export interface PlivoClient {
    login(username: string, password: string): void;
    logout(): void;
    call(destination: string, extraHeaders?: Record<string, string>): PlivoCall;
    answer(): void;
    reject(): void;
    ignore(): void;
    hangup(): void;
    mute(): void;
    unmute(): void;
    sendDtmf(digit: string): void;
    on(event: PlivoEvent, callback: (...args: unknown[]) => void): void;
    off(event: PlivoEvent): void;
}

export interface PlivoCall {
    answer(): void;
    hangup(): void;
    mute(): void;
    unmute(): void;
    hold(): void;
    unhold(): void;
    sendDtmf(digit: string): void;
    callUUID?: string;
    direction?: 'inbound' | 'outbound';
    state?: string;
}

export type PlivoEvent =
    | 'onReady'
    | 'onLogin'
    | 'onLoginFailed'
    | 'onLogout'
    | 'onCalling'
    | 'onCallRemoteRinging'
    | 'onCallAnswered'
    | 'onCallTerminated'
    | 'onCallFailed'
    | 'onMediaConnected'
    | 'onMediaPermission'
    | 'onIncomingCall'
    | 'onIncomingCallCanceled'
    | 'onWebrtcNotSupported'
    | 'onConnectionChange';

export { };
