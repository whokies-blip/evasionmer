import * as THREE from 'three';
import {scene,camera,H,SHORE,clamp,env,WATER_U,vol,bus,AC,NB,noiseHit,env1,hooks,clickHooks,state,canvasTex,goto,sunDir,$,walker} from './app.js';

// ============ helpers ============
const MR=(a,b)=>a+(b-a)*Math.random(),mpick=a=>a[Math.floor(Math.random()*a.length)];
const camDist=(x,z)=>Math.hypot(x-camera.position.x,z-camera.position.z);
function camPan(x,z){const cy=camera.rotation.y,dx=x-camera.position.x,dz=z-camera.position.z,d=Math.hypot(dx,dz)||1;return clamp((dx*Math.cos(cy)-dz*Math.sin(cy))/d,-1,1);}
const std=(c,r=0.7,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...o});
function shadowAll(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o}
const day=()=>env.day;
let T=0;const _v=new THREE.Vector3(),_w=new THREE.Vector3();
scene.add(camera);
function toast(html,ms=3800){const t=$('toast');t.innerHTML=html;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}
const bub=document.createElement('div');bub.className='bubble';document.body.appendChild(bub);let bubW=null,bubT=0;
function speak(text,pitch=1){try{if(!('speechSynthesis' in window)||vol.nature<0.05)return;const u=new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s'’,.!?…-]/gu,''));u.lang='fr-FR';const vs=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('fr'));if(vs.length)u.voice=vs[Math.floor(pitch*5)%vs.length];u.rate=0.97;u.pitch=Math.min(2,pitch);u.volume=Math.min(1,0.7*vol.nature+0.2);speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
function say(obj,h,text,pitch=1){bub.textContent=text;bub.classList.add('show');bubW={o:obj,h};bubT=4.5;speak(text,pitch);}
function tone(f,dur,v=0.05,type='sine',when=0,f2){if(!AC)return;const t=AC.currentTime+when,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);o.connect(g).connect(bus.nature);env1(g,t,0.01,v,dur);o.start(t);o.stop(t+dur+0.05);}
function gullCall(pan,gain){if(!AC)return;const t0=AC.currentTime+0.02,o=AC.createOscillator(),lfo=AC.createOscillator(),lg=AC.createGain(),f=AC.createBiquadFilter(),g=AC.createGain(),p=AC.createStereoPanner();
  o.type='sawtooth';lfo.frequency.value=30+Math.random()*8;lg.gain.value=50;lfo.connect(lg).connect(o.frequency);f.type='bandpass';f.frequency.value=MR(1500,1900);f.Q.value=2.5;p.pan.value=pan;g.gain.value=0;
  o.connect(f).connect(g).connect(p).connect(bus.nature);const n=1+Math.floor(Math.random()*4);let t=t0;
  for(let k=0;k<n;k++){const d=k===0?MR(0.35,0.5):MR(0.18,0.28),f0=MR(950,1250);o.frequency.setValueAtTime(f0*0.85,t);o.frequency.linearRampToValueAtTime(f0*1.35,t+0.05);o.frequency.exponentialRampToValueAtTime(f0*0.78,t+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.2*gain,t+0.03);g.gain.linearRampToValueAtTime(0.12*gain,t+d*0.6);g.gain.linearRampToValueAtTime(0,t+d);t+=d+MR(0.05,0.13);}
  o.start(t0);lfo.start(t0);o.stop(t+0.1);lfo.stop(t+0.1);}
function pok(x,z){if(!AC)return;const d=camDist(x,z);noiseHit(bus.nature,520,1.3,0.3/(1+d*0.08),0.002,0.09,camPan(x,z));}
function slurp(){if(!AC)return;noiseHit(bus.nature,1500,1.4,0.16,0.02,0.28);setTimeout(()=>noiseHit(bus.nature,1000,2,0.12,0.01,0.22),200);tone(300,0.25,0.03,'sine',0.35,180);}
function purr(dur){if(!AC)return;const t=AC.currentTime,s=AC.createBufferSource();s.buffer=NB.brown;s.loop=true;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=260;const am=AC.createGain();am.gain.value=0.5;const lfo=AC.createOscillator();lfo.frequency.value=24;const lg=AC.createGain();lg.gain.value=0.5;lfo.connect(lg).connect(am.gain);const m=AC.createGain();m.gain.setValueAtTime(0,t);m.gain.linearRampToValueAtTime(0.9,t+0.4);m.gain.setValueAtTime(0.9,t+dur-0.6);m.gain.linearRampToValueAtTime(0,t+dur);s.connect(lp).connect(am).connect(m).connect(bus.nature);s.start(t);lfo.start(t);s.stop(t+dur+0.1);lfo.stop(t+dur+0.1);}

// ============ people (compact) ============
const SKIN=['#f1c9a5','#e0ac83','#c68863','#8d5a3b','#5c3a24','#f5d6c0'],HAIR=['#2b1d14','#5a3825','#c99a5b','#1a1a1a','#8a4b2a'],CLOTH=['#e2574c','#2e86ab','#f2c14e','#52b788','#f28cb1','#7b2cbf','#ff9f1c','#264653'];
function person(o={}){const s=o.s||MR(0.94,1.06),g=new THREE.Group(),skin=std(o.skin||mpick(SKIN),0.6),top=std(o.top||mpick(CLOTH)),bot=std(o.bot||mpick(CLOTH)),hair=std(o.hair||mpick(HAIR),0.9),legs=[],arms=[];
  for(const sd of [-1,1]){const p=new THREE.Group();p.position.set(0.09*sd,0.86,0);const l=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.05,0.82,8),skin);l.position.y=-0.41;p.add(l);g.add(p);legs.push(p);}
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.175,0.19,0.27,12),bot);sh.position.y=0.93;g.add(sh);
  const to=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.165,0.56,12),o.bare?skin:top);to.position.y=1.32;g.add(to);
  for(const sd of [-1,1]){const p=new THREE.Group();p.position.set(0.235*sd,1.55,0);const a=new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.04,0.6,8),skin);a.position.y=-0.3;p.add(a);g.add(p);arms.push(p);}
  const hd=new THREE.Mesh(new THREE.SphereGeometry(0.125,14,10),skin);hd.position.y=1.77;hd.scale.set(1,1.08,1);g.add(hd);
  const hr=new THREE.Mesh(new THREE.SphereGeometry(0.132,14,8,0,Math.PI*2,0,Math.PI*0.52),hair);hr.position.set(0,1.79,-0.01);g.add(hr);
  if(o.cap){const c=new THREE.Mesh(new THREE.SphereGeometry(0.135,12,8,0,Math.PI*2,0,Math.PI/2),std(o.cap));c.position.y=1.8;g.add(c);const v=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.015,0.14),std(o.cap));v.position.set(0,1.81,0.15);g.add(v);}
  if(o.bow){const b=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.03),std('#111'));b.position.set(0,1.62,0.17);g.add(b);}
  g.scale.setScalar(s);shadowAll(g);scene.add(g);return {g,legs,arms,s,h:1.95*s};}
