export const sentryOptions = {
  dsn: 'https://4daa12de854e0c82e6a803bf46355f97@o4511498051715072.ingest.us.sentry.io/4511840204554240',
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  sendDefaultPii: false,
  dataCollection: { userInfo: false, httpBodies: [] },
  tracesSampleRate: 0,
};
