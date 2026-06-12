import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ContentLayout,
  TextContent,
  BreadcrumbGroup,
  SpaceBetween,
  Header,
  ExpandableSection,
  Table,
  Box,
  Button,
  ButtonDropdown,
  StatusIndicator,
  Container,
  Link,
  Flashbar,
  FlashbarProps,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { MigrationJob } from "../common/types";

// ─── Dev toggles ─────────────────────────────────────────────────────────────
// Set exactly one to true, or use the ?state= URL param (takes precedence).
// ?state=EVAL_COMPLETE         → 1 of 3 completed (in-progress)
// ?state=OPTIMIZATION_COMPLETE → 2 of 3 completed (in-progress)
// ?state=MIGRATION_COMPLETE    → 3 of 3 completed (success)
const EVAL_COMPLETE         = false;
const OPTIMIZATION_COMPLETE = false;
const MIGRATION_COMPLETE    = false;

const BASE_JOB = {
  id: "job-1",
  jobName: "Sonnet 4.5 migration",
  sourceModel: "Claude 3.5 Sonnet",
  targetModel: "Claude Sonnet 4.5",
  dateStarted: "Jun 1, 2025, 10:00 AM",
  description: "Migrating from Claude 3.5 Sonnet to Claude Sonnet 4.5",
} as const;

const JOB_BY_STATE: Record<string, MigrationJob> = {
  EVAL_COMPLETE: {
    ...BASE_JOB,
    status: "in-progress",
    statusLabel: "1 of 3 completed",
    dateCompleted: "-",
  },
  OPTIMIZATION_COMPLETE: {
    ...BASE_JOB,
    status: "in-progress",
    statusLabel: "2 of 3 completed",
    dateCompleted: "-",
  },
  MIGRATION_COMPLETE: {
    ...BASE_JOB,
    status: "success",
    statusLabel: "3 of 3 completed",
    dateCompleted: "Jun 7, 2025, 1:30 PM",
  },
};
function makeFlashbarItems(
  job: MigrationJob,
  navigate: ReturnType<typeof useNavigate>
): Record<string, FlashbarProps.MessageDefinition[]> {
  const viewResultsAction = (
    <Button onClick={() => navigate(`/results/${job.id}`, { state: job })}>
      View results
    </Button>
  );
  return {
    EVAL_COMPLETE: [
      {
        type: "success",
        id: "eval-complete",
        content: (
          <><b>{job.jobName}</b> initial evaluation complete. You can now proceed to the next steps.</>
        ),
        action: viewResultsAction,
        dismissible: true,
      },
    ],
    OPTIMIZATION_COMPLETE: [
      {
        type: "success",
        id: "optimization-complete",
        content: (
          <><b>{job.jobName}</b> prompt optimization complete. You can now proceed to shadow testing.</>
        ),
        action: viewResultsAction,
        dismissible: true,
      },
    ],
    MIGRATION_COMPLETE: [
      {
        type: "success",
        id: "migration-complete",
        content: (
          <><b>{job.jobName}</b> shadow testing complete.</>
        ),
        action: viewResultsAction,
        dismissible: true,
      },
    ],
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_SPOTLIGHTS = [
  {
    id: "deepseek-v3",
    name: "DeepSeek v3.1",
    description: "High-efficiency reasoning model optimized for analytical tasks, coding, and multilingual understanding with strong accuracy and low latency.",
    logo: "/images/deepseek-logo.svg",
  },
  {
    id: "gpt-oss-20b",
    name: "OpenAI's gpt-oss 20B",
    description: "A lightweight open-source model offering strong general reasoning and language understanding with fast response times and low operational cost.",
    logo: "/images/openai-logo.svg",
  },
  {
    id: "gpt-oss-120b",
    name: "OpenAI's gpt-oss 120B",
    description: "A large-scale open-source model delivering advanced reasoning, coding, and creative generation with high accuracy and fluency across languages.",
    logo: "/images/openai-logo.svg",
  },
  {
    id: "qwen3",
    name: "Qwen3",
    description: "Alibaba's multilingual, high-reasoning model optimized for accuracy and efficiency.",
    logo: "/images/qwen-logo.svg",
  },
];

function ModelSpotlightGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      {MODEL_SPOTLIGHTS.map((model) => (
        <Container key={model.id} header={<Header
          variant="h3">
            Model spotlight
          </Header>}>
          <SpaceBetween size="l">
            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
              <img src={model.logo} alt={model.name} style={{ width: 56, height: 56, flexShrink: 0 }} />
              <div>
                <Box variant="strong" fontSize="heading-s">{model.name}</Box>
                <Box variant="p" color="text-body-secondary">{model.description}</Box>
              </div>
            </div>
            <Link href="/create-migration" variant="primary">Start model migration</Link>
          </SpaceBetween>
        </Container>
      ))}
    </div>
  );
}

