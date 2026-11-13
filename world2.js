import * as THREE from 'three';
import {mergeGeometries} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import {scene,camera,H,SHORE,clamp,smooth,env,U,WATER_U,vol,bus,AC,noiseHit,env1,hooks,state,canvasTex,renderer} from './app.js';

// ============ helpers ============
let sd=4242;const sr=()=>(sd=(sd*16807)%2147483647)/2147483647;
const SR=(a,b)=>a+(b-a)*sr(),spick=a=>a[Math.floor(sr()*a.length)];
const MR=(a,b)=>a+(b-a)*Math.random(),mpick=a=>a[Math.floor(Math.random()*a.length)];
const lit=()=>clamp((0.75-env.day)/0.35,0,1);
const lvl=()=>WATER_U.uLevel.value;
const camDist=(x,z)=>Math.hypot(x-camera.position.x,z-camera.position.z);
function camPan(x,z){const cy=camera.rotation.y,dx=x-camera.position.x,dz=z-camera.position.z,d=Math.hypot(dx,dz)||1;return clamp((dx*Math.cos(cy)-dz*Math.sin(cy))/d,-1,1);}
const std=(c,r=0.7,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...o});
const _c=new THREE.Color();
const M4=(x,y,z,ry=0,sx=1,sy=1,sz=1,rx=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,'YXZ')),new THREE.Vector3(sx,sy,sz));
function part(geo,color,m){let g=geo.clone();if(m)g.applyMatrix4(m);if(g.index)g=g.toNonIndexed();if(g.attributes.uv)g.deleteAttribute('uv');if(!g.attributes.normal)g.computeVertexNormals();
  const n=g.attributes.position.count,a=new Float32Array(n*3);_c.set(color);for(let i=0;i<n;i++){a[i*3]=_c.r;a[i*3+1]=_c.g;a[i*3+2]=_c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function bake(parts,o={}){const g=mergeGeometries(parts);g.computeBoundingSphere();const m=new THREE.Mesh(g,o.mat||new THREE.MeshStandardMaterial({vertexColors:true,roughness:o.r??0.8,flatShading:!!o.flat,side:o.side||THREE.FrontSide}));m.castShadow=o.cast??true;m.receiveShadow=true;scene.add(m);return m;}
function shadowAll(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o}
const BOX=new THREE.BoxGeometry(1,1,1),CYL=new THREE.CylinderGeometry(0.5,0.5,1,12),SPH=new THREE.SphereGeometry(0.5,12,8),CONE4=new THREE.ConeGeometry(0.72,1,4);
function inst(geo,mat,list,cast=true){const m=new THREE.InstancedMesh(geo,mat,list.length),o=new THREE.Object3D();
  list.forEach((it,i)=>{o.position.set(it.x,it.y,it.z);o.rotation.set(it.rx||0,it.ry||0,it.rz||0);o.scale.set(it.sx??1,it.sy??1,it.sz??1);o.updateMatrix();m.setMatrixAt(i,o.matrix);if(it.c)m.setColorAt(i,_c.set(it.c));});
  m.castShadow=cast;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);return m;}

// ============ 1. more palms (instanced swaying fronds) ============
const leafTex=canvasTex(256,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.lineCap='round';
  for(let i=0;i<46;i++){const x=6+i*5.2,e=Math.sin(Math.PI*Math.min(1,(i/46)*1.1))*0.9+0.1;for(const s of [-1,1]){const L=56*e;g.strokeStyle=`hsl(${92+sr()*28},${45+sr()*22}%,${25+sr()*15}%)`;g.lineWidth=3.4;g.beginPath();g.moveTo(x,64);g.quadraticCurveTo(x+8,64+s*L*0.5,x+16,64+s*L);g.stroke();}}
  g.strokeStyle='#6b6a3a';g.lineWidth=4;g.beginPath();g.moveTo(0,64);g.lineTo(w,64);g.stroke();});
const frondG=(()=>{const g=new THREE.PlaneGeometry(1,1,14,2),p=g.attributes.position,uv=g.attributes.uv,L=3.8;
  for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i)-0.5,w=(Math.sin(Math.PI*Math.min(1,u*1.1))*0.6+0.08)*(1-u*0.4);p.setXYZ(i,u*L,-0.42*u*u*L+Math.abs(v)*0.5*w,v*2*w);}g.computeVertexNormals();return g})();
