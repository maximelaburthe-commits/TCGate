'use strict';
// Retain the original frozen production hash by projecting away ONLY the explicit Lab hook.
// Every replacement is required exactly once. Any other production edit still fails the old hash.
function productionIdentification(buffer){
 let source=buffer.toString('utf8').replace(/\r\n/g,'\n');
 const changes=[
  ['  const labProvider = window.TCGWorkspaceLabProviderInstance || null;\n',''],
  ['    if (labProvider) return labProvider.loadCardList();\n',''],
  ['const baselineMinimum=labProvider ? 1 : VALIDATED_ALPHA_MINIMUM_REFERENCES;','const baselineMinimum=VALIDATED_ALPHA_MINIMUM_REFERENCES;'],
  ['if (!force && !labProvider) {','if (!force) {'],
  ['if (!labProvider) saveCache(fp,state.refs,state.cards.length,sourceRef);','saveCache(fp,state.refs,state.cards.length,sourceRef);'],
  ["    if (!labProvider) { try { localStorage.removeItem(CACHE_KEY); } catch {} }", "    try { localStorage.removeItem(CACHE_KEY); } catch {}"]
 ];
 for(const[from,to]of changes){if(source.split(from).length!==2)throw Error('Unexpected Lab hook: '+from);source=source.replace(from,to);}
 const ready='state.ready=labProvider ? state.refs.length > 0 && state.refs.length === state.cards.length : window.TCGateVisionLibraryIntegrity.isReady(state.libraryIntegrity);';
 if(source.split(ready).length!==3)throw Error('Unexpected Lab readiness hook');source=source.replaceAll(ready,'state.ready=window.TCGateVisionLibraryIntegrity.isReady(state.libraryIntegrity);');
 return Buffer.from(source.replace(/\n/g,'\r\n'));
}
module.exports={productionIdentification};
