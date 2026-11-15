import * as THREE from 'three';
import {mergeGeometries} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import {scene,camera,renderer,clamp,WATER_U,bus,AC,noiseHit,hooks,state,$,env} from './app.js';

// =====================================================================
// Humpback whales offshore: they breathe at the surface (tall bushy
// spouts), arch their back and lift their tail flukes before sounding,
// and now and then leap out of the sea in a huge breach.
// Distant blows, splashes and a faint, slow whale song.
// =====================================================================
const MR=(a,b)=>a+(b-a)*Math.random();
const lvl=()=>WATER_U.uLevel.value;
const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function toast(html,ms=5200){const t=$('toast');t.innerHTML=html;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}

// ---------- whale body ----------
const L=13,RAD=1.5;
function hash(x,y,z){const s=Math.sin(x*12.99+y*78.23+z*37.71)*43758.55;return s-Math.floor(s);}
function noise3(x,y,z){return (Math.sin(x*1.7+Math.sin(z*0.9))+Math.sin(z*1.3+y*2.1)+Math.sin(y*1.1+x*0.7))/3;}
function prep(g,colorFn){g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3),col=new THREE.Color();
  for(let i=0;i<p.count;i++){colorFn(p.getX(i),p.getY(i),p.getZ(i),n.getY(i),col);c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;}
const DARK=new THREE.Color('#1e2227'),DARK2=new THREE.Color('#121518'),LIGHT=new THREE.Color('#c4c8c6'),SCAR=new THREE.Color('#8e9497');
function whaleGeometry(){
  const prof=[[0,0.05],[0.05,0.11],[0.15,0.22],[0.27,0.46],[0.41,0.78],[0.55,0.96],[0.66,1],[0.76,0.94],[0.86,0.78],[0.93,0.56],[0.975,0.32],[1,0.04]];
  const curve=new THREE.SplineCurve(prof.map(([s,r])=>new THREE.Vector2(r*RAD,(s-0.5)*L)));
  const body=new THREE.LatheGeometry(curve.getPoints(46),30).rotateX(Math.PI/2);
  {const p=body.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);y*=0.84;
      if(y>0)y*=1-0.3*sm(2.5,6.5,z);           // flat, broad head
      if(z>3&&y<0)y*=1+0.15*sm(3,5,z);          // deep throat pleats
      x*=1+0.08*sm(-6.5,-3,-z)*0;               // keep tail stock narrow
      if(z<-3)x*=0.82;                          // laterally flattened peduncle
      p.setXYZ(i,x,y,z);}body.computeVertexNormals();}
  const bodyG=prep(body,(x,y,z,ny,c)=>{const r=Math.max(0.05,Math.hypot(x,y));
    const belly=sm(-0.25,-0.75,y/r)*sm(-1,1.5,z);const pleats=0.5+0.5*Math.sin(x*14);
    c.copy(DARK).lerp(DARK2,0.5+0.5*noise3(x*0.9,y*0.9,z*0.6));
    c.lerp(LIGHT,belly*(0.75+0.25*pleats));
    if(hash(Math.floor(x*3),Math.floor(y*3),Math.floor(z*3))>0.985)c.lerp(SCAR,0.6);});
  // long pectoral flippers (humpback trademark)
  const fins=[];for(const sx of [1,-1]){const f=new THREE.SphereGeometry(1,20,8);const p=f.attributes.position;
      for(let i=0;i<p.count;i++){const x=p.getX(i);p.setX(i,x);p.setZ(i,p.getZ(i)*(1-0.55*Math.max(0,x)));}
      f.scale(2.1,0.16,0.5).translate(2.05,0,0);f.computeVertexNormals();
      f.rotateZ(-0.5).rotateY(-0.55);if(sx<0)f.scale(-1,1,1);f.translate(sx*RAD*0.72,-0.62,2.0);
      fins.push(prep(f,(x,y,z,ny,c)=>{c.copy(LIGHT).lerp(DARK,ny>0.2?0.55:0.05);if(hash(Math.floor(x*4),0,Math.floor(z*4))>0.8)c.lerp(DARK2,0.4);}));}
  // small dorsal fin on its hump
  const dor=new THREE.ConeGeometry(0.3,0.55,10).scale(0.6,1,2.4).rotateX(-0.5).translate(0,0.72,-2.4);dor.computeVertexNormals();
  const dorG=prep(dor,(x,y,z,ny,c)=>c.copy(DARK2));
  // tail flukes with a notch, white underside with black markings
  const s=new THREE.Shape();s.moveTo(0,0.3);s.quadraticCurveTo(1.25,0.15,2.3,-1.05);s.quadraticCurveTo(1.6,-1.05,0.16,-1.38);s.lineTo(0,-1.18);s.lineTo(-0.16,-1.38);s.quadraticCurveTo(-1.6,-1.05,-2.3,-1.05);s.quadraticCurveTo(-1.25,0.15,0,0.3);
  const fl=new THREE.ExtrudeGeometry(s,{depth:0.08,bevelEnabled:true,bevelThickness:0.05,bevelSize:0.05,bevelSegments:2,curveSegments:14}).translate(0,0,-0.04).rotateX(Math.PI/2).translate(0,0,-L/2+0.25);
  fl.computeVertexNormals();
  const flG=prep(fl,(x,y,z,ny,c)=>{if(ny<-0.3){const m=noise3(x*2.3,0,z*2.1);c.copy(LIGHT).lerp(DARK2,m>0.25||Math.abs(x)>2.0?0.9:0.05);}else c.copy(DARK2);});
  const g=mergeGeometries([bodyG,...fins,dorG,flG]);g.computeBoundingSphere();g.boundingSphere.radius=L;return g;
}
const BASE=whaleGeometry();
const wMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.52,metalness:0.0});