const frondMat=new THREE.MeshStandardMaterial({map:leafTex,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.75});
frondMat.onBeforeCompile=sh=>{sh.uniforms.uTime=U.time;sh.uniforms.uWind=U.wind;sh.vertexShader='uniform float uTime;uniform float uWind;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec3 ip=vec3(0.0);
  #ifdef USE_INSTANCING
  ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
  #endif
  transformed.y+=sin(uTime*1.4+ip.x*0.37+ip.z*0.23+position.x*0.6)*0.07*position.x*uWind;`);};
const frondDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:leafTex,alphaTest:0.45});
const trunkParts=[],nutParts=[],frondList=[];
function addPalm(x,z,o={}){
  const y=(o.y??H(x,z))-0.2,Hp=o.h??SR(6,10.5),lx=o.lx??SR(-1.8,1.8),lz=o.lz??SR(-3.2,-0.6);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(lx*0.1,Hp*0.33,lz*0.1),new THREE.Vector3(lx*0.42,Hp*0.67,lz*0.42),new THREE.Vector3(lx,Hp,lz)]);
  const TS=22,RS=7;let g=new THREE.TubeGeometry(curve,TS,0.2,RS,false);const p=g.attributes.position,cols=new Float32Array(p.count*3);
  for(let i=0;i<=TS;i++){const c=curve.getPointAt(i/TS),s=1.35-0.6*(i/TS);for(let j=0;j<=RS;j++){const k=i*(RS+1)+j,v=new THREE.Vector3(p.getX(k),p.getY(k),p.getZ(k)).sub(c).multiplyScalar(s).add(c);p.setXYZ(k,v.x+x,v.y+y,v.z+z);_c.set('#8a6e4b').multiplyScalar(0.72+0.28*Math.abs(Math.sin(i*1.9)));cols[k*3]=_c.r;cols[k*3+1]=_c.g;cols[k*3+2]=_c.b;}}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.deleteAttribute('uv');g.computeVertexNormals();g=g.toNonIndexed();trunkParts.push(g);
  const cx=x+lx,cy=y+Hp,cz=z+lz,n=Math.floor(SR(9,13));
  for(let k=0;k<n;k++){const s=SR(0.8,1.15);frondList.push(new THREE.Matrix4().makeTranslation(cx,cy,cz).multiply(new THREE.Matrix4().makeRotationY(k/n*6.283+SR(-0.2,0.2))).multiply(new THREE.Matrix4().makeRotationZ(SR(0.05,0.55))).multiply(new THREE.Matrix4().makeRotationX(SR(-0.25,0.25))).multiply(new THREE.Matrix4().makeScale(s,s,s)));}
  for(let k=0;k<3;k++)nutParts.push(part(SPH,'#5a3d22',M4(cx+Math.cos(k*2.1)*0.22,cy-0.18,cz+Math.sin(k*2.1)*0.22,0,0.26,0.26,0.26)));
}
// leaning "postcard" palms close to the water, groves around huts and bar, and the back of the beach
for(const [x,t,lx,lz,h] of [[-48,6.5,-2.5,-5.5,9],[-57,8,-1,-4.2,8],[46,7,2.4,-5,9.5],[58,9,1.2,-3.6,8],[-95,5,-2,-4.8,8.5],[92,6,1.8,-4.5,9]])addPalm(x,SHORE(x)+t,{lx,lz,h});
for(let k=0;k<40;k++){const x=SR(-120,120),t=SR(30,70);if(Math.abs(x-9)<6)continue;addPalm(x,SHORE(x)+t);}
for(let k=0;k<10;k++){const x=SR(-90,-50),t=SR(18,32);addPalm(x,SHORE(x)+t,{h:SR(6,8.5)});}

// ============ 2. island with palms ============
const IX=-55,IZ=-292,IR=22;
{
  const pts=[[0,2.6],[6,2.5],[12,2.0],[17,1.1],[20,0.4],[22,0],[26,-1.6],[34,-7]].map(p=>new THREE.Vector2(p[0],p[1]));
  const g=new THREE.LatheGeometry(pts,48),p=g.attributes.position,cols=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const y=p.getY(i),r=Math.hypot(p.getX(i),p.getZ(i));p.setY(i,y+(r<17?Math.sin(p.getX(i)*0.4)*Math.cos(p.getZ(i)*0.35)*0.25:0));
    _c.set(y>1.5?'#8f9c55':y>0.05?'#efdfba':'#c4ae86');if(y>1.5&&Math.random()<0.4)_c.set('#a7ab68');cols[i*3]=_c.r;cols[i*3+1]=_c.g;cols[i*3+2]=_c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95}));m.position.set(IX,0,IZ);m.receiveShadow=true;scene.add(m);
  for(let k=0;k<9;k++){const a=SR(0,6.28),r=SR(0,13);addPalm(IX+Math.cos(a)*r,IZ+Math.sin(a)*r,{y:2.2-r*0.05,h:SR(7,11),lx:SR(-2.5,2.5),lz:SR(-2.5,2.5)});}
  // stamp into the water height map so the lagoon & foam ring appear
  const tex=WATER_U.uHeight.value,d=tex.image.data,W=tex.image.width,Hh=tex.image.height,TX=-400,TZ=-340,TW=800,TD=520;
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const x=TX+TW*(i+0.5)/W,z=TZ+TD*(j+0.5)/Hh,r=Math.hypot(x-IX,z-IZ);if(r>34)continue;
    let h=r<22?2.6*(1-(r/22)**2):-(r-22)/12*7;const v=clamp(Math.round((h+12)/24*255),0,255);if(v>d[j*W+i])d[j*W+i]=v;}
  tex.needsUpdate=true;
}

// finalize all new palms (trunks+coconuts merged, fronds instanced)
{bake([...trunkParts,...nutParts],{r:0.9});const fm=new THREE.InstancedMesh(frondG,frondMat,frondList.length);frondList.forEach((m,i)=>fm.setMatrixAt(i,m));fm.customDepthMaterial=frondDepth;fm.castShadow=true;fm.receiveShadow=true;fm.computeBoundingSphere();scene.add(fm);}
// ============ 3. pines, bushes, flowering shrubs ============
{
  const pines=[];for(let k=0;k<400&&pines.length<70;k++){const side=sr()<0.5?-1:1,x=side*SR(160,300),z=SHORE(x)+SR(8,90),y=H(x,z);if(y<2.5||z>170)continue;pines.push({x,y,z,s:SR(0.8,1.4),r:SR(0,6)});}
  for(let k=0;k<25;k++){const x=SR(-150,150),z=SHORE(x)+SR(75,125);if(z>170)continue;pines.push({x,y:H(x,z),z,s:SR(0.9,1.5),r:SR(0,6)});}
  const tr=new THREE.CylinderGeometry(0.18,0.32,1,7).translate(0,0.5,0);
  inst(tr,std('#6b4f3a',0.9),pines.map(p=>({x:p.x,y:p.y-0.2,z:p.z,sx:p.s,sy:7*p.s,sz:p.s,rz:0.08})));
  const crown=mergeGeometries([part(new THREE.IcosahedronGeometry(1,1),'#3f5f34',M4(0,0,0,0,3.2,1.1,3.2)),part(new THREE.IcosahedronGeometry(1,1),'#4a6b3a',M4(1.6,0.5,0.6,0,2.2,0.9,2.2)),part(new THREE.IcosahedronGeometry(1,1),'#3b5a31',M4(-1.4,0.3,-0.8,0,2.4,0.9,2.0))]);
  inst(crown,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9,flatShading:true}),pines.map(p=>({x:p.x+0.5*p.s,y:p.y+7*p.s,z:p.z,sx:p.s,sy:p.s,sz:p.s,ry:p.r})));
  const bushes=[],flow=[];
  for(let k=0;k<1200&&bushes.length<420;k++){const x=SR(-230,230),t=SR(32,125),z=SHORE(x)+t;if(z>172)continue;const y=H(x,z);const s=SR(0.4,1.3);
    const f=sr()<0.22;(f?flow:bushes).push({x,y:y+s*0.2,z,sx:s*1.3,sy:s*0.8,sz:s*1.2,ry:SR(0,6),c:f?spick(['#e0457b','#f06fa7','#ff8a3d','#c74bd1','#ffffff']):spick(['#4c7a3c','#5d8a44','#3f6b35','#6a9150','#557d3f'])});}
  inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({roughness:0.9,flatShading:true}),bushes);
  inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({roughness:0.8,flatShading:true}),flow);
}

// ============ 4. whitewashed village + lighthouse ============
const winGlow=[];
{
  const walls=[],placed=[];
  const WALL=['#f6f3ec','#f2ece0','#fbf8f2','#efe6d6','#f4e3c9'],ROOF='#c4643a',DOOR=['#2f6fa8','#2a8c8c','#3a5ea8','#b84a3a'];
  function house(x,z,big){const y=H(x,z),w=SR(4,7.5)*(big?1.3:1),d=SR(4,6.5),h=SR(3.2,5.5),ry=SR(-0.35,0.35)+(x<0?0.25:-0.25),style=sr();
    const base=M4(x,y,z,ry);const add=(g,c,m)=>walls.push(part(g,c,base.clone().multiply(m)));
    add(BOX,spick(WALL),M4(0,(h-3)/2,0,0,w,h+3,d));
    if(style<0.45){add(CONE4,ROOF,M4(0,h+0.7,0,Math.PI/4,w*1.0,1.4,d*1.0));}
    else if(style<0.9){add(BOX,'#f8f5ef',M4(0,h+0.15,0,0,w+0.3,0.3,d+0.3));}
    else{add(BOX,'#f8f5ef',M4(0,h+0.15,0,0,w+0.3,0.3,d+0.3));add(new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI/2),'#2f6fa8',M4(0,h+0.3,0,0,1.6,1.4,1.6));}
    add(BOX,spick(DOOR),M4(SR(-w/4,w/4),0.9,-d/2-0.02,0,0.9,1.8,0.08));
    const nw=Math.max(1,Math.floor(w/1.8));for(let i=0;i<nw;i++){const wx=-w/2+(i+0.5)*w/nw;if(Math.abs(wx)<0.6&&h<4)continue;
      add(BOX,'#2a3b52',M4(wx,h*0.62,-d/2-0.02,0,0.7,0.9,0.06));add(BOX,spick(DOOR),M4(wx-0.5,h*0.62,-d/2-0.03,0,0.25,0.95,0.05));
      if(sr()<0.65)winGlow.push(base.clone().multiply(M4(wx,h*0.62,-d/2-0.07,0,0.66,0.86,1)));}
    if(sr()<0.5){const bx=sr()<0.5?-w/2:w/2;walls.push(part(new THREE.IcosahedronGeometry(1,1),spick(['#d93b7a','#e0457b','#c03c8f']),base.clone().multiply(M4(bx,1.6,-d/2-0.4,0,0.9,1.5,0.7))));}
  }
  const ok=(x,z,r)=>placed.every(p=>Math.hypot(p[0]-x,p[1]-z)>r);
  for(let k=0;k<900&&placed.length<46;k++){const x=-SR(185,300),z=SHORE(x)+SR(10,75),y=H(x,z);if(y<2.5||y>30||z>165||!ok(x,z,9))continue;placed.push([x,z]);house(x,z,false);}
  const nL=placed.length;
  for(let k=0;k<700&&placed.length<nL+20;k++){const x=SR(190,300),z=SHORE(x)+SR(10,70),y=H(x,z);if(y<2.5||y>30||z>165||!ok(x,z,9))continue;placed.push([x,z]);house(x,z,false);}
  // cypresses
  for(let k=0;k<30;k++){const [hx,hz]=spick(placed),x=hx+SR(-6,6),z=hz+SR(-6,6),y=H(x,z);walls.push(part(new THREE.ConeGeometry(0.9,1,8),'#2f4a2c',M4(x,y+3,z,0,1,7,1)));}
  // lighthouse on the left point
  const lx=-232,lz=SHORE(-232)+3,ly=H(lx,lz);
  const tower=new THREE.CylinderGeometry(1.0,1.6,18,18,12).translate(0,9,0);{const p=tower.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const band=Math.floor(p.getY(i)/3.6)%2;_c.set(band?'#c8372d':'#f7f4ee');c[i*3]=_c.r;c[i*3+1]=_c.g;c[i*3+2]=_c.b;}tower.setAttribute('color',new THREE.BufferAttribute(c,3));}
  let tg=tower.toNonIndexed();tg.deleteAttribute('uv');tg.applyMatrix4(M4(lx,ly-0.5,lz));walls.push(tg);
  walls.push(part(CYL,'#3a3f45',M4(lx,ly+17.8,lz,0,2.9,0.25,2.9)));walls.push(part(CYL,'#fff1b8',M4(lx,ly+18.9,lz,0,1.6,2,1.6)));walls.push(part(new THREE.ConeGeometry(1.2,1.4,16),'#c8372d',M4(lx,ly+20.6,lz)));
  walls.push(part(BOX,'#f7f4ee',M4(lx+3.5,ly+1,lz+1,0.3,4,3,3.5)),part(CONE4,ROOF,M4(lx+3.5,ly+3.1,lz+1,0.3+Math.PI/4,4,1.2,3.5)));
  bake(walls,{flat:true,r:0.85});
  const beamG=new THREE.ConeGeometry(5,70,24,1,true).translate(0,-35,0).rotateZ(Math.PI/2);
  var beam=new THREE.Mesh(beamG,new THREE.MeshBasicMaterial({color:'#fff4c8',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.set(lx,ly+18.9,lz);scene.add(beam);
  var lampGlow=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,8),new THREE.MeshBasicMaterial({color:'#fff1b8',fog:false}));lampGlow.position.copy(beam.position);scene.add(lampGlow);
  const wg=mergeGeometries(winGlow.map(m=>{const g=new THREE.PlaneGeometry(1,1).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI)).applyMatrix4(m);g.deleteAttribute('uv');return g;}));
  var winMesh=new THREE.Mesh(wg,new THREE.MeshBasicMaterial({color:'#ffcf7a',transparent:true,opacity:0}));scene.add(winMesh);
}

// ============ 5. striped beach huts, parasols, childhood props ============
function stripes(c1,c2,n=8,w=128,h=128,vertical=true){return canvasTex(w,h,(g)=>{for(let i=0;i<n;i++){g.fillStyle=i%2?c2:c1;vertical?g.fillRect(i*w/n,0,w/n,h):g.fillRect(0,i*h/n,w,h/n);}})}
{
  const HC=['#4fa3d8','#f2c14e','#e2574c','#52b788','#f28cb1','#7b9de0','#ff9f1c','#2ec4b6'],roofP=[];
  HC.forEach((c,i)=>{const x=-31-i*3.1,z=SHORE(x)+27.5,y=H(x,z);
    const m=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.3,2),new THREE.MeshStandardMaterial({map:stripes(c,'#fbf7ef',6),roughness:0.8}));m.position.set(x,y+1.15,z);m.rotation.y=0.08;m.castShadow=m.receiveShadow=true;scene.add(m);
    roofP.push(part(new THREE.CylinderGeometry(1.45,1.45,2.3,3),'#fbf7ef',M4(x,y+2.75,z,0.08,1,1,0.75,0,Math.PI/2)));
    roofP.push(part(BOX,'#7a5a3a',M4(x,y+0.95,z-1.02,0.08,0.8,1.6,0.06)));roofP.push(part(BOX,'#c9a46a',M4(x,y+0.08,z-1.4,0.08,2.4,0.12,0.8)));});
  bake(roofP);
  // colourful parasols & towels
  const PS=[['#e2574c','#f6f1e7'],['#2e86ab','#f6f1e7'],['#f2c14e','#e2574c'],['#52b788','#f6f1e7'],['#f28cb1','#fbf7ef'],['#7b2cbf','#f2c14e']];
  const spots=[];for(let k=0;k<200&&spots.length<16;k++){const x=sr()<0.7?SR(-120,-42)*(sr()<0.5?1:-1):SR(-35,35),t=Math.abs(x)<38?SR(21,27):SR(12,26);if(spots.some(s=>Math.hypot(s[0]-x,s[1]-t)<6))continue;spots.push([x,t]);}
  const poleP=[];
  spots.forEach(([x,t],i)=>{const z=SHORE(x)+t,y=H(x,z),[a,b]=PS[i%PS.length];
    const c=new THREE.Mesh(new THREE.ConeGeometry(1.6,0.5,16,1,true),new THREE.MeshStandardMaterial({map:stripes(a,b,16,256,8),side:THREE.DoubleSide,roughness:0.8}));const tilt=SR(-0.15,0.15);c.position.set(x,y+2.3,z);c.rotation.z=tilt;c.castShadow=true;scene.add(c);
    poleP.push(part(CYL,'#efe9dc',M4(x,y+1.15,z,0,0.06,2.4,0.06,0,tilt)));
    const tw=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.8),new THREE.MeshStandardMaterial({map:stripes(b==='#f6f1e7'?a:b,'#fbf7ef',10,64,128,false),roughness:1}));tw.rotation.set(-Math.PI/2,0,SR(-0.6,0.6));tw.position.set(x+SR(0.9,1.5),y+0.03,z+SR(-0.5,0.5));tw.receiveShadow=true;scene.add(tw);});
  bake(poleP);
}
// sandcastle, bucket, spade, inflatable ring
const CASTLE={x:-12,z:SHORE(-12)+8.5};
{
  const x=CASTLE.x,z=CASTLE.z,y=H(x,z),S='#e3cfa3',P=[];
  P.push(part(CYL,S,M4(x,y+0.15,z,0,1.6,0.35,1.6)),part(BOX,S,M4(x,y+0.45,z,0,0.9,0.5,0.9)));
  for(const [dx,dz] of [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]]){P.push(part(CYL,S,M4(x+dx,y+0.55,z+dz,0,0.36,0.75,0.36)),part(new THREE.ConeGeometry(0.22,0.3,10),S,M4(x+dx,y+1.05,z+dz)));}
  P.push(part(CYL,'#d9c294',M4(x,y+0.85,z,0,0.5,0.4,0.5)),part(new THREE.ConeGeometry(0.3,0.4,10),S,M4(x,y+1.25,z)),part(CYL,'#7a5a3a',M4(x,y+1.6,z,0,0.015,0.6,0.015)));
  P.push(part(new THREE.CylinderGeometry(0.16,0.12,0.26,14,1,true),'#e2574c',M4(x+1.5,y+0.13,z+0.4)),part(CYL,'#e2574c',M4(x+1.5,y+0.01,z+0.4,0,0.24,0.02,0.24)));
  P.push(part(BOX,'#2e86ab',M4(x+1.2,y+0.03,z-0.9,0.6,0.14,0.02,0.5)),part(CYL,'#f2c14e',M4(x+1.05,y+0.04,z-0.65,0.6,0.025,0.4,0.025,Math.PI/2)));
  bake(P,{side:THREE.DoubleSide});
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.18),new THREE.MeshStandardMaterial({color:'#e2574c',side:THREE.DoubleSide}));flag.position.set(x+0.14,y+1.8,z);scene.add(flag);var castleFlag=flag;
}
const ring=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.16,12,24),new THREE.MeshStandardMaterial({map:stripes('#e2574c','#fbf7ef',8,128,16),roughness:0.4}));ring.rotation.x=-Math.PI/2;scene.add(ring);
const RING={x:8,t:-7};
// ice cream cart
const CART={x:-44,z:SHORE(-44)+21};
{
  const x=CART.x,z=CART.z,y=H(x,z),P=[];
  P.push(part(BOX,'#fbf7ef',M4(x,y+0.85,z,0.2,1.8,0.9,0.9)),part(BOX,'#4fa3d8',M4(x,y+0.6,z-0.46,0.2,1.8,0.25,0.02)),part(BOX,'#f28cb1',M4(x,y+1.32,z,0.2,1.9,0.06,1.0)));
  for(const dx of [-0.6,0.6])P.push(part(CYL,'#333',M4(x+dx*Math.cos(0.2),y+0.28,z-0.5-dx*Math.sin(0.2),0.2,0.5,0.06,0.5,0,Math.PI/2)));
  P.push(part(CYL,'#ddd',M4(x,y+1.9,z,0,0.04,1.2,0.04)));
  bake(P);
  const um=new THREE.Mesh(new THREE.ConeGeometry(1.3,0.45,12,1,true),new THREE.MeshStandardMaterial({map:stripes('#f2c14e','#fbf7ef',12,256,8),side:THREE.DoubleSide}));um.position.set(x,y+2.5,z);um.castShadow=true;scene.add(um);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.4),new THREE.MeshStandardMaterial({map:canvasTex(240,80,(c,w,h)=>{c.fillStyle='#fbf7ef';c.fillRect(0,0,w,h);c.fillStyle='#e2574c';c.font='700 46px Caveat, cursive';c.textAlign='center';c.textBaseline='middle';c.fillText('Glaces 🍦',w/2,h/2+3);})}));
  sign.position.set(x+0.1,y+1.62,z-0.52);sign.rotation.y=Math.PI+0.2;sign.rotation.y=0.2+Math.PI;scene.add(sign);sign.rotation.y=Math.PI+0.2;sign.lookAt(x+0.1-Math.sin(0.2)*5,y+1.62,z-5);
}

// ============ 6. people ============
const SKIN=['#f1c9a5','#e0ac83','#c68863','#8d5a3b','#5c3a24','#f5d6c0'],HAIR=['#2b1d14','#5a3825','#c99a5b','#1a1a1a','#8a4b2a','#d9d2c5'],CLOTH=['#e2574c','#2e86ab','#f2c14e','#52b788','#f28cb1','#ffffff','#7b2cbf','#ff9f1c','#264653','#f4a261'];
function makePerson(o={}){
  const s=o.kid?0.6:SR(0.93,1.07),g=new THREE.Group(),skin=std(o.skin||spick(SKIN),0.6),top=std(o.top||spick(CLOTH),0.8),bot=std(o.bot||spick(CLOTH),0.8),hair=std(o.hair||spick(HAIR),0.9);
  const legs=[],arms=[];
  for(const sd of [-1,1]){const p=new THREE.Group();p.position.set(0.09*sd,0.86,0);const l=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.05,0.82,8),skin);l.position.y=-0.41;p.add(l);const f=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.05,0.21),std(o.shoe||'#3a3a3a'));f.position.set(0,-0.84,0.04);p.add(f);g.add(p);legs.push(p);}
  const shorts=new THREE.Mesh(new THREE.CylinderGeometry(0.175,0.19,0.27,12),bot);shorts.position.y=0.93;g.add(shorts);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.165,0.56,12),o.bare?skin:top);torso.position.y=1.32;g.add(torso);
  if(o.dress){const d=new THREE.Mesh(new THREE.ConeGeometry(0.36,0.78,14,1,true),new THREE.MeshStandardMaterial({color:o.top||spick(CLOTH),side:THREE.DoubleSide,roughness:0.8}));d.position.y=0.95;g.add(d);}
  for(const sd of [-1,1]){const p=new THREE.Group();p.position.set(0.235*sd,1.55,0);const a=new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.04,0.6,8),skin);a.position.y=-0.3;p.add(a);const h=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),skin);h.position.y=-0.62;p.add(h);g.add(p);arms.push(p);}
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.1,8),skin);neck.position.y=1.64;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.125,14,10),skin);head.position.y=1.77;head.scale.set(1,1.08,1);g.add(head);
  const hr=new THREE.Mesh(new THREE.SphereGeometry(0.132,14,8,0,Math.PI*2,0,Math.PI*0.52),hair);hr.position.set(0,1.79,-0.01);g.add(hr);
  if(o.long){const lh=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.3,0.08),hair);lh.position.set(0,1.66,-0.1);g.add(lh);}
  if(o.hat){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.02,18),std('#e8cf8a',0.9));b.position.y=1.88;g.add(b);const t=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.14,0.11,14),std('#e8cf8a',0.9));t.position.y=1.94;g.add(t);const r=new THREE.Mesh(new THREE.CylinderGeometry(0.142,0.142,0.03,14),std('#c0392b'));r.position.y=1.905;g.add(r);}
  if(o.glasses){const gl=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.045,0.03),std('#111',0.2));gl.position.set(0,1.79,0.115);g.add(gl);}
  g.scale.setScalar(s);shadowAll(g);scene.add(g);
  return {g,legs,arms,s,h:1.95*s,head};
}
function walkAnim(p,ph,amp){const a=Math.sin(ph)*amp;p.legs[0].rotation.x=a;p.legs[1].rotation.x=-a;p.arms[0].rotation.x=-a*0.8;p.arms[1].rotation.x=a*0.8;}
function sitPose(p,lean=0){p.legs.forEach(l=>{l.rotation.x=-1.45;});p.g.children.forEach(()=>{});}
// --- dialogue (speech bubble + gentle French voice)
const css=document.createElement('style');css.textContent=`.bubble{position:fixed;left:0;top:0;transform:translate(-50%,-100%);background:rgba(255,255,255,.94);color:#2b2b33;font:500 15px/1.35 Inter,system-ui,sans-serif;padding:10px 15px;border-radius:18px;max-width:250px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none;opacity:0;transition:opacity .5s;z-index:3}.bubble.show{opacity:1}.bubble:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-top-color:rgba(255,255,255,.94);border-bottom:0}`;document.head.appendChild(css);
const bubble=document.createElement('div');bubble.className='bubble';document.body.appendChild(bubble);
let bubbleWho=null,bubbleT=0,lastSay=-99;
function speak(text,pitch){try{if(!('speechSynthesis' in window)||vol.nature<0.05)return;const u=new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s'’,.!?…-]/gu,''));u.lang='fr-FR';const vs=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('fr'));if(vs.length)u.voice=vs[Math.floor(pitch*7)%vs.length];u.rate=0.95;u.pitch=pitch;u.volume=Math.min(1,0.7*vol.nature+0.2);speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
function say(who,text){bubble.textContent=text;bubble.classList.add('show');bubbleWho=who;bubbleT=5;lastSay=T;speak(text,who.pitch||1);}
const COMPLIMENTS=["Bonjour ! Quelle belle journée, tu as l'air radieux.","Tu as un très beau sourire, garde-le !","Profite bien, tu le mérites vraiment.","Ça fait du bien de te voir ici !","Prends ton temps, ici rien ne presse.","Tu es exactement là où tu dois être.","L'eau est délicieuse aujourd'hui, va te baigner !","Les vacances te vont bien, tu as bonne mine !","Merci d'être là, la plage est plus belle avec toi.","Respire un grand coup… voilà, c'est ça les vacances.","Tu dégages une très belle énergie, tu sais ?","Je suis sûre que tu fais du bien aux gens autour de toi.","Bonne journée ! N'oublie pas la crème solaire.","Ce soir le coucher de soleil sera magnifique, ne le rate pas.","Tu fais partie des gens qui rendent le monde plus doux.","Il paraît que les dauphins sont passés ce matin !","Ici, tout le monde a le droit de se reposer. Toi aussi.","Tu as l'air serein, ça fait plaisir à voir.","Bienvenue à la plage ! Fais comme chez toi.","Tu as bien fait de venir, vraiment."];
let cIdx=Math.floor(Math.random()*COMPLIMENTS.length);
const nextCompliment=()=>COMPLIMENTS[(cIdx++)%COMPLIMENTS.length];
// --- strollers
const strollers=[];
const SPECS=[{hat:true,glasses:true,bare:true},{dress:true,long:true,hat:true},{glasses:true},{long:true,dress:true},{hat:true,top:'#ffffff'},{bare:true},{long:true}];
for(let i=0;i<7;i++){const p=makePerson(SPECS[i]);strollers.push({...p,x:SR(-70,50),t:SR(3.5,9),dir:sr()<0.5?1:-1,sp:SR(0.85,1.25),ph:sr()*6,pause:0,said:-99,pitch:SPECS[i].dress||SPECS[i].long?SR(1.05,1.25):SR(0.8,0.98),dog:null});}
// dog with the first stroller
function makeDog(){const g=new THREE.Group(),c=std('#b5772f',0.8),d=std('#7a4a1c',0.8);
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.24,0.62),c);body.position.y=0.42;g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.22),c);head.position.set(0,0.6,0.38);g.add(head);
  const sn=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.1,0.12),c);sn.position.set(0,0.55,0.53);g.add(sn);
  const nose=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.04,0.03),std('#111'));nose.position.set(0,0.58,0.6);g.add(nose);
  for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.14,0.08),d);e.position.set(0.09*s,0.66,0.33);e.rotation.z=0.3*s;g.add(e);}
  const tail=new THREE.Group();tail.position.set(0,0.5,-0.31);const tm=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.02,0.3,6),c);tm.position.y=0.15;tail.add(tm);tail.rotation.x=-0.8;g.add(tail);
  const legs=[];for(const [x,z] of [[-0.09,0.22],[0.09,0.22],[-0.09,-0.22],[0.09,-0.22]]){const p=new THREE.Group();p.position.set(x,0.32,z);const l=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.03,0.32,6),c);l.position.y=-0.16;p.add(l);g.add(p);legs.push(p);}
  shadowAll(g);scene.add(g);return {g,legs,tail,x:0,z:0,bark:MR(10,25)};}
