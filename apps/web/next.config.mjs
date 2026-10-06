/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser talks to the API through /api on the same origin, so the
  // refresh-token cookie stays first-party and httpOnly. The API itself is
  // deployed independently; only API_URL changes per environment.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
