import { Result, type ResultDocument } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { isNotBlank } from 'txstate-utils'

/* Need to defined a matching function for query to select Results.
    Should tags found in query match?
    Should mode found in query match?
    Should document level priority found in query match?
    Should url found in query match? Whole URL or partial/path?
    Should title found in query match? Whole or partial?
    Should we have an advanced syntax for matching so we can ask things like:
      hits > 10
      broken since 2021-01-01
      broken after 2021-01-01
      priority >= 50 */

function resultFilter (search: string, result: ResultDocument): boolean {
  if (search.includes(result.title)) return true
  if (result.tags) { for (const tag of result.tags) { if (search.includes(tag)) return true } }
  if (result.entries) {
    for (const entry of result.entries) {
      if (search.includes(entry.mode) || search.includes(entry.priority.toString())) return true
      for (const word of entry.keywords) {
        if (search.includes(word)) return true
      }
    }
  }
  const parsedURL = new URL(result.url)
  for (const part of parsedURL.pathname.split('/')) {
    if (isNotBlank(part) && search.includes(part.trim())) return true
  }
  for (const part of parsedURL.hostname.split('.')) {
    if (isNotBlank(part) && search.includes(part.trim())) return true
  }
  return false
}

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  const matches = (await Result.getAllWithQueries()).filter(r => resultFilter(params.search, r)).map(result => { return result.fullWithCount() })
  return json(matches)
}
