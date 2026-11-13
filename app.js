import * as THREE from 'three';

// ============ shared state / hooks (used by extras.js) ============
const hooks=[],postHooks=[],clickHooks=[],drawHooks=[];
const ui={writeMode:false};
const state={mode:'calm',started:false,moment:'coucher'};
// ============ utils ============
const LOW=new URLSearchParams(location.search).has('low');
const isTouch=matchMedia('(pointer:coarse)').matches;
let seed=12345;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const R=(a,b)=>a+(b-a)*rnd();
const pick=a=>a[Math.floor(rnd()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function hash2(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s)}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);const a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const fbm=(x,z)=>vnoise(x,z)*0.5+vnoise(x*2.03,z*2.03)*0.3+vnoise(x*4.1,z*4.1)*0.2;
const gauss=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));

// ============ world shape ============
const SHORE=x=>-0.0035*x*x+5*Math.sin(x*0.021)+2.5*Math.sin(x*0.053+1.3);
function H(x,z){
  const t=z-SHORE(x),ax=Math.abs(x);
  let h=t<0?t*0.045-Math.max(0,-t-25)*0.06:t*0.03;
  h+=smooth(30,80,t)*(1.6+3.5*fbm(x*0.018+3,z*0.018));
  h+=smooth(180,300,ax)*smooth(-6,10,t)*(3+12*fbm(x*0.025+11,z*0.025+5));
  h+=(vnoise(x*0.45,z*0.8)-0.5)*0.05*(1-smooth(25,40,t));
  return h;
}

// ============ renderer ============
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=!LOW;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xffffff,0.0011);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,6000);
camera.rotation.order='YXZ';
const sun=new THREE.DirectionalLight(0xffffff,2);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:300});
sun.shadow.bias=-0.0003;sun.shadow.normalBias=0.03;
const hemi=new THREE.HemisphereLight(0xffffff,0x887766,0.6);
scene.add(sun,sun.target,hemi);

// ============ moments (presets) ============
const PRESETS={
  matin:  {elev:9, az:118,zen:'#5a8fd8',hor:'#f5cba6',sun:'#ffd2a1',sunI:2.4,hemiI:0.8, glow:1.1,clouds:0.45,deep:'#0b4a6a',shal:'#3cc8bb',light:0.85,stars:0,  exp:1.05,day:0.9,wind:0.6},
  jour:   {elev:52,az:160,zen:'#2a6cc6',hor:'#b3d9f0',sun:'#fff7ea',sunI:3.0,hemiI:0.95,glow:0.6,clouds:0.4, deep:'#07507f',shal:'#22e0cc',light:1.0, stars:0,  exp:0.9, day:1.0,wind:0.8},
  coucher:{elev:3.2,az:181,zen:'#3c4f92',hor:'#ffaa72',sun:'#ff9a55',sunI:2.0,hemiI:0.75,glow:1.5,clouds:0.55,deep:'#1d3150',shal:'#4d7478',light:0.6, stars:0.05,exp:1.15,day:0.6,wind:0.5},
  nuit:   {elev:26,az:196,zen:'#040a1d',hor:'#17284a',sun:'#a9bfff',sunI:0.7,hemiI:0.5,glow:0.3,clouds:0.25,deep:'#02060e',shal:'#0b2630',light:0.16,stars:1,  exp:1.35,day:0.0,wind:0.35},
};
const NUMS=['elev','az','sunI','hemiI','glow','clouds','light','stars','exp','day','wind'],COLS=['zen','hor','sun','deep','shal'];
const env={},target={};let moment='coucher';
function loadPreset(dst,p){for(const k of NUMS)dst[k]=p[k];for(const k of COLS){dst[k]=dst[k]||new THREE.Color();dst[k].set(p[k]);}}
loadPreset(env,PRESETS[moment]);loadPreset(target,PRESETS[moment]);
const sunDir=new THREE.Vector3();

// ============ shared shader chunks ============
const U={time:{value:0},wind:{value:0.6}};
const SKYU={uSunDir:{value:sunDir},uZenith:{value:env.zen},uHorizon:{value:env.hor},uSunCol:{value:env.sun},uGlow:{value:1}};
const NOISE_GLSL=`
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}`;
const SKY_GLSL=`
uniform vec3 uSunDir;uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uSunCol;uniform float uGlow;
vec3 skyCol(vec3 d){
  float h=clamp(d.y,0.0,1.0);
  vec3 c=mix(uHorizon,uZenith,pow(h,0.45));
  float s=max(dot(normalize(vec3(d.x,max(d.y,0.0),d.z)),uSunDir),0.0);
  c+=uSunCol*(pow(s,6.0)*0.35+pow(s,40.0)*0.55)*uGlow;
  return c;
}`;

// ============ sky ============
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{...SKYU,uTime:U.time,uStars:{value:0},uClouds:{value:0.5}},
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
  fragmentShader:`uniform float uTime;uniform float uStars;uniform float uClouds;varying vec3 vDir;${NOISE_GLSL}${SKY_GLSL}
  void main(){
    vec3 d=normalize(vDir);vec3 col=skyCol(d);
    float s=max(dot(d,uSunDir),0.0);
    col+=uSunCol*smoothstep(0.99955,0.9998,s)*6.0*smoothstep(-0.02,0.01,d.y);
    if(d.y>0.0){
      vec2 uv=d.xz/(d.y+0.12)*0.55+uTime*vec2(0.004,0.0015);
      float n=noise(uv)*0.55+noise(uv*2.3+3.1)*0.28+noise(uv*5.1+7.7)*0.17;
      float cov=smoothstep(0.52,0.82,n)*smoothstep(0.0,0.22,d.y)*uClouds;
      vec3 cc=mix(uHorizon*1.05+uZenith*0.15,uSunCol*1.3,pow(s,3.0)*0.65+0.15);
      col=mix(col,cc,cov);
      vec3 sd=floor(d*420.0);float st=hash(sd.xy+sd.z*1.73);
      col+=vec3(0.9,0.95,1.0)*step(0.9982,st)*uStars*(0.55+0.45*sin(uTime*2.0+st*90.0))*smoothstep(0.02,0.25,d.y)*(1.0-cov);
    }
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(3000,48,24),skyMat);sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);

// ============ terrain ============
const TW=800,TD=520,TX=-400,TZ=-340;
const tg=new THREE.PlaneGeometry(TW,TD,LOW?200:400,LOW?130:260);tg.rotateX(-Math.PI/2);tg.translate(0,0,TZ+TD/2);
{
  const p=tg.attributes.position,cols=new Float32Array(p.count*3),c=new THREE.Color(),tmp=new THREE.Color();
  const WD=new THREE.Color('#9b8a6a'),WET=new THREE.Color('#b9a582'),DRY=new THREE.Color('#e8d5b0'),GR=new THREE.Color('#8f9a5a'),RK=new THREE.Color('#8a8074');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),h=H(x,z),t=z-SHORE(x);p.setY(i,h);
    if(h<0.3)c.copy(WD).lerp(WET,smooth(-2.5,0.0,h));else c.copy(WET).lerp(DRY,smooth(0.18,0.45,h));
    c.multiplyScalar(0.94+0.1*vnoise(x*0.7,z*0.7));
    c.lerp(GR,smooth(40,62,t)*smooth(0.35,0.62,fbm(x*0.05,z*0.05))*0.85);
    c.lerp(RK,smooth(180,300,Math.abs(x))*smooth(0,8,t)*smooth(0.8,3,h));
    cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;
  }
  tg.setAttribute('color',new THREE.BufferAttribute(cols,3));tg.computeVertexNormals();
}
const sandMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.96,metalness:0});
sandMat.onBeforeCompile=sh=>{
  sh.vertexShader='varying vec3 vTW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='varying vec3 vTW;\n'+NOISE_GLSL+'\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float gn=noise(vTW.xz*5.0)*0.45+noise(vTW.xz*17.0)*0.35+noise(vTW.xz*0.8)*0.2;
    float rip=sin(vTW.x*1.6+vTW.z*3.1+noise(vTW.xz*0.4)*5.0);
    diffuseColor.rgb*=0.9+0.16*gn+0.035*rip;`);
};
const terrain=new THREE.Mesh(tg,sandMat);
terrain.receiveShadow=true;scene.add(terrain);

