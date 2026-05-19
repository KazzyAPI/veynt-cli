import type {
  ArchitectureProfile,
  RepositoryProfile,
  StandardsProfile,
  WorkspaceDocument,
} from "@veynt/core";

export interface AnalysisResult {
  profile: RepositoryProfile;
  architecture: ArchitectureProfile;
  standards: StandardsProfile;
  workspace?: WorkspaceDocument;
}
