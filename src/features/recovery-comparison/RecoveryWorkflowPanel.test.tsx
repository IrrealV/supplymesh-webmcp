import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RecoveryWorkflowPanel human review actions", () => {
  it("keeps the human-only actions in a sticky, focusable review footer", () => {
    const source = readFileSync("src/features/recovery-comparison/RecoveryWorkflowPanel.tsx", "utf8");
    const styles = readFileSync("src/features/recovery-comparison/recoveryComparison.css", "utf8");

    expect(source).toContain('data-human-review-actions="true"');
    expect(source).toContain("scrollIntoView");
    expect(source).toContain(".focus()");
    expect(styles).toContain(".workflow-actions[data-human-review-actions=\"true\"]");
    expect(styles).toContain("position: sticky");
    expect(source).not.toMatch(/action\("(?:stage|execute|verify|request-review)"/);
  });
});
