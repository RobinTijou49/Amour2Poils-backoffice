import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

// Accessibilité du design system : ce que lit un lecteur d'écran, pas l'apparence.

describe("Field : étiquette, aide et erreur reliées au contrôle", () => {
  test("l'étiquette est associée au champ (clic sur le texte = focus, nom accessible)", () => {
    render(<Field label="Nom du chien" name="name" />);
    expect(screen.getByLabelText("Nom du chien")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole("textbox", { name: "Nom du chien" })).toBeDefined();
  });

  test("sans erreur : ni aria-invalid ni aria-describedby", () => {
    render(<Field label="Tarif" />);
    const input = screen.getByLabelText("Tarif");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  test("avec erreur : aria-invalid et aria-describedby pointent vers le message", () => {
    render(<Field label="Tarif" error="Le tarif doit être positif." />);
    const input = screen.getByLabelText("Tarif");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const message = screen.getByText("Le tarif doit être positif.");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
  });

  test("l'aide et l'erreur sont toutes deux annoncées, l'erreur d'abord", () => {
    render(<Field label="Poids" hint="En kilos" error="Trop élevé." />);
    const input = screen.getByLabelText("Poids");
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] ?? "")?.textContent).toBe("Trop élevé.");
    expect(document.getElementById(ids[1] ?? "")?.textContent).toBe("En kilos");
  });

  test("deux champs ont des identifiants distincts (deux étiquettes ne se confondent pas)", () => {
    render(
      <>
        <Field label="Prénom" />
        <Field label="Nom" />
      </>,
    );
    expect(screen.getByLabelText("Prénom").id).not.toBe(screen.getByLabelText("Nom").id);
  });

  test("les attributs passés (required, type, valeur par défaut) arrivent sur le champ", () => {
    render(<Field label="Date" type="date" required defaultValue="2026-10-23" />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.required).toBe(true);
    expect(input.value).toBe("2026-10-23");
  });
});

describe("Select, Textarea, Checkbox", () => {
  test("Select : étiquette, options et erreur", () => {
    render(
      <Select label="Box" error="Choisissez une box.">
        <option value="">À attribuer</option>
        <option value="b1">Box 1</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Box" });
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    expect(select.getAttribute("aria-invalid")).toBe("true");
  });

  test("Textarea : étiquette et erreur", () => {
    render(<Textarea label="Notes" error="Trop long." />);
    expect(screen.getByRole("textbox", { name: "Notes" }).getAttribute("aria-invalid")).toBe("true");
  });

  test("Checkbox : cochable par son étiquette", () => {
    render(<Checkbox label="Stérilisé" name="sterilized" />);
    const box = screen.getByRole("checkbox", { name: "Stérilisé" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.click();
    expect(box.checked).toBe(true);
  });
});

describe("FormMessage : annonces aux lecteurs d'écran", () => {
  test("une erreur est annoncée tout de suite (role=alert)", () => {
    render(<FormMessage error="Box complète." />);
    expect(screen.getByRole("alert").textContent).toBe("Box complète.");
  });

  test("un succès est annoncé poliment (role=status)", () => {
    render(<FormMessage success="Réservation confirmée." />);
    expect(screen.getByRole("status").textContent).toBe("Réservation confirmée.");
  });

  test("les zones d'annonce existent même vides : un message qui apparaît plus tard est lu", () => {
    render(<FormMessage />);
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("DataTable : un vrai tableau", () => {
  type Row = { id: string; name: string; box: string };
  const rows: Row[] = [
    { id: "1", name: "Oslo", box: "Box 6" },
    { id: "2", name: "Rex", box: "Box 5" },
  ];
  const columns = [
    { header: "Chien", cell: (r: Row) => r.name },
    { header: "Box", cell: (r: Row) => r.box },
  ];

  test("légende, en-têtes de colonne et lignes sont exposés comme un tableau", () => {
    render(<DataTable caption="Arrivées du jour" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Arrivées du jour" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Chien", "Box"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3); // en-tête + 2 lignes
    expect(within(table).getByRole("cell", { name: "Oslo" })).toBeDefined();
  });

  test("les en-têtes ont scope=col", () => {
    render(<DataTable caption="x" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    for (const h of screen.getAllByRole("columnheader")) expect(h.getAttribute("scope")).toBe("col");
  });

  test("sans ligne : le message vide remplace le tableau", () => {
    render(<DataTable caption="x" columns={columns} rows={[]} rowKey={(r: Row) => r.id} empty="Aucune arrivée aujourd'hui." />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Aucune arrivée aujourd'hui.")).toBeDefined();
  });

  test("message vide par défaut", () => {
    render(<DataTable caption="x" columns={columns} rows={[]} rowKey={(r: Row) => r.id} />);
    expect(screen.getByText("Aucun élément.")).toBeDefined();
  });

  test("une cellule peut contenir un composant (bouton, badge)", () => {
    const cols = [{ header: "Action", cell: (r: Row) => <button type="button">Arrivée {r.name}</button> }];
    render(<DataTable caption="x" columns={cols} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("Badge et Button", () => {
  test("le badge porte le sens par le texte ; la pastille décorative est cachée aux lecteurs d'écran (WCAG 1.4.1)", () => {
    const { container } = render(<Badge tone="danger">Vaccin expiré</Badge>);
    expect(screen.getByText("Vaccin expiré")).toBeDefined();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  test("Button est de type « button » par défaut : il ne soumet pas un formulaire par accident", () => {
    render(<Button>Annuler</Button>);
    expect((screen.getByRole("button", { name: "Annuler" }) as HTMLButtonElement).type).toBe("button");
  });

  test("Button peut être un bouton d'envoi, et désactivé", () => {
    render(
      <Button type="submit" disabled>
        Envoyer
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement;
    expect(b.type).toBe("submit");
    expect(b.disabled).toBe(true);
  });

  test("cible tactile d'au moins 44 px de haut (WCAG 2.5.8)", () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole("button", { name: "OK" }).className).toContain("min-h-11");
  });
});