// ============ rocks ============
const rocks=[];
for(const side of [-1,1]){
  for(let k=0;k<32;k++){const x=side*R(165,300),z=SHORE(x)+R(-14,5),s=R(1.4,4.6);rocks.push({x,z,s,sy:s*R(0.55,1.0)});}
  for(let k=0;k<12;k++){const x=side*R(105,165),z=SHORE(x)+R(-18,-2),s=R(0.6,2.2);rocks.push({x,z,s,sy:s*R(0.5,0.9)});}
}
for(let k=0;k<14;k++){let x=R(-130,130);if(Math.abs(x)<45)x+=Math.sign(x||1)*45;const z=SHORE(x)+R(4,28),s=R(0.25,0.6);rocks.push({x,z,s,sy:s*0.6});}
for(const r of rocks)r.y=H(r.x,r.z)-r.sy*0.35;
{
  const geos=[];for(let k=0;k<5;k++){const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const f=0.75+0.5*vnoise(x*1.6+k*9,y*1.6+z*1.3+k*3);p.setXYZ(i,x*f,y*f,z*f);}
    g.computeVertexNormals();geos.push(g);}
  const mat=new THREE.MeshStandardMaterial({color:'#7d7368',roughness:0.92,flatShading:true});
  const groups=geos.map(()=>[]);rocks.forEach((r,i)=>groups[i%geos.length].push(r));
  const o=new THREE.Object3D(),col=new THREE.Color();
  groups.forEach((list,k)=>{const m=new THREE.InstancedMesh(geos[k],mat,list.length);
    list.forEach((r,i)=>{o.position.set(r.x,r.y,r.z);o.rotation.set(R(-0.3,0.3),R(0,6.28),R(-0.3,0.3));o.scale.set(r.s,r.sy,r.s*R(0.7,1.2));o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,col.setHSL(0.08,R(0.05,0.15),R(0.32,0.5)));});
    m.castShadow=m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);});
}

// ============ height texture for water ============
const HTW=512,HTH=336,hdata=new Uint8Array(HTW*HTH);
const enc=h=>clamp(Math.round((h+12)/24*255),0,255);
for(let j=0;j<HTH;j++)for(let i=0;i<HTW;i++){const x=TX+TW*(i+0.5)/HTW,z=TZ+TD*(j+0.5)/HTH;hdata[j*HTW+i]=enc(H(x,z));}
for(const r of rocks){const rr=r.s*0.95,i0=Math.floor((r.x-rr-TX)/TW*HTW),i1=Math.ceil((r.x+rr-TX)/TW*HTW),j0=Math.floor((r.z-rr-TZ)/TD*HTH),j1=Math.ceil((r.z+rr-TZ)/TD*HTH);
  for(let j=Math.max(0,j0);j<=Math.min(HTH-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(HTW-1,i1);i++){const x=TX+TW*(i+0.5)/HTW,z=TZ+TD*(j+0.5)/HTH,d=Math.hypot(x-r.x,z-r.z)/rr;if(d<1){const v=enc(r.y+r.sy*Math.sqrt(1-d*d));if(v>hdata[j*HTW+i])hdata[j*HTW+i]=v;}}}
const htex=new THREE.DataTexture(hdata,HTW,HTH,THREE.RedFormat,THREE.UnsignedByteType);
htex.magFilter=htex.minFilter=THREE.LinearFilter;htex.needsUpdate=true;

// ============ ocean ============
const WATER_U={...SKYU,uTime:U.time,uLevel:{value:0},uHeight:{value:htex},uDeep:{value:env.deep},uShallow:{value:env.shal},uLight:{value:1},uSunI:{value:1},uFogD:{value:0.0011}};
const TERRAIN_GLSL=`uniform sampler2D uHeight;float terrainH(vec2 p){vec2 uv=(p-vec2(${TX.toFixed(1)},${TZ.toFixed(1)}))/vec2(${TW.toFixed(1)},${TD.toFixed(1)});if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)return -12.0;return texture2D(uHeight,uv).r*24.0-12.0;}`;
const waterMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,uniforms:WATER_U,
  vertexShader:`uniform float uTime;uniform float uLevel;${TERRAIN_GLSL}
  varying vec3 vWP;varying vec3 vN;
  void wave(vec2 p,vec2 d,float len,float amp,float spd,inout float h,inout vec2 g){d=normalize(d);float k=6.2831853/len;float f=k*(dot(d,p)-spd*uTime);h+=amp*sin(f);g+=amp*k*d*cos(f);}
  void main(){
    vec4 wp=modelMatrix*vec4(position,1.0);vec2 p=wp.xz;
    float th=terrainH(p);
    float damp=(0.15+0.85*smoothstep(0.3,5.0,uLevel-th))*(1.0-smoothstep(250.0,700.0,distance(p,cameraPosition.xz)));
    float h=0.0;vec2 g=vec2(0.0);
    wave(p,vec2(0.12,1.0),34.0,0.22,7.3,h,g);
    wave(p,vec2(-0.35,1.0),19.0,0.11,5.4,h,g);
    wave(p,vec2(0.7,0.7),11.0,0.05,4.1,h,g);
    wave(p,vec2(-0.8,0.5),7.0,0.03,3.3,h,g);
    h*=damp;g*=damp;
    wp.y=uLevel+h;vWP=wp.xyz;vN=normalize(vec3(-g.x,1.0,-g.y));
    gl_Position=projectionMatrix*viewMatrix*wp;
  }`,
  fragmentShader:`uniform float uTime;uniform vec3 uDeep;uniform vec3 uShallow;uniform float uLight;uniform float uSunI;uniform float uFogD;
  varying vec3 vWP;varying vec3 vN;${NOISE_GLSL}${SKY_GLSL}${TERRAIN_GLSL}
  float dh(vec2 p){float t=uTime;return noise(p*0.35+vec2(t*0.25,t*0.15))*0.5+noise(p*0.9-vec2(t*0.3,-t*0.2))*0.3+noise(p*2.1+vec2(-t*0.5,t*0.45))*0.2;}
  void main(){
    vec2 p=vWP.xz;float depth=vWP.y-terrainH(p);
    vec3 V=normalize(cameraPosition-vWP);float dist=length(cameraPosition-vWP);
    float e=0.12,d0=dh(p),dx=dh(p+vec2(e,0.0))-d0,dz=dh(p+vec2(0.0,e))-d0;
    float s=1.0/(1.0+dist*0.025);
    vec3 n=normalize(vN+vec3(-dx/e,0.0,-dz/e)*0.4*s);
    float ndv=max(dot(n,V),0.0);
    float fres=0.02+0.98*pow(1.0-ndv,5.0);
    vec3 Rr=reflect(-V,n);Rr.y=abs(Rr.y);
    vec3 refl=skyCol(Rr);
    vec3 body=mix(uShallow,uDeep,smoothstep(0.0,6.0,depth))*uLight;
    float sss=pow(max(dot(-V,uSunDir)*-1.0+0.2,0.0),2.0)*0.0;
    vec3 col=mix(body,refl,fres);
    float sd=max(dot(Rr,uSunDir),0.0);
    col+=uSunCol*(pow(sd,700.0)*24.0+pow(sd,90.0)*0.5)*uSunI*0.45;
    float fn=noise(p*1.3+vec2(uTime*0.2,uTime*0.35))*0.6+noise(p*3.7-vec2(uTime*0.25,-uTime*0.1))*0.4;
    float edge=1.0-smoothstep(0.0,0.08+fn*0.14,depth);
    float lace=smoothstep(0.55,0.72,fn)*(1.0-smoothstep(0.05,0.9,depth));
    float foam=clamp(edge+lace*0.65,0.0,1.0);
    col=mix(col,vec3(0.96)*(uLight*0.9+0.08),foam*0.88);
    float alpha=clamp(smoothstep(-0.02,1.8,depth)*0.86+0.1+fres*0.35,0.0,1.0);
    alpha=max(alpha,foam*0.9);
    float fog=1.0-exp(-dist*uFogD);
    vec3 fc=skyCol(normalize(vec3(-V.x,0.015,-V.z)));
    col=mix(col,fc,fog);alpha=mix(alpha,1.0,fog);
    gl_FragColor=vec4(col,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
});
{
  const SEG=LOW?160:300,g=new THREE.PlaneGeometry(2,2,SEG,SEG);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,S=1600,K=4,sh=Math.sinh(K);
  for(let i=0;i<p.count;i++){const u=p.getX(i),v=p.getZ(i);p.setXYZ(i,S*Math.sinh(K*u)/sh,0,-40+S*Math.sinh(K*v)/sh);}
  const water=new THREE.Mesh(g,waterMat);water.frustumCulled=false;water.renderOrder=2;scene.add(water);
}

// ============ vegetation ============
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
// --- dune grass (instanced tufts with wind)
function tuftGeo(){const pos=[],col=[],nor=[];const C0=[0.2,0.25,0.08],C1=[0.42,0.47,0.18],C2=[0.78,0.72,0.42];
  for(let b=0;b<6;b++){const a=rnd()*6.283,lean=R(0.15,0.55),h=R(0.45,0.95),w=0.035,dx=Math.cos(a),dz=Math.sin(a),wx=-dz*w,wz=dx*w;
    const m=[dx*lean*0.35*h,h*0.55,dz*lean*0.35*h],t=[dx*lean*h,h,dz*lean*h];
    const bL=[-wx,0,-wz],bR=[wx,0,wz],mL=[m[0]-wx*0.7,m[1],m[2]-wz*0.7],mR=[m[0]+wx*0.7,m[1],m[2]+wz*0.7];
    for(const [v,c] of [[bL,C0],[bR,C0],[mR,C1],[bL,C0],[mR,C1],[mL,C1],[mL,C1],[mR,C1],[t,C2]]){pos.push(...v);col.push(...c);nor.push(0,1,0);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));return g}
const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:0.9});
grassMat.onBeforeCompile=sh=>{sh.uniforms.uTime=U.time;sh.uniforms.uWind=U.wind;
  sh.vertexShader='uniform float uTime;uniform float uWind;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec3 ip=vec3(0.0);
  #ifdef USE_INSTANCING
  ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
  #endif
  float sw=sin(uTime*1.6+ip.x*0.15+ip.z*0.1)*0.6+sin(uTime*3.3+ip.x*0.5)*0.25;
  float k=position.y*position.y;
  transformed.x+=sw*k*0.3*uWind;transformed.z+=sw*k*0.15*uWind;`);};
{
  const tg2=tuftGeo(),N=LOW?2500:7000,m=new THREE.InstancedMesh(tg2,grassMat,N),o=new THREE.Object3D();let n=0;
  for(let k=0;k<N*4&&n<N;k++){const x=R(-260,260),t=R(30,150),z=SHORE(x)+t;if(z>175)continue;if(smooth(180,300,Math.abs(x))>0.5)continue;
    if(fbm(x*0.04,z*0.04)<0.38&&rnd()>smooth(30,60,t)*0.4)continue;
    o.position.set(x,H(x,z)-0.02,z);o.rotation.set(0,R(0,6.28),0);const s=R(0.7,1.4);o.scale.set(s,s*R(0.8,1.2),s);o.updateMatrix();m.setMatrixAt(n++,o.matrix);}
  m.count=n;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);
}
// --- flowers
const flowerPts=[];
{
  const N=900,g=new THREE.IcosahedronGeometry(0.055,0),m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({roughness:0.6}),N),o=new THREE.Object3D(),c=new THREE.Color();
  const pal=['#f28cb1','#ffd75e','#b18cf2','#ffffff','#ff9a5a','#f25c7a'];
  for(let i=0;i<N;i++){const x=i<500?R(-70,60):R(-200,200),t=i<500?R(22,55):R(30,90),z=SHORE(x)+t,y=H(x,z)+R(0.22,0.5);
    o.position.set(x,y,z);o.scale.set(1,0.6,1);o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,c.set(pick(pal)));if(i<500)flowerPts.push(new THREE.Vector3(x,y+0.08,z));}
  m.computeBoundingSphere();scene.add(m);
}
// --- palms
const leafTex=canvasTex(256,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.lineCap='round';
  for(let i=0;i<46;i++){const x=6+i*5.2,env=Math.sin(Math.PI*Math.min(1,(i/46)*1.1))*0.9+0.1;for(const sgn of [-1,1]){const L=56*env;g.strokeStyle=`hsl(${95+rnd()*25},${45+rnd()*20}%,${24+rnd()*14}%)`;g.lineWidth=3.4;g.beginPath();g.moveTo(x,64);g.quadraticCurveTo(x+8,64+sgn*L*0.5,x+16,64+sgn*L);g.stroke();}}
  g.strokeStyle='#6b6a3a';g.lineWidth=4;g.beginPath();g.moveTo(0,64);g.lineTo(w,64);g.stroke();});
