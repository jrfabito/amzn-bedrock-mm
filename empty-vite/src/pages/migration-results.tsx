import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  LineChart,
  Pagination,
  Table,
  CollectionPreferences,
  PropertyFilter,
  PropertyFilterProps,
  Badge,
  Alert,
  Flashbar,
  Modal,
  Link,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import TruncateText from "@cloudscape-design/components/truncated-text";
import NavigationPanel from "../components/navigation-panel";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { MigrationJob } from "../common/types";
import { useCloudscapeDarkMode } from "../common/hooks/use-cloudscape-dark-mode";
import { highlightVars } from "../common/utils/highlight-vars";

// ─── Dev toggles ─────────────────────────────────────────────────────────────
// Set exactly one to true, or use the ?state= URL param (takes precedence).
const EVAL_COMPLETE         = false;
const OPTIMIZATION_COMPLETE = false;
const MIGRATION_COMPLETE    = false;
const SUCCESS_ALERT         = false;

const BASE_JOB = {
  id: "job-1",
  jobName: "Sonnet 4.5 migration",
  sourceModel: "Claude 3.5 Sonnet",
  targetModel: "Claude Sonnet 4.5",
  dateStarted: "Jun 1, 2025, 10:00 AM",
  description: "Migrating from Claude 3.5 Sonnet to Claude Sonnet 4.5",
} as const;

const JOB_BY_STATE: Record<string, MigrationJob> = {
  EVAL_COMPLETE: { ...BASE_JOB, status: "in-progress", statusLabel: "1 of 3 completed", dateCompleted: "-" },
  OPTIMIZATION_COMPLETE: { ...BASE_JOB, status: "in-progress", statusLabel: "2 of 3 completed", dateCompleted: "-" },
  MIGRATION_COMPLETE: { ...BASE_JOB, status: "success", statusLabel: "3 of 3 completed", dateCompleted: "Jun 4, 2025, 2:30 PM" },
};
// ─────────────────────────────────────────────────────────────────────────────

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

function getHeaderAction(job: MigrationJob, navigate: ReturnType<typeof useNavigate>): React.ReactNode | null {
  const completed = parseInt(job.statusLabel.split(" ")[0]) || 0;
  if (completed === 1) return <Button variant="primary" onClick={() => navigate("/provide-prompt-templates", { state: job })}>Provide prompt templates</Button>;
  if (completed === 2) return <Button variant="primary" onClick={() => navigate("/start-shadow-testing", { state: job })}>Start shadow testing</Button>;
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

interface TestDataCase {
  inputs: Record<string, string>;
  expectedOutput: string;
  actualOutput: string;
  accuracy: string;
  inputTokens: string;
  outputTokens: string;
}

interface PromptTemplateEntry {
  groupId: string;
  type: "Source" | "Optimized";
  model: string;
  template: string;
  testData: TestDataCase[];
}

function numAvg(items: InvocationEntry[], key: "accuracy" | "inputTokens" | "outputTokens"): number {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, e) => sum + parseInt(e[key]), 0) / items.length);
}