const dog=makeDog();strollers[0].dog=dog;
// static scenes: castle kids, ball kids, sunbather, vendor, bartender, fire friends, swimmer
const kids=[makePerson({kid:true,hat:true}),makePerson({kid:true,long:true})];
kids.forEach((k,i)=>{const a=i?2.3:-0.6,x=CASTLE.x+Math.cos(a)*1.25,z=CASTLE.z+Math.sin(a)*1.25;k.g.position.set(x,H(x,z)-0.42*k.s,z);k.g.rotation.y=Math.atan2(CASTLE.x-x,CASTLE.z-z);k.legs.forEach(l=>l.rotation.x=-1.5);k.pitch=1.6;});
const ballKids=[makePerson({kid:true,bare:true}),makePerson({kid:true,long:true,dress:true})];
const BK=[[24,10],[29.5,12.5]].map(([x,t])=>new THREE.Vector3(x,0,SHORE(x)+t));
ballKids.forEach((k,i)=>{const p=BK[i],o=BK[1-i];p.y=H(p.x,p.z);k.g.position.copy(p);k.g.rotation.y=Math.atan2(o.x-p.x,o.z-p.z);k.pitch=1.7;});
const ball=new THREE.Mesh(new THREE.SphereGeometry(0.2,16,12),new THREE.MeshStandardMaterial({map:canvasTex(128,64,(g,w,h)=>{const cs=['#e2574c','#fbf7ef','#2e86ab','#fbf7ef','#f2c14e','#fbf7ef'];cs.forEach((c,i)=>{g.fillStyle=c;g.fillRect(i*w/6,0,w/6,h);});}),roughness:0.4}));ball.castShadow=true;scene.add(ball);
const sun1=makePerson({bare:true,glasses:true});{const x=-36,z=SHORE(-36)+23.5;sun1.g.position.set(x,H(x,z)+0.12,z);sun1.g.rotation.set(-Math.PI/2,0,0.3,'YXZ');}
const vendor=makePerson({hat:true,top:'#ffffff',bot:'#2e86ab'});{const x=CART.x+0.4,z=CART.z+1;vendor.g.position.set(x,H(x,z),z);vendor.g.rotation.y=Math.PI*0.9;vendor.pitch=0.9;}
const PX=-70,PZ=SHORE(-70)+15;
const barman=makePerson({top:'#f28cb1',glasses:true});barman.g.position.set(PX,H(PX,PZ),PZ+0.35);barman.pitch=0.85;
const FX=-22,FZ=SHORE(-22)+11;
const fireFriends=[makePerson({long:true}),makePerson({hat:false})];
[[2.2,0.4],[-0.6,2.1]].forEach(([dx,dz],i)=>{const p=fireFriends[i],x=FX+dx,z=FZ+dz;p.g.position.set(x,H(FX,FZ)+0.32-0.86*p.s+0.1,z);p.g.rotation.y=Math.atan2(FX-x,FZ-z);p.legs.forEach(l=>l.rotation.x=-1.5);p.arms.forEach(a=>a.rotation.x=-0.6);p.pitch=1.1;});
const swimmer=makePerson({bare:true});swimmer.legs.forEach(l=>l.visible=false);
const sitters=[kids[0],kids[1],vendor,barman,fireFriends[0],fireFriends[1],ballKids[0]];
const LINES=new Map([[kids[0],"Tu viens nous aider à construire le château ?"],[kids[1],"Regarde notre château, c'est le plus beau de la plage !"],[vendor,"Une glace à la vanille ? C'est offert, c'est les vacances !"],[barman,"Un jus d'ananas bien frais ? C'est la maison qui offre !"],[fireFriends[0],"Viens t'asseoir près du feu, on regarde les étoiles filantes."],[fireFriends[1],"Tu entends la mer ? On pourrait l'écouter toute la nuit."],[ballKids[0],"Tu veux jouer au ballon avec nous ?"]]);
const saidAt=new Map();

