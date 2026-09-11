import { config } from '../config.js';
import { apiRequest } from './http.js';

/**
 * Thin wrapper over the Facebook Graph API, shared by the Instagram and
 * Facebook Page adapters. Parameters go in the request *body* rather than the
 * query string so access tokens never end up in a URL (and therefore never in
 * a proxy or error log).
 */
export function graphUrl(pathname: string): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${pathname.replace(/^\//, '')}`;
}

export async function graphPost<T>(
  channel: string,
  pathname: string,
  accessToken: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') body.set(key, value);
  }
  body.set('access_token', accessToken);

  return apiRequest<T>(graphUrl(pathname), {
    channel,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export async function graphGet<T>(
  channel: string,
  pathname: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  return apiRequest<T>(`${graphUrl(pathname)}?${query.toString()}`, { channel });
}

/**
 * Instagram creates a media "container" asynchronously -- it has to download
 * the image from our public URL first. Publishing before it reports FINISHED
 * fails, so wait for it (images are usually ready on the first or second poll).
 */
export async function waitForContainer(
  channel: string,
  containerId: string,
  accessToken: string,
  log: (m: string) => void,
  attempts = 10,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const res = await graphGet<{ status_code?: string; status?: string }>(
      channel,
      containerId,
      accessToken,
      { fields: 'status_code,status' },
    );
    const code = res.status_code ?? 'UNKNOWN';

    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`${channel}: media container ${code} — ${res.status ?? 'no detail'}`);
    }

    log(`Waiting for ${channel} to fetch the image (${code})`);
    await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
  }
  throw new Error(`${channel}: media container was still not ready after ${attempts} checks`);
}