// ---------- spout / splash particles ----------
const NP=1600,pP=new Float32Array(NP*3).fill(-999),pV=new Float32Array(NP*3),pLife=new Float32Array(NP),pMax=new Float32Array(NP),pS0=new Float32Array(NP),pGrow=new Float32Array(NP),pA=new Float32Array(NP),pG=new Float32Array(NP),pDrag=new Float32Array(NP);
const aSize=new Float32Array(NP),aAlpha=new Float32Array(NP);let pI=0;
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pP,3));pGeo.setAttribute('aSize',new THREE.BufferAttribute(aSize,1));pGeo.setAttribute('aAlpha',new THREE.BufferAttribute(aAlpha,1));
const pMat=new THREE.ShaderMaterial({uniforms:{uScale:{value:500},uCol:{value:new THREE.Color(1,1,1)}},transparent:true,depthWrite:false,
  vertexShader:'attribute float aSize;attribute float aAlpha;uniform float uScale;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=min(256.0,aSize*uScale/max(1.0,-mv.z));vA=aAlpha;}',
  fragmentShader:'uniform vec3 uCol;varying float vA;void main(){vec2 d=gl_PointCoord-0.5;float r=dot(d,d)*4.0;if(r>1.0)discard;float a=vA*(1.0-r)*(1.0-r);if(a<0.004)discard;gl_FragColor=vec4(uCol,a);}'});
