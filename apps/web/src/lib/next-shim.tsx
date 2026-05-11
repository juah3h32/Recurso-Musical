// Polyfill for next/navigation and next/link in Astro context.
// Existing React components use next/navigation hooks — these shims
// provide compatible replacements so components work unchanged.

export function useRouter() {
  return {
    push: (url: string) => { window.location.href = url; },
    replace: (url: string) => { window.location.replace(url); },
    refresh: () => { window.location.reload(); },
    back: () => { window.history.back(); },
  };
}

export function useParams<T = Record<string, string>>(): T {
  // Astro pages pass params as props — try to read from window or URL
  const path = window.location.pathname;
  // For dynamic routes like /dashboard/connections/[id], extract the id
  const segments = path.split('/').filter(Boolean);
  const result: Record<string, string> = {};
  // Attempt to match common patterns
  if (segments.length >= 3 && segments[0] === 'dashboard' && segments[1] === 'connections' && segments[2]) {
    result.id = segments[2];
  }
  return result as T;
}

export function usePathname(): string {
  return window.location.pathname;
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}

// Simple <a> tag wrapper that mimics next/link
export function Link({ href, children, className, ...props }: {
  href: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  return <a href={href} className={className} {...props}>{children}</a>;
}
