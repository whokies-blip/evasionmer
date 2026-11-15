import * as THREE from 'three';
import {scene,camera,H,SHORE,clamp,WATER_U,bus,AC,NB,noiseHit,hooks,state,goto,walker,$,canvasTex} from './app.js';

// =====================================================================
// Game: a big water slide that throws you into the sea
// =====================================================================
const MR=(a,b)=>a+(b-a)*Math.random();
const lvl=()=>WATER_U.uLevel.value;
function toast(html,ms=4200){const t=$('toast');t.innerHTML=html;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}
const std=(c,r=0.5,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...o});

// ---------- placement ----------
const TX=38,TZ=SHORE(38)+14,TY=H(TX,TZ),HT=35,TOP=TY+HT,SR=5.2,TURNS=3.5;
// ---------- slide path: 3.5 spiral turns around a 35 m tower, then a long run out over the sea ----------
const pts=[];const A1=Math.PI,A0=A1-TURNS*Math.PI*2,SPN0=Math.round(TURNS*14);
pts.push(new THREE.Vector3(TX+Math.cos(A0-1.0)*1.9,TOP-0.1,TZ+Math.sin(A0-1.0)*1.9),new THREE.Vector3(TX+Math.cos(A0-0.5)*3.5,TOP-0.35,TZ+Math.sin(A0-0.5)*3.5));
for(let i=0;i<=SPN0;i++){const u=i/SPN0,a=A0+u*(A1-A0),r=SR;pts.push(new THREE.Vector3(TX+Math.cos(a)*r,TOP-0.7-u*(HT-6.7),TZ+Math.sin(a)*r));}
const sp=pts[pts.length-1];
pts.push(new THREE.Vector3(sp.x-0.4,sp.y-1.6,sp.z-7),new THREE.Vector3(sp.x-1.2,TY+2.6,TZ-17),new THREE.Vector3(sp.x-2,1.5,TZ-30),new THREE.Vector3(sp.x-2.8,0.9,TZ-42));
const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
const N=900,LEN=curve.getLength();
const frames=[];for(let i=0;i<=N;i++){const s=i/N,p=curve.getPointAt(s),t=curve.getTangentAt(s);const side=new THREE.Vector3().crossVectors(t,new THREE.Vector3(0,1,0)).normalize();const up=new THREE.Vector3().crossVectors(side,t).normalize();frames.push({p,t,side,up});}

// ---------- U-shaped channel geometry ----------
function channel(radius,segA,colorFn,inset=0){const pos=[],col=[],uv=[],idx=[];const c=new THREE.Color();
  for(let i=0;i<=N;i++){const f=frames[i];for(let j=0;j<=segA;j++){const a=Math.PI+j/segA*Math.PI;const x=Math.cos(a)*radius,y=Math.sin(a)*radius*0.85;
      const v=f.p.clone().addScaledVector(f.side,x).addScaledVector(f.up,y+inset);pos.push(v.x,v.y,v.z);colorFn(i,j,c);col.push(c.r,c.g,c.b);uv.push(j/segA,i/N*LEN/3);}}
  for(let i=0;i<N;i++)for(let j=0;j<segA;j++){const a=i*(segA+1)+j,b=a+segA+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
const slide=new THREE.Mesh(channel(0.75,16,(i,j,c)=>c.set(Math.floor(i/14)%2?'#ffd23f':'#2e86de')),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.25,metalness:0.05,side:THREE.DoubleSide}));
slide.castShadow=slide.receiveShadow=true;scene.add(slide);
// thin film of running water
const flowTex=canvasTex(64,256,(g,w,h)=>{g.clearRect(0,0,w,h);for(let k=0;k<70;k++){g.fillStyle=`rgba(255,255,255,${MR(0.15,0.5)})`;g.fillRect(MR(0,w),MR(0,h),MR(1,3),MR(10,40));}});
flowTex.wrapS=flowTex.wrapT=THREE.RepeatWrapping;
const film=new THREE.Mesh(channel(0.55,8,(i,j,c)=>c.set('#9fe0ff'),0.03),new THREE.MeshStandardMaterial({vertexColors:true,map:flowTex,transparent:true,opacity:0.55,roughness:0.05,depthWrite:false}));
film.geometry.attributes.uv.array.forEach((v,k,a)=>{});scene.add(film);
// supports: radial steel arms to the tower along the spiral, then legs down to the sand / sea bed
{const m=std('#e8e3d8',0.45,{metalness:0.4}),up=new THREE.Vector3(0,1,0);
  const strut=(a,b,r)=>{const d=b.clone().sub(a),c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),m);c.position.copy(a).add(b).multiplyScalar(0.5);c.quaternion.setFromUnitVectors(up,d.normalize());c.castShadow=true;scene.add(c);};
  const spEnd=Math.floor(N*(curve.getLengths(400)[Math.min(400,Math.round(400*(SPN0+2)/(pts.length-1)))]/LEN));
  for(let i=8;i<N-40;i+=i<spEnd?18:30){const f=frames[i];const a=f.p.clone().addScaledVector(f.up,-0.62);
    if(i<spEnd){const dir=new THREE.Vector3(TX-a.x,0,TZ-a.z).normalize();strut(a,new THREE.Vector3(TX,a.y-0.6,TZ).addScaledVector(dir,-1.6),0.07);}
    else{const gy=Math.max(H(f.p.x,f.p.z),-6);const h=a.y-gy;if(h<0.5)continue;strut(a,new THREE.Vector3(a.x,gy-0.3,a.z),0.13);}}}