const pts=new THREE.Points(pGeo,pMat);pts.frustumCulled=false;scene.add(pts);
function emit(x,y,z,vx,vy,vz,life,s0,grow,alpha,g,drag){const i=(pI++)%NP;pP[i*3]=x;pP[i*3+1]=y;pP[i*3+2]=z;pV[i*3]=vx;pV[i*3+1]=vy;pV[i*3+2]=vz;pLife[i]=pMax[i]=life;pS0[i]=s0;pGrow[i]=grow;pA[i]=alpha;pG[i]=g;pDrag[i]=drag;}
function spout(p){for(let k=0;k<110;k++){const a=Math.random()*6.283,r=Math.random()*1.3;emit(p.x+MR(-0.2,0.2),p.y,p.z+MR(-0.2,0.2),Math.cos(a)*r+0.6,MR(6.5,11),Math.sin(a)*r,MR(2.4,4.2),MR(0.5,0.9),MR(1.0,1.8),MR(0.35,0.6),3.2,1.1);}}
function splash(x,y,z,pw){const n=Math.floor(160*pw);for(let k=0;k<n;k++){const a=Math.random()*6.283,r=MR(0.5,4)*pw;emit(x+Math.cos(a)*MR(0,3)*pw,y,z+Math.sin(a)*MR(0,3)*pw,Math.cos(a)*r,MR(3,13)*pw,Math.sin(a)*r,MR(1.4,2.8),MR(0.5,1.2)*pw,MR(0.6,1.6),MR(0.6,0.9),9.8,0.3);}
  for(let k=0;k<n*0.5;k++){const a=Math.random()*6.283;emit(x+Math.cos(a)*MR(0,5)*pw,y+0.5,z+Math.sin(a)*MR(0,5)*pw,Math.cos(a)*MR(0.5,2),MR(0.5,3),Math.sin(a)*MR(0.5,2),MR(3,5),MR(1.5,2.5)*pw,MR(1.5,2.5),MR(0.25,0.4),0.4,0.8);}}
function drip(p){emit(p.x+MR(-0.4,0.4),p.y,p.z+MR(-0.4,0.4),MR(-0.3,0.3),MR(-0.5,0.3),MR(-0.3,0.3),MR(0.8,1.4),MR(0.15,0.3),0.1,0.7,9.8,0.1);}

// ---------- sounds ----------
const _r=new THREE.Vector3(),_d=new THREE.Vector3();
function where(p){_d.copy(p).sub(camera.position);const dist=_d.length();_r.set(1,0,0).applyQuaternion(camera.quaternion);const pan=clamp(_d.normalize().dot(_r),-1,1);return {g:clamp(70/Math.max(1,dist),0.04,1),pan};}
function blowSnd(p){if(!AC)return;const {g,pan}=where(p);noiseHit(bus.nature,520,0.5,0.55*g,0.06,1.4,pan);noiseHit(bus.nature,1700,0.6,0.25*g,0.03,0.9,pan);setTimeout(()=>noiseHit(bus.nature,380,0.5,0.25*g,0.25,1.6,pan),900);}
function boomSnd(p,big){if(!AC)return;const {g,pan}=where(p);setTimeout(()=>{noiseHit(bus.nature,140,0.7,(big?1.1:0.5)*g,0.01,2.2,pan);noiseHit(bus.nature,900,0.6,(big?0.6:0.3)*g,0.01,1.6,pan);},Math.min(1500,(where.d||0)));}
let songT=12,delayNet=null;
function song(){if(!AC||AC.state!=='running')return;
  if(!delayNet){const d=AC.createDelay(2),fb=AC.createGain(),lp=AC.createBiquadFilter(),out=AC.createGain();d.delayTime.value=0.42;fb.gain.value=0.5;lp.type='lowpass';lp.frequency.value=900;out.gain.value=1;d.connect(lp).connect(fb).connect(d);lp.connect(out).connect(bus.nature);delayNet=d;}
  const t=AC.currentTime,o=AC.createOscillator(),o2=AC.createOscillator(),lfo=AC.createOscillator(),lg=AC.createGain(),g=AC.createGain(),bp=AC.createBiquadFilter();
  const f0=MR(140,260),dur=MR(2.5,4.5);o.type='sine';o2.type='triangle';
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f0*MR(1.4,2.2),t+dur*0.45);o.frequency.exponentialRampToValueAtTime(f0*MR(0.7,1.1),t+dur);
  o2.frequency.setValueAtTime(f0*0.5,t);o2.frequency.exponentialRampToValueAtTime(f0*0.75,t+dur);
  lfo.frequency.value=MR(4,7);lg.gain.value=f0*0.02;lfo.connect(lg).connect(o.frequency);
  bp.type='bandpass';bp.frequency.value=f0*1.5;bp.Q.value=0.7;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.03,t+dur*0.3);g.gain.linearRampToValueAtTime(0.022,t+dur*0.7);g.gain.linearRampToValueAtTime(0,t+dur);
  o.connect(bp);o2.connect(bp);bp.connect(g);g.connect(bus.nature);g.connect(delayNet);[o,o2,lfo].forEach(x=>{x.start(t);x.stop(t+dur+0.1);});}