function avgFromTestData(testData: TestDataCase[]): { accuracy: number; inputTokens: number; outputTokens: number } {
  if (!testData.length) return { accuracy: 0, inputTokens: 0, outputTokens: 0 };
  const n = testData.length;
  return {
    accuracy:     Math.round(testData.reduce((s, td) => s + parseInt(td.accuracy),     0) / n),
    inputTokens:  Math.round(testData.reduce((s, td) => s + parseInt(td.inputTokens),  0) / n),
    outputTokens: Math.round(testData.reduce((s, td) => s + parseInt(td.outputTokens), 0) / n),
  };
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

const OPTIMIZATION_FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "groupId",      propertyLabel: "Group ID",     operators: [":", "!:", "=", "!="],             groupValuesLabel: "Group ID values" },
  { key: "type",         propertyLabel: "Type",         operators: [":", "!:", "=", "!="],             groupValuesLabel: "Type values" },
  { key: "model",        propertyLabel: "Model",        operators: [":", "!:", "=", "!="],             groupValuesLabel: "Model values" },
  { key: "template",     propertyLabel: "Template",     operators: [":", "!:"],                        groupValuesLabel: "Template values" },
  { key: "accuracy",     propertyLabel: "Accuracy (%)", operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Accuracy values" },
  { key: "inputTokens",  propertyLabel: "Input tokens", operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Input token values" },
  { key: "outputTokens", propertyLabel: "Output tokens",operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Output token values" },
];

const FIXED_TEST_DATA_COLUMNS = [
  {
    id: "expectedOutput",
    header: "Expected output",
    width: 300,
    cell: (td: TestDataCase) =>
      td.expectedOutput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={td.expectedOutput}>{td.expectedOutput}</TruncateText>
        : td.expectedOutput,
  },
  {
    id: "actualOutput",
    header: "Actual output",
    width: 300,
    cell: (td: TestDataCase) =>
      td.actualOutput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={td.actualOutput}>{td.actualOutput}</TruncateText>
        : td.actualOutput,
  },
  {
    id: "accuracy",
    header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
    cell: (td: TestDataCase) => <span style={{ display: "block", textAlign: "right" }}>{td.accuracy}</span>,
  },
  {
    id: "inputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
    cell: (td: TestDataCase) => <span style={{ display: "block", textAlign: "right" }}>{td.inputTokens}</span>,
  },
  {
    id: "outputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
    cell: (td: TestDataCase) => <span style={{ display: "block", textAlign: "right" }}>{td.outputTokens}</span>,
  },
];

function matchesOptimizationQuery(entry: PromptTemplateEntry, q: PropertyFilterProps.Query): boolean {
  if (q.tokens.length === 0) return true;

  const metrics = avgFromTestData(entry.testData);
  const computed: Record<string, string | number> = {
    groupId:      entry.groupId,
    type:         entry.type,
    model:        entry.model,
    template:     entry.template,
    accuracy:     metrics.accuracy,
    inputTokens:  metrics.inputTokens,
    outputTokens: metrics.outputTokens,
  };
  const STRING_KEYS = ["groupId", "type", "model", "template"];

  const testOp = (raw: string | number, token: PropertyFilterProps.Token): boolean => {
    const tv = token.value ?? "";
    if (typeof raw === "number") {
      const n = Number(tv);
      if (isNaN(n)) return false;
      switch (token.operator) {
        case "=":  return raw === n;
        case "!=": return raw !== n;
        case ">":  return raw > n;
        case ">=": return raw >= n;
        case "<":  return raw < n;
        case "<=": return raw <= n;
        default:   return true;
      }
    }
    const v = raw.toLowerCase(), fv = String(tv).toLowerCase();
    switch (token.operator) {
      case ":":  return v.includes(fv);
      case "!:": return !v.includes(fv);
      case "=":  return v === fv;
      case "!=": return v !== fv;
      default:   return true;
    }
  };

  const checkToken = (token: PropertyFilterProps.Token): boolean => {
    if (!token.propertyKey) return STRING_KEYS.some((k) => testOp(String(computed[k] ?? ""), token));
    const val = computed[token.propertyKey];
    return val !== undefined ? testOp(val, token) : false;
  };

  return q.operation === "and" ? q.tokens.every(checkToken) : q.tokens.some(checkToken);
}

const TEST_DATA_FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "expectedOutput", propertyLabel: "Expected output", operators: [":", "!:", "=", "!="],             groupValuesLabel: "Expected output values" },
  { key: "actualOutput",   propertyLabel: "Actual output",   operators: [":", "!:", "=", "!="],             groupValuesLabel: "Actual output values" },
  { key: "accuracy",       propertyLabel: "Accuracy (%)",    operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Accuracy values" },
  { key: "inputTokens",    propertyLabel: "Input tokens",    operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Input token values" },
  { key: "outputTokens",   propertyLabel: "Output tokens",   operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Output token values" },
];

function matchesTestDataQuery(td: TestDataCase, q: PropertyFilterProps.Query): boolean {
  if (q.tokens.length === 0) return true;

  const computed: Record<string, string | number> = {
    expectedOutput: td.expectedOutput,
    actualOutput:   td.actualOutput,
    accuracy:       parseInt(td.accuracy),
    inputTokens:    parseInt(td.inputTokens),
    outputTokens:   parseInt(td.outputTokens),
  };
  const STRING_KEYS = ["expectedOutput", "actualOutput"];

  const testOp = (raw: string | number, token: PropertyFilterProps.Token): boolean => {
    const tv = token.value ?? "";
    if (typeof raw === "number") {
      const n = Number(tv);
      if (isNaN(n)) return false;
      switch (token.operator) {
        case "=":  return raw === n;
        case "!=": return raw !== n;
        case ">":  return raw > n;
        case ">=": return raw >= n;
        case "<":  return raw < n;
        case "<=": return raw <= n;
        default:   return true;
      }
    }
    const v = raw.toLowerCase(), fv = String(tv).toLowerCase();
    switch (token.operator) {
      case ":":  return v.includes(fv);
      case "!:": return !v.includes(fv);
      case "=":  return v === fv;
      case "!=": return v !== fv;
      default:   return true;
    }
  };

  const checkToken = (token: PropertyFilterProps.Token): boolean => {
    if (!token.propertyKey) return STRING_KEYS.some(k => testOp(String(computed[k] ?? ""), token));
    const val = computed[token.propertyKey];
    return val !== undefined ? testOp(val, token) : false;
  };

  return q.operation === "and" ? q.tokens.every(checkToken) : q.tokens.some(checkToken);
}

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

const EVAL_DEFAULT_COLUMNS = [
  { id: "groupId",      visible: true },
  { id: "type",         visible: true },
  { id: "model",        visible: true },
  { id: "input",        visible: true },
  { id: "output",       visible: true },
  { id: "accuracy",     visible: true },
  { id: "inputTokens",  visible: true },
  { id: "outputTokens", visible: true },
];

function EvaluationContent({ job }: { job: MigrationJob }) {
  const [entries, setEntries] = useState<InvocationEntry[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnDisplay, setColumnDisplay] = useState(EVAL_DEFAULT_COLUMNS);

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
    { id: "type", header: "Type", cell: (item: InvocationEntry) => <Badge color={item.type === "Optimized" ? "blue" : "grey"}>{item.type === "Optimized" ? "Preview" : item.type}</Badge>, sortingField: "type" },
    { id: "model", header: "Model", cell: (item: InvocationEntry) => item.model },
    { id: "input", header: "Input", width: 300, cell: (item: InvocationEntry) => item.input.length > MAX_TRUNCATE_LENGTH ? <TruncateText tooltipText={item.input}>{item.input}</TruncateText> : truncate(item.input) },
    { id: "output", header: "Output", width: 300, cell: (item: InvocationEntry) => item.output.length > MAX_TRUNCATE_LENGTH ? <TruncateText tooltipText={item.output}>{item.output}</TruncateText> : truncate(item.output) },
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
            { label: "Date completed", value: `${addMinutes(job.dateStarted, 15)}` },
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
            description="Shows source invocation log prompts alongside AI-generated optimization previews. Optimized inputs are estimates and have not been evaluated."
            actions={
              <Button iconName="download" ariaLabel="Download results" href="/invocation-log.json" download="invocation-log.json">
                Download results
              </Button>
            }
          >
            Invocation log optimization preview
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
        wrapLines stripedRows
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
            preferences={{ pageSize, contentDisplay: columnDisplay }}
            onConfirm={({ detail }) => {
              setPageSize(detail.pageSize ?? 10);
              if (detail.contentDisplay) setColumnDisplay([...detail.contentDisplay]);
              setCurrentPage(1);
            }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 5, label: "5 rows" },
                { value: 10, label: "10 rows" },
                { value: 20, label: "20 rows" },
              ],
            }}
            contentDisplayPreference={{
              title: "Column preferences",
              options: [
                { id: "groupId",      label: "Group ID",       alwaysVisible: true },
                { id: "type",         label: "Type" },
                { id: "model",        label: "Model" },
                { id: "input",        label: "Input" },
                { id: "output",       label: "Output" },
                { id: "accuracy",     label: "Accuracy (%)" },
                { id: "inputTokens",  label: "Input tokens" },
                { id: "outputTokens", label: "Output tokens" },
              ],
            }}
          />
        }
        columnDisplay={columnDisplay}
        columnDefinitions={logColumns}
        trackBy={(item) => `${item.groupId}-${item.type}`}
        empty={<Box textAlign="center"><Box variant="strong">No entries found</Box></Box>}
      />
    </SpaceBetween>
  );
}

