import { Result, type RawJsonResult, type ResultDocument, type TemplateResult, type DuplicateMatching, findDuplicateMatchings, matchModesToString } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { MessageType, type Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY, appURL } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** Returns the associcated `Feedback MessageType` from common HTML status codes and ranges. */
function statusToMessageType (status: number) {
  if (status === 200) return MessageType.SUCCESS
  if ([401, 403, 404].includes(status)) return MessageType.SYSTEM
  if (status > 200 && status < 300) return MessageType.WARNING
  return MessageType.ERROR
}

/** A set of common checks that handle the difference between validation only checks and
 * full blown throw an error checks. If they're not `validationOnly` then errors will be
 * thrown before a value can be returned. If they ARE `validationOnly` then an array of
 * Feedback messages will be returned, or an empty array if the check passed.
 * Usefull for making sure our checks are consistent - where these are used - and for
 * reducing code clutter where we optionally want to throw errors or return feedback.
 * @note Mongoose should be centralizing our document properties validation and formatting.
 * Hence these checks are more for whether the API was provided everything it needs to
 * interact with Mongoose. */
const ValidationChecks = {
  ifFails: (condition: boolean, status: number, message: string, path: string, validationOnly: boolean = false) => {
    if (!condition) {
      if (!validationOnly) throw error(status, { message })
      const type = statusToMessageType(status)
      return [{ type, path, message }]
    } return []
  },
  /** Careful with isEditor. If `validationOnly` this will return a message but not throw 403.
   * It's up to the caller to inspect returned messages and throw 403 if Not Authorized. */
  isEditor: (verified: boolean, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(verified, 403, 'Not Authorized', '', validationOnly)
  },
  isBlank: (param: any, name: string, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(!isBlank(param[name]), 400, `Posted request must contain a non-empty ${name}.`, name, validationOnly)
  }
}

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  const result = await Result.findById(params.id)
  if (!result) throw error(404)
  return json({ result: result.full(), messages: [] })
}

/** @type {import('./$types').RequestHandler} */
export async function PUT ({ params, url, request, locals }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'PUT body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const result = await Result.findById(params.id) as ResultDocument | undefined
  messages.push(...ValidationChecks.ifFails(!!result, 404, `Result ${params.id} does not exist.`, 'id', isValidation))
  if (!result) return json({ result: undefined, messages })

  result.fromPartialJson(body)
  const existingUrls: ResultDocument[] | undefined = (await Result.findByUrl(result.url)).filter(r => r.id !== result.id)
  if (existingUrls?.length) {
    messages.push(...existingUrls.map(r => {
      return { type: MessageType.WARNING, path: 'url', message: `URL is equivalent to [${r.title}](${appURL}/results/${r.id})'s URL.` }
    }))
    if (!result.hasTag('duplicate-url')) result.tags.push('duplicate-url')
  } else result.tags = result.tags.filter((t: string) => t !== 'duplicate-url')
  const existingTitles: ResultDocument[] | undefined = (await Result.find({ title: result.title }) as ResultDocument[]).filter(r => r.id !== result.id)
  if (existingTitles?.length) {
    messages.push(...existingTitles.map(r => {
      return { type: MessageType.WARNING, path: 'title', message: `This Title is a duplicate to [${r.title}](${appURL}/results/${r.id})'s Title.` }
    }))
    if (!result.hasTag('duplicate-title')) result.tags.push('duplicate-title')
  } else result.tags = result.tags.filter((t: string) => t !== 'duplicate-title')
  const dupMatchings: DuplicateMatching[] = findDuplicateMatchings(result.entries)
  if (dupMatchings.length) {
    messages.push(...dupMatchings.map<Feedback>(dup => {
      return { type: MessageType.ERROR, path: `entries.${dup.index}.keywords`, message: `Duplicate Terms for ${matchModesToString.get(dup.mode)} Type.` }
    }))
    if (!result.hasTag('duplicate-match-phrase')) result.tags.push('duplicate-match-phrase')
  } else result.tags = result.tags.filter((t: string) => t !== 'duplicate-match-phrase')
  if (!existingUrls?.length && !existingTitles?.length && !dupMatchings.length) result.tags = result.tags.filter((t: string) => t !== 'duplicate')
  else if (!result.hasTag('duplicate')) result.tags.push('duplicate')
  messages.push(...result.getValidationFeedback())
  // TODO: Add check for reserved tags of results model currencyTest that can be removed or added and do so accordingly.
  if (!isValidation) {
    const errorMessages = messages.filter(m => m.type === MessageType.ERROR)
    if (errorMessages.length === 0) {
      try {
        await result.save()
        messages.push({ type: MessageType.SUCCESS, path: 'update', message: `'${result.title}' updated successfully.` })
        return json({ result: result.full(), messages })
      } catch (e: any) {
        messages.push({ type: MessageType.ERROR, path: 'update', message: `An error occurred while saving the Result updates.\r${JSON.stringify(e)}` })
      }
    }
  }
  return json({ result: result.full(), messages })
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  await Result.findByIdAndDelete(params.id)
  return json({ ok: true })
}
