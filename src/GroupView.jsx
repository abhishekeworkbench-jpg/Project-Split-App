import { useState } from 'react'
import * as api from './api'
import { Avatar, tone, posText } from './ui'
import { fmt, fmtDate, netOf, plan, toPaise } from './lib'

const PenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)

function PayRow({ t, me, nm, names, onPay }) {
  const [v, setV] = useState(String(t.amt / 100))
  const [busy, setBusy] = useState(false)
  const pay = async () => {
    setBusy(true)
    await onPay(t, toPaise(v))
    setBusy(false)
  }
  return (
    <div className="card">
      <div className="row">
        <Avatar id={t.from} name={names[t.from]} />
        <span className="mut">→</span>
        <Avatar id={t.to} name={names[t.to]} />
        <div className="sp b">
          {t.from === me ? 'You pay' : `${nm(t.from)} pays`} {t.to === me ? 'you' : nm(t.to)}
        </div>
        <label className="amt">
          <span>₹</span>
          <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} aria-label="Amount to pay" />
          <PenIcon />
        </label>
      </div>
      <button className="btn o w" style={{ marginTop: 10 }} disabled={busy} onClick={pay}>Mark as paid</button>
    </div>
  )
}

export default function GroupView({ g, members, gd, me, nm, names, tab, setTab, back, setModal, run, say }) {
  const expenses = gd?.expenses || []
  const settlements = gd?.settlements || []
  const n = netOf(members, expenses, settlements)
  const mine = n[me] || 0

  const onPay = async (t, paise) => {
    if (!(paise > 0)) return say('Enter an amount above ₹0')
    await run(() => api.addSettlement(g.id, t.from, t.to, paise), 'Payment recorded')
  }

  let body = null
  if (!gd) {
    body = <p className="mut">Loading…</p>
  } else if (tab === 'exp') {
    const items = [
      ...expenses.map((x) => ({ ...x, k: 'e' })),
      ...settlements.map((x) => ({ ...x, k: 's' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    body = items.length ? (
      items.map((e) => {
        if (e.k === 's') {
          return (
            <div key={e.id} className="card row pay" onClick={() => setModal({ t: 'pay', id: e.id })}>
              <Avatar id={e.from_user} name={names[e.from_user]} />
              <div className="sp">
                <div className="b">{nm(e.from_user)} paid {e.to_user === me ? 'you' : nm(e.to_user)}</div>
                <div className="mut sm">Payment · {fmtDate(e.created_at)}</div>
              </div>
              <div className="b pos">{fmt(e.amount_paise)}</div>
            </div>
          )
        }
        const share = e.expense_splits.find((s) => s.user_id === me)?.share_paise
        const involved = e.paid_by === me || share !== undefined
        const my = (e.paid_by === me ? e.amount_paise : 0) - (share || 0)
        return (
          <div key={e.id} className="card row" style={{ cursor: 'pointer' }} onClick={() => setModal({ t: 'exp', id: e.id })}>
            <Avatar id={e.paid_by} name={names[e.paid_by]} />
            <div className="sp">
              <div className="b">{e.description}</div>
              <div className="mut sm">{nm(e.paid_by)} paid {fmt(e.amount_paise)} · {fmtDate(e.created_at)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`${involved ? tone(my) : 'mut'} b sm`}>{involved ? (my >= 0 ? 'you lent' : 'you borrowed') : 'not involved'}</div>
              {involved && <div className={`${tone(my)} b`}>{fmt(Math.abs(my))}</div>}
            </div>
          </div>
        )
      })
    ) : (
      <p className="mut">No expenses yet. Add the first one.</p>
    )
  } else if (tab === 'bal') {
    body = (
      <>
        {members.map((u) => (
          <div className="card row" key={u}>
            <Avatar id={u} name={names[u]} />
            <div className="sp b">{nm(u)}</div>
            <div className={`${tone(n[u])} b`}>{n[u] > 0 ? 'gets back ' : n[u] < 0 ? 'owes ' : ''}{n[u] ? fmt(Math.abs(n[u])) : 'settled'}</div>
          </div>
        ))}
        <p className="mut sm">Balances count every expense and payment in this group.</p>
      </>
    )
  } else {
    const p = plan(n)
    body = p.length ? (
      <>
        {p.map((t) => <PayRow key={`${t.from}-${t.to}-${t.amt}`} t={t} me={me} nm={nm} names={names} onPay={onPay} />)}
        <p className="mut sm">{p.length} payment{p.length > 1 ? 's' : ''} settle everyone with the fewest transfers.</p>
        <p className="mut sm">Tip: tap an amount to pay a different sum.</p>
      </>
    ) : (
      <div className="card b pos">Everyone is settled up 🎉</div>
    )
  }

  return (
    <>
      <div className="row">
        <button className="x big22" onClick={back} aria-label="Back">←</button>
        <div className="sp">
          <h1>{g.emoji} {g.name}</h1>
          <div className="mut sm">{members.map((u) => nm(u)).join(', ')}</div>
        </div>
        <button className="btn o" onClick={() => setModal({ t: 'invite' })}>Invite</button>
        <button className="x big22" onClick={() => setModal({ t: 'settings' })} aria-label="Group settings">⋯</button>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="mut sm">Your balance</div>
        <div className={`big ${tone(mine)}`}>{fmt(mine)}</div>
        <div className={`${tone(mine)} sm b`}>{posText(mine)}</div>
      </div>
      <div className="tabs">
        {[['exp', 'Expenses'], ['bal', 'Balances'], ['set', 'Settle up']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {body}
      <button className="btn fab" onClick={() => setModal({ t: 'add' })}>+ Add expense</button>
    </>
  )
}
