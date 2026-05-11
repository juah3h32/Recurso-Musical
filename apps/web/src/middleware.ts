import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/cli/auth', '/oauth', '/docs', '/terms', '/privacy'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;

  // Skip public paths and root
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + '/'),
  );
  if (isPublicPath || url.pathname === '/') {
    return next();
  }

  // Get session from cookies (Supabase stores them as sb-*-auth-token)
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  const isAuthenticated = !!(accessToken && refreshToken);

  // Redirect unauthenticated users to login
  if (!isAuthenticated && url.pathname.startsWith('/dashboard')) {
    return context.redirect('/login');
  }

  // Redirect authenticated users away from login/signup
  if (isAuthenticated && (url.pathname === '/login' || url.pathname === '/signup')) {
    if (!url.searchParams.has('redirect')) {
      return context.redirect('/dashboard/connections');
    }
  }

  return next();
});
