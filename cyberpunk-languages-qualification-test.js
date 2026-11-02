'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = process.env.TCGATE_CYBERPUNK_QUALIFICATION_TEST_ROOT || __dirname;
const qualification = require(path.join(root, 'qualify-cyberpunk-locales.js'));
const playerModule = require(path.join(root, 'public/player-locale.js'));
const visionModule = require(path.join(root, 'public/vision-locale.js'));
const localeCore = require(path.join(root, 'public/database-locale-core.js'));
const registry = require(path.join(root, 'public/game-databases.js'));
let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }
function same(actual, expected, message) { assertions += 1; assert.deepStrictEqual(actual, expected, message); }
function check(value, message) { assertions += 1; assert(value, message); }
function throws(callback, pattern, message) { assertions += 1; assert.throws(callback, pattern, message); }
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));

function fixture() {
  const cards = [{ cardId: 'same-card', name: 'Canonical', type: 'Unit' }];
  const printings = ['en', 'fr'].map(locale => ({ cardId: 'same-card', printingId: `physical-${locale}`, locale, sourceLocale: locale, variantKind: 'standard', image: { displayAssetPath: `assets/display/${locale}.png`, visionAssetPath: `assets/vision/${locale}.png`, displaySha256: hash(Buffer.from(`display:${locale}`)), visionSha256: hash(Buffer.from(`vision:${locale}`)) } }));
  const references = printings.map(printing => ({ refId: `ref:${printing.printingId}`, cardId: printing.cardId, printingId: printing.printingId, locale: printing.locale, sourceLocale: printing.locale, referenceImageUrl: printing.image.visionAssetPath }));
  const localizations = ['en', 'fr'].map(locale => ({ cardId: 'same-card', locale, displayName: `Name ${locale}`, rulesText: 'Rules', typeLabel: 'Unit', tagLabels: [], keywordLabels: [] }));
  return { locale: 'fr', cards, printings, references, localizations, sourceSha: 'a'.repeat(40), inspectAsset: (assetPath, sha256) => ({ accessible: Boolean(assetPath && sha256), sha256, bytes: 50, reason: null }) };
}
function audit(change) { const input = fixture(); if (change) change(input); return qualification.auditLocale(input); }
function fails(change, property, expected) { const report = audit(change); equal(report.visionReady, false); equal(report.structuralQualification, 'FAIL'); if (property) check(expected ? report[property].some(item => item.includes(expected)) : report[property].length > 0); return report; }

