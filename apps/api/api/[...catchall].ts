// Catch-all serverless function — handles all /api/* requests with original URL preserved.
// NestJS app is pre-built during installCommand.
export { default } from '../dist/vercel';
