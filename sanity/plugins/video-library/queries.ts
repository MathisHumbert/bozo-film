export interface VideoAssetListItem {
  _id: string;
  title: string | null;
  description: string | null;
  altText: string | null;
  filename: string | null;
  storageKey: string | null;
  contentType: string | null;
  size: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  tags: string[] | null;
  thumbnailUrl: string | null;
  thumbnailAssetId: string | null;
  storyboardUrl: string | null;
  storyboardAssetId: string | null;
  storyboardColumns: number | null;
  storyboardRows: number | null;
}

const projection = /* groq */ `{
  _id,
  title,
  description,
  altText,
  filename,
  storageKey,
  contentType,
  size,
  duration,
  width,
  height,
  aspectRatio,
  uploadedAt,
  uploadedBy,
  tags,
  "thumbnailUrl": thumbnail.asset->url,
  "thumbnailAssetId": thumbnail.asset->_id,
  "storyboardUrl": storyboard.asset->url,
  "storyboardAssetId": storyboard.asset->_id,
  storyboardColumns,
  storyboardRows
}`;

/**
 * The library reads documents, never the bucket. That is the whole point of
 * the catalogue: listing objects gives you names and sizes, listing documents
 * gives you titles, posters, tags and usage.
 */
export const videoAssetsQuery = /* groq */ `
  *[_type == "video-asset"] | order(coalesce(uploadedAt, _createdAt) desc) ${projection}
`;

/** One asset, for a field that only needs the video it points at. */
export const videoAssetByIdQuery = /* groq */ `
  *[_type == "video-asset" && _id == $id][0] ${projection}
`;
