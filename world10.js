import * as THREE from 'three';
import {mergeVertices} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import {scene,renderer,H,SHORE,clamp,env,hooks} from './app.js';

// =====================================================================
// Realistic Mediterranean village + lighthouse
// Photographed PBR materials (Poly Haven, CC0): rough white lime plaster,
// clay roof tiles, painted wooden planks (shutters/doors), rustic stone.
// Real architecture: gable roofs with overhang & ridge tiles, window
// surrounds, sills, open/closed shutters, balconies, doors with steps and
// lamps, chimneys, stone plinths, terrace walls, bougainvillea, cypresses.
// =====================================================================
let seed=20260;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const SR=(a,b)=>a+(b-a)*rnd(),pick=a=>a[Math.floor(rnd()*a.length)];

const tl=new THREE.TextureLoader(),aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
function tex(u,srgb){const t=tl.load(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=aniso;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
function pbr(n,ns){const m=new THREE.MeshStandardMaterial({map:tex(`./assets/${n}.jpg`,true),normalMap:tex(`./assets/${n}_nor.jpg`),roughnessMap:tex(`./assets/${n}_rough.jpg`),vertexColors:true,roughness:1});m.normalScale.set(ns,ns);return m;}
const MAT={
  plaster:pbr('house_plaster',0.55),roof:pbr('house_roof',1.2),stone:pbr('house_stone',1.3),wood:pbr('house_wood',0.9),
  glass:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.05,metalness:0.35,vertexColors:true}),
  lit:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.08,metalness:0.25,vertexColors:true,emissive:'#ffb257',emissiveIntensity:0}),
  lamp:new THREE.MeshStandardMaterial({color:'#fff4d6',roughness:0.3,emissive:'#ffd38a',emissiveIntensity:0,transparent:true,opacity:0.9}),
  iron:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.45,metalness:0.55,vertexColors:true}),
  leaf:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85}),
};
const TS={plaster:1.7,roof:2.5,stone:1.5,wood:1.1,glass:1,lit:1,lamp:1,iron:1,leaf:1};
const B={};for(const k in MAT)B[k]={p:[],n:[],u:[],c:[]};
const C=h=>new THREE.Color(h);const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// ---------- geometry builder (world-scaled UVs, explicit normals) ----------
const _n=new THREE.Vector3(),_e1=new THREE.Vector3(),_e2=new THREE.Vector3(),_nm=new THREE.Matrix3();
function quad(mat,M,a,b,c,d,col,nOut){
  const bb=B[mat],ts=TS[mat];
  const eu=b.clone().sub(a).normalize(),ad=d.clone().sub(a),ev=ad.clone().addScaledVector(eu,-ad.dot(eu)).normalize();
  const ox=rnd()*4,oy=rnd()*4,L=[a,b,c,d];
  const P=L.map(p=>p.clone().applyMatrix4(M)),U=L.map(p=>{const q=p.clone().sub(a);return [ox+q.dot(eu)/ts,oy+q.dot(ev)/ts];});
  _n.crossVectors(_e1.subVectors(P[1],P[0]),_e2.subVectors(P[3],P[0])).normalize();
  const no=nOut.clone().transformDirection(M);
  if(_n.dot(no)<0)_n.negate();
  const order=_n.dot(no)>=0&&new THREE.Vector3().crossVectors(_e1,_e2).dot(no)>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2];
  for(const i of order){bb.p.push(P[i].x,P[i].y,P[i].z);bb.n.push(_n.x,_n.y,_n.z);bb.u.push(U[i][0],U[i][1]);bb.c.push(col.r,col.g,col.b);}
}
function tri(mat,M,a,b,c,col,nOut){
  const bb=B[mat],ts=TS[mat],eu=b.clone().sub(a).normalize(),ac=c.clone().sub(a),ev=ac.clone().addScaledVector(eu,-ac.dot(eu)).normalize();
  const L=[a,b,c],P=L.map(p=>p.clone().applyMatrix4(M)),U=L.map(p=>{const q=p.clone().sub(a);return [q.dot(eu)/ts,q.dot(ev)/ts];});
  _n.crossVectors(_e1.subVectors(P[1],P[0]),_e2.subVectors(P[2],P[0]));const no=nOut.clone().transformDirection(M);
  const ord=_n.dot(no)>=0?[0,1,2]:[0,2,1];_n.normalize();if(_n.dot(no)<0)_n.negate();
  for(const i of ord){bb.p.push(P[i].x,P[i].y,P[i].z);bb.n.push(_n.x,_n.y,_n.z);bb.u.push(U[i][0],U[i][1]);bb.c.push(col.r,col.g,col.b);}
}
function box(mat,M,cx,cy,cz,sx,sy,sz,col,skip=''){
  const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
  if(!skip.includes('pz'))quad(mat,M,V(x0,y0,z1),V(x1,y0,z1),V(x1,y1,z1),V(x0,y1,z1),col,V(0,0,1));
  if(!skip.includes('nz'))quad(mat,M,V(x1,y0,z0),V(x0,y0,z0),V(x0,y1,z0),V(x1,y1,z0),col,V(0,0,-1));
  if(!skip.includes('px'))quad(mat,M,V(x1,y0,z1),V(x1,y0,z0),V(x1,y1,z0),V(x1,y1,z1),col,V(1,0,0));
  if(!skip.includes('nx'))quad(mat,M,V(x0,y0,z0),V(x0,y0,z1),V(x0,y1,z1),V(x0,y1,z0),col,V(-1,0,0));
  if(!skip.includes('py'))quad(mat,M,V(x0,y1,z1),V(x1,y1,z1),V(x1,y1,z0),V(x0,y1,z0),col,V(0,1,0));
  if(!skip.includes('ny'))quad(mat,M,V(x0,y0,z0),V(x1,y0,z0),V(x1,y0,z1),V(x0,y0,z1),col,V(0,-1,0));
}
function addGeo(mat,geo,M,col,us=1,vs=1){
  const g=geo.index?geo.toNonIndexed():geo,bb=B[mat],p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
  _nm.getNormalMatrix(M);const v=new THREE.Vector3(),w=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(M);w.fromBufferAttribute(n,i).applyMatrix3(_nm).normalize();
    bb.p.push(v.x,v.y,v.z);bb.n.push(w.x,w.y,w.z);bb.u.push(u?u.getX(i)*us:0,u?u.getY(i)*vs:0);bb.c.push(col.r,col.g,col.b);}
}
const T4=(x,y,z,ry=0)=>new THREE.Matrix4().makeRotationY(ry).setPosition(x,y,z);
const mul=(...m)=>m.reduce((a,b)=>a.clone().multiply(b));

