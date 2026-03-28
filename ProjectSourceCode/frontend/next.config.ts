import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow images from any hostname for listing photos (restrict to known hosts in production)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
