/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

interface ImportMetaEnv {
  readonly PUBLIC_SANITY_PROJECT_ID: string;
  readonly PUBLIC_SANITY_DATASET: string;
  readonly PUBLIC_SANITY_VISUAL_EDITING_ENABLED?: string;
  readonly SANITY_API_READ_TOKEN?: string;
  readonly SANITY_REVALIDATE_SECRET?: string;
  readonly VERCEL_BYPASS_TOKEN?: string;

  readonly STORAGE_PROVIDER?: "s3" | "r2";
  readonly STORAGE_BUCKET: string;
  readonly STORAGE_PREFIX?: string;
  readonly STORAGE_ACCESS_KEY_ID: string;
  readonly STORAGE_SECRET_ACCESS_KEY: string;
  readonly STORAGE_REGION?: string;
  readonly R2_ACCOUNT_ID?: string;
  readonly PUBLIC_CDN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