// ---------- palettes ----------
const WALLS=['#f7f5f0','#f5f2ea','#f8f6f1','#f3ede2','#efe3cf','#f0dcc2','#eed6c4','#f6f1e7','#e9dcc5'];
const PAINT=['#3f6f9a','#4d7a66','#3b878c','#7a96ab','#874536','#55799a','#9aae96','#2f5f86','#6c8a5a'];
const ROOFT=['#ffffff','#f3ddcf','#ffe8d6','#e7cdbb','#fff1e6'];
const STONEC=['#ffffff','#efe8dc','#e6dccb'];
const FLOW=['#d6327a','#e2408a','#c42f8e','#e0567f','#b9307a'];

// leafy clump prototypes (bougainvillea, cypress)
function clump(seedK){const g=mergeVertices(new THREE.IcosahedronGeometry(1,2));const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=0.78+0.32*Math.sin(x*5.1+seedK)*Math.sin(y*4.3+seedK*2)*Math.sin(z*6.2+seedK*3)+0.12*rnd();p.setXYZ(i,x*k,y*k,z*k);}
  g.computeVertexNormals();return g;}
const CLUMPS=[clump(1),clump(2.7),clump(4.1)];
function cypressGeo(){const pts=[];for(let i=0;i<=14;i++){const y=i/14;pts.push(new THREE.Vector2(Math.max(0.02,Math.sin(Math.PI*Math.pow(y,0.62))*(1-0.35*y)),y));}
  const g=mergeVertices(new THREE.LatheGeometry(pts,14));const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+0.2*Math.sin(y*37+Math.atan2(x,z)*5)+0.12*(rnd()-0.5);p.setXYZ(i,x*k,y,z*k);}
  g.computeVertexNormals();return g;}
