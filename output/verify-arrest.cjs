const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const element = () => ({getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}}},style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},querySelector(){return element()},getBoundingClientRect(){return {width:900,height:600}},blur(){},clientWidth:900,clientHeight:600});
const nodes=new Map();
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},querySelectorAll(){return []},querySelector(){return element()},body:element(),addEventListener(){}};
class World { constructor(){this.renderer={};} resize(){} reset(){} burst(){} buildingHit(){return false} addRing(d){return d} addBird(d){return d} addDrone(d){return d} remove(){} }
const ctx={document,FlightWorld:World,localStorage:{getItem(){return null},setItem(){}},performance:{now:()=>1000},requestAnimationFrame(){},ResizeObserver:class{observe(){}},setTimeout(){},clearTimeout(){},navigator:{},console,innerWidth:1200,innerHeight:900,addEventListener(){},matchMedia(){return {matches:false}}};
ctx.window=ctx;
let source=fs.readFileSync('game.js','utf8').replace('  let world,','  window.qa={s,keys,update,start,damage,startChase,useSkill,trackFlap,get objects(){return objects;},get world(){return world;}};\n  let world,');
vm.runInNewContext(source,ctx);
const q=ctx.qa;
q.start();q.s.altitude=1000;q.s.vy=0;
for(let i=0;i<100;i++)q.update(.01);
assert.ok(Math.abs(q.s.vy+58.86)<1e-8);
assert.ok(Math.abs(q.s.altitude-970.57)<1e-8);
for(const mode of ['free','challenge']) {
 q.start();q.s.flight=mode;q.s.altitude=500;q.s.invincible=0;q.s.spawnProtection=0;
 q.damage();assert.equal(q.s.hp,2);q.damage();assert.equal(q.s.hp,2);
 q.s.invincible=0;q.damage();assert.equal(q.s.hp,1);
 q.s.invincible=0;q.damage();assert.equal(q.s.hp,0);assert.ok(q.s.chase);
 for(let i=0;i<70;i++)q.update(.04);
 assert.equal(q.s.mode,'ended');assert.equal(q.s.hp,0);
}
q.start();q.s.altitude=4;q.s.invincible=0;q.damage();assert.equal(q.s.hp,3);
for(let i=0;i<250;i++)q.update(.04);
assert.equal(q.s.chase,null);assert.equal(q.s.groundTime,0);
for(let i=0;i<70;i++)q.update(.04);assert.equal(q.s.chase,null);
for(let i=0;i<7;i++)q.update(.04);
assert.equal(q.s.chase.reason,'ground');
q.keys.add('Space');for(let i=0;i<35;i++)q.update(.04);
assert.ok(q.s.altitude>=25);assert.equal(q.s.chase,null);assert.equal(q.s.mode,'running');assert.equal(q.s.hp,3);
q.start();q.s.spawnProtection=0;q.s.altitude=4;
for(let i=0;i<180;i++)q.update(.04);assert.equal(q.s.mode,'ended');
q.start();q.s.spawnProtection=0;q.s.altitude=30;q.world.buildingHit=()=>true;q.update(.02);
assert.equal(q.s.chase.reason,'building');
for(let i=0;i<70;i++)q.update(.04);assert.equal(q.s.mode,'ended');
q.start();assert.equal(q.s.hp,3);assert.equal(q.s.chase,null);assert.equal(q.s.mode,'running');
console.log('PASS: gravity, damage, 10s protection, 3s warning, flapping escape, caught without escape, building arrest, restart');
q.world.buildingHit=()=>false;
q.start();q.s.spawnProtection=0;q.s.altitude=500;
q.objects.push({type:'ring',x:0,y:500,d:q.s.distance+.5});q.update(.02);
assert.equal(q.s.score,100);
q.objects.push({type:'bird',x:0,y:q.s.altitude,d:q.s.distance+.5});q.update(.02);
assert.equal(q.s.score,50);assert.equal(q.s.hp,3);assert.equal(q.s.mode,'running');
q.update(.02);assert.equal(q.s.score,50);
q.s.score=0;q.objects.push({type:'bird',x:0,y:q.s.altitude,d:q.s.distance+.5});q.update(.02);
assert.equal(q.s.score,-50);
q.s.spawnProtection=1;q.objects.push({type:'bird',x:0,y:q.s.altitude,d:q.s.distance+.5});q.update(.02);
assert.equal(q.s.score,-50);
console.log('PASS: ring +100, bird -50 once/no HP loss, negative score, protected bird contact');
let clock=10000;ctx.performance.now=()=>clock;
function simulateFlaps(period) {
 q.start();q.s.camera=true;q.s.altitude=1000;q.s.peak=1000;q.trackFlap(null,clock);
 const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));lm[11].x=.3;lm[12].x=.7;
 for(let i=0;i<600;i++) {
  clock+=10;
  const h=period===null ? (i<8?-.8:.8) : -.8*Math.cos(i*.01/period*Math.PI*2);
  lm[15].y=lm[16].y=.5+h*.4;
  if(i%3===0)q.trackFlap(lm,clock);
  q.update(.01);
 }
 return {rise:q.s.peak-1000,final:q.s.altitude-1000};
}
const single=simulateFlaps(null),slow=simulateFlaps(.9),fast=simulateFlaps(.30);
assert.ok(single.rise<5,JSON.stringify(single));
assert.ok(slow.final<0,JSON.stringify(slow));
assert.ok(fast.final>20,JSON.stringify(fast));
console.log('PASS: single/slow/rapid flap comparison',JSON.stringify({single,slow,fast}));