// ============ 7. animals: sandpipers, sea turtle, fish school, pelicans ============
function makePiper(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(0.06,10,8),std('#a08060'));b.scale.set(1,0.9,1.7);b.position.y=0.13;g.add(b);
  const be=new THREE.Mesh(new THREE.SphereGeometry(0.058,10,8,0,Math.PI*2,Math.PI/2,Math.PI/2),std('#f2eee6'));be.scale.set(1,0.9,1.7);be.position.y=0.125;g.add(be);
  const h=new THREE.Group();h.position.set(0,0.18,0.08);const hm=new THREE.Mesh(new THREE.SphereGeometry(0.032,8,6),std('#a08060'));h.add(hm);const bk=new THREE.Mesh(new THREE.ConeGeometry(0.008,0.07,5),std('#222'));bk.rotation.x=Math.PI/2;bk.position.z=0.05;h.add(bk);g.add(h);
  const legs=[];for(const s of [-1,1]){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.1,4),std('#333'));l.position.set(0.018*s,0.05,0);g.add(l);legs.push(l);}g.scale.setScalar(1.4);shadowAll(g);scene.add(g);return {g,h,legs};}
const pipers=[];for(let i=0;i<8;i++){const p=makePiper();p.x=MR(-25,25);p.off=MR(0.3,1.3);p.peck=0;p.cur=null;pipers.push(p);}
function edgeT(L){return L>0?L/0.03:L/0.045;}
// sea turtle
const turtle=new THREE.Group();{const sh=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,10),new THREE.MeshStandardMaterial({map:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#5b4a2a';g.fillRect(0,0,w,h);g.strokeStyle='#c9a35a';g.lineWidth=3;for(let i=0;i<14;i++){g.beginPath();const x=(i%4)*36+(Math.floor(i/4)%2)*18,y=Math.floor(i/4)*36;for(let k=0;k<7;k++){const a=k/6*Math.PI*2;g.lineTo(x+Math.cos(a)*16,y+Math.sin(a)*16);}g.stroke();}}),roughness:0.5}));sh.scale.set(1,0.35,1.25);turtle.add(sh);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(0.14,10,8),std('#7d8a5a'));hd.position.set(0,0.02,0.7);hd.scale.set(1,0.8,1.3);turtle.add(hd);
  turtle.userData.fl=[];for(const [x,z,s] of [[0.45,0.35,1],[-0.45,0.35,1],[0.35,-0.45,0.6],[-0.35,-0.45,0.6]]){const p=new THREE.Group();p.position.set(x,0,z);const f=new THREE.Mesh(new THREE.BoxGeometry(0.5*s,0.04,0.2*s),std('#7d8a5a'));f.position.x=Math.sign(x)*0.25*s;p.add(f);turtle.add(p);turtle.userData.fl.push(p);}
  turtle.scale.setScalar(1.2);scene.add(turtle);}
// fish school (visible through shallow water)
const FISH=36,fishM=new THREE.InstancedMesh(new THREE.ConeGeometry(0.05,0.28,6).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:'#c9d6dc',metalness:0.6,roughness:0.3}),FISH);fishM.frustumCulled=false;scene.add(fishM);
const fishPh=Array.from({length:FISH},()=>[Math.random()*6.28,MR(0.6,1.4),MR(-0.6,0.6),MR(-0.25,0.25)]);
// pelicans
function makeBird(cBody,cWing,span){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),std(cBody));b.scale.set(1,0.9,3);g.add(b);
  const bk=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.5,6),std('#e0a040'));bk.rotation.x=Math.PI/2;bk.position.set(0,0.05,0.85);g.add(bk);
  const wings=[];for(const s of [1,-1]){const r=new THREE.Group();r.scale.x=s;g.add(r);const sh=new THREE.Shape();sh.moveTo(0,0.2);sh.lineTo(span,0.05);sh.lineTo(span*0.9,-0.15);sh.lineTo(0,-0.2);const w=new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:cWing,side:THREE.DoubleSide,roughness:0.8}));r.add(w);wings.push(r);}
  g.rotation.order='YXZ';shadowAll(g);scene.add(g);return {g,wings};}
