import * as THREE from 'three';
import {scene,renderer} from './app.js';

// Real-world materials for palms and houses (ambientCG, CC0):
//  - palm fronds rebuilt from photographed leaflets (assets/palm_frond.png)
//  - fibrous bark on every palm trunk
//  - lime plaster on walls and terracotta tiles on roofs of the village
const tl=new THREE.TextureLoader(),aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
function tex(u,srgb=true){const t=tl.load(u);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=aniso;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}

// ---------- 1. palm fronds ----------
const frond=tex('./assets/palm_frond.png');
const leafMats=new Set(),depthMats=new Set();
scene.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of [].concat(o.material)){if(m&&m.isMeshStandardMaterial&&m.map&&m.alphaTest>0.4&&m.alphaTest<0.5&&m.side===THREE.DoubleSide&&m.map.image&&m.map.image.width===256&&m.map.image.height===128)leafMats.add(m);}
  if(o.customDepthMaterial&&o.customDepthMaterial.map&&o.customDepthMaterial.alphaTest>0.4)depthMats.add(o.customDepthMaterial);
});
for(const m of leafMats){m.map=frond;m.alphaTest=0.3;m.alphaToCoverage=true;m.color.set('#a9bb8a');m.roughness=0.7;m.needsUpdate=true;}
for(const d of depthMats){d.map=frond;d.alphaTest=0.3;d.needsUpdate=true;}

// ---------- shared triplanar helper (works on meshes without UVs) ----------
function triplanar(mat,uniforms,body){
  const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='varying vec3 vTpP;varying vec3 vTpN;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTpP=(modelMatrix*vec4(transformed,1.0)).xyz;vTpN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader='varying vec3 vTpP;varying vec3 vTpN;\n'+Object.keys(uniforms).map(k=>(uniforms[k].value&&uniforms[k].value.isTexture?'uniform sampler2D ':'uniform float ')+k+';').join('\n')+`
vec3 tri(sampler2D t,float s){vec3 b=pow(abs(normalize(vTpN)),vec3(4.0));b/=dot(b,vec3(1.0));return texture2D(t,vTpP.zy*s).rgb*b.x+texture2D(t,vTpP.xz*s).rgb*b.y+texture2D(t,vTpP.xy*s).rgb*b.z;}
`+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+body);};
  mat.customProgramCacheKey=()=>mat.uuid;mat.needsUpdate=true;
}

// ---------- 2. bark on the trunks ----------
const bark=tex('./assets/bark_palm.jpg');
const trunkMats=new Set();
scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;const m=o.material;if(!m||!m.isMeshStandardMaterial||!m.vertexColors||m.map)return;
  const g=o.geometry;if((m.roughness===0.95&&g.type==='TubeGeometry')||(m.roughness===0.9&&!m.flatShading&&g.attributes.position.count>20000))trunkMats.add(m);});
for(const m of trunkMats)triplanar(m,{tBark:{value:bark}},`
  { vec3 bk=tri(tBark,0.9); float ring=dot(diffuseColor.rgb,vec3(0.33))/0.30;
    diffuseColor.rgb=bk*vec3(1.55,1.45,1.35)*clamp(ring,0.6,1.3); }`);

// ---------- 3. plaster walls & terracotta roof tiles on the village ----------
const plaster=tex('./assets/plaster.jpg'),tiles=tex('./assets/roof_tiles.jpg');
let village=null;
scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material&&o.material.isMeshStandardMaterial&&o.material.vertexColors&&o.material.flatShading&&Math.abs(o.material.roughness-0.85)<1e-6)village=o;});
if(village)triplanar(village.material,{tPlaster:{value:plaster},tTiles:{value:tiles}},`
  { vec3 base=diffuseColor.rgb;
    vec3 pl=tri(tPlaster,0.45)/vec3(0.68,0.653,0.63);
    float terra=smoothstep(0.18,0.32,base.r-base.g)*smoothstep(0.2,0.45,normalize(vTpN).y);
    vec3 tl2=tri(tTiles,0.7)*vec3(1.35,1.3,1.25);
    diffuseColor.rgb=mix(base*mix(vec3(1.0),pl,0.85),tl2,terra); }`);
