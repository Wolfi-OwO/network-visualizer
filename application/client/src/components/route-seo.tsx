import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

const ORIGIN = 'https://netviz.woofi-developments.at'
// Same set robots.txt disallows. A Disallow alone never removes a URL from the index (the crawler cannot
// see a noindex on a page it may not fetch), so these also say noindex themselves.
const PRIVATE = /^\/(login|admin|account)(\/|$)/

// index.html is served for every path and carries a canonical for "/". Left alone that tells Google every route
// is a duplicate of the home page ("Alternate page with proper canonical tag"), so each route declares its own.
export function RouteSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = `${ORIGIN}${path || '/'}`
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', link.href)

    document.querySelector('meta[name="robots"][data-route-seo]')?.remove()
    if (PRIVATE.test(pathname)) {
      const meta = document.createElement('meta')
      meta.name = 'robots'
      meta.content = 'noindex, nofollow'
      meta.dataset.routeSeo = ''
      document.head.appendChild(meta)
    }
  }, [pathname])
  return <Outlet />
}