const pelicans=[0,1,2,3].map(()=>makeBird('#c9c4ba','#8f8a82',1.3));let pelT=8;

// ============ 8. boats far away ============
const boats=[];
function sailboat(hull,sail,sc=1){const P=[part(BOX,hull,M4(0,0.3,0,0,1.6,0.7,5)),part(new THREE.ConeGeometry(0.8,1.4,4),hull,M4(0,0.3,3.1,Math.PI/4,1,1,0.75,Math.PI/2)),part(BOX,'#fbf7ef',M4(0,0.85,-0.6,0,1.1,0.5,1.8)),part(CYL,'#ddd',M4(0,4.2,0.4,0,0.08,7.2,0.08))];
  const s1=new THREE.Shape();s1.moveTo(0,0);s1.lineTo(0,6.4);s1.lineTo(-2.6,0.2);const s2=new THREE.Shape();s2.moveTo(0,0);s2.lineTo(0,5.8);s2.lineTo(2.2,0);
  P.push(part(new THREE.ShapeGeometry(s1).rotateY(Math.PI/2),sail,M4(0,1,0.3)),part(new THREE.ShapeGeometry(s2).rotateY(Math.PI/2),'#fbf7ef',M4(0,1,0.6)));
  const m=bake(P,{side:THREE.DoubleSide});m.scale.setScalar(sc);return m;}