// tower: a white steel lattice with cross-bracing, a spiral staircase, top deck, canopy and flag
{const g=new THREE.Group(),steel=std('#f2f0ea',0.4,{metalness:0.45}),wood=std('#b98e5c',0.7),red=std('#e2574c',0.55),up=new THREE.Vector3(0,1,0);
  const bar=(a,b,r,mat)=>{const d=b.clone().sub(a),c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat);c.position.copy(a).add(b).multiplyScalar(0.5);c.quaternion.setFromUnitVectors(up,d.normalize());g.add(c);};
  const C=[[-1.6,-1.6],[1.6,-1.6],[1.6,1.6],[-1.6,1.6]];
  for(const [x,z] of C)bar(new THREE.Vector3(x,-0.5,z),new THREE.Vector3(x,HT-0.1,z),0.16,steel);
  for(let y=0;y<HT-1;y+=4){const y2=Math.min(HT,y+4);for(let k=0;k<4;k++){const [x1,z1]=C[k],[x2,z2]=C[(k+1)%4];
      bar(new THREE.Vector3(x1,y+0.2,z1),new THREE.Vector3(x2,y2,z2),0.05,steel);bar(new THREE.Vector3(x2,y+0.2,z2),new THREE.Vector3(x1,y2,z1),0.05,steel);
      bar(new THREE.Vector3(x1,y2,z1),new THREE.Vector3(x2,y2,z2),0.07,steel);}}
  // spiral staircase around a central column
  bar(new THREE.Vector3(0,-0.5,0),new THREE.Vector3(0,HT-0.15,0),0.22,steel);
  const NS=Math.floor(HT/0.2),stepG=new THREE.BoxGeometry(1.15,0.06,0.42).translate(0.75,0,0),steps=new THREE.InstancedMesh(stepG,wood,NS),mm=new THREE.Matrix4();
  for(let i=0;i<NS;i++){mm.makeRotationY(i*0.38).setPosition(0,i*0.2+0.2,0);steps.setMatrixAt(i,mm);}steps.castShadow=true;g.add(steps);
  const rail=[];for(let i=0;i<=NS;i+=2){const a=i*0.38;rail.push(new THREE.Vector3(Math.cos(a)*1.35,i*0.2+1.1,-Math.sin(a)*1.35));}
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail),NS*2,0.03,6),red));
  // top deck with railings, canopy and flag
  const top=new THREE.Mesh(new THREE.BoxGeometry(4.0,0.22,4.0),wood);top.position.y=HT;g.add(top);
  const ent=[Math.cos(A0-1.0),Math.sin(A0-1.0)];
  for(const [x,z,w,d] of [[0,2.0,4.0,0.06],[-2.0,0,0.06,4.0],[2.0,0,0.06,4.0],[0,-2.0,4.0,0.06]]){if((x*ent[0]+z*ent[1])/2>-0.2)continue;const r=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,d),red);r.position.set(x,HT+1.1,z);g.add(r);const r2=r.clone();r2.position.y=HT+0.6;g.add(r2);}
  for(const [x,z] of C){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6,8),steel);p.position.set(x*1.2,HT+1.3,z*1.2);g.add(p);}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.4,1.6,4),red);roof.position.y=HT+3.4;roof.rotation.y=Math.PI/4;g.add(roof);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.9),new THREE.MeshStandardMaterial({color:'#2e86de',side:THREE.DoubleSide}));flag.position.set(0.8,HT+5.3,0);g.add(flag);g.userData.flag=flag;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.4,6),steel);pole.position.set(0,HT+4.9,0);g.add(pole);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});g.position.set(TX,TY,TZ);
  scene.add(g);var tower=g;}
