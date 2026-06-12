import { useState } from "react";
import {
  Header,
  BreadcrumbGroup,
  Form,
  Container,
  FormField,
  Select,
  Multiselect,
  MultiselectProps,
  SpaceBetween,
  Button,
  SelectProps,
  ExpandableSection,
  Alert,
  Input,
  Textarea,
  DateRangePicker,
  DateRangePickerProps,
  RadioGroup,
} from "@cloudscape-design/components";

const RELATIVE_OPTIONS: DateRangePickerProps.RelativeOption[] = [
  { key: "previous-12-hours", amount: 12, unit: "hour",  type: "relative" },
  { key: "previous-24-hours", amount: 24, unit: "hour",  type: "relative" },
  { key: "previous-7-days",   amount: 7,  unit: "day",   type: "relative" },
  { key: "previous-30-days",  amount: 30, unit: "day",   type: "relative" },
];

const DATE_RANGE_I18N: DateRangePickerProps.I18nStrings = {
  relativeModeTitle: "Relative mode",
  absoluteModeTitle: "Absolute mode",
  relativeRangeSelectionHeading: "Choose a range",
  cancelButtonLabel: "Cancel",
  clearButtonLabel: "Clear and dismiss",
  applyButtonLabel: "Apply",
  formatRelativeRange: (e) =>
    e.amount === 12 || e.amount === 24
      ? `Last ${e.amount} hours`
      : `Last ${e.amount} days`,
  formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
  dateTimeConstraintText: "",
  startDateLabel: "Start date",
  startTimeLabel: "Start time",
  endDateLabel: "End date",
  endTimeLabel: "End time",
  errorIconAriaLabel: "Error",
  renderSelectedAbsoluteRangeAriaLive: (startDate, endDate) =>
    `Range selected from ${startDate} to ${endDate}`,
  customRelativeRangeOptionLabel: "Custom range",
  customRelativeRangeOptionDescription: "Set a custom range in the past",
  customRelativeRangeDurationLabel: "Duration",
  customRelativeRangeDurationPlaceholder: "Enter duration",
  customRelativeRangeUnitLabel: "Unit of time",
};
import { AppLayoutToolbar } from "@cloudscape-design/components";
import NavigationPanel from "../components/navigation-panel";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { APP_NAME } from "../common/constants";
import { useOnFollow } from "../common/hooks/use-on-follow";

