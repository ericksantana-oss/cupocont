/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "mammoth",
      "@xenova/transformers",
      "onnxruntime-node",
      "sharp",
    ],
  },
};

export default nextConfig;