// splash particles
const SPN=260,spPos=new Float32Array(SPN*3).fill(-999),spVel=new Float32Array(SPN*3),spLife=new Float32Array(SPN);let spI=0;
const spGeo=new THREE.BufferGeometry();spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3));
const spPts=new THREE.Points(spGeo,new THREE.PointsMaterial({color:0xffffff,size:0.22,transparent:true,opacity:0.85,depthWrite:false}));spPts.frustumCulled=false;scene.add(spPts);
function splash(x,y,z,n,pw){for(let k=0;k<n;k++){const i=(spI++)%SPN;spPos[i*3]=x+MR(-0.5,0.5);spPos[i*3+1]=y;spPos[i*3+2]=z+MR(-0.5,0.5);spVel[i*3]=MR(-1,1)*pw*0.5;spVel[i*3+1]=MR(0.5,1)*pw;spVel[i*3+2]=MR(-1,1)*pw*0.5;spLife[i]=MR(0.8,1.6);}}

// ---------- sounds ----------
let snd=null;
function mkSnd(){const s=AC.createBufferSource();s.buffer=NB.pink;s.loop=true;s.start();const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=800;bp.Q.value=0.5;const g=AC.createGain();g.gain.value=0;s.connect(bp).connect(g).connect(bus.nature);
  const s2=AC.createBufferSource();s2.buffer=NB.white;s2.loop=true;s2.start();const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;const g2=AC.createGain();g2.gain.value=0;s2.connect(hp).connect(g2).connect(bus.nature);return {g,g2,bp};}
function bigSplash(){if(!AC)return;noiseHit(bus.nature,420,0.6,0.75,0.01,1.1);noiseHit(bus.nature,1800,0.7,0.35,0.005,0.8);for(let i=0;i<12;i++)setTimeout(()=>noiseHit(bus.nature,MR(2500,7500),3,0.08,0.002,0.06,MR(-1,1)),180+i*60);}
function bell(){if(!AC)return;[880,1175,1568].forEach((f,i)=>{const t=AC.currentTime+i*0.18,o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;o.connect(g).connect(bus.nature);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.06,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);o.start(t);o.stop(t+0.55);});}

// ---------- the ride ----------
const R={st:'off',t:0,s:0,v:0,fly:null,count:0,best:0,wy:0,wp:0};
function startSlide(){if(R.st!=='off'){return;}goto(TX,TZ+0.5,Math.PI);R.st='top';R.t=0;R.s=0;R.v=0;R.wy=walker.yaw;R.wp=walker.pitch;setBtn(true);
  toast('🛝 Tu es tout en haut de la tour, 35 mètres au-dessus du sable… Prêt ? 3… 2… 1…',3200);}
