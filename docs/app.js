const STORAGE_KEY = 'media-ip-tracker-v2-saved';
const TMDB_TOKEN_KEY = 'media-ip-tracker-v2-tmdb-token';
const SEARCH_DEBUG_KEY = 'media-ip-tracker-v2-search-debug';
const mediaOrder = ['漫画', 'アニメ', 'ドラマ', '映画', '小説', '類似作品', '同ジャンル作品', '出典'];
const visibleCandidateLimit = 3;
const visibleSimilarLimit = 5;
const judgementMedia = ['漫画', 'アニメ', 'ドラマ', '映画', '小説'];
const searchMediaWordsJa = ['原作', '漫画', 'アニメ', '映画', 'ドラマ', '小説', '書籍', '絵本', '作者'];
const searchMediaWordsEn = ['manga', 'anime', 'movie', 'drama', 'novel', 'book', 'original'];
const maxInitialSearchTerms = 8;
const maxAliasSearchTerms = 6;
const searchAliasDictionary = {
  'アンパンマン': ['それいけ！アンパンマン', 'それいけ!アンパンマン', 'Anpanman', 'Soreike! Anpanman', 'やなせたかし アンパンマン'],
  'デスノ': ['DEATH NOTE', 'デスノート'],
  'デスノート': ['DEATH NOTE', 'DEATHNOTE'],
  'DEATH NOTE': ['デスノート', 'DEATHNOTE'],
  'VIVANT': ['Vivant', 'VIVANT ドラマ', 'VIVANT TBS', 'VIVANT Japanese drama'],
  '君の名は': ['君の名は。', 'Your Name', 'Kimi no Na wa'],
  '君の名は。': ['君の名は', 'Your Name', 'Kimi no Na wa'],
  'フリーレン': ['葬送のフリーレン', 'Frieren', "Frieren Beyond Journey's End"],
  '葬送のフリーレン': ['Frieren', "Frieren Beyond Journey's End"],
  'ハリポタ': ['ハリー・ポッター', 'Harry Potter'],
  'ハリー・ポッター': ['Harry Potter'],
  'ワンピ': ['ONE PIECE', 'ワンピース', 'One Piece'],
  'ワンピース': ['ONE PIECE', 'One Piece'],
  'カイジ': ['賭博黙示録カイジ', 'Kaiji'],
  'ゴジラ': ['Godzilla']
};
const commonConfirmProviders = [
  ['Googleで確認', 'https://www.google.com/search?q='],
  ['Wikipediaで確認', 'https://ja.wikipedia.org/wiki/Special:Search?search='],
  ['公式サイトを探す', 'https://www.google.com/search?q=', ' 公式']
];
const videoConfirmProviders = [
  ['TVerで探す', 'https://tver.jp/search/'],
  ['U-NEXTで探す', 'https://video.unext.jp/freeword?query='],
  ['Prime Videoで探す', 'https://www.amazon.co.jp/s?k='],
  ['Netflixで探す', 'https://www.netflix.com/search?q='],
  ['Huluで探す', 'https://www.hulu.jp/search?q='],
  ['Disney+で探す', 'https://www.disneyplus.com/ja-jp/search/'],
  ['Filmarksで探す', 'https://filmarks.com/search?utf8=%E2%9C%93&q='],
  ['JustWatchで探す', 'https://www.justwatch.com/jp/search?q='],
  ['YouTubeで公式予告を探す', 'https://www.youtube.com/results?search_query=', ' 公式 予告']
];
const bookConfirmProviders = [
  ['Amazonで探す', 'https://www.amazon.co.jp/s?k='],
  ['楽天ブックスで探す', 'https://books.rakuten.co.jp/search?sitem='],
  ['Google Booksで探す', 'https://www.google.com/search?tbm=bks&q='],
  ['BOOK☆WALKERで探す', 'https://bookwalker.jp/search/?word='],
  ['ebookjapanで探す', 'https://ebookjapan.yahoo.co.jp/search/?keyword='],
  ['DMMブックスで探す', 'https://book.dmm.com/search/?searchstr=']
];

const shortActionLabels = {
  'Googleで確認': 'Google',
  'Wikipediaで確認': 'Wiki',
  '公式サイトを探す': '公式',
  'TVerで探す': 'TVer',
  'U-NEXTで探す': 'U-NEXT',
  'Prime Videoで探す': 'Prime',
  'Netflixで探す': 'Netflix',
  'Huluで探す': 'Hulu',
  'Disney+で探す': 'Disney',
  'Filmarksで探す': 'Filmarks',
  'JustWatchで探す': 'JustWatch',
  'YouTubeで公式予告を探す': '予告',
  'Amazonで探す': 'Amazon',
  '楽天ブックスで探す': '楽天',
  'Google Booksで探す': 'G Books',
  'BOOK☆WALKERで探す': 'BW',
  'ebookjapanで探す': 'ebook',
  'DMMブックスで探す': 'DMM',
  '作品判定サマリー': '判定',
  '類似作品': '類似',
  '同ジャンル作品': 'ジャンル',
  'データ出典を見る': '出典',
  'データ出典': '出典',
  '他のサービスで探す': '他サービス',
  '検索元の詳細': '検索元',
  '他の候補を表示': '他候補',
  '他の類似作品を表示': '他候補',
  '候補を保存': '保存',
  '最有力候補を保存': '保存'
};
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