function walkAnim(p,ph,amp){const a=Math.sin(ph)*amp;p.legs[0].rotation.x=a;p.legs[1].rotation.x=-a;p.arms[0].rotation.x=-a*0.8;if(!p.tray)p.arms[1].rotation.x=a*0.8;}

// ============ hearts ============
const heartTex=canvasTex(64,64,(g)=>{g.fillStyle='#ff5c8a';g.beginPath();g.moveTo(32,56);g.bezierCurveTo(4,36,6,10,22,10);g.bezierCurveTo(28,10,32,16,32,20);g.bezierCurveTo(32,16,36,10,42,10);g.bezierCurveTo(58,10,60,36,32,56);g.fill();});
const hearts=[];for(let i=0;i<14;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:heartTex,transparent:true,depthWrite:false}));s.visible=false;s.scale.setScalar(0.25);scene.add(s);hearts.push({s,t:-1});}
let hI=0;function burstHearts(p,n=6){for(let k=0;k<n;k++){const h=hearts[hI++%hearts.length];h.t=-k*0.15;h.s.position.set(p.x+MR(-0.3,0.3),p.y+0.3,p.z+MR(-0.3,0.3));h.s.visible=true;h.vx=MR(-0.2,0.2);}}

// ============ 1. pets: dog, cat, parrot ============
const pets=[];
{ // golden dog napping by the towel
  const g=new THREE.Group(),c=std('#d8a657',0.85),d=std('#b98236',0.85);
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.3,14,10),c);body.scale.set(0.85,0.6,1.5);body.position.y=0.18;g.add(body);
  const head=new THREE.Group();head.position.set(0,0.22,-0.5);const hm=new THREE.Mesh(new THREE.SphereGeometry(0.15,12,10),c);hm.scale.set(1,0.95,1.1);head.add(hm);const sn=new THREE.Mesh(new THREE.SphereGeometry(0.08,10,8),c);sn.position.set(0,-0.03,-0.14);sn.scale.set(1,0.8,1.2);head.add(sn);
  const no=new THREE.Mesh(new THREE.SphereGeometry(0.025,8,6),std('#222'));no.position.set(0,-0.01,-0.24);head.add(no);for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6),d);e.scale.set(0.5,1.2,0.9);e.position.set(0.13*s,-0.03,0.02);head.add(e);const ey=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,4),std('#111'));ey.position.set(0.06*s,0.04,-0.12);head.add(ey);}g.add(head);
  for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.35,8),c);p.rotation.x=Math.PI/2;p.position.set(0.1*s,0.05,-0.5);g.add(p);}
  const tail=new THREE.Group();tail.position.set(0,0.2,0.42);const tm=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.02,0.4,6),c);tm.position.y=0.2;tail.add(tm);tail.rotation.x=1.2;g.add(tail);
  const x=13.6,z=SHORE(9)+22.2;g.position.set(x,H(x,z),z);g.rotation.y=0.4;scene.add(shadowAll(g));
  pets.push({name:'dog',g,head,tail,y:0.3,happy:0,onPet(){this.happy=5;tone(700,0.25,0.05,'sine',0,1100);tone(900,0.3,0.04,'sine',0.35,1300);toast('🐶 Il remue la queue et te tend la patte… le plus heureux des chiens !');}});
}
{ // cat on a beach-hut porch
  const g=new THREE.Group(),c=std('#9a8f86',0.8),s2=std('#efe7dc',0.8);
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.15,12,10),c);body.scale.set(1,1.15,1.35);body.position.y=0.15;g.add(body);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),s2);chest.position.set(0,0.17,-0.12);g.add(chest);
  const head=new THREE.Group();head.position.set(0,0.36,-0.1);const hm=new THREE.Mesh(new THREE.SphereGeometry(0.1,12,10),c);head.add(hm);for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.ConeGeometry(0.04,0.08,4),c);e.position.set(0.06*s,0.09,0);head.add(e);const ey=new THREE.Mesh(new THREE.SphereGeometry(0.016,6,4),std('#6b8e23',0.3));ey.position.set(0.04*s,0.02,-0.09);head.add(ey);}
  const no=new THREE.Mesh(new THREE.SphereGeometry(0.012,6,4),std('#e58a9a'));no.position.set(0,-0.01,-0.1);head.add(no);g.add(head);
  const tail=new THREE.Group();tail.position.set(0,0.06,0.18);const tm=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.018,0.38,6),c);tm.position.set(0.12,0,0.05);tm.rotation.z=Math.PI/2.4;tail.add(tm);g.add(tail);
  const x=-34.1,z=SHORE(-34.1)+26.1;g.position.set(x,H(x,z)+0.14,z);scene.add(shadowAll(g));
  pets.push({name:'cat',g,head,tail,y:0.4,happy:0,onPet(){this.happy=4;purr(4);toast('🐱 Rrrrrrr… il ferme les yeux et ronronne de bonheur.');}});
}
const PX=-70,PZ=SHORE(-70)+15;
{ // parrot on a perch near the bar
  const px=PX-2.6,pz=PZ-1.8,py=H(px,pz),g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,1.5,8),std('#8b5a33'));pole.position.set(px,py+0.75,pz);scene.add(pole);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.6,8),std('#8b5a33'));bar.rotation.z=Math.PI/2;bar.position.set(px,py+1.5,pz);scene.add(bar);
  const b=new THREE.Mesh(new THREE.SphereGeometry(0.1,12,10),std('#d62828',0.5));b.scale.set(1,1.5,1);b.position.y=0.15;g.add(b);
  const head=new THREE.Group();head.position.set(0,0.33,-0.02);head.add(new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),std('#d62828',0.5)));const bk=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.07,6),std('#f1e9d2'));bk.rotation.x=-Math.PI/2-0.6;bk.position.set(0,-0.01,-0.08);head.add(bk);for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,4),std('#fff'));e.position.set(0.05*s,0.02,-0.04);head.add(e);}g.add(head);
  for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6),std('#1d70b8',0.5));w.scale.set(0.35,1.3,0.9);w.position.set(0.09*s,0.13,0.02);g.add(w);}
  const tl=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.32,0.03),std('#f2c14e'));tl.position.set(0,-0.08,0.08);tl.rotation.x=0.3;g.add(tl);
  g.position.set(px,py+1.53,pz);scene.add(shadowAll(g));
  pets.push({name:'parrot',g,head,tail:null,y:0.35,happy:0,onPet(){this.happy=3;say(g,0.5,mpick(['Coucou ! Bonnes vacances ! Bonnes vacances !','Bonjour bonjour ! Tu es magnifique !','Coco ! Coco ! Ananas !']),1.9);}});
}

