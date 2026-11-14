import * as THREE from 'three';
import {RGBELoader} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js';
import {EffectComposer} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js';
import {scene,camera,renderer,env,hooks} from './app.js';

// Photographic materials (Poly Haven, CC0) + image-based lighting + filmic post-processing.
const LOW=new URLSearchParams(location.search).has('low');
const tl=new THREE.TextureLoader();
const aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
function tex(url,{srgb=false,rx=1,ry=1}={}){const t=tl.load(url);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=aniso;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}

// ---------- 1. real sand on the beach ----------
let terrain=null,rocks=[];
scene.traverse(o=>{
  if(o.isMesh&&!terrain&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===800&&o.material.vertexColors)terrain=o;
  if(o.isInstancedMesh&&o.geometry.type==='IcosahedronGeometry'&&o.material.flatShading&&o.geometry.parameters.detail===2)rocks.push(o);
});
if(terrain){
  const rx=800/3.2,ry=520/3.2,m=terrain.material;
  m.map=tex('./assets/coast_sand_01_Diffuse.jpg',{srgb:true,rx,ry});
  m.normalMap=tex('./assets/coast_sand_01_nor_gl.jpg',{rx,ry});m.normalScale.set(1.1,1.1);
  m.roughnessMap=tex('./assets/coast_sand_01_Rough.jpg',{rx,ry});m.roughness=1;
  m.color.setRGB(2.15,2.05,1.85);   // the photo texture multiplies the painted sand colours; compensate brightness
  m.needsUpdate=true;
}
// ---------- 2. real rock on the boulders ----------
if(rocks.length){
  const rm=rocks[0].material;
  rm.map=tex('./assets/aerial_rocks_02_Diffuse.jpg',{srgb:true,rx:2,ry:2});
  rm.normalMap=tex('./assets/aerial_rocks_02_nor_gl.jpg',{rx:2,ry:2});rm.normalScale.set(1.6,1.6);
  rm.roughnessMap=tex('./assets/aerial_rocks_02_Rough.jpg',{rx:2,ry:2});
  rm.flatShading=false;rm.color.set('#d8d0c4');rm.needsUpdate=true;
  rocks.forEach(r=>{r.geometry.computeVertexNormals();});
}
// ---------- 3. sea: detailed ripples from a real water normal map ----------
let water=null;scene.traverse(o=>{if(o.isMesh&&o.material&&o.material.isShaderMaterial&&o.material.uniforms&&o.material.uniforms.uLevel)water=o;});
if(water){
  const wn=tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg');wn.wrapS=wn.wrapT=THREE.RepeatWrapping;wn.anisotropy=aniso;
  const m=water.material;m.uniforms.uNorm={value:wn};
  const a='vec3 n=normalize(vN+vec3(-dx/e,0.0,-dz/e)*0.4*s);';
  if(m.fragmentShader.includes(a)){
    m.fragmentShader='uniform sampler2D uNorm;\n'+m.fragmentShader.replace(a,`vec2 q1=p*0.035+vec2(uTime*0.010,uTime*0.006),q2=p*0.09-vec2(uTime*0.008,-uTime*0.012),q3=p*0.23+vec2(-uTime*0.02,uTime*0.017);
    vec3 t1=texture2D(uNorm,q1).rgb*2.0-1.0,t2=texture2D(uNorm,q2).rgb*2.0-1.0,t3=texture2D(uNorm,q3).rgb*2.0-1.0;
    vec2 tn=(t1.xy+t2.xy*0.7+t3.xy*0.45);
    vec3 n=normalize(vN+vec3(tn.x,0.0,tn.y)*0.42*s+vec3(-dx/e,0.0,-dz/e)*0.12*s);`);
    m.needsUpdate=true;
  }
}
// ---------- 4. image-based lighting from a real beach panorama ----------
const mats=new Set();
new RGBELoader().load('./assets/fish_hoek_beach_1k.hdr',hdr=>{
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;hdr.dispose();pm.dispose();
  scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(x=>{if(x.isMeshStandardMaterial)mats.add(x);});});
});
let hemi=null;scene.traverse(o=>{if(o.isHemisphereLight)hemi=o;});

// ---------- 5. filmic post-processing: MSAA, bloom on the sun & sparkles, vignette ----------
let composer=null;
if(!LOW){
  const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
  composer=new EffectComposer(renderer,rt);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.32,0.55,0.92);composer.addPass(bloom);composer.bloom=bloom;
  composer.addPass(new OutputPass());
  const vig=new ShaderPass({uniforms:{tDiffuse:{value:null},uAmt:{value:0.28}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D tDiffuse;uniform float uAmt;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-0.5;float v=1.0-dot(d,d)*uAmt*2.2;c.rgb*=v;c.rgb=mix(c.rgb,c.rgb*vec3(1.03,1.0,0.96),0.6);gl_FragColor=c;}'});
  composer.addPass(vig);
  const orig=renderer.render.bind(renderer);let inside=false;
  renderer.render=(s,c)=>{if(inside||s!==scene){return orig(s,c);}inside=true;try{composer.render();}finally{inside=false;}};
  addEventListener('resize',()=>{composer.setSize(innerWidth,innerHeight);});
}

hooks.push(()=>{
  const d=env.day,light=env.light;
  // environment light follows the time of day (bright by day, faint moonlight at night)
  const k=0.25+0.75*light;for(const m of mats)m.envMapIntensity=k*(d>0.3?0.9:0.35);
  if(hemi)hemi.intensity*=0.6;
  if(composer&&composer.bloom)composer.bloom.strength=0.22+0.35*(1-d);
});
