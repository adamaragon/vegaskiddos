export const sentryOptions = {
  dsn: 'https://4daa12de854e0c82e6a803bf46355f97@o4511498051715072.ingest.us.sentry.io/4511840204554240',
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  sendDefaultPii: false,
  dataCollection: { userInfo: false, httpBodies: [] },
  tracesSampleRate: 0,
  // Navigating away cancels Next.js's in-flight RSC prefetches, and the aborted
  // body read surfaces as an AbortError thrown inside the framework runtime
  // (Sentry VEGASKIDDOS-3). It is a cancelled request, not a fault. Matched on
  // the browser wording only, so a server-side AbortSignal.timeout in the
  // scrapers ("This operation was aborted") still reports.
  ignoreErrors: ['BodyStreamBuffer was aborted', 'The user aborted a request'],
};
