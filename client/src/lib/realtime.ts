import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth';

export interface RealtimeEvent {
  entity: 'emergency' | 'assignment' | 'hospital';
  action: 'created' | 'closed' | 'updated';
  at: string;
  requestId?: string;
  assignmentId?: string;
  hospitalId?: string;
  severity?: string;
}

const EVENT_NAME = 'data:changed';
const listeners = new Set<(event: RealtimeEvent) => void>();
const statusListeners = new Set<(connected: boolean) => void>();
let socket: Socket | null = null;
let connected = false;

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  statusListeners.forEach((listener) => listener(next));
}

function ensureSocket(): Socket {
  if (socket) return socket;

  socket = io({
    // Same origin through the Vite proxy; the HttpOnly session cookie travels
    // with the handshake, which the server verifies before joining a room.
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => setConnected(true));
  socket.on('disconnect', () => setConnected(false));
  socket.on('connect_error', () => setConnected(false));
  socket.on(EVENT_NAME, (event: RealtimeEvent) => {
    listeners.forEach((listener) => listener(event));
  });

  return socket;
}

/**
 * Subscribes to server change notifications. The callback identity may change
 * on every render; only `enabled` (and sign-in state) re-subscribes.
 */
export function useRealtime(
  handler: (event: RealtimeEvent) => void,
  enabled = true,
): void {
  const { user } = useAuth();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !user) return;
    ensureSocket();
    const listener = (event: RealtimeEvent) => handlerRef.current(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [enabled, user]);
}

/** Connection state for the "live" badge (false falls back to polling). */
export function useRealtimeStatus(): boolean {
  const { user } = useAuth();
  const [online, setOnline] = useState(connected);

  useEffect(() => {
    if (!user) return;
    ensureSocket();
    statusListeners.add(setOnline);
    setOnline(connected);
    return () => {
      statusListeners.delete(setOnline);
    };
  }, [user]);

  return online;
}

/** Disconnect on sign-out so the next account starts with a fresh handshake. */
export function resetRealtimeConnection(): void {
  socket?.disconnect();
  socket = null;
  setConnected(false);
}

export function useRealtimeRefresh(refresh: () => void): boolean {
  const online = useRealtimeStatus();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const stable = useCallback(() => refreshRef.current(), []);
  useRealtime(stable);
  return online;
}
