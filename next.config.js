/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable server actions for form handling
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Allow images from local file system
  images: {
    remotePatterns: [],
  },
  // Configure headers for SSE
  async headers() {
    return [
      {
        source: '/api/jobs/:id/events',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-transform',
          },
          {
            key: 'Content-Type',
            value: 'text/event-stream',
          },
          {
            key: 'Connection',
            value: 'keep-alive',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig