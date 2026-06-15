import { useState } from "react";
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
  Tiles,
  DateRangePicker,
  DateRangePickerProps,
  RadioGroup,
  S3ResourceSelector,
  S3ResourceSelectorProps,
  Button,
} from "@cloudscape-design/components";
import NavigationPanel from "../components/navigation-panel";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { MigrationJob } from "../common/types";

function validateTimeRange(value: DateRangePickerProps.Value | null): string | undefined {
  if (!value) return "Select a time range.";
  if (value.type === "relative" && (!value.amount || value.amount <= 0)) {
    return "Enter a valid duration greater than zero.";
  }
  if (value.type === "absolute") {
    if (!value.startDate || !value.endDate) return "Select a start and end date.";
    if (new Date(value.startDate) > new Date(value.endDate)) {
      return "The start date must be before the end date.";
    }
  }
  return undefined;
}

const JSON_SCHEMA_TEMPLATE = `{
  "template": "Summarize the following {{productCategory}} review:{{reviewText}}",
  "variables": [
    { "name": "productCategory", "type": "string" },
    { "name": "reviewText", "type": "string" }
  ],
  "testData": [
    {
      "inputs": { "productCategory": "...", "reviewText": "..." },
      "expectedOutput": "..."
    },
    {
      "inputs": { "productCategory": "...", "reviewText": "..." },
      "expectedOutput": "..."
    }
  ]
}`;

const fetchBuckets = async (): Promise<S3ResourceSelectorProps.Bucket[]> => [
  { Name: "my-llm-templates-bucket", CreationDate: "2024-01-15", Region: "us-east-1" },
  { Name: "bedrock-prompts-prod", CreationDate: "2024-03-20", Region: "us-west-2" },
];

const fetchObjects = async (): Promise<S3ResourceSelectorProps.Object[]> => [
  { Key: "prompts/", IsFolder: true },
  { Key: "prompts/summarization-v1.json", LastModified: "2026-05-01", Size: 1234 },
  { Key: "prompts/classification-v2.json", LastModified: "2026-05-10", Size: 2345 },
];

const RELATIVE_OPTIONS: DateRangePickerProps.RelativeOption[] = [
  { key: "7-days",  amount: 7,  unit: "day", type: "relative" },
  { key: "14-days", amount: 14, unit: "day", type: "relative" },
  { key: "30-days", amount: 30, unit: "day", type: "relative" },
  { key: "90-days", amount: 90, unit: "day", type: "relative" },
];

