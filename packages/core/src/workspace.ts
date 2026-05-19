/** Workspace-wide documentation produced by `veynt analyse`. */
export interface WorkspacePackageRef {
  name: string;
  path: string;
  role: string;
  description?: string;
  dependencies?: string[];
}

export interface WorkspaceArea {
  id: string;
  label: string;
  paths: string[];
  description?: string;
}

export interface WorkspaceDocument {
  generatedAt: string;
  /** Multi-paragraph narrative describing the repository for reviewers. */
  overview: string;
  repository: {
    name: string;
    description?: string;
    packageManager: string;
    monorepo: boolean;
    rootScripts?: string[];
  };
  packages: WorkspacePackageRef[];
  areas: WorkspaceArea[];
  entryPoints: string[];
  commands?: string[];
  techStack: string[];
  conventions: string[];
  /** Actionable hints for scan/review in this repo. */
  reviewHints: string[];
  dataFlow?: string;
  /** Pre-formatted token block injected into AI prompts during scan. */
  tokenIndex: string;
}