// ---------- the pod ----------
const REG={x:140,z:-268,rx:62,rz:40};
function makeWhale(scale,x,z){const g=BASE.clone();const m=new THREE.Mesh(g,wMat);m.scale.setScalar(scale);m.castShadow=false;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);
  return {m,base:BASE.attributes.position.array,scale,x,z,yaw:MR(0,6.28),st:'deep',t:MR(0,20),dur:MR(8,30),ph:MR(0,6),blows:0,k:0,tailA:0.2,y:-25,pitch:0,roll:0,speed:2.5,splashed:0,entered:0};}
const whales=[makeWhale(1,REG.x-20,REG.z),makeWhale(0.55,REG.x-12,REG.z+8),makeWhale(0.92,REG.x+35,REG.z-15)];
whales[1].mom=whales[0];window.__whales=whales;
let seen=false;
function next(w){
  const s=w.st;w.t=0;
  if(s==='surf'){w.st='dive';w.dur=9;}
  else if(s==='dive'){w.st='deep';w.dur=MR(18,40);}
  else if(s==='deep'){if(Math.random()<0.38){w.st='breach';w.dur=7;w.splashed=0;w.entered=0;}else{w.st='rise';w.dur=5;}}
  else if(s==='breach'){w.st='deep';w.dur=MR(10,20);}
  else {w.st='surf';w.dur=MR(18,28);w.blows=0;}
}
const _p=new THREE.Vector3(),_q=new THREE.Vector3();
function local(w,x,y,z){const zz=z,off=-0.5*w.k*zz*zz+w.tailA*Math.sin(w.ph-zz*0.35)*Math.pow(clamp(-zz/6.5,0,1),2);return w.m.localToWorld(_p.set(x,y+off,z));}

