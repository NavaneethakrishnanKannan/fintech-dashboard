/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false, // avoids double useEffect in dev (APIs called once per page load)
}
module.exports = nextConfig
