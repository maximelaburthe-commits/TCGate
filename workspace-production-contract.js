'use strict';
// Jalon 4 changes corpus adapters and worker lifecycle. Freeze every other named
// function and every recognition constant against the pre-Jalon-4 fingerprints.
// Detector/model/identification-worker keep their separate complete byte hashes.
// The qualification tap is the sole 6B exception. It is observational, is
// accepted only at its exact site, and is removed before the existing 79 named
// functions and constants are fingerprinted. Changed taps are never stripped.
const qualificationDiagnosticsTap = '\n    // Qualification-only scalar diagnostics; absent outside the Workspace workflow.\n' +
  '    window.TCGVisionQualificationDiagnostics?.observeAttempt({\n' +
  '      result,temporal,temporalEntry:state.identityStability.tracks.get(track.uid),\n' +
  '      visibleIdentityBeforeRender:state.visibleIdentity,references:state.refs,\n' +
  '      track,requestStartedAtMs:cropStarted,activeTrackCount:lab.activeTracks().length,\n' +
  '      thresholds:{normalScore:NORMAL_ACCEPT,normalMargin:NORMAL_MARGIN,lowScore:LOW_ACCEPT,lowMargin:LOW_MARGIN}\n' +
  '    });\n';
function stripQualificationDiagnostics(buffer) {
  const source = buffer.toString('utf8').replace(/\r\n/g, '\n');
  const index = source.indexOf(qualificationDiagnosticsTap);
  if (index < 0) return Buffer.from(source);
  if (source.indexOf(qualificationDiagnosticsTap, index + qualificationDiagnosticsTap.length) >= 0) throw Error('Duplicate qualification diagnostics tap');
  if (!source.slice(0, index).endsWith('    const temporal=temporalIdentityGuard(track,result);\n') ||
      !source.slice(index + qualificationDiagnosticsTap.length).startsWith("\n    if(temporal.action==='hold') {")) throw Error('Qualification diagnostics tap moved from its protected site');
  return Buffer.from(source.slice(0, index) + source.slice(index + qualificationDiagnosticsTap.length));
}
function algorithmSections(buffer, lifecycle, expectedFunctions) {
  const source = buffer.toString('utf8').replace(/\r\n/g, '\n');
  const functions = [];
  for (const match of source.matchAll(/^  (?:async )?function (\w+)\([^\n]*\)\s*\{/gm)) {
    const firstEnd = source.indexOf('\n', match.index);
    const firstLine = source.slice(match.index, firstEnd);
    let end = firstEnd;
    if (!firstLine.trimEnd().endsWith('}')) {
      const closing = /^  }[;]?$/gm;
      closing.lastIndex = firstEnd;
      const last = closing.exec(source);
      if (!last) throw Error('Unterminated Vision function: ' + match[1]);
      end = last.index + last[0].length;
    }
    if (!lifecycle.includes(match[1])) functions.push([match[1], source.slice(match.index, end).trim()]);
  }
  if (functions.length !== expectedFunctions || new Set(functions.map(([name]) => name)).size !== expectedFunctions) throw Error('Protected Vision function set changed');
  const adapterConstants = new Set(['FALLBACK_DB', 'STABLE_SOURCE_BASE', 'STABLE_SOURCE_MANIFEST', 'VALIDATED_ALPHA_MINIMUM_REFERENCES', 'CACHE_KEY']);
  const constants = [...source.matchAll(/^  const ([A-Z][A-Z_0-9]*)\s*=[\s\S]*?;/gm)]
    .filter(match => !adapterConstants.has(match[1])).map(match => [match[1], match[0].trim()]);
  return Buffer.from(JSON.stringify({ functions: functions.sort(([a], [b]) => a.localeCompare(b)), constants: constants.sort(([a], [b]) => a.localeCompare(b)) }));
}
function productionIdentification(buffer) {
  return algorithmSections(stripQualificationDiagnostics(buffer), ['fingerprint', 'loadCache', 'saveCache', 'loadFallbackSnapshotCardList', 'loadCardList', 'buildLibrary', 'matcherWorkerPayload', 'initMatcherWorker', 'startProductIdentification', 'setContext'], 79);
}
function productionTableState(buffer) {
  return algorithmSections(buffer, ['initWorker', 'start', 'stop'], 47);
}
module.exports = { productionIdentification, productionTableState, stripQualificationDiagnostics };