// ============ 2. coconuts on the sand + things you hold ============
const strawTex=canvasTex(8,64,(g)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#ffffff':'#e2574c';g.fillRect(0,i*8,8,8);}});
function coconut(){const g=new THREE.Group();const sh=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,12),std('#6b4a2b',0.9));sh.scale.set(1,1.05,1);g.add(sh);
  const husk=new THREE.Mesh(new THREE.SphereGeometry(0.132,16,8,0,Math.PI*2,Math.PI*0.62,Math.PI*0.38),std('#7c8f3b',0.8));g.add(husk);
  const top=new THREE.Mesh(new THREE.CircleGeometry(0.075,16).rotateX(-Math.PI/2),std('#f7f3e8',0.6));top.position.y=0.128;g.add(top);
  const st=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.34,8),new THREE.MeshStandardMaterial({map:strawTex}));st.position.set(0.02,0.25,0);st.rotation.z=-0.25;g.add(st);
  const um=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.05,10,1,true),new THREE.MeshStandardMaterial({color:mpick(['#f28cb1','#2ec4b6','#f2c14e']),side:THREE.DoubleSide}));um.position.set(-0.05,0.33,0.02);um.rotation.z=0.4;g.add(um);
  return shadowAll(g);}
function cocktail(){const g=new THREE.Group();const gl=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.04,0.18,18,1,true),new THREE.MeshStandardMaterial({color:'#ffffff',transparent:true,opacity:0.3,roughness:0.05,side:THREE.DoubleSide}));g.add(gl);
  const liq=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.038,0.14,16),new THREE.MeshStandardMaterial({color:'#ff8f5a',roughness:0.2,emissive:'#5a1a00'}));liq.position.y=-0.015;g.add(liq);
  const sl=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.01,16,1,false,0,Math.PI),std('#ffb703'));sl.rotation.set(Math.PI/2,0,0);sl.position.set(0.055,0.085,0);g.add(sl);
  const st=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.3,8),new THREE.MeshStandardMaterial({map:strawTex}));st.position.set(-0.02,0.15,0);st.rotation.z=0.2;g.add(st);
  const um=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.05,10,1,true),new THREE.MeshStandardMaterial({color:'#2ec4b6',side:THREE.DoubleSide}));um.position.set(0.03,0.2,0.02);um.rotation.z=-0.5;g.add(um);
  return g;}
