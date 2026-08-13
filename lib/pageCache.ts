// Shared ISR window for Airtable-backed pages. 10 minutes so the daily scrape
// shows up without a deploy, without putting Airtable on the hot path.
export const PAGE_REVALIDATE = 600;
