import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {nyDate} from '../public/stocks-logic.js';
test('New York dates preserve DST transitions and year boundaries',()=>{
 for(const [date,expected]of [['2026-03-08T04:59:00Z','2026-03-07'],['2026-03-08T07:00:00Z','2026-03-08'],['2026-11-01T05:59:00Z','2026-11-01'],['2026-11-01T07:00:00Z','2026-11-01'],['2027-01-01T01:00:00Z','2026-12-31']])assert.equal(nyDate(Date.parse(date)/1000),expected);
});
test('Repeated historical timestamps do not recreate timezone formatters',async()=>{
 const source=await fs.readFile(new URL('../public/stocks-logic.js',import.meta.url),'utf8');
 const Original=Intl.DateTimeFormat;let constructors=0,formats=0;
 Intl.DateTimeFormat=function(...args){constructors++;const formatter=new Original(...args);return {format(date){formats++;return formatter.format(date);}};};
 try{
  const isolated=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(let i=0;i<50000;i++)isolated.nyDate(1794618000+i%2*86400);
  assert.equal(constructors,1);assert.equal(formats,2);
 }finally{Intl.DateTimeFormat=Original;}
});