const groundNuts=[];
function spawnNut(){const x=MR(-45,60),z=SHORE(x)+MR(19,30);if(Math.abs(x-9)<4)return spawnNut();const g=coconut();g.position.set(x,H(x,z)+0.11,z);g.rotation.set(MR(-0.2,0.2),MR(0,6),MR(-0.2,0.2));scene.add(g);groundNuts.push(g);}
for(let i=0;i<10;i++)spawnNut();
const holder=new THREE.Group();holder.position.set(0.24,-0.28,-0.62);camera.add(holder);
const hold={type:null,obj:null,sips:0,anim:0};
function take(type){if(hold.obj)holder.remove(hold.obj);hold.type=type;hold.sips=0;hold.obj=type==='coco'?coconut():cocktail();if(type==='coco')hold.obj.scale.setScalar(0.85);holder.add(hold.obj);hold.obj.traverse(m=>{if(m.isMesh){m.castShadow=false;}});
  toast(type==='coco'?'🥥 Une noix de coco bien fraîche ! <b>Clique</b> (ou touche <b>B</b>) pour boire à la paille.':'🍹 Ton cocktail de fruits ! <b>Clique</b> (ou <b>B</b>) pour boire.',5000);}
function sip(){if(!hold.type)return false;hold.anim=0.6;hold.sips++;slurp();
  if(hold.sips>=5){const t=hold.type;setTimeout(()=>{holder.remove(hold.obj);hold.obj=null;hold.type=null;toast(t==='coco'?'🥥 Mmm… frais, doux et sucré. Un vrai goût de vacances.':'🍹 Délicieux ! Mangue, ananas et passion… Santé ! ☀️');},700);}
  return true;}

// ============ 3. sunbeds + lying down + sun glare ============
const beds=[];
function sunbed(x,z,col){const g=new THREE.Group(),w=std('#c9a06a',0.7),cu=std(col,0.9);const y=H(x,z);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.06,1.4),w);fr.position.set(0,0.35,-0.25);g.add(fr);
  const cs=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.06,1.36),cu);cs.position.set(0,0.4,-0.25);g.add(cs);
  const bk=new THREE.Group();bk.position.set(0,0.38,0.45);const bm=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.06,0.75),cu);bm.position.z=0.37;bk.add(bm);bk.rotation.x=-0.75;g.add(bk);
  for(const [lx,lz] of [[-0.3,-0.85],[0.3,-0.85],[-0.3,0.4],[0.3,0.4]]){const l=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.35,0.05),w);l.position.set(lx,0.17,lz);g.add(l);}
  g.position.set(x,y,z);scene.add(shadowAll(g));beds.push({x,z,y});}
['#2e86ab','#f6f1e7','#e2574c','#f2c14e','#52b788'].forEach((c,i)=>sunbed(PX+5+i*2.4,PZ-4.5,c));
sunbed(-17,SHORE(-17)+22.5,'#f28cb1');sunbed(-14.6,SHORE(-14.6)+22.5,'#2e86ab');sunbed(17,SHORE(17)+22,'#f2c14e');sunbed(19.4,SHORE(19.4)+22,'#e2574c');
beds.push({x:7.7,z:SHORE(9)+24.2,y:H(7.7,SHORE(9)+24.2),chair:true});
const lie={on:false};
function lieDown(){if(lie.on){standUp();return;}let best=null,bd=22;for(const b of beds){const d=camDist(b.x,b.z);if(d<bd){bd=d;best=b;}}
  const cx=camera.position.x,cz=camera.position.z;
  if(best){goto(best.x,best.z-1.6,0);Object.assign(lie,{on:true,x:best.x,y:best.y+(best.chair?0.95:0.9),z:best.z+(best.chair?0.5:0.35),yaw:0,pitch:0.32});toast('😌 Installe-toi… Ferme les yeux, écoute les vagues. Le soleil te réchauffe le visage.<br><small>Bouge (ZQSD) ou appuie sur L pour te relever</small>',6000);}
  else{goto(cx,cz,camera.rotation.y);const gz=Math.max(cz,SHORE(cx)+3);Object.assign(lie,{on:true,x:cx,y:Math.max(H(cx,gz),0.2)+0.32,z:gz,yaw:camera.rotation.y,pitch:0.62});toast('🏖️ Allongé sur le sable chaud… regarde le ciel.<br><small>Bouge (ZQSD) ou appuie sur L pour te relever</small>',6000);}
  lie.wy=walker.yaw;lie.wp=walker.pitch;lie.t=0;setBtn('lie',true);}
