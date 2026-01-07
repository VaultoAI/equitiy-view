'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EthPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to stake page
    router.push('/stake');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
