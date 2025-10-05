/// <reference path="./env.d.ts" />
function validateEnv(): Env {
  const errors: string[] = [];
  const env: any = {};

  // NEXT_PUBLIC_BASE_URL - base url
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    errors.push("NEXT_PUBLIC_BASE_URL is required but not set");
  }
  const next_public_base_url_raw: string | undefined =
    process.env.NEXT_PUBLIC_BASE_URL;
  env.NEXT_PUBLIC_BASE_URL = next_public_base_url_raw;

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join("\n")}`);
  }

  return env as unknown as Env;
}

export { validateEnv };