function ferry(){const P=[part(BOX,'#fbf7ef',M4(0,1.5,0,0,8,3,40)),part(BOX,'#1f4e8c',M4(0,0.6,0,0,8.05,0.6,40.1)),part(BOX,'#fbf7ef',M4(0,3.8,-2,0,6.5,1.8,24)),part(BOX,'#fbf7ef',M4(0,5.3,-4,0,5,1.3,14)),part(CYL,'#e2574c',M4(0,7.2,-8,0,1.8,3,1.8)),part(BOX,'#2a3b52',M4(0,3.9,-2,0,6.6,0.4,23))];return bake(P);}
function fisher(){const P=[part(BOX,'#c0392b',M4(0,0.5,0,0,2.4,1,7)),part(new THREE.ConeGeometry(1.2,1.8,4),'#c0392b',M4(0,0.5,4.3,Math.PI/4,1,1,0.8,Math.PI/2)),part(BOX,'#fbf7ef',M4(0,1.6,-1,0,1.8,1.4,2.2)),part(CYL,'#555',M4(0,3.2,1.5,0,0.08,4,0.08)),part(CYL,'#555',M4(0,2.5,-3,0,0.06,2.5,0.06,0.6))];return bake(P);}
function smallBoat(c){return bake([part(BOX,c,M4(0,0.25,0,0,1.2,0.5,3.6)),part(new THREE.ConeGeometry(0.6,1,4),c,M4(0,0.25,2.2,Math.PI/4,1,1,0.7,Math.PI/2)),part(BOX,'#fbf7ef',M4(0,0.65,-0.3,0,0.9,0.4,0.8))]);}
const add=(mesh,o)=>{boats.push({m:mesh,...o});};
add(sailboat('#fbf7ef','#fbf7ef'),{z:-420,x:-200,v:1.2,amp:0.25});
add(sailboat('#1f4e8c','#f2c14e'),{z:-560,x:150,v:-0.9,amp:0.25});
add(sailboat('#fbf7ef','#e2574c'),{z:-700,x:-50,v:0.8,amp:0.3});
add(sailboat('#e2574c','#fbf7ef',0.8),{z:-330,x:300,v:-1.4,amp:0.2});
add(sailboat('#fbf7ef','#2ec4b6'),{z:-900,x:-400,v:1.0,amp:0.3});
add(ferry(),{z:-1250,x:-900,v:3.2,amp:0.1,horn:true});
add(fisher(),{z:-480,x:420,v:-1.6,amp:0.3});
const motor=smallBoat('#fbf7ef');const MB={on:false,t:30,x:0,z:-205,v:13};
const kayak=new THREE.Group();{const k=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,8),std('#f2c14e',0.4));k.scale.set(0.6,0.35,5);kayak.add(k);const pp=makePerson({bare:true});scene.remove(pp.g);pp.legs.forEach(l=>l.visible=false);pp.g.position.y=-0.75;kayak.add(pp.g);kayak.userData.p=pp;
  const pad=new THREE.Group();pad.position.y=0.65;const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,2.2,6),std('#333'));sh.rotation.z=Math.PI/2;pad.add(sh);for(const s of [-1,1]){const bl=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.02,0.14),std('#e2574c'));bl.position.x=1.1*s;pad.add(bl);}kayak.add(pad);kayak.userData.pad=pad;scene.add(kayak);}
