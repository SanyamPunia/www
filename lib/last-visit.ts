export interface LastVisitData {
  city: string | null;
  country: string | null;
  timestamp?: number | null;
}

export const lastVisitFetcher = async (url: string): Promise<LastVisitData> => {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch last visit");
  }

  return (await response.json()) as LastVisitData;
};

export const isLocalEnv =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
