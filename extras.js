import * as THREE from 'three';
import {scene,camera,H,SHORE,clamp,smooth,env,WATER_U,vol,bus,AC,NB,noiseHit,env1,hooks,postHooks,clickHooks,drawHooks,ui,state,tip,$,isTouch,canvasTex,goto,setMoment,renderer,wake} from './app.js';

// ============ helpers ============
const MR=(a,b)=>a+(b-a)*Math.random();
const mpick=a=>a[Math.floor(Math.random()*a.length)];
const lvl=()=>WATER_U.uLevel.value;
const lit=()=>clamp((0.75-env.day)/0.35,0,1); // 0 = full day, 1 = dusk/night
let T=0;
const SAVE_KEY='evasion_carnet_v1';
const save={shells:{},bottles:0,read:[],bestSkip:0,wishes:0};
try{Object.assign(save,JSON.parse(localStorage.getItem(SAVE_KEY))||{})}catch(e){}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch(e){}}
const toastEl=$('toast');
function toast(html,ms=3600){toastEl.innerHTML=html;toastEl.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.classList.remove('show'),ms);}
function tone(freq,dur,v=0.05,type='sine',when=0,dest){if(!AC)return;const t=AC.currentTime+when,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=freq;o.connect(g).connect(dest||bus.nature);env1(g,t,0.008,v,dur);o.start(t);o.stop(t+dur+0.05);}
function chimeUp(n=3){[784,988,1175,1568,1976].slice(0,n).forEach((f,i)=>tone(f,0.9,0.045,'sine',i*0.09));}
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function rayFrom(e){ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);return ray.ray;}
const _v=new THREE.Vector3();
function rayPoint(r,p){_v.copy(p).sub(r.origin);const t=_v.dot(r.direction);if(t<0)return{d:1e9,t};_v.addScaledVector(r.direction,-t);return{d:_v.length(),t};}
function groundHit(r,maxD=14){for(let t=0.3;t<maxD;t+=0.06){const x=r.origin.x+r.direction.x*t,y=r.origin.y+r.direction.y*t,z=r.origin.z+r.direction.z*t,h=H(x,z);if(y<=h)return new THREE.Vector3(x,h,z);}return null;}
const camDist=(x,z)=>Math.hypot(x-camera.position.x,z-camera.position.z);
function camPan(x,z){const cy=camera.rotation.y,dx=x-camera.position.x,dz=z-camera.position.z,d=Math.hypot(dx,dz)||1;return clamp((dx*Math.cos(cy)-dz*Math.sin(cy))/d,-1,1);}
const std=(c,r=0.6,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function shadowAll(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o}

// ============ 1. collectible shells ============
const SPECIES=[
  {id:'cauri',name:'Porcelaine',rar:'commune',w:30,em:'🐚'},
  {id:'coque',name:'Coque',rar:'commune',w:30,em:'🐚'},
  {id:'stjacques',name:'Coquille Saint-Jacques',rar:'peu commune',w:16,em:'🐚'},
  {id:'conque',name:'Conque rose',rar:'rare',w:9,em:'🐚'},
  {id:'oursin',name:'Oursin violet',rar:'rare',w:8,em:'🟣'},
  {id:'nautile',name:'Nautile',rar:'très rare',w:4,em:'🌀'},
  {id:'perle',name:'Huître perlière',rar:'légendaire',w:2,em:'🦪'},
];
const nautTex=canvasTex(128,16,(g,w,h)=>{g.fillStyle='#f4ead8';g.fillRect(0,0,w,h);g.fillStyle='#b0683a';for(let i=0;i<10;i++){g.fillRect(i*13+2,0,5,h);}});
function shellMesh(id){
  const g=new THREE.Group();let m;
  switch(id){
    case 'cauri':m=new THREE.Mesh(new THREE.SphereGeometry(0.055,14,10),std('#f3e2c4',0.15));m.scale.set(1,0.55,1.5);m.position.y=0.02;g.add(m);
      m=new THREE.Mesh(new THREE.SphereGeometry(0.05,10,6),std('#a0663c',0.2));m.scale.set(0.6,0.32,1.3);m.position.y=0.035;g.add(m);break;
    case 'coque':m=new THREE.Mesh(new THREE.SphereGeometry(0.065,14,6,0,Math.PI*2,0,Math.PI/2),std('#e9c9a4',0.5));m.scale.set(1,0.55,0.9);g.add(m);break;
    case 'stjacques':m=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.02,14,1,false,-0.8,1.6),std('#f0a868',0.5));m.position.set(0,0.012,-0.06);g.add(m);
      m=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.018,0.03),std('#e08c4a',0.5));m.position.set(0,0.012,-0.065);g.add(m);break;
    case 'conque':m=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.22,12),std('#f4a7b0',0.35));m.rotation.z=Math.PI/2;m.position.y=0.05;g.add(m);
      m=new THREE.Mesh(new THREE.SphereGeometry(0.062,12,8),std('#fbd3c9',0.3));m.scale.set(0.6,0.8,0.9);m.position.set(-0.1,0.05,0);g.add(m);break;
    case 'oursin':{m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.05,1),std('#4b2a74',0.6));m.position.y=0.04;g.add(m);const sg=new THREE.ConeGeometry(0.006,0.07,4);sg.translate(0,0.035,0);const sm=std('#6b3fa0',0.5);const ico=new THREE.IcosahedronGeometry(1,0).attributes.position;
      for(let i=0;i<ico.count;i+=1){const d=new THREE.Vector3(ico.getX(i),ico.getY(i),ico.getZ(i)).normalize();if(d.y<-0.5)continue;const sp=new THREE.Mesh(sg,sm);sp.position.copy(d).multiplyScalar(0.045).add(new THREE.Vector3(0,0.04,0));sp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);g.add(sp);}break;}
    case 'nautile':m=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.032,10,24,Math.PI*1.75),new THREE.MeshStandardMaterial({map:nautTex,roughness:0.3}));m.position.y=0.08;g.add(m);break;
    case 'perle':m=new THREE.Mesh(new THREE.SphereGeometry(0.075,14,6,0,Math.PI*2,0,Math.PI/2),std('#7d8088',0.7));m.scale.set(1,0.4,0.8);m.rotation.x=Math.PI;m.position.y=0.03;g.add(m);
      m=new THREE.Mesh(new THREE.SphereGeometry(0.022,14,10),new THREE.MeshStandardMaterial({color:'#fffaf2',roughness:0.08,metalness:0.25,emissive:'#3a3630'}));m.position.y=0.035;g.add(m);break;
  }
  return shadowAll(g);
}
function weighted(){const tot=SPECIES.reduce((a,s)=>a+s.w,0);let r=Math.random()*tot;for(const s of SPECIES){if((r-=s.w)<0)return s;}return SPECIES[0]}
const shells=[];
function spawnShell(near){const sp=weighted(),g=shellMesh(sp.id);const x=near?MR(-35,35):MR(-130,130),z=SHORE(x)+MR(-0.5,17);
  g.position.set(x,H(x,z)+0.005,z);g.rotation.set(MR(-0.15,0.15),MR(0,6.28),MR(-0.15,0.15));g.scale.setScalar(1.5);scene.add(g);
  const s={sp,g,alive:true,anim:0,ph:Math.random()*6.28};shells.push(s);return s;}
