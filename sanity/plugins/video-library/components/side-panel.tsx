import { Box, Flex, Label } from "@sanity/ui";
import type { ReactNode } from "react";

import { PANEL_HEIGHT } from "../constants";

interface SidePanelProps {
  title: string;
  width: number;
  side: "left" | "right";
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The folders and tags panels from sanity-plugin-media (MIT, © Sanity.io):
 * a fixed-width column with a sticky 32px header carrying a Label and one
 * action button.
 */
export function SidePanel({
  title,
  width,
  side,
  action,
  children,
}: SidePanelProps) {
  return (
    <Box style={{ position: "relative", width, flex: "none" }}>
      <Box
        style={{
          [side === "right" ? "borderLeft" : "borderRight"]:
            "1px solid var(--card-border-color)",
          height: "100%",
          overflowX: "hidden",
          overflowY: "auto",
          position: "absolute",
          top: 0,
          [side]: 0,
          width: "100%",
        }}
      >
        <Flex direction="column" height="fill">
          <Flex
            align="center"
            justify="space-between"
            paddingX={3}
            style={{
              background: "inherit",
              borderBottom: "1px solid var(--card-border-color)",
              flexShrink: 0,
              height: PANEL_HEIGHT,
            }}
          >
            <Label size={0}>{title}</Label>
            {action}
          </Flex>

          <Box padding={2}>{children}</Box>
        </Flex>
      </Box>
    </Box>
  );
}
