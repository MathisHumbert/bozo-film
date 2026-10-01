import { TrashIcon } from "@sanity/icons/Trash";
import { Box, Button, Card, Dialog, Flex, Stack, Text } from "@sanity/ui";
import { useState } from "react";

import type { AssetDeletion } from "../hooks/use-asset-deletion";
import type { Selection } from "../hooks/use-selection";
import type { VideoAssetListItem } from "../queries";

interface SelectionBarProps {
  selection: Selection;
  assets: VideoAssetListItem[];
  deletion: AssetDeletion;
}

export function SelectionBar({
  selection,
  assets,
  deletion,
}: SelectionBarProps) {
  const [confirming, setConfirming] = useState(false);

  if (selection.count === 0) {
    return null;
  }

  const selected = assets.filter((asset) => selection.isSelected(asset._id));

  async function confirm() {
    const done = await deletion.remove(selected);

    if (done) {
      setConfirming(false);
      selection.clear();
    }
  }

  return (
    <>
      <Card
        padding={3}
        radius={2}
        shadow={2}
        style={{
          position: "sticky",
          bottom: 0,
          // Above the cards, below the Studio's own layers.
          zIndex: 1,
        }}
      >
        <Flex align="center" gap={3}>
          <Text size={1} weight="medium">
            {selection.count} selected
          </Text>

          <Box flex={1} />

          <Button
            text="Select all"
            mode="bleed"
            fontSize={1}
            onClick={selection.selectAll}
          />
          <Button
            text="Clear"
            mode="bleed"
            fontSize={1}
            onClick={selection.clear}
          />
          <Button
            icon={TrashIcon}
            text="Delete"
            tone="critical"
            mode="ghost"
            fontSize={1}
            onClick={() => setConfirming(true)}
          />
        </Flex>
      </Card>

      {confirming ? (
        <Dialog
          id="video-library-confirm-delete"
          header={`Delete ${selection.count} video${selection.count === 1 ? "" : "s"}?`}
          width={1}
          zOffset={1000}
          onClose={deletion.deleting ? undefined : () => setConfirming(false)}
          footer={
            <Flex gap={2} justify="flex-end" padding={3}>
              <Button
                text="Cancel"
                mode="bleed"
                disabled={deletion.deleting}
                onClick={() => setConfirming(false)}
              />
              <Button
                text={deletion.deleting ? "Deleting…" : "Delete"}
                tone="critical"
                disabled={deletion.deleting}
                onClick={() => void confirm()}
              />
            </Flex>
          }
        >
          <Box padding={4}>
            <Stack gap={3}>
              <Text size={1}>
                The files are removed from storage as well. This cannot be
                undone.
              </Text>

              <Stack gap={2}>
                {selected.slice(0, 8).map((asset) => (
                  <Text key={asset._id} size={1} muted textOverflow="ellipsis">
                    {asset.title || asset.filename || asset._id}
                  </Text>
                ))}
                {selected.length > 8 ? (
                  <Text size={1} muted>
                    and {selected.length - 8} more
                  </Text>
                ) : null}
              </Stack>

              {deletion.error ? (
                <Card padding={3} radius={2} tone="critical">
                  <Text size={1}>{deletion.error}</Text>
                </Card>
              ) : null}
            </Stack>
          </Box>
        </Dialog>
      ) : null}
    </>
  );
}
