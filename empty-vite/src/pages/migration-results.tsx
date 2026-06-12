import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Container,
  SpaceBetween,
  KeyValuePairs,
  StatusIndicator,
  Button,
  Box,
  Tabs,
  Icon,
  BarChart,
  Pagination,
  Table,
  CollectionPreferences,
  PropertyFilter,
  PropertyFilterProps,
  Badge,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import TruncateText from "@cloudscape-design/components/truncated-text";
import NavigationPanel from "../components/navigation-panel";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { MigrationJob } from "../common/types";

const STATE_BY_COMPLETED: Record<number, string> = {
  1: "EVAL_COMPLETE",
  2: "OPTIMIZATION_COMPLETE",
  3: "MIGRATION_COMPLETE",
};

function getHomeHrefFromJob(job: MigrationJob): string {
  const completed = parseInt(job.statusLabel.split(" ")[0]) || 0;
  const state = STATE_BY_COMPLETED[completed];
  return state ? `/?state=${state}` : "/";
}

function getActiveTabId(job: MigrationJob): string {
  const completed = parseInt(job.statusLabel.split(" ")[0]) || 0;
  if (completed >= 3) return "shadow-testing";
  if (completed >= 2) return "optimization";
  return "evaluation";
}

function getHeaderAction(job: MigrationJob): React.ReactNode | null {
  const completed = parseInt(job.statusLabel.split(" ")[0]) || 0;
  if (completed === 1) return <Button variant="primary">Provide prompt templates</Button>;
  if (completed === 2) return <Button variant="primary">Start shadow testing</Button>;
  return null;
}

const CHART_I18N = {
  filterLabel: "Filter displayed series",
  filterPlaceholder: "Filter series",
  filterSelectedAriaLabel: "selected",
  legendAriaLabel: "Legend",
  chartAriaRoleDescription: "bar chart",
  xAxisAriaRoleDescription: "x axis",
  yAxisAriaRoleDescription: "y axis",
};

interface InvocationEntry {
  groupId: string;
  type: "Source" | "Optimized";
  model: string;
  input: string;
  output: string;
  accuracy: string;
  inputTokens: string;
  outputTokens: string;
}

function numAvg(items: InvocationEntry[], key: "accuracy" | "inputTokens" | "outputTokens"): number {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, e) => sum + parseInt(e[key]), 0) / items.length);
}

function addMinutes(dateStr: string, minutes: number): string {
  const date = new Date(dateStr);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const MAX_TRUNCATE_LENGTH = 224;
const truncate = (text: string, max = MAX_TRUNCATE_LENGTH) =>
  text.length > max ? text.slice(0, max) + "…" : text;

function Delta({ value, higherIsBetter }: { value: number; higherIsBetter?: boolean }) {
  const isGood = higherIsBetter === undefined || value === 0 ? null : higherIsBetter ? value > 0 : value < 0;
  return (
    <><br /><Box
      variant="span"
      color={isGood === null ? "text-body-secondary" : isGood ? "text-status-success" : "text-status-error"}
      fontSize="body-s"
      // fontWeight="bold"
    >
      {" "}{value > 0 ? "+" : ""}{value}
    </Box></>
  );
}

const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "groupId", propertyLabel: "Group ID", operators: [":", "!:", "=", "!="], groupValuesLabel: "Group ID values" },
  { key: "type", propertyLabel: "Type", operators: [":", "!:", "=", "!="], groupValuesLabel: "Type values" },
  { key: "model", propertyLabel: "Model", operators: [":", "!:", "=", "!="], groupValuesLabel: "Model values" },
  { key: "input", propertyLabel: "Input", operators: [":", "!:"], groupValuesLabel: "Input values" },
  { key: "output", propertyLabel: "Output", operators: [":", "!:"], groupValuesLabel: "Output values" },
  { key: "accuracy", propertyLabel: "Accuracy (%)", operators: ["=", "!=", ">", "<", ">=", "<="], groupValuesLabel: "Accuracy values" },
  { key: "inputTokens", propertyLabel: "Input tokens", operators: ["=", "!=", ">", "<", ">=", "<="], groupValuesLabel: "Input token values" },
  { key: "outputTokens", propertyLabel: "Output tokens", operators: ["=", "!=", ">", "<", ">=", "<="], groupValuesLabel: "Output token values" },
];