function MigrationHistoryTable({ jobs }: { jobs: MigrationJob[] }) {
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<MigrationJob[]>([]);
  const [expandedItems, setExpandedItems] = useState<MigrationJob[]>([]);

  const columns = [
    {
      id: "jobName",
      header: "Job name",
      cell: (item: MigrationJob) => (
        <Link
          href={`/results/${item.id}`}
          onFollow={(e) => {
            e.preventDefault();
            navigate(`/results/${item.id}`, { state: item });
          }}
        >
          {item.jobName}
        </Link>
      ),
      isRowHeader: true,
    },
    {
      id: "status",
      header: "Status",
      cell: (item: MigrationJob) => (
        <StatusIndicator type={item.status}>{item.statusLabel}</StatusIndicator>
      ),
    },
    {
      id: "sourceModel",
      header: "Source model",
      cell: (item: MigrationJob) => item.sourceModel,
    },
    {
      id: "targetModel",
      header: "Target model",
      cell: (item: MigrationJob) => item.targetModel,
    },
    {
      id: "dateStarted",
      header: "Date started",
      cell: (item: MigrationJob) => item.dateStarted,
    },
    {
      id: "dateCompleted",
      header: "Date completed",
      cell: (item: MigrationJob) => item.dateCompleted || "—",
    },
  ];

  return (
    <Table
      items={jobs}
      columnDefinitions={columns}
      selectionType="single"
      selectedItems={selectedItem}
      onSelectionChange={({ detail }) => setSelectedItem(detail.selectedItems)}
      trackBy="id"
      expandableRows={{
        getItemChildren: () => [],
        isItemExpandable: () => false,
        expandedItems,
        onExpandableItemToggle: ({ detail }) =>
          setExpandedItems((prev) =>
            detail.expanded
              ? [...prev, detail.item]
              : prev.filter((i) => i.id !== detail.item.id)
          ),
      }}
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                disabled={selectedItem.length === 0}
                items={[
                  { text: "Stop job", id: "stop", disabled: true },
                  { text: "Delete job", id: "delete", disabled: false },
                ]}
              >
                Actions
              </ButtonDropdown>
              <Button href="/create-migration" variant="primary">Start new model migration</Button>
            </SpaceBetween>
          }
        >
          Model migration history
        </Header>
      }
      empty={
        <Box textAlign="center" color="inherit">
          <Box variant="strong" textAlign="center" color="inherit">
            No model migration jobs found.
          </Box>
          <Box variant="p" padding={{ bottom: "s" }} color="inherit">
            Bedrock uses your invocation logs to compare model performance and guide migration results.
          </Box>
          <Button href="/create-migration" variant="primary">Start new model migration</Button>
        </Box>
      }
    />
  );
}

