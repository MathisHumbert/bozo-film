import { ClipboardIcon } from "@sanity/icons/Clipboard";
import { DownloadIcon } from "@sanity/icons/Download";
import {
  Box,
  Button,
  Card,
  Flex,
  Inline,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@sanity/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { playbackUrl, type VideoLibraryConfig } from "../config";
import { formatBytes, formatDimensions, formatDuration } from "../format";
import { useAssetEditor, type SaveStatus } from "../hooks/use-asset-editor";
import type { VideoAssetListItem } from "../queries";

/**
 * Two columns, as in sanity-plugin-media's DialogAssetEdit (MIT, © Sanity.io):
 * the form on the left, the preview with its technical readout and actions on
 * the right.
 */

interface AssetDetailsProps {
  asset: VideoAssetListItem;
  config: VideoLibraryConfig;
}

export function AssetDetails({ asset, config }: AssetDetailsProps) {
  const editor = useAssetEditor(asset, config);
  const src = playbackUrl(config, asset.storageKey);

  return (
    // row-reverse with two equal columns, exactly as theirs: the form is first
    // in the DOM but renders on the right, the preview on the left. Stacked
    // the other way round on narrow screens.
    <Flex
      direction={["column-reverse", "column-reverse", "row-reverse"]}
      align="flex-start"
    >
      <Box flex={1} padding={4} marginTop={[5, 5, 0]} style={{ minWidth: 0 }}>
        <Stack gap={4}>
          <Field label="Filename">
            <TextInput fontSize={1} value={asset.filename ?? ""} readOnly />
          </Field>

          <Field label="Title" status={editor.status}>
            <TextInput
              fontSize={1}
              value={editor.values.title}
              onChange={(event) =>
                editor.setValue("title", event.currentTarget.value)
              }
            />
          </Field>

          <Field label="Alt text">
            <TextInput
              fontSize={1}
              value={editor.values.altText}
              onChange={(event) =>
                editor.setValue("altText", event.currentTarget.value)
              }
            />
          </Field>

          <Field label="Tags" hint="Separated by commas">
            <TextInput
              fontSize={1}
              value={editor.values.tags}
              onChange={(event) =>
                editor.setValue("tags", event.currentTarget.value)
              }
            />
          </Field>

          <Field label="Description">
            <TextArea
              fontSize={1}
              rows={5}
              value={editor.values.description}
              onChange={(event) =>
                editor.setValue("description", event.currentTarget.value)
              }
            />
          </Field>

          {editor.error ? (
            <Card padding={3} radius={2} tone="critical">
              <Text size={1}>{editor.error}</Text>
            </Card>
          ) : null}
        </Stack>
      </Box>

      <Box flex={1} padding={4} style={{ minWidth: 0 }}>
        <Stack gap={4}>
          <Player src={src} poster={asset.thumbnailUrl} />

          <Stack gap={3}>
            <Detail label="Size" value={formatBytes(asset.size)} />
            <Detail label="Format" value={asset.contentType ?? "—"} />
            <Detail label="Duration" value={formatDuration(asset.duration)} />
            <Detail
              label="Dimensions"
              value={formatDimensions(asset.width, asset.height)}
            />
            <Detail
              label="Aspect ratio"
              value={asset.aspectRatio ? String(asset.aspectRatio) : "—"}
            />
            <Detail label="Uploaded" value={formatDate(asset.uploadedAt)} />
            <Detail label="Uploaded by" value={asset.uploadedBy ?? "—"} />
          </Stack>

          {src ? (
            <Inline gap={2}>
              <Button
                as="a"
                icon={DownloadIcon}
                text="Download"
                mode="bleed"
                fontSize={1}
                href={src}
                download={asset.filename ?? undefined}
              />
              <CopyUrlButton url={src} />
            </Inline>
          ) : null}
        </Stack>
      </Box>
    </Flex>
  );
}

function Player({ src, poster }: { src: string; poster: string | null }) {
  if (!src) {
    return (
      <Card padding={3} radius={2} tone="caution">
        <Text size={1}>
          No CDN origin configured, so this video cannot be played. Pass
          `cdnUrl` to the videoLibrary plugin.
        </Text>
      </Card>
    );
  }

  return (
    <Card radius={2} tone="transparent" style={{ overflow: "hidden" }}>
      <video
        // `key` forces a fresh element when the selection changes; without it
        // the player keeps the previous video's buffered state.
        key={src}
        src={src}
        poster={poster ?? undefined}
        controls
        preload="metadata"
        playsInline
        style={{ width: "100%", display: "block", aspectRatio: "16 / 9" }}
      />
    </Card>
  );
}

/** Their readout: label at 40% width, value right-aligned and dimmer. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Flex gap={2}>
      <Text size={1} style={{ opacity: 0.8, width: "40%" }}>
        {label}
      </Text>
      <Text
        size={1}
        textOverflow="ellipsis"
        style={{ opacity: 0.4, textAlign: "right", width: "60%" }}
      >
        {value}
      </Text>
    </Flex>
  );
}

function Field({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: SaveStatus;
  children: ReactNode;
}) {
  return (
    <Stack gap={3}>
      <Flex align="center" gap={2}>
        <Text size={1} weight="medium">
          {label}
        </Text>
        {hint ? (
          <Text size={0} muted>
            · {hint}
          </Text>
        ) : null}
        {status && status !== "idle" ? (
          <Box flex={1}>
            <Text size={0} muted align="right">
              {status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved"
                  : ""}
            </Text>
          </Box>
        ) : null}
      </Flex>
      {children}
    </Stack>
  );
}

/** Feedback in the button itself rather than a toast: fewer moving parts. */
function CopyUrlButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button
      icon={ClipboardIcon}
      text={
        state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Could not copy"
            : "Copy URL"
      }
      tone={state === "failed" ? "critical" : "default"}
      mode="bleed"
      fontSize={1}
      onClick={() => void copy()}
    />
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
