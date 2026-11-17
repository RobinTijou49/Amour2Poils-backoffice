import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Règles WCAG 2.0, 2.1 et 2.2 de niveau A et AA : le niveau visé par le projet (CLAUDE.md : « WCAG 2.2 AA »).
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Lance axe sur la page affichée et échoue avec un rapport lisible (règle, gravité, éléments, correction) si une violation existe. */
export async function expectNoA11yViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map(
    (v) =>
      `• [${v.impact}] ${v.id} : ${v.help}\n    ${v.helpUrl}\n` +
      v.nodes
        .slice(0, 4)
        .map((n) => `    - ${n.target.join(" ")}\n      ${(n.failureSummary ?? "").replace(/\n/g, "\n      ")}`)
        .join("\n"),
  );
  expect(report, `Accessibilité (${where}) : ${violations.length} violation(s)\n${report.join("\n")}`).toEqual([]);
}