function shortActionLabel(label) { return shortActionLabels[label] || String(label || '').replace(/で(確認|探す)$/, '').replace(/を探す$/, ''); }
function countClass(prefix, count) { return `${prefix} ${prefix}-count-${Math.min(count, 9)} links-count-${Math.min(count, 9)}`; }
function actionAttrs(label) { return `title="${esc(label)}" aria-label="${esc(label)}"`; }
function actionLinkHtml(link, className = 'link-button') { return `<a class="${className}" href="${esc(link.url)}" target="_blank" rel="noopener" ${actionAttrs(link.label)}>${esc(shortActionLabel(link.label))}</a>`; }
function providerLinks(providers, title, suffix = '') { return providers.map(([label, url, providerSuffix = '']) => ({label, url: `${url}${encodeURIComponent(`${title}${providerSuffix || suffix}`)}`})); }
function searchLinks(title, media = '') { return japaneseConfirmLinks(title, media); }
function japaneseConfirmLinks(title, media = '') {
  const specific = isReadingMedia(media) ? bookConfirmProviders : videoConfirmProviders;
  return [...providerLinks(commonConfirmProviders, title), ...providerLinks(specific, title)];
}
function zeroConfirmLinks(title) { return [...providerLinks(commonConfirmProviders, title), ...providerLinks(videoConfirmProviders, title)]; }
function sourceLabel(name) { return String(name || '不明').startsWith('データ出典') ? name : `データ出典：${name || '不明'}`; }
function sourceBaseName(name) { return String(name || '不明').replace(/^検索エラー:\s*/, '').replace(/検索に失敗しました.*$/, '').replace(/\s*(GraphQL API|API)$/, '').replace(/未設定.*$/, '未設定').trim() || '不明'; }
function sourceStatus(name) {
  const value = String(name || '');
  if (value.includes('未設定')) return '未設定';
  if (value.includes('エラー') || value.includes('失敗')) return '一部取得失敗';
  return '取得済み';
}
function sourceLinksHtml(item) {
  const sources = uniqueBy(item.sources?.length ? item.sources : [sourceLink(item.sourceName, item.sourceUrl)], src => `${src.name}-${src.url}`);
  return sources.filter(src => src.url && src.url !== '#').map(src => `<a class="source-link" href="${esc(src.url)}" target="_blank" rel="noopener" ${actionAttrs(sourceLabel(src.name))}>${esc(shortActionLabel('データ出典'))}</a>`).join('');
}
function emptyBuckets(query) {
  return {query, overview: [], 漫画: [], アニメ: [], ドラマ: [], 映画: [], 小説: [], similar: [], genres: new Set(), sources: [], discovery: [], exactCandidate: [], aliasCandidate: [], strongCandidate: [], fuzzyCandidate: [], relatedCandidate: [], searchDebug: null};
}

async function searchAll(query) {
  const normalizedQuery = normalizeSearchInput(query);
  const buckets = emptyBuckets(normalizedQuery);
  $('#searchStatus').textContent = '公開データを段階検索しています…';
  const initialTerms = buildSearchVariants(normalizedQuery);
  buckets.searchDebug = createSearchDebug(query, normalizedQuery, initialTerms);
  await runSearchStage(buckets, initialTerms, normalizedQuery, 'initial');
  runDiscoveryStage(buckets, normalizedQuery);
  const trustedTerms = trustedDiscoveryTerms(buckets, normalizedQuery).filter(term => !initialTerms.some(seed => normalizedText(seed) === normalizedText(term)));
  buckets.searchDebug.trustedTerms = trustedTerms;
  if (trustedTerms.length) await runSearchStage(buckets, trustedTerms, normalizedQuery, 'trusted');
  runDiscoveryStage(buckets, normalizedQuery);
  finalizeSearchBuckets(buckets);
  updateSearchDebug(buckets);
  if (isSearchDebugEnabled()) console.debug('Media IP Tracker search debug', buckets.searchDebug);
  return buckets;
}
async function runSearchStage(buckets, terms, query, stageName = 'search') {
  const sourceTasks = [
    ['AniList', searchAniList(terms, query)],
    ['Google Books', searchGoogleBooks(terms, query)],
    ['Wikidata', searchWikidata(terms, query)],
    ['TMDb', searchTmdb(terms, query)]
  ];
  const settled = await Promise.allSettled(sourceTasks.map(([, task]) => task));
  settled.forEach((result, index) => {
    const sourceName = sourceTasks[index][0];
    if (result.status === 'fulfilled') {
      mergeBuckets(buckets, result.value);
      addDebugSourceCount(buckets, stageName, sourceName, result.value);
    } else {
      buckets.sources.push(sourceLink(`検索エラー: ${result.reason.message}`, '#'));
      addDebugSourceError(buckets, stageName, sourceName, result.reason.message);
    }
  });
}

function finalizeSearchBuckets(buckets) {
  judgementMedia.forEach(media => { buckets[media] = dedupeCandidates(buckets[media]).map(item => ({...item, confidence: classifyCandidate(item, buckets.query)})).sort((a, b) => candidateScore(b, buckets.query) - candidateScore(a, buckets.query)).slice(0, 24); });
  runDiscoveryStage(buckets, buckets.query);
  buckets.overview = dedupeCandidates(buckets.overview).slice(0, 10);
  const candidateKeys = new Set(allCandidates(buckets).map(item => duplicateKey(item)));
  buckets.sources.push(...judgementMedia.flatMap(media => buckets[media]).flatMap(item => item.sources || []));
  buckets.sources = uniqueBy(buckets.sources, item => `${item.name}-${item.url}`);
  buckets.genres = Array.from(buckets.genres).slice(0, 16);
  buckets.similar = uniqueBy(buckets.similar, item => `${normalizedText(item.title)}-${item.media}`).filter(item => !candidateKeys.has(duplicateKey(item))).slice(0, 20);
}

