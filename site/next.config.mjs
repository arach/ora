import { fileURLToPath } from "node:url";

const nextConfig = {
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
