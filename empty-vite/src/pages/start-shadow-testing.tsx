import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Container,
  SpaceBetween,
  Form,
  FormField,
  Input,
  DateRangePicker,
  DateRangePickerProps,
  Button,
  Box,
  Table,
  Pagination,
  CollectionPreferences,
  PropertyFilter,
  PropertyFilterProps,
  Modal,
  Alert,
  KeyValuePairs,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import TruncateText from "@cloudscape-design/components/truncated-text";
import NavigationPanel from "../components/navigation-panel";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { useCloudscapeDarkMode } from "../common/hooks/use-cloudscape-dark-mode";
import { highlightVars } from "../common/utils/highlight-vars";
import { MigrationJob } from "../common/types";

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

function avgFromTestData(testData: TestDataCase[]) {
  if (!testData.length) return { accuracy: 0, inputTokens: 0, outputTokens: 0 };
  const n = testData.length;
  return {
    accuracy:     Math.round(testData.reduce((s, td) => s + parseInt(td.accuracy),     0) / n),
    inputTokens:  Math.round(testData.reduce((s, td) => s + parseInt(td.inputTokens),  0) / n),
    outputTokens: Math.round(testData.reduce((s, td) => s + parseInt(td.outputTokens), 0) / n),
  };
}

const MAX_TRUNCATE_LENGTH = 224;
const truncate = (text: string, max = MAX_TRUNCATE_LENGTH) =>
  text.length > max ? text.slice(0, max) + "…" : text;

function Delta({ value, higherIsBetter }: { value: number; higherIsBetter?: boolean }) {
  const isGood = higherIsBetter === undefined || value === 0 ? null : higherIsBetter ? value > 0 : value < 0;
  return (
    <Box
      variant="span"
      color={isGood === null ? "text-body-secondary" : isGood ? "text-status-success" : "text-status-error"}
    >
      {value > 0 ? "+" : ""}{value}
    </Box>
  );
}

