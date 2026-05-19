import { describe, it, expect } from "vitest";
import { HookInstaller } from "../../packages/hooks/src/hook-installer.js";
import { HOOK_MARKER } from "../../packages/hooks/src/pre-commit-hook.js";

describe("HookInstaller.stripVeyntBlock", () => {
  const installer = new HookInstaller("/tmp");

  it("removes legacy veynt block and keeps other hooks", () => {
    const input = `#!/bin/sh
echo "other hook"
${HOOK_MARKER}
# Veynt pre-commit hook
veynt scan --hook
exit $?
`;
    const stripped = installer.stripVeyntBlock(input);
    expect(stripped).toContain('echo "other hook"');
    expect(stripped).not.toContain(HOOK_MARKER);
  });

  it("removes full multi-path veynt script", () => {
    const input = `#!/bin/sh
${HOOK_MARKER}
ROOT=1
exit 127
`;
    const stripped = installer.stripVeyntBlock(
      `#!/bin/sh\n${HOOK_MARKER}\nROOT=1\necho fix\nexit 127\n`,
    );
    expect(stripped).not.toContain(HOOK_MARKER);
    expect(stripped).not.toContain("exit 127");
  });
});