for(let i=0;i<34;i++)spawnShell(i<10);
// glints (twinkling sparkles that make shells & the bottle visible)
const GL=40,glPos=new Float32Array(GL*3).fill(-999),glPh=new Float32Array(GL).map(()=>Math.random());
const glGeo=new THREE.BufferGeometry();glGeo.setAttribute('position',new THREE.BufferAttribute(glPos,3));glGeo.setAttribute('aPh',new THREE.BufferAttribute(glPh,1));
const glMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPR:{value:renderer.getPixelRatio()}},
  vertexShader:`attribute float aPh;uniform float uTime;uniform float uPR;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;float b=pow(max(0.0,sin(uTime*2.2+aPh*37.0)),12.0);vA=b;gl_PointSize=clamp((4.0+30.0*b)*uPR*(6.0/-mv.z),0.0,48.0);}`,
  fragmentShader:`varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c);float star=max(0.0,1.0-abs(c.x)*14.0)*max(0.0,1.0-abs(c.y)*2.2)+max(0.0,1.0-abs(c.y)*14.0)*max(0.0,1.0-abs(c.x)*2.2);float a=(smoothstep(0.5,0.0,d)*0.5+star)*vA;gl_FragColor=vec4(vec3(1.0,0.96,0.82)*a,a);}`});
const glints=new THREE.Points(glGeo,glMat);glints.frustumCulled=false;scene.add(glints);
function collect(s){
  s.alive=false;s.anim=0.0001;
  const first=!save.shells[s.sp.id];save.shells[s.sp.id]=(save.shells[s.sp.id]||0)+1;persist();
  const n=Object.keys(save.shells).length;
  toast(`${first?'✨ <b>Nouvelle espèce !</b><br>':''}${s.sp.em} <b>${s.sp.name}</b><span class="rar">${s.sp.rar}</span><br><small>${n}/${SPECIES.length} espèces dans ton carnet</small>`);
  chimeUp(first?5:2);renderCarnet();
  if(n===SPECIES.length&&first)setTimeout(()=>toast('🏆 <b>Collection complète !</b> Tu es un vrai chercheur de trésors.',5000),3800);
  setTimeout(()=>spawnShell(false),MR(25000,70000));
}

// ============ 2. message in a bottle ============
const MESSAGES=[
  ["Si tu lis ceci, c'est que la mer a décidé que tu méritais une pause. Respire.","Une inconnue de Marseille"],
  ["Le bonheur, c'est parfois juste le bruit des vagues et personne qui t'attend.","L."],
  ["J'ai jeté cette bouteille un jour de pluie. J'espère qu'elle arrive un jour de soleil.","Tom, 9 ans"],
  ["Tu as le droit de ne rien faire. Vraiment rien.","La mer"],
  ["Où que tu sois, quelqu'un pense à toi en ce moment.","Une grand-mère de Bretagne"],
  ["Enlève tes chaussures. Même si c'est dans ta tête.","Sam"],
  ["Les vagues reviennent toujours. Les beaux jours aussi.","Inès"],
  ["Ce soir, regarde le ciel. Je regarderai le même.","Un marin"],
  ["Le sable chaud, une glace qui coule sur les doigts, des rires au loin. Garde ça précieusement.","M."],
  ["Tu es plus courageux que tu ne le crois.","Quelqu'un qui est passé par là"],
  ["Ce matin j'ai trouvé une étoile de mer et je l'ai remise à l'eau. Fais pareil avec tes soucis.","Jade"],
  ["Les vacances, ce n'est pas un endroit. C'est un moment où l'on s'autorise à être bien.","Paul"],
  ["Écris ton prénom dans le sable et regarde la mer l'emporter. Ça soulage.","Nora"],
  ["Ici, il n'y a pas d'heure. Juste la lumière qui change.","Le gardien du phare"],
  ["Merci d'exister.","Une mouette (oui, je sais écrire)"],
  ["Ferme les yeux trois secondes. Tu entends ? C'est pour toi.","Léo"],
  ["Un jour tu verras la vraie mer. En attendant, celle-ci t'attend.","Évasion"],
  ["Prends soin de toi comme tu prendrais soin d'un coquillage rare.","Chloé"],
  ["Ce n'est pas grave d'aller lentement. La marée aussi prend son temps.","Yanis"],
  ["Souris à la prochaine personne que tu croises. C'est contagieux, comme le soleil.","Fatou"],
];
const glassM=new THREE.MeshStandardMaterial({color:'#6fae8a',roughness:0.05,metalness:0.1,transparent:true,opacity:0.55});
const bottle=new THREE.Group();
{const b=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.065,0.22,16),glassM);bottle.add(b);
 const sh=new THREE.Mesh(new THREE.SphereGeometry(0.06,16,8,0,Math.PI*2,0,Math.PI/2),glassM);sh.position.y=0.11;bottle.add(sh);
 const nk=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.03,0.09,12),glassM);nk.position.y=0.19;bottle.add(nk);
 const ck=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.018,0.04,10),std('#9b7148',0.9));ck.position.y=0.245;bottle.add(ck);
 const pp=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.16,12),std('#f1e6c8',0.9));bottle.add(pp);
 const rb=new THREE.Mesh(new THREE.TorusGeometry(0.031,0.006,6,16),std('#c0392b',0.6));rb.rotation.x=Math.PI/2;bottle.add(rb);}
