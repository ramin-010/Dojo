import Pusher from 'pusher';

// Server-side Pusher instance
// Env vars: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
let pusherServer: Pusher | null = null;

function getPusherServer(): Pusher | null {
  if (pusherServer) return pusherServer;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  // If any required env vars are missing, Pusher is not configured
  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  pusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherServer;
}

// Helper to trigger quick note sync events
// Silently no-ops if Pusher is not configured
export async function triggerQuickNoteSync(
  workspaceId: string,
  event: 'note:created' | 'note:updated' | 'note:deleted',
  data: Record<string, unknown>
) {
  try {
    const pusher = getPusherServer();
    if (!pusher) return; // Pusher not configured, skip silently
    await pusher.trigger(`workspace-${workspaceId}`, event, data);
  } catch (error) {
    // Don't let Pusher failures break the main flow
    console.error('[Pusher] Failed to trigger event:', error);
  }
}