function runDiscoveryStage(buckets, query) {
  const discovered = [
    ...buckets.overview.map(item => discoveryRecord(item, 'overview')),
    ...judgementMedia.flatMap(media => buckets[media].map(item => discoveryRecord(item, media)))
  ];
  buckets.discovery = dedupeCandidates(discovered);
  const classified = buckets.discovery.map(item => ({...item, confidence: classifyCandidate(item, query)}));
  buckets.exactCandidate = classified.filter(item => item.confidence === 'exactCandidate');
  buckets.aliasCandidate = classified.filter(item => item.confidence === 'aliasCandidate');
  buckets.strongCandidate = classified.filter(item => item.confidence === 'strongCandidate');
  buckets.fuzzyCandidate = classified.filter(item => item.confidence === 'fuzzyCandidate');
  buckets.relatedCandidate = uniqueBy([...classified.filter(item => item.confidence === 'relatedCandidate'), ...buckets.similar.map(item => ({...item, confidence: 'relatedCandidate'}))], item => `${normalizedText(item.title)}-${item.media || ''}`);
}
function discoveryRecord(item, fallbackMedia = '') {
  return {
    ...item,
    title: item.title || item.label || '',
    originalTitle: item.originalTitle || '',
    aliases: uniqueTerms([...(item.aliases || []), item.originalTitle, item.seriesName], 10),
    authors: item.authors || [],
    seriesName: item.seriesName || '',
    media: item.media || fallbackMedia || '出典',
    year: item.year || '',
    sourceUrl: item.sourceUrl || item.url || '#',
    sourceName: item.sourceName || '公開データ'
  };
}
function trustedDiscoveryTerms(buckets, query) {
  return uniqueTerms([...buckets.exactCandidate, ...buckets.aliasCandidate, ...buckets.strongCandidate].flatMap(extractAliasesFromItem), maxAliasSearchTerms);
}
function classifyCandidate(item, query) {
  const aliases = extractAliasesFromItem(item);
  const nq = normalizedText(query);
  const source = String(item.sourceName || '').toLowerCase();
  const exact = normalizedText(item.title) === nq;
  const aliasExact = aliases.some(alias => normalizedText(alias) === nq);
  const close = aliases.some(alias => titleCloseness(alias, query) >= 38) || titleCloseness(item.title, query) >= 38;
  const fuzzy = [item.title, ...aliases].some(value => normalizedSimilarity(value, query) >= 0.62);
  if (exact) return 'exactCandidate';
  if (aliasExact) return 'aliasCandidate';
  if (close && !(isProbablyJapanese(query) && source.includes('anilist') && !aliasExact)) return 'strongCandidate';
  if (close || fuzzy) return 'fuzzyCandidate';
  return 'relatedCandidate';
}
function mainCandidates(data) { return allCandidates(data).filter(item => ['exactCandidate', 'aliasCandidate', 'strongCandidate'].includes(item.confidence || classifyCandidate(item, data.query))); }
function fuzzyCandidates(data) { return uniqueBy(allCandidates(data).filter(item => (item.confidence || classifyCandidate(item, data.query)) === 'fuzzyCandidate'), duplicateKey); }


function createSearchDebug(rawQuery, normalizedQuery, initialTerms) {
  return {
    rawQuery,
    normalizedQuery,
    buildSearchVariants: initialTerms,
    initialApiTerms: initialTerms,
    sourceCounts: {},
    sourceErrors: {},
    trustedTerms: [],
    discoveryRecords: [],
    classifications: {exactCandidate: [], aliasCandidate: [], strongCandidate: [], fuzzyCandidate: [], relatedCandidate: []},
    mergedCandidates: [],
    bestCandidate: null,
    didYouMean: [],
    similar: []
  };
}
function addDebugSourceCount(buckets, stageName, sourceName, part) {
  if (!buckets.searchDebug) return;
  buckets.searchDebug.sourceCounts[stageName] ||= {};
  buckets.searchDebug.sourceCounts[stageName][sourceName] = countPartResults(part);
}
function addDebugSourceError(buckets, stageName, sourceName, message) {
  if (!buckets.searchDebug) return;
  buckets.searchDebug.sourceCounts[stageName] ||= {};
  buckets.searchDebug.sourceCounts[stageName][sourceName] = 0;
  buckets.searchDebug.sourceErrors[stageName] ||= {};
  buckets.searchDebug.sourceErrors[stageName][sourceName] = message;
}
function countPartResults(part) {
  return {
    total: (part.overview || []).length + judgementMedia.reduce((sum, media) => sum + (part[media] || []).length, 0),
    overview: (part.overview || []).length,
    media: Object.fromEntries(judgementMedia.map(media => [media, (part[media] || []).length])),
    similar: (part.similar || []).length
  };
}
function updateSearchDebug(buckets) {
  if (!buckets.searchDebug) return;
  const best = bestCandidate(buckets);
  buckets.searchDebug.discoveryRecords = buckets.discovery.map(item => debugCandidateRecord(item, buckets, best));
  buckets.searchDebug.classifications = {
    exactCandidate: buckets.exactCandidate.map(item => debugCandidateRecord(item, buckets, best)),
    aliasCandidate: buckets.aliasCandidate.map(item => debugCandidateRecord(item, buckets, best)),
    strongCandidate: buckets.strongCandidate.map(item => debugCandidateRecord(item, buckets, best)),
    fuzzyCandidate: buckets.fuzzyCandidate.map(item => debugCandidateRecord(item, buckets, best)),
    relatedCandidate: buckets.relatedCandidate.map(item => debugCandidateRecord(item, buckets, best))
  };
  buckets.searchDebug.mergedCandidates = allCandidates(buckets).map(item => debugCandidateRecord(item, buckets, best));
  buckets.searchDebug.bestCandidate = best ? debugCandidateRecord(best, buckets, best) : null;
  buckets.searchDebug.didYouMean = fuzzyCandidates(buckets).map(item => debugCandidateRecord(item, buckets, best));
  buckets.searchDebug.similar = (buckets.relatedCandidate.length ? buckets.relatedCandidate : buckets.similar).map(item => debugCandidateRecord(item, buckets, best));
}
function debugCandidateRecord(item, buckets, best = null) {
  const normalized = normalizeItem(item);
  const matchLevel = normalized.confidence || classifyCandidate(normalized, buckets.query);
  const isMain = ['exactCandidate', 'aliasCandidate', 'strongCandidate'].includes(matchLevel);
  const isFuzzy = matchLevel === 'fuzzyCandidate';
  const isRelated = matchLevel === 'relatedCandidate';
  return {
    title: normalized.title,
    sourceName: normalized.sourceName || '',
    mediaType: normalized.media || '',
    year: normalized.year || '',
    aliases: (normalized.aliases || []).slice(0, 10),
    matchLevel,
    score: candidateScore(normalized, buckets.query),
    bestCandidateTarget: isMain,
    selectedBestCandidate: best ? duplicateKey(normalized) === duplicateKey(best) : false,
    fuzzy: isFuzzy,
    related: isRelated,
    exclusionReason: candidateExclusionReason(normalized, buckets.query, matchLevel)
  };
}
function candidateExclusionReason(item, query, matchLevel) {
  if (['exactCandidate', 'aliasCandidate', 'strongCandidate'].includes(matchLevel)) return '';
  const source = String(item.sourceName || '').toLowerCase();
  if (matchLevel === 'fuzzyCandidate' && isProbablyJapanese(query) && source.includes('anilist')) return '日本語入力でタイトル完全一致なし、AniList曖昧一致';
  if (matchLevel === 'fuzzyCandidate') return 'タイトルまたは別名が近いが完全一致ではない';
  if (matchLevel === 'relatedCandidate') return '完全一致・別名一致・強一致ではないため類似作品扱い';
  return '本命候補条件に未達';
}
function isSearchDebugEnabled() { return localStorage.getItem(SEARCH_DEBUG_KEY) === '1'; }
function setSearchDebugEnabled(enabled) { localStorage.setItem(SEARCH_DEBUG_KEY, enabled ? '1' : '0'); }
function searchDebugSection(data) {
  if (!isSearchDebugEnabled() || !data.searchDebug) return '';
  return `<details id="sec-検索デバッグ" class="panel search-debug"><summary>検索デバッグ</summary><pre>${esc(JSON.stringify(data.searchDebug, null, 2))}</pre></details>`;
}

