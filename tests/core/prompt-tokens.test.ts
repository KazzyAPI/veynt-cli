import { describe, it, expect } from "vitest";
import { formatWorkspaceTokens, tokenLine } from "@veynt/core";
import type { WorkspaceDocument } from "@veynt/core";

describe("formatWorkspaceTokens", () => {
  it("emits line-oriented tokens with sections", () => {
    const workspace: WorkspaceDocument = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      overview: "Veynt CLI monorepo for pre-commit review.",
      repository: {
        name: "veynt",
        packageManager: "pnpm",
        monorepo: true,
      },
      packages: [
        { name: "@veynt/cli", path: "packages/cli", role: "CLI entry" },
      ],
      areas: [{ id: "packages/cli", label: "CLI", paths: ["packages/cli/src/index.ts"] }],
      entryPoints: ["packages/cli/src/index.ts"],
      techStack: ["typescript", "pnpm"],
      conventions: ["Keep CLI thin"],
      reviewHints: ["Flag cross-package leaks"],
      tokenIndex: "",
    };

    const tokens = formatWorkspaceTokens(workspace);
    expect(tokens).toContain("@repo.name veynt");
    expect(tokens).toContain("## overview");
    expect(tokens).toContain("@pkg name=@veynt/cli");
    expect(tokens).toContain("@path packages/cli/src/index.ts");
    expect(tokenLine("test", "value")).toBe("@test value");
  });
});
