"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';

function getBaseUrl() {
  // 1. Browser: Relative path (works perfectly if frontend/backend are same domain)
  if (typeof window !== 'undefined') return '';

  // 2. Production: Use the Public URL you set in Vercel
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // 3. Vercel Preview/Server: Use Vercel's automatically generated URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 4. Local Development
  return 'http://localhost:3000';
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}