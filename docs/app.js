const STORAGE_KEY = 'media-ip-tracker-v2-saved';
const TMDB_TOKEN_KEY = 'media-ip-tracker-v2-tmdb-token';
const mediaOrder = ['概要', '漫画', 'アニメ', 'ドラマ', '映画', '小説', '類似作品', '同ジャンル作品', '出典'];
const providers = [
  ['Netflixで探す', 'https://www.netflix.com/search?q='],
  ['Amazonで探す', 'https://www.amazon.co.jp/s?k='],
  ['Prime Videoで探す', 'https://www.amazon.co.jp/s?k='],
  ['楽天ブックスで探す', 'https://books.rakuten.co.jp/search?sitem='],
  ['Google Booksで探す', 'https://www.google.com/search?tbm=bks&q='],
  ['JustWatchで探す', 'https://www.justwatch.com/jp/search?q='],
  ['Filmarksで探す', 'https://filmarks.com/search?utf8=%E2%9C%93&q=']
];
let saved = loadSaved();
let lastResult = null;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const scriptAttr = code => esc(code);

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function persistSaved() { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
function route(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  $(`#${name}View`)?.classList.add('active');
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
  buckets.sources.push(...mediaOrder.slice(1, 6).flatMap(media => buckets[media]).flatMap(item => item.sources || []));
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
  $('#resultTitle').textContent = data.query;
  $('#resultSummary').textContent = `${countResults(data)}件の候補を媒体別に表示しています。情報は外部公開データの検索候補であり、配信中・販売中の保証ではありません。`;
  $('#toc').innerHTML = mediaOrder.map(label => `<a href="#sec-${esc(label)}">${esc(label)}</a>`).join('');
  $('#resultsContent').innerHTML = [overviewSection(data), ...['漫画','アニメ','ドラマ','映画','小説'].map(media => mediaSection(media, data[media], data.query)), relatedSection('類似作品', data.similar), genreSection(data), sourceSection(data)].join('');
  $('#searchStatus').textContent = '検索が完了しました。';
  route('results');
}
function countResults(data) { return ['漫画','アニメ','ドラマ','映画','小説'].reduce((sum, key) => sum + data[key].length, 0); }
function overviewSection(data) {
  return `<section id="sec-概要" class="panel"><h2>概要</h2><p>検索語: <strong>${esc(data.query)}</strong></p><div class="card-grid small">${data.overview.map(item => `<article class="mini-card"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.sourceName)}を開く</a></article>`).join('') || '<p class="muted">Wikidataの概要候補は見つかりませんでした。</p>'}</div></section>`;
}
function mediaSection(media, items, query) {
  return `<section id="sec-${media}" class="panel"><div class="section-head"><h2>${media}</h2><span class="count">${items.length}件</span></div><div class="card-grid">${items.map(itemCard).join('') || emptyMedia(media, query)}</div></section>`;
}
function itemCard(item) {
  return `<article class="card"><div class="card-title"><h3>${esc(item.title)}</h3><span class="chip">${esc(item.media)}</span></div><p class="muted">${esc([item.year, item.sourceName].filter(Boolean).join(' / '))}</p><p>${esc(item.description || '説明文は取得できませんでした。')}</p><div class="chips">${(item.genres || []).slice(0, 5).map(genre => `<span class="chip">${esc(genre)}</span>`).join('')}</div><div class="button-row"><button class="primary" onclick="${scriptAttr(`saveCandidate(${JSON.stringify(item)})`)}">候補を保存</button><a class="link-button" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener">出典</a></div><details><summary>閲覧/購入検索リンク</summary><div class="search-links">${(item.links || []).map(link => `<a class="link-button" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join('')}</div></details></article>`;
}
function emptyMedia(media, query) { return `<div class="empty">${esc(media)}候補は見つかりませんでした。<div class="search-links single">${searchLinks(query).slice(0, 3).map(link => `<a class="link-button" target="_blank" rel="noopener" href="${esc(link.url)}">${esc(link.label)}</a>`).join('')}</div></div>`; }
function relatedSection(title, items) { return `<section id="sec-${title}" class="panel"><h2>${title}</h2><div class="card-grid small">${items.map(item => `<article class="mini-card"><h3>${esc(item.title)}</h3><p>${esc(item.media)} / ${esc(item.reason)}</p><a href="${esc(item.url)}" target="_blank" rel="noopener">出典を開く</a></article>`).join('') || '<p class="muted">類似作品候補はまだありません。</p>'}</div></section>`; }
function genreSection(data) { return `<section id="sec-同ジャンル作品" class="panel"><h2>同ジャンル作品</h2><p class="muted">ジャンル語から再検索できます。</p><div class="chips genre-links">${data.genres.map(genre => `<button onclick="${scriptAttr(`runSearch(${JSON.stringify(genre)})`)}">${esc(genre)}</button>`).join('') || '<span>ジャンル候補はありません。</span>'}</div></section>`; }
function sourceSection(data) { return `<section id="sec-出典" class="panel"><h2>出典</h2><div class="mini-list">${data.sources.map(src => `<div class="mini-item"><a target="_blank" rel="noopener" href="${esc(src.url)}">${esc(src.name)}</a><small>${esc(src.checkedAt)}</small></div>`).join('')}</div></section>`; }

function saveCandidate(item) {
  saved.unshift({...item, savedAt: new Date().toISOString(), note: ''});
  persistSaved();
  alert('候補を保存しました。');
}
window.saveCandidate = saveCandidate;
window.runSearch = runSearch;
async function runSearch(query) {
  $('#queryInput').value = query;
  route('results');
  renderResults(await searchAll(query));
}
function renderSaved() {
  $('#savedList').innerHTML = saved.length ? saved.map((item, index) => `<article class="card"><h2>${esc(item.title)}</h2><div class="chips"><span class="chip">${esc(item.media)}</span><span class="chip">${esc(item.sourceName || '手動')}</span></div><p>${esc(item.description || item.memo || '')}</p><div class="button-row"><button onclick="renderDetail(${index})" class="primary">詳細</button><button onclick="deleteSaved(${index})" class="danger">削除</button></div></article>`).join('') : '<div class="empty panel">保存済み作品はありません。検索結果から候補を保存できます。</div>';
}
function renderDetail(index) {
  const item = saved[index];
  if (!item) return route('saved');
  $('#detailContent').innerHTML = `<article class="panel stack"><p class="eyebrow">保存済み作品IP</p><h1 id="detailTitle">${esc(item.title)}</h1><div class="chips"><span class="chip">${esc(item.media)}</span><span class="chip">${esc(item.year || '年不明')}</span></div><p>${esc(item.description || item.memo || '')}</p><h2>検索リンク</h2><div class="search-links">${searchLinks(item.title).map(link => `<a class="link-button" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join('')}</div><h2>出典</h2><a href="${esc(item.sourceUrl || '#')}" target="_blank" rel="noopener">${esc(item.sourceName || '手動登録')}</a></article>`;
  route('detail');
}
window.renderDetail = renderDetail;
function deleteSaved(index) { if (confirm('削除しますか？')) { saved.splice(index, 1); persistSaved(); renderSaved(); } }
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
    saved = Array.isArray(data) ? data : data.saved;
    if (!Array.isArray(saved)) throw new Error('saved配列がありません');
    persistSaved();
    $('#dataMessage').textContent = 'JSONをインポートしました。';
    route('saved');
  } catch (error) { $('#dataMessage').textContent = `インポートできませんでした: ${error.message}`; }
}
function setup() {
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); route(button.dataset.route); }));
  $('#searchForm').addEventListener('submit', async event => { event.preventDefault(); await runSearch($('#queryInput').value.trim()); });
  $('#saveTokenBtn').onclick = () => { localStorage.setItem(TMDB_TOKEN_KEY, $('#tmdbTokenInput').value.trim()); $('#settingsMessage').textContent = 'TMDb Read Access Tokenを保存しました。'; };
  $('#clearTokenBtn').onclick = () => { localStorage.removeItem(TMDB_TOKEN_KEY); $('#tmdbTokenInput').value = ''; $('#settingsMessage').textContent = 'TMDb設定を削除しました。'; };
  $('#exportBtn').onclick = exportJson;
  $('#importBtn').onclick = importJson;
  $('#clearSavedBtn').onclick = () => { if (confirm('保存済み作品をすべて削除しますか？')) { saved = []; persistSaved(); $('#dataMessage').textContent = '保存済み作品を削除しました。'; } };
  $('#manualAddBtn').onclick = () => $('#manualDialog').showModal();
  $('#manualForm').addEventListener('submit', event => {
    if (event.submitter?.value !== 'save') return;
    const form = new FormData(event.target);
    saved.unshift({id: uid('manual'), title: form.get('title'), media: form.get('media'), memo: form.get('memo'), sourceName: '手動補助登録', savedAt: new Date().toISOString()});
    persistSaved();
    event.target.reset();
    renderSaved();
  });
}
setup();