function standUp(){lie.on=false;setBtn('lie',false);}
addEventListener('keydown',e=>{if(lie.on&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))standUp();});
const glare=document.createElement('div');glare.style.cssText='position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;z-index:1;transition:opacity .2s';document.body.appendChild(glare);
const lid=document.createElement('div');lid.style.cssText='position:fixed;inset:0;pointer-events:none;opacity:0;z-index:1;background:radial-gradient(ellipse at 50% 50%,rgba(255,140,60,0) 30%,rgba(120,30,10,.55) 100%)';document.body.appendChild(lid);

// ============ 4. waiter at the bar ============
const waiter=person({top:'#ffffff',bot:'#1d1d1d',bow:true,s:1});waiter.tray=true;
{const tray=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.015,20),std('#c0c0c0',0.3,{metalness:0.6}));tray.position.set(0.32,1.72,0.12);waiter.g.add(tray);const ck=cocktail();ck.position.set(0.32,1.82,0.12);waiter.g.add(ck);waiter.trayGlass=ck;waiter.arms[1].rotation.set(-0.3,0,-2.5);}
const HOME={x:PX+2.4,z:PZ-1.9};
const W={st:'idle',x:HOME.x,z:HOME.z,tx:HOME.x,tz:HOME.z,wait:2,ph:0};
function order(){if(W.st==='deliver'){toast('🍹 Le serveur arrive, patience…');return;}
  if(camDist(PX,PZ)>30){goto(PX+3,PZ-7.5,Math.atan2(-(PX-PX-3),-(PZ-PZ+7.5)));}
  W.st='deliver';W.trayGlass=true;waiter.trayGlass.visible=true;toast('🍹 Le serveur t\'a vu, il arrive avec un cocktail !');}

