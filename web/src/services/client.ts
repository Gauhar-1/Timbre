/**
 * Client Identity & URL Room Routing Service
 * Provides persistent browser UUID and URL room management.
 */

const CLIENT_ID_STORAGE_KEY = 'timbre_client_id'

/**
 * Returns a persistent UUID for this browser instance.
 * Generates and stores one in localStorage if not already present.
 */
export function getClientId(): string {
  if (typeof window === 'undefined') {
    return 'ssr-client'
  }

  let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (!clientId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      clientId = `client-${crypto.randomUUID()}`
    } else {
      clientId = `client-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`
    }
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId)
  }

  return clientId
}

/**
 * Parses the room parameter from the current URL query string.
 * Example: `?room=alpha-room` -> returns `"alpha-room"`.
 */
export function getUrlRoomId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  return room ? room.trim() : null
}

/**
 * Sets or updates the room parameter in the current browser URL without reloading.
 */
export function setUrlRoomId(roomId: string | null): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (roomId) {
    url.searchParams.set('room', roomId)
  } else {
    url.searchParams.delete('room')
  }
  window.history.replaceState({}, '', url.toString())
}

/**
 * Copies the invite link for a specific room to the clipboard.
 * Returns true if successful.
 */
export async function copyInviteLink(roomId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const origin = window.location.origin
  const pathname = window.location.pathname
  const inviteUrl = `${origin}${pathname}?room=${encodeURIComponent(roomId)}`

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(inviteUrl)
      return true
    }
    // Fallback for older environments
    const input = document.createElement('textarea')
    input.value = inviteUrl
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    return true
  } catch (err) {
    console.error('Failed to copy invite link to clipboard:', err)
    return false
  }
}