// wake for the motorboat
const WK=90,wkPos=new Float32Array(WK*3).fill(-999),wkAge=new Float32Array(WK).fill(9);let wkI=0;
const wkGeo=new THREE.BufferGeometry();wkGeo.setAttribute('position',new THREE.BufferAttribute(wkPos,3));
const wake=new THREE.Points(wkGeo,new THREE.PointsMaterial({color:0xffffff,size:0.6,transparent:true,opacity:0.7,depthWrite:false}));wake.frustumCulled=false;scene.add(wake);

// ============ 9. audio extras ============
let motorSnd=null,bellT=12,hornT=40;
function bell(pan,g){if(!AC)return;[2093,2637].forEach((f,i)=>{const t=AC.currentTime+i*0.14,o=AC.createOscillator(),gn=AC.createGain(),p=AC.createStereoPanner();o.type='triangle';o.frequency.value=f;p.pan.value=pan;o.connect(gn).connect(p).connect(bus.nature);env1(gn,t,0.004,0.06*g,1.2);o.start(t);o.stop(t+1.3);});}
function horn(g){if(!AC)return;const t=AC.currentTime;[110,138.6].forEach(f=>{const o=AC.createOscillator(),lp=AC.createBiquadFilter(),gn=AC.createGain();o.type='sawtooth';o.frequency.value=f;lp.type='lowpass';lp.frequency.value=380;o.connect(lp).connect(gn).connect(bus.nature);gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(0.05*g,t+0.4);gn.gain.setValueAtTime(0.05*g,t+2.2);gn.gain.linearRampToValueAtTime(0,t+3.2);o.start(t);o.stop(t+3.3);});}
function bark(pan,g){if(!AC)return;for(let i=0;i<2;i++)setTimeout(()=>noiseHit(bus.nature,620,2.5,0.18*g,0.005,0.12,pan),i*220);}
function pop(pan,g){if(AC)noiseHit(bus.nature,900,1.5,0.12*g,0.002,0.06,pan);}

