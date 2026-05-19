import { describe, it, expect } from "vitest";
import { DiffParser } from "@veynt/git";

describe("DiffParser", () => {
  const parser = new DiffParser();

  it("parses a single file unified diff", () => {
    const raw = `diff --git a/src/foo.ts b/src/foo.ts
index 123..456 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
+  return 1;
 }
`;

    const files = parser.parse(raw);
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("src/foo.ts");
    expect(files[0]?.status).toBe("modified");
    expect(files[0]?.diff).toContain("@@");
  });

  it("returns empty for empty diff", () => {
    expect(parser.parse("")).toHaveLength(0);
  });
});
