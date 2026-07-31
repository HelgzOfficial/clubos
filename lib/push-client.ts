import { supabase } from "./supabase";

// Turning a browser into something the server can push to, when ClubOS is
// closed. Three separate things have to line up, and any of them can fail
// independently, so each has its own honest error rather than one vague
// "notifications didn't work":
//
//   1. the browser supports push at all (iOS only does from 16.4, and only
//      once the app has been added to the home screen)
//   2. the user grants notification permission
//   3. the push service issues a subscription for our VAPID key
//
// The resulting subscription is stored per device, because a physio on a phone
// and a laptop is two subscriptions and both should ring.

export type PushSupport = "ready" | "unsupported" | "needs-install";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // iOS Safari only exposes PushManager to home-screen apps. Detecting iOS
    // lets us say "add it to your home screen" instead of "not supported",
    // which would be wrong and unhelpful.
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return isIos && !standalone ? "needs-install" : "unsupported";
  }
  return "ready";
}

// Returns an ArrayBuffer rather than a Uint8Array: TypeScript types a
// Uint8Array's backing store as ArrayBufferLike, which doesn't satisfy the
// BufferSource that applicationServerKey expects.
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function isPushEnabled(): Promise<boolean> {
  if (pushSupport() !== "ready") return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  return (await registration.pushManager.getSubscription()) !== null;
}

export async function enablePush(opts: { role: string | null; email: string | null; playerId?: string | null }): Promise<void> {
  const support = pushSupport();
  if (support === "needs-install") {
    throw new Error("On iPhone, add ClubOS to your home screen first — Safari only allows notifications for installed apps.");
  }
  if (support === "unsupported") {
    throw new Error("This browser doesn't support push notifications.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error("Push isn't configured yet — add NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel and redeploy.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site — you'll need to allow them in your browser settings."
        : "Notification permission wasn't granted."
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? (await registration.pushManager.subscribe({
    // Required by Chrome: every push must result in a visible notification.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBuffer(vapidKey),
  }));

  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: keyToBase64(subscription.getKey("p256dh")),
      auth: keyToBase64(subscription.getKey("auth")),
      user_email: opts.email,
      role: opts.role,
      player_id: opts.playerId ?? null,
      user_agent: navigator.userAgent.slice(0, 300),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  if (pushSupport() !== "ready") return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// Fire-and-forget: asks the server to push to whoever should hear about this.
// Deliberately never throws — a message must still send even if the push
// service is down.
export async function notifyByPush(input: {
  targetRole: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  try {
    await fetch("/api/send-push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Ignored on purpose.
  }
}