function OptimizationContent({ job }: { job: MigrationJob }) {
  const isDark = useCloudscapeDarkMode();
  const varHighlightColor = isDark ? "#4a3870" : "#dccef7";

  const [entries, setEntries] = useState<PromptTemplateEntry[]>([]);
  const [evalEntries, setEvalEntries] = useState<InvocationEntry[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [testDataEntry, setTestDataEntry] = useState<PromptTemplateEntry | null>(null);
  const [testDataModalPageSize, setTestDataModalPageSize] = useState(10);
  const [columnDisplay, setColumnDisplay] = useState([
    { id: "groupId",      visible: true },
    { id: "type",         visible: true },
    { id: "model",        visible: true },
    { id: "template",     visible: true },
    { id: "testData",     visible: true },
    { id: "accuracy",     visible: true },
    { id: "inputTokens",  visible: true },
    { id: "outputTokens", visible: true },
  ]);

  useEffect(() => {
    fetch("/prompt-templates.json")
      .then((r) => r.json())
      .then((data: PromptTemplateEntry[]) => setEntries(data));
    fetch("/invocation-log.json")
      .then((r) => r.json())
      .then((data: InvocationEntry[]) => setEvalEntries(data));
  }, []);

  const { items: allFilteredItems, collectionProps, propertyFilterProps } = useCollection(entries, {
    propertyFiltering: {
      filteringProperties: OPTIMIZATION_FILTERING_PROPERTIES,
      filteringFunction: matchesOptimizationQuery,
      empty: <Box textAlign="center"><Box variant="strong">No entries found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    sorting: {
      defaultState: { sortingColumn: { sortingField: "groupId" }, isDescending: false },
    },
  });

  const {
    items: testDataItems,
    paginationProps: testDataPaginationProps,
    propertyFilterProps: testDataFilterProps,
    collectionProps: testDataCollectionProps,
  } = useCollection(testDataEntry?.testData ?? [], {
    propertyFiltering: {
      filteringProperties: TEST_DATA_FILTERING_PROPERTIES,
      filteringFunction: matchesTestDataQuery,
      empty:   <Box textAlign="center"><Box variant="strong">No test cases found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    pagination: { pageSize: testDataModalPageSize },
    sorting: {},
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

  const sourceEntries = useMemo(() => entries.filter((e) => e.type === "Source"), [entries]);
  const optimizedEntries = useMemo(() => entries.filter((e) => e.type === "Optimized"), [entries]);
  const srcMetrics  = useMemo(() => avgFromTestData(sourceEntries.flatMap((e) => e.testData)),   [sourceEntries]);
  const optMetrics  = useMemo(() => avgFromTestData(optimizedEntries.flatMap((e) => e.testData)), [optimizedEntries]);

  const evalBaseline = useMemo(() => {
    const src = evalEntries.filter((e) => e.type === "Source");
    return {
      accuracy:     numAvg(src, "accuracy"),
      inputTokens:  numAvg(src, "inputTokens"),
      outputTokens: numAvg(src, "outputTokens"),
    };
  }, [evalEntries]);

  const sourceByGroupId = useMemo(() => {
    const map = new Map<string, PromptTemplateEntry>();
    for (const e of entries) if (e.type === "Source") map.set(e.groupId, e);
    return map;
  }, [entries]);

  const filteringOptions = useMemo(() => {
    const opts: PropertyFilterProps.FilteringOption[] = [];
    for (const e of entries) {
      opts.push({ propertyKey: "groupId", value: e.groupId });
      opts.push({ propertyKey: "type",    value: e.type });
      opts.push({ propertyKey: "model",   value: e.model });
    }
    return opts.filter((o, i, arr) => arr.findIndex((x) => x.propertyKey === o.propertyKey && x.value === o.value) === i);
  }, [entries]);

  const logColumns = useMemo(() => [
    { id: "groupId", header: <span style={{ paddingLeft: 12 }}>Group ID</span>, cell: (item: PromptTemplateEntry) => <span style={{ paddingLeft: 12 }}>{item.groupId}</span>, sortingField: "groupId", isRowHeader: true },
    { id: "type",    header: "Type",  cell: (item: PromptTemplateEntry) => <Badge color={item.type === "Optimized" ? "green" : "grey"}>{item.type}</Badge> },
    { id: "model",   header: "Model", cell: (item: PromptTemplateEntry) => item.model },
    { id: "template", header: "Template", cell: (item: PromptTemplateEntry) => {
        const text = item.template;
        const display = truncate(text);
        return text.length > MAX_TRUNCATE_LENGTH
          ? <TruncateText tooltipText={text}>{highlightVars(display, varHighlightColor)}</TruncateText>
          : <>{highlightVars(text, varHighlightColor)}</>;
      }, 
      sortingField: "template",
    width: 400,
  },
    {
      id: "testData",
      header: "Test data",
      cell: (item: PromptTemplateEntry) => (
        <Link
          variant="primary"
          onFollow={(e) => {
            e.preventDefault();
            setTestDataEntry(item);
          }}
        >
          {item.testData.length} {item.testData.length === 1 ? "case" : "cases"}
        </Link>
      ),
    },
    {
      id: "accuracy",
      header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
      cell: (item: PromptTemplateEntry) => {
        const m = avgFromTestData(item.testData);
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const srcM = src ? avgFromTestData(src.testData) : null;
        const delta = srcM ? m.accuracy - srcM.accuracy : null;
        return <span style={{ display: "block", textAlign: "right" }}>{m.accuracy}{delta !== null && <Delta value={delta} higherIsBetter={true} />}</span>;
      },
    },
    {
      id: "inputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
      cell: (item: PromptTemplateEntry) => {
        const m = avgFromTestData(item.testData);
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const srcM = src ? avgFromTestData(src.testData) : null;
        const delta = srcM ? m.inputTokens - srcM.inputTokens : null;
        return <span style={{ display: "block", textAlign: "right" }}>{m.inputTokens}{delta !== null && <Delta value={delta} higherIsBetter={undefined} />}</span>;
      },
    },
    {
      id: "outputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
      cell: (item: PromptTemplateEntry) => {
        const m = avgFromTestData(item.testData);
        const src = item.type === "Optimized" ? sourceByGroupId.get(item.groupId) : undefined;
        const srcM = src ? avgFromTestData(src.testData) : null;
        const delta = srcM ? m.outputTokens - srcM.outputTokens : null;
        return <span style={{ display: "block", textAlign: "right" }}>{m.outputTokens}{delta !== null && <Delta value={delta} higherIsBetter={undefined} />}</span>;
      },
    },
  ], [sourceByGroupId, varHighlightColor]);

  const testDataInputKeys = useMemo(
    () => Object.keys(testDataEntry?.testData[0]?.inputs ?? {}),
    [testDataEntry]
  );

  const testDataColumnDefs = useMemo(() => [
    ...testDataInputKeys.map(key => ({
      id: `input-${key}`,
      header: "{{"+key+"}}",
      width: 300,
      cell: (td: TestDataCase) => td.inputs[key],
    })),
    ...FIXED_TEST_DATA_COLUMNS,
  ], [testDataInputKeys]);

  const testDataGroupDefs = useMemo(
    () => [{ id: "inputs-group", header: "Inputs" }],
    []
  );

  const testDataColumnDisplay = useMemo(() => [
    {
      type: "group" as const,
      id: "inputs-group",
      visible: true,
      children: testDataInputKeys.map(key => ({ id: `input-${key}`, visible: true })),
    },
    ...FIXED_TEST_DATA_COLUMNS.map(col => ({ id: col.id, visible: true })),
  ], [testDataInputKeys]);

  const makeSeries = (srcVal: number, optVal: number, baselineVal: number) => [
    { title: "Average", type: "bar" as const, data: [{ x: job.sourceModel, y: srcVal }, { x: job.targetModel, y: optVal }] },
    ...(baselineVal > 0 ? [{ title: "Evaluation baseline", type: "threshold" as const, y: baselineVal }] : []),
  ];

  const yDomainTokens = (src: number, opt: number): [number, number] =>
    [0, Math.ceil(Math.max(src, opt) * 1.3)];

  return (
    <>
      {testDataEntry && (
        <Modal
          visible={true}
          size="max"
          header={`Group ID: ${testDataEntry.groupId}, ${testDataEntry.model} – Test data`}
          onDismiss={() => setTestDataEntry(null)}
        >
          <Table
            {...testDataCollectionProps}
            items={testDataItems}
            columnDefinitions={testDataColumnDefs}
            groupDefinitions={testDataGroupDefs}
            columnDisplay={testDataColumnDisplay}
            trackBy={(td) => JSON.stringify(td.inputs)}
            variant="embedded"
            wrapLines stripedRows
            resizableColumns
            filter={
              <PropertyFilter
                {...testDataFilterProps}
                i18nStrings={PROPERTY_FILTER_I18N}
                countText={
                  testDataFilterProps.query.tokens.length > 0
                    ? `${testDataItems.length} ${testDataItems.length === 1 ? "match" : "matches"}`
                    : undefined
                }
              />
            }
            pagination={<Pagination {...testDataPaginationProps} />}
            preferences={
              <CollectionPreferences
                title="Preferences"
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                preferences={{ pageSize: testDataModalPageSize }}
                onConfirm={({ detail }) => setTestDataModalPageSize(detail.pageSize ?? 10)}
                pageSizePreference={{
                  title: "Page size",
                  options: [
                    { value: 10, label: "10 rows" },
                    { value: 25, label: "25 rows" },
                    { value: 50, label: "50 rows" },
                  ],
                }}
              />
            }
            empty={<Box textAlign="center"><Box variant="strong">No test cases found</Box></Box>}
          />
        </Modal>
      )}
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Prompt optimization properties</Header>}>
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Status", value: <StatusIndicator type="success">Completed</StatusIndicator> },
              { label: "Prompt templates source", value: "Invocation logs" },
              { label: "Date started", value: job.dateStarted },
              { label: "Time range of extracted prompts", value: "May 13, 2025, 13:23 – May 31, 2025, 13:23" },
              { label: "Number of prompt templates", value: sourceEntries.length || 5 },
              { label: "Date completed", value: `${addMinutes(job.dateStarted, 230)}` },
            ]}
          />
        </Container>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
          <Container header={<Header variant="h3" description="Measures how closely model outputs match the expected results.">Average accuracy (%)</Header>}>
            <BarChart<string>
              series={makeSeries(srcMetrics.accuracy, optMetrics.accuracy, evalBaseline.accuracy)}
              xDomain={[job.sourceModel, job.targetModel]}
              yDomain={[70, 100]}
              hideLegend
              height={200} xTitle="Models" yTitle="Percent (%)" hideFilter i18nStrings={CHART_I18N}
            />
          </Container>
          <Container header={<Header variant="h3" description="Measures the average amount of input tokens of all requests.">Average input tokens</Header>}>
            <BarChart<string>
              series={makeSeries(srcMetrics.inputTokens, optMetrics.inputTokens, evalBaseline.inputTokens)}
              xDomain={[job.sourceModel, job.targetModel]}
              yDomain={yDomainTokens(srcMetrics.inputTokens, optMetrics.inputTokens)}
              hideLegend
              height={200} xTitle="Models" yTitle="Tokens" hideFilter i18nStrings={CHART_I18N}
            />
          </Container>
          <Container header={<Header variant="h3" description="Measures the average amount of output tokens of all responses.">Average output tokens</Header>}>
            <BarChart<string>
              series={makeSeries(srcMetrics.outputTokens, optMetrics.outputTokens, evalBaseline.outputTokens)}
              xDomain={[job.sourceModel, job.targetModel]}
              yDomain={yDomainTokens(srcMetrics.outputTokens, optMetrics.outputTokens)}
              hideLegend
              height={200} xTitle="Models" yTitle="Tokens" hideFilter i18nStrings={CHART_I18N}
            />
          </Container>
        </div>
        <Table
          {...collectionProps}
          header={
            <Header
              variant="h2"
              description="Shows how prompt templates performed after optimization on the target model."
              actions={
                <Button iconName="download" ariaLabel="Download results" href="/prompt-templates.json" download="prompt-templates.json">
                  Download results
                </Button>
              }
            >
              Prompt optimization results
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
          resizableColumns stickyHeader wrapLines stripedRows
          pagination={
            <Pagination
              currentPageIndex={safeCurrentPage}
              pagesCount={pagesCount}
              onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
            />
          }
          preferences={
            <CollectionPreferences
              title="Preferences" confirmLabel="Confirm" cancelLabel="Cancel"
              preferences={{ pageSize, contentDisplay: columnDisplay }}
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize ?? 10);
                if (detail.contentDisplay) setColumnDisplay([...detail.contentDisplay]);
                setCurrentPage(1);
              }}
              pageSizePreference={{
                title: "Page size",
                options: [{ value: 5, label: "5 rows" }, { value: 10, label: "10 rows" }, { value: 20, label: "20 rows" }],
              }}
              contentDisplayPreference={{
                title: "Column preferences",
                options: [
                  { id: "groupId",      label: "Group ID",      alwaysVisible: true },
                  { id: "type",         label: "Type" },
                  { id: "model",        label: "Model" },
                  { id: "template",     label: "Template", alwaysVisible: true },
                  { id: "testData",     label: "Test data" },
                  { id: "accuracy",     label: "Accuracy (%)" },
                  { id: "inputTokens",  label: "Input tokens" },
                  { id: "outputTokens", label: "Output tokens" },
                ],
              }}
            />
          }
          columnDisplay={columnDisplay}
          columnDefinitions={logColumns}
          trackBy={(item) => `${item.groupId}-${item.type}`}
          empty={<Box textAlign="center"><Box variant="strong">No entries found</Box></Box>}
        />
      </SpaceBetween>
    </>
  );
}

