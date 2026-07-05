'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    // Only register Service Worker in production to avoid breaking HMR/dev server
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered with scope:', registration.scope);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      };

      registerServiceWorker();
    } else if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV !== 'production'
    ) {
      // In development, unregister any stale service workers that may have been
      // registered during a previous production build or test.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log('[Dev] Unregistered stale Service Worker:', registration.scope);
        }
      });
    }
  }, []);

  return null;
}
