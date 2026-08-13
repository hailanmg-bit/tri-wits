/* Supabase 配置与轻量 REST 客户端（公开的 publishable key，可安全放前端）
 * 表结构见发布说明中的 SQL；RLS 权限只开放 anon 的 insert/select。 */
window.SUPABASE_CONFIG = {
  url: 'https://bkzhznayvwvjjxaupmvm.supabase.co',
  publishableKey: 'sb_publishable_1K0Jib_7u0mudE02E7jQ2g_p6QFeoMi'
};

window.SUPABASE = (function(){
  const cfg = window.SUPABASE_CONFIG;
  function headers(){
    return {
      'apikey': cfg.publishableKey,
      'Authorization': 'Bearer ' + cfg.publishableKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
  }
  async function insert(table, rows){
    const res = await fetch(cfg.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(rows)
    });
    if (!res.ok) throw new Error('supabase insert ' + table + ' HTTP ' + res.status);
    return true;
  }
  async function selectRows(table, params){
    const q = new URLSearchParams(params || {});
    const res = await fetch(cfg.url + '/rest/v1/' + table + (q.toString() ? ('?' + q.toString()) : ''), {
      headers: headers()
    });
    if (!res.ok) throw new Error('supabase select ' + table + ' HTTP ' + res.status);
    return res.json();
  }
  return { insert: insert, selectRows: selectRows };
})();