bottle.visible=false;scene.add(bottle);
const B={st:'wait',timer:22,x:0,z0:0,z1:0,p:0};
function readBottle(){
  B.st='wait';B.timer=MR(70,140);bottle.visible=false;
  const unread=MESSAGES.map((m,i)=>i).filter(i=>!save.read.includes(i));const i=unread.length?mpick(unread):Math.floor(Math.random()*MESSAGES.length);
  if(!save.read.includes(i))save.read.push(i);save.bottles++;persist();renderCarnet();
  $('letterTxt').textContent='« '+MESSAGES[i][0]+' »';$('letterSig').textContent='— '+MESSAGES[i][1];$('letter').hidden=false;
  if(AC){noiseHit(bus.nature,3500,0.6,0.08,0.01,0.25);tone(523,1.2,0.035,'sine',0.15);tone(659,1.2,0.03,'sine',0.3);}
}
$('letterOk').onclick=()=>{$('letter').hidden=true;};

// ============ 3. skipping stones ============
const stone=new THREE.Mesh(new THREE.SphereGeometry(0.05,10,6),std('#8d8a85',0.6));stone.scale.set(1,0.35,1);stone.visible=false;stone.castShadow=true;scene.add(stone);
const S={on:false,p:new THREE.Vector3(),v:new THREE.Vector3(),b:0};
const ripples=[];const ringG=new THREE.RingGeometry(0.85,1,40).rotateX(-Math.PI/2);
for(let i=0;i<24;i++){const m=new THREE.Mesh(ringG,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));m.visible=false;m.renderOrder=3;scene.add(m);ripples.push({m,t:-1,s:1});}
let ripI=0;
function ripple(x,z,s){const r=ripples[ripI++%ripples.length];r.t=0;r.s=s;r.m.position.set(x,lvl()+0.04,z);r.m.visible=true;}
function throwStone(){
  if(S.on)return;
  const f0=new THREE.Vector3();camera.getWorldDirection(f0);f0.y=0;f0.normalize();
  // aim at the sea: the closest direction to where we look that reaches water quickly
  let f=null,dw=-1,best=1e9;
  for(let k=0;k<=24;k++){const a=(k%2?1:-1)*Math.ceil(k/2)*0.1,c=Math.cos(a),sn=Math.sin(a),fx=f0.x*c-f0.z*sn,fz=f0.x*sn+f0.z*c;
    for(let d=0;d<45;d+=0.5){const x=camera.position.x+fx*d,z=camera.position.z+fz*d;if(H(x,z)<lvl()-0.08){const score=d+Math.abs(a)*25;if(score<best){best=score;dw=d;f=new THREE.Vector3(fx,0,fz);}break;}}}
  if(!f){toast('🌊 Approche-toi de la mer pour lancer un galet');return;}
  const hs=MR(15,19),t1=(dw+MR(2,5))/hs,y0=camera.position.y-0.35,g0=lvl();
  S.p.copy(camera.position).addScaledVector(f,0.5);S.p.y=y0;
  S.v.copy(f).multiplyScalar(hs);S.v.y=(0.5*9.8*t1*t1-(y0-g0))/t1;S.b=0;S.on=true;stone.visible=true;
  if(AC)noiseHit(bus.nature,2200,0.8,0.06,0.005,0.1,0);
}
function endStone(sank){
  S.on=false;stone.visible=false;
  if(S.b>0){const rec=S.b>save.bestSkip;if(rec){save.bestSkip=S.b;persist();renderCarnet();}
    toast(`🪨 <b>${S.b} ricochet${S.b>1?'s':''} !</b>${rec?' 🏆 Nouveau record !':`<br><small>Record : ${save.bestSkip}</small>`}`);}
  else toast(sank?'🪨 Plouf ! Lance plus à plat…':'🪨 Le galet est tombé sur le sable');
}

// ============ 4. writing in the sand ============
const MAXM=6000,markMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(0.045,8).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#8c7757',roughness:1}),MAXM);
const zero=new THREE.Matrix4().makeScale(0,0,0),mo=new THREE.Object3D();
for(let i=0;i<MAXM;i++)markMesh.setMatrixAt(i,zero);
markMesh.frustumCulled=false;markMesh.receiveShadow=true;scene.add(markMesh);
const marks=new Array(MAXM).fill(null);let mI=0,lastP=null,lastScratch=0,eraseI=0;
function addMark(x,z){mo.position.set(x,H(x,z)+0.012,z);mo.rotation.set(0,Math.random()*6,0);mo.scale.setScalar(MR(0.85,1.2));mo.updateMatrix();markMesh.setMatrixAt(mI,mo.matrix);marks[mI]={x,z};mI=(mI+1)%MAXM;}
drawHooks.push(e=>{
  if(!e){lastP=null;return;}
  const p=groundHit(rayFrom(e),14);
  if(!p||p.y<lvl()-0.02){lastP=null;return;}
  if(lastP){const d=lastP.distanceTo(p);if(d<0.03)return;if(d>1.5){lastP=p;addMark(p.x,p.z);}else{const n=Math.ceil(d/0.035);for(let i=1;i<=n;i++)addMark(lastP.x+(p.x-lastP.x)*i/n,lastP.z+(p.z-lastP.z)*i/n);}}
  else addMark(p.x,p.z);
  lastP=p;markMesh.instanceMatrix.needsUpdate=true;
  const now=performance.now();if(AC&&now-lastScratch>70){lastScratch=now;noiseHit(bus.nature,MR(3000,4500),1.2,0.035,0.005,0.07,camPan(p.x,p.z)*0.5);}
});
function setWrite(on){ui.writeMode=on;document.body.classList.toggle('writing',on);document.querySelectorAll('[data-a="write"]').forEach(b=>b.classList.toggle('on',on));
  if(on)tip(isTouch?'✍️ Dessine dans le sable avec ton doigt. Les vagues effaceront tout…':'✍️ Clique et glisse sur le sable pour écrire. Les vagues effaceront tout… (E pour arrêter)',6000);}