// ─── Mock time-series data ────────────────────────────────────────────────────
const SHADOW_HOURS = [0, 10, 20, 30, 40, 50, 60, 70, 80];

const ACCURACY_SOURCE     = [83.0, 83.2, 83.5, 83.8, 83.6, 83.9, 84.1, 84.0, 83.8];
const ACCURACY_TARGET     = [88.5, 88.2, 89.1, 88.8, 88.9, 88.7, 89.0, 88.8, 88.9];

const INPUT_TOKENS_SOURCE         = [52, 53, 52, 54, 53, 55, 54, 53, 54];
const INPUT_TOKENS_SOURCE_SEEDED  = [50, 51, 50, 52, 51, 53, 52, 51, 52];
const INPUT_TOKENS_SOURCE_LIVE    = [54, 55, 54, 56, 55, 57, 56, 55, 56];
const INPUT_TOKENS_TARGET         = [48, 49, 47, 50, 48, 49, 48, 49, 48];
const INPUT_TOKENS_TARGET_SEEDED  = [46, 47, 45, 48, 46, 47, 46, 47, 46];
const INPUT_TOKENS_TARGET_LIVE    = [50, 51, 49, 52, 50, 51, 50, 51, 50];

const OUTPUT_TOKENS_SOURCE         = [210, 212, 215, 218, 214, 216, 219, 217, 215];
const OUTPUT_TOKENS_SOURCE_SEEDED  = [205, 207, 210, 213, 209, 211, 214, 212, 210];
const OUTPUT_TOKENS_SOURCE_LIVE    = [215, 217, 220, 223, 219, 221, 224, 222, 220];
const OUTPUT_TOKENS_TARGET         = [195, 197, 200, 202, 198, 201, 200, 199, 198];
const OUTPUT_TOKENS_TARGET_SEEDED  = [190, 192, 195, 197, 193, 196, 195, 194, 193];
const OUTPUT_TOKENS_TARGET_LIVE    = [200, 202, 205, 207, 203, 206, 205, 204, 203];


