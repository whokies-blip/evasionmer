import * as THREE from 'three';
import {scene,camera,H,WATER_U,bus,AC,NB,noiseHit,env1,hooks,walker,state,clamp} from './app.js';

// =====================================================================
// 1. Detailed humans: every person built by world2/world3 is detected
//    (head sphere r=0.125) and re-dressed with a detailed body, face,
//    hair, hands and bending knees/elbows. Their existing animation
//    pivots (legs/arms) are kept, so all behaviours keep working.
// =====================================================================
const MR=(a,b)=>a+(b-a)*Math.random(),mpick=a=>a[Math.floor(Math.random()*a.length)];
const mat=(c,r=0.6,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...o});
const lathe=(pts,seg=28)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);
const caps=(r,l)=>new THREE.CapsuleGeometry(r,l,6,14);
const darker=(c,k)=>new THREE.Color(c).multiplyScalar(k);
const people=[];

function find(){const found=[];scene.traverse(o=>{if(!o.isGroup||o.userData.hd)return;const head=o.children.find(c=>c.isMesh&&c.geometry.type==='SphereGeometry'&&Math.abs(c.geometry.parameters.radius-0.125)<1e-4);if(head)found.push({g:o,head});});return found;}

function upgrade({g,head}){
  g.userData.hd=true;
  const kids=g.children.slice();
  const legs=kids.filter(c=>c.isGroup&&Math.abs(c.position.y-0.86)<0.01);
  const arms=kids.filter(c=>c.isGroup&&Math.abs(c.position.y-1.55)<0.01);
  if(legs.length!==2||arms.length!==2)return;
  const skinC=head.material.color.clone();
  const torso=kids.find(c=>c.isMesh&&c.geometry.type==='CylinderGeometry'&&Math.abs(c.position.y-1.32)<0.01);
  const shorts=kids.find(c=>c.isMesh&&c.geometry.type==='CylinderGeometry'&&Math.abs(c.position.y-0.93)<0.01);
  const hairM=kids.find(c=>c.isMesh&&c.geometry.type==='SphereGeometry'&&Math.abs(c.geometry.parameters.radius-0.132)<1e-3);
  const dress=kids.find(c=>c.isMesh&&c.geometry.type==='ConeGeometry'&&c.position.y<1.1);
  const longH=kids.some(c=>c.isMesh&&c.geometry.type==='BoxGeometry'&&Math.abs(c.position.y-1.66)<0.01);
  const hasHat=kids.some(c=>c.isMesh&&c.geometry.type==='CylinderGeometry'&&Math.abs((c.geometry.parameters.radiusTop||0)-0.27)<1e-3);
  const keep=new Set();kids.forEach(c=>{if(c.isMesh&&c.geometry.type==='CylinderGeometry'&&(c.position.y>1.85||Math.abs(c.position.x)>0.25))keep.add(c);if(c.isMesh&&c.geometry.type==='SphereGeometry'&&Math.abs(c.geometry.parameters.radius-0.135)<1e-3)keep.add(c);if(c.isMesh&&(c.geometry.type==='BoxGeometry'&&(c.position.y>1.6&&c.position.y<1.82&&c.position.z>0.1)))keep.add(c);});
  // hide the old blocky meshes (hats, sunglasses, bow ties and props are kept)
  kids.forEach(c=>{if(c.isMesh&&!keep.has(c)&&c.geometry.type!=='SphereGeometry')c.visible=false;});
  head.visible=false;if(hairM)hairM.visible=false;
  const bare=torso&&torso.material.color.equals(skinC);
  const topC=torso?torso.material.color.clone():new THREE.Color('#ffffff'),botC=shorts?shorts.material.color.clone():new THREE.Color('#2e86ab');
  const hairC=hairM?hairM.material.color.clone():new THREE.Color('#3a2a1a');
  const female=!!dress||longH||Math.random()<0.15;
  const skin=mat(skinC,0.55,{emissive:darker(skinC,0.04)}),top=mat(topC,0.85),bot=mat(botC,0.8),hair=mat(hairC,0.75),lip=mat(darker(skinC,0.7).lerp(new THREE.Color('#c0505a'),0.35),0.5);
  const add=(geo,m,x,y,z,sx=1,sy=1,sz=1,parent=g)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.scale.set(sx,sy,sz);me.castShadow=true;me.receiveShadow=true;parent.add(me);return me;};
  // --- torso (smooth lathe), clothing split
  const wz=female?0.66:0.62;
  const chestW=female?0.17:0.19,waist=female?0.135:0.16,hip=female?0.175:0.16;
  const full=[[0.001,0.82],[hip*0.9,0.83],[hip,0.9],[hip*0.97,0.97],[waist,1.08],[waist*1.03,1.15],[chestW*0.97,1.28],[chestW,1.38],[chestW*0.96,1.46],[0.15,1.52],[0.1,1.57],[0.055,1.6],[0.001,1.61]];
  const torsoM=add(lathe(full),bare?skin:top,0,0,0,1,1,wz);
  const trunks=add(lathe([[hip*0.9+0.005,0.83],[hip+0.006,0.9],[hip*0.97+0.006,0.98],[waist+0.006,1.03]]),bot,0,0,0,1,1,wz+0.02);
  if(bare&&female){add(lathe([[chestW*0.97+0.006,1.27],[chestW+0.007,1.36],[chestW*0.98+0.006,1.43]]),bot,0,0,0,1,1,wz+0.03);}
  if(female){for(const s of [-1,1])add(new THREE.SphereGeometry(0.062,14,10),bare?bot:top,0.07*s,1.36,0.075,1,0.9,0.75);}
  if(dress){const dc=dress.material.color;add(lathe([[0.15,1.42],[0.16,1.25],[0.17,1.05],[0.25,0.82],[0.33,0.6],[0.33,0.58]],32),mat(dc,0.8,{side:THREE.DoubleSide}),0,0,0,1,1,0.85);trunks.visible=false;}
  // breathing reference
  torsoM.userData.base=torsoM.scale.clone();
  // --- neck & head
  add(new THREE.CylinderGeometry(0.048,0.056,0.12,14),skin,0,1.645,0.005);
  const hg=new THREE.Group();hg.position.set(0,1.665,0.01);g.add(hg);
  add(new THREE.SphereGeometry(0.105,24,18),skin,0,0.11,0,1,1.17,1.08,hg);              // cranium
  add(new THREE.SphereGeometry(0.08,20,14),skin,0,0.055,0.03,1.05,0.95,1.0,hg);         // jaw/cheeks
  add(new THREE.SphereGeometry(0.03,12,10),skin,0,0.025,0.085,1.1,0.8,0.8,hg);           // chin
  const nose=add(new THREE.ConeGeometry(0.016,0.045,10),skin,0,0.095,0.118,1,1,1,hg);nose.rotation.x=Math.PI/2+0.35;
  add(new THREE.SphereGeometry(0.016,10,8),skin,0,0.078,0.122,1.2,0.8,0.9,hg);
  for(const s of [-1,1]){add(new THREE.SphereGeometry(0.022,10,8),skin,0.104*s,0.1,-0.005,0.5,1,0.8,hg);                 // ears
    add(new THREE.SphereGeometry(0.017,12,10),mat('#f8f6f2',0.25),0.037*s,0.123,0.093,1,0.75,0.6,hg);                     // eye white
    add(new THREE.SphereGeometry(0.0095,10,8),mat(mpick(['#3b2a1e','#4a6b8a','#5c4a2a','#2d4a2d']),0.2),0.037*s,0.122,0.103,1,1,0.6,hg); // iris
    add(new THREE.SphereGeometry(0.0045,8,6),mat('#0a0a0a',0.1),0.037*s,0.122,0.108,1,1,0.5,hg);                        // pupil
    const lidM=add(new THREE.SphereGeometry(0.0185,12,8,0,Math.PI*2,0,Math.PI/2),skin,0.037*s,0.124,0.093,1,0.25,0.65,hg);lidM.userData.lid=true; // eyelid (blink)
    const br=add(new THREE.BoxGeometry(0.038,0.007,0.01),hair,0.038*s,0.15,0.1,1,1,1,hg);br.rotation.z=-0.12*s;           // eyebrows
    add(new THREE.SphereGeometry(0.02,10,8),mat(darker(skinC,1).lerp(new THREE.Color('#ff8a8a'),0.25),0.6,{transparent:true,opacity:0.5}),0.055*s,0.075,0.085,1,0.6,0.4,hg);} // cheeks
  const mouth=add(new THREE.TorusGeometry(0.022,0.0045,6,16,Math.PI),lip,0,0.058,0.098,1,0.8,1,hg);mouth.rotation.z=Math.PI;   // smile
  // --- hair
  if(!hasHat||true){
    add(new THREE.SphereGeometry(0.112,24,16,0,Math.PI*2,0,Math.PI*0.4),hair,0,0.128,-0.008,1.02,1.12,1.1,hg);
    add(new THREE.SphereGeometry(0.11,20,14,Math.PI*0.95,Math.PI*1.1,Math.PI*0.2,Math.PI*0.5),hair,0,0.11,-0.012,1.03,1.12,1.1,hg);
    if(female||longH){add(new THREE.LatheGeometry([[0.1,0.14],[0.112,0.08],[0.11,0.0],[0.1,-0.08],[0.08,-0.14],[0.001,-0.15]].map(q=>new THREE.Vector2(q[0],q[1])),20,Math.PI/2+0.35,Math.PI-0.7),hair,0,0.06,-0.03,1.02,1,0.9,hg);
      if(Math.random()<0.4)add(new THREE.SphereGeometry(0.05,14,10),hair,0,0.2,-0.08,1,1,1,hg);}
    else if(Math.random()<0.35){for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,b=Math.random()*0.9;add(new THREE.SphereGeometry(0.035,8,6),hair,Math.cos(a)*Math.sin(b)*0.1,0.13+Math.cos(b)*0.1,Math.sin(a)*Math.sin(b)*0.1-0.01,1,1,1,hg);}}
  }
  // --- arms: upper arm, elbow, forearm, hand
  const elbows=[];
  arms.forEach((p,i)=>{const s=i===0?-1:1;p.children.forEach(c=>{if(c.isMesh)c.visible=false;});
    add(new THREE.SphereGeometry(0.055,14,10),bare||!torso?skin:top,0,0,0,1,1,1,p);
    add(caps(0.046,0.22),(bare||Math.random()<0.6)?skin:top,0,-0.15,0,1,1,1,p);
    const el=new THREE.Group();el.position.y=-0.29;p.add(el);elbows.push(el);
    add(caps(0.039,0.2),skin,0,-0.13,0,1,1,1,el);
    const hand=add(new THREE.SphereGeometry(0.042,12,10),skin,0,-0.29,0.005,0.75,1.15,0.45,el);
    add(caps(0.012,0.03),skin,0.03*-s,-0.27,0.025,1,1,1,el).rotation.z=0.6*s;});
  // --- legs: thigh, knee, shin, foot (+ flip-flops)
  const knees=[];const flip=mat(mpick(['#e2574c','#2e86ab','#f2c14e','#f28cb1','#52b788']),0.6);
  legs.forEach(p=>{p.children.forEach(c=>{if(c.isMesh)c.visible=false;});
    add(caps(0.068,0.3),dress?skin:(bare?skin:skin),0,-0.2,0,1,1,1,p);
    const kn=new THREE.Group();kn.position.y=-0.42;p.add(kn);knees.push(kn);
    add(caps(0.05,0.3),skin,0,-0.2,0,1,1,1,kn);
    add(new THREE.SphereGeometry(0.05,12,10),skin,0,-0.41,0.045,0.85,0.45,1.8,kn);
    add(new THREE.BoxGeometry(0.1,0.012,0.23),flip,0,-0.435,0.045,1,1,1,kn);});
  people.push({g,hg,torso:torsoM,knees,elbows,legs,arms,blink:MR(1,5),look:MR(0,6)});
}

