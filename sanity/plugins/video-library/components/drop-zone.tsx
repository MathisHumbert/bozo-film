import { UploadIcon } from "@sanity/icons/Upload";
import { Box, Card, Flex, Stack, Text } from "@sanity/ui";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Turns the whole library area into a drop target, with an overlay while a
 * drag is in flight.
 *
 * The counter is not optional: dragenter and dragleave fire again for every
 * child element the pointer crosses, so a plain boolean flickers the overlay
 * off as soon as the cursor moves over a card.
 */
export function DropZone({ onFiles, disabled, children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  function reset() {
    depth.current = 0;
    setDragging(false);
  }

  function hasFiles(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  return (
    <Box
      style={{ position: "relative", minHeight: "100%" }}
      onDragEnter={(event) => {
        if (disabled || !hasFiles(event)) return;

        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!disabled && hasFiles(event)) {
          event.preventDefault();
        }
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        if (disabled) return;

        event.preventDefault();
        reset();
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {children}

      {dragging ? (
        <Card
          tone="primary"
          radius={2}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            border: "2px dashed var(--card-border-color)",
            // The overlay must not eat the drop event meant for the container.
            pointerEvents: "none",
          }}
        >
          <Flex align="center" justify="center" height="fill">
            <Stack gap={3}>
              <Text align="center" size={4} muted>
                <UploadIcon />
              </Text>
              <Text align="center" size={1} weight="medium">
                Drop to upload
              </Text>
            </Stack>
          </Flex>
        </Card>
      ) : null}
    </Box>
  );
}
