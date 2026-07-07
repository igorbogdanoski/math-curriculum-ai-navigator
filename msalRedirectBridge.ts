import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

/**
 * Entry script for public/msal-redirect.html — MSAL's popup auth flow (msalClient.ts) no
 * longer relies on the opener polling the popup's URL (that mechanism was itself broken by
 * login.microsoftonline.com's own Cross-Origin-Opener-Policy header — see oneDrivePicker.ts's
 * doc comments for the full history). Current @azure/msal-browser instead expects the popup's
 * redirect target to run this exact "redirect bridge" helper, which parses the auth response
 * from the URL and posts it to the opener over a BroadcastChannel keyed by the request's state.
 * Without this script, the popup lands here successfully but never reports back — the opener's
 * acquireTokenPopup() call eventually rejects with a `timed_out` error instead.
 */
broadcastResponseToMainFrame().catch(() => {
  // No valid auth response in this page's URL (e.g. someone navigated here directly) —
  // nothing more this page can do; leave the "Се поврзувам…" placeholder as-is.
});