// ============ 5. campfire ============
const FX=-22,FZ=SHORE(-22)+11,FY=H(FX,FZ);
{const g=new THREE.Group();g.position.set(FX,FY,FZ);
 for(let i=0;i<10;i++){const a=i/10*6.283,st=new THREE.Mesh(new THREE.DodecahedronGeometry(MR(0.1,0.15),0),std('#77736d',0.9));st.position.set(Math.cos(a)*0.62,0.05,Math.sin(a)*0.62);st.rotation.set(MR(0,3),MR(0,3),0);g.add(st);}
 for(let i=0;i<4;i++){const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.95,8),std('#5a3a22',0.95));lg.rotation.set(0,i*0.8,1.1);lg.position.y=0.13;const pv=new THREE.Group();pv.rotation.y=i*1.57;pv.add(lg);g.add(pv);}
 const ash=new THREE.Mesh(new THREE.CircleGeometry(0.5,16).rotateX(-Math.PI/2),std('#2e2a27',1));ash.position.y=0.015;g.add(ash);
 // driftwood logs to sit on
 for(const [dx,dz,r] of [[2.2,0.4,0.3],[-0.6,2.1,1.7]]){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.18,2.2,10),std('#a08566',0.9));l.rotation.set(0,r,Math.PI/2);l.position.set(dx,0.14,dz);g.add(l);}
 scene.add(shadowAll(g));}
const FP=110,fPos=new Float32Array(FP*3),fLife=new Float32Array(FP),fVel=new Float32Array(FP*3),fMax=new Float32Array(FP),fEmb=new Float32Array(FP);
for(let i=0;i<FP;i++){fLife[i]=Math.random();fMax[i]=1;fEmb[i]=Math.random()<0.2?1:0;}
const fGeo=new THREE.BufferGeometry();fGeo.setAttribute('position',new THREE.BufferAttribute(fPos,3));fGeo.setAttribute('aLife',new THREE.BufferAttribute(fLife,1));fGeo.setAttribute('aEmb',new THREE.BufferAttribute(fEmb,1));
const fMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPR:{value:renderer.getPixelRatio()},uVis:{value:0}},
  vertexShader:`attribute float aLife;attribute float aEmb;uniform float uPR;varying float vL;varying float vE;void main(){vL=aLife;vE=aEmb;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;float s=aEmb>0.5?3.0:mix(26.0,6.0,aLife);gl_PointSize=clamp(s*uPR*(3.0/-mv.z),1.0,90.0);}`,
  fragmentShader:`uniform float uVis;varying float vL;varying float vE;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,d);vec3 c=vE>0.5?vec3(1.0,0.75,0.35):mix(vec3(1.0,0.85,0.45),vec3(0.9,0.25,0.05),vL);a*=(1.0-vL)*uVis*(vE>0.5?1.4:0.55);gl_FragColor=vec4(c*a,a);}`});
const fire=new THREE.Points(fGeo,fMat);fire.frustumCulled=false;scene.add(fire);
const fireLight=new THREE.PointLight('#ff8a3c',0,22,1.6);fireLight.position.set(FX,FY+0.9,FZ);scene.add(fireLight);
let fireSnd=null;

// ============ 6. shooting stars ============
const ssGeo=new THREE.BufferGeometry();ssGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));ssGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array([1,1,1,0,0,0]),3));
const ssMat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const sstar=new THREE.Line(ssGeo,ssMat);sstar.frustumCulled=false;scene.add(sstar);
const SS={t:-1,timer:6,p0:new THREE.Vector3(),d:new THREE.Vector3(),seen:false};

// ============ 7. kites ============
const kites=[];
const KCOL=[['#e2574c','#f2c14e'],['#2e86ab','#f6f1e7'],['#8e44ad','#f5a3c7']];
for(let k=0;k<3;k++){
  const g=new THREE.Group();
  const half=(pts,c)=>{const s=new THREE.Shape();s.moveTo(...pts[0]);pts.slice(1).forEach(p=>s.lineTo(...p));return new THREE.Mesh(new THREE.ShapeGeometry(s),new THREE.MeshStandardMaterial({color:c,side:THREE.DoubleSide,roughness:0.7}))};
  g.add(half([[0,0.8],[0.5,0.1],[0,-0.6]],KCOL[k][0]),half([[0,0.8],[-0.5,0.1],[0,-0.6]],KCOL[k][1]));
  const tailG=new THREE.BufferGeometry();tailG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(16*3),3));
  const tail=new THREE.Line(tailG,new THREE.LineBasicMaterial({color:KCOL[k][0]}));tail.frustumCulled=false;
  const strG=new THREE.BufferGeometry();strG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const str=new THREE.Line(strG,new THREE.LineBasicMaterial({color:'#f6f1e7',transparent:true,opacity:0.6}));str.frustumCulled=false;
  scene.add(g,tail,str);
  const ax=-48+k*16,az=SHORE(ax)+MR(20,28);
  kites.push({g,tail,str,anchor:new THREE.Vector3(ax,H(ax,az)+1.1,az),ph:MR(0,6),h:20+k*5});
}