const LINE_CHART_I18N = {
  filterLabel: "Filter displayed series",
  filterPlaceholder: "Filter series",
  filterSelectedAriaLabel: "selected",
  legendAriaLabel: "Legend",
  chartAriaRoleDescription: "line chart",
  xAxisAriaRoleDescription: "x axis",
  yAxisAriaRoleDescription: "y axis",
  xTickFormatter: (v: Date) =>
    `${v.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}\n${v.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
};

interface ShadowTestingTemplate {
  groupId: string;
  model: string;
  template: string;
  aggregate: {
    source: { accuracy: number; inputTokens: number; outputTokens: number };
    target: { accuracy: number; inputTokens: number; outputTokens: number };
  };
  requests: number;
}

interface ShadowTestingRequest {
  requestId: string;
  groupId: string;
  trafficType: "seeded" | "live";
  timestamp: string;
  resolvedInput: string;
  groundTruth: string | null;
  source: { actualOutput: string; accuracy: number | null; inputTokens: number; outputTokens: number };
  target: { actualOutput: string; accuracy: number | null; inputTokens: number; outputTokens: number };
}

const SHADOW_FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "groupId",            propertyLabel: "Group ID",             operators: [":", "!:", "=", "!="],             groupValuesLabel: "Group ID values" },
  { key: "model",              propertyLabel: "Model",                operators: [":", "!:", "=", "!="],             groupValuesLabel: "Model values" },
  { key: "template",           propertyLabel: "Template",             operators: [":", "!:"],                        groupValuesLabel: "Template values" },
  { key: "sourceAccuracy",     propertyLabel: "Source accuracy (%)",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source accuracy values" },
  { key: "sourceInputTokens",  propertyLabel: "Source input tokens",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source input token values" },
  { key: "sourceOutputTokens", propertyLabel: "Source output tokens", operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source output token values" },
  { key: "targetAccuracy",     propertyLabel: "Target accuracy (%)",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target accuracy values" },
  { key: "targetInputTokens",  propertyLabel: "Target input tokens",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target input token values" },
  { key: "targetOutputTokens", propertyLabel: "Target output tokens", operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target output token values" },
];

function matchesShadowQuery(entry: ShadowTestingTemplate, q: PropertyFilterProps.Query): boolean {
  if (q.tokens.length === 0) return true;
  const computed: Record<string, string | number> = {
    groupId:            entry.groupId,
    model:              entry.model,
    template:           entry.template,
    sourceAccuracy:     entry.aggregate.source.accuracy,
    sourceInputTokens:  entry.aggregate.source.inputTokens,
    sourceOutputTokens: entry.aggregate.source.outputTokens,
    targetAccuracy:     entry.aggregate.target.accuracy,
    targetInputTokens:  entry.aggregate.target.inputTokens,
    targetOutputTokens: entry.aggregate.target.outputTokens,
  };
  const STRING_KEYS = ["groupId", "model", "template"];

  const testOp = (raw: string | number, token: PropertyFilterProps.Token): boolean => {
    const tv = token.value ?? "";
    if (typeof raw === "number") {
      const n = Number(tv);
      if (isNaN(n)) return false;
      switch (token.operator) {
        case "=":  return raw === n;
        case "!=": return raw !== n;
        case ">":  return raw > n;
        case ">=": return raw >= n;
        case "<":  return raw < n;
        case "<=": return raw <= n;
        default:   return true;
      }
    }
    const v = raw.toLowerCase(), fv = String(tv).toLowerCase();
    switch (token.operator) {
      case ":":  return v.includes(fv);
      case "!:": return !v.includes(fv);
      case "=":  return v === fv;
      case "!=": return v !== fv;
      default:   return true;
    }
  };

  const checkToken = (token: PropertyFilterProps.Token): boolean => {
    if (!token.propertyKey) return STRING_KEYS.some((k) => testOp(String(computed[k] ?? ""), token));
    const val = computed[token.propertyKey];
    return val !== undefined ? testOp(val, token) : false;
  };

  return q.operation === "and" ? q.tokens.every(checkToken) : q.tokens.some(checkToken);
}

const SHADOW_DEFAULT_COLUMN_PREFS = [
  { id: "groupId",             visible: true },
  { id: "model",               visible: true },
  { id: "template",            visible: true },
  { id: "source-accuracy",     visible: true },
  { id: "source-inputTokens",  visible: true },
  { id: "source-outputTokens", visible: true },
  { id: "target-accuracy",     visible: true },
  { id: "target-inputTokens",  visible: true },
  { id: "target-outputTokens", visible: true },
  { id: "requests",            visible: true },
];

const MODAL_COLUMNS = [
  {
    id: "requestId",
    header: "Request ID",
    cell: (r: ShadowTestingRequest) => r.requestId,
    sortingField: "requestId",
  },
  {
    id: "trafficType",
    header: "Traffic",
    cell: (r: ShadowTestingRequest) => (
      <Badge color={r.trafficType === "seeded" ? "blue" : "green"}>
        {r.trafficType === "seeded" ? "Seeded" : "Live"}
      </Badge>
    ),
  },
  {
    id: "resolvedInput",
    header: "Resolved input",
    cell: (r: ShadowTestingRequest) =>
      r.resolvedInput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={r.resolvedInput}>{r.resolvedInput}</TruncateText>
        : r.resolvedInput,
    width: 300,
  },
  {
    id: "groundTruth",
    header: "Expected output",
    width: 300,
    cell: (r: ShadowTestingRequest) =>
      r.groundTruth === null ? "—"
        : r.groundTruth.length > MAX_TRUNCATE_LENGTH
          ? <TruncateText tooltipText={r.groundTruth}>{r.groundTruth}</TruncateText>
          : r.groundTruth,
  },
  {
    id: "sourceActualOutput",
    header: "Actual output",
    width: 300,
    cell: (r: ShadowTestingRequest) =>
      r.source.actualOutput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={r.source.actualOutput}>{r.source.actualOutput}</TruncateText>
        : r.source.actualOutput,
  },
  {
    id: "sourceAccuracy",
    header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
    cell: (r: ShadowTestingRequest) => (
      <span style={{ display: "block", textAlign: "right" }}>{r.source.accuracy ?? "—"}</span>
    ),
  },
  {
    id: "sourceInputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
    cell: (r: ShadowTestingRequest) => (
      <span style={{ display: "block", textAlign: "right" }}>{r.source.inputTokens}</span>
    ),
  },
  {
    id: "sourceOutputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
    cell: (r: ShadowTestingRequest) => (
      <span style={{ display: "block", textAlign: "right" }}>{r.source.outputTokens}</span>
    ),
  },
  {
    id: "targetActualOutput",
    header: "Actual output",
    width: 300,
    cell: (r: ShadowTestingRequest) =>
      r.target.actualOutput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={r.target.actualOutput}>{r.target.actualOutput}</TruncateText>
        : r.target.actualOutput,
  },
  {
    id: "targetAccuracy",
    header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
    cell: (r: ShadowTestingRequest) => {
      const delta = r.target.accuracy !== null && r.source.accuracy !== null
        ? r.target.accuracy - r.source.accuracy
        : null;
      return (
        <span style={{ display: "block", textAlign: "right" }}>
          {r.target.accuracy ?? "—"}{delta !== null && <Delta value={delta} higherIsBetter={true} />}
        </span>
      );
    },
  },
  {
    id: "targetInputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
    cell: (r: ShadowTestingRequest) => {
      const delta = r.target.inputTokens - r.source.inputTokens;
      return (
        <span style={{ display: "block", textAlign: "right" }}>
          {r.target.inputTokens}<Delta value={delta} higherIsBetter={undefined} />
        </span>
      );
    },
  },
  {
    id: "targetOutputTokens",
    header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
    cell: (r: ShadowTestingRequest) => {
      const delta = r.target.outputTokens - r.source.outputTokens;
      return (
        <span style={{ display: "block", textAlign: "right" }}>
          {r.target.outputTokens}<Delta value={delta} higherIsBetter={undefined} />
        </span>
      );
    },
  },
];

const MODAL_FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "requestId",         propertyLabel: "Request ID",            operators: [":", "!:", "=", "!="],             groupValuesLabel: "Request ID values" },
  { key: "trafficType",       propertyLabel: "Traffic",               operators: [":", "!:", "=", "!="],             groupValuesLabel: "Traffic values" },
  { key: "resolvedInput",     propertyLabel: "Resolved input",        operators: [":", "!:"],                        groupValuesLabel: "Resolved input values" },
  { key: "groundTruth",       propertyLabel: "Ground truth",          operators: [":", "!:"],                        groupValuesLabel: "Ground truth values" },
  { key: "sourceAccuracy",    propertyLabel: "Source accuracy (%)",   operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source accuracy values" },
  { key: "sourceInputTokens", propertyLabel: "Source input tokens",   operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source input token values" },
  { key: "sourceOutputTokens",propertyLabel: "Source output tokens",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Source output token values" },
  { key: "targetAccuracy",    propertyLabel: "Target accuracy (%)",   operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target accuracy values" },
  { key: "targetInputTokens", propertyLabel: "Target input tokens",   operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target input token values" },
  { key: "targetOutputTokens",propertyLabel: "Target output tokens",  operators: ["=", "!=", ">", ">=", "<", "<="], groupValuesLabel: "Target output token values" },
];

function matchesModalQuery(entry: ShadowTestingRequest, q: PropertyFilterProps.Query): boolean {
  if (q.tokens.length === 0) return true;
  const computed: Record<string, string | number | null> = {
    requestId:          entry.requestId,
    trafficType:        entry.trafficType,
    resolvedInput:      entry.resolvedInput,
    groundTruth:        entry.groundTruth,
    sourceAccuracy:     entry.source.accuracy,
    sourceInputTokens:  entry.source.inputTokens,
    sourceOutputTokens: entry.source.outputTokens,
    targetAccuracy:     entry.target.accuracy,
    targetInputTokens:  entry.target.inputTokens,
    targetOutputTokens: entry.target.outputTokens,
  };
  const STRING_KEYS = ["requestId", "trafficType", "resolvedInput", "groundTruth"];

  const testOp = (raw: string | number | null, token: PropertyFilterProps.Token): boolean => {
    if (raw === null) return false;
    const tv = token.value ?? "";
    if (typeof raw === "number") {
      const n = Number(tv);
      if (isNaN(n)) return false;
      switch (token.operator) {
        case "=":  return raw === n;
        case "!=": return raw !== n;
        case ">":  return raw > n;
        case ">=": return raw >= n;
        case "<":  return raw < n;
        case "<=": return raw <= n;
        default:   return true;
      }
    }
    const v = raw.toLowerCase(), fv = String(tv).toLowerCase();
    switch (token.operator) {
      case ":":  return v.includes(fv);
      case "!:": return !v.includes(fv);
      case "=":  return v === fv;
      case "!=": return v !== fv;
      default:   return true;
    }
  };

  const checkToken = (token: PropertyFilterProps.Token): boolean => {
    if (!token.propertyKey) return STRING_KEYS.some(k => testOp(String(computed[k] ?? ""), token));
    const val = computed[token.propertyKey];
    return val !== undefined ? testOp(val, token) : false;
  };

  return q.operation === "and" ? q.tokens.every(checkToken) : q.tokens.some(checkToken);
}

function ShadowTestingContent({ job }: { job: MigrationJob }) {
  const isDark = useCloudscapeDarkMode();
  const varHighlightColor = isDark ? "#4a3870" : "#dccef7";

  const [entries, setEntries] = useState<ShadowTestingTemplate[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [shadowColumnPrefs, setShadowColumnPrefs] = useState(SHADOW_DEFAULT_COLUMN_PREFS);
  const [shadowRequests, setShadowRequests] = useState<ShadowTestingRequest[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ShadowTestingTemplate | null>(null);
  const [modalPageSize, setModalPageSize] = useState(10);

  const toDateSeries = (vals: number[]) =>
    SHADOW_HOURS.map((h, i) => ({ x: new Date(new Date(job.dateStarted).getTime() + h * 3600000), y: vals[i] }));

  const shadowXDomain: [Date, Date] = [new Date(job.dateStarted), new Date(job.dateCompleted && job.dateCompleted !== "-" ? job.dateCompleted : job.dateStarted)];

  const inputTokensSeries = useMemo(() => [
    { title: job.sourceModel + " – Seeded and Live", type: "line" as const, data: toDateSeries(INPUT_TOKENS_SOURCE) },
    { title: job.sourceModel + " – Seeded",          type: "line" as const, data: toDateSeries(INPUT_TOKENS_SOURCE_SEEDED) },
    { title: job.sourceModel + " – Live",             type: "line" as const, data: toDateSeries(INPUT_TOKENS_SOURCE_LIVE) },
    { title: job.targetModel + " – Seeded and Live", type: "line" as const, data: toDateSeries(INPUT_TOKENS_TARGET), color: "#D97757", },
    { title: job.targetModel + " – Seeded", type: "line" as const, data: toDateSeries(INPUT_TOKENS_TARGET_SEEDED) },
    { title: job.targetModel + " – Live",             type: "line" as const, data: toDateSeries(INPUT_TOKENS_TARGET_LIVE) },
  ], [job.sourceModel, job.targetModel, job.dateStarted]);

  const outputTokensSeries = useMemo(() => [
    { title: job.sourceModel + " – Seeded and Live", type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_SOURCE) },
    { title: job.sourceModel + " – Seeded",          type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_SOURCE_SEEDED) },
    { title: job.sourceModel + " – Live",             type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_SOURCE_LIVE) },
    { title: job.targetModel + " – Seeded and Live", type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_TARGET), color: "#D97757", },
    { title: job.targetModel + " – Seeded", type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_TARGET_SEEDED) },
    { title: job.targetModel + " – Live",             type: "line" as const, data: toDateSeries(OUTPUT_TOKENS_TARGET_LIVE) },
  ], [job.sourceModel, job.targetModel, job.dateStarted]);

  const [visibleInputTokens,  setVisibleInputTokens]  = useState(() => [inputTokensSeries[0],  inputTokensSeries[3]]);
  const [visibleOutputTokens, setVisibleOutputTokens] = useState(() => [outputTokensSeries[0], outputTokensSeries[3]]);

  useEffect(() => {
    fetch("/shadow-testing-dataset.json")
      .then((r) => r.json())
      .then((data: ShadowTestingTemplate[]) => setEntries(data));
    fetch("/shadow-testing-live-rows.json")
      .then((r) => r.json())
      .then((data: ShadowTestingRequest[]) => setShadowRequests(data));
  }, []);

  const { items: allFilteredItems, collectionProps, propertyFilterProps } = useCollection(entries, {
    propertyFiltering: {
      filteringProperties: SHADOW_FILTERING_PROPERTIES,
      filteringFunction: matchesShadowQuery,
      empty: <Box textAlign="center"><Box variant="strong">No entries found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    sorting: {
      defaultState: { sortingColumn: { sortingField: "groupId" }, isDescending: false },
    },
  });

  const modalGroupedRequests = shadowRequests.filter(r => r.groupId === selectedGroup?.groupId);

  const {
    items: modalItems,
    paginationProps: modalPaginationProps,
    propertyFilterProps: modalFilterProps,
    collectionProps: modalCollectionProps,
  } = useCollection(modalGroupedRequests, {
    propertyFiltering: {
      filteringProperties: MODAL_FILTERING_PROPERTIES,
      filteringFunction: matchesModalQuery,
      empty:   <Box textAlign="center"><Box variant="strong">No requests found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    pagination: { pageSize: modalPageSize },
    sorting: {},
  });

  const modalFilteringOptions = useMemo(() => [
    { propertyKey: "trafficType", value: "seeded" },
    { propertyKey: "trafficType", value: "live" },
    ...modalGroupedRequests.map(r => ({ propertyKey: "requestId", value: r.requestId })),
  ], [modalGroupedRequests]);

  const pagesCount = Math.max(1, Math.ceil(allFilteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pagesCount);
  const pageItems = allFilteredItems.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const isFiltered = propertyFilterProps.query.tokens.length > 0;
  const matchCount = allFilteredItems.length;

  const handleFilterChange = ({ detail }: { detail: PropertyFilterProps.Query }) => {
    propertyFilterProps.onChange({ detail });
    setCurrentPage(1);
  };

  const filteringOptions = useMemo(() => {
    const opts: PropertyFilterProps.FilteringOption[] = [];
    for (const e of entries) {
      opts.push({ propertyKey: "groupId", value: e.groupId });
      opts.push({ propertyKey: "model",   value: e.model });
    }
    return opts.filter((o, i, arr) => arr.findIndex(x => x.propertyKey === o.propertyKey && x.value === o.value) === i);
  }, [entries]);

  const shadowGroupDefs = useMemo(() => [
    { id: "source-group", header: `Source (${job.sourceModel})` },
    { id: "target-group", header: `Target (${job.targetModel})` },
  ], [job.sourceModel, job.targetModel]);

  const shadowColumnDisplay = useMemo(() => {
    const vis = new Map(shadowColumnPrefs.map(p => [p.id, p.visible]));
    return [
      { id: "groupId",  visible: vis.get("groupId")  ?? true },
      { id: "model",    visible: vis.get("model")    ?? true },
      { id: "template", visible: vis.get("template") ?? true },
      {
        type: "group" as const,
        id: "source-group",
        visible: true,
        children: [
          { id: "source-accuracy",     visible: vis.get("source-accuracy")     ?? true },
          { id: "source-inputTokens",  visible: vis.get("source-inputTokens")  ?? true },
          { id: "source-outputTokens", visible: vis.get("source-outputTokens") ?? true },
        ],
      },
      {
        type: "group" as const,
        id: "target-group",
        visible: true,
        children: [
          { id: "target-accuracy",     visible: vis.get("target-accuracy")     ?? true },
          { id: "target-inputTokens",  visible: vis.get("target-inputTokens")  ?? true },
          { id: "target-outputTokens", visible: vis.get("target-outputTokens") ?? true },
        ],
      },
      { id: "requests", visible: vis.get("requests") ?? true },
    ];
  }, [shadowColumnPrefs]);

  const shadowColumns = useMemo(() => [
    {
      id: "groupId",
      header: <span style={{ paddingLeft: 12 }}>Group ID</span>,
      cell: (item: ShadowTestingTemplate) => <span style={{ paddingLeft: 12 }}>{item.groupId}</span>,
      sortingField: "groupId",
      isRowHeader: true,
    },
    {
      id: "model",
      header: "Model",
      cell: (item: ShadowTestingTemplate) => item.model,
      sortingField: "model",
    },
    {
      id: "template",
      header: "Template",
      cell: (item: ShadowTestingTemplate) => {
        const text = item.template;
        const display = truncate(text);
        return text.length > MAX_TRUNCATE_LENGTH
          ? <TruncateText tooltipText={text}>{highlightVars(display, varHighlightColor)}</TruncateText>
          : <>{highlightVars(text, varHighlightColor)}</>;
      },
      width: 400,
      sortingField: "template",
    },
    {
      id: "source-accuracy",
      header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
      cell: (item: ShadowTestingTemplate) => (
        <span style={{ display: "block", textAlign: "right" }}>{item.aggregate.source.accuracy}</span>
      ),
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.source.accuracy - b.aggregate.source.accuracy,
    },
    {
      id: "source-inputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
      cell: (item: ShadowTestingTemplate) => (
        <span style={{ display: "block", textAlign: "right" }}>{item.aggregate.source.inputTokens}</span>
      ),
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.source.inputTokens - b.aggregate.source.inputTokens,
    },
    {
      id: "source-outputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
      cell: (item: ShadowTestingTemplate) => (
        <span style={{ display: "block", textAlign: "right" }}>{item.aggregate.source.outputTokens}</span>
      ),
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.source.outputTokens - b.aggregate.source.outputTokens,
    },
    {
      id: "target-accuracy",
      header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
      cell: (item: ShadowTestingTemplate) => {
        const delta = item.aggregate.target.accuracy - item.aggregate.source.accuracy;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.aggregate.target.accuracy}<Delta value={delta} higherIsBetter={true} />
          </span>
        );
      },
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.target.accuracy - b.aggregate.target.accuracy,
    },
    {
      id: "target-inputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
      cell: (item: ShadowTestingTemplate) => {
        const delta = item.aggregate.target.inputTokens - item.aggregate.source.inputTokens;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.aggregate.target.inputTokens}<Delta value={delta} higherIsBetter={undefined} />
          </span>
        );
      },
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.target.inputTokens - b.aggregate.target.inputTokens,
    },
    {
      id: "target-outputTokens",
      header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
      cell: (item: ShadowTestingTemplate) => {
        const delta = item.aggregate.target.outputTokens - item.aggregate.source.outputTokens;
        return (
          <span style={{ display: "block", textAlign: "right" }}>
            {item.aggregate.target.outputTokens}<Delta value={delta} higherIsBetter={undefined} />
          </span>
        );
      },
      sortingComparator: (a: ShadowTestingTemplate, b: ShadowTestingTemplate) =>
        a.aggregate.target.outputTokens - b.aggregate.target.outputTokens,
    },
    {
      id: "requests",
      header: <span style={{ display: "block", textAlign: "right" }}>Requests</span>,
      cell: (item: ShadowTestingTemplate) => (
        <Button variant="inline-link" onClick={() => setSelectedGroup(item)}>
          {item.requests} requests
        </Button>
      ),
    },
  ], [varHighlightColor]);

  return (
    <SpaceBetween size="l">
        <Container header={<Header variant="h2">Shadow testing properties</Header>}>
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Status", value: <StatusIndicator type="success">Completed</StatusIndicator> },
              { label: "Traffic sampling (%)", value: "10%" },
              { label: "Date started", value: job.dateCompleted && job.dateCompleted !== "-"
                  ? addMinutes(job.dateCompleted, -72 * 60)
                  : "-", },
              { label: "Time range for test", value: "72 hours" },
              { label: "Number of templates tested", value: "24" },
              { label: "Date completed", value: job.dateCompleted && job.dateCompleted !== "-" ? job.dateCompleted : "-" },
            ]}
          />
        </Container>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
          <Container header={<Header variant="h2" description="Accuracy measured on seeded inputs only. Live traffic does not have ground truth.">Average accuracy (%)</Header>}>
            <LineChart<Date>
              series={[
                { title: job.sourceModel, type: "line", data: toDateSeries(ACCURACY_SOURCE) },
                { title: job.targetModel, color: "#D97757", type: "line", data: toDateSeries(ACCURACY_TARGET) },
              ]}
              xDomain={shadowXDomain}
              yDomain={[75, 90]}
              xTitle="Time & Date"
              yTitle="Percent (%)"
              xScaleType="time"
              i18nStrings={LINE_CHART_I18N}
              height={270}
              hideLegend
              hideFilter
            />
          </Container>
          <Container header={<Header variant="h2" description="Average input tokens of seeded and live traffic.">Average input tokens</Header>}>
            <LineChart<Date>
              series={inputTokensSeries}
              visibleSeries={visibleInputTokens}
              onFilterChange={({ detail }) => setVisibleInputTokens([...detail.visibleSeries] as typeof inputTokensSeries)}
              xDomain={shadowXDomain}
              yDomain={[40, 60]}
              xTitle="Time & Date"
              yTitle="Tokens"
              xScaleType="time"
              i18nStrings={LINE_CHART_I18N}
              height={200}
              hideLegend
            />
          </Container>
          <Container header={<Header variant="h2" description="Average output tokens of seeded and live traffic.">Average output tokens</Header>}>
            <LineChart<Date>
              series={outputTokensSeries}
              visibleSeries={visibleOutputTokens}
              onFilterChange={({ detail }) => setVisibleOutputTokens([...detail.visibleSeries] as typeof outputTokensSeries)}
              xDomain={shadowXDomain}
              yDomain={[185, 225]}
              xTitle="Time & Date"
              yTitle="Tokens"
              xScaleType="time"
              i18nStrings={LINE_CHART_I18N}
              height={200}
              hideLegend
            />
          </Container>
        </div>
        <Table
          {...collectionProps}
          header={
            <Header
              variant="h2"
              description="Shows aggregate metrics for each prompt template from shadow testing."
              actions={
                <Button iconName="download" ariaLabel="Download results" href="/shadow-testing-dataset.json" download="shadow-testing-dataset.json">
                  Download results
                </Button>
              }
            >
              Shadow testing results
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
          stripedRows
          resizableColumns
          stickyHeader
          stickyColumns={{ last: 1 }}
          wrapLines
          groupDefinitions={shadowGroupDefs}
          columnDisplay={shadowColumnDisplay}
          columnDefinitions={shadowColumns}
          trackBy="groupId"
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
              preferences={{ pageSize, contentDisplay: shadowColumnPrefs }}
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize ?? 10);
                if (detail.contentDisplay) setShadowColumnPrefs([...detail.contentDisplay]);
                setCurrentPage(1);
              }}
              pageSizePreference={{
                title: "Page size",
                options: [{ value: 5, label: "5 rows" }, { value: 10, label: "10 rows" }, { value: 20, label: "20 rows" }],
              }}
              contentDisplayPreference={{
                title: "Column preferences",
                options: [
                  { id: "groupId",             label: "Group ID",             alwaysVisible: true },
                  { id: "model",               label: "Model" },
                  { id: "template",            label: "Template",             alwaysVisible: true },
                  { id: "source-accuracy",     label: "Source accuracy (%)" },
                  { id: "source-inputTokens",  label: "Source input tokens" },
                  { id: "source-outputTokens", label: "Source output tokens" },
                  { id: "target-accuracy",     label: "Target accuracy (%)" },
                  { id: "target-inputTokens",  label: "Target input tokens" },
                  { id: "target-outputTokens", label: "Target output tokens" },
                  { id: "requests",            label: "Requests" },
                ],
              }}
            />
          }
          empty={<Box textAlign="center"><Box variant="strong">No entries found</Box></Box>}
        />
        <Modal
          visible={selectedGroup !== null}
          onDismiss={() => setSelectedGroup(null)}
          header={`Requests — Group ID ${selectedGroup?.groupId}`}
          size="max"
        >
         <Box variant="p">
            Results for all seeded and live traffic requests for your selected template. Accuracy is only measured for seeded traffic with known expected outputs.
          </Box>
          <Table
            {...modalCollectionProps}
            items={modalItems}
            stripedRows
            columnDefinitions={MODAL_COLUMNS}
            filter={
              <PropertyFilter
                {...modalFilterProps}
                filteringOptions={modalFilteringOptions}
                i18nStrings={PROPERTY_FILTER_I18N}
                countText={
                  modalFilterProps.query.tokens.length > 0
                    ? `${modalItems.length} ${modalItems.length === 1 ? "match" : "matches"}`
                    : undefined
                }
              />
            }
            groupDefinitions={[
              { id: "source-group", header: `Source (${job.sourceModel})` },
              { id: "target-group", header: `Target (${job.targetModel})` },
            ]}
            columnDisplay={[
              { id: "requestId",        visible: true },
              { id: "trafficType",      visible: true },
              { id: "resolvedInput",    visible: true },
              { id: "groundTruth",      visible: true },
              { type: "group" as const, id: "source-group", visible: true, children: [
                { id: "sourceActualOutput", visible: true },
                { id: "sourceAccuracy",     visible: true },
                { id: "sourceInputTokens",  visible: true },
                { id: "sourceOutputTokens", visible: true },
              ]},
              { type: "group" as const, id: "target-group", visible: true, children: [
                { id: "targetActualOutput", visible: true },
                { id: "targetAccuracy",     visible: true },
                { id: "targetInputTokens",  visible: true },
                { id: "targetOutputTokens", visible: true },
              ]},
            ]}
            wrapLines
            resizableColumns
            variant="embedded"
            trackBy="requestId"
            pagination={<Pagination {...modalPaginationProps} />}
            preferences={
              <CollectionPreferences
                title="Preferences"
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                preferences={{ pageSize: modalPageSize }}
                onConfirm={({ detail }) => setModalPageSize(detail.pageSize ?? 10)}
                pageSizePreference={{
                  title: "Page size",
                  options: [
                    { value: 10, label: "10 rows" },
                    { value: 25, label: "25 rows" },
                    { value: 50, label: "50 rows" },
                  ],
                }}
              />
            }
            empty={<Box textAlign="center"><Box variant="strong">No requests found</Box></Box>}
          />
        </Modal>
      </SpaceBetween>
  );
}

function LockedTabContent({ buttonLabel, onClick }: { buttonLabel: string; onClick?: () => void }) {
  return (
    <Container>
      <Box textAlign="center" padding={{ vertical: "xl" }}>
        <SpaceBetween size="s" alignItems="center">
          <Box variant="strong" fontSize="heading-s">No results yet</Box>
          <Box variant="p" color="text-body-secondary">
            <strong>{buttonLabel}</strong> to proceed.
          </Box>
          <Button onClick={onClick}>
            {buttonLabel}
          </Button>
        </SpaceBetween>
      </Box>
    </Container>
  );
}

export default function MigrationResultsPage() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const [navigationPanelState, setNavigationPanelState] = useNavigationPanelState();

  const activeState =
    searchParams.get("state") ??
    (MIGRATION_COMPLETE    ? "MIGRATION_COMPLETE"    :
     OPTIMIZATION_COMPLETE ? "OPTIMIZATION_COMPLETE" :
     EVAL_COMPLETE         ? "EVAL_COMPLETE"         : null);

  const job = (state as MigrationJob | null) ?? (activeState && activeState in JOB_BY_STATE ? JOB_BY_STATE[activeState] : null);
  const [activeTabId, setActiveTabId] = useState(() => job ? getActiveTabId(job) : "evaluation");

  const showSuccessAlert = searchParams.has("successAlert") || SUCCESS_ALERT;
  const [alertDismissed, setAlertDismissed] = useState(false);

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
      maxContentWidth={1440}
      headerSelector="#awsui-top-navigation"
      navigation={<NavigationPanel />}
      navigationOpen={!navigationPanelState.collapsed}
      onNavigationChange={({ detail }) => setNavigationPanelState({ collapsed: !detail.open })}
      toolsHide={true}
      notifications={
        showSuccessAlert && activeState === "MIGRATION_COMPLETE" && !alertDismissed
          ? <Flashbar items={[{ type: "success", 
              content: (
                <>
                  <strong>{job.jobName}:</strong> shadow testing complete. View the results under the <strong>Shadow testing</strong> tab.
                </>
              ),
              dismissible: true, onDismiss: () => setAlertDismissed(true) }]} />
          : undefined
      }
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
              actions={getHeaderAction(job, navigate)}
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
                    label: "Source model",
                    value: job.sourceModel,
                  },
                  {
                    label: "Target model",
                    value: job.targetModel,
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
                    label: "Date started",
                    value: job.dateStarted,
                  },
                  {
                    label: "Date completed",
                    value: job.dateCompleted && job.dateCompleted !== "-"
                      ? job.dateCompleted
                      : "-",
                  },
                ]}
              />
            </Container>
            {showSuccessAlert && activeState !== "MIGRATION_COMPLETE" && !alertDismissed && (
              <Alert
                type="success"
                header={activeState === "OPTIMIZATION_COMPLETE" ? "Prompt optimization successfully completed." : activeState === "EVAL_COMPLETE" ? "Initial evaluation successfully completed." : "Shadow testing successfully completed."}
                action={
                  completed >= 3
                  ? null
                  : completed >= 2
                  ? <Button onClick={() => navigate("/start-shadow-testing", { state: job })}>Start shadow testing</Button>
                  : <Button onClick={() => navigate("/provide-prompt-templates", { state: job })}>Provide prompt templates</Button>
                }
                dismissible
                onDismiss={() => setAlertDismissed(true)}
              >
                You can now <strong>Provide prompt templates</strong> for an optional{" "}
                <strong>Prompt optimization</strong> or move directly to <strong>Shadow testing</strong>.
              </Alert>
            )}
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
                    ? <OptimizationContent job={job} />
                    : <LockedTabContent buttonLabel="Provide prompt templates" onClick={() => navigate("/provide-prompt-templates", { state: job })} />,
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
                    ? <ShadowTestingContent job={job} />
                    : completed === 2
                      ? <LockedTabContent buttonLabel="Start shadow testing" onClick={() => navigate("/start-shadow-testing", { state: job })} />
                      : <LockedTabContent buttonLabel="Provide prompt templates" onClick={() => navigate("/provide-prompt-templates", { state: job })} />,
                },
              ]}
            />
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
