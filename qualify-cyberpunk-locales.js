'use strict';

// Offline, read-only qualification of explicit physical printing records. A
// translated presentation is never used to manufacture a locale or an image.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PINNED_MAIN = '56402636a77af9c8b5dc4e3b61c509a185f3c834';
// Receipts of the immutable Git snapshot independently audited for the active
// EN beta corpus. Never calculate historical acceptance from current input.
const PINNED_EN_PRINTING_IDS_SHA256 = '54b8b31e0b85e2213a18fc7dc53583943492585501d555890a87e68ebac96ed4';
const PINNED_EN_CORPUS_SHA256 = '8ddb702ff918fa07339146e87721bef09c1b72555ee4419b9c60501d91d8f38e';
const DATABASE_REPOSITORY = 'maximelaburthe-commits/tcgate_db_cyberpunk';
const unique = values => [...new Set(values)].sort();
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const isId = value => typeof value === 'string' && value.trim() === value && value.length > 0;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function serialize(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function ratio(present, expected) { return { present, expected, ratio: expected ? present / expected : null }; }
function corpusFingerprint(cards, printings, references) {
  return digest(Buffer.from(serialize({
    cards: unique(cards.map(card => card.cardId)),
    printings: printings.map(printing => ({ printingId: printing.printingId, cardId: printing.cardId, locale: printing.locale, displayAssetPath: printing.image?.displayAssetPath || printing.displayAssetPath, visionAssetPath: printing.image?.visionAssetPath || printing.visionAssetPath, displaySha256: printing.image?.displaySha256 || printing.displaySha256, visionSha256: printing.image?.visionSha256 || printing.visionSha256 })).sort((left, right) => left.printingId.localeCompare(right.printingId)),
    references: references.map(reference => ({ refId: reference.refId, printingId: reference.referencePrintingId || reference.printingId, cardId: reference.cardId, locale: reference.locale, image: reference.referenceImageUrl || reference.visionAssetPath || reference.imageUrl })).sort((left, right) => left.refId.localeCompare(right.refId))
  })));
}
function safeAssetPath(value) {
  if (!isId(value) || value.includes('\\') || value.startsWith('/') || /^[a-z]+:/i.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe asset path: ${value}`);
  return value;
}
function readJson(root, name) { return JSON.parse(fs.readFileSync(path.join(root, safeAssetPath(name)), 'utf8')); }
function list(value, key) { return Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : []; }

// The inspector returns only measured facts. It checks both committed bytes and
// the expected digest; existence or an HTTP 200 alone does not qualify an image.
function fileInspector(root) {
  return (assetPath, expectedSha256) => {
    try {
      safeAssetPath(assetPath);
      const absolute = path.resolve(root, assetPath);
      const realRoot = fs.realpathSync(root), realFile = fs.realpathSync(absolute);
      if (!realFile.startsWith(`${realRoot}${path.sep}`)) return { accessible: false, reason: 'OUTSIDE_SOURCE' };
      const bytes = fs.readFileSync(realFile), sha256 = digest(bytes);
      const image = bytes.length > 12 && (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' || bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255);
      if (!image) return { accessible: false, reason: 'INVALID_IMAGE_BYTES', sha256, bytes: bytes.length };
      if (!/^[a-f0-9]{64}$/.test(expectedSha256 || '')) return { accessible: false, reason: 'MISSING_EXPECTED_SHA256', sha256, bytes: bytes.length };
      return { accessible: sha256 === expectedSha256, reason: sha256 === expectedSha256 ? null : 'SHA256_MISMATCH', sha256, bytes: bytes.length };
    } catch { return { accessible: false, reason: 'MISSING_OR_UNREADABLE_ASSET' }; }
  };
}

function auditLocale(input) {
  const { locale, cards, printings, references, inspectAsset } = input;
  if (!isId(locale) || !Array.isArray(cards) || !Array.isArray(printings) || !Array.isArray(references) || typeof inspectAsset !== 'function') throw new Error('Locale audit requires explicit arrays and an asset inspector');
  const cardMap = new Map(), printingMap = new Map(), officialPrintingMap = new Map(), duplicates = [], orphans = [], invalidReferences = [], metadataErrors = [];
  for (const card of cards) {
    if (!isId(card.cardId)) metadataErrors.push('Canonical card without cardId');
    else if (cardMap.has(card.cardId)) duplicates.push(`cardId:${card.cardId}`);
    else cardMap.set(card.cardId, card);
  }
  for (const printing of printings) {
    if (!isId(printing.printingId)) metadataErrors.push('Printing without printingId');
    else if (printingMap.has(printing.printingId)) duplicates.push(`printingId:${printing.printingId}`);
    else printingMap.set(printing.printingId, printing);
    if (isId(printing.officialPrintingId)) {
      if (officialPrintingMap.has(printing.officialPrintingId)) duplicates.push(`officialPrintingId:${printing.officialPrintingId}`);
      else officialPrintingMap.set(printing.officialPrintingId, printing);
    }
  }
  const selected = printings.filter(printing => printing.locale === locale);
  const localized = (input.localizations || []).filter(item => item.locale === locale);
  const expectedCardIds = unique(input.expectedCardIds || selected.map(printing => printing.cardId).filter(isId));
  const expectedPrintingIds = unique(input.expectedPrintingIds || selected.map(printing => printing.printingId).filter(isId));
  const selectedCards = unique(selected.map(printing => printing.cardId).filter(id => cardMap.has(id)));
  const selectedIds = unique(selected.map(printing => printing.printingId).filter(isId));
  const assets = [], missingDisplay = [], missingVision = [], invalidAssets = [], coveredReferencePrintingIds = new Set(), refIds = new Set(), referenceKeys = new Set();
  const variants = {};
  for (const printing of selected) {
    if (!isId(printing.cardId) || !cardMap.has(printing.cardId)) orphans.push(`printing:${printing.printingId}:${printing.cardId || 'MISSING_CARD_ID'}`);
    if (printing.sourceLocale !== undefined && printing.sourceLocale !== locale) metadataErrors.push(`Printing sourceLocale mismatch:${printing.printingId}`);
    const variant = printing.variantKind || 'unspecified'; variants[variant] = (variants[variant] || 0) + 1;
    for (const kind of ['display', 'vision']) {
      const assetPath = printing.image?.[`${kind}AssetPath`] || printing[`${kind}AssetPath`];
      const expectedSha = printing.image?.[`${kind}Sha256`] || printing[`${kind}Sha256`];
      const measured = assetPath ? inspectAsset(assetPath, expectedSha) : { accessible: false, reason: 'ASSET_NOT_DECLARED' };
      assets.push({ printingId: printing.printingId, kind, path: assetPath || null, expectedSha256: expectedSha || null, ...measured });
      if (!measured.accessible) (kind === 'display' ? missingDisplay : missingVision).push(printing.printingId);
      if (assetPath && !measured.accessible) invalidAssets.push(`${kind}:${printing.printingId}:${measured.reason}`);
      const otherLocaleOwner = printings.find(other => other.locale !== locale && (other.image?.[`${kind}AssetPath`] || other[`${kind}AssetPath`]) === assetPath && assetPath);
      if (otherLocaleOwner) invalidAssets.push(`${kind}:${printing.printingId}:CROSS_LOCALE_ASSET:${otherLocaleOwner.printingId}`);
      const otherLocaleDigest = expectedSha && printings.find(other => other.locale !== locale && (other.image?.[`${kind}Sha256`] || other[`${kind}Sha256`]) === expectedSha);
      if (otherLocaleDigest) invalidAssets.push(`${kind}:${printing.printingId}:CROSS_LOCALE_BYTES:${otherLocaleDigest.printingId}`);
    }
  }
  const selectedReferences = references.filter(reference => {
    const printing = printingMap.get(reference.referencePrintingId || reference.printingId);
    // An explicitly wrong-locale reference still belongs to the physical
    // printing's audit and must fail there rather than silently disappearing.
    return reference.locale === locale || printing?.locale === locale || !printing && reference.locale == null;
  });
  for (const reference of selectedReferences) {
    const physicalId = reference.referencePrintingId || reference.printingId;
    const printing = printingMap.get(physicalId);
    const refId = reference.refId || `${physicalId}:${reference.referenceImageUrl || reference.visionAssetPath || ''}`;
    if (refIds.has(refId)) duplicates.push(`referenceId:${refId}`); refIds.add(refId);
    const image = reference.referenceImageUrl || reference.visionAssetPath || reference.imageUrl;
    const physicalKey = `${physicalId}:${image || ''}`;
    if (referenceKeys.has(physicalKey)) duplicates.push(`physicalReference:${physicalKey}`); referenceKeys.add(physicalKey);
    if (!printing) { orphans.push(`reference:${refId}:${physicalId || 'MISSING_PRINTING_ID'}`); continue; }
    if (!isId(reference.cardId) || !cardMap.has(reference.cardId) || reference.cardId !== printing.cardId) invalidReferences.push(`cardId:${refId}`);
    if (printing.locale !== locale || reference.locale !== locale || reference.sourceLocale !== undefined && reference.sourceLocale !== locale) invalidReferences.push(`locale:${refId}`);
    if (reference.printingId != null && reference.printingId !== physicalId) invalidReferences.push(`printingId:${refId}`);
    const expectedPath = printing.image?.visionAssetPath || printing.visionAssetPath;
    if (!image || !expectedPath || image !== expectedPath && image !== input.resolveAssetUrl?.(expectedPath)) invalidReferences.push(`unresolvedImage:${refId}`);
    if (!Array.isArray(reference.candidatePrintingIds) && reference.printingId == null) invalidReferences.push(`unresolvedCandidates:${refId}`);
    if (Array.isArray(reference.candidatePrintingIds)) {
      if (!reference.candidatePrintingIds.includes(physicalId) || new Set(reference.candidatePrintingIds).size !== reference.candidatePrintingIds.length) invalidReferences.push(`candidates:${refId}`);
      for (const candidateId of reference.candidatePrintingIds) {
        const candidate = printingMap.get(candidateId);
        if (!candidate || candidate.cardId !== reference.cardId || candidate.locale !== locale) invalidReferences.push(`candidate:${refId}:${candidateId}`);
      }
    }
    coveredReferencePrintingIds.add(physicalId);
  }
  const missing = {
    cardIds: expectedCardIds.filter(id => !selectedCards.includes(id)),
    printingIds: expectedPrintingIds.filter(id => !selectedIds.includes(id)),
    displayImages: unique(missingDisplay), visionImages: unique(missingVision),
    referencePrintingIds: expectedPrintingIds.filter(id => !coveredReferencePrintingIds.has(id))
  };
  const localizationsByCard = new Map(localized.map(item => [item.cardId, item]));
  const missingFields = {};
  for (const field of ['displayName', 'rulesText', 'flavorText', 'typeLabel', 'tagLabels', 'keywordLabels']) {
    const ids = expectedCardIds.filter(id => { const item = localizationsByCard.get(id); return item && (item[field] === undefined || item[field] === null || field === 'displayName' && !item[field]); });
    if (ids.length) missingFields[field] = ids;
  }
  const dataReady = selected.length > 0 && !metadataErrors.length && !orphans.some(value => value.startsWith('printing:')) && !duplicates.some(value => /^(cardId|printingId|officialPrintingId):/.test(value)) && !missing.cardIds.length && !missing.printingIds.length;
  const assetsPass = selected.length > 0 && !missing.displayImages.length && !missing.visionImages.length && !invalidAssets.length;
  const structurePass = dataReady && assetsPass && selectedReferences.length > 0 && !missing.referencePrintingIds.length && !invalidReferences.length && !duplicates.length && !orphans.length;
  const historical = input.historicalQualification || null;
  const physical = input.physicalQualification || { status: 'NOT TESTED' };
  // Historical evidence may only retain an already-qualified exact corpus. It
  // cannot qualify a changed snapshot or a newly introduced physical locale.
  const fingerprint = corpusFingerprint(cards.filter(card => selectedCards.includes(card.cardId)), selected.filter(printing => isId(printing.printingId)), selectedReferences.filter(reference => isId(reference.refId)));
  const historicalValid = historical?.status === 'PASS' && input.sourceSha === PINNED_MAIN && locale === 'en' && historical.sourceSha === PINNED_MAIN && historical.locale === 'en' && historical.referenceCount === 229 && selectedReferences.length === 229 && historical.printingIdsSha256 === PINNED_EN_PRINTING_IDS_SHA256 && digest(Buffer.from(unique(selectedIds).join('\n'))) === PINNED_EN_PRINTING_IDS_SHA256 && fingerprint === PINNED_EN_CORPUS_SHA256;
  const physicalPass = physical.status === 'PASS' && physical.sourceSha === input.sourceSha && physical.locale === locale && physical.referenceCount === selectedReferences.length && physical.printingIdsSha256 === digest(Buffer.from(unique(selectedIds).join('\n'))) && Array.isArray(physical.samples) && physical.samples.length > 0 && physical.samples.every(sample => sample.locale === locale && selectedIds.includes(sample.printingId) && printingMap.get(sample.printingId)?.cardId === sample.cardId && sample.detected === true && sample.identified === true && sample.correct === true);
  const visionReady = structurePass && assetsPass && (physicalPass || historicalValid);
  return {
    locale, canonicalCards: selectedCards.length, printings: selected.length, visionReferences: selectedReferences.length, corpusSha256: fingerprint,
    dataCoverage: ratio(expectedCardIds.filter(id => selectedCards.includes(id)).length, expectedCardIds.length),
    printingCoverage: ratio(expectedPrintingIds.filter(id => selectedIds.includes(id)).length, expectedPrintingIds.length),
    referenceCoverage: ratio(expectedPrintingIds.filter(id => coveredReferencePrintingIds.has(id)).length, expectedPrintingIds.length),
    images: { display: { available: selected.length - missingDisplay.length, missing: missingDisplay.length }, vision: { available: selected.length - missingVision.length, missing: missingVision.length } },
    metadata: { localizationCount: localized.length, missingLocalizationCardIds: expectedCardIds.filter(id => !localizationsByCard.has(id)), missingFields, errors: unique(metadataErrors) },
    catalogCardsWithoutLocalePrinting: [...cardMap.keys()].filter(id => !selectedCards.includes(id)).sort(),
    missing, invalidReferences: unique(invalidReferences), invalidAssets: unique(invalidAssets), duplicates: unique(duplicates), orphans: unique(orphans), variants, assets,
    dataReady, dataQualification: dataReady && !Object.keys(missingFields).some(field => field !== 'flavorText') && (!localized.length || expectedCardIds.every(id => localizationsByCard.has(id))) ? 'COMPLETE' : 'PARTIAL',
    structuralQualification: structurePass ? 'PASS' : 'FAIL', assetQualification: assetsPass ? 'PASS' : 'FAIL',
    physicalQualification: { status: physical.status || 'NOT TESTED', accepted: physicalPass, historicalStatus: historicalValid ? 'PASS' : null, historicalEvidence: historicalValid ? historical.evidence : null },
    visionReady, verdict: visionReady ? 'VISION READY' : 'NOT VISION READY'
  };
}

function normalizeSnapshot(root, { sha, ref }) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Exact 40-character source SHA required');
  const manifest = readJson(root, 'manifest.json');
  if ((manifest.game_id || manifest.game) !== 'cyberpunk-tcg') throw new Error('Cyberpunk database required');
  const rawPrintings = list(readJson(root, 'data/printings.json'), 'printings');
  const legacy = sha === PINNED_MAIN && (manifest.database_version || manifest.databaseVersion) === '1.1.0';
  const normalizePrinting = printing => ({ ...printing, locale: printing.locale || (legacy ? 'en' : null) });
  const catalog = {
    cards: list(readJson(root, 'data/cards.json'), 'cards'),
    printings: rawPrintings.map(normalizePrinting),
    localizations: manifest.localizations ? list(readJson(root, manifest.localizations), 'localizations') : []
  };
  const runtime = {
    cards: list(readJson(root, manifest.runtime_cards || manifest.entrypoint), 'cards'),
    printings: list(readJson(root, manifest.runtime_printings), 'printings').map(normalizePrinting)
  };
  // Runtime minification omits checksums; the catalog remains their authority.
  const byId = new Map(catalog.printings.map(printing => [printing.printingId, printing]));
  runtime.printings = runtime.printings.map(printing => ({ ...byId.get(printing.printingId), ...printing, locale: printing.locale || byId.get(printing.printingId)?.locale, image: { ...byId.get(printing.printingId)?.image, ...printing.image } }));
  const catalogReferences = catalog.printings.filter(printing => printing.recognition?.enabled && printing.image?.visionAssetPath).map(printing => ({ refId: printing.printingId, cardId: printing.cardId, printingId: printing.printingId, locale: printing.locale, sourceLocale: printing.sourceLocale, referenceImageUrl: printing.recognition.referenceImageUrl || printing.image.visionAssetPath }));
  const groups = readJson(root, manifest.printing_recognition_index).cards || [];
  const runtimeById = new Map(runtime.printings.map(printing => [printing.printingId, printing]));
  runtime.references = groups.flatMap(card => (card.recognitionGroups || []).flatMap(group => (group.references || []).map(reference => ({ ...reference, refId: `${group.recognitionGroupId}:${reference.printingId}`, cardId: card.cardId, locale: runtimeById.get(reference.printingId)?.locale, referenceImageUrl: reference.visionAssetPath || reference.referenceImageUrl }))));
  catalog.references = catalogReferences;
  const unknownLocales = unique(catalog.printings.filter(printing => !isId(printing.locale)).map(printing => printing.printingId || 'MISSING_PRINTING_ID'));
  if (unknownLocales.length) throw new Error(`Physical locale missing in source: ${unknownLocales.join(',')}`);
  const expectations = {};
  const officialRoot = path.join(root, 'sources', 'official');
  if (fs.existsSync(officialRoot)) {
    // Each latest explicit raw locale snapshot supplies an independent expected
    // physical-edition list. Translated display text is not a locale source.
    const dates = fs.readdirSync(officialRoot).filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
    for (const date of dates) for (const filename of fs.readdirSync(path.join(officialRoot, date)).filter(name => /^raw-[a-z]{2}(?:-[A-Za-z0-9]+)*\.json$/.test(name))) {
      const locale = filename.slice(4, -5), raw = readJson(root, `sources/official/${date}/${filename}`);
      const items = list(raw, 'items').filter(item => item.language === locale);
      if (!items.length) continue;
      const cardIds = items.map(item => catalog.cards.find(card => card.slug === item.slug)?.cardId || `source-card:${item.external_id || item.slug || item.id}`);
      const officialIds = unique(items.flatMap(item => (item.printings || []).filter(printing => printing.language === locale).map(printing => printing.id)));
      const printingIds = officialIds.map(id => catalog.printings.find(printing => printing.officialPrintingId === id && printing.locale === locale)?.printingId || `official:${id}`);
      expectations[locale] = { cardIds: unique(cardIds), printingIds, source: `sources/official/${date}/${filename}`, officialPrintingIds: officialIds };
    }
  }
  return { root, sha, ref, manifest, catalog, runtime, expectations, inspectAsset: fileInspector(root) };
}

function auditSnapshot(root, options) {
  const source = normalizeSnapshot(root, options), scopes = {};
  for (const scope of ['catalog', 'runtime']) {
    const data = source[scope], locales = {};
    for (const locale of unique([...data.printings.map(printing => printing.locale), ...(scope === 'catalog' ? Object.keys(source.expectations) : [])])) {
      const selected = data.printings.filter(printing => printing.locale === locale);
      const historical = scope === 'runtime' && options.sha === PINNED_MAIN && locale === 'en' ? {
        status: 'PASS', sourceSha: PINNED_MAIN, locale: 'en', referenceCount: 229,
        printingIdsSha256: PINNED_EN_PRINTING_IDS_SHA256,
        evidence: 'Owner-confirmed Candidate 15 Q16 physical Cyberpunk PASS; retained pinned EN beta corpus. No new physical test in this milestone.'
      } : null;
      const expected = scope === 'catalog' ? source.expectations[locale] : null;
      locales[locale] = auditLocale({ ...data, locale, sourceSha: source.sha, inspectAsset: source.inspectAsset, historicalQualification: historical, expectedCardIds: expected?.cardIds, expectedPrintingIds: expected?.printingIds });
      locales[locale].expectations = expected ? { basis: 'Independent official physical-locale snapshot', source: expected.source, officialPrintingIds: expected.officialPrintingIds } : { basis: 'Observed explicit physical printing records; missing undeclared editions cannot be inferred' };
    }
    scopes[scope] = { canonicalCards: data.cards.length, printings: data.printings.length, locales };
  }
  const files = ['manifest.json', 'data/cards.json', 'data/printings.json', source.manifest.runtime_cards || source.manifest.entrypoint, source.manifest.runtime_printings, source.manifest.printing_recognition_index, source.manifest.localizations, ...Object.values(source.expectations).map(expected => expected.source)].filter(Boolean);
  const inputSha256 = Object.fromEntries(unique(files).map(filename => [filename, digest(fs.readFileSync(path.join(root, filename)))]));
  return { ref: source.ref, sha: source.sha, manifestVersion: source.manifest.database_version || source.manifest.databaseVersion, inputSha256, ...scopes };
}

async function activeCorpus(mainRoot) {
  const registry = require('./public/game-databases.js');
  const source = require('./public/database-source.js');
  const player = require('./public/player-locale.js');
  const config = registry.get('cyberpunk');
  const base = new URL(config.manifestUrl);
  const fetchImpl = async url => {
    const parsed = new URL(url), baseDirectory = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(baseDirectory)) throw new Error('Unexpected database URL');
    const relative = decodeURIComponent(parsed.pathname.slice(baseDirectory.length));
    return { ok: true, status: 200, text: async () => fs.readFileSync(path.join(mainRoot, safeAssetPath(relative)), 'utf8') };
  };
  source.clear('cyberpunk');
  try {
    const refs = await source.getVisionReferences('cyberpunk', 'en', { fetchImpl });
    const exactIds = refs.filter(reference => reference.printingId != null).map(reference => reference.printingId);
    if (new Set(refs.map(reference => reference.refId)).size !== refs.length || new Set(exactIds).size !== exactIds.length) throw new Error('Invalid duplicate active Vision reference');
    return { descriptorLocales: Object.keys(config.locales).sort(), selectableLocales: player.getAvailablePlayerLocales('cyberpunk').map(locale => locale.code).sort(), visionReferences: refs.length, exactReferences: refs.filter(reference => reference.recognitionMode === 'exact').length, sharedReferences: refs.filter(reference => reference.recognitionMode === 'shared').length, referenceLocales: unique(refs.map(reference => reference.locale)), cardIds: unique(refs.map(reference => reference.cardId)), printingIds: unique(refs.map(reference => reference.referencePrintingId || reference.printingId)), referenceIdsSha256: digest(Buffer.from(unique(refs.map(reference => reference.refId)).join('\n'))), manifestUrl: config.manifestUrl, noGameLocales: player.getAvailablePlayerLocales('no-game').length };
  } finally { source.clear('cyberpunk'); }
}
async function buildQualification({ mainRoot, developRoot, mainSha, developSha }) {
  const activeSha = new URL(require('./public/game-databases.js').get('cyberpunk').manifestUrl).pathname.split('/').slice(-2, -1)[0];
  if (mainSha !== activeSha) throw new Error('Audited main SHA differs from the immutable active manifest; provide its separate pinned snapshot before comparing corpora');
  const main = auditSnapshot(mainRoot, { sha: mainSha, ref: 'main' });
  const develop = auditSnapshot(developRoot, { sha: developSha, ref: 'develop-cyberpunk-db-v1.2' });
  const active = await activeCorpus(mainRoot);
  const en = main.runtime.locales.en;
  const auditedSource = normalizeSnapshot(mainRoot, { sha: mainSha, ref: 'main' });
  const auditedIds = unique(auditedSource.runtime.printings.filter(printing => printing.locale === 'en').map(printing => printing.printingId));
  if (!en || active.visionReferences !== en.visionReferences || active.referenceLocales.some(locale => locale !== 'en') || serialize(active.printingIds) !== serialize(auditedIds)) throw new Error('Active Locale Core corpus does not match audited EN runtime');
  const fr = develop.catalog.locales.fr || null;
  return { schemaVersion: '1.0.0', gameId: 'cyberpunk-tcg', repository: DATABASE_REPOSITORY, sources: { main, develop }, locales: { en, ...(fr ? { fr } : {}) }, active, decision: { fr: fr?.verdict || 'NOT VISION READY' }, physicalTestingThisMilestone: 'NOT TESTED', expectedCountsPolicy: 'Only explicitly declared physical locale printings define the locale denominator. Catalog-wide gaps are comparisons, not invented language editions.' };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!['--main-root', '--develop-root', '--main-sha', '--develop-sha', '--output'].includes(key) || !argv[index + 1] || Object.hasOwn(args, key.slice(2))) throw new Error(`Invalid or duplicate argument: ${key}`);
    args[key.slice(2)] = argv[index + 1];
  }
  for (const key of ['main-root', 'develop-root', 'main-sha', 'develop-sha', 'output']) if (!args[key]) throw new Error(`Missing --${key}`);
  const canonicalPath = value => {
    let ancestor = path.resolve(value); const suffix = [];
    while (!fs.existsSync(ancestor)) { const parent = path.dirname(ancestor); if (parent === ancestor) break; suffix.unshift(path.basename(ancestor)); ancestor = parent; }
    const absolute = path.join(fs.realpathSync(ancestor), ...suffix);
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  };
  const output = canonicalPath(args.output), project = canonicalPath(__dirname);
  if (output === project || output.startsWith(`${project}${path.sep}`)) throw new Error('Qualification artifacts must remain outside the product repository');
  for (const root of [args['main-root'], args['develop-root']]) {
    const source = canonicalPath(root);
    if (output === source || output.startsWith(`${source}${path.sep}`)) throw new Error('Qualification artifacts must not modify a database snapshot');
  }
  return args;
}
async function cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = await buildQualification({ mainRoot: args['main-root'], developRoot: args['develop-root'], mainSha: args['main-sha'], developSha: args['develop-sha'] });
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, serialize(report), { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`CYBERPUNK_LOCALES_REPORT ${path.resolve(args.output)}\nEN ${report.locales.en.verdict}; FR ${report.decision.fr}; PHYSICAL THIS MILESTONE NOT TESTED\n`);
  return report;
}
module.exports = Object.freeze({ PINNED_MAIN, PINNED_EN_PRINTING_IDS_SHA256, PINNED_EN_CORPUS_SHA256, corpusFingerprint, auditLocale, fileInspector, normalizeSnapshot, auditSnapshot, activeCorpus, buildQualification, serialize, parseArgs, cli });
if (require.main === module) cli().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
