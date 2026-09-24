export const FIELDS = [
  ['progress', '今日进展', '本周进展'], ['insight', '今日认识', '本周认识'],
  ['problem', '今日问题', '本周问题'], ['next_thought', '下一步思考', '下一步思考'],
];
export const STATUSES = ['推进中', '完成', '受阻', '搁置'];
export const GOAL_STATUSES = ['进行中', '已完成', '暂停'];
export const emptyData = () => ({version: 1, goals: [], entries: [], reports: []});
export const clone = value => JSON.parse(JSON.stringify(value));
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function shiftDay(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function weekBounds(day) {
  if (!validDay(day)) throw new Error('日期格式不正确');
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const start = shiftDay(day, -((weekday + 6) % 7));
  return [start, shiftDay(start, 6)];
}
export function validateData(data) {
  if (!data || data.version !== 1) throw new Error('记录文件版本不支持，未修改云端数据。');
  for (const key of ['goals', 'entries', 'reports']) {
    if (!Array.isArray(data[key])) throw new Error('记录文件格式不正确，未修改云端数据。');
    const ids = new Set();
    for (const item of data[key]) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id))
        throw new Error('记录 ID 缺失或重复，未修改云端数据。');
      ids.add(item.id);
    }
  }
  const strings = (item, keys) => keys.every(key => typeof item[key] === 'string');
  for (const goal of data.goals) {
    if (!strings(goal, ['title', 'description', 'success_criteria', 'status', 'created_at']) ||
        !goal.title.trim() || !GOAL_STATUSES.includes(goal.status)) throw new Error('目标格式不正确');
  }
  const goalIds = new Set(data.goals.map(goal => goal.id));
  for (const entry of data.entries) {
    if (!strings(entry, ['goal_id', 'day', 'time', 'status', ...FIELDS.map(([key]) => key)]) ||
        !goalIds.has(entry.goal_id) || !validDay(entry.day) || !STATUSES.includes(entry.status))
      throw new Error('每日记录格式不正确或缺少所属目标');
  }
  for (const report of data.reports) {
    if (!validDay(report.id) || typeof report.markdown !== 'string') throw new Error('周报格式不正确');
  }
  return data;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
export class ConflictError extends Error {
  constructor(current) { super('这条内容已在其他设备更新。请比较两个版本后选择。'); this.current = current; }
}
// Only apply the intended entity change. Preserve other devices' unrelated writes.
export function applyOperation(data, operation) {
  validateData(data);
  if (!['goals', 'entries', 'reports'].includes(operation.collection)) throw new Error('操作无效');
  const result = clone(data);
  const list = result[operation.collection];
  const index = list.findIndex(item => item.id === operation.value.id);
  const current = index < 0 ? null : list[index];
  if (same(current, operation.value)) return result; // Safe retry after an uncertain response.
  if (!same(current, operation.base)) throw new ConflictError(current);
  if (index < 0) list.push(clone(operation.value));
  else list[index] = clone(operation.value);
  return validateData(result);
}
export function weeklyEntries(data, day, goalId) {
  const [start, end] = weekBounds(day);
  return data.entries.filter(entry => entry.day >= start && entry.day <= end && (!goalId || entry.goal_id === goalId))
    .sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));
}
export function sectionItems(entries, key) {
  return [...new Set(entries.map(entry => entry[key] || (key === 'problem' && entry.status === '受阻' ? '记录标记为受阻，尚未填写具体问题' : '')).map(text => text.trim()).filter(Boolean))];
}
export function renderReport(data, day) {
  const [start, end] = weekBounds(day);
  const entries = weeklyEntries(data, day);
  const ids = [...new Set(entries.map(entry => entry.goal_id))];
  const bullet = values => values.length ? values.map(value => `- ${value.replace(/\n/g, '\n  ')}`).join('\n') : '- 暂无记录';
  const lines = [`# 周报：${start} 至 ${end}`, '', '## 本周概览', '',
    `- 记录天数：${new Set(entries.map(entry => entry.day)).size} 天`, `- 工作条目：${entries.length} 条`,
    `- 已完成条目：${entries.filter(entry => entry.status === '完成').length} 条`, `- 涉及项目：${ids.length} 个`, '',
    '## 本周目标', '', bullet(data.goals.filter(goal => goal.status === '进行中').map(goal => goal.title)), ''];
  for (const [key, , label] of FIELDS) {
    lines.push(`## ${label}`, '');
    if (!ids.length) lines.push('- 暂无记录', '');
    for (const id of ids) {
      lines.push(`### ${data.goals.find(goal => goal.id === id)?.title || '未命名目标'}`, '',
        bullet(sectionItems(entries.filter(entry => entry.goal_id === id), key)), '');
    }
  }
  return lines.join('\n');
}
