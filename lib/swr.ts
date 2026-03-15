import axios from 'axios'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

/** Fetcher for SWR: GET with credentials. Use with useSWR(key, fetcher). */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await axios.get<T>(url)
  return res.data
}

/** Default SWR options: don't refetch when tab gets focus, dedupe within 60s. */
export const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
}
