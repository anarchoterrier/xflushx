const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function run(user){let scan;const sent=[],link={href:'https://x.com/example_author',getClientRects:()=>[1],matches:()=>false,__reactProps$test:{user}};
 const c=vm.createContext({URL,location:{origin:'https://x.com',href:'https://x.com/home',pathname:'/home'},window:{postMessage:m=>sent.push(m)},document:{querySelectorAll:s=>s.includes('article a[href]')?[link]:[]},setInterval:fn=>scan=fn});vm.runInContext(fs.readFileSync('extension/identity.js','utf8'),c);scan();return sent;}
for(const user of [{screen_name:'example_author',id_str:'42'},{legacy:{screen_name:'example_author'},rest_id:'42'},{core:{screen_name:'example_author'},rest_id:'42'}]){const sent=run(user);assert.equal(sent.length,1);assert.equal(sent[0].userId,'42');}
assert.equal(run({screen_name:'example_author',id_str:42}).length,0);
assert.equal(run({screen_name:'example_author',id_str:'42',rest_id:'43'}).length,0);
assert.equal(run({screen_name:'someone_else',id_str:'42'}).length,0);
console.log('Alternate author markup, underscore handles, string IDs and conflicting/wrong identity rejection passed.');
