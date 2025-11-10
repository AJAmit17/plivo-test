/**
 * Dashboard Page
 * Displays dialer and call history with scam detection results
 */

'use client';

import { useEffect, useState } from 'react';
import Dialer from '@/components/Dialer';
import AuthProvider from '@/components/AuthProvider';
import Header from '@/components/Header';

interface CallHistory {
    id: string;
    callUuid: string;
    fromNumber: string;
    toNumber: string;
    duration: number;
    status: string;
    recordingUrl?: string;
    transcript?: string;
    transcriptionStatus?: string;
    transcriptionConfidence?: number;
    scamStatus?: 'scam' | 'legitimate' | null;
    scamConfidence?: number;
    scamReason?: string;
    createdAt: string;
    updatedAt?: string;
}

export default function DashboardPage() {
    const [calls, setCalls] = useState<CallHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCall, setSelectedCall] = useState<CallHistory | null>(null);

    useEffect(() => {
        fetchCallHistory();
        // Poll for updates every 10 seconds
        const interval = setInterval(fetchCallHistory, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchCallHistory = async () => {
        try {
            const response = await fetch('/api/calls/history');
            if (!response.ok) {
                throw new Error('Failed to fetch call history');
            }
            const data = await response.json();
            setCalls(data.calls || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load call history');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const getScamBadge = (call: CallHistory) => {
        if (!call.scamStatus) {
            if (call.transcriptionStatus === 'pending') {
                return (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                        Analyzing...
                    </span>
                );
            }
            if (call.transcriptionStatus === 'failed') {
                return (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Analysis Failed
                    </span>
                );
            }
            return (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    Pending
                </span>
            );
        }

        if (call.scamStatus === 'scam') {
            return (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
                    ⚠️ SCAM ({Math.round((call.scamConfidence || 0) * 100)}%)
                </span>
            );
        }

        return (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
                ✓ Legitimate ({Math.round((call.scamConfidence || 0) * 100)}%)
            </span>
        );
    };

    return (
        <AuthProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Header />
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Call Dashboard</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Make calls and view your call history with scam detection
                    </p>
                </div>

                {/* Main Content */}
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Dialer Section */}
                    <div>
                        <Dialer onCallInitiated={fetchCallHistory} />
                    </div>

                    {/* Call History Section */}
                    {/* <div>
                        <div className="rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Call History
                                </h2>
                            </div>

                            <div className="max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                                    </div>
                                ) : error ? (
                                    <div className="p-6">
                                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                    </div>
                                ) : calls.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            No calls yet. Make your first call to see history here.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {calls.map((call) => (
                                            <li
                                                key={call.id}
                                                className="cursor-pointer px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                                                onClick={() => setSelectedCall(call)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                                {call.toNumber}
                                                            </p>
                                                            {getScamBadge(call)}
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                            {formatDate(call.createdAt)}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                                            <span>Duration: {formatDuration(call.duration)}</span>
                                                            <span className="capitalize">Status: {call.status}</span>
                                                        </div>
                                                        {call.transcript && (
                                                            <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                                                                {call.transcript}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div> */}
                </div>

                {/* Call Details Modal */}
                {selectedCall && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
                        onClick={() => setSelectedCall(null)}
                    >
                        <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Call Details
                                </h3>
                                <button
                                    onClick={() => setSelectedCall(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    aria-label="Close"
                                >
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Call Info */}
                                <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-700">
                                    <dl className="grid grid-cols-2 gap-4">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                To Number
                                            </dt>
                                            <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                                {selectedCall.toNumber}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                Duration
                                            </dt>
                                            <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatDuration(selectedCall.duration)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                Date & Time
                                            </dt>
                                            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                                {formatDate(selectedCall.createdAt)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                Status
                                            </dt>
                                            <dd className="mt-1">{getScamBadge(selectedCall)}</dd>
                                        </div>
                                    </dl>
                                </div>

                                {/* Scam Analysis */}
                                {selectedCall.scamStatus && (
                                    <div
                                        className={`rounded-md p-4 ${selectedCall.scamStatus === 'scam'
                                                ? 'bg-red-50 dark:bg-red-900/20'
                                                : 'bg-green-50 dark:bg-green-900/20'
                                            }`}
                                    >
                                        <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                                            Scam Analysis
                                        </h4>
                                        {selectedCall.scamReason && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                                {selectedCall.scamReason}
                                            </p>
                                        )}
                                        {selectedCall.scamConfidence && (
                                            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Confidence: {Math.round(selectedCall.scamConfidence * 100)}%
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Transcript */}
                                {selectedCall.transcript && (
                                    <div>
                                        <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                                            Transcript
                                        </h4>
                                        <div className="max-h-60 overflow-y-auto rounded-md bg-gray-50 p-4 dark:bg-gray-700">
                                            <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                                                {selectedCall.transcript}
                                            </p>
                                        </div>
                                        {selectedCall.transcriptionConfidence && (
                                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                Transcription confidence:{' '}
                                                {Math.round(selectedCall.transcriptionConfidence * 100)}%
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Recording */}
                                {selectedCall.recordingUrl && (
                                    <div>
                                        <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                                            Recording
                                        </h4>
                                        <audio controls className="w-full">
                                            <source src={selectedCall.recordingUrl} type="audio/mpeg" />
                                            Your browser does not support the audio element.
                                        </audio>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </AuthProvider>
    );
}
