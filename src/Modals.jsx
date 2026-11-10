import { useState } from 'react'
import * as api from './api'
import { supabase } from './supabase'
import { Avatar, Sheet, applyTheme } from './ui'
import { alloc, errMsg, fmt, fmtDate, toPaise } from './lib'

export default function Modals({ modal, ctx, g, members, gd }) {
  if (!modal) return null
  const close = () => ctx.setModal(null)
  const expense = gd?.expenses.find((x) => x.id === modal.id)
  const payment = gd?.settlements.find((x) => x.id === modal.id)
  switch (modal.t) {
    case 'acct': return <Account ctx={ctx} close={close} />
    case 'new': return <NewGroup ctx={ctx} close={close} />
    case 'join': return <JoinGroup ctx={ctx} close={close} />
    case 'invite': return g ? <Invite g={g} ctx={ctx} close={close} /> : null
    case 'settings': return g ? <Settings g={g} members={members} ctx={ctx} close={close} /> : null
    case 'add':
      if (!g) return null
      if (modal.id && !expense) return null
      return <AddExpense key={modal.id || 'new'} g={g} members={members} ctx={ctx} edit={expense} close={close} />
    case 'exp': return expense ? <ExpenseDetail e={expense} ctx={ctx} close={close} /> : null
    case 'pay': return payment ? <PaymentDetail p={payment} ctx={ctx} close={close} /> : null
    case 'confirm': return <Confirm m={modal} close={close} />
    default: return null
  }
}

function Account({ ctx, close }) {
  const { me, email, names, run } = ctx
  const [name, setName] = useState(names[me] || '')
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'system' } catch { return 'system' } })
  const saveName = async () => {
    const v = name.trim()
    if (!v || v === names[me]) return
    await run(() => api.renameSelf(me, v), 'Name updated')
  }
  const pick = (t) => {
    setTheme(t)
    try { localStorage.setItem('theme', t) } catch { /* ignore */ }
    applyTheme(t)
  }
  return (
    <Sheet title="Account" onClose={close}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
        <Avatar id={me} name={name || names[me]} size={84} />
      </div>
      <label className="l">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} autoComplete="name" autoCapitalize="words" enterKeyHint="done" maxLength={60} />
      <label className="l">Email</label>
      <input type="email" value={email || ''} readOnly style={{ opacity: 0.7 }} />
      <label className="l">Appearance</label>
      <div className="tabs" style={{ margin: 0 }}>
        {[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, label]) => (
          <button key={k} className={theme === k ? 'on' : ''} onClick={() => pick(k)}>{label}</button>
        ))}
      </div>
      <button className="btn o w danger-text" style={{ marginTop: 22 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
    </Sheet>
  )
}

const EMOJIS = ['🏠', '🏖️', '🍽️', '✈️', '🛒', '🎉', '👨‍👩‍👧']

function NewGroup({ ctx, close }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🏠')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (!name.trim()) return ctx.say('Enter a group name')
    setBusy(true)
    try {
      const id = await api.createGroup(name.trim(), emoji)
      ctx.say('Group created')
      await ctx.refresh()
      close()
      ctx.openGroup(id)
    } catch (e) {
      ctx.say(errMsg(e))
      setBusy(false)
    }
  }
  return (
    <Sheet title="Create group" onClose={close}>
      <label className="l">Group name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend trip" autoFocus autoCapitalize="words" autoComplete="off" enterKeyHint="done" maxLength={60} />
      <label className="l">Icon</label>
      <div className="emojis">
        {EMOJIS.map((x) => (
          <button key={x} className={emoji === x ? 'on' : ''} onClick={() => setEmoji(x)} aria-label={`Use ${x}`}>{x}</button>
        ))}
      </div>
      <button className="btn w" style={{ marginTop: 16 }} disabled={busy} onClick={go}>Create group</button>
    </Sheet>
  )
}

