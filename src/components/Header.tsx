'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/supabase';
import { useState } from 'react';

export default function Header() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await signOut();
            router.push('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            📞 Scam Call Detector
                        </h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-400"
                    >
                        {loading ? 'Logging out...' : 'Logout'}
                    </button>
                </div>
            </div>
        </header>
    );
}
