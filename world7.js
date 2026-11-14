import * as THREE from 'three';
import {scene,camera,H,SHORE,clamp,WATER_U,bus,AC,NB,noiseHit,hooks,state,goto,walker,$,canvasTex,env} from './app.js';

// =====================================================================
// Activity: boat ride around the island and past the lighthouse
// =====================================================================
const MR=(a,b)=>a+(b-a)*Math.random();
const lvl=()=>WATER_U.uLevel.value;
function toast(html,ms=4200){const t=$('toast');t.innerHTML=html;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}
function waveH(x,z,t){let h=0;for(const [a,b,len,amp,spd] of [[0.12,1,34,0.22,7.3],[-0.35,1,19,0.11,5.4],[0.7,0.7,11,0.05,4.1],[-0.8,0.5,7,0.03,3.3]]){const l=Math.hypot(a,b),k=6.2831853/len;h+=amp*Math.sin(k*((a*x+b*z)/l-spd*t));}return h;}

// ---------- the boat: a small wooden Mediterranean "pointu" ----------
const planks=canvasTex(512,128,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i===5?'#2e6fa8':i===6?'#f2c14e':'#f4efe4';g.fillRect(0,i*h/8,w,h/8);g.fillStyle='rgba(0,0,0,0.12)';g.fillRect(0,i*h/8,w,1.5);}for(let k=0;k<40;k++){g.fillStyle='rgba(120,90,60,0.06)';g.fillRect(Math.random()*w,Math.random()*h,60,2);}});
const deckT=canvasTex(256,256,(g,w,h)=>{for(let i=0;i<12;i++){g.fillStyle=i%2?'#a9744a':'#b5804f';g.fillRect(i*w/12,0,w/12,h);g.fillStyle='rgba(0,0,0,0.25)';g.fillRect(i*w/12,0,1.5,h);}});
const boat=new THREE.Group();
{
  // hull: lower half of a stretched sphere, pointed at both ends
  const hg=new THREE.SphereGeometry(1,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2);const p=hg.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const pinch=1-0.55*Math.pow(Math.abs(z),3);p.setXYZ(i,x*pinch,y,z);}hg.computeVertexNormals();
  const hull=new THREE.Mesh(hg,new THREE.MeshStandardMaterial({map:planks,roughness:0.6,side:THREE.DoubleSide}));hull.scale.set(1.15,0.75,3.1);hull.position.y=0.55;boat.add(hull);
  const deck=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshStandardMaterial({map:deckT,roughness:0.8}));deck.rotation.x=-Math.PI/2;deck.scale.set(1.1,3.0,1);deck.position.y=0.5;boat.add(deck);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(1,0.045,8,64),new THREE.MeshStandardMaterial({color:'#8b5a33',roughness:0.6}));rail.rotation.x=Math.PI/2;rail.scale.set(1.15,3.1,1);rail.position.y=0.56;boat.add(rail);
  for(const [z,w] of [[-0.8,1.9],[0.9,1.8]]){const s=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,0.42),new THREE.MeshStandardMaterial({color:'#9b6a40',roughness:0.7}));s.position.set(0,0.82,z);boat.add(s);}
  const prow=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.9,8),new THREE.MeshStandardMaterial({color:'#8b5a33'}));prow.position.set(0,0.9,3.05);prow.rotation.x=0.5;boat.add(prow);
  const motor=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.5,0.4),new THREE.MeshStandardMaterial({color:'#2b2f33',roughness:0.4}));motor.position.set(0,0.75,-3.0);boat.add(motor);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.8,8),new THREE.MeshStandardMaterial({color:'#555'}));shaft.position.set(0,0.25,-3.05);boat.add(shaft);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.08,10,24),new THREE.MeshStandardMaterial({color:'#e2574c'}));ring.position.set(0.7,0.95,-1.6);ring.rotation.y=Math.PI/2;boat.add(ring);
  boat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
}
scene.add(boat);

// ---------- scenic route (verified to stay over water) ----------
const IX=-55,IZ=-292;
const P=(x,t)=>new THREE.Vector3(x,0,SHORE(x)-t);
const pts=[P(4,14),new THREE.Vector3(-8,0,-70),new THREE.Vector3(-30,0,-215),new THREE.Vector3(IX+42,0,IZ+10),new THREE.Vector3(IX+18,0,IZ-42),new THREE.Vector3(IX-30,0,IZ-36),new THREE.Vector3(IX-48,0,IZ+6),
  new THREE.Vector3(-150,0,-262),new THREE.Vector3(-205,0,-262),new THREE.Vector3(-160,0,-205),new THREE.Vector3(-90,0,-140),new THREE.Vector3(-40,0,-60),P(4,14)];
