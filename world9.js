import * as THREE from 'three';
import {scene,camera,clamp,WATER_U,bus,AC,NB,noiseHit,hooks,state,goto,walker,$,canvasTex,SHORE} from './app.js';

// =====================================================================
// Game: parasailing — a speedboat tows you up under a big parachute
// =====================================================================
const MR=(a,b)=>a+(b-a)*Math.random();
const lvl=()=>WATER_U.uLevel.value;
function toast(html,ms=4500){const t=$('toast');t.innerHTML=html;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}
const std=(c,r=0.5,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...o});
function waveH(x,z,t){let h=0;for(const [a,b,len,amp,spd] of [[0.12,1,34,0.22,7.3],[-0.35,1,19,0.11,5.4],[0.7,0.7,11,0.05,4.1],[-0.8,0.5,7,0.03,3.3]]){const l=Math.hypot(a,b),k=6.2831853/len;h+=amp*Math.sin(k*((a*x+b*z)/l-spd*t));}return h;}

// ---------- loop over the bay (checked: always > 9 m deep, 59 m from the island) ----------
const CX=-10,CZ=-175,RX=105,RZ=62;
const loopP=a=>new THREE.Vector3(CX+Math.cos(a)*RX,0,CZ+Math.sin(a)*RZ);
const loopT=a=>new THREE.Vector3(-Math.sin(a)*RX,0,Math.cos(a)*RZ).normalize();

// ---------- speedboat ----------
const boat=new THREE.Group();
{
  const hg=new THREE.SphereGeometry(1,36,16,0,Math.PI*2,Math.PI/2,Math.PI/2),p=hg.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const pinch=z>0?1-0.75*Math.pow(z,2.2):1-0.12*Math.pow(-z,3);p.setXYZ(i,x*pinch,y,z);}hg.computeVertexNormals();
  const stripes=canvasTex(512,64,(g,w,h)=>{g.fillStyle='#fbfbf8';g.fillRect(0,0,w,h);g.fillStyle='#d62828';g.fillRect(0,h*0.15,w,h*0.18);g.fillStyle='#1d3557';g.fillRect(0,h*0.38,w,h*0.07);});
  const hull=new THREE.Mesh(hg,new THREE.MeshStandardMaterial({map:stripes,roughness:0.25,side:THREE.DoubleSide}));hull.scale.set(1.25,0.9,3.6);hull.position.y=0.65;boat.add(hull);
  const deck=new THREE.Mesh(new THREE.CircleGeometry(1,36),std('#d9cdb8',0.7));deck.rotation.x=-Math.PI/2;deck.scale.set(1.2,3.5,1);deck.position.y=0.62;boat.add(deck);
  const ws=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.6,0.06),new THREE.MeshStandardMaterial({color:'#9ad1f0',transparent:true,opacity:0.45,roughness:0.05}));ws.position.set(0,1.05,0.9);ws.rotation.x=-0.5;boat.add(ws);
  const console1=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.7,0.6),std('#f1f1ee',0.4));console1.position.set(0.4,0.95,0.3);boat.add(console1);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.35,0.6),std('#1d3557',0.6));seat.position.set(0,0.8,-0.9);boat.add(seat);
  const platform=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.08,1.2),std('#c9a06a',0.6));platform.position.set(0,0.75,-3.2);boat.add(platform);
  const winch=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.6,16),std('#888',0.3,{metalness:0.6}));winch.rotation.z=Math.PI/2;winch.position.set(0,1.0,-2.4);boat.add(winch);
  for(const x of [-0.45,0.45]){const m=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.55,0.4),std('#222',0.35));m.position.set(x,0.7,-3.75);boat.add(m);}
  boat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
}
scene.add(boat);
// wake
const WK=160,wkPos=new Float32Array(WK*3).fill(-999),wkAge=new Float32Array(WK).fill(9);let wkI=0;
const wkGeo=new THREE.BufferGeometry();wkGeo.setAttribute('position',new THREE.BufferAttribute(wkPos,3));
const wake=new THREE.Points(wkGeo,new THREE.PointsMaterial({color:0xffffff,size:0.7,transparent:true,opacity:0.75,depthWrite:false}));wake.frustumCulled=false;scene.add(wake);

