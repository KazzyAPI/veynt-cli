import type { WorkspaceDocument } from "./workspace.js";

/** Line-oriented tokens — easy for models to scan section-by-section. */
export function tokenLine(tag: string, value: string): string {
  const escaped = value.replace(/\n/g, " ").trim();
  return `@${tag} ${escaped}`;
}

export function tokenSection(title: string, body: string): string {
  return `## ${title}\n${body.trim()}\n`;
}

export function formatPathTokens(paths: string[], prefix = "@path"): string {
  return paths.map((p) => `${prefix} ${p.replace(/\\/g, "/")}`).join("\n");
}

export function formatWorkspaceTokens(workspace: WorkspaceDocument): string {
  const lines: string[] = [
    tokenLine("workspace.generated", workspace.generatedAt),
    tokenLine("repo.name", workspace.repository.name),
    tokenLine("repo.packageManager", workspace.repository.packageManager),
    tokenLine("repo.monorepo", String(workspace.repository.monorepo)),
  ];

  if (workspace.repository.description) {
    lines.push(tokenLine("repo.description", workspace.repository.description));
  }

  lines.push("");
  lines.push(tokenSection("overview", workspace.overview));

  if (workspace.packages.length > 0) {
    const pkgLines = workspace.packages.map(
      (p) =>
        `@pkg name=${p.name} path=${p.path} role=${p.role}${p.description ? ` desc=${p.description}` : ""}`,
    );
    lines.push(tokenSection("packages", pkgLines.join("\n")));
  }

  if (workspace.areas.length > 0) {
    for (const area of workspace.areas) {
      const header = `@area id=${area.id} label=${area.label}${area.description ? ` desc=${area.description}` : ""}`;
      const paths = area.paths.slice(0, 40).map((p) => `@path ${p}`);
      const more =
        area.paths.length > 40 ? `\n@path ... +${area.paths.length - 40} more` : "";
      lines.push(tokenSection(`paths.${area.id}`, `${header}\n${paths.join("\n")}${more}`));
    }
  }

  if (workspace.entryPoints.length > 0) {
    lines.push(tokenSection("entryPoints", formatPathTokens(workspace.entryPoints, "@entry")));
  }

  if (workspace.commands?.length) {
    lines.push(tokenSection("commands", workspace.commands.map((c) => `@cmd ${c}`).join("\n")));
  }

  if (workspace.techStack.length > 0) {
    lines.push(tokenSection("techStack", workspace.techStack.map((t) => `@tech ${t}`).join("\n")));
  }

  if (workspace.conventions.length > 0) {
    lines.push(
      tokenSection("conventions", workspace.conventions.map((c) => `@rule ${c}`).join("\n")),
    );
  }

  if (workspace.reviewHints.length > 0) {
    lines.push(
      tokenSection("reviewHints", workspace.reviewHints.map((h) => `@hint ${h}`).join("\n")),
    );
  }

  if (workspace.dataFlow) {
    lines.push(tokenSection("dataFlow", workspace.dataFlow));
  }

  return lines.join("\n").trim();
}
