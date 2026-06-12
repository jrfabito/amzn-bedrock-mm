export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}

export interface MigrationJob {
  id: string;
  jobName: string;
  description?: string;
  status: "success" | "in-progress" | "error" | "stopped" | "pending";
  statusLabel: string;
  sourceModel: string;
  targetModel: string;
  dateStarted: string;
  dateCompleted: string;
}