function cancel(){if(R.st==='slide'||R.st==='top'){R.st='off';setBtn(false);goto(TX+3,TZ+4,Math.PI);}}
addEventListener('keydown',e=>{if(e.code==='KeyG'&&state.started&&!e.repeat)startSlide();});
const grid=document.querySelector('#act .grid');let btn=null;
if(grid){btn=document.createElement('button');btn.innerHTML='<span class="em">🛝</span><span>Toboggan</span><kbd>G</kbd>';btn.onclick=()=>{$('act').hidden=true;$('actBtn').classList.remove('on');startSlide();};grid.appendChild(btn);}
function setBtn(on){if(btn)btn.classList.toggle('on',on);}

const _v=new THREE.Vector3(),_t=new THREE.Vector3(),_t2=new THREE.Vector3();let T=0;
hooks.push((dt,time)=>{
  T=time;
  tower.userData.flag.rotation.y=Math.sin(T*3)*0.35;
  flowTex.offset.y-=dt*1.6;
  // particles
  for(let i=0;i<SPN;i++){if(spLife[i]<=0)continue;spLife[i]-=dt;spVel[i*3+1]-=9.8*dt;spPos[i*3]+=spVel[i*3]*dt;spPos[i*3+1]+=spVel[i*3+1]*dt;spPos[i*3+2]+=spVel[i*3+2]*dt;if(spLife[i]<=0||spPos[i*3+1]<lvl()-0.3){spLife[i]=0;spPos[i*3+1]=-999;}}
  spGeo.attributes.position.needsUpdate=true;
  let speed=0;
  if(R.st==='top'){R.t+=dt;const f=frames[0];camera.position.set(f.p.x,f.p.y+1.15,f.p.z).addScaledVector(f.t,-0.6);
    camera.rotation.set(-0.38+(walker.pitch-R.wp),Math.atan2(-f.t.x,-f.t.z)+(walker.yaw-R.wy),0,'YXZ');
    if(R.t>3.1){R.st='slide';bell();}}
  else if(R.st==='slide'){
    const i=Math.min(N-1,Math.floor(R.s*N)),f=frames[i],drop=frames[0].p.y-f.p.y;
    R.v=Math.max(R.v,Math.sqrt(2*9.8*Math.max(0,drop))*0.6+2.2);R.s+=R.v*dt/LEN;speed=R.v;
    const f2=frames[Math.min(N,i+6)];_t.copy(f2.t).sub(f.t);const bank=clamp(_t.dot(f.side)*-4,-0.3,0.3);
    camera.position.copy(f.p).addScaledVector(f.up,0.95);
    camera.rotation.set(Math.asin(clamp(f.t.y,-1,1))*0.85-0.08,Math.atan2(-f.t.x,-f.t.z),bank,'YXZ');
    if(R.s>=1){R.st='fly';const e=frames[N];R.fly={p:e.p.clone().addScaledVector(e.up,0.95),v:e.t.clone().multiplyScalar(R.v).add(new THREE.Vector3(0,2.5,0))};}}
  else if(R.st==='fly'){const fl=R.fly;fl.v.y-=9.8*dt;fl.p.addScaledVector(fl.v,dt);speed=fl.v.length();camera.position.copy(fl.p);
    camera.rotation.set(Math.atan2(fl.v.y,Math.hypot(fl.v.x,fl.v.z))*0.7,Math.atan2(-fl.v.x,-fl.v.z),0,'YXZ');
    if(fl.p.y<=lvl()+0.3){splash(fl.p.x,lvl(),fl.p.z,180,6);bigSplash();R.st='off';setBtn(false);R.count++;
      goto(fl.p.x,fl.p.z,Math.atan2(-fl.v.x,-fl.v.z));
      toast(`💦 SPLAAASH ! Glissade n°${R.count} réussie.<br><small>Nage vers la plage, ou remonte : touche G</small>`,5000);}}
  // sounds: rushing water & wind grow with speed
  if(AC&&AC.state==='running'){if(!snd)snd=mkSnd();const t=AC.currentTime,k=clamp(speed/16,0,1),on=R.st==='slide'||R.st==='fly';
    snd.g.gain.setTargetAtTime(on?0.12+0.35*k:0,t,0.12);snd.bp.frequency.setTargetAtTime(500+1400*k,t,0.2);snd.g2.gain.setTargetAtTime(on?0.04+0.16*k:0,t,0.12);}
});