let scanT=0;
function scan(){for(const f of find()){try{upgrade(f);}catch(e){}}}
scan();

// =====================================================================
// 2. Better voices: pick the most natural French voice available and
//    stop pitch-shifting (which sounded robotic).
// =====================================================================
let voices=[];const loadV=()=>{try{voices=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('fr'));}catch(e){}};
if('speechSynthesis' in window){loadV();speechSynthesis.onvoiceschanged=loadV;
  const score=v=>{const n=v.name.toLowerCase();let s=0;if(/natural|neural|online/.test(n))s+=10;if(/premium|enhanced|amélioré|siri/.test(n))s+=8;if(/google/.test(n))s+=6;if(/fr-fr|france/.test(n)||v.lang==='fr-FR')s+=2;if(v.localService===false)s+=1;return s;};
  const FEM=/denise|eloise|vivienne|amélie|amelie|audrey|marie|céline|celine|julie|hortense|aurélie|aurelie|léa|lea|google français|brigitte|charline|virginie|joséphine|josephine|coralie|ariane|sylvie/i,MAL=/henri|thomas|paul|rémy|remy|claude|jean|antoine|nicolas|alain|daniel|jérôme|jerome|guillaume|maxime|yannick|fabrice|gerard|gérard|olivier|lucien/i;
  const orig=speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak=u=>{const p0=u.pitch||1,kind=p0>1.5?'k':p0>1.0?'f':'m';if(VM&&VM[vnorm(u.text||'')]){playVoice(u.text,kind);return;}try{if(!voices.length)loadV();const wantF=(u.pitch||1)>1.0;let pool=voices.filter(v=>wantF?FEM.test(v.name):MAL.test(v.name));if(!pool.length)pool=voices;
      pool.sort((a,b)=>score(b)-score(a));if(pool[0])u.voice=pool[0];u.lang='fr-FR';
      const p=u.pitch||1;u.pitch=p>1.5?1.15:p>1.0?1.05:0.97;u.rate=0.93;u.volume=Math.min(1,(u.volume||1));}catch(e){}return orig(u);};}