const CYP=[cypressGeo(),cypressGeo()];

// ---------- architectural elements, built in a "face frame": wall surface at z=0, +z points outside ----------
function windowAt(F,W,Hh,o){
  const b=0.15,trim=o.trim;
  if(o.balc){ // French window with a wrought-iron balcony
    box('stone',F,0,-Hh/2-0.07,0.33,W+1.0,0.14,0.66,o.stone);
    const top=-Hh/2+0.95,z=0.63,hw=(W+1.0)/2-0.03;
    box('iron',F,0,top,z,W+1.0,0.045,0.045,C('#2a2a2a'));box('iron',F,0,-Hh/2+0.12,z,W+1.0,0.03,0.03,C('#2a2a2a'));
    for(const sx of [-hw,hw])box('iron',F,sx,-Hh/2+0.47,0.33,0.035,0.95,0.6,C('#2a2a2a'),'pz nz');
    for(let x=-hw;x<=hw+1e-3;x+=0.12)box('iron',F,x,-Hh/2+0.5,z,0.018,0.9,0.018,C('#2a2a2a'));
  }
  // plaster surround (a band in a slightly different tone, like real Provençal façades)
  box('plaster',F,-(W/2+b/2),0,0.025,b,Hh+2*b,0.05,trim);box('plaster',F,W/2+b/2,0,0.025,b,Hh+2*b,0.05,trim);
  box('plaster',F,0,Hh/2+b/2,0.025,W,b,0.05,trim);
  if(!o.balc){box('stone',F,0,-Hh/2-0.045,0.09,W+0.42,0.09,0.2,o.stone);box('plaster',F,0,-Hh/2-b/2+0.02,0.02,W,b-0.05,0.04,trim);}
  // dark reveal to fake the depth of a thick wall, then glass and the painted wooden frame
  box('plaster',F,0,0,0.004,W,Hh,0.008,C('#5d5a55'),'nz');
  const closed=o.shut&&o.closed;
  if(!closed){
    quad(o.lit?'lit':'glass',F,V(-W/2+0.06,-Hh/2+0.06,0.012),V(W/2-0.06,-Hh/2+0.06,0.012),V(W/2-0.06,Hh/2-0.06,0.012),V(-W/2+0.06,Hh/2-0.06,0.012),C('#2a3640'),V(0,0,1));
    const fc=o.frame;
    for(const sx of [-1,1])box('wood',F,sx*(W/2-0.035),0,0.02,0.07,Hh,0.04,fc);
    box('wood',F,0,Hh/2-0.035,0.02,W,0.07,0.04,fc);box('wood',F,0,-Hh/2+0.035,0.02,W,0.07,0.04,fc);
    box('wood',F,0,0,0.022,0.05,Hh,0.04,fc);box('wood',F,0,Hh*0.22,0.022,W,0.045,0.04,fc);
  }
  if(o.shut){
    if(closed){for(const sx of [-1,1])box('wood',F,sx*W/4,0,0.035,W/2-0.012,Hh,0.04,o.paint);}
    else{const ang=o.half?0.9:0;for(const sx of [-1,1]){const S=mul(F,T4(sx*(W/2+b+0.01),0,0.04,sx*-ang*0.6));box('wood',S,sx*W/4,0,0,W/2,Hh,0.035,o.paint);}}
  }
}
function doorAt(F,o){
  const W=o.wide?1.5:1.05,Hd=2.2,b=0.2;
  box('stone',F,-(W/2+b/2),Hd/2,0.03,b,Hd,0.06,o.stone);box('stone',F,W/2+b/2,Hd/2,0.03,b,Hd,0.06,o.stone);box('stone',F,0,Hd+b/2,0.035,W+2*b,b,0.07,o.stone);
  box('plaster',F,0,Hd/2,0.004,W,Hd,0.008,C('#4a4642'),'nz');
  if(o.wide){for(const sx of [-1,1])box('wood',F,sx*W/4,Hd/2,0.025,W/2-0.01,Hd-0.02,0.05,o.paint);}
  else box('wood',F,0,Hd/2,0.025,W-0.02,Hd-0.02,0.05,o.paint);
  box('iron',F,W*0.33,1.05,0.065,0.03,0.18,0.03,C('#3a3226'));
  box('stone',F,0,-0.14,0.32,W+0.7,0.3,0.64,o.stone);box('stone',F,0,-0.42,0.75,W+0.7,0.3,0.4,o.stone);
  // wall lantern
  box('iron',F,W/2+b+0.25,Hd+0.05,0.12,0.06,0.06,0.24,C('#222'));
  addGeo('lamp',new THREE.SphereGeometry(0.11,10,8),mul(F,T4(W/2+b+0.25,Hd-0.06,0.24)),C('#fff'));
  lamps++;
  if(o.canopy){const S=mul(F,new THREE.Matrix4().makeTranslation(0,Hd+0.32,0.35).multiply(new THREE.Matrix4().makeRotationX(0.32)));box('roof',S,0,0,0,W+0.9,0.08,0.8,C('#ffffff'));}
}
function bougain(F,x,y,n){n*=2.2;for(let k=0;k<n;k++){const s=SR(0.16,0.34);const M=mul(F,new THREE.Matrix4().compose(V(x+SR(-0.9,0.9),y+SR(-0.5,0.8)+k*0.18,SR(0.15,0.4)),new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,0)),V(s*1.2,s,s*0.7)));
  addGeo('leaf',pick(CLUMPS),M,rnd()<0.62?C(pick(FLOW)).multiplyScalar(SR(0.7,1.0)):C(pick(['#3f6a33','#4d7a3a','#36592c'])));}}