// ============ 8. beach bar (paillote) + hammock + string lights ============
const PX=-70,PZ=SHORE(-70)+15,PY=H(PX,PZ);
const bulbs=[];
{
  const g=new THREE.Group();g.position.set(PX,PY,PZ);
  const bamboo=std('#c9a46a',0.7),wood=std('#8b5a33',0.8),straw=new THREE.MeshStandardMaterial({color:'#d4b36a',roughness:1,flatShading:true});
  for(const [x,z] of [[-1.4,-1.2],[1.4,-1.2],[-1.4,1.2],[1.4,1.2]]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.08,2.9,8),bamboo);p.position.set(x,1.45,z);g.add(p);}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(2.7,1.4,12),straw);roof.position.y=3.45;g.add(roof);
  const fringe=new THREE.Mesh(new THREE.CylinderGeometry(2.62,2.72,0.4,12,1,true),new THREE.MeshStandardMaterial({color:'#c29d55',roughness:1,side:THREE.DoubleSide,flatShading:true}));fringe.position.y=2.65;g.add(fringe);
  const counter=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.05,0.6),wood);counter.position.set(0,0.52,-0.95);g.add(counter);
  const top=new THREE.Mesh(new THREE.BoxGeometry(2.85,0.07,0.78),std('#a8744a',0.6));top.position.set(0,1.08,-0.95);g.add(top);
  for(let i=0;i<3;i++){const st=new THREE.Group();st.position.set(-0.9+i*0.9,0,-1.65);const seat=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.07,14),std('#e2574c',0.6));seat.position.y=0.78;const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.05,0.76,8),bamboo);leg.position.y=0.38;st.add(seat,leg);g.add(st);}
  const cols=['#e2574c','#f2c14e','#2ec4b6','#ff9f1c','#9b5de5','#f15bb5'];
  for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.24,10),new THREE.MeshStandardMaterial({color:mpick(cols),roughness:0.15,transparent:true,opacity:0.85}));b.position.set(-1.0+i*0.25,1.24,-0.8);g.add(b);}
  for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.04,0.16,10),new THREE.MeshStandardMaterial({color:mpick(['#ff9f1c','#f15bb5','#2ec4b6']),roughness:0.2,transparent:true,opacity:0.9}));c.position.set(-0.6+i*0.6,1.2,-1.15);const straw2=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.2,5),std('#ffffff',0.5));straw2.position.set(0.02,0.12,0);straw2.rotation.z=0.3;c.add(straw2);g.add(c);}
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.9,0.5),new THREE.MeshStandardMaterial({map:canvasTex(380,100,(c,w,h)=>{c.fillStyle='#6b4226';c.fillRect(0,0,w,h);c.strokeStyle='#4a2c18';c.lineWidth=6;c.strokeRect(3,3,w-6,h-6);c.fillStyle='#fbe9c6';c.font='700 58px Caveat, cursive';c.textAlign='center';c.textBaseline='middle';c.fillText('Chez Évasion 🍹',w/2,h/2+3);}),roughness:0.9}));
  sign.position.set(0,2.45,-1.25);sign.rotation.y=Math.PI;g.add(sign);
  g.rotation.y=Math.PI;scene.add(shadowAll(g));
  // posts + garlands
  const ends=[[PX-7.5,PZ-3.5],[PX+6.5,PZ-4.5]];const pts=[];
  for(const [ex,ez] of ends){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,3,8),bamboo);p.position.set(ex,H(ex,ez)+1.5,ez);p.castShadow=true;scene.add(p);}
  const corners=[new THREE.Vector3(PX+1.4,PY+2.75,PZ+1.2),new THREE.Vector3(PX-1.4,PY+2.75,PZ+1.2)];
  const ends3=ends.map(([ex,ez])=>new THREE.Vector3(ex,H(ex,ez)+2.9,ez));
  for(let s=0;s<2;s++){const a=s===0?corners[1]:corners[0],b=ends3[s];for(let i=0;i<=24;i++){const u=i/24,p=a.clone().lerp(b,u);p.y-=0.7*4*u*(1-u);pts.push(p);}}
  const front=[new THREE.Vector3(PX-1.4,PY+2.75,PZ+1.2),new THREE.Vector3(PX+1.4,PY+2.75,PZ+1.2)];
  for(let i=0;i<=10;i++){const u=i/10,p=front[0].clone().lerp(front[1],u);p.y-=0.35*4*u*(1-u);pts.push(p);}
  const bm=new THREE.InstancedMesh(new THREE.SphereGeometry(0.065,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),pts.length),c=new THREE.Color(),o=new THREE.Object3D();
  const BC=['#ffd166','#ff9f1c','#f15bb5','#2ec4b6','#fff1c1'];
  pts.forEach((p,i)=>{o.position.copy(p);o.updateMatrix();bm.setMatrixAt(i,o.matrix);bm.setColorAt(i,c.set(BC[i%BC.length]));});
  scene.add(bm);bulbs.push(bm);
  // hammock between two palms-ish posts
  const h1=new THREE.Vector3(PX+5,0,PZ+5.5),h2=new THREE.Vector3(PX+8.6,0,PZ+3.8);
  for(const h of [h1,h2]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,2.2,8),std('#8a6e4b',0.9));p.position.set(h.x,H(h.x,h.z)+1.1,h.z);p.castShadow=true;scene.add(p);}
  const len=h1.distanceTo(h2),hg=new THREE.PlaneGeometry(len,0.95,20,6),hp=hg.attributes.position;
  for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),u=x/len+0.5;hp.setXYZ(i,x,-0.75*4*u*(1-u)+(y*y)*0.35*Math.sin(Math.PI*u),y);}hg.computeVertexNormals();
  const hm=new THREE.Mesh(hg,new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:0.9,map:canvasTex(256,32,(c,w,h)=>{const cs=['#2e86ab','#f6f1e7','#e2574c','#f2c14e'];for(let i=0;i<16;i++){c.fillStyle=cs[i%4];c.fillRect(i*16,0,16,h);}})}));
  const mid=h1.clone().lerp(h2,0.5);hm.position.set(mid.x,Math.max(H(h1.x,h1.z),H(h2.x,h2.z))+1.55,mid.z);hm.rotation.y=-Math.atan2(h2.z-h1.z,h2.x-h1.x);hm.castShadow=true;scene.add(hm);
  var hammock=hm;
}
const barLight=new THREE.PointLight('#ffb36b',0,16,1.8);barLight.position.set(PX,PY+2.4,PZ);scene.add(barLight);
// --- guitar (Karplus-Strong) at the bar
const ksCache={};
function ks(f){const k=f.toFixed(2);if(ksCache[k])return ksCache[k];const sr=AC.sampleRate,N=Math.max(2,Math.round(sr/f)),len=Math.floor(sr*2.4),buf=AC.createBuffer(1,len,sr),d=buf.getChannelData(0),ring=new Float32Array(N);
  let pv=0;for(let i=0;i<N;i++){pv=pv*0.55+(Math.random()*2-1)*0.45;ring[i]=pv;}let idx=0;for(let i=0;i<len;i++){const nx=(idx+1)%N,v=(ring[idx]+ring[nx])*0.5*0.996;d[i]=ring[idx];ring[idx]=v;idx=nx;}return ksCache[k]=buf;}
