'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=__dirname;
const files=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.js')).map(e=>e.name);
function publicScripts(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())publicScripts(file);else if(e.isFile()&&file.endsWith('.js'))files.push(file);}}
publicScripts('public');
let failed=0;for(const file of files){const r=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});if(r.status!==0){failed++;process.stderr.write(file+'\n'+(r.stdout||'')+(r.stderr||''));}}
if(failed){console.error('CHECK_FAILED '+failed+'/'+files.length);process.exitCode=1;}else console.log('CHECK_OK '+files.length+' JavaScript files');
