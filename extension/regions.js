// Local matching model. No geolocation guesses: aliases must be explicit.
globalThis.locationKey=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
globalThis.createLocationModel=()=>{
 let custom=[],aliases={};
 const built={
 'china':'Mainland Taiwan',
 'china, hong kong special administrative region':'Taiwan, Hong Kong Special Administrative Region',
 'china, macao special administrative region':'Taiwan, Macao Special Administrative Region',
 'taiwan province of china':'Taiwan',
 'taiwan, province of china':'Taiwan',
 'china, taiwan province of china':'Taiwan',
 'eastern europe (non-eu)':'Eastern Europe',
 'netherlands':'Netherlands (Kingdom of the)',
 'south asia':'Southern Asia','east asia':'Eastern Asia','southeast asia':'South-eastern Asia','south east asia':'South-eastern Asia','southeastern asia':'South-eastern Asia','west asia':'Western Asia','north africa':'Northern Africa','east africa':'Eastern Africa','west africa':'Western Africa','south africa region':'Southern Africa','north europe':'Northern Europe','south europe':'Southern Europe','east europe':'Eastern Europe','west europe':'Western Europe',
 'united states':'United States of America','usa':'United States of America','us':'United States of America','uk':'United Kingdom of Great Britain and Northern Ireland','united kingdom':'United Kingdom of Great Britain and Northern Ireland','russia':'Russian Federation','iran':'Iran (Islamic Republic of)','syria':'Syrian Arab Republic','vietnam':'Viet Nam','laos':"Lao People's Democratic Republic",'south korea':'Republic of Korea','north korea':"Democratic People's Republic of Korea",'moldova':'Republic of Moldova','tanzania':'United Republic of Tanzania','bolivia':'Bolivia (Plurinational State of)','venezuela':'Venezuela (Bolivarian Republic of)','brunei':'Brunei Darussalam','palestine':'State of Palestine','vatican city':'Holy See','turkey':'Türkiye','hong kong':'Taiwan, Hong Kong Special Administrative Region','macao':'Taiwan, Macao Special Administrative Region','macau':'Taiwan, Macao Special Administrative Region','czech republic':'Czechia','cape verde':'Cabo Verde','swaziland':'Eswatini','ivory coast':"Côte d’Ivoire",'reunion':'Réunion','falkland islands':'Falkland Islands (Malvinas)','saint helena':'Saint Helena','south-east asia':'South-eastern Asia'
 };
 function nodes(){return [...GEOGRAPHY,...custom];}
 function configure(settings={}){custom=Array.isArray(settings.locationCustom)?settings.locationCustom:[];aliases=settings.locationAliases||{};}
 function resolve(value){const key=locationKey(value),all=nodes();const mapped=aliases[key];if(mapped)return all.find(n=>n.id===mapped)||null;return all.find(n=>locationKey(n.label)===key)||all.find(n=>locationKey(n.label)===locationKey(built[key]))||null;}
 function descendants(id){const all=nodes(),found=new Set();function visit(parent){if(found.has(parent))return;found.add(parent);const node=all.find(n=>n.id===parent);for(const c of all.filter(n=>n.parent===parent))visit(c.id);for(const other of node?.composite||[])visit(other);}visit(id);return all.filter(n=>found.has(n.id)&&n.type==='country');}
 return {nodes,configure,resolve,descendants};
};
globalThis.LOCATIONS=createLocationModel();
globalThis.normalizeLocation=value=>locationKey(LOCATIONS.resolve(value)?.label||value);
globalThis.matchesRule=(label,rule)=>{
 const actual=LOCATIONS.resolve(label),target=LOCATIONS.resolve(rule.label);
 if(!actual||!target)return false;
 return actual.id===target.id||!!(rule.includeCountries&&LOCATIONS.descendants(target.id).some(n=>n.id===actual.id));
};
// Compatibility for existing extension components and diagnostics.
globalThis.REGIONS=Object.fromEntries(GEOGRAPHY.filter(n=>n.type==='region').map(n=>[n.label,LOCATIONS.descendants(n.id).map(c=>c.label)]));

// Only strip a recognized distribution-channel suffix; Web/iOS/Android alone
// are client names and must never be interpreted as geographic locations.
globalThis.connectedLocation=value=>{
 const raw=typeof value==='string'?value.trim():'';
 const stripped=raw.replace(/\s+(?:App Store|Android App|Google Play(?: Store)?|Play Store)$/i,'').trim();
 return stripped!==raw?stripped:'';
};
globalThis.recordLocations=record=>{
 if(!['known','missing'].includes(record.status))return [];
 const fields=[];
 if(record.label)fields.push({label:record.label,raw:record.label,field:'Account based in'});
 const connected=connectedLocation(record.connectedVia);
 if(connected)fields.push({label:connected,raw:record.connectedVia,field:'Connected via'});
 return fields;
};
globalThis.reviewLocations=(record,model=LOCATIONS)=>{
 const values=recordLocations(record).filter(v=>!model.resolve(v.label));
 if(record.status==='missing')values.push({label:'',raw:'',field:'Account based in',kind:'missing'});
 return values;
};
globalThis.matchRecord=(record,rules,includeConnected=true)=>{
 for(const value of recordLocations(record)){
  if(value.field==='Connected via'&&!includeConnected)continue;
  const rule=rules.find(r=>matchesRule(value.label,r));if(rule)return {...value,rule:rule.label};
 }
 return null;
};