const PROPERTY_FILTER_I18N: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: "Filter invocation log",
  dismissAriaLabel: "Dismiss",
  filteringPlaceholder: "Filter by property or value",
  groupValuesText: "Values",
  groupPropertiesText: "Properties",
  operatorsText: "Operators",
  operationAndText: "and",
  operationOrText: "or",
  operatorLessText: "Less than",
  operatorLessOrEqualText: "Less than or equal",
  operatorGreaterText: "Greater than",
  operatorGreaterOrEqualText: "Greater than or equal",
  operatorContainsText: "Contains",
  operatorDoesNotContainText: "Does not contain",
  operatorEqualsText: "Equals",
  operatorDoesNotEqualText: "Does not equal",
  editTokenHeader: "Edit filter",
  propertyText: "Property",
  operatorText: "Operator",
  valueText: "Value",
  cancelActionText: "Cancel",
  applyActionText: "Apply",
  allPropertiesLabel: "All properties",
  clearFiltersText: "Clear filters",
  removeTokenButtonAriaLabel: (token) =>
    `Remove filter: ${token.propertyKey} ${token.operator} ${token.value}`,
  enteredTextLabel: (text) => `Use: "${text}"`,
};

function matchesQuery(entry: InvocationEntry, q: PropertyFilterProps.Query): boolean {
  if (q.tokens.length === 0) return true;

  const ENTRY_KEYS: (keyof InvocationEntry)[] = ["groupId", "type", "model", "input", "output", "accuracy", "inputTokens", "outputTokens"];

  const testOp = (raw: string, token: PropertyFilterProps.Token): boolean => {
    const v = raw.toLowerCase();
    const fv = String(token.value ?? "").toLowerCase();
    switch (token.operator) {
      case ":":  return v.includes(fv);
      case "!:": return !v.includes(fv);
      case "=":  return v === fv;
      case "!=": return v !== fv;
      case ">":  return parseFloat(v) > parseFloat(fv);
      case "<":  return parseFloat(v) < parseFloat(fv);
      case ">=": return parseFloat(v) >= parseFloat(fv);
      case "<=": return parseFloat(v) <= parseFloat(fv);
      default:   return true;
    }
  };

  const checkToken = (token: PropertyFilterProps.Token): boolean => {
    if (!token.propertyKey) {
      return ENTRY_KEYS.some((k) => testOp(String(entry[k] ?? ""), token));
    }
    return testOp(String(entry[token.propertyKey as keyof InvocationEntry] ?? ""), token);
  };

  return q.operation === "and" ? q.tokens.every(checkToken) : q.tokens.some(checkToken);
}