// ============ 5. beach volley ============
const CX=55,CZ=SHORE(55)+18,CY=H(CX,CZ);
{const g=new THREE.Group();for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,8),std('#f6f1e7'));p.position.set(0,1.3,4.6*s);g.add(p);}
  const net=new THREE.Mesh(new THREE.PlaneGeometry(9.2,0.9),new THREE.MeshStandardMaterial({map:canvasTex(256,32,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#222';c.lineWidth=1.5;for(let x=0;x<w;x+=6){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=6){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}c.fillStyle='#fff';c.fillRect(0,0,w,4);}),transparent:true,alphaTest:0.3,side:THREE.DoubleSide}));
  net.rotation.y=Math.PI/2;net.position.y=2.05;g.add(net);
  const lines=new THREE.Mesh(new THREE.RingGeometry(0,1,4),new THREE.MeshBasicMaterial({color:'#2e86ab'}));
  for(const [x,z,w,d] of [[0,4.6,16,0.06],[0,-4.6,16,0.06],[8,0,0.06,9.2],[-8,0,0.06,9.2]]){const l=new THREE.Mesh(new THREE.BoxGeometry(w,0.01,d),new THREE.MeshBasicMaterial({color:'#2e86ab'}));l.position.set(x,0.02,z);g.add(l);}
  g.position.set(CX,CY,CZ);scene.add(shadowAll(g));}
const vPlayers=[[-4,-2],[-5.5,2],[4,-2],[5.5,2]].map(([dx,dz],i)=>{const p=person({bare:i%2===0,cap:i===1?'#f2c14e':null});p.home=new THREE.Vector3(CX+dx,0,CZ+dz);p.pos=p.home.clone();p.team=dx<0?0:1;p.g.position.set(p.pos.x,H(p.pos.x,p.pos.z),p.pos.z);return p;});
const vball=new THREE.Mesh(new THREE.SphereGeometry(0.11,16,12),new THREE.MeshStandardMaterial({map:canvasTex(64,32,(g,w,h)=>{['#f2c14e','#1d70b8','#ffffff'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(i*w/3,0,w/3,h);});}),roughness:0.5}));vball.castShadow=true;scene.add(vball);
const shadowDisc=new THREE.Mesh(new THREE.CircleGeometry(0.18,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:0.25,depthWrite:false}));scene.add(shadowDisc);
const V={from:0,to:2,s:0,dur:1.6,a:new THREE.Vector3(),b:new THREE.Vector3(),joined:false,hit:false,miss:0,rally:0,best:0,userSide:1};
const USER={g:{position:camera.position},h:0,user:true};
function pend(p){return p.user?_w.set(camera.position.x,camera.position.y-0.2,camera.position.z).clone():new THREE.Vector3(p.pos.x,H(p.pos.x,p.pos.z)+2.2*p.s,p.pos.z);}
function receivers(team){const arr=vPlayers.filter(p=>p.team===team&&!(V.joined&&p===vPlayers[3]));if(V.joined&&team===1)arr.push(USER);return arr;}
function serve(fromP,toP){V.fromP=fromP;V.toP=toP;V.a.copy(pend(fromP));V.b.copy(pend(toP));if(!toP.user){V.b.x+=MR(-1,1);V.b.z+=MR(-1,1);}V.s=0;V.dur=toP.user?1.9:MR(1.4,1.8);V.hit=false;if(!fromP.user){fromP.armT=0.4;}pok(V.a.x,V.a.z);}
serve(vPlayers[0],vPlayers[2]);
function userHit(){if(!V.joined||!V.toP||!V.toP.user)return false;if(V.s>0.62&&V.s<1.18){V.hit=true;V.rally++;if(V.rally>V.best)V.best=V.rally;tone(880,0.12,0.05);
    toast(`🏐 Bien joué ! Échange n°${V.rally}${V.rally===V.best&&V.rally>2?' · record !':''}`,1800);if(V.rally%4===0)say(vPlayers[2].g,vPlayers[2].h+0.3,mpick(['Joli ! Quel talent !','Waouh, belle frappe !','Bravo, tu joues super bien !']),1.1);
    serve(USER,mpick(receivers(0)));}return true;}
function joinVolley(){if(V.joined){V.joined=false;setBtn('volley',false);toast('🏐 Merci pour la partie !');vPlayers[3].g.visible=true;return;}
  const h=vPlayers[3].home;goto(h.x,h.z,Math.PI/2);V.joined=true;vPlayers[3].g.visible=false;V.rally=0;setBtn('volley',true);
  toast('🏐 Tu joues ! Quand le ballon arrive vers toi, <b>clique</b> (ou <b>Espace</b>) pour le renvoyer.',6000);setTimeout(()=>say(vPlayers[2].g,vPlayers[2].h+0.3,'Super, un nouveau joueur ! À toi !',1.1),800);}

// ============ 6. a gull standing on the sand ============
const gullS=new THREE.Group();{const w=std('#f4f4f1',0.8);const b=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,10),w);b.scale.set(1,1,1.9);b.position.y=0.32;gullS.add(b);
  const wg=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8),std('#9aa3ab',0.8));wg.scale.set(1.1,0.7,1.8);wg.position.set(0,0.36,0.03);gullS.add(wg);
  const hd=new THREE.Group();hd.position.set(0,0.47,-0.16);hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),w));const bk=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.11,6),std('#f2b632'));bk.rotation.x=-Math.PI/2;bk.position.z=-0.1;hd.add(bk);gullS.add(hd);gullS.userData.hd=hd;
  for(const s of [-1,1]){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.22,5),std('#e0a040'));l.position.set(0.04*s,0.11,0);gullS.add(l);}
  const x=-3,z=SHORE(-3)+9.5;gullS.position.set(x,H(x,z),z);gullS.rotation.y=-0.6;scene.add(shadowAll(gullS));}
let gullAmb=3,gullSq=6,gullOpen=0;

// ============ activity buttons ============
const grid=document.querySelector('#act .grid');const btns={};
for(const [k,em,lbl,key,fn] of [['volley','🏐','Beach volley','V',joinVolley],['lie','😌',"S'allonger",'L',lieDown],['order','🍹','Commander','C',order]]){
  const b=document.createElement('button');b.innerHTML=`<span class="em">${em}</span><span>${lbl}</span><kbd>${key}</kbd>`;b.onclick=()=>{$('act').hidden=true;$('actBtn').classList.remove('on');fn();};grid.appendChild(b);btns[k]=b;}
function setBtn(k,on){btns[k]&&btns[k].classList.toggle('on',on);}
{const h=document.createElement('div');h.className='hint';h.style.cssText='font-size:12px;opacity:.7;margin:-6px 2px 12px';h.textContent='Astuce : caresse le chien, le chat et le perroquet en cliquant dessus. Ramasse une noix de coco sur le sable pour la boire à la paille.';grid.after(h);}
addEventListener('keydown',e=>{if(!state.started||e.repeat)return;if(e.code==='KeyV')joinVolley();else if(e.code==='KeyL')lieDown();else if(e.code==='KeyC')order();else if(e.code==='KeyB')sip();else if(e.code==='Space'){if(V.joined){userHit();e.preventDefault();}}});