function MigrationCTAContainer() {
  const onFollow = useOnFollow();
  return (
    <Container>
      <Box textAlign="center" padding={{ vertical: "xl" }}>
        <SpaceBetween size="s" alignItems="center">
          <Box variant="strong" fontSize="heading-l">Ready to start your migration?</Box>
          <Box variant="p" color="text-body-secondary">
            Bedrock uses your invocation logs to compare model performance and guide migration results.
          </Box>
          <Button variant="primary" href="/create-migration" onFollow={onFollow}>
            Start model migration
          </Button>
        </SpaceBetween>
      </Box>
    </Container>
  );
}

export default function HomePage() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL param takes precedence over hardcoded toggles
  const activeState =
    searchParams.get("state") ??
    (MIGRATION_COMPLETE    ? "MIGRATION_COMPLETE"    :
     OPTIMIZATION_COMPLETE ? "OPTIMIZATION_COMPLETE" :
     EVAL_COMPLETE         ? "EVAL_COMPLETE"         : null);

  const activeJob = activeState && activeState in JOB_BY_STATE ? JOB_BY_STATE[activeState] : null;
  const jobs = activeJob ? [activeJob] : [];

  const flashbarByState = activeJob ? makeFlashbarItems(activeJob, navigate) : {};
  const baseItems = activeState && activeState in flashbarByState ? flashbarByState[activeState] : [];
  const [flashbarItems, setFlashbarItems] = useState<FlashbarProps.MessageDefinition[]>(baseItems);

  // Reset flashbar when the active state changes (e.g. URL param switches)
  const [prevState, setPrevState] = useState(activeState);
  if (prevState !== activeState) {
    setPrevState(activeState);
    setFlashbarItems(baseItems);
  }

  const dismissItem = (id: string) =>
    setFlashbarItems((prev) => prev.filter((item) => item.id !== id));

  const itemsWithDismiss = flashbarItems.map((item) => ({
    ...item,
    onDismiss: item.dismissible ? () => dismissItem(item.id!) : undefined,
  }));

  return (
    <BaseAppLayout
      notifications={itemsWithDismiss.length > 0 && <Flashbar items={itemsWithDismiss} />}
      maxContentWidth = { 1280 }
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            { text: APP_NAME, href: "/" },
            { text: "Model migration", href: "/" },
          ]}
        />
      }
      content={
        <ContentLayout
          header={<Header variant="h1" description="Set up automated comparison jobs to see how new model releases perform against your current ones. This helps you decide when it's the right time to migrate to models that deliver better results.">Model migration</Header>}>
          <SpaceBetween size="xl">
            <ExpandableSection variant="container" defaultExpanded headerText="How it works">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div>
                  <img src="/images/evaluation-results.svg" alt="Evaluation results" style={{ height: 96, marginBottom: 8 }} />
                  <TextContent>
                    <h3>Review initial evaluation results</h3>
                    <p>Review automated performance comparisons between your current model and the latest available version, including cost, latency, and accuracy metrics.</p>
                  </TextContent>
                </div>
                <div style={{ borderLeft: "1px solid var(--color-border-divider-default, #e9ebed)", paddingLeft: 24 }}>
                  <img src="/images/optimize-prompts.svg" alt="Optimize prompts" style={{ height: 96, marginBottom: 8 }} />
                  <TextContent>
                    <h3>Optimize prompts</h3>
                    <p>Fine-tune your prompts to maximize performance with the new model. This optional step can improve accuracy by up to 10% and reduce costs.</p>
                  </TextContent>
                </div>
                <div style={{ borderLeft: "1px solid var(--color-border-divider-default, #e9ebed)", paddingLeft: 24 }}>
                  <img src="/images/shadow-testing.svg" alt="Shadow testing" style={{ height: 96, marginBottom: 8 }} />
                  <TextContent>
                    <h3>Run shadow testing</h3>
                    <p>Deploy the new model alongside your current model to test with real production traffic before completing the migration.</p>
                  </TextContent>
                </div>
              </div>
            </ExpandableSection>
            {jobs.length === 0 ? <MigrationCTAContainer /> : <MigrationHistoryTable jobs={jobs} />}
            {jobs.length === 0 && <ModelSpotlightGrid />}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