function JoinGroup({ ctx, close }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (!/^\d{6}$/.test(code)) return setMsg('Enter the 6-digit code.')
    setBusy(true)
    setMsg('')
    try {
      const r = await api.joinGroup(code)
      if (r.ok) {
        ctx.say('Joined group')
        await ctx.refresh()
        close()
        ctx.openGroup(r.group_id)
        return
      }
      setMsg(r.error === 'locked' ? 'Too many wrong codes. Try again in an hour.' : `That code isn’t valid. ${r.attempts_left} ${r.attempts_left === 1 ? 'attempt' : 'attempts'} left this hour.`)
    } catch (e) {
      setMsg(errMsg(e))
    }
    setBusy(false)
  }
  return (
    <Sheet title="Join a group" onClose={close}>
      <label className="l">Invite code</label>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus autoComplete="off" enterKeyHint="done" placeholder="6-digit code" />
      {msg && <div className="note neg-note" style={{ marginTop: 12 }}>{msg}</div>}
      <button className="btn w" style={{ marginTop: 16 }} disabled={busy} onClick={go}>Join group</button>
    </Sheet>
  )
}

function Invite({ g, ctx, close }) {
  const link = `${window.location.origin}/?join=${g.join_code}`
  const code = g.join_code.replace(/(\d{3})(\d{3})/, '$1 $2')
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); ctx.say('Invite link copied') } catch { window.prompt('Copy this link', link) }
  }
  const share = () => navigator.share({ title: `Join ${g.name} on Splitly`, text: `Join “${g.name}” on Splitly. Code: ${g.join_code}`, url: link }).catch(() => {})
  return (
    <Sheet title={`Invite to ${g.name}`} onClose={close}>
      <p className="mut">Share this code or link. Anyone who signs up and opens it joins the group.</p>
      <div className="card big" style={{ textAlign: 'center', letterSpacing: '.12em' }}>{code}</div>
      <button className="btn w" onClick={copy}>Copy invite link</button>
      {navigator.share && <button className="btn o w" style={{ marginTop: 10 }} onClick={share}>Share…</button>}
    </Sheet>
  )
}

function Settings({ g, members, ctx, close }) {
  const owner = g.created_by === ctx.me
  const ask = (title, text, label, fn, okMsg) =>
    ctx.setModal({ t: 'confirm', title, text, label, onOk: () => ctx.run(fn, okMsg) })
  return (
    <Sheet title="Group settings" onClose={close}>
      <h2>Members</h2>
      {members.map((u) => (
        <div className="mrow" key={u}>
          <Avatar id={u} name={ctx.names[u]} size={28} />
          <div className="sp">{ctx.nm(u)}{u === g.created_by && <span className="mut sm"> · creator</span>}</div>
          {owner && u !== ctx.me && (
            <button className="x" onClick={() => ask(`Remove ${ctx.nm(u)}?`, 'They can be removed only when their balance is settled. They can rejoin with the code.', 'Remove', () => api.removeMember(g.id, u), 'Member removed')}>Remove</button>
          )}
        </div>
      ))}
      {owner && (
        <button className="btn o w" style={{ marginTop: 18 }} onClick={() => ask('Reset invite code?', 'The current code stops working immediately. Existing members stay in the group.', 'Reset', () => api.resetCode(g.id), 'Invite code reset')}>
          Reset invite code
        </button>
      )}
      {owner ? (
        <button className="btn o w danger-text" style={{ marginTop: 10 }} onClick={() => ask('Delete group?', 'This permanently deletes the group and every expense in it, for everyone.', 'Delete', async () => { await api.deleteGroup(g.id); ctx.goHome() }, 'Group deleted')}>
          Delete group
        </button>
      ) : (
        <button className="btn o w danger-text" style={{ marginTop: 18 }} onClick={() => ask('Leave group?', 'You can leave only when your balance is settled.', 'Leave', async () => { await api.leaveGroup(g.id); ctx.goHome() }, 'You left the group')}>
          Leave group
        </button>
      )}
    </Sheet>
  )
}

function Confirm({ m, close }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    const r = await m.onOk()
    if (r === false) setBusy(false)
    else close()
  }
  return (
    <Sheet title={m.title} onClose={close}>
      <p className="mut">{m.text}</p>
      <div className="row">
        <button className="btn o sp" onClick={close}>Cancel</button>
        <button className="btn sp danger" disabled={busy} onClick={go}>{m.label}</button>
      </div>
    </Sheet>
  )
}