// ============ clicks ============
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function near(r,p,tol){_v.copy(p).sub(r.origin);const t=_v.dot(r.direction);if(t<0)return 1e9;_v.addScaledVector(r.direction,-t);return _v.length()<Math.max(tol,t*0.05)?t:1e9;}
clickHooks.push(e=>{
  if(V.joined&&userHit())return;
  ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);const r=ray.ray;
  for(const p of pets){_w.copy(p.g.position);_w.y+=p.y*0.6;const t=near(r,_w,0.6);if(t<14){if(camDist(p.g.position.x,p.g.position.z)>5){toast('🐾 Approche-toi un peu pour le caresser…');return;}p.onPet();burstHearts(_w);return;}}
  for(let i=0;i<groundNuts.length;i++){const n=groundNuts[i],t=near(r,n.position,0.45);if(t<14){if(camDist(n.position.x,n.position.z)>6){toast('🥥 Approche-toi pour ramasser la noix de coco');return;}scene.remove(n);groundNuts.splice(i,1);take('coco');setTimeout(spawnNut,MR(40000,90000));return;}}
  _w.copy(waiter.g.position);_w.y+=1.2;if(near(r,_w,0.7)<20){order();return;}
  if(hold.type)sip();
});

// ============ per-frame ============
hooks.push((dt,time)=>{
  T=time;const d=day();
  // hearts
  for(const h of hearts){if(h.t===-1&&!h.s.visible)continue;h.t+=dt;if(h.t<0){h.s.visible=false;continue;}h.s.visible=true;h.s.position.y+=dt*0.6;h.s.position.x+=h.vx*dt;h.s.material.opacity=Math.max(0,1-h.t/1.6);h.s.scale.setScalar(0.22+h.t*0.1);if(h.t>1.6){h.s.visible=false;h.t=-1;}}
  // pets idle / happy
  for(const p of pets){p.happy=Math.max(0,p.happy-dt);const hp=p.happy>0;
    if(p.name==='dog'){p.tail.rotation.z=Math.sin(T*(hp?18:2))*(hp?0.9:0.15);p.head.rotation.x=hp?-0.35+Math.sin(T*6)*0.05:Math.sin(T*0.4)*0.04;}
    if(p.name==='cat'){p.tail.rotation.y=Math.sin(T*(hp?1.2:0.8))*0.5;p.head.rotation.z=hp?Math.sin(T*2)*0.15:0;p.head.rotation.x=hp?0.25:0;}
    if(p.name==='parrot'){p.head.rotation.y=Math.sin(T*(hp?7:0.7))*(hp?0.5:0.3);p.g.rotation.z=hp?Math.sin(T*9)*0.08:0;}}
  // held drink animation (lift to the mouth when sipping)
  if(hold.obj){hold.anim=Math.max(0,hold.anim-dt);const k=Math.sin(Math.min(1,hold.anim/0.6)*Math.PI);holder.position.set(0.24-0.2*k,-0.28+0.16*k,-0.62+0.18*k);holder.rotation.set(0.5*k,0,0.3*k);hold.obj.rotation.y=Math.sin(T*0.6)*0.1;}
  // lying down
  if(lie.on){lie.t+=dt;const br=Math.sin(T*0.55)*0.012;camera.position.set(lie.x,lie.y+br,lie.z);camera.rotation.set(clamp(lie.pitch+(walker.pitch-lie.wp)+Math.sin(T*0.13)*0.03,-0.4,1.4),lie.yaw+(walker.yaw-lie.wy)+Math.sin(T*0.07)*0.05,0.02);}
  // sun in the eyes (glare) + warm eyelids when lying
  {camera.getWorldDirection(_v);const align=_v.dot(sunDir),up=clamp((sunDir.y+0.05)*8,0,1)*clamp((d-0.2)/0.5,0,1);
    const I=Math.max(0,(align-0.8)/0.2)**1.6*up*(lie.on?1.25:0.75);
    if(I>0.01){_w.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera);const sx=(_w.x+1)/2*100,sy=(1-_w.y)/2*100;
      glare.style.background=`radial-gradient(circle at ${sx}% ${sy}%,rgba(255,252,235,${Math.min(1,I)}) 0,rgba(255,235,180,${I*0.75}) 7%,rgba(255,210,140,${I*0.35}) 22%,rgba(255,190,120,0) 55%),radial-gradient(circle at ${100-sx}% ${100-sy}%,rgba(180,220,255,${I*0.25}) 0,rgba(180,220,255,0) 6%),radial-gradient(circle at ${50+(50-sx)*0.4}% ${50+(50-sy)*0.4}%,rgba(255,200,240,${I*0.2}) 0,rgba(255,200,240,0) 4%)`;glare.style.opacity=1;}
    else glare.style.opacity=0;
    lid.style.opacity=lie.on?clamp((lie.t-6)/10,0,0.55)*up*(0.6+0.4*Math.sin(T*0.2)):0;}
  // waiter
  {waiter.g.visible=true;let tx=W.tx,tz=W.tz;
    if(W.st==='idle'){W.wait-=dt;if(W.wait<=0){const b=mpick(beds.slice(0,5));W.tx=b.x+MR(-0.8,0.8);W.tz=b.z-1.2;W.wait=MR(6,12);if(Math.random()<0.4){W.tx=HOME.x;W.tz=HOME.z;}}}
    else if(W.st==='deliver'){camera.getWorldDirection(_v);_v.y=0;_v.normalize();W.tx=camera.position.x+_v.x*1.3;W.tz=camera.position.z+_v.z*1.3;}
    else if(W.st==='return'){W.tx=HOME.x;W.tz=HOME.z;if(Math.hypot(W.x-HOME.x,W.z-HOME.z)<0.4){W.st='idle';W.wait=4;waiter.trayGlass.visible=true;}}
    const dx=W.tx-W.x,dz=W.tz-W.z,dd=Math.hypot(dx,dz),sp=W.st==='deliver'?2.3:1.2;
    if(dd>0.35){W.x+=dx/dd*sp*dt;W.z+=dz/dd*sp*dt;W.ph+=dt*sp*5;walkAnim(waiter,W.ph,0.5);waiter.g.rotation.y=Math.atan2(dx,dz);}
    else{walkAnim(waiter,0,0);if(W.st==='deliver'){W.st='return';waiter.g.rotation.y=Math.atan2(camera.position.x-W.x,camera.position.z-W.z);waiter.trayGlass.visible=false;take('cocktail');say(waiter.g,waiter.h+0.3,mpick(['Voilà votre cocktail maison, bonne dégustation !','Un cocktail mangue-passion pour vous, avec le sourire !','Et voici, bien frais ! Profitez du soleil.']),0.9);}}
    waiter.g.position.set(W.x,H(W.x,W.z),W.z);}
  // beach volley
  {const vis=d>0.3;vPlayers.forEach(p=>{if(!(V.joined&&p===vPlayers[3]))p.g.visible=vis;});vball.visible=shadowDisc.visible=vis;
    if(vis){V.s+=dt/V.dur;const s=Math.min(V.s,1.25);_w.copy(V.a).lerp(V.b,s);_w.y=V.a.y+(V.b.y-V.a.y)*s+5.2*4*s*(1-s);
      if(V.miss>0){V.miss-=dt;_w.copy(vball.position);_w.y=Math.max(H(_w.x,_w.z)+0.11,vball.position.y-dt*6);if(V.miss<=0)serve(vPlayers[0],mpick(receivers(1)));}
      vball.position.copy(_w);vball.rotation.x+=dt*5;shadowDisc.position.set(_w.x,H(_w.x,_w.z)+0.03,_w.z);
      if(V.toP&&!V.toP.user&&V.s>=1&&V.miss<=0){const nxt=mpick(receivers(1-V.toP.team));serve(V.toP,nxt);}
      if(V.toP&&V.toP.user&&V.s>1.2&&!V.hit&&V.miss<=0){V.miss=1.6;V.rally=0;toast('🏐 Raté ! Pas grave, on recommence 😄',2000);}
      if(V.joined&&camDist(CX,CZ)>16){V.joined=false;vPlayers[3].g.visible=true;setBtn('volley',false);}
      // players drift toward where the ball will land, arms up when hitting
      vPlayers.forEach(p=>{const tgt=(V.toP===p)?V.b:p.home;p.pos.x+=(tgt.x-p.pos.x)*Math.min(1,dt*1.5);p.pos.z+=(tgt.z-p.pos.z)*Math.min(1,dt*1.5);p.g.position.set(p.pos.x,H(p.pos.x,p.pos.z),p.pos.z);p.g.rotation.y=p.team===0?Math.PI/2:-Math.PI/2;
        const mv=Math.hypot(tgt.x-p.pos.x,tgt.z-p.pos.z)>0.3;walkAnim(p,T*8,mv?0.4:0);p.armT=Math.max(0,(p.armT||0)-dt);const up=p.armT>0||(V.toP===p&&V.s>0.8);p.arms.forEach(a=>a.rotation.x=up?-2.9:a.rotation.x);});}}
  // gulls: ambient chorus + standing gull
  if(AC&&AC.state==='running'&&d>0.3){gullAmb-=dt;if(gullAmb<=0){gullAmb=MR(3,8);gullCall(MR(-0.9,0.9),MR(0.15,0.55));}
    gullSq-=dt;if(gullSq<=0){gullSq=MR(9,20);const dd=camDist(gullS.position.x,gullS.position.z);if(dd<40){gullCall(camPan(gullS.position.x,gullS.position.z),clamp(8/(dd+3),0.2,1.3));gullOpen=0.9;}}}
  gullS.visible=d>0.3;gullOpen=Math.max(0,gullOpen-dt);gullS.userData.hd.rotation.x=gullOpen>0?-0.6:Math.sin(T*0.9)*0.1;gullS.userData.hd.rotation.y=Math.sin(T*0.5)*0.6;
  // speech bubble
  if(bubT>0){bubT-=dt;_w.copy(bubW.o.position);_w.y+=bubW.h+0.35;_w.project(camera);if(_w.z>1||bubT<=0){bub.classList.remove('show');}else{bub.style.left=((_w.x+1)/2*innerWidth)+'px';bub.style.top=((1-_w.y)/2*innerHeight)+'px';}}
});
