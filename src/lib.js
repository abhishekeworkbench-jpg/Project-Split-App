export const fmt = (p) => {
  const a = Math.abs(p)
  return (p < 0 ? '−' : '') + '₹' + (a / 100).toLocaleString('en-IN', { minimumFractionDigits: a % 100 ? 2 : 0, maximumFractionDigits: 2 })
}

export const toPaise = (s) => {
  const v = Math.round(parseFloat(String(s ?? '').replace(/,/g, '')) * 100)
  return Number.isFinite(v) ? v : NaN
}

// Split `amt` paise across ids by integer weights; leftover paise go to the largest remainders.
export function alloc(amt, ids, w) {
  const W = w.reduce((a, b) => a + b, 0)
  if (!W) return null
  const out = ids.map((_, i) => Math.floor((amt * w[i]) / W))
  let r = amt - out.reduce((a, b) => a + b, 0)
  const f = ids.map((_, i) => [(amt * w[i]) % W, i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; r > 0; k++, r--) out[f[k % f.length][1]]++
  const o = {}
  ids.forEach((id, i) => (o[id] = out[i]))
  return o
}

// Net balance per member: positive = is owed, negative = owes.
export function netOf(ids, expenses, settlements) {
  const n = {}
  ids.forEach((u) => (n[u] = 0))
  const add = (u, x) => { if (u in n) n[u] += x }
  expenses.forEach((e) => {
    add(e.paid_by, e.amount_paise)
    e.expense_splits.forEach((s) => add(s.user_id, -s.share_paise))
  })
  settlements.forEach((s) => {
    add(s.from_user, s.amount_paise)
    add(s.to_user, -s.amount_paise)
  })
  return n
}

// Fewest-payments settle-up: repeatedly match the biggest debtor with the biggest creditor.
export function plan(n) {
  const c = [], d = []
  for (const u in n) {
    if (n[u] > 0) c.push([u, n[u]])
    else if (n[u] < 0) d.push([u, -n[u]])
  }
  const out = []
  while (c.length && d.length) {
    c.sort((a, b) => b[1] - a[1])
    d.sort((a, b) => b[1] - a[1])
    const x = Math.min(c[0][1], d[0][1])
    out.push({ from: d[0][0], to: c[0][0], amt: x })
    c[0][1] -= x
    d[0][1] -= x
    if (!c[0][1]) c.shift()
    if (!d[0][1]) d.shift()
  }
  return out
}

const PALETTE = ['#2c3fb0', '#c2570c', '#0b7a55', '#a3246b', '#6d3fc9', '#0e7490', '#b45309', '#be123c']
export const colorFor = (id) => {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const IST = { timeZone: 'Asia/Kolkata' }
export function fmtDate(iso) {
  const d = new Date(iso)
  const day = (x) => x.toLocaleDateString('en-CA', IST)
  if (day(d) === day(new Date())) return 'Today'
  return d.toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short' })
}

const ERR = {
  unsettled_balance: 'Balance must be settled first.',
  creator_cannot_leave: 'The group creator can’t leave. Delete the group instead.',
  not_creator: 'Only the group creator can do that.',
  not_your_expense: 'Only the person who added this can change it.',
  not_a_member: 'You’re not a member of this group.',
  split_total_mismatch: 'The split doesn’t add up to the amount.',
  invalid_splits: 'The split is not valid. Check the people selected.',
  payer_not_member: 'The payer must be a member of the group.',
  invalid_payment: 'That payment is not valid.',
  'Failed to fetch': 'Can’t reach the server. Check your connection.',
  'Invalid login credentials': 'Wrong email or password.',
  'User already registered': 'That email already has an account. Try signing in.',
}
export const errMsg = (e) => {
  const m = (e && e.message) || String(e)
  for (const k in ERR) if (m.includes(k)) return ERR[k]
  return m
}