const leafMat=new THREE.MeshStandardMaterial({map:leafTex,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.75});
const leafDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:leafTex,alphaTest:0.45});
const frondG=(()=>{const g=new THREE.PlaneGeometry(1,1,14,2),p=g.attributes.position,uv=g.attributes.uv,L=3.8;
  for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i)-0.5,w=(Math.sin(Math.PI*Math.min(1,u*1.1))*0.6+0.08)*(1-u*0.4);
    p.setXYZ(i,u*L,-0.42*u*u*L+Math.abs(v)*0.5*w,v*2*w);}g.computeVertexNormals();return g})();
const trunkMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95});
const nutMat=new THREE.MeshStandardMaterial({color:'#5a3d22',roughness:0.7});
const palms=[];
function makePalm(x,z){
  const base=new THREE.Vector3(x,H(x,z)-0.2,z),Hp=R(6,10),lx=R(-1.8,1.8),lz=R(-3.2,-0.6);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(lx*0.12,Hp*0.33,lz*0.12),new THREE.Vector3(lx*0.45,Hp*0.67,lz*0.45),new THREE.Vector3(lx,Hp,lz)]);
  const TS=28,RS=8,g=new THREE.TubeGeometry(curve,TS,0.2,RS,false),p=g.attributes.position,cols=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<=TS;i++){const ctr=curve.getPointAt(i/TS),s=1.35-0.6*(i/TS);for(let j=0;j<=RS;j++){const k=i*(RS+1)+j,v=new THREE.Vector3(p.getX(k),p.getY(k),p.getZ(k)).sub(ctr).multiplyScalar(s).add(ctr);p.setXYZ(k,v.x,v.y,v.z);
    c.set('#8a6e4b').multiplyScalar(0.75+0.25*Math.abs(Math.sin(i*1.9)));cols[k*3]=c.r;cols[k*3+1]=c.g;cols[k*3+2]=c.b;}}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.computeVertexNormals();
  const grp=new THREE.Group();grp.position.copy(base);scene.add(grp);
  const trunk=new THREE.Mesh(g,trunkMat);trunk.castShadow=true;trunk.receiveShadow=true;grp.add(trunk);
  const crown=new THREE.Group();crown.position.set(lx,Hp,lz);grp.add(crown);
  const fronds=[],n=Math.floor(R(9,13));
  for(let k=0;k<n;k++){const piv=new THREE.Group();piv.rotation.y=k/n*6.283+R(-0.2,0.2);const f=new THREE.Mesh(frondG,leafMat);f.customDepthMaterial=leafDepth;f.castShadow=true;f.rotation.z=R(0.05,0.55);f.rotation.x=R(-0.25,0.25);const s=R(0.8,1.15);f.scale.set(s,s,s);piv.add(f);crown.add(piv);fronds.push({f,base:f.rotation.z,ph:R(0,6)});}
  for(let k=0;k<3;k++){const nut=new THREE.Mesh(new THREE.SphereGeometry(0.13,8,6),nutMat);nut.position.set(Math.cos(k*2.1)*0.22,-0.18,Math.sin(k*2.1)*0.22);nut.castShadow=true;crown.add(nut);}
  palms.push({crown,fronds,ph:R(0,6)});
}
{
  const spots=[];for(let k=0;k<60;k++){let x=R(-210,210);const t=R(26,48)+(Math.abs(x)>150?-6:0);if(Math.abs(x-8)<10)x+=22;if(spots.some(s=>Math.abs(s-x)<6))continue;spots.push(x);makePalm(x,SHORE(x)+t);}
  for(let k=0;k<10;k++){const x=R(-180,180),t=R(55,90);makePalm(x,SHORE(x)+t);}
}

