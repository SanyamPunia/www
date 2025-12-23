import { fetcher } from "./fetcher";

export interface LastVisitData {
  city: string | null;
  country: string | null;
  timestamp?: number | null;
}

export const lastVisitFetcher = (url: string) => fetcher<LastVisitData>(url);

export const isLocalEnv =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
