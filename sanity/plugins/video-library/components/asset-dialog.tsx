import { Button, Dialog, Flex } from "@sanity/ui";
import { useState } from "react";

import type { VideoLibraryConfig } from "../config";
import type { AssetDeletion } from "../hooks/use-asset-deletion";
import type { VideoAssetListItem } from "../queries";
import { AssetDetails } from "./asset-details";

interface AssetDialogProps {
  asset: VideoAssetListItem;
  config: VideoLibraryConfig;
  deletion: AssetDeletion;
  onClose: () => void;
}

/**
 * Editing happens in a dialog, as in sanity-plugin-media's DialogAssetEdit,
 * rather than in a persistent sidebar: the grid keeps its full width and the
 * side panels stay reserved for folders and tags.
 *
 * Their footer offers Delete and "Save and close". Ours says Close, because
 * edits are already committed as you type — there is nothing left to save.
 */
export function AssetDialog({
  asset,
  config,
  deletion,
  onClose,
}: AssetDialogProps) {
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    const done = await deletion.remove([asset]);
    if (done) {
      onClose();
    }
  }

  return (
    <Dialog
      animate
      id="video-library-asset"
      header="Video details"
      // Their DialogAssetEdit uses width={3} too. It reads as full-width
      // because both of its columns are flex={1}, not because the dialog is.
      width={3}
      zOffset={1000}
      // Their own wrapper forces fixed positioning, to stop mobile browsers
      // scrolling the dialog with the page behind it.
      style={{ position: "fixed" }}
      onClose={deletion.deleting ? undefined : onClose}
      onClickOutside={deletion.deleting ? undefined : onClose}
      footer={
        <Flex align="center" justify="space-between" padding={3} gap={2}>
          <Button
            text={
              deletion.deleting
                ? "Deleting…"
                : confirming
                  ? "Confirm delete"
                  : "Delete"
            }
            tone="critical"
            mode={confirming ? "default" : "bleed"}
            fontSize={1}
            disabled={deletion.deleting}
            onClick={() => (confirming ? void remove() : setConfirming(true))}
          />

          <Button
            text="Close"
            mode="ghost"
            fontSize={1}
            disabled={deletion.deleting}
            onClick={onClose}
          />
        </Flex>
      }
    >
      {/* No padding here: each column carries its own, as in theirs. */}
      <AssetDetails asset={asset} config={config} />
    </Dialog>
  );
}
