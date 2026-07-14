'use client';

import PusherClient from 'pusher-js';
import { useEffect, useRef } from 'react';

// Client-side Pusher singleton
let pusherClientInstance: PusherClient | null = null;

function getPusherClient(): PusherClient | null {
  if (pusherClientInstance) return pusherClientInstance;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;

  pusherClientInstance = new PusherClient(key, { cluster });
  return pusherClientInstance;
}

export type QuickNoteSyncPayload = {
  id: string;
  content: string;
  createdAt: string;
  workspaceId: string;
  attachments?: any[] | null;
};

/**
 * Hook to subscribe to real-time Quick Note events for a workspace.
 * Silently no-ops if Pusher is not configured.
 */
export function useQuickNoteSync(
  workspaceId: string,
  callbacks: {
    onCreated: (note: QuickNoteSyncPayload) => void;
    onUpdated: (note: QuickNoteSyncPayload) => void;
    onDeleted: (data: { id: string }) => void;
  }
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return; // Pusher not configured, skip silently

    const channelName = `workspace-${workspaceId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('note:created', (data: QuickNoteSyncPayload) => {
      callbacksRef.current.onCreated(data);
    });

    channel.bind('note:updated', (data: QuickNoteSyncPayload) => {
      callbacksRef.current.onUpdated(data);
    });

    channel.bind('note:deleted', (data: { id: string }) => {
      callbacksRef.current.onDeleted(data);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [workspaceId]);
}
