import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async redirects() {
    return [
      {
        source: "/cv",
        destination: "/files/sanyam_cv.pdf",
        permanent: false,
      },
      {
        source: "/resume",
        destination: "/files/sanyam_cv.pdf",
        permanent: false,
      },
    ];
  },
};

export default withMDX(nextConfig);
