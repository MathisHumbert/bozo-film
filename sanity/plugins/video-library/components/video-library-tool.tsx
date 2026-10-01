import { Box, Card, Flex, Spinner, Stack, Text } from "@sanity/ui";
import { useMemo, useState } from "react";
import type { Tool } from "sanity";

import { defaultConfig, type VideoLibraryConfig } from "../config";
import { useAssetDeletion } from "../hooks/use-asset-deletion";
import { useAssetView } from "../hooks/use-asset-view";
import { usePickedColor } from "../hooks/use-picked-color";
import { useSelection } from "../hooks/use-selection";
import { useUploadQueue } from "../hooks/use-upload-queue";
import { useVideoAssets } from "../hooks/use-video-assets";
import { AssetDialog } from "./asset-dialog";
import { AssetGrid } from "./asset-grid";
import { DropZone } from "./drop-zone";
import { FoldersPanel } from "./folders-panel";
import { LibraryHeader } from "./library-header";
import { SelectionBar } from "./selection-bar";
import { TagsPanel } from "./tags-panel";
import { UploadList } from "./upload-list";

interface VideoLibraryToolProps {
  tool: Tool<VideoLibraryConfig>;
}

export function VideoLibraryTool({ tool }: VideoLibraryToolProps) {
  // Sanity types a tool's options as optional, though the plugin always sets
  // them. Falling back keeps the component usable on its own in a test.
  const config = tool.options ?? defaultConfig;

  const { assets, error, refresh } = useVideoAssets(config);
  const queue = useUploadQueue(config, refresh);
  const view = useAssetView(assets);
  const pickedColor = usePickedColor();

  const [openId, setOpenId] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);

  const visibleIds = useMemo(
    () => view.visible.map((asset) => asset._id),
    [view.visible],
  );

  const selection = useSelection(visibleIds);
  const deletion = useAssetDeletion(config, refresh);

  // Resolved from the live list rather than held in state, so an edit made
  // elsewhere reaches the dialog instead of leaving a stale copy on screen.
  const open = useMemo(
    () => assets?.find((asset) => asset._id === openId) ?? null,
    [assets, openId],
  );

  return (
    <Flex
      direction="column"
      height="fill"
      // Published once here so every card and row can reference it in CSS,
      // instead of threading the colour through the component tree.
      style={
        { "--video-library-picked-color": pickedColor } as React.CSSProperties
      }
    >
      <LibraryHeader
        view={view}
        accept={config.acceptedTypes}
        onFiles={queue.enqueue}
        uploadDisabled={!queue.ready}
        foldersOpen={foldersOpen}
        onToggleFolders={() => setFoldersOpen((value) => !value)}
        tagsOpen={tagsOpen}
        onToggleTags={() => setTagsOpen((value) => !value)}
      />

      <Flex flex={1} overflow="hidden">
        {foldersOpen ? (
          <FoldersPanel view={view} assets={assets ?? []} />
        ) : null}

        <Box flex={1} overflow="auto">
          <DropZone onFiles={queue.enqueue} disabled={!queue.ready}>
            <Box padding={2}>
              <Stack gap={3}>
                {!queue.ready ? <TokenWarning /> : null}

                {error ? (
                  <Card padding={4} radius={2} tone="critical">
                    <Text size={1}>{error}</Text>
                  </Card>
                ) : assets === null ? (
                  <Flex align="center" justify="center" padding={5}>
                    <Spinner muted />
                  </Flex>
                ) : (
                  <>
                    <UploadList queue={queue} />

                    <AssetGrid
                      view={view}
                      selection={selection}
                      focusedId={openId}
                      onFocus={setOpenId}
                    />

                    <SelectionBar
                      selection={selection}
                      assets={view.visible}
                      deletion={deletion}
                    />
                  </>
                )}
              </Stack>
            </Box>
          </DropZone>
        </Box>

        {tagsOpen ? <TagsPanel view={view} assets={assets ?? []} /> : null}
      </Flex>

      {open ? (
        <AssetDialog
          // Remounting on selection resets the form state, which is what keeps
          // one asset's pending edits from bleeding into another.
          key={open._id}
          asset={open}
          config={config}
          deletion={deletion}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </Flex>
  );
}

function TokenWarning() {
  return (
    <Card padding={4} radius={2} tone="caution">
      <Stack gap={3}>
        <Text size={1} weight="medium">
          Uploads cannot be authorised
        </Text>
        <Text size={1}>
          No Sanity session token was found. Signing out and back in usually
          fixes it. If this Studio authenticates with cookies, there is no token
          to send and the media API needs a different guard.
        </Text>
      </Stack>
    </Card>
  );
}
