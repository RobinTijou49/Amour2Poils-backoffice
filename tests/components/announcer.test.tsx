import { describe, expect, test } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Announcer, announce, withAnnouncement } from "@/components/announcer";

describe("Announcer : la zone d'annonce persistante", () => {
  test("c'est une zone role=status, polie et lue en entier, présente dès le départ et vide (un lecteur d'écran ne lit que les zones déjà là)", () => {
    render(<Announcer />);
    const zone = screen.getByRole("status");
    expect(zone.getAttribute("aria-live")).toBe("polite");
    expect(zone.getAttribute("aria-atomic")).toBe("true");
    expect(zone.textContent).toBe("");
  });

  test("elle est cachée visuellement (sr-only) mais pas aux lecteurs d'écran", () => {
    render(<Announcer />);
    expect(screen.getByRole("status").className).toContain("sr-only");
    expect(screen.getByRole("status").getAttribute("aria-hidden")).toBeNull();
  });

  test("announce() y écrit le message", async () => {
    render(<Announcer />);
    act(() => announce("Arrivée d'Oslo enregistrée."));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Arrivée d'Oslo enregistrée."));
  });

  test("le même message annoncé deux fois de suite est de nouveau écrit (le texte est d'abord vidé, sinon il ne serait pas relu)", async () => {
    render(<Announcer />);
    const zone = screen.getByRole("status");
    const seen: string[] = [];
    new MutationObserver(() => seen.push(zone.textContent ?? "")).observe(zone, { childList: true, characterData: true, subtree: true });
    act(() => announce("Enregistré."));
    await waitFor(() => expect(zone.textContent).toBe("Enregistré."));
    act(() => announce("Enregistré."));
    await waitFor(() => expect(seen.filter((t) => t === "Enregistré.").length).toBeGreaterThanOrEqual(2));
    expect(seen).toContain("");
  });

  test("un message plus récent remplace le précédent", async () => {
    render(<Announcer />);
    act(() => announce("premier"));
    act(() => announce("second"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("second"));
  });

  test("après son démontage, plus d'écoute (pas de fuite)", async () => {
    const { unmount } = render(<Announcer />);
    unmount();
    expect(() => announce("trop tard")).not.toThrow();
  });
});

describe("withAnnouncement : enveloppe d'une Server Action", () => {
  const listen = () => {
    const heard: string[] = [];
    const on = (e: Event) => heard.push((e as CustomEvent<string>).detail);
    window.addEventListener("a2p:announce", on);
    return { heard, stop: () => window.removeEventListener("a2p:announce", on) };
  };

  test("annonce le succès et renvoie le résultat inchangé", async () => {
    const { heard, stop } = listen();
    const wrapped = withAnnouncement<{ success?: string }>(async () => ({ success: "C'est fait." }));
    expect(await wrapped({}, new FormData())).toEqual({ success: "C'est fait." });
    stop();
    expect(heard).toEqual(["C'est fait."]);
  });

  test("n'annonce rien en cas d'erreur", async () => {
    const { heard, stop } = listen();
    const wrapped = withAnnouncement(async () => ({ error: "Impossible." }) as { success?: string; error?: string });
    expect((await wrapped({}, new FormData())).error).toBe("Impossible.");
    stop();
    expect(heard).toEqual([]);
  });

  test("transmet l'état précédent et le formulaire à l'action", async () => {
    let received: unknown[] = [];
    const wrapped = withAnnouncement(async (prev: { success?: string }, data: FormData) => {
      received = [prev, data.get("id")];
      return {};
    });
    const fd = new FormData();
    fd.set("id", "b1");
    await wrapped({ success: "avant" }, fd);
    expect(received).toEqual([{ success: "avant" }, "b1"]);
  });
});
