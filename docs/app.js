const STORAGE_KEY = 'media-ip-tracker-v2-saved';
const TMDB_TOKEN_KEY = 'media-ip-tracker-v2-tmdb-token';
const mediaOrder = ['漫画', 'アニメ', 'ドラマ', '映画', '小説', '類似作品', '同ジャンル作品', '出典'];
const providers = [
  ['Netflixで探す', 'https://www.netflix.com/search?q='],
  ['Amazonで探す', 'https://www.amazon.co.jp/s?k='],
  ['Prime Videoで探す', 'https://www.amazon.co.jp/s?k='],
  ['楽天ブックスで探す', 'https://books.rakuten.co.jp/search?sitem='],
  ['Google Booksで探す', 'https://www.google.com/search?tbm=bks&q='],
  ['JustWatchで探す', 'https://www.justwatch.com/jp/search?q='],
  ['Filmarksで探す', 'https://filmarks.com/search?utf8=%E2%9C%93&q=']
];
let saved = [];
let lastResult = null;
let currentResultGroupId = null;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const scriptAttr = code => esc(code);

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeGroups(Array.isArray(raw) ? raw : raw?.saved || []);
  } catch { return []; }
}
function persistSaved() { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
function normalizeGroups(records) {
  const groups = records.map(record => record.items ? normalizeGroup(record) : legacyItemToGroup(record));
  return groups.map(normalizeGroup);
}
function normalizeGroup(group) {
  return {
    id: group.id || uid('group'),
    title: group.title || 'Untitled',
    isFavorite: Boolean(group.isFavorite),
    savedAt: group.savedAt || new Date().toISOString(),
    updatedAt: group.updatedAt || group.savedAt || new Date().toISOString(),
    items: (group.items || []).map(normalizeItem)
  };
}
function legacyItemToGroup(item) {
  return normalizeGroup({id: uid('group'), title: item.title || 'Untitled', isFavorite: Boolean(item.isFavorite), savedAt: item.savedAt, items: [item]});
}
function normalizeItem(item) {
  const media = item.media || item.mediaType || '漫画';
  return {...item, id: item.id || uid('item'), media, status: validStatus(media, item.status) ? item.status : defaultStatus(media)};
}
function defaultStatus(media) { return isReadingMedia(media) ? '未読' : '未視聴'; }
function isReadingMedia(media) { return media === '漫画' || media === '小説'; }
function statusOptions(media) { return isReadingMedia(media) ? ['未読', '読みたい', '途中', '読了済み', '除外'] : ['未視聴', '見たい', '途中', '視聴済み', '除外']; }
function validStatus(media, status) { return statusOptions(media).includes(status); }
function groupKey(title) { return String(title || '').trim().toLowerCase(); }
function findGroupByTitle(title) { return saved.find(group => groupKey(group.title) === groupKey(title)); }
function ensureGroup(title) {
  let group = findGroupByTitle(title);
  if (!group) {
    group = normalizeGroup({id: uid('group'), title, isFavorite: false, items: []});
    saved.unshift(group);
  }
  return group;
}
function findSavedItem(item) {
  return saved.flatMap(group => group.items.map(savedItem => ({group, item: savedItem}))).find(pair => pair.item.id === item.id || (pair.item.sourceUrl && pair.item.sourceUrl === item.sourceUrl));
}
function savedStatusHtml(item) {
  const savedPair = findSavedItem(item);
  if (!savedPair) return '<p class="muted save-note">進捗状態は保存後に設定できます。</p>';
  return statusSelectHtml(savedPair.item, 'results');
}
function statusSelectHtml(item, context) {
  const savedPair = findSavedItem(item);
  const status = savedPair?.item.status || item.status || defaultStatus(item.media);
  const options = statusOptions(item.media).map(option => `<option value="${esc(option)}" ${option === status ? 'selected' : ''}>${esc(option)}</option>`).join('');
  return `<label class="status-control">進捗状態<select onchange="${scriptAttr(`changeItemStatus(${JSON.stringify(item)}, this.value, ${JSON.stringify(context)})`)}">${options}</select></label>`;
}
function route(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  $(`#${name}View`)?.classList.add('active');
  if (name === 'home') renderHomeSavedPreview();
  if (name === 'saved') renderSaved();
  if (name === 'settings') $('#tmdbTokenInput').value = localStorage.getItem(TMDB_TOKEN_KEY) || '';
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function sourceLink(name, url) { return {name, url, checkedAt: new Date().toISOString().slice(0, 10)}; }
function searchLinks(title) { return providers.map(([label, url]) => ({label, url: `${url}${encodeURIComponent(title)}`})); }
function emptyBuckets(query) {
  return {query, overview: [], 漫画: [], アニメ: [], ドラマ: [], 映画: [], 小説: [], similar: [], genres: new Set(), sources: []};
}

async function searchAll(query) {
  const buckets = emptyBuckets(query);
  $('#searchStatus').textContent = '公開データを検索しています…';
  const tasks = [searchAniList(query), searchGoogleBooks(query), searchWikidata(query), searchTmdb(query)];
  const settled = await Promise.allSettled(tasks);
  settled.forEach(result => {
    if (result.status === 'fulfilled') mergeBuckets(buckets, result.value);
    else buckets.sources.push(sourceLink(`検索エラー: ${result.reason.message}`, '#'));
  });
  buckets.sources.push(...['漫画', 'アニメ', 'ドラマ', '映画', '小説'].flatMap(media => buckets[media]).flatMap(item => item.sources || []));
  buckets.sources = uniqueBy(buckets.sources, item => `${item.name}-${item.url}`);
  buckets.genres = Array.from(buckets.genres).slice(0, 16);
  buckets.similar = uniqueBy(buckets.similar, item => `${item.title}-${item.media}`).slice(0, 12);
  return buckets;
}
function mergeBuckets(target, part) {
  ['overview', '漫画', 'アニメ', 'ドラマ', '映画', '小説', 'similar'].forEach(key => target[key].push(...(part[key] || [])));
  (part.genres || []).forEach(genre => target.genres.add(genre));
  target.sources.push(...(part.sources || []));
}
function uniqueBy(items, keyFn) { return [...new Map(items.map(item => [keyFn(item), item])).values()]; }

async function searchAniList(query) {
  const graphql = {query: `query ($search: String) { Page(page: 1, perPage: 8) { media(search: $search, type: ANIME) { id title { romaji english native } format startDate { year } genres siteUrl description(asHtml:false) recommendations(perPage:3) { nodes { mediaRecommendation { title { romaji english native } siteUrl } } } } manga: media(search: $search, type: MANGA) { id title { romaji english native } format startDate { year } genres siteUrl description(asHtml:false) recommendations(perPage:3) { nodes { mediaRecommendation { title { romaji english native } siteUrl } } } } } }`, variables: {search: query}};
  const res = await fetch('https://graphql.anilist.co', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(graphql)});
  if (!res.ok) throw new Error('AniList検索に失敗しました');
  const json = await res.json();
  const out = emptyBuckets(query);
  const convert = (item, media) => ({id: `anilist-${item.id}`, title: pickTitle(item.title), media, year: item.startDate?.year || '', description: stripHtml(item.description || ''), genres: item.genres || [], sourceName: 'AniList', sourceUrl: item.siteUrl, links: searchLinks(pickTitle(item.title)), sources: [sourceLink('AniList', item.siteUrl)]});
  (json.data?.Page?.media || []).forEach(item => { out.アニメ.push(convert(item, 'アニメ')); collectAniListExtras(out, item, 'アニメ'); });
  (json.data?.Page?.manga || []).forEach(item => { out.漫画.push(convert(item, '漫画')); collectAniListExtras(out, item, '漫画'); });
  out.sources.push(sourceLink('AniList GraphQL API', 'https://anilist.gitbook.io/anilist-apiv2-docs/'));
  return out;
}
function collectAniListExtras(out, item, media) {
  (item.genres || []).forEach(genre => out.genres.add(genre));
  (item.recommendations?.nodes || []).forEach(node => {
    const rec = node.mediaRecommendation;
    if (rec) out.similar.push({title: pickTitle(rec.title), media, url: rec.siteUrl, reason: 'AniList recommendations'});
  });
}
function pickTitle(title) { return title?.native || title?.english || title?.romaji || 'Untitled'; }
function stripHtml(text) { return text.replace(/<[^>]+>/g, '').slice(0, 260); }

async function searchGoogleBooks(query) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&langRestrict=ja`);
  if (!res.ok) throw new Error('Google Books検索に失敗しました');
  const json = await res.json();
  const out = emptyBuckets(query);
  (json.items || []).forEach(book => {
    const info = book.volumeInfo || {};
    const categories = info.categories || [];
    const media = categories.join(' ').match(/comic|manga|コミック|漫画/i) ? '漫画' : '小説';
    const item = {id: `gbooks-${book.id}`, title: info.title || query, media, year: (info.publishedDate || '').slice(0, 4), description: (info.description || '').slice(0, 260), genres: categories, sourceName: 'Google Books', sourceUrl: info.infoLink || '#', links: searchLinks(info.title || query), sources: [sourceLink('Google Books', info.infoLink || '#')]};
    out[media].push(item);
    categories.forEach(category => out.genres.add(category));
  });
  out.sources.push(sourceLink('Google Books API', 'https://developers.google.com/books'));
  return out;
}

async function searchWikidata(query) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=ja&uselang=ja&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Wikidata検索に失敗しました');
  const json = await res.json();
  const out = emptyBuckets(query);
  out.overview = (json.search || []).slice(0, 6).map(entity => ({title: entity.label, description: entity.description || 'Wikidata候補', url: entity.concepturi, sourceName: 'Wikidata'}));
  out.sources.push(sourceLink('Wikidata API', 'https://www.wikidata.org/w/api.php'));
  return out;
}

async function searchTmdb(query) {
  const token = localStorage.getItem(TMDB_TOKEN_KEY);
  const out = emptyBuckets(query);
  if (!token) { out.sources.push(sourceLink('TMDb未設定（映画・ドラマ検索はスキップ）', 'https://www.themoviedb.org/settings/api')); return out; }
  const headers = {Authorization: `Bearer ${token}`, accept: 'application/json'};
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=ja-JP&include_adult=false`, {headers});
  if (!res.ok) throw new Error('TMDb検索に失敗しました。Read Access Tokenを確認してください');
  const json = await res.json();
  (json.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 10).forEach(item => {
    const media = item.media_type === 'movie' ? '映画' : 'ドラマ';
    const title = item.title || item.name || query;
    out[media].push({id: `tmdb-${item.media_type}-${item.id}`, title, media, year: (item.release_date || item.first_air_date || '').slice(0, 4), description: item.overview || '', genres: [], sourceName: 'TMDb', sourceUrl: `https://www.themoviedb.org/${item.media_type}/${item.id}`, links: searchLinks(title), sources: [sourceLink('TMDb', `https://www.themoviedb.org/${item.media_type}/${item.id}`)]});
  });
  out.sources.push(sourceLink('TMDb API', 'https://developer.themoviedb.org/docs'));
  return out;
}

