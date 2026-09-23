import { supabase } from './storage'

export async function unsubscribeBrowserPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
}

export async function disablePushForCurrentAccount() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  if (supabase) {
    const { error } = await supabase
      .from('pockit_push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
    if (error) throw error
  }
  await subscription.unsubscribe()
}