hooks.push((dt,T)=>{
  const Lv=lvl();
  for(const w of whales){
    w.t+=dt;if(w.t>=w.dur)next(w);
    const u=w.t/w.dur,S=w.scale;let y=-25,pitch=0,roll=0,speed=2.2,k=0,tail=0.18;
    if(w.st==='surf'){y=Lv-0.95*S+0.2*S*Math.sin(w.t*0.6);
      if(Math.random()<0.6){const zz=(Math.random()-0.3)*L*0.7,q=local(w,(Math.random()-0.5)*1.6,0,zz);if(Math.abs(q.y-Lv)<0.6)emit(q.x,Lv+0.05,q.z,(Math.random()-0.5)*0.6,0.15,(Math.random()-0.5)*0.6,MR(0.8,1.5),MR(0.3,0.6),0.6,0.55,0,1.5);}pitch=0.05*Math.cos(w.t*0.6);
      const due=[1.2,8,15,22];if(w.blows<due.length&&w.t>=due[w.blows]){w.blows++;const p=local(w,0,1.15,3.0).clone();p.y=Math.max(p.y,Lv+0.2);spout(p);blowSnd(p);}}
    else if(w.st==='dive'){pitch=-1.45*sm(0.05,0.8,u);y=Lv-0.95*S-9*S*u*u;k=0.04*Math.sin(Math.PI*u);tail=0.06;
      const tip=local(w,1.4,0,-L/2-0.8);if(tip.y>Lv+0.2&&Math.random()<0.7){drip(tip);drip(local(w,-1.4,0,-L/2-0.8));}
      if(u>0.86&&!w.splashed){w.splashed=1;const p=local(w,0,0,-L/2);splash(p.x,Lv,p.z,0.35*S);}}
    else if(w.st==='rise'){y=-14+(Lv-0.95*S+14)*sm(0,1,u);pitch=0.25*(1-u);}
    else if(w.st==='breach'){const tau=(u-0.3)*w.dur;speed=4;tail=0.45;
      if(u<0.3){y=-22+20*(u/0.3);pitch=1.25;}
      else{y=Math.max(-16,-2+10.8*tau-4.9*tau*tau);pitch=u<0.65?1.25-1.45*(u-0.3)/0.35:-0.2-0.4*sm(0.65,1,u);roll=1.8*sm(0.3,0.62,u);
        if(!w.splashed){w.splashed=1;splash(w.x,Lv,w.z,0.6*S);boomSnd(_q.set(w.x,Lv,w.z),false);
          if(!seen&&state.started){seen=true;toast('🐋 Regarde au large : <b>des baleines</b> ! Elles soufflent, sautent et plongent en montrant leur queue…');}}
        if(tau>2.05&&!w.entered){w.entered=1;splash(w.x,Lv,w.z,1.15*S);boomSnd(_q.set(w.x,Lv,w.z),true);}}}
    else {y=-25;speed=3.2;}
    w.y=y;w.pitch=pitch;w.roll=roll;w.k=k;w.tailA+=(tail-w.tailA)*Math.min(1,dt);w.ph+=dt*(1.0+speed*0.25);
    // swim: steer to stay in the region (the calf sticks close to its mother)
    let tx=REG.x,tz=REG.z,far=((w.x-REG.x)/REG.rx)**2+((w.z-REG.z)/REG.rz)**2;
    if(w.mom){tx=w.mom.x+Math.cos(w.mom.yaw)*6;tz=w.mom.z-Math.sin(w.mom.yaw)*6;far=Math.hypot(w.x-tx,w.z-tz)/8;}
    if(far>0.55){const want=Math.atan2(tx-w.x,tz-w.z);let dy=want-w.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));w.yaw+=clamp(dy,-1,1)*dt*0.25*Math.min(2,far);}
    else w.yaw+=Math.sin(T*0.05+w.scale*7)*dt*0.04;
    const v=speed*Math.cos(pitch)*(w.mom&&far>1.5?1.6:1);w.x+=Math.sin(w.yaw)*v*dt;w.z+=Math.cos(w.yaw)*v*dt;
    w.m.position.set(w.x,w.y,w.z);w.m.rotation.set(-w.pitch,w.yaw,w.roll,'YXZ');w.m.visible=w.y>-20;
    if(w.m.visible){w.m.updateMatrixWorld();const pa=w.m.geometry.attributes.position,a=pa.array,b=w.base;
      for(let i=0;i<a.length;i+=3){const z=b[i+2];a[i+1]=b[i+1]-0.5*w.k*z*z+w.tailA*Math.sin(w.ph-z*0.35)*Math.pow(clamp(-z/6.5,0,1),2);}pa.needsUpdate=true;}
  }
  // particles
  for(let i=0;i<NP;i++){if(pLife[i]<=0){aAlpha[i]=0;continue;}pLife[i]-=dt;const j=i*3,dr=Math.max(0,1-pDrag[i]*dt);
    pV[j]*=dr;pV[j+2]*=dr;pV[j+1]=pV[j+1]*dr-pG[i]*dt;pP[j]+=pV[j]*dt;pP[j+1]+=pV[j+1]*dt;pP[j+2]+=pV[j+2]*dt;
    const age=pMax[i]-pLife[i];aSize[i]=pS0[i]+pGrow[i]*age;aAlpha[i]=pA[i]*Math.min(1,age*8)*clamp(pLife[i]/pMax[i]*1.6,0,1);
    if(pLife[i]<=0||(pG[i]>5&&pP[j+1]<Lv-0.3)){pLife[i]=0;aAlpha[i]=0;}}
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.aSize.needsUpdate=true;pGeo.attributes.aAlpha.needsUpdate=true;
  pMat.uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));
  const lt=0.25+0.75*env.light;pMat.uniforms.uCol.value.setRGB(lt,lt,lt*1.02);
  // distant whale song
  songT-=dt;if(songT<=0){songT=MR(25,70);song();if(Math.random()<0.5)setTimeout(song,MR(3500,6000));}
});
