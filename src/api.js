import { supabase } from './supabase'

const ok = ({ data, error }) => {
  if (error) throw error
  return data
}

export async function loadHome() {
  const [g, p, b] = await Promise.all([
    supabase.from('groups').select('id,name,emoji,join_code,created_by,group_members(user_id)').order('created_at'),
    supabase.from('profiles').select('id,name'),
    supabase.from('group_balances').select('group_id,user_id,balance_paise'),
  ])
  return {
    groups: ok(g),
    names: Object.fromEntries(ok(p).map((x) => [x.id, x.name])),
    balances: ok(b),
  }
}

export async function loadGroup(id) {
  const [e, s] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,description,amount_paise,paid_by,created_by,created_at,expense_splits(user_id,share_paise)')
      .eq('group_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('id,from_user,to_user,amount_paise,created_by,created_at')
      .eq('group_id', id)
      .order('created_at', { ascending: false }),
  ])
  return { expenses: ok(e), settlements: ok(s) }
}

const rpc = async (fn, args) => ok(await supabase.rpc(fn, args))

export const createGroup = (name, emoji) => rpc('create_group', { p_name: name, p_emoji: emoji })
export const joinGroup = (code) => rpc('join_group', { p_code: code })
export const resetCode = (group) => rpc('reset_join_code', { p_group: group })
export const leaveGroup = (group) => rpc('leave_group', { p_group: group })
export const removeMember = (group, user) => rpc('remove_member', { p_group: group, p_user: user })
export const addExpense = (group, description, amount, paidBy, splits) =>
  rpc('add_expense', { p_group: group, p_description: description, p_amount: amount, p_paid_by: paidBy, p_splits: splits })
export const updateExpense = (id, description, amount, paidBy, splits) =>
  rpc('update_expense', { p_expense: id, p_description: description, p_amount: amount, p_paid_by: paidBy, p_splits: splits })
export const addSettlement = (group, from, to, amount) =>
  rpc('add_settlement', { p_group: group, p_from: from, p_to: to, p_amount: amount })

async function del(table, id, code = 'not_your_expense') {
  const rows = ok(await supabase.from(table).delete().eq('id', id).select('id'))
  if (!rows.length) throw new Error(code)
}
export const deleteExpense = (id) => del('expenses', id)
export const deleteSettlement = (id) => del('settlements', id)
export const deleteGroup = (id) => del('groups', id, 'not_creator')

export const renameSelf = async (id, name) => ok(await supabase.from('profiles').update({ name }).eq('id', id))
