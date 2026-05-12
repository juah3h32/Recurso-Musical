import { defineMiddleware } from 'astro:middleware';

const BASE = '/whatsapp';
const PUBLIC_PATHS = [BASE + '/login', BASE + '/signup', BASE + '/auth', BASE + '/cli/auth', BASE + '/oauth', BASE + '/docs', BASE + '/terms', BASE + '/privacy'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;
  const isPublicPath = PUBLIC_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'));
  if (isPublicPath || url.pathname === BASE) {
    return next();
  }

  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;
  const isAuthenticated = !!(accessToken && refreshToken);

  if (!isAuthenticated && url.pathname.startsWith(BASE + '/dashboard')) {
    return context.redirect(BASE + '/login');
  }
  if (isAuthenticated && (url.pathname === BASE + '/login' || url.pathname === BASE + '/signup')) {
    if (!url.searchParams.has('redirect')) {
      return context.redirect(BASE + '/dashboard/connections');
    }
  }

  return next();
});
