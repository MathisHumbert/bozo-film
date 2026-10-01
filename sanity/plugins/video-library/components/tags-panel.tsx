import { Card, Flex, Stack, Text } from "@sanity/ui";
import { useMemo } from "react";

import { TAGS_PANEL_WIDTH } from "../constants";
import type { AssetView, Filter } from "../hooks/use-asset-view";
import type { VideoAssetListItem } from "../queries";
import { SidePanel } from "./side-panel";

interface TagsPanelProps {
  view: AssetView;
  assets: VideoAssetListItem[];
}

export function TagsPanel({ view, assets }: TagsPanelProps) {
  // Counted from the documents on each render: on a few hundred assets that
  // is cheaper than any bookkeeping would be.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();

    for (const asset of assets) {
      for (const tag of asset.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assets]);

  return (
    <SidePanel title="Tags" width={TAGS_PANEL_WIDTH} side="right">
      {tags.length === 0 ? (
        <Text size={1} muted>
          <em>No tags</em>
        </Text>
      ) : (
        <Stack gap={1}>
          {tags.map(([tag, count]) => (
            <TagRow
              key={tag}
              tag={tag}
              count={count}
              active={view.filter.kind === "tag" && view.filter.tag === tag}
              onClick={() => view.setFilter(toggleTag(view.filter, tag))}
            />
          ))}
        </Stack>
      )}
    </SidePanel>
  );
}

/** Clicking the active tag clears it, so the filter is its own off switch. */
function toggleTag(current: Filter, tag: string): Filter {
  return current.kind === "tag" && current.tag === tag
    ? { kind: "all" }
    : { kind: "tag", tag };
}

function TagRow({
  tag,
  count,
  active,
  onClick,
}: {
  tag: string;
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
        <Text size={1} textOverflow="ellipsis" style={{ flex: 1, minWidth: 0 }}>
          {tag}
        </Text>
        <Text size={0} muted>
          {count}
        </Text>
      </Flex>
    </Card>
  );
}