// --- recorded neural voices (Piper, generated offline): played through Web Audio, panned toward the speaker
let VM=null;fetch('./voices/manifest.json').then(r=>r.json()).then(j=>{VM=j;}).catch(()=>{});
const vnorm=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const vcache={};let curVoice=null;
function bubblePan(){const bs=[...document.querySelectorAll('.bubble.show')];if(!bs.length)return 0;const x=parseFloat(bs[bs.length-1].style.left)||innerWidth/2;return clamp((x/innerWidth)*2-1,-1,1)*0.7;}
async function playVoice(text,kind){try{if(!AC)return;const id=VM[vnorm(text)],url=`./voices/${id}-${kind}.mp3`;let buf=vcache[url];
  if(!buf){const ab=await (await fetch(url)).arrayBuffer();buf=vcache[url]=await AC.decodeAudioData(ab);}
  if(curVoice){try{curVoice.stop();}catch(e){}}const s=AC.createBufferSource();s.buffer=buf;const g=AC.createGain();g.gain.value=1.5;const p=AC.createStereoPanner();p.pan.value=bubblePan();
  s.connect(g).connect(p).connect(bus.nature);s.start();curVoice=s;}catch(e){}}

// =====================================================================
// 3. Water sounds: wading, swimming strokes, lapping water around you
// =====================================================================
let wat=null,lastPos=new THREE.Vector3(),acc=0,wasIn=0,lapT=1,dropT=0.5;
function mk(){const s=AC.createBufferSource();s.buffer=NB.pink;s.loop=true;s.start(0,Math.random()*4);const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=650;bp.Q.value=0.7;const g=AC.createGain();g.gain.value=0;s.connect(bp).connect(g).connect(bus.nature);
  const s2=AC.createBufferSource();s2.buffer=NB.white;s2.loop=true;s2.start(0,Math.random()*4);const hp=AC.createBiquadFilter();hp.type='bandpass';hp.frequency.value=3800;hp.Q.value=0.9;const g2=AC.createGain();g2.gain.value=0;s2.connect(hp).connect(g2).connect(bus.nature);
  const s3=AC.createBufferSource();s3.buffer=NB.brown;s3.loop=true;s3.start(0,Math.random()*4);const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=220;const g3=AC.createGain();g3.gain.value=0;s3.connect(lp).connect(g3).connect(bus.nature);
  return {g,g2,g3,bp};}
