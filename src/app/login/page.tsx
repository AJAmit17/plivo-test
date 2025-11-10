'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/supabase';

export default function LoginPage() {
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (isSignUp) {
                const { data, error: signUpError } = await signUp(email, password);
                if (signUpError) {
                    setError(signUpError.message);
                } else {
                    setMessage('Sign up successful! Please check your email to verify your account.');
                    // Optionally auto-login after signup
                    if (data?.session) {
                        router.push('/dashboard');
                    }
                }
            } else {
                const { error: signInError } = await signIn(email, password);
                if (signInError) {
                    setError(signInError.message);
                } else {
                    router.push('/dashboard');
                }
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
                    {/* Logo/Title */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            📞 Scam Call Detector
                        </h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {isSignUp ? 'Create your account' : 'Sign in to your account'}
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            ❌ {error}
                        </div>
                    )}
                    {message && (
                        <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            ✅ {message}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 sm:text-sm"
                                placeholder="you@example.com"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 sm:text-sm"
                                placeholder={isSignUp ? 'Create a strong password' : '••••••••'}
                                minLength={6}
                            />
                            {isSignUp && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Password must be at least 6 characters
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                                </span>
                            ) : (
                                <>{isSignUp ? 'Sign up' : 'Sign in'}</>
                            )}
                        </button>
                    </form>

                    {/* Toggle Sign In/Sign Up */}
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                                setMessage('');
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                            {isSignUp ? (
                                <>
                                    Already have an account? <span className="font-semibold">Sign in</span>
                                </>
                            ) : (
                                <>
                                    Dont have an account? <span className="font-semibold">Sign up</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Additional Info */}
                    {isSignUp && (
                        <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                                <strong>Note:</strong> After signing up, you may need to verify your email
                                address. Check your inbox for a verification link.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-gray-600 dark:text-gray-400">
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