let lamps=0;

// ---------- the house ----------
const placed=[];
function house(x,z,o={}){
  const w=o.w??SR(5.5,9),d=o.d??SR(5,7.2),fl=o.fl??(rnd()<0.6?2:1),FH=2.9,h=fl*FH+0.35;
  const ry=o.ry??(SR(-0.3,0.3)+(x<0?0.22:-0.22));
  const M0=T4(x,0,z,ry),hs=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const p=V(a*w/2,0,b*d/2).applyMatrix4(M0);return H(p.x,p.z);});
  const minH=Math.min(...hs),avg=hs.reduce((a,b)=>a+b)/4,y0=avg+0.15,M=T4(x,y0,z,ry),yb=minH-y0-1.2;
  const wallC=C(o.wall??pick(WALLS)),white=wallC.r>0.95&&wallC.b>0.9;
  const trim=white?C('#e8e1d3'):C('#faf8f3'),paint=C(o.paint??pick(PAINT)).multiplyScalar(SR(0.85,1.1)),stone=C(pick(STONEC)),roofC=C(pick(ROOFT));
  const frame=rnd()<0.6?C('#f2efe8'):paint.clone().multiplyScalar(0.9);
  const flat=o.roof?o.roof==='flat':rnd()<0.3;
  // walls & base
  box('plaster',M,0,(yb+h)/2,0,w,h-yb,d,wallC);
  box('stone',M,0,(yb+0.55)/2,0,w+0.12,0.55-yb,d+0.12,stone,'py');
  if(fl>1&&rnd()<0.5)box('plaster',M,0,FH,0,w+0.1,0.16,d+0.1,trim);
  // roof
  if(flat){
    box('plaster',M,0,h+0.28,-d/2+0.1,w,0.56,0.2,wallC);box('plaster',M,0,h+0.28,d/2-0.1,w,0.56,0.2,wallC);
    box('plaster',M,-w/2+0.1,h+0.28,0,0.2,0.56,d-0.4,wallC);box('plaster',M,w/2-0.1,h+0.28,0,0.2,0.56,d-0.4,wallC);
    box('plaster',M,0,h+0.58,0,w+0.08,0.06,d+0.08,trim,'ny');
    if(rnd()<0.5){box('plaster',M,w*0.25,h+0.9,d*0.2,0.6,1.3,0.6,wallC);box('plaster',M,w*0.25,h+1.6,d*0.2,0.8,0.08,0.8,trim);}
    if(rnd()<0.35){ // rooftop pergola with a canvas shade
      const px=-w*0.2;for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])box('wood',M,px+a*1.2,h+1.2,b*1.0,0.1,2.4,0.1,C('#8d6b4a'));
      box('wood',M,px,h+2.42,0,2.6,0.05,2.2,C('#d9cdb4'));}
  }else{
    const ov=0.45,t=Math.tan(o.pitch??SR(0.3,0.42)),hw=w/2+ov,hd=d/2+ov,ye=h-ov*t,yr=h+d/2*t,th=0.16;
    for(const s of [-1,1]){ // s=-1 front slope (sea side), +1 back
      const a=V(-hw,ye,s*hd),b2=V(hw,ye,s*hd),c=V(hw,yr,0),dd=V(-hw,yr,0),up=V(0,th,0);
      quad('roof',M,a.clone().add(up),b2.clone().add(up),c.clone().add(up),dd.clone().add(up),roofC,V(0,1,s*t));
      quad('plaster',M,a,b2,c,dd,C('#b9b2a6'),V(0,-1,-s*t));
      quad('roof',M,a,b2,b2.clone().add(up),a.clone().add(up),roofC.clone().multiplyScalar(0.8),V(0,0,s));
      for(const e of [-1,1]){const p0=V(e*hw,ye,s*hd),p1=V(e*hw,yr,0);quad('plaster',M,p0,p1,p1.clone().add(up),p0.clone().add(up),trim,V(e,0,0));}
    }
    for(const e of [-1,1])tri('plaster',M,V(e*w/2,h,-d/2),V(e*w/2,h,d/2),V(e*w/2,yr,0),wallC,V(e,0,0));
    addGeo('roof',new THREE.CylinderGeometry(0.15,0.15,w+2*ov,10,1,false,0,Math.PI).rotateZ(Math.PI/2),mul(M,T4(0,yr+th-0.02,0)),roofC.clone().multiplyScalar(0.95),3,1);
    if(rnd()<0.55){const cx=SR(-w/3,w/3),cz=d*0.22;box('plaster',M,cx,yr-0.3+0.6,cz,0.6,2.0,0.6,wallC);box('plaster',M,cx,yr+1.32,cz,0.8,0.1,0.8,trim);
      for(const sx of [-1,1])box('roof',M,cx+sx*0.18,yr+1.45,cz,0.2,0.16,0.7,roofC);}
  }
  // façade openings (front faces the sea)
  const Fr=(s,y)=>mul(M,T4(-s,y,-d/2,Math.PI)),Fs=(e,s,y)=>mul(M,T4(e*w/2,y,s,e*Math.PI/2));
  const nw=Math.max(1,Math.floor((w-0.6)/2.2)),step=w/nw,door=o.door??Math.floor(nw/2);
  const shut=rnd()<0.85;
  for(let f=0;f<fl;f++)for(let i=0;i<nw;i++){const s=-w/2+(i+0.5)*step;
    if(f===0&&i===door){doorAt(Fr(s,0),{paint,stone,wide:w>8&&rnd()<0.5,canopy:rnd()<0.3});if(rnd()<0.45)bougain(Fr(s,0),SR(-0.5,0.5),2.8,7);continue;}
    const balc=f>0&&rnd()<0.28,Hh=balc?2.05:(f===0?1.3:1.2),y=balc?f*FH+1.08:f*FH+1.55;
    windowAt(Fr(s,y),balc?0.95:0.85,Hh,{trim,paint,stone,frame,balc,shut,closed:rnd()<0.28,half:rnd()<0.3,lit:rnd()<0.5});
    if(balc&&rnd()<0.5){const F=Fr(s,y);for(let k=0;k<3;k++){const M2=mul(F,T4(SR(-0.6,0.6),-Hh/2+0.25,0.45));addGeo('stone',new THREE.CylinderGeometry(0.16,0.11,0.3,10),M2,C('#c0643a'));addGeo('leaf',pick(CLUMPS),mul(M2,new THREE.Matrix4().compose(V(0,0.3,0),new THREE.Quaternion(),V(0.25,0.22,0.25))),C(rnd()<0.5?pick(FLOW):'#4d7a3a'));}}
  }
  if(d>5.3)for(const e of [-1,1])for(let f=0;f<fl;f++)if(rnd()<0.6)windowAt(Fs(e,SR(-0.6,0.6),f*FH+1.55),0.8,1.15,{trim,paint,stone,frame,shut,closed:rnd()<0.3,lit:rnd()<0.4});
  // terrace wall in front of the house
  if(!o.noGarden&&rnd()<0.45){const tz=-d/2-SR(2.2,3.2),gl=Math.min(...[-1,0,1].map(k=>{const p=V(k*(w/2+1),0,tz).applyMatrix4(M0);return H(p.x,p.z);}))-y0-0.6;
    box('stone',M,0,(gl+0.6)/2,tz,w+2.2,0.6-gl,0.42,stone);box('plaster',M,0,0.63,tz,w+2.3,0.07,0.5,trim);}
  if(rnd()<0.3)bougain(Fs(rnd()<0.5?-1:1,-d/2+0.6,0),0,1.0,9);
  placed.push([x,z]);
}