// ============ beach details ============
{
  // shells
  const N=320,g=new THREE.SphereGeometry(0.05,8,5,0,Math.PI*2,0,Math.PI/2),m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({roughness:0.5}),N),o=new THREE.Object3D(),c=new THREE.Color();
  for(let i=0;i<N;i++){const x=R(-160,160),z=SHORE(x)+R(0.5,16);o.position.set(x,H(x,z)-0.01,z);o.rotation.set(0,R(0,6),0);const s=R(0.6,1.4);o.scale.set(s,s*0.45,s*1.3);o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,c.setHSL(R(0.02,0.1),R(0.2,0.6),R(0.75,0.92)));}
  m.computeBoundingSphere();scene.add(m);
  // starfish
  const sh=new THREE.Shape();for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r=k%2?0.045:0.13;const px=Math.cos(a)*r,py=Math.sin(a)*r;k?sh.lineTo(px,py):sh.moveTo(px,py);}
  const sg=new THREE.ExtrudeGeometry(sh,{depth:0.02,bevelEnabled:true,bevelThickness:0.012,bevelSize:0.012,bevelSegments:2});sg.rotateX(-Math.PI/2);
  const sm=new THREE.InstancedMesh(sg,new THREE.MeshStandardMaterial({roughness:0.7}),18);
  for(let i=0;i<18;i++){const x=R(-60,60),z=SHORE(x)+R(-3,5);o.position.set(x,H(x,z)+0.005,z);o.rotation.set(0,R(0,6),0);o.scale.setScalar(R(0.8,1.3));o.updateMatrix();sm.setMatrixAt(i,o.matrix);sm.setColorAt(i,c.set(pick(['#e8743b','#d9534f','#f0a04b','#c9485b'])));}
  sm.computeBoundingSphere();scene.add(sm);
  // parasol, deckchair, towel
  const px=9,pz=SHORE(9)+24,py=H(px,pz);
  const stripes=canvasTex(256,8,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#f6f1e7':'#e2574c';g.fillRect(i*32,0,32,h);}});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.5,8),new THREE.MeshStandardMaterial({color:'#e8e2d5'}));pole.position.set(px,py+1.15,pz);pole.rotation.z=0.1;pole.castShadow=true;scene.add(pole);
  const can=new THREE.Mesh(new THREE.ConeGeometry(1.7,0.55,16,1,true),new THREE.MeshStandardMaterial({map:stripes,side:THREE.DoubleSide,roughness:0.8}));can.position.set(px-0.12,py+2.4,pz);can.rotation.z=0.1;can.castShadow=true;scene.add(can);
  const towel=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.9),new THREE.MeshStandardMaterial({map:canvasTex(64,128,(g,w,h)=>{const cs=['#2e86ab','#f6f1e7','#f2c14e','#f6f1e7'];for(let i=0;i<16;i++){g.fillStyle=cs[i%4];g.fillRect(0,i*8,w,8);}}),roughness:1}));
  towel.rotation.set(-Math.PI/2,0,0.4);towel.position.set(px+1.6,H(px+1.6,pz-0.6)+0.03,pz-0.6);towel.receiveShadow=true;scene.add(towel);
  const chair=new THREE.Group();const fab=new THREE.MeshStandardMaterial({map:stripes,roughness:0.9,side:THREE.DoubleSide}),wood=new THREE.MeshStandardMaterial({color:'#b98a5a',roughness:0.8});
  const seat=new THREE.Mesh(new THREE.PlaneGeometry(0.6,1.0),fab);seat.rotation.x=-1.2;seat.position.set(0,0.35,0);chair.add(seat);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.8),fab);back.rotation.x=-0.45;back.position.set(0,0.62,0.55);chair.add(back);
  for(const sx of [-0.31,0.31]){const a=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,1.5),wood);a.position.set(sx,0.4,0.2);a.rotation.x=-0.5;chair.add(a);}
  chair.traverse(m=>{if(m.isMesh)m.castShadow=true});chair.position.set(px-1.3,py,pz+0.4);chair.rotation.y=0.2;scene.add(chair);
}
// sailboats on the horizon
const boats=[];
for(let k=0;k<2;k++){const b=new THREE.Group();const hull=new THREE.Mesh(new THREE.BoxGeometry(5,0.9,1.5),new THREE.MeshStandardMaterial({color:'#f2f2ee'}));hull.position.y=0.3;b.add(hull);
  const ss=new THREE.Shape();ss.moveTo(0,0);ss.lineTo(0,7);ss.lineTo(3.2,0.3);ss.lineTo(0,0);const sail=new THREE.Mesh(new THREE.ShapeGeometry(ss),new THREE.MeshStandardMaterial({color:'#fffdf6',side:THREE.DoubleSide}));sail.position.set(-1,0.8,0);b.add(sail);
  b.position.set(k?260:-340,0,k?-520:-760);scene.add(b);boats.push({b,v:k?-0.6:0.9});}

