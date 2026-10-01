import { VideoIcon } from "@sanity/icons/Video";
import { Box, Card, Stack, Text } from "@sanity/ui";

import type { AssetView } from "../hooks/use-asset-view";
import type { Selection } from "../hooks/use-selection";
import { AssetCard } from "./asset-card";
import { AssetTable } from "./asset-table";

interface AssetGridProps {
  view: AssetView;
  selection: Selection;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

export function AssetGrid({
  view,
  selection,
  focusedId,
  onFocus,
}: AssetGridProps) {
  if (view.total === 0) {
    return <EmptyLibrary />;
  }
  if (view.visible.length === 0) {
    return <NoMatches query={view.query} />;
  }

  if (view.view === "list") {
    return (
      <AssetTable
        assets={view.visible}
        selection={selection}
        focusedId={focusedId}
        onFocus={onFocus}
      />
    );
  }

  return (
    <Box
      style={{
        display: "grid",
        // auto-fill rather than a fixed column count, so the grid reflows on
        // its own as the side panels open and close.
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 8,
      }}
    >
      {view.visible.map((asset) => (
        <AssetCard
          key={asset._id}
          asset={asset}
          focused={asset._id === focusedId}
          checked={selection.isSelected(asset._id)}
          onFocus={onFocus}
          onCheck={selection.toggle}
        />
      ))}
    </Box>
  );
}

function EmptyLibrary() {
  return (
    <Card padding={5} radius={2} tone="transparent">
      <Stack gap={3}>
        <Text align="center" size={4} muted>
          <VideoIcon />
        </Text>
        <Text align="center" size={1} weight="medium">
          No videos yet
        </Text>
        <Text align="center" size={1} muted>
          Drop a file above to add the first one.
        </Text>
      </Stack>
    </Card>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <Card padding={5} radius={2} tone="transparent">
      <Text align="center" size={1} muted>
        Nothing matches “{query}”.
      </Text>
    </Card>
  );
}