function ExpenseDetail({ e, ctx, close }) {
  const mine = e.created_by === ctx.me
  const del = () =>
    ctx.setModal({ t: 'confirm', title: 'Delete expense?', text: 'This removes it from the balances. You can’t undo it.', label: 'Delete', onOk: () => ctx.run(() => api.deleteExpense(e.id), 'Expense deleted') })
  return (
    <Sheet title={e.description} onClose={close}>
      <div className="big" style={{ marginTop: 6 }}>{fmt(e.amount_paise)}</div>
      <div className="mut sm">{ctx.nm(e.paid_by)} paid · {fmtDate(e.created_at)} · added by {ctx.nm(e.created_by)}</div>
      <h2>Split</h2>
      {e.expense_splits.map((s) => (
        <div className="mrow" key={s.user_id}>
          <Avatar id={s.user_id} name={ctx.names[s.user_id]} size={28} />
          <div className="sp">{ctx.nm(s.user_id)}</div>
          <b>{fmt(s.share_paise)}</b>
        </div>
      ))}
      {mine ? (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn o sp" onClick={() => ctx.setModal({ t: 'add', id: e.id })}>Edit</button>
          <button className="btn sp danger" onClick={del}>Delete</button>
        </div>
      ) : (
        <div className="note">Only {ctx.nm(e.created_by)} can edit or delete this expense.</div>
      )}
    </Sheet>
  )
}

function PaymentDetail({ p, ctx, close }) {
  const mine = p.created_by === ctx.me
  const del = () =>
    ctx.setModal({ t: 'confirm', title: 'Delete payment?', text: 'This removes it from the balances. You can’t undo it.', label: 'Delete', onOk: () => ctx.run(() => api.deleteSettlement(p.id), 'Payment deleted') })
  return (
    <Sheet title="Payment" onClose={close}>
      <div className="big" style={{ marginTop: 6 }}>{fmt(p.amount_paise)}</div>
      <div className="mut sm">{ctx.nm(p.from_user)} paid {p.to_user === ctx.me ? 'you' : ctx.nm(p.to_user)} · {fmtDate(p.created_at)} · recorded by {ctx.nm(p.created_by)}</div>
      {mine ? (
        <button className="btn w danger" style={{ marginTop: 18 }} onClick={del}>Delete payment</button>
      ) : (
        <div className="note">Only {ctx.nm(p.created_by)} can delete this payment.</div>
      )}
    </Sheet>
  )
}

