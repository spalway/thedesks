// social — friend requests, direct messages and trade offers.
//
// Every action resolves the actor from the session and passes an `auth.users` id
// to a SQL writer that looks the wallet up itself. Nothing here takes a "from"
// address, so there is no shape of request that sends mail as somebody else.
//
// ===========================================================================
// ACCEPTING A TRADE OFFER MOVES NOTHING
// ===========================================================================
// It records a decision. There is no escrow anywhere in this protocol, so an
// offer that reassigned xployees would be a settlement layer hidden inside a
// messaging table — with none of the ownership locking `buy_listing` performs and
// no way to make two legs atomic against a counterparty who sold in the meantime.
//
// The response says so explicitly on every acceptance (`settled: false`), because
// this is the single most misreadable outcome in the whole social layer: a user
// who believes an accepted trade executed will stop watching for it.
//
// The legs are still validated against real ownership when the offer is SENT. An
// offer for units the sender does not hold is a lie whether or not anything
// settles it.
import { isValidAddress } from '../_shared/base58.ts'
import { callRpc } from '../_shared/db.ts'
import { loadPlatformConfig } from '../_shared/env.ts'
import { resolveCaller, writerRefusal, type WriterResult } from '../_shared/auth.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely } from '../_shared/http.ts'

const U64 = /^(0|[1-9][0-9]{0,19})$/

/** Serials, as non-negative integers. Anything else in the array is a refusal, not a silent drop. */
function serials(value: unknown): number[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const out: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) return null
    if (!out.includes(item)) out.push(item)
  }
  return out
}

function counterparty(value: unknown): string | null {
  const address = typeof value === 'string' ? value.trim() : ''
  return isValidAddress(address) ? address : null
}

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadPlatformConfig()
  if (isFnError(config)) return errorResponse(config)

  const caller = await resolveCaller(config, request)
  if (isFnError(caller)) return errorResponse(caller)

  const action = typeof body.action === 'string' ? body.action : ''
  let fn: string
  let args: Record<string, unknown>

  switch (action) {
    case 'friend-request': {
      const to = counterparty(body.to)
      if (!to) return errorResponse(fnError('bad-request', '`to` is a base58 Solana address.'))
      fn = 'send_friend_request'
      args = {
        p_user_id: caller.userId,
        p_to: to,
        p_message: typeof body.message === 'string' ? body.message.slice(0, 200) : null,
      }
      break
    }

    case 'friend-respond': {
      const id = typeof body.requestId === 'string' ? body.requestId.trim() : ''
      if (!id) return errorResponse(fnError('bad-request', 'Post the `requestId` to answer.'))
      if (typeof body.accept !== 'boolean') {
        return errorResponse(fnError('bad-request', '`accept` is a boolean.'))
      }
      fn = 'respond_to_friend_request'
      args = { p_user_id: caller.userId, p_request_id: id, p_accept: body.accept }
      break
    }

    case 'unfriend': {
      const other = counterparty(body.wallet)
      if (!other) return errorResponse(fnError('bad-request', '`wallet` is a base58 Solana address.'))
      fn = 'remove_friend'
      args = { p_user_id: caller.userId, p_other: other }
      break
    }

    case 'message': {
      const to = counterparty(body.to)
      if (!to) return errorResponse(fnError('bad-request', '`to` is a base58 Solana address.'))
      const text = typeof body.body === 'string' ? body.body : ''
      // Length is checked in SQL too. Checked here as well so an oversized body
      // is refused before it becomes a database round trip — and so the sentence
      // a user sees names the limit rather than a constraint.
      if (text.trim().length === 0 || text.length > 500) {
        return errorResponse(fnError('bad-request', 'A message is 1–500 characters.'))
      }
      fn = 'send_message'
      args = { p_user_id: caller.userId, p_to: to, p_body: text }
      break
    }

    case 'mark-read': {
      const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : ''
      if (!threadId) return errorResponse(fnError('bad-request', 'Post the `threadId` to mark read.'))
      fn = 'mark_thread_read'
      args = { p_user_id: caller.userId, p_thread_id: threadId }
      break
    }

    case 'offer': {
      const to = counterparty(body.to)
      if (!to) return errorResponse(fnError('bad-request', '`to` is a base58 Solana address.'))

      const offering = serials(body.offering)
      const requesting = serials(body.requesting)
      if (offering === null || requesting === null) {
        return errorResponse(
          fnError('bad-request', '`offering` and `requesting` are arrays of non-negative integer serials.'),
        )
      }

      // Two non-negative columns rather than one signed number, matching the
      // schema. A sign that has to be read correctly at every render is a sign
      // that eventually is not.
      const fromSender = typeof body.sweetenerFromSender === 'string' ? body.sweetenerFromSender : '0'
      const fromRecipient = typeof body.sweetenerFromRecipient === 'string' ? body.sweetenerFromRecipient : '0'
      if (!U64.test(fromSender) || !U64.test(fromRecipient)) {
        return errorResponse(
          fnError('bad-request', 'A sweetener is raw units as a decimal string, on one side or the other.'),
        )
      }

      fn = 'send_trade_offer'
      args = {
        p_user_id: caller.userId,
        p_to: to,
        p_offering: offering,
        p_requesting: requesting,
        p_sweetener_from_sender: fromSender,
        p_sweetener_from_recipient: fromRecipient,
        p_note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
        p_ttl_hours: typeof body.ttlHours === 'number' && Number.isInteger(body.ttlHours) ? body.ttlHours : 168,
      }
      break
    }

    case 'offer-respond': {
      const id = typeof body.offerId === 'string' ? body.offerId.trim() : ''
      const status = body.status
      if (!id) return errorResponse(fnError('bad-request', 'Post the `offerId` to answer.'))
      if (status !== 'accepted' && status !== 'declined' && status !== 'withdrawn') {
        return errorResponse(fnError('bad-request', '`status` is "accepted", "declined" or "withdrawn".'))
      }
      fn = 'respond_to_trade_offer'
      args = { p_user_id: caller.userId, p_offer_id: id, p_status: status }
      break
    }

    default:
      return errorResponse(
        fnError(
          'bad-request',
          '`action` must be one of: friend-request, friend-respond, unfriend, message, mark-read, offer, offer-respond.',
        ),
      )
  }

  const result = await callRpc<WriterResult>(config, fn, args)
  if (isFnError(result)) return errorResponse(result)

  const refusal = writerRefusal(result)
  if (refusal) return errorResponse(refusal)

  return jsonResponse({ ok: true, action, result })
}))
