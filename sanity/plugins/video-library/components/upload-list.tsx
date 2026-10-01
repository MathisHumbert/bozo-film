import { CloseIcon } from "@sanity/icons/Close";
import { Box, Button, Card, Flex, Stack, Text } from "@sanity/ui";

import { formatBytes } from "../format";
import type { UploadItem, UploadQueue } from "../hooks/use-upload-queue";

const PHASE_LABELS: Record<UploadItem["phase"], string> = {
  queued: "Waiting",
  analysing: "Reading frames",
  uploading: "Uploading",
  finalising: "Saving",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

const ACTIVE: UploadItem["phase"][] = [
  "queued",
  "analysing",
  "uploading",
  "finalising",
];

export function UploadList({ queue }: { queue: UploadQueue }) {
  if (queue.items.length === 0) {
    return null;
  }

  return (
    <Stack gap={2}>
      {queue.items.map((item) => (
        <UploadRow key={item.id} item={item} onCancel={queue.cancel} />
      ))}

      {!queue.isUploading ? (
        <Flex justify="flex-end">
          <Button
            text="Clear"
            mode="bleed"
            fontSize={1}
            onClick={queue.clearFinished}
          />
        </Flex>
      ) : null}
    </Stack>
  );
}

function UploadRow({
  item,
  onCancel,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
}) {
  const tone =
    item.phase === "failed"
      ? "critical"
      : item.phase === "done"
        ? "positive"
        : "transparent";

  return (
    <Card padding={3} radius={2} tone={tone}>
      <Stack gap={3}>
        <Flex align="center" gap={3}>
          <Stack gap={2} flex={1}>
            <Text size={1} weight="medium" textOverflow="ellipsis">
              {item.file.name}
            </Text>
            <Text size={0} muted>
              {PHASE_LABELS[item.phase]} · {formatBytes(item.file.size)}
              {item.error ? ` · ${item.error}` : ""}
            </Text>
          </Stack>

          {ACTIVE.includes(item.phase) ? (
            <Button
              icon={CloseIcon}
              mode="bleed"
              fontSize={1}
              padding={2}
              title="Cancel"
              onClick={() => onCancel(item.id)}
            />
          ) : null}
        </Flex>

        {item.phase === "uploading" ? (
          <ProgressBar ratio={item.progress} />
        ) : null}
      </Stack>
    </Card>
  );
}

/**
 * Built from theme tokens rather than hard-coded colours, so the bar follows
 * the Studio's light and dark schemes.
 */
function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <Card
      radius={1}
      tone="transparent"
      style={{ height: 4, overflow: "hidden" }}
    >
      <Box
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: "100%",
          background: "var(--card-focus-ring-color)",
          transition: "width 120ms linear",
        }}
      />
    </Card>
  );
}