function dedupeCandidates(items) {
  return uniqueBy(items, item => item.sourceName && item.id ? `${item.sourceName}-${item.id}` : item.sourceUrl && item.sourceUrl !== '#' ? item.sourceUrl : `${normalizedText(item.title)}-${item.media || ''}-${item.year || ''}`);
}
function mergeBuckets(target, part) {
  ['overview', '漫画', 'アニメ', 'ドラマ', '映画', '小説', 'similar', 'discovery'].forEach(key => target[key].push(...(part[key] || [])));
  (part.genres || []).forEach(genre => target.genres.add(genre));
  target.sources.push(...(part.sources || []));
}
function uniqueBy(items, keyFn) { return [...new Map(items.map(item => [keyFn(item), item])).values()]; }
function normalizeSearchInput(value) {
  return String(value || '')
    .replace(/　/g, ' ')
    .replace(/[！]/g, '!')
    .replace(/[：]/g, ':')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[ｰ]/g, 'ー')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizedText(value) {
  return normalizeSearchInput(value).toLowerCase().replace(/^the\s+/i, '').replace(/[\s:：・!！\-ー_/\\.。]/g, '');
}
function uniqueTerms(terms, limit = 12) { return uniqueBy(terms.map(normalizeSearchInput).filter(Boolean), value => normalizedText(value)).slice(0, limit); }
function dictionaryAliases(query) {
  const nq = normalizedText(query);
  return Object.entries(searchAliasDictionary).flatMap(([key, aliases]) => normalizedText(key) === nq ? aliases : []);
}
function buildSearchVariants(query, limit = maxInitialSearchTerms) {
  const base = normalizeSearchInput(query);
  const compact = base.replace(/\s+/g, '');
  const words = isProbablyJapanese(base) ? searchMediaWordsJa : searchMediaWordsEn;
  return uniqueTerms([base, compact, ...dictionaryAliases(base), ...words.map(word => `${base} ${word}`)], limit);
}
function extractAliasesFromItem(item) {
  return [item.title, item.originalTitle, ...(item.aliases || []), ...(item.authors || [])].filter(Boolean);
}
function collectAliases(data) {
  return uniqueTerms([...data.overview.flatMap(extractAliasesFromItem), ...judgementMedia.flatMap(media => data[media].flatMap(extractAliasesFromItem))], maxAliasSearchTerms);
}
function titleCloseness(title, query) {
  const normalizedTitle = normalizedText(title);
  const normalizedQuery = normalizedText(query);
  if (!normalizedTitle || !normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 60;
  if ((normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) && containmentRatio(normalizedTitle, normalizedQuery) >= 0.75) return 38;
  return 0;
}
function containmentRatio(a, b) { return Math.min(a.length, b.length) / Math.max(a.length, b.length); }
function editDistance(a, b) {
  const dp = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[a.length][b.length];
}
function normalizedSimilarity(a, b) {
  const left = normalizedText(a);
  const right = normalizedText(b);
  if (!left || !right) return 0;
  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}
function sourcePriority(item) {
  const source = String(item.sourceName || '').toLowerCase();
  if ((item.media === '映画' || item.media === 'ドラマ') && (source.includes('tmdb') || source.includes('wikidata'))) return 18;
  if ((item.media === 'アニメ' || item.media === '漫画') && source.includes('anilist')) return 18;
  if (item.media === '小説' && source.includes('google books')) return 18;
  return 0;
}
function allCandidates(data) { return judgementMedia.flatMap(media => (data[media] || []).map(item => normalizeItem(item))); }
function candidateScore(item, query) {
  const aliases = extractAliasesFromItem(item);
  const aliasScore = aliases.some(alias => normalizedText(alias) === normalizedText(query)) ? 24 : aliases.some(alias => titleCloseness(alias, query) >= 38) ? 12 : 0;
  const japaneseScore = aliases.some(alias => isProbablyJapanese(alias) && titleCloseness(alias, query)) ? 8 : 0;
  const sourceScore = sourcePriority(item) || (item.sourceName ? 8 : 0);
  const weakMatchPenalty = titleCloseness(item.title, query) || aliasScore ? 0 : -18;
  const recPenalty = item.reason && /recommend/i.test(item.reason) ? -20 : 0;
  return titleCloseness(item.title, query) + aliasScore + japaneseScore + (item.year ? 10 : 0) + (item.description ? 8 : 0) + (item.media ? 6 : 0) + (item.sourceUrl && item.sourceUrl !== '#' ? 8 : 0) + sourceScore + weakMatchPenalty + recPenalty;
}
function isProbablyJapanese(text) { return /[ぁ-んァ-ヶ一-龠]/.test(String(text || '')); }
function shortText(text, max = 150) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}
function descriptionHtml(item, max = 80) {
  const text = shortText(item.description || '説明文は取得できませんでした。', max);
  const prefix = item.description && !isProbablyJapanese(item.description) ? '<span class="chip">英語概要</span> ' : '';
  return `<p class="candidate-description">${prefix}${esc(text)}</p>`;
}
function splitConfirmLinks(title, media = '') {
  const links = japaneseConfirmLinks(title, media);
  return {primaryConfirmLinks: links.slice(0, commonConfirmProviders.length), secondaryConfirmLinks: links.slice(commonConfirmProviders.length)};
}
function confirmLinksHtml(title, media = '', primary = true, includeSecondary = true) {
  const {primaryConfirmLinks, secondaryConfirmLinks} = splitConfirmLinks(title, media);
  const primaryHtml = `<div class="${countClass('confirm-links', primaryConfirmLinks.length)}">${primaryConfirmLinks.map((link, index) => actionLinkHtml(link, `link-button ${primary && index === 0 ? 'primary' : ''}`)).join('')}</div>`;
  const secondaryHtml = includeSecondary && secondaryConfirmLinks.length ? `<details class="more-links"><summary ${actionAttrs('他のサービスで探す')}>他サービス</summary><div class="${countClass('confirm-links secondary', secondaryConfirmLinks.length)}">${secondaryConfirmLinks.map(link => actionLinkHtml(link)).join('')}</div></details>` : '';
  return `${primaryHtml}${secondaryHtml}`;
}
function sourceDetailsHtml(item) {
  return `<details class="source-details"><summary ${actionAttrs('データ出典を見る')}>出典</summary><div class="source-links">${sourceLinksHtml(item) || '<span class="muted">データ出典リンクはありません。</span>'}</div></details>`;
}
function bestCandidate(data) {
  return mainCandidates(data).map(item => ({item, score: candidateScore(item, data.query)})).sort((a, b) => b.score - a.score)[0]?.item || null;
}
function mediaSummary(data) { return judgementMedia.map(media => ({media, count: (data[media] || []).length})); }
function duplicateKey(item) { return [normalizedText(item.title), item.year || '不明年', item.media].join('|'); }
function duplicateCount(item, data) {
  const key = duplicateKey(item);
  return allCandidates(data).filter(candidate => duplicateKey(candidate) === key).length;
}
function spellingSuggestions(query) { return buildSearchVariants(query, 8); }