// ---------- parachute ----------
const chute=new THREE.Group();
const gores=canvasTex(512,64,(g,w,h)=>{const cs=['#e63946','#ffd166','#06d6a0','#118ab2','#ffffff','#f77f00'];for(let i=0;i<24;i++){g.fillStyle=cs[i%cs.length];g.fillRect(i*w/24,0,w/24+1,h);}});
const canopyG=new THREE.SphereGeometry(4.2,48,16,0,Math.PI*2,0,Math.PI*0.42);
const canopy=new THREE.Mesh(canopyG,new THREE.MeshStandardMaterial({map:gores,side:THREE.DoubleSide,roughness:0.65}));canopy.scale.set(1.25,0.75,1);canopy.castShadow=true;chute.add(canopy);
const rim=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;rim.push(new THREE.Vector3(Math.cos(a)*4.2*Math.sin(Math.PI*0.42)*1.25,4.2*Math.cos(Math.PI*0.42)*0.75,Math.sin(a)*4.2*Math.sin(Math.PI*0.42)));}
const lineGeo=new THREE.BufferGeometry();const lp=new Float32Array(16*2*3);lineGeo.setAttribute('position',new THREE.BufferAttribute(lp,3));
const lines=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:'#f4f1ea',transparent:true,opacity:0.8}));lines.frustumCulled=false;scene.add(lines);
const ropeGeo=new THREE.BufferGeometry();ropeGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
const rope=new THREE.Line(ropeGeo,new THREE.LineBasicMaterial({color:'#f2c14e'}));rope.frustumCulled=false;scene.add(rope);
scene.add(chute);
// harness + your legs (visible when you look down)
const harness=new THREE.Group();
{const seatM=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.08,0.4),std('#1d3557',0.7));seatM.position.y=-0.55;harness.add(seatM);
  const skin=std('#e0ac83',0.6);for(const x of [-0.12,0.12]){const th=new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.35,6,10),skin);th.rotation.x=Math.PI/2.4;th.position.set(x,-0.6,0.22);harness.add(th);
    const sh=new THREE.Mesh(new THREE.CapsuleGeometry(0.055,0.35,6,10),skin);sh.position.set(x,-0.9,0.42);harness.add(sh);}
  for(const x of [-0.25,0.25]){const strap=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.6,6),std('#e63946'));strap.position.set(x,0.25,0);harness.add(strap);}}
scene.add(harness);

// ---------- sounds ----------
let snd=null;
function mkSnd(){const w=AC.createBufferSource();w.buffer=NB.pink;w.loop=true;w.start();const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=600;bp.Q.value=0.4;const gw=AC.createGain();gw.gain.value=0;w.connect(bp).connect(gw).connect(bus.nature);
  const f=AC.createBufferSource();f.buffer=NB.brown;f.loop=true;f.start();const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=180;const am=AC.createGain();am.gain.value=0;const lfo=AC.createOscillator();lfo.frequency.value=7;const lg=AC.createGain();lg.gain.value=0.5;lfo.connect(lg).connect(am.gain);lfo.start();f.connect(lp).connect(am);const gf=AC.createGain();gf.gain.value=0;am.connect(gf).connect(bus.nature);
  const o=AC.createOscillator(),o2=AC.createOscillator(),elp=AC.createBiquadFilter(),ge=AC.createGain();o.type='sawtooth';o.frequency.value=70;o2.type='square';o2.frequency.value=35;elp.type='lowpass';elp.frequency.value=380;ge.gain.value=0;o.connect(elp);o2.connect(elp);elp.connect(ge).connect(bus.nature);o.start();o2.start();
  return {gw,bp,gf,ge,am};}

// ---------- the flight ----------
const F={st:'off',t:0,a:Math.PI*0.5,L:4,wy:0,wp:0,flights:0};
const TAKE=18,CRUISE=70,LAND=18,LMAX=78;
function start(){if(F.st!=='off'){stop();return;}const p=loopP(F.a);goto(p.x,p.z+3,0);F.st='fly';F.t=0;F.L=4;F.wy=walker.yaw;F.wp=walker.pitch;setBtn(true);
  toast('🪂 Harnais bouclé ! Le bateau accélère… la voile se gonfle et tu décolles.<br><small>Glisse pour regarder autour de toi</small>',6000);}
function stop(){if(F.st==='off')return;F.st='off';setBtn(false);const x=-6,z=SHORE(-6)+14;goto(x,z,0);toast('🏖️ Retour sur le sable… Quel vol !');}
addEventListener('keydown',e=>{if(e.code==='KeyJ'&&state.started&&!e.repeat)start();});
const grid=document.querySelector('#act .grid');let btn=null;
if(grid){btn=document.createElement('button');btn.innerHTML='<span class="em">🪂</span><span>Parachute tracté</span><kbd>J</kbd>';btn.onclick=()=>{$('act').hidden=true;$('actBtn').classList.remove('on');start();};grid.appendChild(btn);}
function setBtn(on){if(btn)btn.classList.toggle('on',on);}
const NOTES=[[6,'🪂 Tu montes… les gens deviennent tout petits sur la plage.'],[28,'🌊 Regarde l\'eau turquoise : on voit le fond et la forme du lagon autour de l\'île.'],[55,'🗼 Le phare et le village blanc, vus du ciel…'],[82,'😌 Respire… tu voles au-dessus de la mer.'],[TAKE+CRUISE+2,'⬇️ Le treuil te ramène doucement vers le bateau.']];
const said=new Set();

