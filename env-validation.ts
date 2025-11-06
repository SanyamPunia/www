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

  // NEXT_PUBLIC_FIREBASE_API_KEY - firebase api key
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    errors.push("NEXT_PUBLIC_FIREBASE_API_KEY is required but not set");
  }
  const next_public_firebase_api_key_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  env.NEXT_PUBLIC_FIREBASE_API_KEY = next_public_firebase_api_key_raw;

  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN - firebase auth domain
  if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
    errors.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required but not set");
  }
  const next_public_firebase_auth_domain_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = next_public_firebase_auth_domain_raw;

  // NEXT_PUBLIC_FIREBASE_PROJECT_ID - firebase project id
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    errors.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID is required but not set");
  }
  const next_public_firebase_project_id_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = next_public_firebase_project_id_raw;

  // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET - firebase storage bucket
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    errors.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required but not set");
  }
  const next_public_firebase_storage_bucket_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
    next_public_firebase_storage_bucket_raw;

  // NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID - firebase messaging sender id
  if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) {
    errors.push(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is required but not set"
    );
  }
  const next_public_firebase_messaging_sender_id_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
    next_public_firebase_messaging_sender_id_raw;

  // NEXT_PUBLIC_FIREBASE_APP_ID - firebase app id
  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) {
    errors.push("NEXT_PUBLIC_FIREBASE_APP_ID is required but not set");
  }
  const next_public_firebase_app_id_raw: string | undefined =
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  env.NEXT_PUBLIC_FIREBASE_APP_ID = next_public_firebase_app_id_raw;

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join("\n")}`);
  }

  return env as unknown as Env;
}

export { validateEnv };
