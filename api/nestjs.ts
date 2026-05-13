// Thin wrapper — no NestJS decorators here, so esbuild can process it.
// The NestJS app is pre-compiled by `buildCommand` (tsc with emitDecoratorMetadata).
export { default } from '../apps/api/dist/vercel';
