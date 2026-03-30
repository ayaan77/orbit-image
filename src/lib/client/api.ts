/**
 * Thin fetch wrapper that includes credentials (cookies) automatically.
 * Replaces the old pattern of manually building Authorization headers.
 */
export async function apiFetch(
  url: string,
  opts?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
}
