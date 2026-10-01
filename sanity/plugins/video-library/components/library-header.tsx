import { FolderIcon } from "@sanity/icons/Folder";
import { SearchIcon } from "@sanity/icons/Search";
import { SortIcon } from "@sanity/icons/Sort";
import { TagIcon } from "@sanity/icons/Tag";
import { ThLargeIcon } from "@sanity/icons/ThLarge";
import { ThListIcon } from "@sanity/icons/ThList";
import { UploadIcon } from "@sanity/icons/Upload";
import { Box, Button, Flex, Inline, Text, TextInput } from "@sanity/ui";
// @sanity/ui v4 splits these into a subpath. The root type declarations still
// re-export them, so importing from "@sanity/ui" typechecks and then fails at
// runtime with "does not provide an export named 'Menu'".
import { Menu, MenuButton, MenuDivider, MenuItem } from "@sanity/ui/menu";
import { useRef } from "react";

import {
  SORT_OPTIONS,
  sortLabel,
  type AssetView,
} from "../hooks/use-asset-view";

/**
 * Header mirrored from sanity-plugin-media's Browser (MIT, © Sanity.io):
 * a title row, a bordered controls row, then a row with the view switch on
 * the left and ordering on the right.
 */

interface LibraryHeaderProps {
  view: AssetView;
  accept: string[];
  onFiles: (files: File[]) => void;
  uploadDisabled: boolean;
  foldersOpen: boolean;
  onToggleFolders: () => void;
  tagsOpen: boolean;
  onToggleTags: () => void;
}

export function LibraryHeader({
  view,
  accept,
  onFiles,
  uploadDisabled,
  foldersOpen,
  onToggleFolders,
  tagsOpen,
  onToggleTags,
}: LibraryHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box>
      <Box padding={2}>
        <Flex align="center" justify="space-between">
          <Box paddingX={2}>
            <Text weight="medium">Browse videos</Text>
          </Box>

          {/* Ghost, like their "Upload assets": it shares a button class with
              the sort menu in the rendered Studio. */}
          <Button
            icon={UploadIcon}
            text="Upload videos"
            mode="ghost"
            fontSize={1}
            padding={3}
            disabled={uploadDisabled}
            onClick={() => inputRef.current?.click()}
          />
        </Flex>
      </Box>

      <Box
        padding={2}
        style={{
          borderBottom: "1px solid var(--card-border-color)",
          zIndex: 2,
        }}
      >
        <Flex align="center" gap={2}>
          <Box style={{ minWidth: 200 }}>
            <TextInput
              icon={SearchIcon}
              placeholder="Search"
              fontSize={1}
              value={view.query}
              clearButton={view.query.length > 0}
              onChange={(event) => view.setQuery(event.currentTarget.value)}
              onClear={() => view.setQuery("")}
            />
          </Box>
        </Flex>
      </Box>

      <Box padding={2}>
        <Flex align="center" justify="space-between">
          <Inline gap={2}>
            <Button
              icon={FolderIcon}
              mode={foldersOpen ? "default" : "bleed"}
              fontSize={1}
              padding={3}
              aria-label="Toggle folders panel"
              aria-pressed={foldersOpen}
              onClick={onToggleFolders}
            />

            {/* Joined radii, as in their view switch. */}
            <Inline>
              <Button
                icon={ThLargeIcon}
                mode={view.view === "grid" ? "default" : "bleed"}
                fontSize={1}
                padding={3}
                aria-pressed={view.view === "grid"}
                style={{
                  borderBottomRightRadius: 0,
                  borderTopRightRadius: 0,
                }}
                onClick={() => view.setView("grid")}
              />
              <Button
                icon={ThListIcon}
                mode={view.view === "list" ? "default" : "bleed"}
                fontSize={1}
                padding={3}
                aria-pressed={view.view === "list"}
                style={{
                  borderBottomLeftRadius: 0,
                  borderTopLeftRadius: 0,
                }}
                onClick={() => view.setView("list")}
              />
            </Inline>
          </Inline>

          <Flex align="center" gap={2}>
            <MenuButton
              id="video-library-order"
              button={
                <Button
                  icon={SortIcon}
                  text={sortLabel(view.sort)}
                  mode="ghost"
                  fontSize={1}
                  padding={3}
                />
              }
              menu={
                <Menu>
                  {SORT_OPTIONS.map((option, index) =>
                    option ? (
                      <MenuItem
                        key={option.value}
                        text={option.label}
                        fontSize={1}
                        disabled={option.value === view.sort}
                        onClick={() => view.setSort(option.value)}
                      />
                    ) : (
                      <MenuDivider key={`divider-${index}`} />
                    ),
                  )}
                </Menu>
              }
              popover={{ placement: "bottom-end", portal: true }}
            />

            <Button
              icon={TagIcon}
              text="Tags"
              mode={tagsOpen ? "default" : "bleed"}
              fontSize={1}
              padding={3}
              aria-pressed={tagsOpen}
              onClick={onToggleTags}
            />
          </Flex>
        </Flex>
      </Box>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept.join(",")}
        hidden
        onChange={(event) => {
          onFiles(Array.from(event.currentTarget.files ?? []));
          // Reset, or picking the same file twice in a row does nothing.
          event.currentTarget.value = "";
        }}
      />
    </Box>
  );
}
