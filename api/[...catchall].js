// .js files in api/ are deployed as-is by Vercel (no esbuild bundling).
// includeFiles in vercel.json makes apps/api/dist/** available at runtime.
module.exports = require('../apps/api/dist/vercel').default;