async function searchAniList(terms, query) {
  const out = emptyBuckets(query);
  for (const term of uniqueTerms(Array.isArray(terms) ? terms : [terms], 5)) {
    const graphql = {query: `query ($search: String) { Page(page: 1, perPage: 6) { media(search: $search, type: ANIME) { id type title { romaji english native } format startDate { year } genres siteUrl description(asHtml:false) recommendations(perPage:2) { nodes { mediaRecommendation { title { romaji english native } siteUrl } } } } manga: media(search: $search, type: MANGA) { id type title { romaji english native } format startDate { year } genres siteUrl description(asHtml:false) recommendations(perPage:2) { nodes { mediaRecommendation { title { romaji english native } siteUrl } } } } } }`, variables: {search: term}};
    const res = await fetch('https://graphql.anilist.co', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(graphql)});
    if (!res.ok) throw new Error('AniList検索に失敗しました');
    const json = await res.json();
    const convert = (item, media) => { const title = pickTitle(item.title); const aliases = uniqueTerms([item.title?.native, item.title?.romaji, item.title?.english], 6); return {id: `anilist-${item.id}`, title, originalTitle: item.title?.romaji || item.title?.english || '', aliases, media, year: item.startDate?.year || '', description: stripHtml(item.description || ''), genres: item.genres || [], sourceName: 'AniList', sourceUrl: item.siteUrl, links: searchLinks(title, media), sources: [sourceLink('AniList', item.siteUrl)]}; };
    (json.data?.Page?.media || []).filter(item => item.type === 'ANIME').forEach(item => { out.アニメ.push(convert(item, 'アニメ')); collectAniListExtras(out, item, 'アニメ'); });
    (json.data?.Page?.manga || []).filter(item => item.type === 'MANGA').forEach(item => { out.漫画.push(convert(item, '漫画')); collectAniListExtras(out, item, '漫画'); });
  }
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
function pickTitle(title) { return title?.native || title?.romaji || title?.english || 'Untitled'; }
function stripHtml(text) { return String(text || '').replace(/<[^>]+>/g, '').slice(0, 260); }
function classifyBookMedia(info) {
  const text = [info.title, info.subtitle, info.description, ...(info.categories || [])].join(' ');
  if (/comic|manga|コミック|漫画/i.test(text)) return '漫画';
  return '小説';
}
async function searchGoogleBooks(terms, query) {
  const out = emptyBuckets(query);
  const bookTerms = uniqueTerms((Array.isArray(terms) ? terms : [terms]).flatMap(term => [term, `intitle:${term}`]), 10);
  for (const term of bookTerms) {
    const lang = isProbablyJapanese(term) ? '&langRestrict=ja&country=JP' : '&country=JP';
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=6&printType=books${lang}`);
    if (!res.ok) throw new Error('Google Books検索に失敗しました');
    const json = await res.json();
    (json.items || []).forEach(book => {
      const info = book.volumeInfo || {};
      const categories = info.categories || [];
      const media = classifyBookMedia(info);
      const title = info.title || query;
      const item = {id: `gbooks-${book.id}`, title, originalTitle: info.subtitle || '', aliases: uniqueTerms([title, info.subtitle, ...(info.authors || []), ...categories], 8), authors: info.authors || [], media, year: (info.publishedDate || '').slice(0, 4), description: (info.description || '').slice(0, 260), genres: categories, sourceName: 'Google Books', sourceUrl: info.infoLink || '#', links: searchLinks(title, media), sources: [sourceLink('Google Books', info.infoLink || '#')]};
      out[media].push(item);
      categories.forEach(category => out.genres.add(category));
    });
  }
  out.sources.push(sourceLink('Google Books API', 'https://developers.google.com/books'));
  return out;
}
async function searchWikidata(terms, query) {
  const out = emptyBuckets(query);
  for (const term of uniqueTerms(Array.isArray(terms) ? terms : [terms], 6)) {
    let json = await fetchWikidata(term, isProbablyJapanese(term) ? 'ja' : 'en');
    if (!(json.search || []).length) json = await fetchWikidata(term, isProbablyJapanese(term) ? 'en' : 'ja');
    (json.search || []).slice(0, 5).forEach(entity => {
      const aliases = uniqueTerms([entity.label, entity.match?.text, entity.description], 6);
      out.overview.push({id: `wikidata-${entity.id}`, title: entity.label, aliases, description: entity.description || 'Wikidata候補', url: entity.concepturi, sourceName: 'Wikidata'});
    });
  }
  out.sources.push(sourceLink('Wikidata API', 'https://www.wikidata.org/w/api.php'));
  return out;
}
async function fetchWikidata(term, language) {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${language}&uselang=ja&format=json&origin=*`);
  if (!res.ok) throw new Error('Wikidata検索に失敗しました');
  return res.json();
}
async function searchTmdb(terms, query) {
  const token = localStorage.getItem(TMDB_TOKEN_KEY);
  const out = emptyBuckets(query);
  if (!token) { out.sources.push(sourceLink('TMDb未設定', 'https://www.themoviedb.org/settings/api')); return out; }
  const headers = {Authorization: `Bearer ${token}`, accept: 'application/json'};
  for (const term of uniqueTerms(Array.isArray(terms) ? terms : [terms], 8)) {
    for (const type of ['movie', 'tv']) {
      const res = await fetch(`https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(term)}&language=ja-JP&region=JP&include_adult=false`, {headers});
      if (!res.ok) throw new Error('TMDb検索に失敗しました。Read Access Tokenを確認してください');
      const json = await res.json();
      (json.results || []).slice(0, 5).forEach(item => {
        const media = type === 'movie' ? '映画' : 'ドラマ';
        const title = item.title || item.name || item.original_title || item.original_name || query;
        const originalTitle = item.original_title || item.original_name || '';
        out[media].push({id: `tmdb-${type}-${item.id}`, title, originalTitle, aliases: uniqueTerms([title, originalTitle], 4), media, year: (item.release_date || item.first_air_date || '').slice(0, 4), description: item.overview || '', genres: [], sourceName: 'TMDb', sourceUrl: `https://www.themoviedb.org/${type}/${item.id}`, links: searchLinks(title, media), sources: [sourceLink('TMDb', `https://www.themoviedb.org/${type}/${item.id}`)]});
      });
    }
  }
  out.sources.push(sourceLink('TMDb API', 'https://developer.themoviedb.org/docs'));
  return out;
}

