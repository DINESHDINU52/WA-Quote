/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
    // pdfmake/pdfkit ship binary assets (data.trie, AFM files, fonts) loaded
    // via fs.readFileSync. Webpack would bundle the JS but lose the assets;
    // marking these as external makes Next load them from node_modules at
    // runtime so the assets resolve correctly.
    serverComponentsExternalPackages: ['pdfmake', 'pdfkit', 'fontkit']
  }
};

export default nextConfig;