// ---------- place the village on both headlands ----------
const LX=-232,LZ=SHORE(-232)+3,LY=H(LX,LZ);
const ok=(x,z,r)=>placed.every(p=>Math.hypot(p[0]-x,p[1]-z)>r)&&Math.hypot(x-LX,z-LZ)>16;
for(let k=0;k<1400&&placed.length<44;k++){const x=-SR(185,300),z=SHORE(x)+SR(10,78),y=H(x,z);if(y<2.5||y>30||z>165||!ok(x,z,10.5))continue;house(x,z);}
const nL=placed.length;
for(let k=0;k<900&&placed.length<nL+20;k++){const x=SR(190,300),z=SHORE(x)+SR(10,72),y=H(x,z);if(y<2.5||y>30||z>165||!ok(x,z,10.5))continue;house(x,z);}
// cypresses among the houses
for(let k=0;k<36;k++){const [hx,hz]=pick(placed),a=rnd()*6.28,r=SR(6,9),x=hx+Math.cos(a)*r,z=hz+Math.sin(a)*r;if(!ok(x,z,4.5)&&placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<5.5))continue;
  const y=H(x,z),hh=SR(7,11),rr=SR(0.85,1.2);addGeo('leaf',pick(CYP),new THREE.Matrix4().compose(V(x,y-0.3,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rnd()*6,0)),V(rr,hh,rr)),C(pick(['#2c4527','#314b2a','#283f24'])));}

