import {emptyData, validateData, applyOperation, same} from './core.js';

export class ApiError extends Error {
  constructor(status) {
    super(({401: '令牌无效或已到期，请重新连接。', 403: '没有访问权限或请求额度已用完，请检查令牌权限后重试。',
      404: '找不到仓库或文件，请检查仓库名称和令牌的仓库访问范围。',
      409: '云端正在更新，请稍后重试。', 422: '文件版本或分支已改变，请重新读取后重试。'})[status] || `GitHub 请求失败（${status}），请稍后重试。`);
    this.status = status;
  }
}
export function encodeText(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 16384) binary += String.fromCharCode(...bytes.subarray(index, index + 16384));
  return btoa(binary);
}
export function decodeText(encoded) {
  return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(encoded.replace(/\s/g, '')), char => char.charCodeAt(0)));
}
export class GitHubStore {
  constructor(owner, repo, token, request = (...args) => fetch(...args)) {
    if (!/^[a-zA-Z0-9-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo) || !token.trim()) throw new Error('请填写正确的用户名、仓库名和令牌。');
    this.url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    this.token = token.trim();
    this.request = request;
    this.branch = '';
  }
  async api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.request(this.url + path, {
        ...options, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? {'Content-Type': 'application/json'} : {})},
      });
      if (!response.ok) throw new ApiError(response.status);
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error('未能确认云端结果：网络连接失败或超时。草稿仍保留，可以重试；不会重复创建同一条记录。');
    } finally { clearTimeout(timer); }
  }
  async checkPrivate() {
    const repo = await this.api('');
    if (repo.private !== true) throw new Error('数据仓库必须设为 Private（私有）。已停止读写，请检查仓库设置。');
    if (repo.archived) throw new Error('数据仓库已归档，无法保存。');
    this.branch = repo.default_branch;
  }
  async read() {
    await this.checkPrivate();
    try {
      const file = await this.api(`/contents/weekly-data.json?ref=${encodeURIComponent(this.branch)}`);
      if (file.type !== 'file' || file.encoding !== 'base64' || !file.content) throw new Error('记录文件过大或格式不受支持，请先下载备份检查。');
      return {data: validateData(JSON.parse(decodeText(file.content))), sha: file.sha};
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return {data: emptyData(), sha: null};
      throw error;
    }
  }
  async write(snapshot, data) {
    validateData(data);
    const text = JSON.stringify(data, null, 2) + '\n';
    if (new TextEncoder().encode(text).length > 900000) throw new Error('记录文件接近容量限制，请先导出备份并联系维护者扩容。');
    const payload = {message: '更新目标周报记录', content: encodeText(text), branch: this.branch};
    if (snapshot.sha) payload.sha = snapshot.sha;
    await this.api('/contents/weekly-data.json', {method: 'PUT', body: JSON.stringify(payload)});
    return data;
  }
  async save(operation) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const snapshot = await this.read();
      const data = applyOperation(snapshot.data, operation);
      if (same(data, snapshot.data)) return data;
      try { return await this.write(snapshot, data); }
      catch (error) {
        if (!(error instanceof ApiError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
  }
  async importEmpty(data) {
    validateData(data);
    const snapshot = await this.read();
    if (same(snapshot.data, data)) return data;
    if (snapshot.data.goals.length || snapshot.data.entries.length || snapshot.data.reports.length)
      throw new Error('云端已有记录，已停止导入，避免覆盖。导入只允许用于空的数据仓库。');
    return this.write(snapshot, data);
  }
}