function renderResults(data) {
  lastResult = data;
  currentResultGroupId = findGroupByTitle(data.query)?.id || null;
  $('#resultTitle').textContent = data.query;
  $('#resultSummary').textContent = `検索結果は保存不要で閲覧できます。${countResults(data)}件の媒体別候補を表示しています。保存は後から任意で行えます。`;
  $('#toc').innerHTML = mediaOrder.map(label => `<a href="#sec-${esc(label)}">${esc(label)}</a>`).join('');
  $('#resultsContent').innerHTML = [...['漫画','アニメ','ドラマ','映画','小説'].map(media => mediaSection(media, data[media], data.query)), relatedSection('類似作品', data.similar), genreSection(data), sourceSection(data)].join('');
  renderResultFavorite();
  $('#searchStatus').textContent = '検索が完了しました。';
  route('results');
}
function countResults(data) { return ['漫画','アニメ','ドラマ','映画','小説'].reduce((sum, key) => sum + data[key].length, 0); }
function mediaSection(media, items, query) {
  return `<section id="sec-${media}" class="panel"><div class="section-head"><h2>${media}</h2><span class="count">${items.length}件</span></div><div class="card-grid">${items.map(itemCard).join('') || emptyMedia(media, query)}</div></section>`;
}
function itemCard(item) {
  const normalized = normalizeItem(item);
  return `<article class="card"><div class="card-title"><h3>${esc(normalized.title)}</h3><span class="chip">${esc(normalized.media)}</span></div><p class="muted">${esc([normalized.year, normalized.sourceName].filter(Boolean).join(' / '))}</p>${savedStatusHtml(normalized)}<p>${esc(normalized.description || '説明文は取得できませんでした。')}</p><div class="chips">${(normalized.genres || []).slice(0, 5).map(genre => `<span class="chip">${esc(genre)}</span>`).join('')}</div><div class="button-row"><button class="save-button" onclick="${scriptAttr(`saveCandidate(${JSON.stringify(normalized)})`)}">この作品を保存</button><a class="link-button" href="${esc(normalized.sourceUrl)}" target="_blank" rel="noopener">出典リンク</a></div><details open><summary>探すリンク</summary><div class="search-links">${(normalized.links || []).map(link => `<a class="link-button" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join('')}</div></details></article>`;
}
function emptyMedia(media, query) { return `<div class="empty"><strong>候補なし</strong><br>${esc(media)}の検索候補は見つかりませんでした。<div class="search-links single">${searchLinks(query).slice(0, 3).map(link => `<a class="link-button" target="_blank" rel="noopener" href="${esc(link.url)}">${esc(link.label)}</a>`).join('')}</div></div>`; }
function relatedSection(title, items) { return `<section id="sec-${title}" class="panel"><h2>${title}</h2><div class="card-grid small">${items.map(item => `<article class="mini-card"><h3>${esc(item.title)}</h3><p>${esc(item.media)} / ${esc(item.reason)}</p><a href="${esc(item.url)}" target="_blank" rel="noopener">出典を開く</a></article>`).join('') || '<p class="muted">類似作品候補はまだありません。</p>'}</div></section>`; }
function genreSection(data) { return `<section id="sec-同ジャンル作品" class="panel"><h2>同ジャンル作品</h2><p class="muted">ジャンル語から再検索できます。</p><div class="chips genre-links">${data.genres.map(genre => `<button onclick="${scriptAttr(`runSearch(${JSON.stringify(genre)})`)}">${esc(genre)}</button>`).join('') || '<span>ジャンル候補はありません。</span>'}</div></section>`; }
function sourceSection(data) { return `<section id="sec-出典" class="panel"><h2>出典</h2><div class="mini-list">${data.sources.map(src => `<div class="mini-item"><a target="_blank" rel="noopener" href="${esc(src.url)}">${esc(src.name)}</a><small>${esc(src.checkedAt)}</small></div>`).join('')}</div></section>`; }

function saveCandidate(item) {
  const group = ensureGroup(lastResult?.query || item.title);
  const normalized = normalizeItem(item);
  const existing = group.items.find(savedItem => savedItem.id === normalized.id || (savedItem.sourceUrl && savedItem.sourceUrl === normalized.sourceUrl));
  if (existing) Object.assign(existing, normalized, {status: existing.status || normalized.status});
  else group.items.push({...normalized, savedAt: new Date().toISOString(), note: ''});
  group.updatedAt = new Date().toISOString();
  currentResultGroupId = group.id;
  persistSaved();
  renderResultFavorite();
  alert('検索結果の候補を保存しました。お気に入りや進捗状態を保持できます。');
  renderResults(lastResult);
}
function changeItemStatus(item, status, context) {
  const group = ensureGroup(lastResult?.query || item.title);
  const normalized = normalizeItem({...item, status});
  const existing = group.items.find(savedItem => savedItem.id === normalized.id || (savedItem.sourceUrl && savedItem.sourceUrl === normalized.sourceUrl));
  if (existing) existing.status = validStatus(existing.media, status) ? status : defaultStatus(existing.media);
  else group.items.push({...normalized, status: validStatus(normalized.media, status) ? status : defaultStatus(normalized.media), savedAt: new Date().toISOString()});
  group.updatedAt = new Date().toISOString();
  currentResultGroupId = group.id;
  persistSaved();
  if (context === 'detail') renderDetail(saved.findIndex(savedGroup => savedGroup.id === group.id));
  else renderResultFavorite();
}
function renderResultFavorite() {
  const button = $('#resultFavoriteBtn');
  if (!button || !lastResult) return;
  const group = currentResultGroupId ? saved.find(savedGroup => savedGroup.id === currentResultGroupId) : findGroupByTitle(lastResult.query);
  button.textContent = group?.isFavorite ? '★ 作品をお気に入り' : '☆ 作品をお気に入り';
  button.classList.toggle('active', Boolean(group?.isFavorite));
}
function toggleResultFavorite() {
  if (!lastResult) return;
  const group = ensureGroup(lastResult.query);
  group.isFavorite = !group.isFavorite;
  group.updatedAt = new Date().toISOString();
  currentResultGroupId = group.id;
  persistSaved();
  renderResultFavorite();
}
window.saveCandidate = saveCandidate;
window.changeItemStatus = changeItemStatus;
window.runSearch = runSearch;
async function runSearch(query) {
  $('#queryInput').value = query;
  route('results');
  renderResults(await searchAll(query));
}

function renderHomeSavedPreview() {
  const target = $('#homeSavedPreview');
  if (!target) return;
  const recent = saved.slice(0, 3);
  target.innerHTML = recent.length ? recent.map(group => {
    const index = saved.findIndex(savedGroup => savedGroup.id === group.id);
    return `<div class="mini-item"><span><strong>${esc(group.title)}</strong><br><small>${group.items.length}件の媒体候補 / ${group.isFavorite ? 'お気に入り' : '通常'}</small></span><button onclick="renderDetail(${index})">開く</button></div>`;
  }).join('') : '<div class="empty">保存済み作品はまだありません。まず作品名を検索してください。</div>';
}

function renderSaved() {
  const favoriteOnly = $('#favoriteOnlyFilter')?.checked;
  const groups = favoriteOnly ? saved.filter(group => group.isFavorite) : saved;
  $('#savedList').innerHTML = groups.length ? groups.map(group => {
    const index = saved.findIndex(savedGroup => savedGroup.id === group.id);
    const statusChips = group.items.slice(0, 5).map(item => `<span class="chip">${esc(item.media)}: ${esc(item.status)}</span>`).join('');
    return `<article class="card"><div class="card-title"><h2>${esc(group.title)}</h2><button class="favorite-btn ${group.isFavorite ? 'active' : ''}" onclick="toggleSavedFavorite(${index})">${group.isFavorite ? '★' : '☆'}</button></div><div class="chips"><span class="chip">候補 ${group.items.length}件</span>${statusChips}</div><div class="button-row"><button onclick="renderDetail(${index})" class="primary">詳細</button><button onclick="deleteSaved(${index})" class="danger">削除</button></div></article>`;
  }).join('') : '<div class="empty panel">保存済み作品はありません。検索結果から候補を保存できます。</div>';
}
function renderDetail(index) {
  const group = saved[index];
  if (!group) return route('saved');
  $('#detailContent').innerHTML = `<article class="panel stack"><div class="card-title"><div><p class="eyebrow">保存済み作品IP</p><h1 id="detailTitle">${esc(group.title)}</h1></div><button class="favorite-btn ${group.isFavorite ? 'active' : ''}" onclick="toggleSavedFavorite(${index}); renderDetail(${index})">${group.isFavorite ? '★ お気に入り' : '☆ お気に入り'}</button></div><h2>媒体候補と進捗状態</h2><div class="media-list">${group.items.map(item => savedItemHtml(item, index)).join('') || '<p class="muted">媒体候補は未保存です。</p>'}</div><h2>作品名で探す</h2><div class="search-links">${searchLinks(group.title).map(link => `<a class="link-button" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join('')}</div></article>`;
  route('detail');
}
function savedItemHtml(item, groupIndex) {
  const normalized = normalizeItem(item);
  const options = statusOptions(normalized.media).map(option => `<option value="${esc(option)}" ${option === normalized.status ? 'selected' : ''}>${esc(option)}</option>`).join('');
  return `<article class="media-card"><div class="card-title"><h3>${esc(normalized.title)}</h3><span class="chip">${esc(normalized.media)}</span></div><p class="muted">${esc([normalized.year, normalized.sourceName].filter(Boolean).join(' / '))}</p><label class="status-control">進捗状態<select onchange="${scriptAttr(`updateSavedItemStatus(${groupIndex}, ${JSON.stringify(normalized.id)}, this.value)`)}">${options}</select></label><p>${esc(normalized.description || normalized.memo || '')}</p><div class="button-row"><a class="link-button" href="${esc(normalized.sourceUrl || '#')}" target="_blank" rel="noopener">出典</a><button class="danger" onclick="${scriptAttr(`deleteSavedItem(${groupIndex}, ${JSON.stringify(normalized.id)})`)}">候補を削除</button></div></article>`;
}
window.renderDetail = renderDetail;
function toggleSavedFavorite(index) { const group = saved[index]; if (!group) return; group.isFavorite = !group.isFavorite; group.updatedAt = new Date().toISOString(); persistSaved(); renderSaved(); }
function updateSavedItemStatus(groupIndex, itemId, status) { const item = saved[groupIndex]?.items.find(candidate => candidate.id === itemId); if (!item) return; item.status = validStatus(item.media, status) ? status : defaultStatus(item.media); saved[groupIndex].updatedAt = new Date().toISOString(); persistSaved(); }
function deleteSavedItem(groupIndex, itemId) { const group = saved[groupIndex]; if (!group || !confirm('媒体候補を削除しますか？')) return; group.items = group.items.filter(item => item.id !== itemId); group.updatedAt = new Date().toISOString(); persistSaved(); renderDetail(groupIndex); }
function deleteSaved(index) { if (confirm('作品グループを削除しますか？')) { saved.splice(index, 1); persistSaved(); renderSaved(); } }
window.toggleSavedFavorite = toggleSavedFavorite;
window.updateSavedItemStatus = updateSavedItemStatus;
window.deleteSavedItem = deleteSavedItem;
window.deleteSaved = deleteSaved;

function exportJson() {
  const blob = new Blob([JSON.stringify({version: 2, saved}, null, 2)], {type: 'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'media-ip-tracker-v2.json';
  link.click();
  URL.revokeObjectURL(link.href);
  $('#dataMessage').textContent = 'JSONをエクスポートしました。';
}
function importJson() {
  try {
    const data = JSON.parse($('#importText').value);
    saved = normalizeGroups(Array.isArray(data) ? data : data.saved);
    if (!Array.isArray(saved)) throw new Error('saved配列がありません');
    persistSaved();
    $('#dataMessage').textContent = 'JSONをインポートしました。';
    route('saved');
  } catch (error) { $('#dataMessage').textContent = `インポートできませんでした: ${error.message}`; }
}
function setup() {
  saved = loadSaved();
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); route(button.dataset.route); }));
  $('#searchForm').addEventListener('submit', async event => { event.preventDefault(); await runSearch($('#queryInput').value.trim()); });
  $('#saveTokenBtn').onclick = () => { localStorage.setItem(TMDB_TOKEN_KEY, $('#tmdbTokenInput').value.trim()); $('#settingsMessage').textContent = 'TMDb Read Access Tokenを保存しました。'; };
  $('#clearTokenBtn').onclick = () => { localStorage.removeItem(TMDB_TOKEN_KEY); $('#tmdbTokenInput').value = ''; $('#settingsMessage').textContent = 'TMDb設定を削除しました。'; };
  $('#exportBtn').onclick = exportJson;
  $('#importBtn').onclick = importJson;
  $('#clearSavedBtn').onclick = () => { if (confirm('保存済み作品をすべて削除しますか？')) { saved = []; persistSaved(); $('#dataMessage').textContent = '保存済み作品を削除しました。'; } };
  $('#favoriteOnlyFilter').onchange = renderSaved;
  $('#resultFavoriteBtn').onclick = toggleResultFavorite;
  $('#manualAddBtn').onclick = () => $('#manualDialog').showModal();
  $('#homeManualAddBtn').onclick = () => $('#manualDialog').showModal();
  renderHomeSavedPreview();
  $('#manualForm').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    const form = new FormData(event.target);
    saved.unshift(normalizeGroup({id: uid('group'), title: form.get('title'), isFavorite: false, items: [{id: uid('manual'), title: form.get('title'), media: form.get('media'), memo: form.get('memo'), sourceName: '手動補助保存', savedAt: new Date().toISOString()}]}));
    persistSaved();
    event.target.reset();
    renderSaved();
  });
}
setup();