// ---------- lighthouse (lamp kept at LY+18.9 so the rotating beam stays aligned) ----------
{
  const M=T4(LX,LY,LZ);
  const cyl=(mat,y0,y1,r0,r1,col,seg=36,open=true)=>{const g=new THREE.CylinderGeometry(r1,r0,y1-y0,seg,1,open).translate(0,(y0+y1)/2,0);addGeo(mat,g,M,col,2*Math.PI*(r0+r1)/2/TS[mat],(y1-y0)/TS[mat]);};
  addGeo('stone',new THREE.CylinderGeometry(2.6,2.75,2.4,8,1).rotateY(Math.PI/8).translate(0,-0.9,0),M,C('#f2ebe0'),16.5/1.5,2.4/1.5);
  addGeo('stone',new THREE.CylinderGeometry(2.75,2.75,0.18,8,1).rotateY(Math.PI/8).translate(0,0.39,0),M,C('#d8cfc0'),1,1);
  const r=y=>1.62-(1.62-1.08)*(y-0.3)/17.5;
  cyl('plaster',0.3,15.0,r(0.3),r(15),C('#f8f6f1'));cyl('plaster',15.0,17.8,r(15),r(17.8),C('#b8342b'));
  // small staggered windows climbing the tower
  for(const [y,a] of [[4.5,Math.PI],[8.2,Math.PI*0.25],[11.8,Math.PI*1.25]]){const F=mul(M,T4(Math.sin(a)*(r(y)-0.02),y,Math.cos(a)*(r(y)-0.02),a));windowAt(F,0.42,0.8,{trim:C('#e9e3d6'),paint:C('#2f5f86'),stone:C('#e8e0d2'),frame:C('#2f5f86'),lit:true});}
  // door in the stone base, facing the sea
  {const a=Math.PI,F=mul(M,T4(0,0.48,-(r(1.5)+0.35),a));box('plaster',F,0,1.45,-0.45,2.1,2.9,0.9,C('#f8f6f1'),'nz');box('plaster',F,0,2.95,-0.3,2.3,0.12,1.0,C('#e9e3d6'));doorAt(F,{paint:C('#2f5f86'),stone:C('#e2d9c8')});}
  // gallery with railing
  addGeo('stone',new THREE.CylinderGeometry(2.05,1.85,0.3,36).translate(0,17.95,0),M,C('#e2dbcf'),8,0.3);
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2;box('iron',M,Math.sin(a)*1.95,18.6,Math.cos(a)*1.95,0.04,1.0,0.04,C('#2b2b2b'));}
  for(const y of [19.08,18.6])addGeo('iron',new THREE.TorusGeometry(1.95,0.03,6,48).rotateX(Math.PI/2).translate(0,y,0),M,C('#2b2b2b'));
  // lantern room
  cyl('plaster',18.1,18.45,0.95,0.95,C('#b8342b'),28,false);
  const lan=new THREE.Mesh(new THREE.CylinderGeometry(0.88,0.88,1.6,16,1,true),new THREE.MeshStandardMaterial({color:'#dfe9ec',roughness:0.05,metalness:0.2,transparent:true,opacity:0.55,emissive:'#fff1b8',emissiveIntensity:0,side:THREE.DoubleSide,depthWrite:false}));
  lan.position.set(LX,LY+19.25,LZ);scene.add(lan);MAT.lantern=lan.material;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;box('iron',M,Math.sin(a)*0.9,19.25,Math.cos(a)*0.9,0.05,1.6,0.05,C('#b8342b'));}
  cyl('plaster',20.05,20.2,0.98,0.98,C('#b8342b'),28,false);
  addGeo('plaster',new THREE.SphereGeometry(1.0,28,10,0,Math.PI*2,0,Math.PI/2).translate(0,20.15,0),M,C('#b8342b'),3,1);
  addGeo('iron',new THREE.SphereGeometry(0.17,12,8).translate(0,21.25,0),M,C('#2b2b2b'));
  addGeo('iron',new THREE.CylinderGeometry(0.02,0.02,1.1,6).translate(0,21.8,0),M,C('#2b2b2b'));
  // keeper's cottage
  house(LX+5.6,LZ+2.2,{w:4.8,d:4.2,fl:1,roof:'gable',ry:0.3,noGarden:true,door:0});
}

