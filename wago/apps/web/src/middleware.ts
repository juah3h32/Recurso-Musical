import { defineMiddleware } from 'astro:middleware';

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/cli/auth', '/oauth', '/docs', '/terms', '/privacy'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;
  const isPublicPath = PUBLIC_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'));
  if (isPublicPath || url.pathname === '/') {
    return next();
  }

  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;
  const isAuthenticated = !!(accessToken && refreshToken);

  if (!isAuthenticated && url.pathname.startsWith('/dashboard')) {
    return context.redirect('/login');
  }
  if (isAuthenticated && (url.pathname === '/login' || url.pathname === '/signup')) {
    if (!url.searchParams.has('redirect')) {
      return context.redirect('/dashboard/connections');
    }
  }

  return next();
});