export default function ProvidePromptTemplatesPage() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [navigationPanelState, setNavigationPanelState] = useNavigationPanelState();

  const job = state as MigrationJob | null;
  const [source, setSource] = useState("invocation-logs");
  const [timeRange, setTimeRange] = useState<DateRangePickerProps.Value | null>({ type: "relative", key: "7-days", amount: 7, unit: "day" });
  const [optimization, setOptimization] = useState("optimize");
  const [s3Resource, setS3Resource] = useState<S3ResourceSelectorProps.Resource>({ uri: "" });

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
            { text: "Model migration", href: "/?state=EVAL_COMPLETE" },
            { text: job?.jobName ?? "Migration job", href: job ? `/results/${job.id}?state=EVAL_COMPLETE` : "/" },
            { text: "Provide prompt templates", href: "#" },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Optimize your prompts to get better performance with the new model."
            >
              Provide prompt templates
            </Header>
          }
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => navigate(-1)}>Cancel</Button>
                <Button variant="primary" href="/results/job-1?state=OPTIMIZATION_COMPLETE&successAlert=true">Start prompt optimization</Button>
              </SpaceBetween>
            }
          >
            <Container
              header={
                <Header variant="h2">
                  Choose the source for your prompt templates
                </Header>
              }
            >
              <SpaceBetween size="l">
                <FormField
                  label="Prompt templates source"
                  description="Select how you want to provide prompt templates for migration and evaluation."
                >
                  <Tiles
                    value={source}
                    onChange={({ detail }) => setSource(detail.value)}
                    columns={2}
                    items={[
                      {
                        value: "invocation-logs",
                        label: "Extract prompt templates from your invocation logs",
                        description: "Extract and optimize up to 500 prompts from invocation logs within a selected time range.",
                      },
                      {
                        value: "s3",
                        label: "Import prompt templates from Amazon S3",
                        description: "Import prompt templates and ground truth data from S3 to improve target model performance.",
                      },
                    ]}
                  />
                </FormField>
                {source === "invocation-logs" && (
                  <FormField
                    label="Time range for analysis"
                    description="Select the time range of invocation logs to access."
                    errorText={source === "invocation-logs" ? validateTimeRange(timeRange) : undefined}
                  >
                    <DateRangePicker
                      value={timeRange}
                      placeholder="Choose a time range"
                      onChange={({ detail }) => setTimeRange(detail.value)}
                      relativeOptions={RELATIVE_OPTIONS}
                      isDateEnabled={() => true}
                      isValidRange={(value) => {
                        const err = validateTimeRange(value);
                        return err ? { valid: false, errorMessage: err } : { valid: true };
                      }}
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
                        customRelativeRangeOptionDescription: "Set a custom range in the past",
                        customRelativeRangeDurationLabel: "Duration",
                        customRelativeRangeDurationPlaceholder: "Enter duration",
                        customRelativeRangeUnitLabel: "Unit of time",
                        formatRelativeRange: ({ amount, unit }) =>
                          `Last ${amount} ${unit}${amount !== 1 ? "s" : ""}`,
                        formatUnit: (unit, amount) =>
                          amount === 1 ? unit : `${unit}s`,
                      }}
                    />
                  </FormField>
                )}
                {source === "s3" && (
                  <>
                    <FormField
                      label="Prompt optimization"
                      description="Choose if you want Bedrock to optimize your prompt templates in order to maximize target model performance."
                    >
                      <RadioGroup
                        value={optimization}
                        onChange={({ detail }) => setOptimization(detail.value)}
                        items={[
                          {
                            value: "optimize",
                            label: (
                              <span>Optimize your prompt templates to improve target model performance — <em>recommended</em></span>
                            ),
                          },
                          {
                            value: "skip",
                            disabled: true,
                            label: "Skip prompt optimization and proceed to shadow test your prompt templates",
                          },
                        ]}
                      />
                    </FormField>
                    <FormField label="Template dataset for reference (JSON)" description="Use this as a reference to create your own prompt template dataset.">
                      <div style={{ position: "relative" }}>
                        <pre style={{
                          margin: 0,
                          fontFamily: "monospace",
                          fontSize: "13px",
                          backgroundColor: "#f4f4f4",
                          padding: "16px",
                          borderRadius: "4px",
                          overflowX: "auto",
                          border: "1px solid #e9ebed",
                        }}>
                          {JSON_SCHEMA_TEMPLATE}
                        </pre>
                        <div style={{ position: "absolute", top: 8, right: 8 }}>
                          <Button
                            // variant="icon"
                            iconName="copy"
                            ariaLabel="Copy"
                            onClick={() => navigator.clipboard.writeText(JSON_SCHEMA_TEMPLATE)}
                          />
                        </div>
                      </div>
                    </FormField>
                    <FormField>
                      <S3ResourceSelector
                        resource={s3Resource}
                        onChange={({ detail }) => setS3Resource(detail.resource)}
                        fetchBuckets={fetchBuckets}
                        fetchObjects={fetchObjects}
                        fetchVersions={async () => []}
                        selectableItemsTypes={["objects"]}
                        i18nStrings={{
                          inContextBrowseButton: "Browse S3",
                          inContextInputPlaceholder: "s3://my-llm-templates-bucket/prompts/summarization-v1.json",
                          inContextSelectPlaceholder: "Choose a version",
                          inContextViewButton: "View",
                          inContextViewButtonAriaLabel: "View (opens new tab)",
                          inContextLoadingText: "Loading resource",
                          inContextUriLabel: "Prompt templates S3 URL",
                          inContextVersionSelectLabel: "Object version",
                          modalTitle: "Choose an object in S3",
                          modalCancelButton: "Cancel",
                          modalSubmitButton: "Choose",
                          filteringCounterText: (count) => `${count} ${count === 1 ? "match" : "matches"}`,
                          filteringNoMatches: "No matches",
                          filteringCantFindMatch: "Can't find a match?",
                          clearFilterButtonText: "Clear filter",
                          columnBucketName: "Bucket name",
                          columnBucketCreationDate: "Creation date",
                          columnBucketRegion: "Region",
                          columnObjectKey: "Key",
                          columnObjectLastModified: "Last modified",
                          columnObjectSize: "Size",
                          columnVersionID: "Version ID",
                          columnVersionLastModified: "Last modified",
                          columnVersionSize: "Size",
                          labelBreadcrumbs: "S3 navigation",
                          labelFiltering: (itemsType: string) => `Filter ${itemsType}`,
                          labelNotSorted: (_: string) => "Not sorted",
                          labelRefresh: "Refresh",
                          labelSortedAscending: (_: string) => "Sorted ascending",
                          labelSortedDescending: (_: string) => "Sorted descending",
                          labelsBucketsSelection: {
                            itemSelectionLabel: (_data: unknown, row: S3ResourceSelectorProps.Bucket) => `Select bucket ${row.Name}`,
                            selectionGroupLabel: "Bucket",
                          },
                          labelsObjectsSelection: {
                            itemSelectionLabel: (_data: unknown, row: S3ResourceSelectorProps.Object) => `Select ${row.Key}`,
                            selectionGroupLabel: "Objects",
                          },
                          labelsVersionsSelection: {
                            itemSelectionLabel: (_data: unknown, row: S3ResourceSelectorProps.Version) => `Select version ${row.VersionId}`,
                            selectionGroupLabel: "Versions",
                          },
                          validationPathMustBegin: "The path must begin with s3://",
                          validationBucketLowerCase: "The bucket name must be in lowercase.",
                          validationBucketMustNotContain: "The bucket name must not contain uppercase characters.",
                          validationBucketLength: "The bucket name must be between 3 and 63 characters long.",
                          validationBucketMustComplyDns: "The bucket name must comply with DNS naming conventions.",
                        }}
                      />
                    </FormField>
                  </>
                )}
              </SpaceBetween>
            </Container>
          </Form>
        </ContentLayout>
      }
    />
  );
}