const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "groupId",          propertyLabel: "Group ID",       operators: [":", "!:", "=", "!="],              groupValuesLabel: "Group ID values" },
  { key: "model",            propertyLabel: "Model",          operators: [":", "!:", "=", "!="],              groupValuesLabel: "Model values" },
  { key: "template",         propertyLabel: "Template",       operators: [":", "!:"],                         groupValuesLabel: "Template values" },
  { key: "accuracy",         propertyLabel: "Accuracy (%)",   operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Accuracy values" },
  { key: "accuracyDelta",    propertyLabel: "Δ Accuracy (%)", operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Accuracy Δ values" },
  { key: "inputTokens",      propertyLabel: "Input tokens",   operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Input token values" },
  { key: "inputTokensDelta", propertyLabel: "Δ Input tokens", operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Input tokens Δ values" },
  { key: "outputTokens",     propertyLabel: "Output tokens",  operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Output token values" },
  { key: "outputTokensDelta",propertyLabel: "Δ Output tokens",operators: ["=", "!=", ">", ">=", "<", "<="],  groupValuesLabel: "Output tokens Δ values" },
];

const PROPERTY_FILTER_I18N: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: "Filter prompts",
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
};

const FIXED_TEST_DATA_COLUMNS = [
  {
    id: "expectedOutput",
    header: "Expected output",
    cell: (td: TestDataCase) =>
      td.expectedOutput.length > MAX_TRUNCATE_LENGTH
        ? <TruncateText tooltipText={td.expectedOutput}>{td.expectedOutput}</TruncateText>
        : td.expectedOutput,
    width: 300,
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

const RELATIVE_OPTIONS: DateRangePickerProps.RelativeOption[] = [
  { key: "72-hours", amount: 72, unit: "hour", type: "relative" },
  { key: "7-days",   amount: 7,  unit: "day",  type: "relative" },
  { key: "14-days",  amount: 14, unit: "day",  type: "relative" },
  { key: "30-days",  amount: 30, unit: "day",  type: "relative" },
];

export default function StartShadowTestingPage() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [navigationPanelState, setNavigationPanelState] = useNavigationPanelState();

  const job = state as MigrationJob | null;
  const isDark = useCloudscapeDarkMode();
  const varHighlightColor = isDark ? "#4a3870" : "#dccef7";

  // ── Form state ────────────────────────────────────────────────────────────
  const [trafficSampling, setTrafficSampling] = useState("10");
  const [timeRange, setTimeRange] = useState<DateRangePickerProps.Value | null>({ type: "relative", key: "72-hours", amount: 72, unit: "hour" });

  // ── Table data ────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<PromptTemplateEntry[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<PromptTemplateEntry[]>([]);
  const [testDataEntry, setTestDataEntry] = useState<PromptTemplateEntry | null>(null);
  const [showSelectionError, setShowSelectionError] = useState(false);

  useEffect(() => {
    fetch("/prompt-templates.json")
      .then((r) => r.json())
      .then((data: PromptTemplateEntry[]) => {
        setEntries(data);
        setSelectedItems(data.filter((e) => e.type === "Optimized"));
      });
  }, []);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const optimizedEntries = useMemo(() => entries.filter((e) => e.type === "Optimized"), [entries]);

  const sourceByGroupId = useMemo(() => {
    const map = new Map<string, PromptTemplateEntry>();
    for (const e of entries) if (e.type === "Source") map.set(e.groupId, e);
    return map;
  }, [entries]);

  const allSelected =
    optimizedEntries.length > 0 &&
    optimizedEntries.every((opt) => selectedItems.some((s) => s.groupId === opt.groupId));

  const handleSelectionChange = ({ detail }: { detail: { selectedItems: PromptTemplateEntry[] } }) => {
    setSelectedItems(detail.selectedItems);
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...optimizedEntries]);
    }
  };

  // ── Filtering / sorting / pagination ──────────────────────────────────────
  const matchesQuery = useMemo(() => (entry: PromptTemplateEntry, q: PropertyFilterProps.Query): boolean => {
    if (q.tokens.length === 0) return true;
    const metrics = avgFromTestData(entry.testData);
    const src = sourceByGroupId.get(entry.groupId);
    const srcMetrics = src ? avgFromTestData(src.testData) : null;
    const computed: Record<string, string | number> = {
      groupId:          entry.groupId,
      model:            entry.model,
      template:         entry.template,
      accuracy:         metrics.accuracy,
      accuracyDelta:    srcMetrics ? metrics.accuracy - srcMetrics.accuracy : 0,
      inputTokens:      metrics.inputTokens,
      inputTokensDelta: srcMetrics ? metrics.inputTokens - srcMetrics.inputTokens : 0,
      outputTokens:     metrics.outputTokens,
      outputTokensDelta:srcMetrics ? metrics.outputTokens - srcMetrics.outputTokens : 0,
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
  }, [sourceByGroupId]);

  const { items: allFilteredItems, collectionProps, propertyFilterProps } = useCollection(optimizedEntries, {
    propertyFiltering: {
      filteringProperties: FILTERING_PROPERTIES,
      filteringFunction: matchesQuery,
      empty: <Box textAlign="center"><Box variant="strong">No entries found</Box></Box>,
      noMatch: <Box textAlign="center"><Box variant="strong">No matches</Box><Box variant="p" color="text-body-secondary">Try adjusting your filters.</Box></Box>,
    },
    sorting: {
      defaultState: { sortingColumn: { sortingField: "groupId" }, isDescending: false },
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

  // ── Column definitions ────────────────────────────────────────────────────
  const filteringOptions = useMemo(() => {
    const opts: PropertyFilterProps.FilteringOption[] = [];
    for (const e of optimizedEntries) {
      opts.push({ propertyKey: "groupId", value: e.groupId });
      opts.push({ propertyKey: "model",   value: e.model });
    }
    return opts.filter((o, i, arr) => arr.findIndex((x) => x.propertyKey === o.propertyKey && x.value === o.value) === i);
  }, [optimizedEntries]);

  const logColumns = useMemo(() => {
    const getDelta = (item: PromptTemplateEntry, key: "accuracy" | "inputTokens" | "outputTokens") => {
      const m = avgFromTestData(item.testData);
      const src = sourceByGroupId.get(item.groupId);
      const srcM = src ? avgFromTestData(src.testData) : null;
      return { value: m[key], delta: srcM ? m[key] - srcM[key] : null };
    };

    return [
      {
        id: "groupId",
        header: <span style={{ paddingLeft: 12 }}>Group ID</span>,
        cell: (item: PromptTemplateEntry) => <span style={{ paddingLeft: 12 }}>{item.groupId}</span>,
        sortingField: "groupId",
        isRowHeader: true,
      },
      {
        id: "model",
        header: "Model",
        cell: (item: PromptTemplateEntry) => item.model,
        sortingField: "model",
      },
      {
        id: "template",
        header: "Template",
        width: 300,
        cell: (item: PromptTemplateEntry) => {
          const text = item.template;
          const display = truncate(text);
          return text.length > MAX_TRUNCATE_LENGTH
            ? <TruncateText tooltipText={text}>{highlightVars(display, varHighlightColor)}</TruncateText>
            : <>{highlightVars(text, varHighlightColor)}</>;
        },
        sortingField: "template",
      },
      {
        id: "accuracy",
        header: <span style={{ display: "block", textAlign: "right" }}>Accuracy (%)</span>,
        cell: (item: PromptTemplateEntry) => {
          const { value } = getDelta(item, "accuracy");
          return <span style={{ display: "block", textAlign: "right" }}>{value}</span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          avgFromTestData(a.testData).accuracy - avgFromTestData(b.testData).accuracy,
      },
      {
        id: "accuracyDelta",
        header: <span style={{ display: "block", textAlign: "right" }}>Δ Accuracy (%)</span>,
        cell: (item: PromptTemplateEntry) => {
          const { delta } = getDelta(item, "accuracy");
          if (delta === null) return "—";
          return <span style={{ display: "block", textAlign: "right" }}><Delta value={delta} higherIsBetter={true} /></span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          (getDelta(a, "accuracy").delta ?? 0) - (getDelta(b, "accuracy").delta ?? 0),
      },
      {
        id: "inputTokens",
        header: <span style={{ display: "block", textAlign: "right" }}>Input tokens</span>,
        cell: (item: PromptTemplateEntry) => {
          const { value } = getDelta(item, "inputTokens");
          return <span style={{ display: "block", textAlign: "right" }}>{value}</span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          avgFromTestData(a.testData).inputTokens - avgFromTestData(b.testData).inputTokens,
      },
      {
        id: "inputTokensDelta",
        header: <span style={{ display: "block", textAlign: "right" }}>Δ Input tokens</span>,
        cell: (item: PromptTemplateEntry) => {
          const { delta } = getDelta(item, "inputTokens");
          if (delta === null) return "—";
          return <span style={{ display: "block", textAlign: "right" }}><Delta value={delta} higherIsBetter={undefined} /></span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          (getDelta(a, "inputTokens").delta ?? 0) - (getDelta(b, "inputTokens").delta ?? 0),
      },
      {
        id: "outputTokens",
        header: <span style={{ display: "block", textAlign: "right" }}>Output tokens</span>,
        cell: (item: PromptTemplateEntry) => {
          const { value } = getDelta(item, "outputTokens");
          return <span style={{ display: "block", textAlign: "right" }}>{value}</span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          avgFromTestData(a.testData).outputTokens - avgFromTestData(b.testData).outputTokens,
      },
      {
        id: "outputTokensDelta",
        header: <span style={{ display: "block", textAlign: "right" }}>Δ Output tokens</span>,
        cell: (item: PromptTemplateEntry) => {
          const { delta } = getDelta(item, "outputTokens");
          if (delta === null) return "—";
          return <span style={{ display: "block", textAlign: "right" }}><Delta value={delta} higherIsBetter={undefined} /></span>;
        },
        sortingComparator: (a: PromptTemplateEntry, b: PromptTemplateEntry) =>
          (getDelta(a, "outputTokens").delta ?? 0) - (getDelta(b, "outputTokens").delta ?? 0),
      },
    ];
  }, [sourceByGroupId, varHighlightColor]);

  // ── Test data modal columns ───────────────────────────────────────────────
  const testDataInputKeys = useMemo(
    () => Object.keys(testDataEntry?.testData[0]?.inputs ?? {}),
    [testDataEntry]
  );

  const testDataColumnDefs = useMemo(() => [
    ...testDataInputKeys.map(key => ({
      id: `input-${key}`,
      header: `{{${key}}}`,
      cell: (td: TestDataCase) => td.inputs[key],
      width: 300,
    })),
    ...FIXED_TEST_DATA_COLUMNS,
  ], [testDataInputKeys]);

  const testDataGroupDefs = useMemo(() => [{ id: "inputs-group", header: "Inputs" }], []);

  const testDataColumnDisplay = useMemo(() => [
    {
      type: "group" as const,
      id: "inputs-group",
      visible: true,
      children: testDataInputKeys.map(key => ({ id: `input-${key}`, visible: true })),
    },
    ...FIXED_TEST_DATA_COLUMNS.map(col => ({ id: col.id, visible: true })),
  ], [testDataInputKeys]);

  return (
    <AppLayoutToolbar
      maxContentWidth={1440}
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
            { text: "Model migration", href: job ? `/?state=OPTIMIZATION_COMPLETE` : "/" },
            { text: job?.jobName ?? "Migration job", href: job ? `/results/${job.id}?state=OPTIMIZATION_COMPLETE` : "/" },
            { text: "Start shadow testing", href: "#" },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Set up shadow testing to compare outputs from your target models against the current production model using real traffic."
            >
              Start shadow testing
            </Header>
          }
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => navigate(-1)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (selectedItems.length === 0) {
                      setShowSelectionError(true);
                    } else {
                      setShowSelectionError(false);
                      navigate(`/results/job-1?state=MIGRATION_COMPLETE&successAlert=true`);
                    }
                  }}
                >
                  Start shadow test
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Test configuration</Header>}>
                <KeyValuePairs
                  columns={2}
                  items={[
                    { label: "Source model", value: job?.sourceModel ?? "—" },
                    { label: "Target model", value: job?.targetModel ?? "—" },
                  ]}
                />
              </Container>
              <Container header={<Header variant="h2">Configure shadow test parameters</Header>}>
                <SpaceBetween size="l">
                  <FormField
                    label="Traffic sampling (%)"
                    description="Specify what percentage of live traffic to duplicate for shadow testing."
                    constraintText="Maximum value of 50"
                  >
                    <Input
                      type="number"
                      value={trafficSampling}
                      onChange={({ detail }) => setTrafficSampling(detail.value)}
                      inputMode="numeric"
                    />
                  </FormField>
                  <FormField
                    label="Length of test"
                    description="Select the amount of time to perform the shadow test."
                  >
                    <DateRangePicker
                      value={timeRange}
                      placeholder="Choose a time range"
                      onChange={({ detail }) => setTimeRange(detail.value)}
                      relativeOptions={RELATIVE_OPTIONS}
                      isDateEnabled={() => true}
                      rangeSelectorMode="relative-only"
                      isValidRange={() => ({ valid: true })}
                      customRelativeRangeUnits={["hour", "day"]}
                      i18nStrings={{
                        relativeModeTitle: "Relative range",
                        absoluteModeTitle: "Absolute range",
                        modeSelectionLabel: "Date range mode",
                        relativeRangeSelectionHeading: "Choose a range",
                        cancelButtonLabel: "Cancel",
                        clearButtonLabel: "Clear",
                        applyButtonLabel: "Apply",
                        startDateLabel: "Start date",
                        startTimeLabel: "Start time",
                        endDateLabel: "End date",
                        endTimeLabel: "End time",
                        customRelativeRangeOptionLabel: "Custom range",
                        customRelativeRangeOptionDescription: "Set a custom range in the future",
                        customRelativeRangeDurationLabel: "Duration",
                        customRelativeRangeDurationPlaceholder: "Enter duration",
                        customRelativeRangeUnitLabel: "Unit of time",
                        formatRelativeRange: ({ amount, unit }) =>
                          `Next ${amount} ${unit}${amount !== 1 ? "s" : ""}`,
                        formatUnit: (unit, amount) =>
                          amount === 1 ? unit : `${unit}s`,
                      }}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              {testDataEntry && (
                <Modal
                  visible={true}
                  size="xx-large"
                  header={`Group ID: ${testDataEntry.groupId}, ${testDataEntry.model} – Test data`}
                  onDismiss={() => setTestDataEntry(null)}
                  footer={<Box float="right"><Button variant="primary" onClick={() => setTestDataEntry(null)}>Close</Button></Box>}
                >
                  <Table
                    items={testDataEntry.testData}
                    columnDefinitions={testDataColumnDefs}
                    groupDefinitions={testDataGroupDefs}
                    columnDisplay={testDataColumnDisplay}
                    trackBy={(td) => JSON.stringify(td.inputs)}
                    variant="embedded"
                    wrapLines
                    stripedRows resizableColumns
                  />
                </Modal>
              )}

              <Table
                {...collectionProps}
                selectionType="multi"
                stripedRows
                selectedItems={selectedItems}
                onSelectionChange={(e) => { handleSelectionChange(e); setShowSelectionError(false); }}
                header={
                  <Header
                    variant="h2"
                    counter={selectedItems.length > 0 ? `(${selectedItems.length} selected)` : undefined}
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          disabled={selectedItems.length !== 1}
                          onClick={() => setTestDataEntry(selectedItems[0])}
                        >
                          View test data
                        </Button>
                        <Button onClick={handleToggleAll}>
                          {allSelected ? "Unselect all" : "Select all"}
                        </Button>
                      </SpaceBetween>
                    }
                  >
                    Choose prompt templates to shadow test
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
                resizableColumns stickyHeader wrapLines
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
                    preferences={{ pageSize }}
                    onConfirm={({ detail }) => { setPageSize(detail.pageSize ?? 10); setCurrentPage(1); }}
                    pageSizePreference={{
                      title: "Page size",
                      options: [{ value: 5, label: "5 rows" }, { value: 10, label: "10 rows" }, { value: 20, label: "20 rows" }],
                    }}
                  />
                }
                columnDefinitions={logColumns}
                trackBy={(item) => `${item.groupId}-${item.type}`}
                empty={<Box textAlign="center"><Box variant="strong">No entries found</Box></Box>}
              />
              {showSelectionError && (
                <Alert
                  type="error"
                  header="Form error"
                  dismissible
                  onDismiss={() => setShowSelectionError(false)}
                >
                  You must choose at least 1 prompt group to continue.
                </Alert>
              )}
            </SpaceBetween>
          </Form>
        </ContentLayout>
      }
    />
  );
}
