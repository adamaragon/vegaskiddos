'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect, useState } from 'react';
import { isChunkLoadError, reloadOnChunkError } from '@/lib/chunkReload';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // A visitor on pre-deploy HTML asks for chunks the deploy deleted, hydration
  // dies, and this boundary used to hand them a blank "Application error" page.
  // Start blank instead of flashing that text, then reload once (see
  // lib/chunkReload.ts). Anything that isn't a chunk failure renders normally.
  const [recovering, setRecovering] = useState(() => isChunkLoadError(error));

  useEffect(() => {
    if (reloadOnChunkError(error)) return; // document is being replaced
    setRecovering(false);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>{recovering ? null : <NextError statusCode={0} />}</body>
    </html>
  );
}