function stroke(power){const p=MR(-0.6,0.6);noiseHit(bus.nature,MR(380,620),0.8,0.32*power,0.03,0.45,p);setTimeout(()=>noiseHit(bus.nature,MR(1400,2200),1.1,0.16*power,0.01,0.25,-p),140);
  for(let i=0;i<5;i++)setTimeout(()=>noiseHit(bus.nature,MR(3000,6500),3,0.05*power,0.002,0.04,MR(-0.8,0.8)),220+i*MR(40,90));}
function splashBig(){noiseHit(bus.nature,500,0.6,0.5,0.01,0.8);noiseHit(bus.nature,2500,0.8,0.25,0.005,0.5);for(let i=0;i<8;i++)setTimeout(()=>noiseHit(bus.nature,MR(2500,7000),3,0.06,0.002,0.05,MR(-1,1)),150+i*70);}

// =====================================================================
// per-frame
// =====================================================================
let T=0;
hooks.push((dt,time)=>{
  T=time;
  scanT-=dt;if(scanT<=0){scanT=2;scan();}
  // natural motion: knees & elbows follow the swing, breathing, blinking, head turns
  for(const p of people){if(!p.g.visible||!p.torso.userData.base)continue;
    p.legs.forEach((l,i)=>{const r=l.rotation.x;p.knees[i].rotation.x=r<-1?1.6:Math.max(0,-r)*1.1+0.05;});
    p.arms.forEach((a,i)=>{const r=a.rotation.x;p.elbows[i].rotation.x=r<-1.5?-0.25:-(0.18+Math.max(0,-r)*0.6);});
    const b=1+Math.sin(T*1.6+p.look)*0.012;p.torso.scale.set(p.torso.userData.base.x*b,p.torso.userData.base.y,p.torso.userData.base.z*b);
    p.hg.rotation.y=Math.sin(T*0.3+p.look)*0.35;p.hg.rotation.x=Math.sin(T*0.21+p.look)*0.06;
    p.blink-=dt;const closed=p.blink<0.12;if(p.blink<0)p.blink=MR(2,6);p.hg.children.forEach(c=>{if(c.userData.lid)c.scale.y=closed?0.95:0.25;});}
  // water ambience around the swimmer / wader
  if(AC&&AC.state==='running'){if(!wat)wat=mk();const t=AC.currentTime;
    const lv=WATER_U.uLevel.value,depth=state.mode==='walk'?lv-H(walker.x,walker.z):-1;
    const moved=camera.position.distanceTo(lastPos);lastPos.copy(camera.position);const speed=Math.min(6,moved/Math.max(dt,1e-3));
    const swim=depth>1.15,wade=depth>0&&!swim;
    const sw=0.5+0.5*Math.sin(T*1.25),k=swim?1:wade?Math.min(1,depth*1.2):0;
    wat.g.gain.setTargetAtTime(k*(swim?0.32+0.18*sw:0.12+0.25*Math.min(1,speed/2)),t,0.15);
    wat.bp.frequency.setTargetAtTime(swim?520+200*sw:800,t,0.2);
    wat.g2.gain.setTargetAtTime(k*(swim?0.035+0.03*sw:0.02*Math.min(1,speed/2)),t,0.2);
    wat.g3.gain.setTargetAtTime(swim?0.28:0,t,0.3);
    if(swim){acc+=moved;if(acc>1.1&&speed>0.3){acc=0;stroke(1);}
      lapT-=dt;if(lapT<=0){lapT=MR(0.8,2.4);noiseHit(bus.nature,MR(700,1100),2,0.14,0.004,0.12,MR(-0.9,0.9));}
      dropT-=dt;if(dropT<=0){dropT=MR(0.15,0.6);noiseHit(bus.nature,MR(4000,8000),4,0.03,0.001,0.03,MR(-1,1));}}
    if(swim&&!wasIn)splashBig();
    wasIn=swim;}
});
// safety: one faulty animation frame must never freeze the whole scene
hooks.forEach((h,i)=>{if(!h.__safe){const f=(...a)=>{try{h(...a);}catch(e){}};f.__safe=true;hooks[i]=f;}});
