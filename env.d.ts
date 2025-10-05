declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_BASE_URL: string;
    }
  }

  // Type for the validated environment object returned by validateEnv()
  interface Env {
    NEXT_PUBLIC_BASE_URL: string;
  }
}

export {};