function renderResults(data) {
  lastResult = data;
  currentResultGroupId = findGroupByTitle(data.query)?.id || null;
  const total = countResults(data);
  $('#resultTitle').textContent = data.query;
  $('#resultSummary').textContent = total ? `保存不要で閲覧可。候補 ${total}件。` : '候補なし。別表記と確認リンクを表示。';
  const visibleMedia = judgementMedia.filter(media => (data[media] || []).some(item => ['exactCandidate', 'aliasCandidate', 'strongCandidate'].includes(item.confidence || classifyCandidate(item, data.query))));
  const tocItems = ['作品判定サマリー', ...visibleMedia, ...(fuzzyCandidates(data).length ? ['もしかして'] : []), ...(data.relatedCandidate.length || data.similar.length ? ['類似作品'] : []), ...(data.genres.length ? ['同ジャンル作品'] : []), '確認リンク', '出典'];
  $('#toc').className = `toc ${countClass('toc-links', tocItems.length)}`;
  $('#toc').innerHTML = tocItems.map(label => `<a href="#sec-${esc(label)}" ${actionAttrs(label)}>${esc(shortActionLabel(label))}</a>`).join('');
  $('#resultsContent').innerHTML = [judgementSummarySection(data), ...visibleMedia.map(media => mediaSection(media, data[media], data.query, data)), maybeSection(data), relatedSection('類似作品', data.relatedCandidate.length ? data.relatedCandidate : data.similar), genreSection(data), confirmSection(data.query), sourceSection(data), searchDebugSection(data)].filter(Boolean).join('');
  renderResultFavorite();
  $('#searchStatus').textContent = '検索が完了しました。';
  route('results');
}
function countResults(data) { return mainCandidates(data).length + fuzzyCandidates(data).length; }
function judgementSummarySection(data) {
  const total = countResults(data);
  const best = bestCandidate(data);
  const foundItems = mediaSummary(data).filter(item => item.count);
  const missingItems = mediaSummary(data).filter(item => !item.count);
  const found = foundItems.map(item => `<span class="chip">${esc(item.media)} ${item.count}件</span>`).join('') || '<span class="muted">候補なし</span>';
  const missing = missingItems.map(item => `<span class="chip subtle-chip">${esc(item.media)}</span>`).join('') || '<span class="muted">なし</span>';
  const savedGroup = currentResultGroupId ? saved.find(group => group.id === currentResultGroupId) : findGroupByTitle(data.query);
  return `<section id="sec-作品判定サマリー" class="panel judgement-summary summary-card"><div class="section-head"><div><p class="eyebrow">作品判定サマリー</p><h2>${esc(data.query)}</h2></div><span class="count">候補 ${total}件</span></div><div class="summary-grid"><div><strong>検索キーワード</strong><p>${esc(data.query)}</p></div><div><strong>最有力候補</strong><p>${best ? esc([best.title, best.media, best.year, best.sourceName].filter(Boolean).join(' / ')) : '候補なし'}</p></div><div><strong>見つかった媒体</strong><p class="summary-chips">${found}</p></div><div><strong>未確認媒体</strong><p class="summary-chips muted-chips">${missing}</p></div><div><strong>候補数</strong><p>${total}件</p></div><div><strong>保存状態</strong><p>${savedGroup ? `保存済み（${savedGroup.items.length}件）` : '未保存（保存なしで閲覧中）'}</p></div></div>${sourceDetailsSummaryHtml(data)}${mediaExpansionHtml(data)}${best ? bestCandidateHtml(best) : zeroResultHtml(data.query)}</section>`;
}
function bestCandidateHtml(item) { return `<div class="best-candidate"><p class="eyebrow">本命候補</p><h3>${esc(item.title)}</h3><p class="muted">断定ではなく、タイトル一致度・年・概要・出典の情報量から優先表示しています。</p><dl class="candidate-meta"><div><dt>媒体種別</dt><dd>${esc(item.media)}</dd></div><div><dt>年</dt><dd>${esc(item.year || '不明')}</dd></div><div><dt>出典元</dt><dd>${esc(item.sourceName || '不明')}</dd></div></dl>${genreChipsHtml(item.genres)}${descriptionHtml(item, 100)}${confirmLinksHtml(item.title, item.media, true, true)}${sourceDetailsHtml(item)}<div class="save-area"><button class="save-button" onclick="${scriptAttr(`saveCandidate(${JSON.stringify(normalizeItem(item))})`)}" title="最有力候補を保存" aria-label="最有力候補を保存">保存</button>${savedStatusHtml(normalizeItem(item))}</div></div>`; }
function mediaExpansionHtml(data) { return `<div class="media-expansion" aria-label="媒体展開まとめ">${mediaSummary(data).map(item => `<div class="media-pill ${item.count ? 'found' : ''}"><strong>${esc(item.media === '小説' ? '小説/書籍' : item.media)}</strong><span>${item.count ? `候補あり ${item.count}件` : '候補なし'}</span></div>`).join('')}</div>`; }
function zeroResultHtml(query) { return `<div class="zero-guidance"><h3>候補なし</h3><p>別表記・確認リンクから探せます。</p><h4>別表記</h4><div class="chips genre-links">${spellingSuggestions(query).map(value => `<button onclick="${scriptAttr(`runSearch(${JSON.stringify(value)})`)}">${esc(value)}</button>`).join('')}</div><h4>確認リンク</h4>${confirmLinksHtml(query)}<button class="save-button subtle" type="button" onclick="document.querySelector('#manualDialog').showModal()" title="必要なら手動で補助保存" aria-label="必要なら手動で補助保存">補助保存</button></div>`; }
function mediaSection(media, items, query, data) {
  const bestKey = bestCandidate(data) ? duplicateKey(bestCandidate(data)) : '';
  const normalItems = items.filter(item => duplicateKey(item) !== bestKey && ['exactCandidate', 'aliasCandidate', 'strongCandidate'].includes(item.confidence || classifyCandidate(item, query)));
  const shown = normalItems.slice(0, visibleCandidateLimit);
  const rest = normalItems.slice(visibleCandidateLimit);
  const restHtml = rest.length ? `<details class="more-candidates"><summary title="他の${esc(media)}候補を表示（${rest.length}件）" aria-label="他の${esc(media)}候補を表示（${rest.length}件）">他候補（${rest.length}）</summary><div class="card-grid">${rest.map(item => itemCard(item, data)).join('')}</div></details>` : '';
  const bestNote = items.length !== normalItems.length ? '<p class="duplicate-note">最有力候補として表示中の候補は一覧から省略しています。</p>' : '';
  return `<section id="sec-${media}" class="panel"><div class="section-head"><h2>${media}</h2><span class="count">${items.length}件</span></div>${bestNote}<div class="card-grid">${shown.map(item => itemCard(item, data)).join('')}</div>${restHtml}</section>`;
}
function itemCard(item, data) {
  const normalized = normalizeItem(item);
  const dupes = data ? duplicateCount(normalized, data) : 1;
  return `<article class="card"><div class="card-title"><h3>${esc(normalized.title)}</h3><span class="chip">${esc(normalized.media)}</span></div>${dupes > 1 ? `<p class="duplicate-note">類似候補 ${dupes}件（同じタイトル・年・媒体）</p>` : ''}<dl class="candidate-meta"><div><dt>媒体種別</dt><dd>${esc(normalized.media)}</dd></div><div><dt>年</dt><dd>${esc(normalized.year || '不明')}</dd></div><div><dt>出典元</dt><dd>${esc(normalized.sourceName || '不明')}</dd></div></dl>${descriptionHtml(normalized)}${genreChipsHtml(normalized.genres)}${confirmLinksHtml(normalized.title, normalized.media, true, false)}${sourceDetailsHtml(normalized)}<div class="save-area"><button class="save-button" onclick="${scriptAttr(`saveCandidate(${JSON.stringify(normalized)})`)}" title="候補を保存" aria-label="候補を保存">保存</button>${savedStatusHtml(normalized)}</div></article>`;
}
function genreChipsHtml(genres = []) { return genres.length ? `<div class="chips">${genres.slice(0, 5).map(genre => `<span class="chip">${esc(genre)}</span>`).join('')}</div>` : ''; }
function emptyMedia(media, query) { return ''; }
function maybeSection(data) { const items = fuzzyCandidates(data); if (!items.length) return ''; return `<section id="sec-もしかして" class="panel"><h2>もしかして</h2><p class="muted">曖昧一致のため本命候補にはしていません。</p><div class="card-grid">${items.slice(0, visibleCandidateLimit + 3).map(item => itemCard(item, data)).join('')}</div></section>`; }
function confirmSection(query) { return `<section id="sec-確認リンク" class="panel"><h2>確認リンク</h2><div class="${countClass('confirm-links', zeroConfirmLinks(query).length)}">${zeroConfirmLinks(query).slice(0, 8).map(link => actionLinkHtml(link)).join('')}</div></section>`; }
function relatedSection(title, items) { if (!items.length) return ''; const shown = items.slice(0, visibleSimilarLimit); const rest = items.slice(visibleSimilarLimit); const cards = list => list.map(item => `<article class="mini-card"><h3>${esc(item.title)}</h3><p>${esc(item.media)} / ${esc(item.reason || item.sourceName || '関連候補')}</p><a href="${esc(item.url || item.sourceUrl || '#')}" target="_blank" rel="noopener" title="データ出典を見る" aria-label="データ出典を見る">出典</a></article>`).join(''); return `<section id="sec-${title}" class="panel"><h2>${title}</h2><div class="card-grid small">${cards(shown) || '<p class="muted">類似作品候補はまだありません。</p>'}</div>${rest.length ? `<details class="more-candidates"><summary title="他の類似作品を表示（${rest.length}件）" aria-label="他の類似作品を表示（${rest.length}件）">他候補（${rest.length}）</summary><div class="card-grid small">${cards(rest)}</div></details>` : ''}</section>`; }
function genreSection(data) { if (!data.genres.length) return ''; return `<section id="sec-同ジャンル作品" class="panel"><h2>同ジャンル作品</h2><p class="muted">ジャンル語から再検索できます。</p><div class="chips genre-links">${data.genres.map(genre => `<button onclick="${scriptAttr(`runSearch(${JSON.stringify(genre)})`)}">${esc(genre)}</button>`).join('') || '<span>ジャンル候補はありません。</span>'}</div></section>`; }
function aggregatedSources(data) { return uniqueBy(data.sources, src => sourceBaseName(src.name)).map(src => ({...src, baseName: sourceBaseName(src.name), status: sourceStatus(src.name)})); }
function sourceDetailsSummaryHtml(data) { const rows = aggregatedSources(data).map(src => `<li>${esc(src.baseName)}：${esc(src.status)}</li>`).join(''); return `<details class="source-details"><summary title="検索元の詳細" aria-label="検索元の詳細">検索元</summary><ul class="source-summary">${rows || '<li>公開データ：確認対象なし</li>'}</ul></details>`; }
function sourceSection(data) { const sources = aggregatedSources(data).filter(src => src.url && src.url !== '#'); return `<section id="sec-出典" class="panel"><h2>データ出典</h2><p class="muted">出典元は補助情報として集約表示しています。</p><div class="mini-list">${sources.map(src => `<div class="mini-item"><a target="_blank" rel="noopener" href="${esc(src.url)}">${esc(sourceLabel(src.baseName))}</a><small>${esc(src.status)}</small></div>`).join('') || '<p class="muted">表示できる出典リンクはありません。</p>'}</div></section>`; }

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
  button.textContent = group?.isFavorite ? '★ お気に入り' : '☆ お気に入り';
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
  }).join('') : '<div class="empty">まだ保存済み作品はありません。</div>';
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
  $('#detailContent').innerHTML = `<article class="panel stack"><div class="card-title"><div><p class="eyebrow">保存済み作品IP</p><h1 id="detailTitle">${esc(group.title)}</h1></div><button class="favorite-btn ${group.isFavorite ? 'active' : ''}" onclick="toggleSavedFavorite(${index}); renderDetail(${index})">${group.isFavorite ? '★ お気に入り' : '☆ お気に入り'}</button></div><h2>媒体候補と進捗状態</h2><div class="media-list">${group.items.map(item => savedItemHtml(item, index)).join('') || '<p class="muted">媒体候補は未保存です。</p>'}</div><h2>作品名で探す</h2><div class="${countClass('search-links', japaneseConfirmLinks(group.title).length)}">${japaneseConfirmLinks(group.title).map(link => actionLinkHtml(link)).join('')}</div></article>`;
  route('detail');
}
function savedItemHtml(item, groupIndex) {
  const normalized = normalizeItem(item);
  const options = statusOptions(normalized.media).map(option => `<option value="${esc(option)}" ${option === normalized.status ? 'selected' : ''}>${esc(option)}</option>`).join('');
  return `<article class="media-card"><div class="card-title"><h3>${esc(normalized.title)}</h3><span class="chip">${esc(normalized.media)}</span></div><p class="muted">${esc([normalized.year, normalized.sourceName].filter(Boolean).join(' / '))}</p><label class="status-control">進捗状態<select onchange="${scriptAttr(`updateSavedItemStatus(${groupIndex}, ${JSON.stringify(normalized.id)}, this.value)`)}">${options}</select></label><p>${esc(normalized.description || normalized.memo || '')}</p><div class="button-row"><a class="link-button" href="${esc(normalized.sourceUrl || '#')}" target="_blank" rel="noopener" title="データ出典を見る" aria-label="データ出典を見る">出典</a><button class="danger" onclick="${scriptAttr(`deleteSavedItem(${groupIndex}, ${JSON.stringify(normalized.id)})`)}" title="候補を削除" aria-label="候補を削除">削除</button></div></article>`;
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
  const searchDebugToggle = $('#searchDebugToggle');
  if (searchDebugToggle) {
    searchDebugToggle.checked = isSearchDebugEnabled();
    searchDebugToggle.onchange = () => { setSearchDebugEnabled(searchDebugToggle.checked); $('#settingsMessage').textContent = searchDebugToggle.checked ? '検索デバッグ表示をONにしました。' : '検索デバッグ表示をOFFにしました。'; };
  }
  $('#exportBtn').onclick = exportJson;
  $('#importBtn').onclick = importJson;
  $('#clearSavedBtn').onclick = () => { if (confirm('保存済み作品をすべて削除しますか？')) { saved = []; persistSaved(); $('#dataMessage').textContent = '保存済み作品を削除しました。'; } };
  $('#favoriteOnlyFilter').onchange = renderSaved;
  $('#resultFavoriteBtn').onclick = toggleResultFavorite;
  $('#manualAddBtn').onclick = () => $('#manualDialog').showModal();
  const homeManualAddBtn = $('#homeManualAddBtn');
  if (homeManualAddBtn) homeManualAddBtn.onclick = () => $('#manualDialog').showModal();
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