function AddExpense({ g, members, ctx, edit, close }) {
  const { me, nm, names, run } = ctx
  const ids0 = edit ? edit.expense_splits.map((s) => s.user_id) : members
  const eq0 = edit ? alloc(edit.amount_paise, ids0, ids0.map(() => 1)) : null
  const isEq = !edit || ids0.every((u) => eq0[u] === edit.expense_splits.find((s) => s.user_id === u).share_paise)
  const [desc, setDesc] = useState(edit ? edit.description : '')
  const [amt, setAmt] = useState(edit ? String(edit.amount_paise / 100) : '')
  const [by, setBy] = useState(edit ? edit.paid_by : me)
  const [type, setType] = useState(isEq ? 'equal' : 'exact')
  const [sel, setSel] = useState(() => new Set(ids0))
  const [vals, setVals] = useState(() => {
    const o = {}
    if (edit && !isEq) edit.expense_splits.forEach((s) => (o[s.user_id] = String(s.share_paise / 100)))
    return o
  })
  const [open, setOpen] = useState(!!edit)
  const [busy, setBusy] = useState(false)

  const total = toPaise(amt)
  const ids = members.filter((u) => sel.has(u))
  const v = (u) => parseFloat(vals[u] ?? (type === 'shares' ? 1 : 0)) || 0
  let res
  if (!(total > 0)) res = { err: 'Enter an amount.' }
  else if (!ids.length) res = { err: 'Pick at least one person.' }
  else if (type === 'equal') res = { sp: alloc(total, ids, ids.map(() => 1)) }
  else if (type === 'shares') {
    const w = ids.map((u) => Math.round(v(u) * 100))
    res = w.some((x) => x <= 0) ? { err: 'Shares must be above 0.' } : { sp: alloc(total, ids, w) }
  } else if (type === 'percent') {
    const t = ids.reduce((a, u) => a + v(u), 0)
    res = Math.abs(t - 100) > 0.001
      ? { err: `Percentages add up to ${+t.toFixed(2)}%. They need to total 100%.` }
      : { sp: alloc(total, ids, ids.map((u) => Math.round(v(u) * 100))) }
  } else {
    const sp = {}
    let t = 0
    ids.forEach((u) => { sp[u] = toPaise(vals[u] || 0) || 0; t += sp[u] })
    res = t !== total
      ? { err: `Amounts add up to ${fmt(t)}. ${t < total ? fmt(total - t) + ' left to assign.' : fmt(t - total) + ' over.'}`, sp }
      : { sp }
  }

  const label = `Paid by ${by === me ? 'you' : nm(by)}, split ${type === 'equal' ? (sel.size === members.length ? 'equally' : `equally among ${sel.size}`) : 'unequally'}`
  const toggle = (u) => { const s = new Set(sel); s.has(u) ? s.delete(u) : s.add(u); setSel(s) }

  const save = async () => {
    if (res.err || !desc.trim()) return
    setBusy(true)
    const splits = Object.entries(res.sp).map(([user_id, share_paise]) => ({ user_id, share_paise }))
    const done = await run(
      () => (edit ? api.updateExpense(edit.id, desc.trim(), total, by, splits) : api.addExpense(g.id, desc.trim(), total, by, splits)),
      edit ? 'Expense updated' : 'Expense added'
    )
    setBusy(false)
    if (done) close()
  }

  return (
    <Sheet title={edit ? 'Edit expense' : 'Add expense'} onClose={close}>
      <label className="l">What was it for?</label>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Groceries" autoFocus={!edit} autoCapitalize="sentences" autoComplete="off" enterKeyHint="next" maxLength={120} />
      <label className="l">Amount (₹)</label>
      <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="0" autoComplete="off" enterKeyHint="done" />
      {open ? (
        <>
          <label className="l">Paid by</label>
          <select value={by} onChange={(e) => setBy(e.target.value)}>
            {members.map((u) => <option key={u} value={u}>{nm(u)}</option>)}
          </select>
          <label className="l">Split</label>
          <div className="tabs" style={{ margin: 0 }}>
            {[['equal', 'Equally'], ['exact', 'Exact ₹'], ['percent', 'Percent'], ['shares', 'Shares']].map(([k, text]) => (
              <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{text}</button>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            {members.map((u) => (
              <div className="mrow" key={u}>
                <input type="checkbox" checked={sel.has(u)} onChange={() => toggle(u)} aria-label={`Include ${nm(u)}`} />
                <Avatar id={u} name={names[u]} size={28} />
                <div className="sp">{nm(u)}</div>
                {type !== 'equal' && sel.has(u) && (
                  <input className="v" inputMode="decimal" value={vals[u] ?? (type === 'shares' ? '1' : '')} onChange={(e) => setVals({ ...vals, [u]: e.target.value })} placeholder={{ exact: '₹', percent: '%', shares: '1' }[type]} />
                )}
                <div className="b sm share">{sel.has(u) && res.sp?.[u] !== undefined ? fmt(res.sp[u]) : ''}</div>
              </div>
            ))}
          </div>
          <div className={`sm b ${res.err ? 'neg' : 'pos'}`} style={{ margin: '12px 0' }}>
            {res.err || `Split ${type === 'equal' ? 'equally' : 'as entered'}: ${fmt(total)} total.`}
          </div>
        </>
      ) : (
        <button className="chip" onClick={() => setOpen(true)}>{label}<span>⌄</span></button>
      )}
      <button className="btn w" style={{ marginTop: open ? 0 : 14 }} disabled={!!res.err || !desc.trim() || busy} onClick={save}>
        {edit ? 'Save changes' : 'Add expense'}
      </button>
    </Sheet>
  )
}