// ---------- bake meshes ----------
const meshes=[];
for(const k in B){const b=B[k];if(!b.p.length)continue;const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
  const m=new THREE.Mesh(g,MAT[k]);m.castShadow=k!=='glass'&&k!=='lit'&&k!=='lamp';m.receiveShadow=true;scene.add(m);meshes.push(m);}

// ---------- retire the old toy-like village, its cypresses, lighthouse and window glows ----------
scene.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||meshes.includes(o))return;const m=o.material;
  if(m&&m.isMeshStandardMaterial&&m.vertexColors&&m.flatShading&&Math.abs(m.roughness-0.85)<1e-6)o.visible=false;
  if(m&&m.isMeshBasicMaterial&&m.transparent&&m.color&&m.color.getHexString()==='ffcf7a'){o.geometry=new THREE.BufferGeometry();}
  if(m&&m.isMeshBasicMaterial&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius===0.9&&Math.hypot(o.position.x-LX,o.position.z-LZ)<1)o.scale.setScalar(0.62);
});

hooks.push(()=>{
  const L=clamp((0.7-env.day)/0.35,0,1);
  MAT.lit.emissiveIntensity=L*2.4;MAT.lamp.emissiveIntensity=0.05+L*3.2;
  if(MAT.lantern)MAT.lantern.emissiveIntensity=0.15+L*2.5;
});
