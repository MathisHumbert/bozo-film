import { VideoIcon } from "@sanity/icons/Video";
import { Box, Checkbox, Flex, Text } from "@sanity/ui";
import type { MouseEvent } from "react";
import { css, styled } from "styled-components";

import { PANEL_HEIGHT } from "../constants";
import { formatDuration } from "../format";
import type { VideoAssetListItem } from "../queries";
import { HoverScrub } from "./hover-scrub";

/**
 * Card layout mirrored from sanity-plugin-media's CardAsset (MIT, © Sanity.io).
 *
 * The part worth keeping is the split click target: the preview opens the
 * asset, the footer strip toggles the selection. It means picking several
 * assets never opens anything, and opening one never disturbs a selection.
 */

const CardWrapper = styled(Flex)`
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  position: relative;
  width: 100%;
`;

const CardContainer = styled(Flex)<{ $picked: boolean; $focused: boolean }>(
  ({ $picked, $focused }) => css`
    border: 1px solid
      ${
        $picked
          ? "var(--video-library-picked-color)"
          : $focused
            ? "var(--card-focus-ring-color)"
            : "transparent"
      };
    height: 100%;
    position: relative;
    transition: all 300ms;
    user-select: none;
    width: 100%;

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        border-color: ${
          $picked
            ? "var(--video-library-picked-color)"
            : "var(--card-border-color)"
        };
      }
    }
  `,
);

const FooterStrip = styled(Flex)`
  cursor: pointer;
  height: ${PANEL_HEIGHT}px;
  transition: all 300ms;

  /* A neutral translucent wash reads correctly in both colour schemes,
     which a fixed hue would not. */
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: rgba(127, 127, 127, 0.12);
    }
  }
`;

interface AssetCardProps {
  asset: VideoAssetListItem;
  focused: boolean;
  checked: boolean;
  onFocus: (id: string) => void;
  onCheck: (id: string, extend: boolean) => void;
}

export function AssetCard({
  asset,
  focused,
  checked,
  onFocus,
  onCheck,
}: AssetCardProps) {
  function onPreviewClick(event: MouseEvent) {
    event.stopPropagation();

    // Modifier-click on the preview still means "pick", as in every file
    // browser, so the footer is a convenience rather than the only way.
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      onCheck(asset._id, event.shiftKey);
      return;
    }

    onFocus(asset._id);
  }

  return (
    <CardWrapper padding={1}>
      <CardContainer direction="column" $picked={checked} $focused={focused}>
        <Box
          flex={1}
          style={{ cursor: "pointer", position: "relative" }}
          onClick={onPreviewClick}
        >
          {asset.thumbnailUrl ? (
            <HoverScrub
              posterUrl={asset.thumbnailUrl}
              storyboardUrl={asset.storyboardUrl}
              columns={asset.storyboardColumns}
              rows={asset.storyboardRows}
            >
              {asset.duration ? (
                <DurationBadge seconds={asset.duration} />
              ) : null}
            </HoverScrub>
          ) : (
            <Placeholder />
          )}
        </Box>

        <FooterStrip
          align="center"
          paddingX={1}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            onCheck(asset._id, event.shiftKey);
          }}
        >
          <Checkbox
            checked={checked}
            readOnly
            style={{
              flexShrink: 0,
              // The strip owns the click; a readOnly Checkbox is rendered
              // DOM-disabled by @sanity/ui and would swallow it otherwise.
              pointerEvents: "none",
              transform: "scale(0.8)",
            }}
          />

          <Box marginLeft={2} style={{ minWidth: 0 }}>
            <Text muted size={0} textOverflow="ellipsis">
              {asset.title || asset.filename || "Untitled video"}
            </Text>
          </Box>
        </FooterStrip>
      </CardContainer>
    </CardWrapper>
  );
}

function Placeholder() {
  return (
    <Flex align="center" justify="center" style={{ aspectRatio: "16 / 9" }}>
      <Text size={3} muted>
        <VideoIcon />
      </Text>
    </Flex>
  );
}

/**
 * Sits on top of a photograph rather than on a themed surface, so a fixed
 * translucent black is the right call here — a theme token would be unreadable
 * over half the posters.
 */
function DurationBadge({ seconds }: { seconds: number }) {
  return (
    <Box
      style={{
        position: "absolute",
        right: 6,
        bottom: 6,
        padding: "2px 6px",
        borderRadius: 3,
        background: "rgba(0, 0, 0, 0.72)",
        color: "#fff",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      {formatDuration(seconds)}
    </Box>
  );
}
