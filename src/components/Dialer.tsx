/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { initiateCall, getPlivoCredentials } from '@/lib/api';

// Declare Plivo global type
declare global {
    interface Window {
        Plivo: any;
    }
}

interface DialerProps {
    onCallInitiated?: () => void;
}

export default function Dialer({ onCallInitiated }: DialerProps) {
    const [plivoClient, setPlivoClient] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [callInProgress, setCallInProgress] = useState(false);
    const [plivoLoaded, setPlivoLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        loadPlivoScript();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadPlivoScript = () => {
        // Check if Plivo is already loaded
        if (window.Plivo) {
            console.log('Plivo already loaded');
            setPlivoLoaded(true);
            initializePlivo();
            return;
        }

        // Load Plivo SDK from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.plivo.com/sdk/browser/v2/plivo.min.js';
        script.async = true;

        script.onload = () => {
            console.log('✅ Plivo SDK loaded from CDN');
            console.log('window.Plivo:', window.Plivo);
            setPlivoLoaded(true);
            initializePlivo();
        };

        script.onerror = () => {
            console.error('❌ Failed to load Plivo SDK from CDN');
            setMessage('❌ Failed to load Plivo SDK. Please refresh the page.');
        };

        document.head.appendChild(script);
    };

    const initializePlivo = async () => {
        try {
            if (!window.Plivo) {
                console.error('window.Plivo is not available');
                setMessage('❌ Plivo SDK not loaded');
                return;
            }

            console.log('Getting Plivo credentials from backend...');
            const credentials = await getPlivoCredentials();
            console.log('✅ Credentials received');

            // Create Plivo client with options
            const options = {
                debug: 'ALL', // Enable debug logs
                permOnClick: true, // Request permissions on user action
                enableIPV6: false,
                closeProtection: false,
                enableTracking: true,
            };

            console.log('Creating Plivo client with options:', options);

            // Create Plivo Browser SDK instance
            const plivoBrowserSdk = new window.Plivo(options);

            console.log('✅ Plivo Browser SDK created:', plivoBrowserSdk);

            if (!plivoBrowserSdk || !plivoBrowserSdk.client) {
                throw new Error('Failed to create Plivo Browser SDK');
            }

            // ========== Event Handlers ==========
            // Note: Events are registered on plivoBrowserSdk.client

            plivoBrowserSdk.client.on('onWebrtcNotSupported', () => {
                console.error('❌ WebRTC not supported in this browser');
                setMessage('❌ WebRTC not supported. Please use Chrome, Firefox, or Safari.');
            });

            plivoBrowserSdk.client.on('onLogin', () => {
                console.log('✅ Successfully logged in to Plivo');
                setIsConnected(true);
                setMessage('✅ Connected to Plivo');
                setTimeout(() => setMessage(''), 3000);
            });

            plivoBrowserSdk.client.on('onLoginFailed', (cause: string) => {
                console.error('❌ Plivo login failed:', cause);
                setMessage(`❌ Login failed: ${cause}`);
                setIsConnected(false);
            });

            plivoBrowserSdk.client.on('onLogout', () => {
                console.log('Logged out from Plivo');
                setIsConnected(false);
                setMessage('Disconnected from Plivo');
            });

            plivoBrowserSdk.client.on('onCallRemoteRinging', (callInfo: any) => {
                console.log('📞 Call ringing:', callInfo);
                setMessage('📞 Ringing...');
            });

            plivoBrowserSdk.client.on('onCallAnswered', (callInfo: any) => {
                console.log('✅ Call answered:', callInfo);
                setCallInProgress(true);
                setLoading(false);
                setMessage('✅ Call connected');
            });

            plivoBrowserSdk.client.on('onCallTerminated', (callInfo: any) => {
                console.log('📴 Call terminated:', callInfo);
                setCallInProgress(false);
                setLoading(false);
                setIsMuted(false);
                setMessage('Call ended');
                setTimeout(() => setMessage(''), 3000);
            });

            plivoBrowserSdk.client.on('onCallFailed', (cause: any) => {
                console.error('❌ Call failed:', cause);
                setCallInProgress(false);
                setLoading(false);
                setIsMuted(false);
                setMessage(`❌ Call failed: ${cause.message || cause}`);
            });

            plivoBrowserSdk.client.on('onIncomingCall', (callerName: string, extraHeaders: any) => {
                console.log('📞 Incoming call from:', callerName);
                // Handle incoming calls if needed
            });

            plivoBrowserSdk.client.on('onIncomingCallCanceled', () => {
                console.log('Incoming call canceled');
            });

            plivoBrowserSdk.client.on('onMediaPermission', (result: any) => {
                console.log('🎤 Media permission:', result);
                if (result && result.status === false) {
                    setMessage('❌ Microphone permission denied. Please allow microphone access.');
                } else if (result && result.status === true) {
                    console.log('✅ Microphone permission granted');
                }
            });

            plivoBrowserSdk.client.on('onConnectionChange', (state: any) => {
                console.log('🔌 Connection state changed:', state);
            });

            // Login to Plivo
            console.log('🔐 Attempting to login with username:', credentials.username);
            plivoBrowserSdk.client.login(credentials.username, credentials.password);

            setPlivoClient(plivoBrowserSdk);

        } catch (error: any) {
            console.error('❌ Error initializing Plivo:', error);
            setMessage(`❌ Error: ${error.message}`);
        }
    };

    const handleDigitClick = (digit: string) => {
        if (!callInProgress) {
            // Add digit to phone number
            setPhoneNumber(prev => prev + digit);
        } else {
            // Send DTMF tone if in call
            if (plivoClient && plivoClient.client) {
                console.log('Sending DTMF:', digit);
                plivoClient.client.sendDtmf(digit);
            }
        }
    };

    const handleBackspace = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        setPhoneNumber('');
    };

    const handleCall = async () => {
        // Validation
        if (!phoneNumber || phoneNumber.length < 10) {
            setMessage('❌ Please enter a valid phone number (min 10 digits)');
            return;
        }

        if (!isConnected || !plivoClient) {
            setMessage('❌ Not connected to Plivo. Please wait or refresh the page.');
            return;
        }

        setLoading(true);
        setMessage('📞 Initiating call...');

        try {
            console.log('📞 Notifying backend about call to:', phoneNumber);

            // Step 1: Notify backend to create call record
            const response = await initiateCall({
                to_number: phoneNumber,
            });

            if (response.success) {
                console.log('✅ Backend notified successfully. Call UUID:', response.call_uuid);

                // Step 2: Make the actual call through browser
                console.log('📞 Making browser call to:', phoneNumber);
                plivoClient.client.call(phoneNumber);

                setMessage(`📞 Calling ${phoneNumber}...`);

                // Trigger callback to refresh call history
                if (onCallInitiated) {
                    onCallInitiated();
                }
            } else {
                console.error('❌ Backend call initiation failed:', response.message);
                setMessage(`❌ Error: ${response.message}`);
                setLoading(false);
            }
        } catch (error: any) {
            console.error('❌ Call initiation error:', error);
            setMessage(`❌ Failed to initiate call: ${error.message}`);
            setLoading(false);
        }
    };

    const handleHangup = () => {
        if (plivoClient && plivoClient.client && callInProgress) {
            console.log('📴 Hanging up call');
            plivoClient.client.hangup();
            setCallInProgress(false);
            setLoading(false);
            setIsMuted(false);
            setMessage('Call ended');
        }
    };

    const handleMute = () => {
        if (plivoClient && plivoClient.client && callInProgress) {
            console.log('🔇 Muting call');
            plivoClient.client.mute();
            setIsMuted(true);
            setMessage('🔇 Muted');
        }
    };

    const handleUnmute = () => {
        if (plivoClient && plivoClient.client && callInProgress) {
            console.log('🔊 Unmuting call');
            plivoClient.client.unmute();
            setIsMuted(false);
            setMessage('🔊 Unmuted');
        }
    };

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
            {/* Header */}
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 dark:text-white">
                📞 Phone Dialer
            </h2>

            {/* Connection Status */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center border dark:border-gray-600">
                {!plivoLoaded ? (
                    <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">Loading Plivo SDK...</span>
                    </div>
                ) : (
                    <span className={`text-sm font-semibold ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {isConnected ? '🟢 Connected & Ready' : '🟡 Connecting...'}
                    </span>
                )}
            </div>

            {/* Phone Number Display */}
            <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center border-2 border-gray-200 dark:border-gray-600">
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
                    placeholder="+1234567890"
                    className="text-2xl font-mono w-full bg-transparent text-center outline-none text-gray-800 dark:text-white placeholder-gray-400"
                    disabled={callInProgress || !plivoLoaded}
                    maxLength={20}
                />
            </div>

            {/* Dialpad Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                {digits.map(digit => (
                    <button
                        key={digit}
                        onClick={() => handleDigitClick(digit)}
                        disabled={!plivoLoaded}
                        className="p-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xl font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {digit}
                    </button>
                ))}
            </div>

            {/* Control Buttons */}
            <div className="space-y-2">
                {/* Primary Actions */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={handleBackspace}
                        disabled={callInProgress || !plivoLoaded || !phoneNumber}
                        className="p-3 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-800 font-semibold rounded-lg transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed text-sm"
                    >
                        ⌫
                    </button>

                    {!callInProgress ? (
                        <button
                            onClick={handleCall}
                            disabled={loading || !phoneNumber || !isConnected || !plivoLoaded}
                            className="col-span-2 p-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Calling...
                                </span>
                            ) : (
                                '📞 Call'
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleHangup}
                            className="col-span-2 p-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                        >
                            📞 Hang Up
                        </button>
                    )}
                </div>

                {/* Mute Controls (only during call) */}
                {callInProgress && (
                    <div className="flex gap-2">
                        <button
                            onClick={isMuted ? handleUnmute : handleMute}
                            className={`flex-1 p-2 ${isMuted
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : 'bg-yellow-500 hover:bg-yellow-600'
                                } text-white text-sm font-semibold rounded-lg transition-colors`}
                        >
                            {isMuted ? '🔊 Unmute' : '🔇 Mute'}
                        </button>
                        <button
                            onClick={handleClear}
                            disabled={!phoneNumber}
                            className="flex-1 p-2 bg-gray-400 hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:bg-gray-300"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Clear button when not in call */}
                {!callInProgress && phoneNumber && (
                    <button
                        onClick={handleClear}
                        className="w-full p-2 bg-gray-300 hover:bg-gray-400 text-gray-800 dark:text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        Clear Number
                    </button>
                )}
            </div>

            {/* Status Message */}
            {message && (
                <div className={`mt-4 p-3 rounded-lg text-center text-sm font-medium border ${message.includes('❌') || message.includes('Error') || message.includes('Failed')
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                    : message.includes('✅') || message.includes('connected')
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                    {message}
                </div>
            )}

            {/* Instructions */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                    💡 <strong>Tip:</strong> Enter phone number with country code (e.g., +1234567890)
                </p>
                {callInProgress && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1">
                        🎹 Use dialpad to send DTMF tones during the call
                    </p>
                )}
                {!isConnected && plivoLoaded && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center mt-1">
                        ⚠️ Waiting for Plivo connection... This may take a few seconds
                    </p>
                )}
            </div>

            {/* Debug Info (remove in production) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 dark:text-gray-400">
                    <p>Debug: SDK Loaded: {plivoLoaded ? '✅' : '❌'}</p>
                    <p>Debug: Connected: {isConnected ? '✅' : '❌'}</p>
                    <p>Debug: Call In Progress: {callInProgress ? '✅' : '❌'}</p>
                </div>
            )}
        </div>
    );
}