// ============ animals ============
const whiteM=new THREE.MeshStandardMaterial({color:'#f4f4f1',roughness:0.8}),greyM=new THREE.MeshStandardMaterial({color:'#9aa3ab',roughness:0.8,side:THREE.DoubleSide}),blackM=new THREE.MeshStandardMaterial({color:'#222',roughness:0.8,side:THREE.DoubleSide}),yellowM=new THREE.MeshStandardMaterial({color:'#f2b632'});
function shapeGeo(pts,rot){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(const q of pts.slice(1))s.lineTo(q[0],q[1]);const g=new THREE.ShapeGeometry(s);if(rot==='x')g.rotateX(Math.PI/2);if(rot==='y')g.rotateY(-Math.PI/2);return g}
// --- seagulls
const wInG=shapeGeo([[0,0.1],[0.38,0.12],[0.38,-0.1],[0,-0.12]],'x'),wOutG=shapeGeo([[0,0.12],[0.2,0.08],[0.44,-0.02],[0.3,-0.1],[0,-0.1]],'x'),wTipG=shapeGeo([[0.24,0.06],[0.445,-0.02],[0.3,-0.105],[0.2,-0.09]],'x');
const gulls=[];
for(let k=0;k<10;k++){
  const g=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),whiteM);body.scale.set(1,0.9,2.9);g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),whiteM);head.position.set(0,0.06,0.34);g.add(head);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(0.018,0.09,5),yellowM);beak.rotation.x=Math.PI/2;beak.position.set(0,0.05,0.44);g.add(beak);
  const tail=new THREE.Mesh(shapeGeo([[-0.07,0],[0.07,0],[0.05,-0.16],[-0.05,-0.16]],'x'),whiteM);tail.position.set(0,0,-0.3);g.add(tail);
  const wings=[];for(const sd of [1,-1]){const root=new THREE.Group();root.scale.x=sd;root.position.set(0,0.03,0.02);g.add(root);const inner=new THREE.Group();root.add(inner);inner.add(new THREE.Mesh(wInG,greyM));const outer=new THREE.Group();outer.position.x=0.38;inner.add(outer);outer.add(new THREE.Mesh(wOutG,greyM));const tip=new THREE.Mesh(wTipG,blackM);tip.position.y=0.003;outer.add(tip);wings.push({inner,outer});}
  g.traverse(m=>{if(m.isMesh)m.castShadow=true});g.rotation.order='YXZ';scene.add(g);
  const near=k<3;
  gulls.push({g,wings,cx:near?R(-30,30):R(-140,140),cz:near?R(-30,5):R(-160,0),r:near?R(14,24):R(18,50),y:near?R(6,11):R(10,30),sp:R(5.5,8),dir:rnd()<0.5?1:-1,th:R(0,6.28),ph:R(0,10)});
}
// --- dolphins
function makeDolphin(){
  const pts=[[0,-1.25],[0.1,-1.05],[0.2,-0.7],[0.27,-0.2],[0.27,0.25],[0.2,0.75],[0.1,1.02],[0.06,1.12],[0.035,1.3],[0,1.33]].map(p=>new THREE.Vector2(p[0],p[1]));
  const g=new THREE.LatheGeometry(pts,18);g.rotateX(Math.PI/2);g.scale(0.85,1,1);
  const n=g.attributes.normal,cols=new Float32Array(n.count*3),c=new THREE.Color(),top=new THREE.Color('#4d6275'),bel=new THREE.Color('#c9d2d8');
  for(let i=0;i<n.count;i++){c.copy(top).lerp(bel,smooth(0.1,-0.6,n.getY(i)));cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.28,metalness:0.05}),fm=new THREE.MeshStandardMaterial({color:'#4d6275',roughness:0.3,side:THREE.DoubleSide});
  const d=new THREE.Group();d.add(new THREE.Mesh(g,mat));
  const fin=new THREE.Mesh(shapeGeo([[0.1,0],[-0.38,0],[-0.5,0.38],[-0.22,0.14]],'y'),fm);fin.position.set(0,0.2,-0.05);d.add(fin);
  const fl=new THREE.Mesh(shapeGeo([[0,0.05],[0.42,-0.2],[0.36,-0.32],[0,-0.12],[-0.36,-0.32],[-0.42,-0.2]],'x'),fm);fl.position.z=-1.2;d.add(fl);
  for(const sd of [-1,1]){const pf=new THREE.Mesh(shapeGeo([[0,0.1],[0.32*sd,-0.12],[0.22*sd,-0.18],[0,-0.05]],'x'),fm);pf.position.set(0.18*sd,-0.12,0.45);pf.rotation.z=-0.4*sd;d.add(pf);}
  d.rotation.order='YXZ';scene.add(d);return d;
}
const dolphins=[0,1,2].map(k=>({d:makeDolphin(),k,next:R(4,14)+k*3,breach:-1,prevY:-1}));
// --- splash particles
const SPL=400,splPos=new Float32Array(SPL*3).fill(-100),splVel=new Float32Array(SPL*3),splLife=new Float32Array(SPL);let splI=0;
const splGeo=new THREE.BufferGeometry();splGeo.setAttribute('position',new THREE.BufferAttribute(splPos,3));
const splPts=new THREE.Points(splGeo,new THREE.PointsMaterial({color:0xffffff,size:0.16,transparent:true,opacity:0.85,depthWrite:false}));splPts.frustumCulled=false;scene.add(splPts);
function splash(x,y,z,n,pw){for(let k=0;k<n;k++){const i=(splI++)%SPL;splPos[i*3]=x+R(-0.4,0.4);splPos[i*3+1]=y;splPos[i*3+2]=z+R(-0.4,0.4);splVel[i*3]=R(-1,1)*pw*0.45;splVel[i*3+1]=R(0.4,1)*pw;splVel[i*3+2]=R(-1,1)*pw*0.45;splLife[i]=R(0.6,1.3);}}
// --- crabs
const crabM=new THREE.MeshStandardMaterial({color:'#d2532e',roughness:0.55}),eyeM=new THREE.MeshStandardMaterial({color:'#111'});
const crabs=[];
for(let k=0;k<8;k++){
  const g=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(0.1,12,8),crabM);body.scale.set(1.3,0.5,0.95);body.position.y=0.08;g.add(body);
  const legs=[];for(const sd of [-1,1])for(let j=0;j<4;j++){const p=new THREE.Group();p.position.set(sd*0.09,0.08,(j-1.5)*0.045);const l=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.014,0.014),crabM);l.position.x=sd*0.06;l.rotation.z=sd*-0.7;p.add(l);g.add(p);legs.push({p,sd,j});}
  for(const sd of [-1,1]){const c=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6),crabM);c.scale.set(1.4,0.8,1);c.position.set(sd*0.075,0.09,0.12);g.add(c);const e=new THREE.Mesh(new THREE.SphereGeometry(0.012,6,4),eyeM);e.position.set(sd*0.025,0.14,0.08);g.add(e);}
  g.traverse(m=>{if(m.isMesh)m.castShadow=true});g.scale.setScalar(1.15);scene.add(g);
  const x=R(-40,45),z=SHORE(x)+R(2,15);crabs.push({g,legs,x,z,h:R(0,6.28),state:0,timer:R(0.5,3),dir:1});
}
// --- butterflies
function wingTex(c1,c2){return canvasTex(64,64,(g)=>{g.fillStyle=c1;g.strokeStyle=c2;g.lineWidth=4;g.beginPath();g.ellipse(34,22,26,19,-0.35,0,6.283);g.fill();g.stroke();g.beginPath();g.ellipse(26,46,17,14,0.4,0,6.283);g.fill();g.stroke();g.fillStyle='#fff';for(let i=0;i<5;i++){g.beginPath();g.arc(48+Math.cos(i)*6,12+i*5,1.8,0,6.283);g.fill();}})}
const BPAL=[['#f08a24','#2b1a10'],['#3fa0ff','#0d2140'],['#fff6d8','#7a6a40'],['#ffe14d','#6b5a10'],['#f5a3c7','#5a2040']];
const wingG=new THREE.PlaneGeometry(1,1).translate(0.5,0,0).rotateX(-Math.PI/2);
const butterflies=[];
for(let k=0;k<14;k++){
  const [c1,c2]=pick(BPAL),mat=new THREE.MeshStandardMaterial({map:wingTex(c1,c2),alphaTest:0.4,side:THREE.DoubleSide,roughness:0.7});
  const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.04,0.9,5),eyeM);body.rotation.x=Math.PI/2;g.add(body);
  const ws=[];for(const sd of [1,-1]){const p=new THREE.Group();p.scale.x=sd;g.add(p);const w=new THREE.Mesh(wingG,mat);p.add(w);ws.push(p);}
  g.scale.setScalar(0.11);g.rotation.order='YXZ';scene.add(g);
  const t0=pick(flowerPts);butterflies.push({g,ws,pos:t0.clone().add(new THREE.Vector3(R(-2,2),R(0.5,1.5),R(-2,2))),vel:new THREE.Vector3(),tgt:pick(flowerPts),rest:0,ph:R(0,6)});
}
// --- fireflies
const FF=260,ffPos=new Float32Array(FF*3),ffPh=new Float32Array(FF);
for(let i=0;i<FF;i++){const x=R(-90,80),z=SHORE(x)+R(20,70);ffPos[i*3]=x;ffPos[i*3+1]=H(x,z)+R(0.4,2.8);ffPos[i*3+2]=z;ffPh[i]=rnd();}
const ffGeo=new THREE.BufferGeometry();ffGeo.setAttribute('position',new THREE.BufferAttribute(ffPos,3));ffGeo.setAttribute('aPh',new THREE.BufferAttribute(ffPh,1));
const ffMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:U.time,uVis:{value:0},uPR:{value:renderer.getPixelRatio()}},
  vertexShader:`attribute float aPh;uniform float uTime;uniform float uVis;uniform float uPR;varying float vA;void main(){vec3 p=position;p.x+=sin(uTime*0.3+aPh*10.0)*1.6;p.y+=sin(uTime*0.5+aPh*7.0)*0.5;p.z+=cos(uTime*0.27+aPh*13.0)*1.6;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;float b=pow(max(0.0,sin(uTime*1.2+aPh*40.0)),5.0);vA=(0.15+0.85*b)*uVis;gl_PointSize=clamp((8.0+16.0*b)*uPR*(12.0/-mv.z),1.0,40.0);}`,
  fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,d);a*=a;gl_FragColor=vec4(vec3(1.0,0.92,0.45)*a*vA*1.6,a*vA);}`});
const fireflies=new THREE.Points(ffGeo,ffMat);fireflies.frustumCulled=false;scene.add(fireflies);

// ============ audio (100% synthesised) ============
let AC=null,master,bus={},NB={},waveV=[],wind={},musicT=0,gullT=4,birdT=2,crickets=[],chimeT=8;
const vol={vagues:0.9,vent:0.45,nature:0.8,musique:0,paillote:0.7};
function noiseBuf(kind,sec=7){const len=Math.floor(AC.sampleRate*sec),xf=Math.floor(AC.sampleRate*0.25),buf=AC.createBuffer(2,len,AC.sampleRate);
  for(let ch=0;ch<2;ch++){const tmp=new Float32Array(len+xf);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
    for(let i=0;i<len+xf;i++){const w=Math.random()*2-1;
      if(kind==='white')tmp[i]=w*0.5;
      else if(kind==='pink'){b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.3104856;b4=0.55*b4+w*0.5329522;b5=-0.7616*b5-w*0.016898;tmp[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;b6=w*0.115926;}
      else{last=(last+0.02*w)/1.02;tmp[i]=last*3.5;}}
    for(let k=0;k<xf;k++){const a=k/xf;tmp[k]=tmp[k]*a+tmp[len+k]*(1-a);}
    buf.getChannelData(ch).set(tmp.subarray(0,len));}
  return buf}
function loopSrc(buf,rate=1){const s=AC.createBufferSource();s.buffer=buf;s.loop=true;s.playbackRate.value=rate;s.start(0,Math.random()*5);return s}
function initAudio(){
  if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return}
  master=AC.createGain();master.gain.value=0;const comp=AC.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;master.connect(comp).connect(AC.destination);
  for(const k in vol){bus[k]=AC.createGain();bus[k].gain.value=vol[k];bus[k].connect(master);}
  NB.white=noiseBuf('white');NB.pink=noiseBuf('pink');NB.brown=noiseBuf('brown');
  // distant surf bed
  {const s=loopSrc(NB.pink,0.7),lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=170;const g=AC.createGain();g.gain.value=0.35;s.connect(lp).connect(g).connect(bus.vagues);}
  // breaking waves (3 voices along the shore)
  for(let i=0;i<3;i++){const s1=loopSrc(NB.brown,R(0.85,1.15)),lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=300;lp.Q.value=0.4;const g1=AC.createGain();g1.gain.value=0;
    const s2=loopSrc(NB.white),bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=0.35;const g2=AC.createGain();g2.gain.value=0;
    const pan=AC.createStereoPanner();s1.connect(lp).connect(g1).connect(pan);s2.connect(bp).connect(g2).connect(pan);pan.connect(bus.vagues);
    waveV.push({lp,g1,g2,pan,off:[-38,0,38][i],po:[0.05,0,-0.06][i]});}
  // wind + leaves
  {const s=loopSrc(NB.pink),bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=450;bp.Q.value=0.5;const g=AC.createGain();g.gain.value=0;s.connect(bp).connect(g).connect(bus.vent);
   const s2=loopSrc(NB.white),hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=4500;const g2=AC.createGain();g2.gain.value=0;s2.connect(hp).connect(g2).connect(bus.vent);wind={bp,g,g2};}
  for(let i=0;i<5;i++)crickets.push({f:R(4200,4900),pan:R(-0.9,0.9),t:R(0,2)});
  master.gain.setTargetAtTime(0.9,AC.currentTime,1.2);
  document.addEventListener('visibilitychange',()=>{if(!AC)return;document.hidden?AC.suspend():AC.resume();});
}
function env1(g,t,a,peak,dec){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec);}
function gullCall(pan,gain){const t0=AC.currentTime+0.02,o=AC.createOscillator(),lfo=AC.createOscillator(),lg=AC.createGain(),f=AC.createBiquadFilter(),g=AC.createGain(),p=AC.createStereoPanner();
  o.type='sawtooth';lfo.frequency.value=32;lg.gain.value=45;lfo.connect(lg).connect(o.frequency);f.type='bandpass';f.frequency.value=1700;f.Q.value=2.5;p.pan.value=pan;g.gain.value=0;
  o.connect(f).connect(g).connect(p).connect(bus.nature);const n=2+Math.floor(Math.random()*3);let t=t0;
  for(let k=0;k<n;k++){const d=k===0?0.42:0.24,f0=R(1000,1150);o.frequency.setValueAtTime(f0*0.85,t);o.frequency.linearRampToValueAtTime(f0*1.35,t+0.05);o.frequency.exponentialRampToValueAtTime(f0*0.8,t+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.2*gain,t+0.03);g.gain.linearRampToValueAtTime(0.12*gain,t+d*0.6);g.gain.linearRampToValueAtTime(0,t+d);t+=d+R(0.06,0.14);}
  o.start(t0);lfo.start(t0);o.stop(t+0.1);lfo.stop(t+0.1);}
function songbird(pan,gain){const t0=AC.currentTime+0.02,o=AC.createOscillator(),g=AC.createGain(),p=AC.createStereoPanner();o.type='sine';g.gain.value=0;p.pan.value=pan;o.connect(g).connect(p).connect(bus.nature);
  const base=R(2600,4200),n=3+Math.floor(Math.random()*6);let t=t0;
  for(let k=0;k<n;k++){const f1=base*R(0.8,1.35),f2=f1*R(0.7,1.5),d=R(0.05,0.16);o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.05*gain,t+0.012);g.gain.linearRampToValueAtTime(0,t+d);t+=d+R(0.03,0.12);}
  o.start(t0);o.stop(t+0.1);}
function cricket(c,gain){const t0=AC.currentTime+0.01,o=AC.createOscillator(),g=AC.createGain(),p=AC.createStereoPanner();o.frequency.value=c.f;p.pan.value=c.pan;g.gain.value=0;o.connect(g).connect(p).connect(bus.nature);
  for(let k=0;k<3;k++){const t=t0+k*0.055;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.022*gain,t+0.006);g.gain.linearRampToValueAtTime(0,t+0.032);}o.start(t0);o.stop(t0+0.25);}
function noiseHit(dest,freq,q,peak,a,dec,pan=0){const t=AC.currentTime,s=AC.createBufferSource();s.buffer=NB.white;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=q;const g=AC.createGain(),p=AC.createStereoPanner();p.pan.value=clamp(pan,-1,1);
  s.connect(f).connect(g).connect(p).connect(dest);env1(g,t,a,peak,dec);s.start(t,Math.random()*5);s.stop(t+a+dec+0.05);}
const CHORDS=[[130.81,196.0,246.94,293.66,329.63],[110.0,164.81,246.94,261.63,329.63],[87.31,174.61,220.0,261.63,329.63],[98.0,146.83,196.0,246.94,293.66]];let chordI=0;
function playChord(){const t=AC.currentTime,notes=CHORDS[chordI++%CHORDS.length],lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;const g=AC.createGain();lp.connect(g).connect(bus.musique);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.05,t+4);g.gain.setValueAtTime(0.05,t+8);g.gain.linearRampToValueAtTime(0,t+15);
  for(const f of notes)for(const [type,det] of [['sine',0],['triangle',4]]){const o=AC.createOscillator();o.type=type;o.frequency.value=f;o.detune.value=det;o.connect(lp);o.start(t);o.stop(t+15.5);}}
function chime(){const t=AC.currentTime,pent=[523.25,587.33,659.25,783.99,880,1046.5],o=AC.createOscillator(),g=AC.createGain(),p=AC.createStereoPanner();o.type='sine';o.frequency.value=pick(pent);p.pan.value=R(-0.6,0.6);o.connect(g).connect(p).connect(bus.musique);env1(g,t,0.01,0.05,4);o.start(t);o.stop(t+4.2);}

// ============ camera / controls ============
let mode='calm',lookYaw=0,lookPitch=0,dragIdle=0,showBreath=false;
const walker={x:0,z:0,yaw:0,pitch:0,dist:0,swim:false,cy:null};
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;wake();});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
const cv=renderer.domElement;let drag=null;
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,id:e.pointerId};cv.setPointerCapture?.(e.pointerId);wake();if(ui.writeMode)for(const f of drawHooks)f(e);});
cv.addEventListener('pointermove',e=>{wake();if(!drag||drag.id!==e.pointerId)return;if(ui.writeMode){for(const f of drawHooks)f(e);return;}const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;const k=isTouch?0.005:0.0032;
  if(mode==='calm'){lookYaw+=dx*k;lookPitch=clamp(lookPitch+dy*k,-0.6,0.8);dragIdle=0;}else{walker.yaw+=dx*k;walker.pitch=clamp(walker.pitch+dy*k,-1.2,1.2);}});
const endDrag=e=>{if(drag&&drag.id===e.pointerId){if(ui.writeMode)for(const f of drawHooks)f(null);else if(e.type==='pointerup'&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<7)for(const f of clickHooks)f(e);drag=null;}};cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
const stick={x:0,y:0,id:null,ox:0,oy:0},zone=document.getElementById('stickZone'),stickEl=document.getElementById('stick'),knob=document.getElementById('knob');
zone.addEventListener('pointerdown',e=>{stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;zone.setPointerCapture(e.pointerId);stickEl.style.left=(e.clientX-55)+'px';stickEl.style.top=(e.clientY-55)+'px';stickEl.style.bottom='auto';wake();});
zone.addEventListener('pointermove',e=>{if(e.pointerId!==stick.id)return;let dx=e.clientX-stick.ox,dy=e.clientY-stick.oy;const l=Math.hypot(dx,dy);if(l>45){dx*=45/l;dy*=45/l;}stick.x=dx/45;stick.y=dy/45;knob.style.transform=`translate(${dx}px,${dy}px)`;});
const endStick=e=>{if(e.pointerId!==stick.id)return;stick.id=null;stick.x=stick.y=0;knob.style.transform='';};zone.addEventListener('pointerup',endStick);zone.addEventListener('pointercancel',endStick);

function calmPose(T){const x=-4+26*Math.sin(T*0.011)+8*Math.sin(T*0.023),t=15+4*Math.sin(T*0.017),z=SHORE(x)+t;
  return {x,z,y:Math.max(H(x,z),0.3)+1.5+0.04*Math.sin(T*0.6),yaw:0.42+0.28*Math.sin(T*0.013+1)+0.08*Math.sin(T*0.031),pitch:-0.025+0.02*Math.sin(T*0.019)}}

// ============ UI ============
const $=id=>document.getElementById(id);
let idle=0,started=false;
function wake(){idle=0;state.started=started;document.body.classList.remove('idle');if(started)$('dock').classList.remove('hide');}
function tip(msg,ms=6000){const t=$('tip');t.textContent=msg;t.classList.remove('off');clearTimeout(tip._t);tip._t=setTimeout(()=>t.classList.add('off'),ms);}
function setMoment(m){moment=m;state.moment=m;loadPreset(target,PRESETS[m]);document.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));}
function setMode(m){mode=m;state.mode=m;
  if(m==='walk'){const p=calmPose(Tcam);Object.assign(walker,{x:p.x,z:p.z,yaw:p.yaw+lookYaw,pitch:p.pitch+lookPitch,cy:null,swim:false});tip(isTouch?'Joystick à gauche pour marcher · glisse pour regarder':'ZQSD / flèches pour marcher · Maj pour aller plus vite · glisse pour regarder');}
  else{lookYaw=0;lookPitch=0;tip(isTouch?'Glisse pour regarder autour de toi':'Glisse avec la souris pour regarder autour de toi',4000);}
  $('modeBtn').innerHTML=m==='walk'?'<span class="ic">🧘</span><span class="lbl">Contempler</span>':'<span class="ic">🚶</span><span class="lbl">Balade</span>';
  zone.classList.toggle('on',m==='walk'&&isTouch);}
function start(m){initAudio();started=true;state.started=true;$('intro').classList.add('gone');setTimeout(()=>$('intro').remove(),1700);$('dock').hidden=false;setMoment(moment);setMode(m);wake();}
$('goCalm').onclick=()=>start('calm');$('goWalk').onclick=()=>start('walk');
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>setMoment(b.dataset.m));
$('modeBtn').onclick=()=>setMode(mode==='walk'?'calm':'walk');
function goto(x,z,yaw){if(mode!=='walk')setMode('walk');Object.assign(walker,{x,z,yaw,pitch:-0.06,cy:null});}
function waveH(x,z,t){let h=0;for(const [a,b,len,amp,spd] of [[0.12,1,34,0.22,7.3],[-0.35,1,19,0.11,5.4],[0.7,0.7,11,0.05,4.1],[-0.8,0.5,7,0.03,3.3]]){const l=Math.hypot(a,b),k=6.2831853/len;h+=amp*Math.sin(k*((a*x+b*z)/l-spd*t));}return h*(0.15+0.85*smooth(0.3,5,WATER_U.uLevel.value-H(x,z)));}
$('breathBtn').onclick=()=>{showBreath=!showBreath;$('breath').hidden=!showBreath;$('breathBtn').classList.toggle('on',showBreath);if(showBreath)tip('Respire au rythme des vagues',4000);};
$('soundBtn').onclick=()=>{const p=$('panel');p.hidden=!p.hidden;$('soundBtn').classList.toggle('on',!p.hidden);};
$('fsBtn').onclick=()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()}catch(e){}};
document.querySelectorAll('#panel input').forEach(inp=>inp.oninput=()=>{const k=inp.dataset.bus;vol[k]=Number(inp.value);if(AC)bus[k].gain.setTargetAtTime(vol[k],AC.currentTime,0.1);if(k==='musique'&&vol[k]>0&&musicT>2)musicT=0.5;});

// ============ main loop ============
let last=performance.now(),T=0,Tcam=60,stepAcc=0;
const v3=new THREE.Vector3(),fwd=new THREE.Vector3();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;T+=dt;Tcam+=dt;U.time.value=T;
  // --- environment blend
  const kk=1-Math.exp(-dt*0.7);for(const k of NUMS)env[k]+=(target[k]-env[k])*kk;for(const k of COLS)env[k].lerp(target[k],kk);
  const el=THREE.MathUtils.degToRad(env.elev),az=THREE.MathUtils.degToRad(env.az);
  sunDir.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).normalize();
  SKYU.uGlow.value=env.glow;skyMat.uniforms.uStars.value=env.stars;skyMat.uniforms.uClouds.value=env.clouds;
  WATER_U.uLight.value=env.light;WATER_U.uSunI.value=env.sunI;
  scene.fog.color.copy(env.hor);renderer.toneMappingExposure=env.exp;
  sun.color.copy(env.sun);sun.intensity=env.sunI*smooth(-1,5,env.elev);
  hemi.color.copy(env.zen).lerp(env.hor,0.5);hemi.groundColor.setRGB(0.5,0.42,0.32).multiplyScalar(0.4+env.light*0.6);hemi.intensity=env.hemiI;
  U.wind.value=env.wind;
  // --- sea "breath" (10 s cycle)
  const phi=(T/10)%1;WATER_U.uLevel.value=0.18*Math.sin(6.2832*(phi-0.05));
  // --- camera
  if(mode==='calm'||!started){
    const p=calmPose(Tcam);if(!drag){dragIdle+=dt;if(dragIdle>8){lookYaw*=1-dt*0.15;lookPitch*=1-dt*0.15;}}
    camera.position.set(p.x,p.y,p.z);camera.rotation.set(p.pitch+lookPitch,p.yaw+lookYaw,0);
  }else{
    let f=0,s=0;if(keys.KeyW||keys.ArrowUp)f++;if(keys.KeyS||keys.ArrowDown)f--;if(keys.KeyD||keys.ArrowRight)s++;if(keys.KeyA||keys.ArrowLeft)s--;
    f-=stick.y;s+=stick.x;const l=Math.hypot(f,s);if(l>1){f/=l;s/=l;}
    const lv=WATER_U.uLevel.value;
    const sp=walker.swim?1.4:((keys.ShiftLeft||keys.ShiftRight)?4.2:1.9),yw=walker.yaw;
    const dx=(-Math.sin(yw)*f+Math.cos(yw)*s)*sp*dt,dz=(-Math.cos(yw)*f-Math.sin(yw)*s)*sp*dt;
    const nx=clamp(walker.x+dx,-200,200),nz=walker.z+dz,nt=nz-SHORE(nx);
    if(nt<120&&nt>-115&&H(nx,nz)>-12){walker.x=nx;walker.z=nz;}
    const moved=Math.hypot(dx,dz);walker.dist+=moved;
    const gh=H(walker.x,walker.z),depth=lv-gh,inW=depth>-0.02,swimNow=depth>1.15;
    if(swimNow!==walker.swim){walker.swim=swimNow;tip(swimNow?'🏊 Tu nages… laisse-toi porter par les vagues':'🏖️ Les pieds sur le sable',3500);}
    stepAcc+=moved;
    if(swimNow){if(stepAcc>1.3&&AC){stepAcc=0;noiseHit(bus.nature,R(450,700),0.7,0.16,0.08,0.6);}}
    else if(stepAcc>0.75&&AC){stepAcc=0;inW?noiseHit(bus.nature,R(600,900),0.8,0.22,0.02,0.32):noiseHit(bus.nature,R(1500,2600),0.9,0.1,0.012,0.13);}
    const ty=swimNow?lv+waveH(walker.x,walker.z,T)+0.4:gh+1.65+Math.sin(walker.dist*4.2)*0.025;
    walker.cy=walker.cy==null?ty:walker.cy+(ty-walker.cy)*Math.min(1,dt*(swimNow?6:4));
    camera.position.set(walker.x,walker.cy,walker.z);camera.rotation.set(walker.pitch,walker.yaw,swimNow?Math.sin(T*0.9)*0.025:0);
  }
  sky.position.copy(camera.position);
  camera.getWorldDirection(fwd);
  v3.copy(camera.position).addScaledVector(fwd,18);v3.y=0;
  sun.target.position.copy(v3);sun.position.copy(v3).addScaledVector(sunDir,120);
  // --- palms sway
  for(const p of palms){p.crown.rotation.z=Math.sin(T*0.7+p.ph)*0.035*env.wind;p.crown.rotation.x=Math.sin(T*0.55+p.ph*2)*0.025*env.wind;for(const fr of p.fronds)fr.f.rotation.z=fr.base+Math.sin(T*1.4+fr.ph)*0.06*env.wind;}
  // --- gulls
  const gullVis=env.day>0.25;
  for(const g of gulls){g.g.visible=gullVis;if(!gullVis)continue;g.th+=g.dir*g.sp/g.r*dt;
    const x=g.cx+Math.cos(g.th)*g.r,z=g.cz+Math.sin(g.th)*g.r,y=g.y+Math.sin(T*0.3+g.ph)*2;
    g.g.position.set(x,y,z);const tx=-Math.sin(g.th)*g.dir,tz=Math.cos(g.th)*g.dir;g.g.rotation.set(-Math.cos(T*0.3+g.ph)*0.1,Math.atan2(tx,tz),-g.dir*0.32);
    const cyc=(T+g.ph)%7,flap=cyc<2.2?Math.sin((T+g.ph)*9)*0.75:0.1+Math.sin(T*1.3+g.ph)*0.05;
    for(const w of g.wings){w.inner.rotation.z=flap*0.65;w.outer.rotation.z=flap*0.45-0.05;}}
  // --- dolphins
  for(const d of dolphins){const k=d.k,px=-140+((T*3.2+k*5)%280),pz=-150+Math.sin(T*0.02+k)*12+k*3;
    let y,pitch;const tt=T*1.05+k*2.1;
    if(d.breach<0){d.next-=dt;if(d.next<=0){d.breach=0;d.next=R(10,24);}}
    if(d.breach>=0){d.breach+=dt/1.6;const s=d.breach;y=-1.4+2.9*4*s*(1-s);pitch=Math.atan2(2.9*4*(1-2*s)/1.6,4.5);if(s>=1)d.breach=-1;}
    else{y=-0.55+0.5*Math.sin(tt);pitch=Math.atan2(0.5*1.05*Math.cos(tt),3.2)*1.2;}
    d.d.position.set(px+k*4,y,pz);d.d.rotation.set(-pitch,Math.PI/2,0);
    if((d.prevY<0)!==(y<0)&&d.breach>=0){splash(px+k*4,0.05,pz,40,4);if(AC){const dx=px-camera.position.x,dz=pz-camera.position.z,dist=Math.hypot(dx,dz);noiseHit(bus.nature,900,0.6,0.5/(1+dist*0.02),0.02,0.7,(dx*Math.cos(camera.rotation.y)-dz*Math.sin(camera.rotation.y))/dist);}}
    d.prevY=y;}
  for(let i=0;i<SPL;i++){if(splLife[i]<=0)continue;splLife[i]-=dt;splVel[i*3+1]-=9.8*dt;splPos[i*3]+=splVel[i*3]*dt;splPos[i*3+1]+=splVel[i*3+1]*dt;splPos[i*3+2]+=splVel[i*3+2]*dt;if(splLife[i]<=0||splPos[i*3+1]<-0.2){splLife[i]=0;splPos[i*3+1]=-100;}}
  splGeo.attributes.position.needsUpdate=true;
  // --- crabs
  for(const c of crabs){c.timer-=dt;const near=Math.hypot(c.x-camera.position.x,c.z-camera.position.z)<3.5;
    if(near&&c.state===0){c.state=1;c.timer=1.5;c.dir=((c.x-camera.position.x)*Math.cos(c.h)-(c.z-camera.position.z)*Math.sin(c.h))>0?1:-1;}
    if(c.timer<=0){if(c.state===0){c.state=1;c.timer=R(0.8,2.2);c.dir=rnd()<0.5?1:-1;}else{c.state=0;c.timer=R(1.5,5);if(rnd()<0.3)c.h+=R(-1,1);}}
    if(c.state===1){const sp=(near?2.4:1.1)*c.dir*dt;c.x+=Math.cos(c.h)*sp;c.z-=Math.sin(c.h)*sp;const t=c.z-SHORE(c.x);if(t<0.5||t>22){c.dir*=-1;c.h+=Math.PI*0.5;}}
    c.g.position.set(c.x,H(c.x,c.z)-0.01,c.z);c.g.rotation.y=c.h;
    for(const l of c.legs)l.p.rotation.x=c.state===1?Math.sin(T*24+l.j*1.6+l.sd)*0.55:0;}
  // --- butterflies
  const bVis=env.day>0.35;
  for(const b of butterflies){b.g.visible=bVis;if(!bVis)continue;
    if(b.rest>0){b.rest-=dt;b.vel.multiplyScalar(0.8);const a=0.4+0.45*(0.5+0.5*Math.sin(T*2+b.ph));b.ws.forEach(w=>w.rotation.z=a);if(b.rest<=0)b.tgt=pick(flowerPts);}
    else{v3.copy(b.tgt).sub(b.pos);const d=v3.length();if(d<0.15){b.rest=R(2,7);}
      v3.normalize().multiplyScalar(1.4);v3.x+=Math.sin(T*3.1+b.ph)*1.2;v3.y+=Math.sin(T*5.3+b.ph*2)*1.0+(d>3?0.6:0);v3.z+=Math.cos(T*2.7+b.ph)*1.2;
      b.vel.lerp(v3,dt*2.5);const fl=0.25+1.15*Math.abs(Math.sin(T*16+b.ph));b.ws.forEach(w=>w.rotation.z=fl);}
    b.pos.addScaledVector(b.vel,dt);b.g.position.copy(b.pos);if(b.vel.lengthSq()>0.01)b.g.rotation.y=Math.atan2(b.vel.x,b.vel.z);}
  ffMat.uniforms.uVis.value=clamp((0.65-env.day)/0.65,0,1);
  for(const bt of boats){bt.b.position.x+=bt.v*dt;if(bt.b.position.x>500)bt.b.position.x=-500;if(bt.b.position.x<-500)bt.b.position.x=500;bt.b.position.y=Math.sin(T*0.8+bt.v)*0.15;bt.b.rotation.z=Math.sin(T*0.6)*0.04;}
  // --- audio
  if(AC&&AC.state==='running'){const t=AC.currentTime,cy=camera.rotation.y,rx=Math.cos(cy),rz=-Math.sin(cy);
    for(const w of waveV){const sx=camera.position.x+w.off,sz=SHORE(sx),dx=sx-camera.position.x,dz=sz-camera.position.z,dist=Math.hypot(dx,dz)||1;
      const pan=clamp((dx*rx+dz*rz)/dist*0.85,-1,1),dg=1/(1+Math.max(0,dist-8)*0.025),ph=(phi+w.po+1)%1,c=gauss(ph,0.22,0.06)+gauss(ph,1.22,0.06),wa=gauss(ph,0.5,0.14);
      w.pan.pan.setTargetAtTime(pan,t,0.1);w.g1.gain.setTargetAtTime((0.1+0.8*c+0.22*wa)*dg,t,0.06);w.lp.frequency.setTargetAtTime(220+1700*c+350*wa,t,0.06);w.g2.gain.setTargetAtTime((0.012+0.1*wa+0.05*c)*dg,t,0.08);}
    const gust=0.5+0.5*Math.sin(T*0.07)*Math.sin(T*0.031+1)+0.2*(vnoise(T*0.15,3)-0.5);
    wind.g.gain.setTargetAtTime((0.12+0.28*gust)*env.wind,t,0.3);wind.bp.frequency.setTargetAtTime(280+420*gust,t,0.3);wind.g2.gain.setTargetAtTime(0.03*gust*env.wind,t,0.3);
    gullT-=dt;if(gullT<=0){gullT=R(5,14);if(env.day>0.3){const g=pick(gulls),dx=g.g.position.x-camera.position.x,dz=g.g.position.z-camera.position.z,dist=Math.hypot(dx,dz,g.g.position.y)||1;gullCall(clamp((dx*rx+dz*rz)/dist,-1,1)*0.9,clamp(28/(dist+10),0.15,1.2));}}
    birdT-=dt;if(birdT<=0){birdT=R(2.5,8);const w=moment==='matin'?1:moment==='jour'?0.5:moment==='coucher'?0.3:0;if(w>0&&rnd()<w)songbird(R(-0.9,0.9),R(0.4,1));}
    const night=clamp((0.55-env.day)/0.55,0,1);if(night>0.05)for(const c of crickets){c.t-=dt;if(c.t<=0){c.t=R(0.55,1.1);cricket(c,night);}}
    if(vol.musique>0){musicT-=dt;if(musicT<=0){musicT=9;playChord();}chimeT-=dt;if(chimeT<=0){chimeT=R(5,12);chime();}}}
  // --- breath guide
  if(showBreath){const lv=Math.sin(6.2832*(phi-0.05)),sc=0.55+0.45*(0.5+0.5*lv);$('breath').firstElementChild.style.transform=`scale(${sc.toFixed(3)})`;const rising=Math.cos(6.2832*(phi-0.05))>0;const txt=rising?'Inspire':'Expire';const sp=$('breath').lastElementChild;if(sp.textContent!==txt)sp.textContent=txt;}
  // --- idle UI
  if(started){idle+=dt;if(idle>5&&$('panel').hidden&&$('act').hidden&&$('letter').hidden){$('dock').classList.add('hide');document.body.classList.add('idle');}}
  for(const h of hooks)h(dt,T,phi);
  renderer.render(scene,camera);
  for(const h of postHooks)h();
  requestAnimationFrame(frame);
}
setMoment(moment);
requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.__w={snap:()=>loadPreset(env,PRESETS[moment]),setMoment,setMode,start,camera,get T(){return T},jump:(t)=>{T+=t;Tcam+=t}};
export {scene,camera,renderer,H,SHORE,R,rnd,pick,clamp,smooth,vnoise,env,U,WATER_U,vol,bus,AC,NB,noiseHit,env1,hooks,postHooks,clickHooks,drawHooks,ui,state,tip,$,isTouch,canvasTex,goto,setMoment,walker,sunDir,wake};
