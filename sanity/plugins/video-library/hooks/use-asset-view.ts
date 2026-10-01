import { useMemo, useState } from "react";

import type { VideoAssetListItem } from "../queries";

export type SortKey =
  | "newest"
  | "oldest"
  | "titleAsc"
  | "titleDesc"
  | "largest"
  | "smallest"
  | "longest";

export type ViewMode = "grid" | "list";

export type Filter =
  { kind: "all" } | { kind: "recent" } | { kind: "tag"; tag: string };

/** What "Recently uploaded" covers. */
export const RECENT_DAYS = 7;

/**
 * Labelled the way sanity-plugin-media labels them: the field first, then the
 * direction. "Newest first" alone never says newest what.
 *
 * A null value renders as a divider.
 */
export const SORT_OPTIONS: ({ value: SortKey; label: string } | null)[] = [
  { value: "newest", label: "Last created: Newest first" },
  { value: "oldest", label: "Last created: Oldest first" },
  null,
  { value: "titleAsc", label: "Title: A to Z" },
  { value: "titleDesc", label: "Title: Z to A" },
  null,
  { value: "largest", label: "File size: Largest first" },
  { value: "smallest", label: "File size: Smallest first" },
  null,
  { value: "longest", label: "Duration: Longest first" },
];

export function sortLabel(key: SortKey): string {
  return (
    SORT_OPTIONS.find((option) => option?.value === key)?.label ?? "Sort by"
  );
}

const VIEW_STORAGE_KEY = "video-library:view";

export interface AssetView {
  query: string;
  setQuery: (value: string) => void;
  sort: SortKey;
  setSort: (value: SortKey) => void;
  view: ViewMode;
  setView: (value: ViewMode) => void;
  filter: Filter;
  setFilter: (value: Filter) => void;
  visible: VideoAssetListItem[];
  /** Assets in the current filter, before the search box narrows them. */
  scopeTotal: number;
  total: number;
}

/**
 * Search, sort and layout state for the asset list.
 *
 * Everything happens client-side on purpose: a library of a few hundred assets
 * fits in memory, and filtering locally keeps typing instant instead of going
 * back to the Content Lake on every keystroke.
 */
export function useAssetView(assets: VideoAssetListItem[] | null): AssetView {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });

  const scoped = useMemo(
    () => (assets ?? []).filter((asset) => inScope(asset, filter)),
    [assets, filter],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matching = needle
      ? scoped.filter((asset) => matches(asset, needle))
      : scoped.slice();

    return matching.sort(comparators[sort]);
  }, [scoped, query, sort]);

  return {
    query,
    setQuery,
    sort,
    setSort,
    view,
    setView: (value) => {
      setView(value);
      storeView(value);
    },
    filter,
    setFilter,
    visible,
    scopeTotal: scoped.length,
    total: assets?.length ?? 0,
  };
}

function inScope(asset: VideoAssetListItem, filter: Filter): boolean {
  if (filter.kind === "all") {
    return true;
  }

  if (filter.kind === "tag") {
    return (asset.tags ?? []).includes(filter.tag);
  }

  const since = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

  return uploadedAt(asset) >= since;
}

function matches(asset: VideoAssetListItem, needle: string): boolean {
  const haystack = [
    asset.title,
    asset.filename,
    asset.altText,
    ...(asset.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

const comparators: Record<
  SortKey,
  (a: VideoAssetListItem, b: VideoAssetListItem) => number
> = {
  newest: (a, b) => uploadedAt(b) - uploadedAt(a),
  oldest: (a, b) => uploadedAt(a) - uploadedAt(b),
  titleAsc: (a, b) => label(a).localeCompare(label(b)),
  titleDesc: (a, b) => label(b).localeCompare(label(a)),
  largest: (a, b) => (b.size ?? 0) - (a.size ?? 0),
  smallest: (a, b) => (a.size ?? 0) - (b.size ?? 0),
  longest: (a, b) => (b.duration ?? 0) - (a.duration ?? 0),
};

function uploadedAt(asset: VideoAssetListItem): number {
  return asset.uploadedAt ? Date.parse(asset.uploadedAt) : 0;
}

function label(asset: VideoAssetListItem): string {
  return asset.title || asset.filename || "";
}

function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
}

function storeView(value: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, value);
  } catch {
    // Private browsing and blocked storage are not worth failing over.
  }
}
