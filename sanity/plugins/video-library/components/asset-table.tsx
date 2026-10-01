import { VideoIcon } from "@sanity/icons/Video";
import { Box, Checkbox, Flex, Label, Text, useMediaIndex } from "@sanity/ui";
import type { KeyboardEvent, MouseEvent } from "react";
import { css, styled } from "styled-components";

import {
  GRID_TEMPLATE_COLUMNS,
  NARROW_BELOW,
  PANEL_HEIGHT,
} from "../constants";
import { formatBytes, formatDimensions, formatDuration } from "../format";
import type { Selection } from "../hooks/use-selection";
import type { VideoAssetListItem } from "../queries";

/**
 * Table mirrored from sanity-plugin-media's TableRowAsset (MIT, © Sanity.io):
 * same column tracks, same 100px row, same 32px sticky uppercase header, and
 * the checkbox cell spanning the row as its own click target.
 */

const ROW_HEIGHT = 100;

/**
 * Their thumbnail cell is 100×90, which suits stills of any shape. Ours are
 * always video frames, so the box takes the same 100px track and derives its
 * height from 16/9 — otherwise `object-fit: cover` would crop the sides off
 * every single poster.
 */
const THUMBNAIL_WIDTH = 100;

const RowContainer = styled(Box)<{ $picked: boolean; $focused: boolean }>(
  ({ $picked, $focused }) => css`
    border-bottom: 1px solid var(--card-border-color);
    cursor: pointer;
    height: ${ROW_HEIGHT}px;

    box-shadow: inset 2px 0 0 0
      ${
        $picked
          ? "var(--video-library-picked-color)"
          : $focused
            ? "var(--card-focus-ring-color)"
            : "transparent"
      };

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        background: rgba(127, 127, 127, 0.08);
      }
    }
  `,
);

interface AssetTableProps {
  assets: VideoAssetListItem[];
  selection: Selection;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

export function AssetTable({
  assets,
  selection,
  focusedId,
  onFocus,
}: AssetTableProps) {
  const narrow = useMediaIndex() < NARROW_BELOW;

  const columns = narrow
    ? GRID_TEMPLATE_COLUMNS.SMALL
    : GRID_TEMPLATE_COLUMNS.LARGE;

  const gap = narrow ? 0 : 16;

  const allPicked = assets.length > 0 && selection.count === assets.length;

  return (
    <Box>
      <HeaderRow
        columns={columns}
        gap={gap}
        narrow={narrow}
        allPicked={allPicked}
        onToggleAll={() =>
          allPicked ? selection.clear() : selection.selectAll()
        }
      />

      {assets.map((asset) => (
        <AssetTableRow
          key={asset._id}
          asset={asset}
          columns={columns}
          gap={gap}
          narrow={narrow}
          focused={asset._id === focusedId}
          checked={selection.isSelected(asset._id)}
          onFocus={onFocus}
          onCheck={selection.toggle}
        />
      ))}
    </Box>
  );
}

function HeaderRow({
  columns,
  gap,
  narrow,
  allPicked,
  onToggleAll,
}: {
  columns: string;
  gap: number;
  narrow: boolean;
  allPicked: boolean;
  onToggleAll: () => void;
}) {
  const labels = narrow
    ? ["Title", ""]
    : ["Title", "Resolution", "Duration", "Size", "Uploaded", "Used in", ""];

  return (
    <Box
      style={{
        alignItems: "center",
        background: "var(--card-bg-color)",
        borderBottom: "1px solid var(--card-border-color)",
        columnGap: gap,
        display: "grid",
        gridTemplateColumns: columns,
        height: PANEL_HEIGHT,
        letterSpacing: "0.025em",
        position: "sticky",
        textTransform: "uppercase",
        top: 0,
        width: "100%",
        zIndex: 1,
      }}
    >
      <Flex
        align="center"
        justify="center"
        style={{ height: "100%", cursor: "pointer" }}
        onClick={onToggleAll}
      >
        <Checkbox
          checked={allPicked}
          readOnly
          style={{ pointerEvents: "none", transform: "scale(0.8)" }}
        />
      </Flex>

      {/* Column 2 sits under the thumbnails and stays unlabelled. */}
      <Box />

      {labels.map((label, index) => (
        <Label key={index} size={0} muted={!label}>
          <Box
            style={{
              cursor: "default",
              display: "inline",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ marginRight: "0.4em" }}>{label}</span>
          </Box>
        </Label>
      ))}
    </Box>
  );
}

function AssetTableRow({
  asset,
  columns,
  gap,
  narrow,
  focused,
  checked,
  onFocus,
  onCheck,
}: {
  asset: VideoAssetListItem;
  columns: string;
  gap: number;
  narrow: boolean;
  focused: boolean;
  checked: boolean;
  onFocus: (id: string) => void;
  onCheck: (id: string, extend: boolean) => void;
}) {
  return (
    <RowContainer
      $picked={checked}
      $focused={focused}
      role="button"
      tabIndex={0}
      aria-pressed={focused}
      onClick={(event: MouseEvent) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          onCheck(asset._id, event.shiftKey);
          return;
        }

        onFocus(asset._id);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFocus(asset._id);
        }
      }}
    >
      <Box
        style={{
          // Their grid leaves this out and everything sits at the top. We
          // centre instead, so the metadata lines up with the middle of the
          // thumbnail rather than floating above it.
          alignItems: "center",
          display: "grid",
          gap: `0 ${gap}px`,
          gridTemplateColumns: columns,
          gridTemplateRows: "1fr",
          height: "100%",
        }}
      >
        <Flex
          align="center"
          justify="center"
          style={{ gridArea: "1 / 1 / span 5", height: "100%" }}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            onCheck(asset._id, event.shiftKey);
          }}
        >
          <Checkbox
            checked={checked}
            readOnly
            style={{ pointerEvents: "none", transform: "scale(0.8)" }}
          />
        </Flex>

        <Box
          style={{
            aspectRatio: "16 / 9",
            gridArea: "1 / 2 / span 5",
            width: THUMBNAIL_WIDTH,
          }}
        >
          <Thumbnail url={asset.thumbnailUrl} />
        </Box>

        <Cell column={3}>{asset.title || asset.filename || "Untitled"}</Cell>

        {narrow ? (
          <Box style={{ gridArea: "1 / 4" }} />
        ) : (
          <>
            <Cell column={4}>
              {formatDimensions(asset.width, asset.height)}
            </Cell>
            <Cell column={5}>{formatDuration(asset.duration)}</Cell>
            <Cell column={6}>{formatBytes(asset.size)}</Cell>
            <Cell column={7}>{formatDate(asset.uploadedAt)}</Cell>
            {/* Filled in once the usage check lands. */}
            <Cell column={8}>—</Cell>
            <Box style={{ gridArea: "1 / 9" }} />
          </>
        )}
      </Box>
    </RowContainer>
  );
}

function Cell({
  column,
  children,
}: {
  column: number;
  children: React.ReactNode;
}) {
  return (
    <Box style={{ gridArea: `auto / ${column}`, minWidth: 0 }}>
      <Text size={1} textOverflow="ellipsis" style={{ lineHeight: "2em" }}>
        {children}
      </Text>
    </Box>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  return (
    <Flex
      align="center"
      justify="center"
      style={{ height: "100%", position: "relative", overflow: "hidden" }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Text size={1} muted>
          <VideoIcon />
        </Text>
      )}
    </Flex>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}
