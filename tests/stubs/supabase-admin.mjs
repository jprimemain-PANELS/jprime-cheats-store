// Test double for lib/supabase-admin.ts. No network, no database.
export const state = { handler: () => ({ data: [], error: null }), ops: [] };

function builder(table) {
  const op = { table, filters: [], update: null, single: false, range: null };
  const b = {
    select() { return b; },
    eq(column, value) { op.filters.push(["eq", column, value]); return b; },
    ilike(column, value) { op.filters.push(["ilike", column, value]); return b; },
    order() { return b; },
    limit() { return b; },
    range(from, to) { op.range = [from, to]; return b; },
    update(values) { op.update = values; return b; },
    maybeSingle() { op.single = true; return b; },
    then(resolve, reject) {
      state.ops.push(op);
      return Promise.resolve(state.handler(op)).then(resolve, reject);
    },
  };
  return b;
}

export const supabaseAdmin = { from: (table) => builder(table) };
