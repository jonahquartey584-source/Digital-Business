// Turns away automated traffic before it reaches a page. Netlify's web
// analytics counts every request for a page, so vulnerability scanners and
// scraping tools — most of them running in data centres in the US, Germany,
// Singapore and China — were swamping the real visitors in the figures.
//
// Search engines, link previews and AI search assistants are deliberately
// not on either list below: they are how the site gets found, and Googlebot
// crawls mostly from the US, so nothing here filters by country.
import type { Config, Context } from "@netlify/edge-functions";

// Addresses only an attacker asks for. This site has no WordPress, no PHP
// admin, no dotfiles and no backups to fetch. The API's legacy *.php routes
// all live under /api/, which this function never sees (see excludedPath).
export const SCANNER_PATH =
  /^\/(?:wp-|wordpress|xmlrpc\.php|\.env|\.git|\.aws|\.ssh|\.svn|\.vscode|\.ds_store|phpmyadmin|pma\/|cgi-bin|vendor\/|server-status|actuator)|\.(?:php\d?|asp|aspx|jsp|cgi|env|sql|bak|old|swp)$/i;

// Scripted clients and crawlers that bring no visitors: HTTP libraries that
// scanners are written with, the scanners themselves, and SEO-tool crawlers.
// curl and wget are left alone so the site can still be checked by hand.
export const BLOCKED_AGENT =
  /python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|libwww-perl|scrapy|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|censysinspect|expanseinc|internet-measurement|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|blexbot|dataforseobot|serpstatbot|barkrowler|megaindex/i;

export default async (request: Request, _context: Context) => {
  const { pathname } = new URL(request.url);

  if (SCANNER_PATH.test(pathname)) {
    return new Response("Gone", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
    });
  }

  // Every real browser sends a user agent; a request without one is a script.
  const agent = request.headers.get("user-agent") ?? "";
  if (!agent.trim() || BLOCKED_AGENT.test(agent)) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Anything else carries on to the site untouched.
  return;
};

export const config: Config = {
  path: "/*",
  // The API (Stripe and Twilio webhooks, the portal), Netlify's own routes
  // and .well-known stay out of reach of this function entirely, as do
  // static assets, which cannot be a page view.
  excludedPath: [
    "/api/*",
    "/.netlify/*",
    "/.well-known/*",
    "/uploads/*",
    "/*.css",
    "/*.js",
    "/*.png",
    "/*.jpg",
    "/*.webp",
    "/*.svg",
    "/*.ico",
    "/*.woff2",
    "/*.mp3",
    "/*.mp4",
  ],
  // If this function ever fails, serve the site as normal rather than an error.
  onError: "bypass",
};
