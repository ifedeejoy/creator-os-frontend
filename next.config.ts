import type { NextConfig } from 'next';

const devOriginRaw = process.env.NEXT_PUBLIC_BASE_URL;
const devOrigin = devOriginRaw ? devOriginRaw.replace(/\/+$/, '') : undefined;

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres'],
    ...(devOrigin ? { allowedDevOrigins: [devOrigin] } : {}),
  },
};

export default nextConfig;
