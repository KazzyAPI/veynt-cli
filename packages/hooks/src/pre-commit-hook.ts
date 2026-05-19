export const HOOK_MARKER = "# veynt-pre-commit";

/**
 * Shell hook that resolves veynt from repo root — Git hooks often have a minimal PATH.
 */
export const PRE_COMMIT_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
# Veynt pre-commit hook — runs staged diff review before commit.
ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$ROOT" || exit 1

if command -v veynt >/dev/null 2>&1; then
  veynt scan --hook
  exit $?
fi

if [ -f "$ROOT/packages/cli/dist/index.js" ]; then
  node "$ROOT/packages/cli/dist/index.js" scan --hook
  exit $?
fi

if [ -f "$ROOT/node_modules/@veynt/cli/dist/index.js" ]; then
  node "$ROOT/node_modules/@veynt/cli/dist/index.js" scan --hook
  exit $?
fi

if [ -x "$ROOT/node_modules/.bin/veynt" ]; then
  "$ROOT/node_modules/.bin/veynt" scan --hook
  exit $?
fi

if [ -f "$ROOT/node_modules/.bin/veynt.cmd" ]; then
  sh "$ROOT/node_modules/.bin/veynt.cmd" scan --hook
  exit $?
fi

echo "veynt: command not found in PATH or node_modules." >&2
echo "  Fix: pnpm build && pnpm link --global  OR  pnpm install && pnpm veynt hooks reinstall" >&2
exit 127
`;
