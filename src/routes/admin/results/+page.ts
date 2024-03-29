import { DEFAULT_PAGINATION_SIZE, apiBase } from '$lib/util/globals.js'
import { getPagingParams, type AdvancedSearchResult, stringifyPagingParams } from '$lib/util/helpers.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const search = (url.searchParams.get('q') ?? '')?.trim().toLowerCase()
  const pagination = getPagingParams(url.searchParams, DEFAULT_PAGINATION_SIZE)
  const reloadHandle: string = `results:search:${search}`
  depends(reloadHandle)
  // TODO: Get rid of the below split and just pass the query as q to the api.
  const result: AdvancedSearchResult = await (await fetch(`${apiBase}/results?q=${search}${stringifyPagingParams(pagination)}`))?.json()
  if (result) return { ...result, reloadHandle }
  return { matches: [], total: 0, search, pagination, meta: undefined, reloadHandle }
}
