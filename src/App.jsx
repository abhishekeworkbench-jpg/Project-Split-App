import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configured } from './supabase'
import * as api from './api'
import { fmt, errMsg } from './lib'
import { Avatar, Toast, tone, posText } from './ui'
import Login from './Login'
import GroupView from './GroupView'
import Modals from './Modals'

// An invite link looks like /?join=123456. Remember it until the person is signed in.
try {
  const q = new URLSearchParams(window.location.search).get('join')
  if (q) {
    if (/^\d{6}$/.test(q)) localStorage.setItem('pendingJoin', q)
    window.history.replaceState(null, '', window.location.pathname)
  }
} catch { /* ignore */ }

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) {
    return (
      <div className="app">
        <div className="note">Missing configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README) and rebuild.</div>
      </div>
    )
  }
  if (session === undefined) return <div className="center mut">Loading…</div>
  return session ? <Main session={session} /> : <Login />
}

function Main({ session }) {
  const me = session.user.id
  const email = session.user.email
  const [home, setHome] = useState(null)
  const [gid, setGid] = useState(null)
  const [gd, setGd] = useState(null)
  const [tab, setTab] = useState('exp')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')
  const gidRef = useRef(null)
  const timer = useRef()
  gidRef.current = gid

  const say = useCallback((t) => {
    setToast(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const h = await api.loadHome()
      setHome(h)
      const cur = gidRef.current
      if (cur) {
        if (h.groups.some((g) => g.id === cur)) setGd(await api.loadGroup(cur))
        else { setGid(null); setGd(null) }
      }
      setErr('')
    } catch (e) {
      setErr(errMsg(e))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh, gid])

  // Live updates: any change to this app's tables triggers a short, debounced reload.
  useEffect(() => {
    let t
    const kick = () => { clearTimeout(t); t = setTimeout(refresh, 300) }
    const ch = supabase.channel('splitly-changes')
    ;['expenses', 'expense_splits', 'settlements', 'group_members'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, kick)
    )
    ch.subscribe()
    const vis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearTimeout(t)
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [refresh])

  // Join a group from an invite link opened before signing in.
  useEffect(() => {
    let code = null
    try { code = localStorage.getItem('pendingJoin'); localStorage.removeItem('pendingJoin') } catch { /* ignore */ }
    if (!code) return
    api.joinGroup(code)
      .then((r) => {
        if (r.ok) { say('Joined group'); refresh() }
        else say(r.error === 'locked' ? 'Too many wrong codes. Try again in an hour.' : 'That invite code is not valid.')
      })
      .catch((e) => say(errMsg(e)))
  }, [say, refresh])

  const run = useCallback(async (fn, okMsg) => {
    try {
      await fn()
      if (okMsg) say(okMsg)
      await refresh()
      return true
    } catch (e) {
      say(errMsg(e))
      return false
    }
  }, [say, refresh])

  const names = home?.names || {}
  const nm = (id) => (id === me ? 'You' : names[id] || 'Former member')
  const g = home?.groups.find((x) => x.id === gid) || null
  const members = g
    ? g.group_members.map((m) => m.user_id).sort((a, b) => (a === me ? -1 : b === me ? 1 : nm(a).localeCompare(nm(b))))
    : []

  const openGroup = (id) => { setGd(null); setTab('exp'); setGid(id) }
  const goHome = () => { setGid(null); setGd(null) }

  if (!home) {
    return <div className="app">{err ? <div className="note">{err}</div> : <div className="center mut">Loading…</div>}</div>
  }

  const ctx = { me, email, names, nm, say, run, refresh, setModal, openGroup, goHome }

  return (
    <div className="app">
      {err && <div className="note" style={{ marginBottom: 12 }}>{err}</div>}
      {g ? (
        <GroupView g={g} members={members} gd={gd} me={me} nm={nm} names={names} tab={tab} setTab={setTab} back={goHome} setModal={setModal} run={run} say={say} />
      ) : (
        <Home home={home} me={me} names={names} openGroup={openGroup} setModal={setModal} />
      )}
      <Modals modal={modal} ctx={ctx} g={g} members={members} gd={gd} />
      <Toast msg={toast} />
    </div>
  )
}

function Home({ home, me, names, openGroup, setModal }) {
  const bal = (g) => home.balances.find((b) => b.group_id === g.id && b.user_id === me)?.balance_paise || 0
  const total = home.groups.reduce((a, g) => a + bal(g), 0)
  return (
    <>
      <div className="row">
        <h1 className="sp">Your groups</h1>
        <button className="rnd" aria-label="Account" onClick={() => setModal({ t: 'acct' })}>
          <Avatar id={me} name={names[me]} size={38} />
        </button>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="mut sm">Overall</div>
        <div className={`big ${tone(total)}`}>{fmt(total)}</div>
        <div className="mut sm">{total > 0 ? 'in total, others owe you' : total < 0 ? 'in total, you owe others' : 'all settled'}</div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn sp" onClick={() => setModal({ t: 'new' })}>Create group</button>
        <button className="btn o sp" onClick={() => setModal({ t: 'join' })}>Join with code</button>
      </div>
      <h2>Groups</h2>
      {home.groups.length === 0 && <p className="mut">No groups yet. Create one or join with an invite code.</p>}
      {home.groups.map((g) => {
        const n = bal(g)
        return (
          <div className="card" key={g.id}>
            <button className="tap" onClick={() => openGroup(g.id)}>
              <div className="av" style={{ background: 'var(--soft)', fontSize: 20, width: 44, height: 44 }}>{g.emoji}</div>
              <div className="sp">
                <div className="b">{g.name}</div>
                <div className="mut sm">{g.group_members.length} {g.group_members.length === 1 ? 'member' : 'members'}</div>
              </div>
              <div className={`${tone(n)} b sm`} style={{ textAlign: 'right' }}>{posText(n)}</div>
            </button>
          </div>
        )
      })}
    </>
  )
}