const route=new THREE.CatmullRomCurve3(pts,true,'centripetal',0.5);
const LEN=route.getLength();
const DOCK=route.getPointAt(0);
const ride={on:false,s:0,speed:0,wy:0,wp:0,notes:new Set()};
const NOTES=[[0.05,'⛵ On largue les amarres… Installe-toi et profite de la vue.'],[0.22,'🏝️ Cap sur l\'île aux palmiers. Regarde l\'eau turquoise du lagon !'],[0.45,'🐬 Ouvre l\'œil, les dauphins aiment nager par ici.'],[0.62,'🗼 Voici le vieux phare et le village blanc sur la colline.'],[0.85,'🏖️ Retour vers la plage… Quelle belle balade !']];

// ---------- sounds: outboard motor, hull hiss, wave slaps ----------
let snd=null,slapT=0.5;
function mkSnd(){const o=AC.createOscillator(),o2=AC.createOscillator(),lp=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o.frequency.value=52;o2.type='square';o2.frequency.value=26;lp.type='lowpass';lp.frequency.value=320;g.gain.value=0;o.connect(lp);o2.connect(lp);lp.connect(g).connect(bus.nature);o.start();o2.start();
  const s=AC.createBufferSource();s.buffer=NB.white;s.loop=true;s.start();const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1600;bp.Q.value=0.6;const g2=AC.createGain();g2.gain.value=0;s.connect(bp).connect(g2).connect(bus.nature);
  return {g,g2,o};}

function start(){if(ride.on){stop();return;}
  goto(DOCK.x,DOCK.z+6,0);ride.on=true;ride.s=0;ride.speed=0;ride.notes.clear();ride.wy=walker.yaw;ride.wp=walker.pitch;setBtn(true);
  toast('⛵ Tu montes à bord… <small>Glisse pour regarder autour de toi · le bouton ou une touche de déplacement pour descendre</small>',6000);}
function stop(){if(!ride.on)return;ride.on=false;setBtn(false);const p=boat.position;goto(DOCK.x+2,DOCK.z+16,0);toast('🏖️ Te voilà de retour sur la plage.');}
addEventListener('keydown',e=>{if(ride.on&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))stop();if(e.code==='KeyN'&&state.started&&!e.repeat)start();});

// activity button
const grid=document.querySelector('#act .grid');let btn=null;
if(grid){btn=document.createElement('button');btn.innerHTML='<span class="em">⛵</span><span>Balade en bateau</span><kbd>N</kbd>';btn.onclick=()=>{$('act').hidden=true;$('actBtn').classList.remove('on');start();};grid.appendChild(btn);}
function setBtn(on){if(btn)btn.classList.toggle('on',on);}

// ---------- per frame ----------
let T=0;const tan=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler(0,0,0,'YXZ');
hooks.push((dt,time)=>{
  T=time;const L=lvl();
  if(ride.on){ride.speed+=(Math.min(6.5,1+ride.s*80)-ride.speed)*Math.min(1,dt*0.5);ride.s+=ride.speed*dt/LEN;
    for(const [k,msg] of NOTES)if(ride.s>=k&&!ride.notes.has(k)){ride.notes.add(k);toast(msg,5000);}
    if(ride.s>=1){ride.s=0;stop();}}
  const s=ride.on?ride.s:0;
  const p=route.getPointAt(s%1);route.getTangentAt(s%1,tan);
  const yaw=Math.atan2(tan.x,tan.z);
  const y=L+waveH(p.x,p.z,T)*0.9;
  const pitch=(waveH(p.x+tan.x*2,p.z+tan.z*2,T)-waveH(p.x-tan.x*2,p.z-tan.z*2,T))*-0.12;
  const roll=Math.sin(T*1.1)*0.05+(waveH(p.x+tan.z,p.z-tan.x,T)-waveH(p.x-tan.z,p.z+tan.x,T))*0.15;
  boat.position.set(p.x,y-0.18,p.z);boat.rotation.set(pitch,yaw,roll,'YXZ');
  if(ride.on){
    // passenger seat at the back of the boat, looking ahead; drag to look around
    const seat=new THREE.Vector3(0,1.55,-1.6).applyEuler(boat.rotation).add(boat.position);
    camera.position.copy(seat);
    camera.rotation.set(clamp(pitch*0.6-0.04+(walker.pitch-ride.wp),-0.9,1.0),yaw+Math.PI+(walker.yaw-ride.wy),roll*0.6,'YXZ');
  }
  if(AC&&AC.state==='running'){if(!snd)snd=mkSnd();const t=AC.currentTime,sp=ride.on?ride.speed/6.5:0;
    snd.g.gain.setTargetAtTime(ride.on?0.035+0.03*sp:0,t,0.4);snd.o.frequency.setTargetAtTime(48+14*sp,t,0.5);snd.g2.gain.setTargetAtTime(ride.on?0.04+0.09*sp:0,t,0.3);
    if(ride.on){slapT-=dt;if(slapT<=0){slapT=MR(0.5,1.6);noiseHit(bus.nature,MR(350,700),0.9,0.18+0.12*sp,0.01,0.3,MR(-0.7,0.7));}}}
});
