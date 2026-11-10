/**
 * Server-side environment, read at request time.
 *
 * process.env comes first on purpose: Astro inlines `import.meta.env` at build
 * time, and on Cloudflare the build and the Worker have separate variables, so
 * a secret set only on the Worker would be missing from the bundle. With
 * `nodejs_compat` and a recent compatibility date, the Worker's vars and
 * secrets are in `process.env`. `import.meta.env` is the fallback for
 * `astro dev`, where the .env file is loaded there.
 *
 * `PUBLIC_*` variables are different: they reach the browser bundle, so they
 * are inlined at build and must exist in the build environment.
 */
export function serverEnv(key: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.[key] : undefined;

  const value = fromProcess ?? (import.meta as any).env?.[key];

  return value === "" ? undefined : value;
}
