import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifySession } from '../auth/session';
import { prisma } from '../db/prisma';

/**
 * The console must reflect database changes automatically.
 *
 * Socket.IO carries a small "something changed" signal; it never carries the
 * data itself. Every client reacts by re-fetching through the existing
 * role-guarded REST endpoints, so authorisation stays in one place and a socket
 * cannot widen what a user is allowed to see.
 */

export type RealtimeEntity = 'emergency' | 'assignment' | 'hospital';
export type RealtimeAction = 'created' | 'closed' | 'updated';

export interface RealtimeEvent {
  entity: RealtimeEntity;
  action: RealtimeAction;
  at: string;
  requestId?: string;
  assignmentId?: string;
  hospitalId?: string;
  severity?: string;
}

interface SocketUser {
  userId: string;
  role: string;
  hospitalId: string | null;
}

let io: Server | null = null;

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function initRealtime(server: HttpServer): Server {
  io = new Server(server, {
    path: '/socket.io',
    // The browser normally reaches this through the Vite proxy (same origin);
    // the CORS entry keeps a direct API origin working in development.
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = cookieValue(
        socket.handshake.headers.cookie,
        env.cookieName,
      );
      const payload = token ? verifySession(token) : null;
      if (!payload) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }

      // Re-read the account, exactly like requireAuth: a deleted or re-assigned
      // user cannot keep a socket alive on an old token.
      const user = await prisma.user.findUnique({
        where: { userId: payload.sub },
        select: { userId: true, role: true, hospitalId: true },
      });
      if (!user) {
        next(new Error('ACCOUNT_MISSING'));
        return;
      }

      socket.data.user = {
        userId: user.userId,
        role: user.role,
        hospitalId: user.hospitalId,
      } satisfies SocketUser;
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    // Rooms are useful for targeted signals even though the current client
    // simply refetches its own endpoint.
    socket.join('authenticated');
    socket.join(`role:${user.role}`);
    if (user.hospitalId) socket.join(`hospital:${user.hospitalId}`);

    socket.emit('realtime:ready', {
      connectedAt: new Date().toISOString(),
      role: user.role,
    });
  });

  return io;
}

/** Fire-and-forget change notification; never throws into the request path. */
export function emitRealtime(
  event: Omit<RealtimeEvent, 'at'> & { at?: string },
): void {
  if (!io) return;
  const payload: RealtimeEvent = {
    ...event,
    at: event.at ?? new Date().toISOString(),
  };
  io.to('authenticated').emit('data:changed', payload);
}

export function realtimeStatus() {
  return {
    enabled: Boolean(io),
    connections: io?.engine.clientsCount ?? 0,
  };
}