async function main() {
  const complete = audit();
  equal(complete.dataReady, true);
  equal(complete.dataQualification, 'COMPLETE');
  equal(complete.structuralQualification, 'PASS');
  equal(complete.assetQualification, 'PASS');
  equal(complete.physicalQualification.status, 'NOT TESTED');
  equal(complete.visionReady, false, 'Structural completeness never invents physical PASS');
  equal(complete.verdict, 'NOT VISION READY');
  same(complete.dataCoverage, { present: 1, expected: 1, ratio: 1 });
  same(complete.printingCoverage, { present: 1, expected: 1, ratio: 1 });
  same(complete.referenceCoverage, { present: 1, expected: 1, ratio: 1 });
  equal(complete.printings, 1);
  equal(complete.canonicalCards, 1);
  equal(complete.visionReferences, 1);
  same(complete.catalogCardsWithoutLocalePrinting, []);
  fails(input => { input.printings[1].image.visionAssetPath = null; });
  fails(input => { input.printings[1].image.displayAssetPath = null; });
  fails(input => { input.references[1].locale = 'en'; }, 'invalidReferences', 'locale:');
  fails(input => { input.references[1].sourceLocale = 'en'; }, 'invalidReferences', 'locale:');
  fails(input => { input.printings[1].sourceLocale = 'en'; });
  fails(input => { delete input.references[1].cardId; }, 'invalidReferences', 'cardId:');
  fails(input => { delete input.printings[1].cardId; }, 'orphans', 'printing:');
  fails(input => { input.printings[1].cardId = 'not-a-card'; }, 'orphans', 'printing:');
  fails(input => { input.references[1].printingId = 'orphan-printing'; }, 'orphans', 'reference:');
  fails(input => { input.references.push(clone(input.references[1])); }, 'duplicates', 'referenceId:');
  fails(input => { const duplicate = clone(input.references[1]); duplicate.refId = 'different-id'; input.references.push(duplicate); }, 'duplicates', 'physicalReference:');
  fails(input => { input.references[1].referenceImageUrl = input.printings[0].image.visionAssetPath; }, 'invalidReferences', 'unresolvedImage:');
  fails(input => { input.printings[1].image.visionAssetPath = input.printings[0].image.visionAssetPath; input.references[1].referenceImageUrl = input.printings[0].image.visionAssetPath; }, 'invalidAssets', 'CROSS_LOCALE_ASSET:');
  fails(input => { input.printings[1].image.visionSha256 = input.printings[0].image.visionSha256; }, 'invalidAssets', 'CROSS_LOCALE_BYTES:');
  fails(input => { input.references[1].referenceImageUrl = ''; }, 'invalidReferences', 'unresolvedImage:');
  fails(input => { input.inspectAsset = () => ({ accessible: false, reason: 'UNREADABLE' }); }, 'invalidAssets', 'UNREADABLE');
  fails(input => { input.references[1].candidatePrintingIds = ['physical-en', 'physical-fr']; }, 'invalidReferences', 'candidate:');
  fails(input => { input.references[1].candidatePrintingIds = ['physical-fr', 'physical-fr']; }, 'invalidReferences', 'candidates:');
  fails(input => { input.references = input.references.filter(reference => reference.locale !== 'fr'); });
  fails(input => { input.printings.push(clone(input.printings[1])); }, 'duplicates', 'printingId:');
  fails(input => { input.printings[0].officialPrintingId = 'duplicate-physical-official-id'; input.printings[1].officialPrintingId = 'duplicate-physical-official-id'; }, 'duplicates', 'officialPrintingId:');
  fails(input => { input.expectedPrintingIds = ['physical-fr', 'not-yet-present']; });
  const partial = audit(input => { input.localizations[1].typeLabel = null; });
  equal(partial.dataReady, true, 'Usable metadata contract does not imply a complete translation or a Vision corpus');
  equal(partial.dataQualification, 'PARTIAL');
  same(partial.metadata.missingFields.typeLabel, ['same-card']);
  const undeclaredLanguage = audit(input => { input.locale = 'de'; input.localizations.push({ ...input.localizations[0], locale: 'de' }); });
  equal(undeclaredLanguage.printings, 0, 'A translated label cannot manufacture a physical locale');
  equal(undeclaredLanguage.dataReady, false);
  equal(undeclaredLanguage.visionReady, false);

  const nearlyComplete = audit(input => {
    input.expectedPrintingIds = ['physical-fr', 'fr-2'];
    input.expectedCardIds = ['same-card'];
  });
  equal(nearlyComplete.printingCoverage.ratio, 0.5);
  equal(nearlyComplete.visionReady, false);
  const withVariants = audit(input => {
    const printing = clone(input.printings[1]); printing.printingId = 'physical-fr-art'; printing.variantKind = 'alternate'; printing.image.displayAssetPath = 'assets/display/fr-art.png'; printing.image.visionAssetPath = 'assets/vision/fr-art.png'; printing.image.displaySha256 = hash(Buffer.from('display:fr-art')); printing.image.visionSha256 = hash(Buffer.from('vision:fr-art')); input.printings.push(printing);
    input.references.push({ ...input.references[1], refId: 'ref:art', printingId: printing.printingId, referenceImageUrl: printing.image.visionAssetPath });
  });
  equal(withVariants.structuralQualification, 'PASS');
  equal(withVariants.printings, 2);
  equal(withVariants.canonicalCards, 1, 'Art/language printings never split canonical card IDs');
  same(withVariants.variants, { standard: 1, alternate: 1 });
  same(withVariants.duplicates, []);

  const bindPhysical = input => ({ status: 'PASS', sourceSha: input.sourceSha, locale: 'fr', referenceCount: 1, printingIdsSha256: hash(Buffer.from('physical-fr')), samples: [{ cardId: 'same-card', printingId: 'physical-fr', locale: 'fr', detected: true, identified: true, correct: true }] });
  const qualifiedFixture = audit(input => { input.physicalQualification = bindPhysical(input); });
  equal(qualifiedFixture.visionReady, true, 'Synthetic fixture only verifies the policy, never production qualification');
  equal(qualifiedFixture.physicalQualification.accepted, true);
  for (const field of ['sourceSha', 'locale', 'referenceCount', 'printingIdsSha256']) {
    const mismatch = audit(input => { input.physicalQualification = bindPhysical(input); input.physicalQualification[field] = field === 'referenceCount' ? 2 : 'mismatch'; });
    equal(mismatch.visionReady, false, `Physical evidence must match ${field}`);
  }
  equal(audit(input => { input.physicalQualification = { status: 'PASS' }; }).visionReady, false, 'A bare PASS flag is not evidence');
  equal(audit(input => { input.physicalQualification = bindPhysical(input); input.physicalQualification.samples[0].correct = false; }).visionReady, false);
  equal(audit(input => { input.physicalQualification = bindPhysical(input); input.printings[1].image.visionAssetPath = null; }).visionReady, false);
  const staleHistorical = audit(input => { input.historicalQualification = { status: 'PASS', sourceSha: 'b'.repeat(40), locale: 'fr', referenceCount: 1, printingIdsSha256: hash(Buffer.from('physical-fr')) }; });
  equal(staleHistorical.visionReady, false, 'A historical PASS cannot qualify another snapshot');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcgate-locales-asset-test-'));
  const image = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from('fixture')]);
  fs.writeFileSync(path.join(dir, 'image.webp'), image);
  const inspector = qualification.fileInspector(dir);
  equal(inspector('image.webp', hash(image)).accessible, true);
  equal(inspector('image.webp', '0'.repeat(64)).reason, 'SHA256_MISMATCH');
  equal(inspector('image.webp', null).reason, 'MISSING_EXPECTED_SHA256');
  equal(inspector('absent.webp', hash(image)).accessible, false);
  equal(inspector('../image.webp', hash(image)).accessible, false);
  equal(inspector('https://example.invalid/image.webp', hash(image)).accessible, false);
  fs.writeFileSync(path.join(dir, 'not-image.webp'), 'HTML error response');
  equal(inspector('not-image.webp', hash(Buffer.from('HTML error response'))).reason, 'INVALID_IMAGE_BYTES');
  throws(() => qualification.parseArgs([]), /Missing/);
  throws(() => qualification.parseArgs(['--fake', 'x']), /Invalid/);
  throws(() => qualification.parseArgs(['--main-root', 'a', '--main-root', 'a']), /duplicate/);
  throws(() => qualification.parseArgs(['--main-root', dir, '--develop-root', dir, '--main-sha', 'a'.repeat(40), '--develop-sha', 'b'.repeat(40), '--output', path.join(root, 'report.json')]), /outside/);
  throws(() => qualification.parseArgs(['--main-root', dir, '--develop-root', dir, '--main-sha', 'a'.repeat(40), '--develop-sha', 'b'.repeat(40), '--output', path.join(dir, 'report.json')]), /snapshot/);
  if (process.platform === 'win32') throws(() => qualification.parseArgs(['--main-root', dir, '--develop-root', dir, '--main-sha', 'a'.repeat(40), '--develop-sha', 'b'.repeat(40), '--output', path.join(root.toUpperCase(), 'nested', 'report.json')]), /outside/);
  equal(qualification.serialize({ b: 2, a: { y: 4, z: 5 } }), qualification.serialize({ a: { z: 5, y: 4 }, b: 2 }), 'Canonical report bytes do not depend on object insertion order');
  check(!qualification.serialize(complete).includes('generatedAt'), 'No variable clock in qualification reports');

  // Feed the measured readiness into the existing contracts, without a UI list.
  const descriptor = { gameId: 'qualification-fixture', databaseVersion: 'fixture-1', manifestUrl: 'https://example.invalid/fixture/manifest.json', defaultLocale: 'en', locales: { en: { label: 'English', dataReady: true, visionReady: true }, fr: { label: 'Français', dataReady: partial.dataReady, visionReady: partial.visionReady } } };
  const getDescriptor = gameId => gameId === 'fixture' ? descriptor : null;
  const player = playerModule.createPlayerLocales({ getDescriptor, storage: { getItem() { return null; }, setItem() {} } });
  same(player.getAvailablePlayerLocales('fixture').map(item => item.code), ['en']);
  same(player.getAvailablePlayerLocales('no-game'), []);
  equal(player.setPlayerLocale('fixture', 'fr'), 'en');
  const vision = visionModule.createVisionLocales({ core: localeCore, getDescriptor: gameId => gameId === 'fixture' ? { key: 'fixture', descriptor } : null, source: {} });
  equal(vision.context({ gameId: 'no-game', playerLocale: 'en' }), null);
  throws(() => vision.context({ gameId: 'fixture', playerLocale: 'fr' }), /unavailable for locale/);
  equal(vision.context({ gameId: 'fixture', playerLocale: 'en' }).playerLocale, 'en');
  descriptor.locales.fr.visionReady = qualifiedFixture.visionReady;
  same(player.getAvailablePlayerLocales('fixture').map(item => item.code), ['en', 'fr'], 'New qualified readiness is consumed automatically by Player Locale');
  equal(vision.context({ gameId: 'fixture', playerLocale: 'fr' }).playerLocale, 'fr');
  check(vision.context({ gameId: 'fixture', playerLocale: 'fr' }).visionIndexKey !== vision.context({ gameId: 'fixture', playerLocale: 'en' }).visionIndexKey);
  same(Object.keys(registry.get('cyberpunk').locales), ['en']);
  same(playerModule.getAvailablePlayerLocales('cyberpunk').map(item => item.code), ['en']);
  equal(registry.get('cyberpunk').locales.en.dataReady, true);
  equal(registry.get('cyberpunk').locales.en.visionReady, true);
  equal(registry.get('cyberpunk').locales.fr, undefined);
  const ui = fs.readFileSync(path.join(root, 'public/tcgate-ui-1.2.js'), 'utf8');
  const visionCode = fs.readFileSync(path.join(root, 'public/vision-locale.js'), 'utf8');
  check(ui.includes('getAvailablePlayerLocales(game)'));
  check(!/\[\s*['"]en['"]\s*,\s*['"]fr['"]\s*\]/.test(ui), 'UI has no language list');
  check(!/\[\s*['"]en['"]\s*,\s*['"]fr['"]\s*\]/.test(visionCode), 'Vision has no language list');
  check(visionCode.includes('getVisionReferences(selected.sourceGameId, selected.playerLocale'));

  const fixtureRoot = process.env.TCGATE_CYBERPUNK_MAIN_ROOT || process.env.TCGATE_DB_FIXTURE_ROOT;
  if (!fixtureRoot) throw new Error('TCGATE_DB_FIXTURE_ROOT must name the pinned EN database archive for reproducible qualification');
  const active = await qualification.activeCorpus(fixtureRoot);
  equal(active.visionReferences, 229);
  equal(active.exactReferences, 83);
  equal(active.sharedReferences, 146);
  same(active.referenceLocales, ['en']);
  equal(active.cardIds.length, 150);
  equal(active.printingIds.length, 229);
  same(active.selectableLocales, ['en']);
  equal(active.noGameLocales, 0);
  equal(active.manifestUrl, registry.get('cyberpunk').manifestUrl);
  const runtimeManifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
  equal(runtimeManifest.database_version, '1.1.0');
  const canonicalCards = JSON.parse(fs.readFileSync(path.join(fixtureRoot, runtimeManifest.runtime_cards), 'utf8'));
  const runtimePrintings = JSON.parse(fs.readFileSync(path.join(fixtureRoot, runtimeManifest.runtime_printings), 'utf8'));
  equal(canonicalCards.length, 150);
  equal(runtimePrintings.length, 229);
  const knownCards = new Set(canonicalCards.map(card => card.cardId));
  same(active.cardIds.filter(cardId => !knownCards.has(cardId)), []);
  equal(new Set(active.printingIds).size, 229);
  const developmentRoot = process.env.TCGATE_CYBERPUNK_DEVELOP_ROOT;
  if (!developmentRoot) throw new Error('TCGATE_CYBERPUNK_DEVELOP_ROOT must name the audited Cyberpunk development archive; FR must never be skipped');
  if (developmentRoot) {
    const source = qualification.normalizeSnapshot(fixtureRoot, { sha: qualification.PINNED_MAIN, ref: 'main' });
    const retainedEvidence = { status: 'PASS', sourceSha: qualification.PINNED_MAIN, locale: 'en', referenceCount: 229, printingIdsSha256: qualification.PINNED_EN_PRINTING_IDS_SHA256, evidence: 'Immutable owner-confirmed historical corpus' };
    const realInput = { ...source.runtime, locale: 'en', sourceSha: qualification.PINNED_MAIN, inspectAsset: source.inspectAsset, historicalQualification: retainedEvidence };
    equal(qualification.auditLocale(realInput).visionReady, true);
    const changedIdentity = { ...realInput, ...clone(source.runtime) };
    const previousId = changedIdentity.printings[0].printingId;
    changedIdentity.printings[0].printingId = 'same-card-count-different-physical-id';
    for (const reference of changedIdentity.references) if (reference.printingId === previousId) reference.printingId = changedIdentity.printings[0].printingId;
    const changedIdentityReport = qualification.auditLocale(changedIdentity);
    equal(changedIdentityReport.visionReferences, 229);
    equal(changedIdentityReport.structuralQualification, 'PASS');
    equal(changedIdentityReport.physicalQualification.historicalStatus, null);
    equal(changedIdentityReport.visionReady, false, '229 altered physical IDs cannot inherit the old qualification');
    const changedImage = { ...realInput, ...clone(source.runtime), inspectAsset: (assetPath, sha256) => ({ accessible: true, sha256, bytes: 50 }) };
    const previousImage = changedImage.printings[0].image.visionAssetPath;
    changedImage.printings[0].image.visionAssetPath = 'assets/vision/different-physical-image.webp';
    for (const reference of changedImage.references) if (reference.referenceImageUrl === previousImage) reference.referenceImageUrl = changedImage.printings[0].image.visionAssetPath;
    equal(qualification.auditLocale(changedImage).visionReferences, 229);
    equal(qualification.auditLocale(changedImage).visionReady, false, 'Changed image corpus cannot inherit the old qualification even with all images accessible');
    const development = qualification.normalizeSnapshot(developmentRoot, { sha: process.env.TCGATE_CYBERPUNK_DEVELOP_SHA || '425e0198610cd0a746c4e2d1fc3094b3823340e4', ref: 'develop-cyberpunk-db-v1.2' });
    const oneRemoved = { ...development.catalog, locale: 'fr', sourceSha: development.sha, inspectAsset: development.inspectAsset, expectedCardIds: development.expectations.fr.cardIds, expectedPrintingIds: development.expectations.fr.printingIds };
    oneRemoved.printings = oneRemoved.printings.filter(printing => printing.printingId !== development.expectations.fr.printingIds[0]);
    const missingEdition = qualification.auditLocale(oneRemoved);
    equal(missingEdition.printingCoverage.expected, 150);
    equal(missingEdition.printingCoverage.present, 149);
    equal(missingEdition.missing.printingIds.length, 1);
    equal(missingEdition.dataReady, false, 'Independent official snapshot detects a deleted FR edition');
    const noFrenchEditions = { ...oneRemoved, printings: oneRemoved.printings.filter(printing => printing.locale !== 'fr') };
    const absentFrench = qualification.auditLocale(noFrenchEditions);
    equal(absentFrench.printingCoverage.present, 0);
    equal(absentFrench.printingCoverage.expected, 150);
    equal(absentFrench.missing.printingIds.length, 150);
    equal(absentFrench.dataReady, false);
    await assert.rejects(() => qualification.buildQualification({ mainRoot: fixtureRoot, developRoot: developmentRoot, mainSha: 'a'.repeat(40), developSha: development.sha }), /immutable active manifest/); assertions += 1;
    const report = await qualification.buildQualification({ mainRoot: fixtureRoot, developRoot: developmentRoot, mainSha: qualification.PINNED_MAIN, developSha: process.env.TCGATE_CYBERPUNK_DEVELOP_SHA || '425e0198610cd0a746c4e2d1fc3094b3823340e4' });
    equal(report.locales.en.visionReady, true);
    equal(report.locales.en.visionReferences, 229);
    equal(report.locales.en.structuralQualification, 'PASS');
    equal(report.locales.en.physicalQualification.status, 'NOT TESTED');
    equal(report.locales.en.physicalQualification.historicalStatus, 'PASS');
    equal(report.locales.en.corpusSha256, qualification.PINNED_EN_CORPUS_SHA256);
    equal(report.locales.fr.printings, 150);
    equal(report.locales.fr.canonicalCards, 140);
    equal(report.locales.fr.visionReferences, 0);
    equal(report.locales.fr.dataReady, true);
    equal(report.locales.fr.visionReady, false);
    equal(report.locales.fr.dataQualification, 'PARTIAL');
    equal(report.locales.fr.assetQualification, 'FAIL');
    equal(report.locales.fr.structuralQualification, 'FAIL');
    equal(report.locales.fr.missing.visionImages.length, 150);
    equal(report.locales.fr.missing.displayImages.length, 150);
    equal(report.locales.fr.missing.referencePrintingIds.length, 150);
    equal(report.locales.fr.catalogCardsWithoutLocalePrinting.length, 11);
    same(report.locales.fr.invalidReferences, []);
    same(report.locales.fr.orphans, []);
    same(report.locales.fr.duplicates, []);
    equal(report.decision.fr, 'NOT VISION READY');
    const repeated = await qualification.buildQualification({ mainRoot: fixtureRoot, developRoot: developmentRoot, mainSha: qualification.PINNED_MAIN, developSha: report.sources.develop.sha });
    equal(qualification.serialize(report), qualification.serialize(repeated), 'Two complete audits produce byte-identical JSON');
    const outputA = path.join(dir, 'qualification-a.json'), outputB = path.join(dir, 'qualification-b.json');
    for (const output of [outputA, outputB]) {
      const result = spawnSync(process.execPath, [path.join(root, 'qualify-cyberpunk-locales.js'), '--main-root', fixtureRoot, '--develop-root', developmentRoot, '--main-sha', qualification.PINNED_MAIN, '--develop-sha', report.sources.develop.sha, '--output', output], { encoding: 'utf8' });
      equal(result.status, 0, result.stderr);
      check(result.stdout.includes('PHYSICAL THIS MILESTONE NOT TESTED'));
    }
    equal(fs.readFileSync(outputA, 'utf8'), fs.readFileSync(outputB, 'utf8'), 'CLI output is reproducible');
  }
  process.stdout.write(`Cyberpunk Languages Qualification 1.0 PASS (${assertions} assertions); EN 229, FR not activated; physical tests NOT TESTED.\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