let T=0;const _v=new THREE.Vector3(),stern=new THREE.Vector3(),hp=new THREE.Vector3(),cp=new THREE.Vector3();
hooks.push((dt,time)=>{
  T=time;const L0=lvl();
  const active=F.st==='fly';
  // the boat cruises around the loop all the time (slower when idle)
  const spd=active?9:4;F.a+=spd*dt/Math.hypot(RX*Math.sin(F.a),RZ*Math.cos(F.a));
  const bp=loopP(F.a),tg=loopT(F.a),yaw=Math.atan2(tg.x,tg.z);
  boat.position.set(bp.x,L0+waveH(bp.x,bp.z,T)*0.6-0.2,bp.z);boat.rotation.set(-0.06+Math.sin(T*1.7)*0.02,yaw,Math.sin(T*1.3)*0.03,'YXZ');
  const i=(wkI++)%WK;stern.set(0,0,-3.8).applyEuler(boat.rotation).add(boat.position);wkPos[i*3]=stern.x+MR(-0.6,0.6);wkPos[i*3+1]=L0+0.06;wkPos[i*3+2]=stern.z+MR(-0.6,0.6);wkAge[i]=0;
  for(let k=0;k<WK;k++){wkAge[k]+=dt;if(wkAge[k]>6)wkPos[k*3+1]=-999;}wkGeo.attributes.position.needsUpdate=true;
  // rope length: take-off, cruise, reel-in
  if(active){F.t+=dt;const t=F.t;F.L=t<TAKE?4+(LMAX-4)*smoothstep(t/TAKE):t<TAKE+CRUISE?LMAX:LMAX-(LMAX-4)*smoothstep((t-TAKE-CRUISE)/LAND);
    for(const [k,m] of NOTES)if(t>=k&&!said.has(k)){said.add(k);toast(m,5500);}
    if(t>TAKE+CRUISE+LAND){said.clear();F.flights++;stop();}}
  else F.L=Math.max(4,F.L-dt*10);
  // harness position behind and above the boat, with gentle sway
  const ang=THREE.MathUtils.degToRad(12+28*clamp((F.L-4)/30,0,1)),back=new THREE.Vector3(-tg.x,0,-tg.z),side=new THREE.Vector3(tg.z,0,-tg.x);
  const winch=new THREE.Vector3(0,1.0,-2.4).applyEuler(boat.rotation).add(boat.position);
  hp.copy(winch).addScaledVector(back,F.L*Math.cos(ang)).addScaledVector(side,Math.sin(T*0.35)*F.L*0.06);hp.y+=F.L*Math.sin(ang)+(F.L<6?0.6:0);
  harness.position.copy(hp);harness.rotation.set(0,yaw+Math.sin(T*0.4)*0.08,Math.sin(T*0.5)*0.06,'YXZ');
  cp.copy(hp);cp.y+=6.2;cp.addScaledVector(tg,1.2);chute.position.copy(cp);chute.rotation.set(-0.35,yaw,Math.sin(T*0.45)*0.08,'YXZ');
  const inflate=clamp((F.L-3)/8,0.25,1);canopy.scale.set(1.25*inflate,0.75,1*inflate);
  const vis=active||F.L>4.5;chute.visible=harness.visible=lines.visible=rope.visible=vis;
  // lines from canopy rim to the harness
  chute.updateMatrixWorld();
  for(let k=0;k<16;k++){_v.copy(rim[k]);_v.x*=inflate;_v.z*=inflate;_v.applyMatrix4(chute.matrixWorld);lp.set([_v.x,_v.y,_v.z],k*6);lp.set([hp.x,hp.y+0.9,hp.z],k*6+3);}
  lineGeo.attributes.position.needsUpdate=true;chute.updateMatrixWorld();
  const rpp=ropeGeo.attributes.position;rpp.setXYZ(0,winch.x,winch.y,winch.z);rpp.setXYZ(1,hp.x,hp.y+0.1,hp.z);rpp.needsUpdate=true;
  // camera in the harness
  if(active){camera.position.copy(hp);camera.rotation.set(clamp(-0.5+(walker.pitch-F.wp),-1.3,1.0),yaw+(walker.yaw-F.wy),Math.sin(T*0.5)*0.04,'YXZ');}
  // sounds: wind & canopy flutter grow with altitude, engine fades below you
  if(AC&&AC.state==='running'){if(!snd)snd=mkSnd();const t=AC.currentTime,alt=clamp((hp.y-L0)/45,0,1),dist=camera.position.distanceTo(boat.position);
    snd.gw.gain.setTargetAtTime(active?0.12+0.3*alt:0,t,0.3);snd.bp.frequency.setTargetAtTime(400+500*alt,t,0.5);
    snd.gf.gain.setTargetAtTime(active?0.2+0.25*alt:0,t,0.3);
    snd.ge.gain.setTargetAtTime(0.06/(1+(dist/25)**2)*(active?1:0.6),t,0.3);}
});
function smoothstep(x){x=clamp(x,0,1);return x*x*(3-2*x);}
