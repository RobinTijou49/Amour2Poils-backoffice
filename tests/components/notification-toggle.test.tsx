import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationToggle } from "@/components/notification-toggle";

// Le navigateur (service worker, push, permission) est simulé : on vérifie la logique du bouton, pas Chrome.
type Sub = { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> };
const g = globalThis as unknown as Record<string, unknown>;
const original = { fetch: globalThis.fetch, notification: g.Notification, pushManager: g.PushManager };

const VAPID_PUBLIC = "BNGvpF1IkTatyU-nY6YiE8--Hb4JfbyLZHbZD7lJkrAr7pgqujUQ"; // base64url quelconque, 39 octets une fois décodée
let permission: NotificationPermission;
let requestResult: NotificationPermission;
let existing: Sub | null;
let created: Sub;
let subscribeArgs: unknown[];
let unsubscribed: string[];
let fetchCalls: { url: string; init?: RequestInit }[];
let postStatus: number;

const makeSub = (endpoint: string): Sub => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: "pk", auth: "au" } }),
  unsubscribe: async () => {
    unsubscribed.push(endpoint);
    return true;
  },
});

function installBrowser({ serviceWorker = true, registration = true }: { serviceWorker?: boolean; registration?: boolean } = {}) {
  const reg = {
    pushManager: {
      getSubscription: async () => existing,
      subscribe: async (opts: unknown) => {
        subscribeArgs.push(opts);
        return created;
      },
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker ? { getRegistration: async () => (registration ? reg : undefined), ready: Promise.resolve(reg) } : undefined,
  });
  if (!serviceWorker) delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  g.PushManager = class {};
  (window as unknown as Record<string, unknown>).PushManager = g.PushManager;
  g.Notification = { permission, requestPermission: async () => (permission = requestResult) };
  (window as unknown as Record<string, unknown>).Notification = g.Notification;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url) === "/api/push/cle") return new Response(JSON.stringify({ key: VAPID_PUBLIC }), { status: 200 });
    return new Response("{}", { status: init?.method === "POST" ? postStatus : 200 });
  }) as typeof fetch;
}

beforeEach(() => {
  permission = "default";
  requestResult = "granted";
  existing = null;
  created = makeSub("https://push.example/new");
  subscribeArgs = [];
  unsubscribed = [];
  fetchCalls = [];
  postStatus = 201;
});
afterEach(() => {
  globalThis.fetch = original.fetch;
  g.Notification = original.notification;
  g.PushManager = original.pushManager;
});

describe("NotificationToggle : affichage selon l'état du navigateur", () => {
  test("navigateur sans service worker (ou sans push) : rien n'est affiché", async () => {
    installBrowser({ serviceWorker: false });
    const { container } = render(<NotificationToggle />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.innerHTML).toBe("");
  });

  test("service worker non enregistré (développement) : rien n'est affiché, pas de bouton qui ne marcherait pas", async () => {
    installBrowser({ registration: false });
    const { container } = render(<NotificationToggle />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.innerHTML).toBe("");
  });

  test("permission refusée dans le navigateur : explication, pas de bouton", async () => {
    permission = "denied";
    installBrowser();
    render(<NotificationToggle />);
    expect((await screen.findByText(/Notifications bloquées/)).textContent).toContain("réglages du navigateur");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("pas encore abonné : bouton « Activer », non pressé", async () => {
    installBrowser();
    render(<NotificationToggle />);
    const button = await screen.findByRole("button", { name: "Activer les notifications" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  test("déjà abonné : bouton « Désactiver », pressé", async () => {
    existing = makeSub("https://push.example/old");
    installBrowser();
    render(<NotificationToggle />);
    const button = await screen.findByRole("button", { name: "Désactiver les notifications" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  test("version compacte (barre mobile) : le texte reste lisible par les lecteurs d'écran", async () => {
    installBrowser();
    render(<NotificationToggle compact />);
    const button = await screen.findByRole("button", { name: "Activer les notifications" });
    expect(button.querySelector("span")?.className).toContain("sr-only");
  });
});

describe("NotificationToggle : activation", () => {
  test("la permission n'est demandée qu'au clic, puis l'appareil s'abonne avec la clé du serveur et l'enregistre", async () => {
    installBrowser();
    render(<NotificationToggle />);
    expect(permission).toBe("default"); // rien demandé au chargement de la page
    await userEvent.click(await screen.findByRole("button", { name: "Activer les notifications" }));
    expect((await screen.findByRole("status")).textContent).toBe("Notifications activées sur cet appareil.");

    // abonnement navigateur : visible par l'utilisateur, clé VAPID convertie en octets
    expect(subscribeArgs).toHaveLength(1);
    const opts = subscribeArgs[0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
    expect(opts.userVisibleOnly).toBe(true);
    expect(opts.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(opts.applicationServerKey.length).toBeGreaterThan(30);

    // enregistrement côté serveur : POST JSON de l'abonnement
    const post = fetchCalls.find((c) => c.url === "/api/push/abonnement")!;
    expect(post.init?.method).toBe("POST");
    expect((post.init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(post.init?.body as string)).toEqual({ endpoint: "https://push.example/new", keys: { p256dh: "pk", auth: "au" } });

    expect(screen.getByRole("button", { name: "Désactiver les notifications" })).toBeDefined();
  });

  test("permission refusée à la fenêtre du navigateur : aucun abonnement, le bouton reste « Activer »", async () => {
    requestResult = "denied";
    installBrowser();
    render(<NotificationToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Activer les notifications" }));
    await screen.findByText(/Notifications bloquées/);
    expect(subscribeArgs).toHaveLength(0);
    expect(fetchCalls.some((c) => c.url === "/api/push/abonnement")).toBe(false);
  });

  test("fenêtre fermée sans réponse (« default ») : rien ne se passe, on peut réessayer", async () => {
    requestResult = "default";
    installBrowser();
    render(<NotificationToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Activer les notifications" }));
    await waitFor(() => expect(permission).toBe("default"));
    expect(subscribeArgs).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Activer les notifications" })).toBeDefined();
  });

  test("le serveur refuse l'enregistrement : l'abonnement du navigateur est annulé (pas d'abonnement fantôme) et l'erreur est annoncée", async () => {
    postStatus = 403;
    installBrowser();
    render(<NotificationToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Activer les notifications" }));
    expect((await screen.findByRole("status")).textContent).toBe("Activation impossible pour le moment.");
    expect(unsubscribed).toEqual(["https://push.example/new"]);
    expect(screen.getByRole("button", { name: "Activer les notifications" })).toBeDefined();
  });
});

describe("NotificationToggle : désactivation", () => {
  test("prévient le serveur de l'appareil retiré, annule l'abonnement du navigateur, puis propose de réactiver", async () => {
    existing = makeSub("https://push.example/old");
    installBrowser();
    render(<NotificationToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Désactiver les notifications" }));
    expect((await screen.findByRole("status")).textContent).toBe("Notifications désactivées sur cet appareil.");
    const del = fetchCalls.find((c) => c.init?.method === "DELETE")!;
    expect(del.url).toBe("/api/push/abonnement");
    expect(JSON.parse(del.init?.body as string)).toEqual({ endpoint: "https://push.example/old" });
    expect(unsubscribed).toEqual(["https://push.example/old"]);
    expect(screen.getByRole("button", { name: "Activer les notifications" })).toBeDefined();
  });
});