function EvaluationContent({ job }: { job: MigrationJob }) {
  const [entries, setEntries] = useState<InvocationEntry[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetch("/invocation-log.json")
      .then((r) => r.json())
      .then((data: InvocationEntry[]) => setEntries(data));
  }, []);

  const { items: allFilteredItems, collectionProps, propertyFilterProps } = useCollection(entries, {
    propertyFiltering: {
      filteringProperties: FILTERING_PROPERTIES,
      filteringFunction: matchesQuery,
      empty: <Box textAlign="center"><Box variant="strong">No entries found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    sorting: {
      defaultState: {
        sortingColumn: { sortingField: "groupId" },
        isDescending: false,
      },
    },
  });

  const pagesCount = Math.max(1, Math.ceil(allFilteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pagesCount);
  const pageItems = allFilteredItems.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const isFiltered = propertyFilterProps.query.tokens.length > 0;
  const matchCount = allFilteredItems.length;

  const handleFilterChange = ({ detail }: { detail: PropertyFilterProps.Query }) => {
    propertyFilterProps.onChange({ detail });
    setCurrentPage(1);
  };

  const sourceByGroupId = useMemo(() => {
    const map = new Map<string, InvocationEntry>();
    for (const e of entries) {
      if (e.type === "Source") map.set(e.groupId, e);
    }
    return map;
  }, [entries]);

  const logColumns = useMemo(() => [
    { id: "groupId", header: <span style={{ paddingLeft: 12 }}>Group ID</span>, cell: (item: InvocationEntry) => <span style={{ paddingLeft: 12 }}>{item.groupId}</span>, sortingField: "groupId", sortingDisabled: false, sortingDescending: true, isRowHeader: true },
    { id: "type", header: "Type", cell: (item: InvocationEntry) => <Badge color={item.type === "Optimized" ? "green" : "grey"}>{item.type}</Badge> },
    { id: "model", header: "Model", cell: (item: InvocationEntry) => item.model },
    { id: "input", header: "Input", cell: (item: InvocationEntry) => item.input.length > MAX_TRUNCATE_LENGTH ? <TruncateText tooltipText={item.input}>{item.input}</TruncateText> : truncate(item.input) },
    { id: "output", header: "Output", cell: (item: InvocationEntry) => item.output.length > MAX_TRUNCATE_LENGTH ? <TruncateText tooltipText={item.output}>{item.output}</TruncateText> : truncate(item.output) },
    {
      id: "accuracy",
      header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
      cell: (item: InvocationEntry) => {
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const delta = src ? parseInt(item.accuracy) - parseInt(src.accuracy) : null;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.accuracy}{delta !== null && <Delta value={delta} higherIsBetter={true} />}
          </span>
        );
      },
    },
    {
      id: "inputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
      cell: (item: InvocationEntry) => {
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const delta = src ? parseInt(item.inputTokens) - parseInt(src.inputTokens) : null;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.inputTokens}{delta !== null && <Delta value={delta} higherIsBetter={undefined} />}
          </span>
        );
      },
    },
    {
      id: "outputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
      cell: (item: InvocationEntry) => {
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const delta = src ? parseInt(item.outputTokens) - parseInt(src.outputTokens) : null;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.outputTokens}{delta !== null && <Delta value={delta} higherIsBetter={undefined} />}
          </span>
        );
      },
    },
  ], [sourceByGroupId]);

  const sourceEntries = entries.filter((e) => e.type === "Source");
  const optimizedEntries = entries.filter((e) => e.type === "Optimized");

  const avgAccuracySrc = numAvg(sourceEntries, "accuracy");
  const avgAccuracyOpt = numAvg(optimizedEntries, "accuracy");
  const avgInputSrc    = numAvg(sourceEntries, "inputTokens");
  const avgInputOpt    = numAvg(optimizedEntries, "inputTokens");
  const avgOutputSrc   = numAvg(sourceEntries, "outputTokens");
  const avgOutputOpt   = numAvg(optimizedEntries, "outputTokens");

  const filteringOptions: PropertyFilterProps.FilteringOption[] = useMemo(() => {
  const opts: PropertyFilterProps.FilteringOption[] = [];
  for (const entry of entries) {
    opts.push({ propertyKey: "groupId", value: entry.groupId });
    opts.push({ propertyKey: "type", value: entry.type });
    opts.push({ propertyKey: "model", value: entry.model });
    opts.push({ propertyKey: "accuracy", value: entry.accuracy });
    opts.push({ propertyKey: "inputTokens", value: entry.inputTokens });
    opts.push({ propertyKey: "outputTokens", value: entry.outputTokens });
  }
  // deduplicate
  return opts.filter(
    (o, i, arr) => arr.findIndex(x => x.propertyKey === o.propertyKey && x.value === o.value) === i
  );
}, [entries]);

  const makeSeries = (srcVal: number, optVal: number) => [
    { title: "Average", type: "bar" as const, data: [{ x: job.sourceModel, y: srcVal }, { x: job.targetModel, y: optVal }] },
  ];

  const yDomainTokens = (src: number, opt: number): [number, number] =>
    [0, Math.ceil(Math.max(src, opt) * 1.3)];

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Initial evaluation properties</Header>}>
        <KeyValuePairs
          columns={3}
          items={[
            { label: "Status", value: <StatusIndicator type="success">Completed</StatusIndicator> },
            { label: "CloudWatch invocation logs access", value: "true" },
            { label: "Date started", value: job.dateStarted },
            { label: "Invocation log time range", value: "May 13, 2025, 13:23 – May 31, 2025, 13:23" },
            { label: "Number of invocation log entries", value: sourceEntries.length || 24 },
            { label: "Date completed", value: `${job.dateStarted} – ${addMinutes(job.dateStarted, 15)}` },
          ]}
        />
      </Container>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
        <Container header={<Header variant="h3" description="Measures how closely model outputs match the expected results.">Average accuracy (%)</Header>}>
          <BarChart<string>
            series={makeSeries(avgAccuracySrc, avgAccuracyOpt)}
            xDomain={[job.sourceModel, job.targetModel]}
            yDomain={[70, 100]}
            height={200}
            xTitle="Models"
            yTitle="Percent (%)"
            hideFilter
            hideLegend
            i18nStrings={CHART_I18N}
          />
        </Container>
        <Container header={<Header variant="h3" description="Measures the average amount of input tokens of all requests.">Average input tokens</Header>}>
          <BarChart<string>
            series={makeSeries(avgInputSrc, avgInputOpt)}
            xDomain={[job.sourceModel, job.targetModel]}
            yDomain={yDomainTokens(avgInputSrc, avgInputOpt)}
            height={200}
            xTitle="Models"
            yTitle="Tokens"
            hideFilter
            hideLegend
            i18nStrings={CHART_I18N}
          />
        </Container>
        <Container header={<Header variant="h3" description="Measures the average amount of output tokens of all responses.">Average output tokens</Header>}>
          <BarChart<string>
            series={makeSeries(avgOutputSrc, avgOutputOpt)}
            xDomain={[job.sourceModel, job.targetModel]}
            yDomain={yDomainTokens(avgOutputSrc, avgOutputOpt)}
            height={200}
            xTitle="Models"
            yTitle="Tokens"
            hideFilter
            hideLegend
            i18nStrings={CHART_I18N}
          />
        </Container>
      </div>
      <Table
        {...collectionProps}
        header={
          <Header
            variant="h2"
            description="Shows how invocation log prompts performed in the source model versus optimized prompts on the target model."
            counter={`(${matchCount}/${entries.length})`}
            actions={
              <Button iconName="download" ariaLabel="Download results" href="/invocation-log.json" download="invocation-log.json">
                Download results
              </Button>
            }
          >
            Invocation log results
          </Header>
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            onChange={handleFilterChange}
            filteringOptions={filteringOptions}
            i18nStrings={PROPERTY_FILTER_I18N}
            countText={isFiltered ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}` : undefined}
          />
        }
        items={pageItems}
        resizableColumns
        stickyHeader
        wrapLines
        pagination={
          <Pagination
            currentPageIndex={safeCurrentPage}
            pagesCount={pagesCount}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{ pageSize }}
            onConfirm={({ detail }) => { setPageSize(detail.pageSize ?? 10); setCurrentPage(1); }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 5, label: "5 rows" },
                { value: 10, label: "10 rows" },
                { value: 20, label: "20 rows" },
              ],
            }}
          />
        }
        columnDefinitions={logColumns}
        trackBy={(item) => `${item.groupId}-${item.type}`}
        empty={<Box textAlign="center"><Box variant="strong">No entries found</Box></Box>}
      />
    </SpaceBetween>
  );
}

function LockedTabContent({ buttonLabel }: { buttonLabel: string}) {
  return (
    <Container>
      <Box textAlign="center" padding={{ vertical: "xl" }}>
        <SpaceBetween size="s" alignItems="center">
          <Box variant="strong" fontSize="heading-s">No results yet</Box>
          <Box variant="p" color="text-body-secondary">
            <strong>{buttonLabel}</strong> to proceed.
          </Box>
          <Button>{buttonLabel}</Button>
        </SpaceBetween>
      </Box>
    </Container>
  );
}

export default function MigrationResultsPage() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [navigationPanelState, setNavigationPanelState] = useNavigationPanelState();

  const job = state as MigrationJob | null;
  const [activeTabId, setActiveTabId] = useState(() => job ? getActiveTabId(job) : "evaluation");

  if (!job) {
    return (
      <AppLayoutToolbar
        headerSelector="#awsui-top-navigation"
        navigation={<NavigationPanel />}
        navigationOpen={!navigationPanelState.collapsed}
        onNavigationChange={({ detail }) => setNavigationPanelState({ collapsed: !detail.open })}
        toolsHide={true}
        content={
          <Box textAlign="center" padding={{ vertical: "xl" }}>
            <SpaceBetween size="m" alignItems="center">
              <Box variant="strong" fontSize="heading-l">No job data found</Box>
              <Box variant="p" color="text-body-secondary">
                Navigate to this page from the Model migration history table.
              </Box>
              <Button variant="primary" onClick={() => navigate("/")}>
                Go to Model migration
              </Button>
            </SpaceBetween>
          </Box>
        }
      />
    );
  }

  const completed = parseInt(job.statusLabel.split(" ")[0]) || 0;
  return (
    <AppLayoutToolbar
      maxContentWidth={1280}
      headerSelector="#awsui-top-navigation"
      navigation={<NavigationPanel />}
      navigationOpen={!navigationPanelState.collapsed}
      onNavigationChange={({ detail }) => setNavigationPanelState({ collapsed: !detail.open })}
      toolsHide={true}
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            { text: APP_NAME, href: "/" },
            { text: "Model migration", href: getHomeHrefFromJob(job) },
            { text: job.jobName, href: "#" },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              actions={getHeaderAction(job)}
            >
              {job.jobName}
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Container header={<Header 
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button>Edit</Button>
                  </SpaceBetween>
                }
                variant="h2">Model migration properties
              </Header>}>
              <KeyValuePairs
                columns={3}
                items={[
                  {
                    label: "Description",
                    value: job.description,
                  },
                  {
                    label: "Status",
                    value: (
                      <StatusIndicator type={job.status}>
                        {job.statusLabel}
                      </StatusIndicator>
                    ),
                  },
                  {
                    label: "Source model",
                    value: job.sourceModel,
                  },
                  {
                    label: "Target model",
                    value: job.targetModel,
                  },
                  {
                    label: "Date started",
                    value: job.dateStarted,
                  },
                  {
                    label: "Date completed",
                    value: job.dateCompleted && job.dateCompleted !== "-"
                      ? job.dateCompleted
                      : "—",
                  },
                ]}
              />
            </Container>
            <Tabs
              activeTabId={activeTabId}
              onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
              tabs={[
                {
                  id: "evaluation",
                  label: (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Initial evaluation
                      {completed >= 1 && <Icon name="status-positive" variant="success" />}
                    </span>
                  ),
                  content: <EvaluationContent job={job} />,
                },
                {
                  id: "optimization",
                  label: (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Prompt optimization
                      {completed >= 2 && <Icon name="status-positive" variant="success" />}
                    </span>
                  ),
                  content: completed >= 2
                    ? <Box>Prompt optimization content</Box>
                    : <LockedTabContent buttonLabel="Provide prompt templates" />,
                },
                {
                  id: "shadow-testing",
                  label: (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Shadow testing
                      {completed >= 3 && <Icon name="status-positive" variant="success" />}
                    </span>
                  ),
                  content: completed >= 3
                    ? <Box>Shadow testing content</Box>
                    : completed === 2
                      ? <LockedTabContent buttonLabel="Start shadow testing" />
                      : <LockedTabContent buttonLabel="Provide prompt templates" />,
                },
              ]}
            />
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