const TARGET_MODEL_OPTIONS: MultiselectProps.Option[] = [
  { label: "Claude 3 Haiku",    value: "claude-3-haiku",    iconUrl: "/images/Claude.svg" },
  { label: "Claude Sonnet 4.5",   value: "claude-3-sonnet",   iconUrl: "/images/Claude.svg" },
  { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet", iconUrl: "/images/Claude.svg" },
  { label: "DeepSeek v3.1",     value: "deepseek-v3.1",     iconUrl: "/images/deepseek.svg" },
  { label: "OpenAI gpt-oss 20B",  value: "gpt-oss-20b",  iconUrl: "/images/open-ai.svg" },
  { label: "OpenAI gpt-oss 120B", value: "gpt-oss-120b", iconUrl: "/images/open-ai.svg" },
];

const SERVICE_ROLE_OPTIONS: SelectProps.Option[] = [
  { label: "MyBedrockRole", value: "MyBedrockRole" },
  { label: "AnotherRole", value: "AnotherRole" },
];

const LOG_GROUP_OPTIONS: SelectProps.Option[] = [
  { label: "/aws/bedrock/modelinvocations", value: "/aws/bedrock/modelinvocations" },
  { label: "/aws/bedrock/modellogs", value: "/aws/bedrock/modellogs" },
];

export default function CreateMigrationPage() {
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] = useNavigationPanelState();
  const [targetModels, setTargetModels] = useState<MultiselectProps.Option[]>([TARGET_MODEL_OPTIONS[1]]);
  const [timeRange, setTimeRange] = useState<DateRangePickerProps.Value | null>({ type: "relative", amount: 7, unit: "day", key: "previous-7-days" });
  const [logGroup, setLogGroup] = useState<SelectProps.Option | null>(LOG_GROUP_OPTIONS[0]);
  const [iamRoleOption, setIamRoleOption] = useState<string>("existing");
  const [serviceRole, setServiceRole] = useState<SelectProps.Option | null>(SERVICE_ROLE_OPTIONS[0]);
  const [inputValue, setInputValue] = useState("Sonnet 4.5 migration");
  const [descValue, setDescValue] = useState("");

  return (
    <AppLayoutToolbar
      maxContentWidth = { 1280 }
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
            { text: "Model migration", href: "/" },
            { text: "Start model migration", href: "/create-migration" },
          ]}
        />
      }
      content={
        <form onSubmit={(e) => e.preventDefault()}>
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" href="/" onFollow={onFollow}>
                    Cancel
                  </Button>
                  <Button variant="primary" href="/?state=EVAL_COMPLETE">
                    Start model migration
                  </Button>
                </SpaceBetween>
              }
              header={
                <Header
                  variant="h1"
                  description="Compare your current model with newer versions to find the best fit for your application."
                >
                  Start model migration
                </Header>
              }
            >
              <SpaceBetween size="l">
                <Container header={<Header variant="h2" description="Bedrock uses your invocation logs to compare model performance and guide migration results.">Configure access to invocation logs</Header>}>
                  <SpaceBetween size="l">
                    <FormField
                      label="Time range for analysis"
                      description="Choose the time range of invocation logs to access."
                    >
                      <DateRangePicker
                        onChange={({ detail }) => setTimeRange(detail.value)}
                        value={timeRange}
                        relativeOptions={RELATIVE_OPTIONS}
                        i18nStrings={DATE_RANGE_I18N}
                        placeholder="Choose a time range"
                        isValidRange={() => ({ valid: true })}
                      />
                    </FormField>

                    <FormField
                      label="CloudWatch log group"
                      description="Choose where your model's invocation logs are stored in CloudWatch."
                    >
                      <Select
                        selectedOption={logGroup}
                        onChange={({ detail }) => setLogGroup(detail.selectedOption)}
                        options={LOG_GROUP_OPTIONS}
                      />
                    </FormField>

                    <FormField
                      label="IAM role for log access"
                      description="Choose an existing IAM role or create a new one to let Bedrock access your invocation logs. This access is required to start your migration."
                    >
                      <RadioGroup
                        items={[
                          { label: "Use an existing service role", value: "existing" },
                          { label: "Create and use a new role", value: "new" },
                        ]}
                        value={iamRoleOption}
                        onChange={({ detail }) => setIamRoleOption(detail.value)}
                      />
                    </FormField>

                    <FormField label="Service role">
                      <Select
                        selectedOption={serviceRole}
                        onChange={({ detail }) => setServiceRole(detail.selectedOption)}
                        options={SERVICE_ROLE_OPTIONS}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>

                <Container 
                  header={ <Header variant="h2">Configure migration details</Header>}                   
                  footer={
                    <ExpandableSection
                      header="Additional details"
                      variant="footer"
                    >
                      <FormField
                        label={
                        <span>
                          Description <i>- optional</i>{" "}
                        </span>
                      }

                        constraintText="You can enter up to 2048 characters."
                      >
                        <Textarea
                          placeholder="Enter a description for this migration job"
                          value={descValue}
                          onChange={e =>
                            setDescValue(e.detail.value)
                          }
                        />
                      </FormField>
                    </ExpandableSection>
                  }>
                  <SpaceBetween size="l">
                    <Alert type="info">
                      <strong>Source models</strong> will be automatically detected from your invocation logs.
                    </Alert>
                    <FormField
                        label="Job name"
                        description="Enter a unique name for this migration job."
                        constraintText="Names can contain letters (A-Z), numbers (0-9), hyphens (-), or underscores (_), and must be less than 256 characters long."
                      >
                        <Input
                          value={inputValue}
                          onChange={e =>
                            setInputValue(e.detail.value)
                          }
                        />
                      </FormField>
                    <FormField
                      label="Target foundation models"
                      description="Select one or more models to evaluate as replacements for your current model."
                    >
                      <Multiselect
                        selectedOptions={targetModels}
                        onChange={({ detail }) => setTargetModels([...detail.selectedOptions])}
                        options={TARGET_MODEL_OPTIONS}
                        placeholder="Choose target models"
                        filteringType="auto"
                        keepOpen={false}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Form>
          </form>
        }
    />
  );
}

