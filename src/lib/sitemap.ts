import {
  ROUTABLE_TYPES,
  absoluteUrl,
  hrefFor,
  isRepeatable,
  type RoutableDocument,
} from "./routes";

export interface SitemapSource {
  site: string;
  projectId?: string;
  dataset?: string;
  apiVersion: string;
}

export interface SitemapPages {
  customPages: string[];
  excluded: Set<string>;
}

interface RoutableRow extends RoutableDocument {
  noIndex?: boolean | null;
}

const QUERY =
  `*[_type in ${JSON.stringify([...ROUTABLE_TYPES])}]` +
  `{ _type, "slug": slug.current, "noIndex": seo.noIndex }`;

export async function sitemapPages(
  source: SitemapSource,
): Promise<SitemapPages> {
  const customPages: string[] = [];
  const excluded = new Set<string>();

  for (const row of await fetchRoutable(source)) {
    const href = hrefFor(row);

    if (!href) continue;

    const url = absoluteUrl(href, source.site);

    if (row.noIndex) {
      excluded.add(url);
      continue;
    }

    if (isRepeatable(row._type)) {
      customPages.push(url);
    }
  }

  return { customPages: customPages.sort(), excluded };
}

async function fetchRoutable(source: SitemapSource): Promise<RoutableRow[]> {
  const { projectId, dataset, apiVersion } = source;

  if (!projectId || !dataset) {
    warn("PUBLIC_SANITY_PROJECT_ID or PUBLIC_SANITY_DATASET is missing");

    return [];
  }

  const url =
    `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/` +
    `${dataset}?query=${encodeURIComponent(QUERY)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const { result } = (await response.json()) as { result?: RoutableRow[] };

    return result ?? [];
  } catch (error) {
    warn(String(error));

    return [];
  }
}

function warn(reason: string): void {
  console.warn(
    `[sitemap] could not list documents, dynamic routes will be missing and ` +
      `noIndex will not be honoured: ${reason}`,
  );
}
