import {FIELDS, STATUSES, GOAL_STATUSES, emptyData, clone, localDay, validDay, weekBounds, shiftDay, weeklyEntries, sectionItems, renderReport, validateData, ConflictError} from './core.js';
import {GitHubStore} from './github.js';

const app = document.querySelector('#app');
const defaults = {owner: 'yuxiaoling1998-wq', repo: 'weekly-report-data'};
const storageGet = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
let config = {...defaults, ...storageGet('weekly-report.connection')};
let data = emptyData(), store = null, busy = false, pendingImport = null;
const bases = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const uid = () => crypto.randomUUID();
const options = (values, selected) => values.map(value => `<option${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');
const storageSet = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const storageRemove = key => { try { localStorage.removeItem(key); } catch {} };
const draftKey = form => `weekly-report.draft:${config.owner}/${config.repo}:${form.dataset.key}`;
function notify(message, error = false) {
  const node = document.querySelector('#notice');
  node.textContent = message; node.className = error ? 'notice error' : 'notice'; node.hidden = !message;
}
function connection(message) {
  document.querySelector('#connection').textContent = message || (store ? `已连接 · ${config.owner}/${config.repo}` : '尚未连接');
  document.querySelector('#refresh').hidden = !store;
}
async function run(task) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('button, input, select, textarea')];
  const wasDisabled = controls.map(control => control.disabled);
  controls.forEach(control => control.disabled = true);
  document.body.setAttribute('aria-busy', 'true');
  try { await task(); }
  catch (error) { notify(error.message || '操作失败，请稍后重试。', true); }
  finally {
    controls.forEach((control, index) => control.disabled = wasDisabled[index]);
    document.body.removeAttribute('aria-busy'); busy = false; connection();
  }
}
function saveDraft(form) {
  if (!form.dataset.key) return;
  const values = Object.fromEntries(new FormData(form));
  const previous = storageGet(draftKey(form));
  if (!storageSet(draftKey(form), {values, base: bases.get(form) ?? null, operationValue: previous?.operationValue})) {
    notify('浏览器无法保存本地草稿，请保持本页打开，并复制重要内容备份。', true);
  }
}
function bindForms() {
  for (const form of app.querySelectorAll('form[data-key]')) {
    const collection = form.dataset.collection;
    const original = data[collection].find(item => item.id === form.elements.id.value) || null;
    bases.set(form, original ? clone(original) : null);
    const draft = storageGet(draftKey(form));
    if (draft?.values) {
      for (const [name, value] of Object.entries(draft.values)) {
        const input = form.elements.namedItem(name);
        if (input && typeof value === 'string') input.value = value;
      }
      bases.set(form, draft.base ?? null);
      form.querySelector('.draft-note').textContent = '已恢复本机未提交的草稿；尚未保存到 GitHub。';
    }
  }
}
function settingsPage() {
  return `<section class="card setup"><span class="eyebrow">跨设备记录</span><h2>连接你的私有记录仓库</h2>
    <p class="muted">Mac 和 Windows 打开同一网址，连接同一个数据仓库，即可继续记录。</p>
    <form id="connect-form">
      <div class="row"><div><label for="owner">GitHub 用户名</label><input id="owner" name="owner" value="${esc(config.owner)}" required autocomplete="off"></div>
      <div><label for="repo">私有数据仓库</label><input id="repo" name="repo" value="${esc(config.repo)}" required autocomplete="off"></div></div>
      <label for="token">仓库访问令牌</label><input id="token" name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="Fine-grained personal access token">
      <p class="muted small">令牌仅保留在当前页面内存中，刷新或关闭页面后需要重新填写。不要在共享电脑的密码管理器中保存。令牌不会写入网页代码或记录文件。</p>
      <div class="actions"><button type="submit">连接并读取记录</button>${store ? '<button type="button" class="secondary" data-action="disconnect">断开连接</button>' : ''}</div>
    </form>
    <details><summary>第一次使用：如何配置？</summary><ol>
      <li>在 GitHub 创建 <strong>Private</strong> 仓库 <code>weekly-report-data</code>，勾选 Add a README file。</li>
      <li>进入 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens。</li>
      <li>新建令牌，只选择这个数据仓库，授予 Contents 的 Read and write 权限，并设置有效期。</li>
      <li>在这里填写令牌，连接后可以创建目标，或导入现有记录。令牌到期后用新令牌重新连接。</li>
    </ol></details>
  </section>
  ${store ? `<section class="card"><h2>迁移与备份</h2><p class="muted">首次迁移请选择导出的 <code>weekly-data.json</code>。仅允许导入到没有记录的仓库。</p>
    <label for="import-file">选择迁移文件</label><input id="import-file" type="file" accept=".json,application/json">
    <div id="import-preview"></div><div class="actions"><button data-action="backup" class="secondary">下载完整数据备份</button></div></section>` : ''}
  <section class="card"><h2>本机草稿</h2><p class="muted">未提交的输入会保存在此浏览器中，不会自动上传。连接后可恢复；使用共享电脑时，请在离开前清除草稿。</p>
    <button class="secondary" data-action="clear-drafts">清除当前仓库的本机草稿</button>
  </section>`;
}
function goalForm(goal = null) {
  return `<form data-key="goal:${goal?.id || 'new'}" data-collection="goals" data-kind="goal">
    <input name="id" type="hidden" value="${esc(goal?.id || uid())}">
    <label>目标名称 *</label><input name="title" required value="${esc(goal?.title || '')}" placeholder="例如：建立可重复的数据分析流程">
    <div class="row"><div><label>目标说明</label><textarea name="description" placeholder="为什么做？希望解决什么问题？">${esc(goal?.description || '')}</textarea></div>
    <div><label>完成标准</label><textarea name="success_criteria" placeholder="怎样才算完成？">${esc(goal?.success_criteria || '')}</textarea></div></div>
    <label>目标状态</label><select name="status">${options(GOAL_STATUSES, goal?.status || '进行中')}</select>
    <p class="draft-note muted small"></p><div class="actions"><button>${goal ? '保存目标修改' : '创建目标页面'}</button></div></form>`;
}
function homePage() {
  const goals = [...data.goals].sort((a, b) => (a.status !== '进行中') - (b.status !== '进行中') || a.created_at.localeCompare(b.created_at));
  return `<span class="eyebrow">目标首页</span><h2 class="page-title">你正在推进什么？</h2><p class="muted">每个目标都有独立页面，留下每天的进展与思考。</p>
    <div class="goal-grid">${goals.map(goal => {
      const entries = data.entries.filter(entry => entry.goal_id === goal.id);
      const latest = entries.map(entry => entry.day).sort().at(-1);
      return `<a class="goal-card" href="#goal/${esc(goal.id)}"><span class="pill">${esc(goal.status)}</span><h2>${esc(goal.title)}</h2>
      <div class="muted prose">${esc(goal.description || goal.success_criteria || '还没有补充目标说明')}</div>
      <div class="goal-meta"><span>本周 ${weeklyEntries(data, localDay(), goal.id).length} 条记录</span><span>${latest ? '最后更新 ' + esc(latest) : '尚无记录'} →</span></div></a>`;
    }).join('') || '<div class="card empty">还没有目标。创建第一个目标，或在连接设置中导入已有记录。</div>'}</div>
    <section class="card"><h2>创建新目标</h2>${goalForm()}</section>`;
}
function entryForm(goal, entry = null) {
  return `<form data-key="entry:${entry?.id || 'new-' + goal.id}" data-collection="entries" data-kind="entry">
    <input type="hidden" name="id" value="${esc(entry?.id || uid())}"><input type="hidden" name="goal_id" value="${esc(goal.id)}">
    <label>日期</label><input type="date" name="day" required value="${esc(entry?.day || localDay())}">
    ${FIELDS.map(([key, label]) => `<label>${label}${key === 'progress' ? ' *' : ''}</label><textarea name="${key}" ${key === 'progress' ? 'required' : ''}>${esc(entry?.[key] || '')}</textarea>`).join('')}
    <label>状态</label><select name="status">${options(STATUSES, entry?.status || '推进中')}</select>
    <p class="draft-note muted small"></p><div class="actions"><button>${entry ? '保存修改' : '保存到这个目标'}</button></div></form>`;
}
function summaryHtml(entries) {
  return `<div class="summary-grid">${FIELDS.map(([key, , label]) => {
    const items = sectionItems(entries, key);
    return `<div><h3>${label}</h3>${items.length ? '<ul>' + items.map(item => `<li class="prose">${esc(item)}</li>`).join('') + '</ul>' : '<p class="muted">暂无记录</p>'}</div>`;
  }).join('')}</div>`;
}
function goalPage(id) {
  const goal = data.goals.find(item => item.id === id);
  if (!goal) return '<section class="card">找不到这个目标。请读取最新记录，或返回所有目标。</section>';
  const entries = data.entries.filter(entry => entry.goal_id === id).sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`));
  const days = [...new Set(entries.map(entry => entry.day))];
  const weeks = [...new Set(entries.map(entry => weekBounds(entry.day)[0]))];
  const current = weeklyEntries(data, localDay(), id);
  const stats = [[new Set(current.map(entry => entry.day)).size, '本周记录天数'], [current.length, '本周工作条目'], [current.filter(entry => entry.status === '完成').length, '本周完成'], [current.filter(entry => sectionItems([entry], 'problem').length).length, '本周问题条目']];
  return `<a href="#home">← 所有目标</a><div class="title-block"><span class="eyebrow">目标页面</span><h2 class="page-title">${esc(goal.title)}</h2><span class="pill">${esc(goal.status)}</span></div>
    <div class="stats">${stats.map(([value, label]) => `<div class="stat"><strong>${value}</strong>${label}</div>`).join('')}</div>
    <div class="goal-layout"><div><section class="card"><h2>目标定义</h2><h3>目标说明</h3><p class="prose">${esc(goal.description || '尚未填写')}</p><h3>完成标准</h3><p class="prose">${esc(goal.success_criteria || '尚未填写')}</p>
    <details><summary>编辑目标</summary>${goalForm(goal)}</details></section>
    <section class="card"><h2>每天的记录</h2>${days.map(day => `<section class="day"><h3>${day}</h3>${entries.filter(entry => entry.day === day).map(entry => `<article class="entry"><div class="entry-head"><strong>${esc(entry.time)}</strong><span><span class="pill">${esc(entry.status)}</span> <a href="#edit/${esc(entry.id)}">编辑</a></span></div>
    ${FIELDS.map(([key, label]) => `<p class="detail prose"><strong>${label}：</strong>${esc(entry[key] || '未记录')}</p>`).join('')}</article>`).join('')}</section>`).join('') || '<p class="empty">还没有记录，写下今天的第一步。</p>'}</section>
    <h2>每周自动汇总</h2>${weeks.map(start => `<section class="card week-summary"><h3>${start} — ${shiftDay(start, 6)}</h3>${summaryHtml(weeklyEntries(data, start, id))}</section>`).join('') || '<p class="muted">保存每日记录后，这里会自动汇总。</p>'}</div>
    <aside><section class="card"><h2>每日记录</h2>${entryForm(goal)}</section></aside></div>`;
}
function editPage(id) {
  const entry = data.entries.find(item => item.id === id);
  const goal = data.goals.find(item => item.id === entry?.goal_id);
  if (!entry || !goal) return '<section class="card">找不到这条记录，请读取最新记录。</section>';
  return `<a href="#goal/${esc(goal.id)}">← 返回 ${esc(goal.title)}</a><section class="card title-block"><h2>编辑 ${esc(entry.day)} 的记录</h2>${entryForm(goal, entry)}</section>`;
}
function reportPage(day) {
  const [start, end] = weekBounds(validDay(day) ? day : localDay());
  const saved = data.reports.find(report => report.id === start);
  return `<div class="week-nav"><a href="#report/${shiftDay(start, -7)}">← 上一周</a><strong>${start} — ${end}</strong><a href="#report/${shiftDay(start, 7)}">下一周 →</a></div>
    <section class="card"><div class="actions"><button data-action="save-report" data-day="${start}">保存 / 重新生成到云端</button><button class="secondary" data-action="download-report" data-day="${start}">下载 Markdown</button></div>
    <p class="muted small">下方根据已读取的每日记录汇总。其他设备刚有更新时，请先读取最新记录。</p><pre class="report">${esc(renderReport(data, start))}</pre>
    ${saved ? `<details><summary>查看上次保存的周报</summary><pre class="report">${esc(saved.markdown)}</pre></details>` : ''}</section>`;
}
function render() {
  const [route = 'home', id = ''] = location.hash.slice(1).split('/');
  if (!store || route === 'settings') app.innerHTML = settingsPage();
  else if (route === 'goal') app.innerHTML = goalPage(id);
  else if (route === 'edit') app.innerHTML = editPage(id);
  else if (route === 'report') app.innerHTML = reportPage(id);
  else app.innerHTML = homePage();
  bindForms(); connection();
  // Associate every visible form label with its control.
  app.querySelectorAll('form').forEach((form, index) => {
    form.querySelectorAll('label').forEach((label, number) => {
      const control = label.nextElementSibling;
      if (!label.htmlFor && control?.matches('input, textarea, select')) {
        control.id ||= `field-${index}-${number}`; label.htmlFor = control.id;
      }
    });
  });
}
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function describe(value) {
  if (!value) return '云端没有这条记录。';
  const labels = {title: '目标名称', description: '目标说明', success_criteria: '完成标准', status: '状态', day: '日期', markdown: '周报', ...Object.fromEntries(FIELDS.map(([key, label]) => [key, label]))};
  return Object.entries(labels).filter(([key]) => key in value).map(([key, label]) => `${label}：${value[key]}`).join('\n\n');
}
function conflictDialog(error, operation, onSuccess) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<h2>这条记录在另一台设备更新了</h2><p>两个版本均未被覆盖。请选择要保留的版本。</p><div class="row"><section><h3>云端最新版本</h3><pre class="report">${esc(describe(error.current))}</pre></section><section><h3>本机待保存版本</h3><pre class="report">${esc(describe(operation.value))}</pre></section></div>
    <div class="actions"><button data-choice="mine">确认使用我的版本</button><button data-choice="cloud" class="secondary">保留云端版本</button><button data-choice="cancel" class="secondary">返回继续编辑</button></div>`;
  document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', event => {
    const choice = event.target.closest('[data-choice]')?.dataset.choice;
    if (!choice || busy) return;
    dialog.close();
    if (choice === 'mine') run(() => persist({...operation, base: error.current}, onSuccess));
    if (choice === 'cloud') run(async () => { data = (await store.read()).data; onSuccess(); render(); notify('已保留云端版本。'); });
  });
}
async function persist(operation, onSuccess = () => {}) {
  connection('正在保存到 GitHub……');
  try {
    data = await store.save(operation);
    onSuccess(); render(); notify('已保存到 GitHub。其他设备读取最新记录后即可看到。');
  } catch (error) {
    if (error instanceof ConflictError) conflictDialog(error, operation, onSuccess);
    else throw error;
  }
}
app.addEventListener('input', event => {
  const form = event.target.closest('form[data-key]');
  if (!form) return;
  saveDraft(form); form.querySelector('.draft-note').textContent = '草稿仅保存在本机，点击保存后才会上传。';
});
app.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  if (form.id === 'connect-form') {
    run(async () => {
      const next = new GitHubStore(values.owner.trim(), values.repo.trim(), values.token);
      const snapshot = await next.read();
      store = next; data = snapshot.data;
      config = {owner: values.owner.trim(), repo: values.repo.trim()};
      storageSet('weekly-report.connection', config);
      form.reset(); location.hash = '#home'; render(); notify('已读取云端最新记录。');
    });
    return;
  }
  if (!store || !form.dataset.collection) return;
  saveDraft(form);
  const base = bases.get(form) ?? null;
  let value;
  if (form.dataset.kind === 'goal') {
    if (!values.title.trim()) return notify('请填写目标名称。', true);
    value = {...(base || {}), id: values.id, title: values.title.trim(), description: values.description.trim(), success_criteria: values.success_criteria.trim(), status: values.status, created_at: base?.created_at || new Date().toISOString()};
  } else {
    if (!values.progress.trim() || !validDay(values.day)) return notify('请填写今日进展和有效日期。', true);
    const now = new Date();
    value = {...(base || {}), ...values, time: base?.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`};
    FIELDS.forEach(([key]) => value[key] = value[key].trim());
  }
  // Persist timestamps along with the draft so retrying an uncertain save is idempotent.
  const previous = storageGet(draftKey(form));
  if (previous?.operationValue && previous.operationValue.id === value.id) {
    if (!base && value.created_at) value.created_at = previous.operationValue.created_at;
    if (!base && value.time) value.time = previous.operationValue.time;
  }
  storageSet(draftKey(form), {...previous, operationValue: value});
  run(() => persist({collection: form.dataset.collection, base, value}, () => {
    storageRemove(draftKey(form)); location.hash = `#goal/${form.dataset.kind === 'goal' ? value.id : value.goal_id}`;
  }));
});
app.addEventListener('change', event => {
  if (event.target.id !== 'import-file') return;
  const file = event.target.files[0]; pendingImport = null;
  const preview = document.querySelector('#import-preview'); preview.textContent = '';
  if (!file) return;
  run(async () => {
    if (file.size > 900000) throw new Error('文件过大，无法导入。');
    pendingImport = validateData(JSON.parse(await file.text()));
    preview.innerHTML = `<p>文件包含 ${pendingImport.goals.length} 个目标、${pendingImport.entries.length} 条记录、${pendingImport.reports.length} 份已保存周报。</p><button data-action="import">确认导入到私有仓库</button>`;
  });
});
document.addEventListener('click', event => {
  if (busy && event.target.closest('a')) { event.preventDefault(); return; }
  const button = event.target.closest('[data-action], #refresh');
  if (!button || busy) return;
  const action = button.id === 'refresh' ? 'refresh' : button.dataset.action;
  if (action === 'disconnect') { store = null; data = emptyData(); pendingImport = null; render(); notify('已断开，令牌已从页面内存移除。本机草稿仍保留，可按需清除。'); return; }
  if (action === 'clear-drafts') {
    const prefix = `weekly-report.draft:${config.owner}/${config.repo}:`;
    try { Object.keys(localStorage).filter(key => key.startsWith(prefix)).forEach(storageRemove); notify('当前仓库的本机草稿已清除。'); }
    catch { notify('浏览器不允许访问本地存储。', true); }
    return;
  }
  if (!store) return;
  if (action === 'refresh') run(async () => { data = (await store.read()).data; render(); notify('已读取最新记录，未提交的草稿仍保留。'); });
  if (action === 'backup') download(`weekly-backup-${localDay()}.json`, JSON.stringify(data, null, 2));
  if (action === 'download-report') download(`${button.dataset.day}_weekly.md`, renderReport(data, button.dataset.day), 'text/markdown;charset=utf-8');
  if (action === 'save-report') {
    const day = button.dataset.day;
    run(() => persist({collection: 'reports', base: data.reports.find(item => item.id === day) || null, value: {id: day, markdown: renderReport(data, day)}}));
  }
  if (action === 'import' && pendingImport) run(async () => { data = await store.importEmpty(pendingImport); pendingImport = null; location.hash = '#home'; render(); notify('已有记录已导入到私有仓库。'); });
});
window.addEventListener('hashchange', () => { if (!busy) render(); });
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
render();