const PROG=[[261.63,329.63,392.0],[220.0,261.63,329.63],[174.61,220.0,261.63],[196.0,246.94,293.66]],BASS=[130.81,110.0,87.31,98.0],MEL=[523.25,587.33,659.25,783.99,880.0];
let gNext=0,gStep=0;
function pluck(f,t,g,pan){const s=AC.createBufferSource();s.buffer=ks(f);const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2400;const gn=AC.createGain();gn.gain.value=g;const p=AC.createStereoPanner();p.pan.value=pan;s.connect(lp).connect(gn).connect(p).connect(bus.paillote);s.start(t);s.stop(t+2.4);}

// ============ 9. postcard ============
let photoReq=false;
const MLABEL={matin:'un matin doux',jour:'en plein soleil',coucher:'au coucher du soleil',nuit:'sous les étoiles'};
postHooks.push(()=>{
  if(!photoReq)return;photoReq=false;
  const url=renderer.domElement.toDataURL('image/jpeg',0.92),img=new Image();
  img.onload=()=>{const W=1600,ih=Math.round(W*img.height/img.width),pad=44,bot=160,c=document.createElement('canvas');c.width=W+pad*2;c.height=ih+pad+bot;const g=c.getContext('2d');
    g.fillStyle='#fbf7ef';g.fillRect(0,0,c.width,c.height);g.drawImage(img,pad,pad,W,ih);
    g.fillStyle='#2b3550';g.font='700 72px Caveat, cursive';g.textBaseline='middle';g.fillText("Bons baisers d'Évasion ☀️",pad+6,ih+pad+bot/2);
    g.font='42px Caveat, cursive';g.fillStyle='#7a6f62';g.textAlign='right';const d=new Date();g.fillText(d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' · '+(MLABEL[state.moment]||''),c.width-pad,ih+pad+bot/2+6);
    c.toBlob(b=>{if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='carte-postale-evasion.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),8000);},'image/jpeg',0.92);};
  img.src=url;
  const fl=$('flash');fl.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>fl.classList.remove('on')));
  if(AC){noiseHit(bus.nature,4000,0.7,0.12,0.002,0.05);setTimeout(()=>noiseHit(bus.nature,2500,0.7,0.08,0.002,0.08),90);}
  toast('📸 Carte postale enregistrée !');
});

// ============ activities panel & carnet ============
function renderCarnet(){
  const sh=SPECIES.map(s=>{const n=save.shells[s.id]||0;return n?`<div class="sh">${s.em} <b>${s.name}</b><span class="r">${s.rar} · ×${n}</span></div>`:`<div class="sh no">❔ <b>???</b><span class="r">${s.rar}</span></div>`}).join('');
  const total=Object.values(save.shells).reduce((a,b)=>a+b,0);
  $('carnet').innerHTML=`<div class="shells">${sh}</div><div class="stats"><span>🐚 ${total} ramassé${total>1?'s':''}</span><span>🍾 ${save.bottles} bouteille${save.bottles>1?'s':''}</span><span>🪨 Record : ${save.bestSkip} ricochet${save.bestSkip>1?'s':''}</span><span>🌠 ${save.wishes} vœu${save.wishes>1?'x':''}</span></div>
  <div class="hint">Astuce : les coquillages scintillent sur le sable. Clique dessus pour les ramasser. Une bouteille arrive parfois avec la marée…</div>`;
}
renderCarnet();
function closeAct(){$('act').hidden=true;$('actBtn').classList.remove('on');}
$('actBtn').onclick=()=>{const a=$('act');a.hidden=!a.hidden;$('actBtn').classList.toggle('on',!a.hidden);if(!a.hidden){$('panel').hidden=true;$('soundBtn').classList.remove('on');}};
$('soundBtn').addEventListener('click',()=>closeAct());
function faceTo(x,z,tx,tz){return Math.atan2(-(tx-x),-(tz-z));}
const ACTIONS={
  skip:()=>{closeAct();throwStone();},
  write:()=>{setWrite(!ui.writeMode);if(ui.writeMode)closeAct();},
  photo:()=>{closeAct();setTimeout(()=>{photoReq=true;},250);},
  swim:()=>{closeAct();const x=clamp(camera.position.x,-60,60),z=SHORE(x)-32;goto(x,z,0);},
  bar:()=>{closeAct();const x=PX+1,z=PZ-6;goto(x,z,faceTo(x,z,PX,PZ));if(state.moment==='nuit'||state.moment==='coucher')toast('🍹 Bienvenue Chez Évasion ! Un cocktail sans alcool ?');else toast('🎸 Approche-toi, quelqu\'un joue de la guitare…');},
  fire:()=>{closeAct();if(state.moment!=='nuit')setMoment('nuit');const x=FX+1.6,z=FZ+3.8;goto(x,z,faceTo(x,z,FX,FZ));toast('🔥 Installe-toi près du feu. Lève les yeux, les étoiles filent…',5000);},
};
document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>ACTIONS[b.dataset.a]());
addEventListener('keydown',e=>{if(!state.started||e.repeat)return;if(e.code==='KeyR')ACTIONS.skip();else if(e.code==='KeyE')ACTIONS.write();else if(e.code==='KeyP')ACTIONS.photo();else if(e.code==='Escape'){if(ui.writeMode)setWrite(false);closeAct();$('letter').hidden=true;}});
for(const id of ['goCalm','goWalk'])$(id).addEventListener('click',()=>setTimeout(()=>toast('🎒 Ouvre <b>Activités</b> : coquillages, ricochets, paillote, feu de camp…',6500),4000));

