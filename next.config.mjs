/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Roster Builder became the GM Simulator; keep old links (and their
  // ?team= query) working.
  async redirects() {
    return [{ source: "/roster-builder", destination: "/gm-simulator", permanent: true }];
  },
};

export default nextConfig;
