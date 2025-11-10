/* eslint-disable react-hooks/exhaustive-deps */
/**
 * React Hook for Plivo Browser SDK
 * Manages Plivo client initialization, call state, and call controls
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for Plivo Browser SDK
interface PlivoClient {
    login: (username: string, password: string) => void;
    logout: () => void;
    call: (destination: string, extraHeaders?: Record<string, string>) => PlivoCall;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface PlivoCall {
    answer: () => void;
    hangup: () => void;
    mute: () => void;
    unmute: () => void;
    hold: () => void;
    unhold: () => void;
    sendDtmf: (digit: string) => void;
    callUUID?: string;
}

interface UsePlivoClientOptions {
    autoLogin?: boolean;
    debug?: boolean;
}

export type CallStatus =
    | 'idle'
    | 'connecting'
    | 'ringing'
    | 'answered'
    | 'active'
    | 'held'
    | 'ended'
    | 'failed';

export interface CallState {
    status: CallStatus;
    destination: string | null;
    duration: number;
    callUuid: string | null;
    isMuted: boolean;
    isHeld: boolean;
    error: string | null;
}

export function usePlivoClient(options: UsePlivoClientOptions = {}) {
    const [isReady, setIsReady] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [callState, setCallState] = useState<CallState>({
        status: 'idle',
        destination: null,
        duration: 0,
        callUuid: null,
        isMuted: false,
        isHeld: false,
        error: null,
    });
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<PlivoClient | null>(null);
    const currentCallRef = useRef<PlivoCall | null>(null);
    const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Plivo client
    useEffect(() => {
        const initializePlivo = async () => {
            try {
                // Dynamically import Plivo SDK (client-side only)
                const PlivoSDK = await import('plivo-browser-sdk');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Client = (PlivoSDK as any).Client || (PlivoSDK as any).default?.Client;

                if (!Client) {
                    throw new Error('Plivo Client not found in SDK');
                }

                const plivoOptions = {
                    debug: options.debug ? 'ALL' : 'ERROR',
                    permOnClick: true,
                    enableIPV6: false,
                    audioConstraints: { optional: [{ googAutoGainControl: false }] },
                    enableTracking: true,
                };

                const client = new Client(plivoOptions) as unknown as PlivoClient;
                clientRef.current = client;

                // Setup event listeners
                setupEventListeners(client);

                setIsReady(true);

                // Auto-login if enabled
                if (options.autoLogin) {
                    await loginToPlivo(client);
                }
            } catch (err) {
                console.error('[Plivo] Initialization error:', err);
                setError('Failed to initialize Plivo client');
            }
        };

        initializePlivo();

        // Cleanup
        return () => {
            if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
            }
            if (clientRef.current) {
                try {
                    clientRef.current.logout();
                } catch (err) {
                    console.error('[Plivo] Logout error:', err);
                }
            }
        };
    }, [options.autoLogin, options.debug]);

    // Setup Plivo event listeners
    const setupEventListeners = useCallback((client: PlivoClient) => {
        client.on('onLogin', () => {
            console.log('[Plivo] Logged in successfully');
            setIsLoggedIn(true);
            setError(null);
        });

        client.on('onLoginFailed', (...args: unknown[]) => {
            const reason = args[0] as string;
            console.error('[Plivo] Login failed:', reason);
            setIsLoggedIn(false);
            setError(`Login failed: ${reason}`);
        });

        client.on('onLogout', () => {
            console.log('[Plivo] Logged out');
            setIsLoggedIn(false);
        });

        client.on('onCallRemoteRinging', () => {
            console.log('[Plivo] Call ringing');
            setCallState((prev) => ({ ...prev, status: 'ringing' }));
        });

        client.on('onCallAnswered', (...args: unknown[]) => {
            const call = args[0] as PlivoCall;
            console.log('[Plivo] Call answered');
            setCallState((prev) => ({
                ...prev,
                status: 'answered',
                callUuid: call.callUUID || null,
            }));
            startDurationTimer();
        });

        client.on('onCallFailed', (...args: unknown[]) => {
            const reason = args[0] as string;
            console.error('[Plivo] Call failed:', reason);
            setCallState((prev) => ({
                ...prev,
                status: 'failed',
                error: reason,
            }));
            stopDurationTimer();
            currentCallRef.current = null;
        });

        client.on('onCallTerminated', () => {
            console.log('[Plivo] Call terminated');
            setCallState({
                status: 'ended',
                destination: null,
                duration: callState.duration,
                callUuid: callState.callUuid,
                isMuted: false,
                isHeld: false,
                error: null,
            });
            stopDurationTimer();
            currentCallRef.current = null;
        });

        client.on('onMediaConnected', () => {
            console.log('[Plivo] Media connected');
            setCallState((prev) => ({ ...prev, status: 'active' }));
        });

        client.on('onMediaPermission', (...args: unknown[]) => {
            const result = args[0] as boolean;
            if (!result) {
                setError('Microphone permission denied');
            }
        });
    }, [callState.duration, callState.callUuid]);

    // Login to Plivo
    const loginToPlivo = async (client?: PlivoClient) => {
        try {
            const plivoClient = client || clientRef.current;
            if (!plivoClient) {
                throw new Error('Plivo client not initialized');
            }

            // Fetch credentials from API
            const response = await fetch('/api/plivo/endpoint-credentials');
            if (!response.ok) {
                throw new Error('Failed to fetch Plivo credentials');
            }

            const { username, password } = await response.json();
            plivoClient.login(username, password);
        } catch (err) {
            console.error('[Plivo] Login error:', err);
            setError(err instanceof Error ? err.message : 'Login failed');
            throw err;
        }
    };

    // Start duration timer
    const startDurationTimer = () => {
        stopDurationTimer();
        durationTimerRef.current = setInterval(() => {
            setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
    };

    // Stop duration timer
    const stopDurationTimer = () => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    };

    // Make a call
    const makeCall = useCallback(
        async (destination: string) => {
            try {
                if (!clientRef.current) {
                    throw new Error('Plivo client not initialized');
                }

                if (!isLoggedIn) {
                    await loginToPlivo();
                    // Wait a bit for login to complete
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                setCallState({
                    status: 'connecting',
                    destination,
                    duration: 0,
                    callUuid: null,
                    isMuted: false,
                    isHeld: false,
                    error: null,
                });

                const call = clientRef.current.call(destination);
                currentCallRef.current = call;
            } catch (err) {
                console.error('[Plivo] Make call error:', err);
                setCallState((prev) => ({
                    ...prev,
                    status: 'failed',
                    error: err instanceof Error ? err.message : 'Call failed',
                }));
            }
        },
        [isLoggedIn]
    );

    // Hang up call
    const hangup = useCallback(() => {
        if (currentCallRef.current) {
            currentCallRef.current.hangup();
        }
    }, []);

    // Mute call
    const mute = useCallback(() => {
        if (currentCallRef.current) {
            currentCallRef.current.mute();
            setCallState((prev) => ({ ...prev, isMuted: true }));
        }
    }, []);

    // Unmute call
    const unmute = useCallback(() => {
        if (currentCallRef.current) {
            currentCallRef.current.unmute();
            setCallState((prev) => ({ ...prev, isMuted: false }));
        }
    }, []);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (callState.isMuted) {
            unmute();
        } else {
            mute();
        }
    }, [callState.isMuted, mute, unmute]);

    // Send DTMF tone
    const sendDtmf = useCallback((digit: string) => {
        if (currentCallRef.current) {
            currentCallRef.current.sendDtmf(digit);
        }
    }, []);

    // Manual login
    const login = useCallback(async () => {
        await loginToPlivo();
    }, []);

    // Logout
    const logout = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.logout();
        }
    }, []);

    return {
        isReady,
        isLoggedIn,
        callState,
        error,
        makeCall,
        hangup,
        mute,
        unmute,
        toggleMute,
        sendDtmf,
        login,
        logout,
    };
}