// ============ clicks ============
clickHooks.push(e=>{
  const r=rayFrom(e);
  if(B.st==='beach'||B.st==='float'){const p=bottle.position;const {d,t}=rayPoint(r,p);if(t<18&&d<Math.max(0.45,t*0.06)){if(B.st==='beach')readBottle();else toast('🍾 Elle flotte encore… attends qu\'elle arrive sur le sable');return;}}
  let best=null,bt=1e9;
  for(const s of shells){if(!s.alive)continue;_v.copy(s.g.position);_v.y+=0.05;const {d,t}=rayPoint(r,_v.clone());if(t<18&&d<Math.max(0.35,t*0.055)&&t<bt){bt=t;best=s;}}
  if(best)collect(best);
});

// ============ per-frame update ============
let hintShown=false;
hooks.push((dt,time)=>{
  T=time;glMat.uniforms.uTime.value=T;
  const L=lit();
  // shells + glints
  let gi=0;
  for(let i=shells.length-1;i>=0;i--){const s=shells[i];
    if(s.anim>0){s.anim+=dt;s.g.position.y+=dt*1.4;s.g.rotation.y+=dt*8;s.g.scale.setScalar(1.5*Math.max(0,1-s.anim/0.6));if(s.anim>0.6){scene.remove(s.g);shells.splice(i,1);}continue;}
    if(gi<GL-1){glPos[gi*3]=s.g.position.x;glPos[gi*3+1]=s.g.position.y+0.08;glPos[gi*3+2]=s.g.position.z;gi++;}
    if(!hintShown&&state.mode==='walk'&&camDist(s.g.position.x,s.g.position.z)<3){hintShown=true;toast('✨ Un coquillage brille à tes pieds… clique dessus !');}}
  if(bottle.visible){glPos[gi*3]=bottle.position.x;glPos[gi*3+1]=bottle.position.y+0.1;glPos[gi*3+2]=bottle.position.z;gi++;}
  for(let i=gi;i<GL;i++)glPos[i*3+1]=-999;
  glGeo.attributes.position.needsUpdate=true;
  // bottle
  if(B.st==='wait'){B.timer-=dt;if(B.timer<=0&&state.started){B.x=clamp(camera.position.x+MR(-25,25),-110,110);B.z0=SHORE(B.x)-40;B.z1=SHORE(B.x)+7.5;B.p=0;B.st='float';bottle.visible=true;}}
  else if(B.st==='float'){B.p=Math.min(1,B.p+dt/40);const z=B.z0+(B.z1-B.z0)*(1-Math.pow(1-B.p,1.6)),x=B.x+Math.sin(T*0.3)*0.6,g=H(x,z),w=lvl()+0.03+Math.sin(T*2.1)*0.05;
    bottle.position.set(x,Math.max(w,g+0.06),z);bottle.rotation.set(Math.sin(T*1.7)*0.2,0.4,Math.PI/2+Math.sin(T*1.3)*0.25);
    if(B.p>=1){B.st='beach';bottle.position.y=H(x,z)+0.06;bottle.rotation.set(0,0.4,Math.PI/2);toast('🍾 Une bouteille vient de s\'échouer sur la plage… va la ramasser !',5000);if(AC)noiseHit(bus.nature,1800,0.8,0.05,0.01,0.2,camPan(x,z));}}
  // stone
  if(S.on){S.v.y-=9.8*dt;S.p.addScaledVector(S.v,dt);stone.position.copy(S.p);stone.rotation.y+=dt*30;const g=H(S.p.x,S.p.z),Lv=lvl();
    if(S.p.y<=g){endStone(false);}
    else if(S.p.y<=Lv&&g<Lv-0.05){const hs=Math.hypot(S.v.x,S.v.z);
      if(S.v.y<0&&hs>4.2&&-S.v.y/hs<(S.b===0?0.75:0.55)&&S.b<25){S.b++;S.v.y=-S.v.y*MR(0.5,0.68)+0.5;const k=MR(0.8,0.88);S.v.x*=k;S.v.z*=k;S.p.y=Lv+0.01;ripple(S.p.x,S.p.z,MR(0.6,1));
        if(AC){const dist=camDist(S.p.x,S.p.z),gn=1/(1+dist*0.04);tone(650+S.b*85,0.16,0.07*gn,'sine');noiseHit(bus.nature,3200,1.4,0.08*gn,0.003,0.07,camPan(S.p.x,S.p.z));}}
      else{ripple(S.p.x,S.p.z,1.6);ripple(S.p.x,S.p.z,0.8);if(AC){const gn=1/(1+camDist(S.p.x,S.p.z)*0.04);noiseHit(bus.nature,700,0.7,0.15*gn,0.01,0.35,camPan(S.p.x,S.p.z));}endStone(true);}}}
  for(const r of ripples){if(r.t<0)continue;r.t+=dt;const k=r.t/1.8;if(k>=1){r.t=-1;r.m.visible=false;continue;}r.m.scale.setScalar(0.1+r.s*2.2*k);r.m.material.opacity=0.6*(1-k);r.m.position.y=lvl()+0.04;}
  // sand marks erased by the swash
  let ch=false;const Lv=lvl()+0.012;for(let n=0;n<400;n++){eraseI=(eraseI+1)%MAXM;const m=marks[eraseI];if(m&&H(m.x,m.z)<Lv){markMesh.setMatrixAt(eraseI,zero);marks[eraseI]=null;ch=true;}}
  if(ch)markMesh.instanceMatrix.needsUpdate=true;
  // campfire
  fMat.uniforms.uVis.value=L;fire.visible=L>0.01;
  if(L>0.01){for(let i=0;i<FP;i++){fLife[i]+=dt/(fEmb[i]?2.2:0.9)*fMax[i];if(fLife[i]>=1){fLife[i]=0;fMax[i]=MR(0.8,1.25);const a=Math.random()*6.283,r=Math.random()*0.22;fPos[i*3]=FX+Math.cos(a)*r;fPos[i*3+1]=FY+0.15;fPos[i*3+2]=FZ+Math.sin(a)*r;fVel[i*3]=MR(-0.15,0.15);fVel[i*3+1]=fEmb[i]?MR(1.2,2.2):MR(0.6,1.2);fVel[i*3+2]=MR(-0.15,0.15);}
      fPos[i*3]+=(fVel[i*3]+Math.sin(T*3+i)*0.12)*dt;fPos[i*3+1]+=fVel[i*3+1]*dt;fPos[i*3+2]+=(fVel[i*3+2]+Math.cos(T*2.6+i)*0.12)*dt;}
    fGeo.attributes.position.needsUpdate=true;fGeo.attributes.aLife.needsUpdate=true;}
  fireLight.intensity=L*(22+6*Math.sin(T*13)+4*Math.sin(T*7.3+1)+3*Math.sin(T*23));
  // bar lights
  for(const b of bulbs)b.material.color.setScalar(0.45+L*1.6);
  barLight.intensity=L*9;
  // kites (daytime)
  const kv=env.day>0.5;
  for(const k of kites){k.g.visible=k.tail.visible=k.str.visible=kv;if(!kv)continue;const a=k.anchor,ph=k.ph;
    const p=new THREE.Vector3(a.x+Math.sin(T*0.35+ph)*4,a.y+k.h+Math.sin(T*0.6+ph)*1.6,a.z-16+Math.cos(T*0.27+ph)*2.5);
    k.g.position.copy(p);k.g.lookAt(a.x,a.y+k.h*0.4,a.z);k.g.rotateZ(Math.sin(T*1.1+ph)*0.35);k.g.scale.setScalar(1.6);
    const sp=k.str.geometry.attributes.position;sp.setXYZ(0,a.x,a.y,a.z);sp.setXYZ(1,p.x,p.y-0.8,p.z);sp.needsUpdate=true;
    const tp=k.tail.geometry.attributes.position;for(let i=0;i<16;i++){tp.setXYZ(i,p.x+Math.sin(T*3.2-i*0.55+ph)*0.08*i,p.y-0.9-i*0.22,p.z+Math.cos(T*2.7-i*0.5)*0.05*i);}tp.needsUpdate=true;}
  // shooting stars
  if(SS.t<0&&env.stars>0.6){SS.timer-=dt;if(SS.timer<=0){SS.timer=MR(6,16);SS.t=0;const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const ang=MR(-0.7,0.7),el=MR(0.3,0.75);
      const dir=new THREE.Vector3(f.x*Math.cos(ang)-f.z*Math.sin(ang),0,f.x*Math.sin(ang)+f.z*Math.cos(ang)).normalize();SS.p0.copy(dir).multiplyScalar(Math.cos(el));SS.p0.y=Math.sin(el);
      SS.d.crossVectors(SS.p0,new THREE.Vector3(0,1,0)).normalize().multiplyScalar(Math.random()<0.5?1:-1);SS.d.y=-0.45;
      if(!SS.seen){SS.seen=true;save.wishes++;persist();renderCarnet();toast('🌠 Une étoile filante ! Fais un vœu…',4500);if(AC)chimeUp(4);}}}
  if(SS.t>=0){SS.t+=dt/0.9;const s=Math.min(1,SS.t),pp=ssGeo.attributes.position,h=SS.p0.clone().addScaledVector(SS.d,0.4*s).normalize().multiplyScalar(1500).add(camera.position),tl=SS.p0.clone().addScaledVector(SS.d,0.4*Math.max(0,s-0.14)).normalize().multiplyScalar(1500).add(camera.position);
    pp.setXYZ(0,h.x,h.y,h.z);pp.setXYZ(1,tl.x,tl.y,tl.z);pp.needsUpdate=true;ssMat.opacity=Math.sin(Math.PI*s)*clamp(env.stars,0,1);if(SS.t>=1){SS.t=-1;ssMat.opacity=0;}}
  // ---- audio for fire & guitar
  if(AC&&AC.state==='running'){
    const t=AC.currentTime;
    if(!fireSnd){const s=AC.createBufferSource();s.buffer=NB.brown;s.loop=true;s.start();const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;const g=AC.createGain();g.gain.value=0;const p=AC.createStereoPanner();s.connect(lp).connect(g).connect(p).connect(bus.nature);fireSnd={g,p,pop:0};}
    const fd=camDist(FX,FZ),fg=L/(1+(fd/5)**2);fireSnd.g.gain.setTargetAtTime(fg*0.5,t,0.2);fireSnd.p.pan.setTargetAtTime(camPan(FX,FZ)*0.8,t,0.1);
    fireSnd.pop-=dt;if(fireSnd.pop<=0){fireSnd.pop=MR(0.05,0.35);if(fg>0.01)noiseHit(bus.nature,MR(1800,5500),MR(1,3),fg*MR(0.08,0.35),0.001,MR(0.02,0.07),camPan(FX,FZ)*0.8);}
    if(vol.paillote>0){const bd=camDist(PX,PZ),prox=1/(1+(bd/13)**2);
      if(prox>0.012){if(gNext<t)gNext=t+0.05;while(gNext<t+0.25){const ci=Math.floor(gStep/16)%4,pos=gStep%8,pan=camPan(PX,PZ)*0.8;
          if(pos===0||pos===4)pluck(BASS[ci],gNext,0.55*prox,pan);
          pluck(PROG[ci][[0,1,2,1,0,1,2,1][pos]],gNext+Math.random()*0.012,0.32*prox,pan);
          if(Math.random()<0.16)pluck(mpick(MEL),gNext+0.15,0.2*prox,pan);
          gNext+=0.3*(pos%2?0.9:1.1);gStep++;}}
      else gNext=0;}
  }
});
