import { api } from './api';

/**
 * Browser Web Push. The service worker shows the notification when the tab is
 * closed; the server encrypts the payload with the VAPID key served by
 * /api/patient/push/public-key.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function enablePush(): Promise<BrowserPushSubscription> {
  if (!pushSupported()) {
    throw new Error('This browser does not support push notifications.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const worker = await registration();
  await navigator.serviceWorker.ready;
  const { data } = await api.get<{ publicKey: string }>('/patient/push/public-key');
  const subscription = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const worker = await navigator.serviceWorker.getRegistration('/');
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return false;
  await api.delete('/patient/push/subscriptions', {
    data: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
  return true;
}
