import { ClockIcon } from "@sanity/icons/Clock";
import { StackIcon } from "@sanity/icons/Stack";
import { Card, Flex, Stack, Text } from "@sanity/ui";
import { useMemo, type ComponentType } from "react";

import { FOLDERS_PANEL_WIDTH } from "../constants";
import { RECENT_DAYS, type AssetView } from "../hooks/use-asset-view";
import type { VideoAssetListItem } from "../queries";
import { SidePanel } from "./side-panel";

interface FoldersPanelProps {
  view: AssetView;
  assets: VideoAssetListItem[];
}

export function FoldersPanel({ view, assets }: FoldersPanelProps) {
  const recentCount = useMemo(() => {
    const since = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

    return assets.filter(
      (asset) => asset.uploadedAt && Date.parse(asset.uploadedAt) >= since,
    ).length;
  }, [assets]);

  return (
    <SidePanel title="Folders" width={FOLDERS_PANEL_WIDTH} side="left">
      <Stack gap={1}>
        <PanelRow
          icon={StackIcon}
          label="All videos"
          count={assets.length}
          active={view.filter.kind === "all"}
          onClick={() => view.setFilter({ kind: "all" })}
        />
        <PanelRow
          icon={ClockIcon}
          label="Recently uploaded"
          count={recentCount}
          active={view.filter.kind === "recent"}
          onClick={() => view.setFilter({ kind: "recent" })}
        />
      </Stack>

      <Card marginTop={3} padding={2}>
        <Text size={0} muted>
          <em>Folders arrive with the next step.</em>
        </Text>
      </Card>
    </SidePanel>
  );
}

function PanelRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ComponentType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      padding={2}
      radius={2}
      tone={active ? "primary" : "transparent"}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <Flex align="center" gap={2}>
        <Text size={1} muted={!active}>
          <Icon />
        </Text>
        <Text size={1} textOverflow="ellipsis" style={{ flex: 1, minWidth: 0 }}>
          {label}
        </Text>
        <Text size={0} muted>
          {count}
        </Text>
      </Flex>
    </Card>
  );
}
