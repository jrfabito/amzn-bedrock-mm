import {
  SideNavigation,
  SideNavigationProps,
} from "@cloudscape-design/components";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { useState } from "react";
import { useOnFollow } from "../common/hooks/use-on-follow";
import { APP_NAME } from "../common/constants";
import { useLocation } from "react-router-dom";

export default function NavigationPanel() {
  const location = useLocation();
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();

  const [items] = useState<SideNavigationProps.Item[]>(() => [
    {
      type: "section",
      text: "Discover",
      items: [
        { type: "link", text: "Overview", href: "#" },
        { type: "link", text: "Model catalog", href: "#" },
        { type: "link", text: "API keys", href: "#" },
      ],
    },
    {
      type: "section",
      text: "Test",
      items: [
        { type: "link", text: "Chat / Text playground", href: "#" },
        { type: "link", text: "Image / Video playground", href: "#" },
        { type: "link", text: "Watermark detection", href: "#" },
      ],
    },
    {
      type: "section",
      text: "Infer",
      items: [
        { type: "link", text: "Cross-region inference", href: "#" },
        { type: "link", text: "Batch inference", href: "#" },
        { type: "link", text: "Provisioned Throughput", href: "#" },
        { type: "link", text: "Custom model on-demand", href: "#" },
      ],
    },
    {
      type: "section",
      text: "Tune",
      items: [
        { type: "link", text: "Custom models", href: "#" },
        { type: "link", text: "Prompt router models", href: "#" },
        { type: "link", text: "Imported models", href: "#" },
        { type: "link", text: "Marketplace model deployment", href: "#" },
      ],
    },
    {
      type: "section",
      text: "Build",
      items: [
        { type: "link", text: "Model migration", href: "/" },
        { type: "link", text: "Flows", href: "#" },
        { type: "link", text: "Knowledge Bases", href: "#" },
        { type: "link", text: "Automated Reasoning", href: "#" },
        { type: "link", text: "Guardrails", href: "#" },
        { type: "link", text: "Prompt Management", href: "#" },
        { type: "link", text: "Data Automation", href: "#" },
        { type: "link", text: "AgentCore", href: "#", external: true },
      ],
    },
    {
      type: "section",
      text: "Assess",
      items: [
        { type: "link", text: "Evaluations", href: "#" },
      ],
    },
    {
      type: "section",
      text: "Configure and learn",
      items: [
        { type: "link", text: "Settings", href: "#" },
        { type: "link", text: "Model access", href: "#" },
        { type: "link", text: "User guide", href: "#", external: true },
        { type: "link", text: "Bedrock Service Terms", href: "#", external: true },
      ],
    },
  ]);

  const onChange = ({
    detail,
  }: {
    detail: SideNavigationProps.ChangeDetail;
  }) => {
    const sectionIndex = items.indexOf(detail.item);
    setNavigationPanelState({
      collapsedSections: {
        ...navigationPanelState.collapsedSections,
        [sectionIndex]: !detail.expanded,
      },
    });
  };

  return (
    <SideNavigation
      onFollow={onFollow}
      onChange={onChange}
      header={{ href: "/", text: APP_NAME }}
      activeHref={location.pathname}
      items={items.map((value, idx) => {
        if (value.type === "section") {
          const collapsed =
            navigationPanelState.collapsedSections?.[idx] === true;
          value.defaultExpanded = !collapsed;
        }

        return value;
      })}
    />
  );
}