// ============ per-frame update ============
let T=0;const _p=new THREE.Vector3();
hooks.push((dt,time)=>{
  T=time;const L=lit(),day=env.day,lv=lvl();
  // village lights + lighthouse
  winMesh.material.opacity=L*0.95;winMesh.visible=L>0.02;
  beam.material.opacity=L*0.22;beam.visible=L>0.02;beam.rotation.y=T*0.6;lampGlow.material.color.setScalar(0.6+L*1.4);
  castleFlag.rotation.y=Math.sin(T*3)*0.4;
  // inflatable ring bobbing
  {const x=RING.x+Math.sin(T*0.1)*3,z=SHORE(x)+RING.t+Math.cos(T*0.13)*1.5;ring.position.set(x,lv+0.06+Math.sin(T*1.6)*0.05,z);ring.rotation.z=T*0.05;}
  // strollers
  const showPeople=day>0.3;
  for(const w of strollers){w.g.visible=showPeople;if(!showPeople){if(w.dog)w.dog.g.visible=false;continue;}
    if(w.pause>0){w.pause-=dt;walkAnim(w,0,0);}
    else{w.x+=w.dir*w.sp*dt;if(w.x>58||w.x<-78){w.dir*=-1;}w.ph+=dt*w.sp*5.2;walkAnim(w,w.ph,0.55);w.g.rotation.y=w.dir>0?Math.PI/2:-Math.PI/2;
      if(Math.random()<dt*0.02){w.pause=MR(3,7);w.g.rotation.y=Math.PI;}}
    const z=SHORE(w.x)+w.t;w.g.position.set(w.x,H(w.x,z),z);
    const d=camDist(w.x,z);
    if(state.started&&d<8.5&&T-w.said>70&&T-lastSay>14&&bubbleT<=0){w.said=T;w.pause=4.5;w.g.rotation.y=Math.atan2(camera.position.x-w.x,camera.position.z-z);w.arms[1].rotation.x=-2.4;say(w,nextCompliment());}
    if(w.pause>3.5&&w.pause<4.4)w.arms[1].rotation.z=Math.sin(T*10)*0.3;else w.arms[1].rotation.z=0;
    if(w.dog){const dg=w.dog;dg.g.visible=true;const tx=w.x+w.dir*1.4+Math.sin(T*0.6)*1.5,tz=z-1.2+Math.sin(T*0.45)*1.4;const vx=tx-dg.x,vz=tz-dg.z;dg.x+=vx*Math.min(1,dt*2);dg.z+=vz*Math.min(1,dt*2);
      const sp=Math.hypot(vx,vz);dg.g.position.set(dg.x,H(dg.x,dg.z),dg.z);if(sp>0.05)dg.g.rotation.y=Math.atan2(vx,vz);
      dg.legs.forEach((l,i)=>l.rotation.x=Math.sin(T*14+(i%2?Math.PI:0)+(i>1?1:0))*0.6*Math.min(1,sp));dg.tail.rotation.z=Math.sin(T*16)*0.6;
      dg.bark-=dt;if(dg.bark<=0){dg.bark=MR(15,35);const dd=camDist(dg.x,dg.z);if(dd<30)bark(camPan(dg.x,dg.z),1/(1+dd*0.12));}}}
  // sitters lines
  for(const p of sitters){const vis=p===fireFriends[0]||p===fireFriends[1]?L>0.4:(p===barman?true:day>0.3);p.g.visible=vis;if(!vis)continue;
    const d=camDist(p.g.position.x,p.g.position.z);if(state.started&&d<5.5&&T-(saidAt.get(p)??-999)>90&&T-lastSay>10&&bubbleT<=0){saidAt.set(p,T);say(p,LINES.get(p));}}
  kids.forEach((k,i)=>{k.arms.forEach((a,j)=>a.rotation.x=-1.0+Math.sin(T*(3+i)+j*2)*0.5);});
  // ball game
  {const vis=day>0.3;ball.visible=ballKids[0].g.visible=ballKids[1].g.visible=vis;if(vis){const per=2.2,ph=(T/per)%2,i=Math.floor(ph),s=ph-i,a=BK[i],b=BK[1-i];
    _p.copy(a).lerp(b,s);_p.y=a.y+1.3+Math.sin(Math.PI*s)*2.6;ball.position.copy(_p);ball.rotation.x+=dt*6;
    ballKids.forEach((k,j)=>{const up=(j===i&&s<0.15)||(j!==i&&s>0.85);k.arms.forEach(ar=>ar.rotation.x=up?-2.8:-0.2);});
    if(s<dt/per*2&&camDist(a.x,a.z)<35)pop(camPan(a.x,a.z),1/(1+camDist(a.x,a.z)*0.1));}}
  sun1.g.visible=day>0.5;
  // swimmer
  {swimmer.g.visible=day>0.3;const x=-5+Math.sin(T*0.05)*20,z=SHORE(x)-24;swimmer.g.position.set(x,lv-1.45*swimmer.s+Math.sin(T*1.3)*0.06,z);swimmer.g.rotation.set(0.7,Math.cos(T*0.05)>0?Math.PI/2:-Math.PI/2,0,'YXZ');swimmer.arms[0].rotation.x=Math.sin(T*2.2)*2;swimmer.arms[1].rotation.x=Math.sin(T*2.2+Math.PI)*2;}
  // sandpipers chase the swash
  const piperVis=day>0.3;const et=edgeT(lv);
  for(const p of pipers){p.g.visible=piperVis;if(!piperVis)continue;p.x+=Math.sin(T*0.07+p.off*3)*dt*0.3;const z=SHORE(p.x)+et+p.off;
    if(!p.cur)p.cur=new THREE.Vector3(p.x,0,z);const dz=z-p.cur.z;p.cur.x=p.x;p.cur.z+=clamp(dz,-dt*2.2,dt*2.2);
    const moving=Math.abs(dz)>0.05;p.g.position.set(p.cur.x,H(p.cur.x,p.cur.z),p.cur.z);p.g.rotation.y=moving?(dz>0?0:Math.PI):p.g.rotation.y;
    p.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(T*40+i*Math.PI)*0.7:0);p.h.rotation.x=moving?0:Math.max(0,Math.sin(T*4+p.off*9))*1.0;}
  // turtle
  {const a=T*0.09,x=-14+Math.cos(a)*7,z=SHORE(-14)-12+Math.sin(a)*4,surf=Math.max(0,Math.sin(T*0.12))**8;turtle.position.set(x,Math.min(lv-0.15,H(x,z)+0.5)*(1-surf)+(lv-0.12)*surf-0.5*(1-surf),z);
    turtle.rotation.y=Math.atan2(-Math.sin(a)*7,Math.cos(a)*4);turtle.userData.fl.forEach((f,i)=>f.rotation.z=Math.sin(T*1.6+(i%2?Math.PI:0))*0.5*(i<2?1:0.6));}
  // fish
  {const o=new THREE.Object3D(),cx=6+Math.sin(T*0.04)*10,cz=SHORE(6)-9;for(let i=0;i<FISH;i++){const [ph,r,dy,ds]=fishPh[i],a=T*0.5+ph*0.25;o.position.set(cx+Math.cos(a+ds)*2.5*r,lv-0.55+dy*0.3+Math.sin(T*2+ph)*0.05,cz+Math.sin(a+ds)*1.6*r);o.rotation.set(0,a+Math.PI,0);o.rotation.y=-a;o.updateMatrix();fishM.setMatrixAt(i,o.matrix);}fishM.instanceMatrix.needsUpdate=true;fishM.visible=day>0.2;}
  // pelicans pass in a line
  pelT-=dt;const pv=day>0.3;
  pelicans.forEach((b,i)=>{b.g.visible=pv&&pelT<0;if(!b.g.visible)return;const s=-pelT*9-i*5,x=-220+s,z=-70-i*3+Math.sin(s*0.01)*10,y=4+Math.sin(T*0.5+i)*0.6;b.g.position.set(x,y,z);b.g.rotation.set(0,Math.PI/2,0);const fl=(Math.floor((T+i*0.3)/3)%2)?Math.sin(T*5+i*0.6)*0.5:0.05;b.wings.forEach(w=>w.rotation.z=fl);});
  if(pelT<-50)pelT=MR(50,90);
  // boats
  for(const b of boats){b.x+=b.v*dt;if(b.x>1600)b.x=-1600;if(b.x<-1600)b.x=1600;b.m.position.set(b.x,Math.sin(T*0.8+b.z)*b.amp,b.z);b.m.rotation.set(Math.sin(T*0.6+b.x*0.01)*0.04,b.v>0?Math.PI/2:-Math.PI/2,Math.sin(T*0.7)*0.03);}
  // motorboat across the bay
  if(!MB.on){MB.t-=dt;motor.visible=false;if(MB.t<=0&&day>0.3){MB.on=true;MB.dir=Math.random()<0.5?1:-1;MB.x=-260*MB.dir;MB.z=MR(-215,-150);}}
  else{MB.x+=MB.v*MB.dir*dt;motor.visible=true;motor.position.set(MB.x,lv+0.05+Math.sin(T*6)*0.04,MB.z);motor.rotation.set(-0.06,MB.dir>0?Math.PI/2:-Math.PI/2,0);
    const i=(wkI++)%WK;wkPos[i*3]=MB.x-MB.dir*2.2+MR(-0.4,0.4);wkPos[i*3+1]=lv+0.05;wkPos[i*3+2]=MB.z+MR(-0.8,0.8);wkAge[i]=0;
    if(Math.abs(MB.x)>270){MB.on=false;MB.t=MR(60,120);}}
  for(let i=0;i<WK;i++){wkAge[i]+=dt;if(wkAge[i]>4)wkPos[i*3+1]=-999;else{wkPos[i*3+2]+=(i%2?1:-1)*dt*0.8;}}wkGeo.attributes.position.needsUpdate=true;
  // kayak
  {kayak.visible=day>0.3;const x=Math.sin(T*0.03)*40,z=SHORE(x)-17;kayak.position.set(x,lv+0.08+Math.sin(T*1.4)*0.04,z);kayak.rotation.set(Math.sin(T*1.1)*0.04,Math.cos(T*0.03)>0?Math.PI/2:-Math.PI/2,Math.sin(T*2.4)*0.06);kayak.userData.pad.rotation.z=Math.sin(T*2.4)*0.6;}
  // bubble follows the speaker
  if(bubbleT>0){bubbleT-=dt;const w=bubbleWho;_p.copy(w.g.position);_p.y+=w.h+0.35;_p.project(camera);if(_p.z>1||bubbleT<=0){bubble.classList.remove('show');if(bubbleT<=0)bubbleWho=null;}else{bubble.style.left=((_p.x+1)/2*innerWidth)+'px';bubble.style.top=((1-_p.y)/2*innerHeight)+'px';}}
  // audio
  if(AC&&AC.state==='running'){const t=AC.currentTime;
    if(!motorSnd){const o=AC.createOscillator(),o2=AC.createOscillator(),lp=AC.createBiquadFilter(),g=AC.createGain(),p=AC.createStereoPanner();o.type='sawtooth';o.frequency.value=78;o2.type='square';o2.frequency.value=39;lp.type='lowpass';lp.frequency.value=260;g.gain.value=0;o.connect(lp);o2.connect(lp);lp.connect(g).connect(p).connect(bus.nature);o.start();o2.start();motorSnd={g,p};}
    const md=MB.on?camDist(MB.x,MB.z):999;motorSnd.g.gain.setTargetAtTime(MB.on?0.05/(1+(md/60)**2):0,t,0.3);motorSnd.p.pan.setTargetAtTime(MB.on?camPan(MB.x,MB.z):0,t,0.2);
    bellT-=dt;if(bellT<=0){bellT=MR(25,45);const d=camDist(CART.x,CART.z);if(day>0.3&&d<60)bell(camPan(CART.x,CART.z),1/(1+d*0.05));}
    hornT-=dt;if(hornT<=0){hornT=MR(70,140);horn(0.6);}
  }
});
