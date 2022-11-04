import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { EffectComposer } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SMAAPass.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.142.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { FullScreenQuad } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/Pass.js';
import { EffectShader } from "./EffectShader.js";
import { OrbitControls } from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/OrbitControls.js';
import { AssetManager } from './AssetManager.js';
import { VerticalBlurShader } from './VerticalBlurShader.js';
import { HorizontalBlurShader } from './HorizontalBlurShader.js';
import { Stats } from "./stats.js";
import { GUI } from 'https://unpkg.com/three@0.142.0/examples/jsm/libs/lil-gui.module.min.js';
const makeSDFGenerator = (clientWidth, clientHeight, renderer) => {
    let finalTarget = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let outsideRenderTarget = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let insideRenderTarget = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let outsideRenderTarget2 = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let insideRenderTarget2 = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let outsideRenderTargetFinal = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    let insideRenderTargetFinal = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
    });
    const uvRender = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: {
            tex: { value: null }
        },
        vertexShader: /*glsl*/ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `,
        fragmentShader: /*glsl*/ `
    uniform sampler2D tex;
    varying vec2 vUv;
    #include <packing>
    void main() {
        gl_FragColor = pack2HalfToRGBA(vUv * (round(texture2D(tex, vUv).x)));
    }
    `
    }));
    const uvRenderInside = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: {
            tex: { value: null }
        },
        vertexShader: /*glsl*/ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,
        fragmentShader: /*glsl*/ `
uniform sampler2D tex;
varying vec2 vUv;
#include <packing>
void main() {
    gl_FragColor = pack2HalfToRGBA(vUv * (1.0 - round(texture2D(tex, vUv).x)));

}
`
    }));
    const jumpFloodRender = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: {
            tex: { value: null },
            offset: { value: 0.0 },
            level: { value: 0.0 },
            maxSteps: { value: 0.0 }
        },
        vertexShader: /*glsl*/ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `,
        fragmentShader: /*glsl*/ `
    varying vec2 vUv;
    uniform sampler2D tex;
    uniform float offset;
    uniform float level;
    uniform float maxSteps;
    #include <packing>
    void main() {
        float closestDist = 9999999.9;
        vec2 closestPos = vec2(0.0);
        for(float x = -1.0; x <= 1.0; x += 1.0)
        {
           for(float y = -1.0; y <= 1.0; y += 1.0)
           {
              vec2 voffset = vUv;
              voffset += vec2(x, y) * vec2(${1/clientWidth}, ${1/clientHeight}) * offset;
     
              vec2 pos = unpackRGBATo2Half(texture2D(tex, voffset));
              float dist = distance(pos.xy, vUv);
     
              if(pos.x != 0.0 && pos.y != 0.0 && dist < closestDist)
              {
                closestDist = dist;
                closestPos = pos;
              }
           }
        }
        gl_FragColor = pack2HalfToRGBA(closestPos);
    }
    `
    }));
    const distanceFieldRender = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: {
            tex: { value: null }
        },
        vertexShader: /*glsl*/ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `,
        fragmentShader: /*glsl*/ `
    varying vec2 vUv;
    uniform sampler2D tex;
    #include <packing>
    void main() {
        gl_FragColor = packDepthToRGBA(clamp(distance(unpackRGBATo2Half(texture2D(tex, vUv)), vUv), 0.0, 1.0));
    }
    `
    }));
    const compositeRender = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: {
            inside: { value: insideRenderTargetFinal.texture },
            outside: { value: outsideRenderTargetFinal.texture },
            tex: { value: null }
        },
        vertexShader: /*glsl*/ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
        `,
        fragmentShader: /*glsl*/ `
        varying vec2 vUv;
        uniform sampler2D inside;
        uniform sampler2D outside;
        uniform sampler2D tex;
        #include <packing>
        void main() {
            float i = unpackRGBAToDepth(texture2D(inside, vUv));
            float o = unpackRGBAToDepth(texture2D(outside, vUv));
            if (texture2D(tex, vUv).x == 0.0) {
                gl_FragColor = packDepthToRGBA(0.5 + 0.5 * o);
            } else {
                gl_FragColor = packDepthToRGBA(0.5 + 0.5 * -i);
            }
            //gl_FragColor = vec4(vec3(i), 1.0);
        }
        `
    }));
    return (image, unique = true) => {
        let ft = finalTarget;
        if (unique) {
            ft = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                //type: THREE.FloatType
            });
        }
        image.minFilter = THREE.NearestFilter;
        image.maxFilter = THREE.NearestFilter;
        uvRender.material.uniforms.tex.value = image;
        renderer.setRenderTarget(outsideRenderTarget);
        uvRender.render(renderer);

        const passes = Math.ceil(Math.log(Math.max(clientWidth, clientHeight)) / Math.log(2.0));
        let lastTarget = outsideRenderTarget;
        let target;
        for (let i = 0; i < passes; i++) {
            const offset = Math.pow(2, passes - i - 1);
            target = lastTarget === outsideRenderTarget ? outsideRenderTarget2 : outsideRenderTarget;
            jumpFloodRender.material.uniforms.level.value = i;
            jumpFloodRender.material.uniforms.maxSteps.value = passes;
            jumpFloodRender.material.uniforms.offset.value = offset;
            jumpFloodRender.material.uniforms.tex.value = lastTarget.texture;
            renderer.setRenderTarget(target);
            jumpFloodRender.render(renderer);
            lastTarget = target;
        }
        renderer.setRenderTarget(outsideRenderTargetFinal);
        distanceFieldRender.material.uniforms.tex.value = target.texture;
        distanceFieldRender.render(renderer);
        uvRenderInside.material.uniforms.tex.value = image;
        renderer.setRenderTarget(insideRenderTarget);
        uvRenderInside.render(renderer);
        lastTarget = insideRenderTarget;
        target = undefined;
        for (let i = 0; i < passes; i++) {
            const offset = Math.pow(2, passes - i - 1);
            target = lastTarget === insideRenderTarget ? insideRenderTarget2 : insideRenderTarget;
            jumpFloodRender.material.uniforms.level.value = i;
            jumpFloodRender.material.uniforms.maxSteps.value = passes;
            jumpFloodRender.material.uniforms.offset.value = offset;
            jumpFloodRender.material.uniforms.tex.value = lastTarget.texture;
            renderer.setRenderTarget(target);
            jumpFloodRender.render(renderer);
            lastTarget = target;
        }
        renderer.setRenderTarget(insideRenderTargetFinal);
        distanceFieldRender.material.uniforms.tex.value = target.texture;
        distanceFieldRender.render(renderer);
        renderer.setRenderTarget(ft);
        compositeRender.material.uniforms.tex.value = image;
        compositeRender.render(renderer);
        return ft.texture;
    }
}
async function main() {
    // Setup basic renderer, controls, and profiler
    const clientWidth = window.innerWidth; //window.innerWidth * 0.99;
    const clientHeight = window.innerHeight; //window.innerHeight * 0.98;
    const giScale = 0.25;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set(50, 75, 50);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.transform = "translate(-50%, -50%)";
    renderer.domElement.style.left = "50%";
    renderer.domElement.style.top = "50%";
    renderer.domElement.style.position = "absolute";
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 25, 0);
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    // Build postprocessing stack
    // Render Targets
    const defaultTexture = new THREE.WebGLRenderTarget(clientWidth * giScale, clientHeight * giScale, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter
    });
    //defaultTexture.depthTexture = new THREE.DepthTexture(clientWidth * giScale, clientHeight * giScale, THREE.FloatType);
    const colorBuffer = new Float32Array(clientWidth * clientHeight * 4);
    const metaBuffer = new Uint8Array(clientWidth * clientHeight);
    let colorTex = new THREE.DataTexture(colorBuffer, clientWidth, clientHeight);
    colorTex.type = THREE.FloatType;
    colorTex.needsUpdate = true;
    let metaTex = new THREE.DataTexture(metaBuffer, clientWidth, clientHeight);
    metaTex.format = THREE.RedFormat;
    metaTex.needsUpdate = true;
    const gui = new GUI();
    const effectController = {
        wallAware: true,
        denoise: true,
        bilateralBlur: true,
        blurSize: 1.6,
        blurSigma: 0.175,
        raysPerPixel: 32.0,
        color: [1, 0, 0],
        emissive: 1.0,
        solid: true,
        radius: 5.0
    }
    gui.add(effectController, "denoise").name("Denoise");
    gui.add(effectController, "wallAware").name("Wall Aware Denoise");
    gui.add(effectController, "bilateralBlur").name("Bilateral Blur");
    gui.add(effectController, "blurSize", 1.0, 2.0, 0.001).name("Blur Size");
    gui.add(effectController, "blurSigma", 0.01, 1.0, 0.001).name("Blur Sigma");
    gui.add(effectController, "raysPerPixel", 1.0, 256.0, 1.0).name("Rays Per Pixel");
    const brush = gui.addFolder("Brush");
    const colorController = brush.addColor(effectController, "color").name("Color");
    const emissiveController = brush.add(effectController, "emissive", 0, 1, 0.001).name("Emissive");
    const solidController = brush.add(effectController, "solid").name("Solid");
    brush.add(effectController, "radius", 1, 20, 1.0).name("Radius");

    function SRGBToLinear(c) {

        return (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);

    }

    const presets = {
            1: {
                color: [1, 0, 0],
                emissive: 1.0,
                solid: true
            },
            2: {
                color: [0, 1, 0],
                emissive: 1.0,
                solid: true
            },
            3: {
                color: [0, 0, 1],
                emissive: 1.0,
                solid: true
            },
            4: {
                color: [1, 1, 0],
                emissive: 1.0,
                solid: true
            },
            5: {
                color: [1, 0, 1],
                emissive: 1.0,
                solid: true
            },
            6: {
                color: [0, 1, 1],
                emissive: 1.0,
                solid: true
            },
            7: {
                color: [0.25, 0.25, 0.25],
                emissive: 0.0,
                solid: true
            },
            8: {
                color: [0.0, 0.0, 0.0],
                emissive: 0.0,
                solid: true
            },
            9: {
                color: [0.0, 0.0, 0.0],
                emissive: 0.0,
                solid: false
            },
            0: {
                color: [1.0, 1.0, 1.0],
                emissive: 1.0,
                solid: true,
                rainbow: true
            }
        }
        // Post Effects
    let mouseDown = false;
    document.addEventListener("mousedown", e => {
        mouseDown = true;
    });
    document.addEventListener("mouseup", e => {
        mouseDown = false;
    });
    const keys = {};
    document.addEventListener("keydown", e => {
        keys[e.key] = true;
        const p = presets[e.key];
        if (p) {
            colorController.setValue(p.color);
            emissiveController.setValue(p.emissive);
            solidController.setValue(p.solid);
            effectController.rainbow = !!p.rainbow;
        }
    });
    document.addEventListener("keyup", e => {
        keys[e.key] = false;
    });
    let px, py, x, y;
    const _rainbowCol = new THREE.Color().setHSL(0, 1, 0.5);
    const drawLine = (e, mouseDown) => {
        if (!mouseDown) {
            return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        const x = Math.floor(e.clientX - rect.left);
        const y = Math.floor(e.clientY - rect.top);
        if (!px || !py) {
            px = x;
            py = y;
        }
        const dist = Math.hypot(x - px, y - py);
        const invDist = 1 / dist;
        for (let i = 0; i < 1; i += invDist) {
            const ix = Math.floor(px + (x - px) * i);
            const iy = Math.floor(py + (y - py) * i);
            if (effectController.rainbow) {
                _rainbowCol.offsetHSL(0.001, 0.0, 0.0);
            }
            const radius = effectController.radius;
            for (let y_ = -radius; y_ <= radius; y_++) {
                for (let x_ = -radius; x_ <= radius; x_++) {
                    if (x_ * x_ + y_ * y_ < radius * radius + radius) {
                        const fx = ix + x_;
                        const fy = iy + y_;
                        if (fx < 0 || fx > clientWidth - 1) {
                            continue;
                        }
                        if (fy < 0 || fy > clientWidth - 1) {
                            continue;
                        }
                        const idxM = ((clientHeight - fy) * clientWidth + (fx));
                        const idx = idxM * 4;
                        colorBuffer[idx] = effectController.rainbow ? _rainbowCol.r : (effectController.color[0]);
                        colorBuffer[idx + 1] = effectController.rainbow ? _rainbowCol.g : (effectController.color[1]);
                        colorBuffer[idx + 2] = effectController.rainbow ? _rainbowCol.b : (effectController.color[2]);
                        colorBuffer[idx + 3] = effectController.emissive;
                        metaBuffer[idxM] = 255.0 * effectController.solid;
                    }
                }
            }
        }
        px = x;
        py = y;
    }
    renderer.domElement.addEventListener("mousemove", e => {
        drawLine(e, mouseDown);
    });
    renderer.domElement.addEventListener("mousedown", e => {
        px,
        py = undefined;
        drawLine(e, true);
    });
    const sdfGen = makeSDFGenerator(clientWidth * giScale, clientHeight * giScale, renderer);
    const bluenoise = await new THREE.TextureLoader().loadAsync("bluenoise.png");
    bluenoise.wrapS = THREE.RepeatWrapping;
    bluenoise.wrapT = THREE.RepeatWrapping;
    bluenoise.magFilter = THREE.NearestFilter;
    bluenoise.minFilter = THREE.NearestFilter;
    const composer = new EffectComposer(renderer);
    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const effectQuad = new FullScreenQuad(new THREE.ShaderMaterial(EffectShader));
    const effectPass = effectQuad.material;
    const CopyShader = {

        uniforms: {
            'meta': { value: null },
            'diffuse': { value: null },
            'color': { value: null },
            'dist': { value: null },
            'opacity': { value: 1.0 },
            'edgeRadius': { value: 2.0 },
            'edgeStrength': { value: 4.0 },
            'resolution': { value: new THREE.Vector2(clientWidth, clientHeight) },
            'giScale': { value: giScale }
        },

        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }`,

        fragmentShader: /* glsl */ `
            uniform float opacity;
            uniform sampler2D diffuse;
            uniform sampler2D meta;
            uniform sampler2D color;
            uniform vec2 resolution;
            uniform float edgeRadius;
            uniform float edgeStrength;
            uniform sampler2D dist;
            uniform float giScale;
            varying vec2 vUv;
            #define PI 3.141592653589793
            void main() {
                float metaVal = texture2D( meta, vUv ).x;
                vec2 pushDir = vec2(0.0);
                float count = 0.0;
                for(float x = -edgeRadius; x <= edgeRadius; x++) {
                    for(float y = -edgeRadius; y <= edgeRadius; y++) {
                        vec2 sampleUv = (vUv * resolution + vec2(x, y)) / resolution;
                        float metaData = texture2D(meta, sampleUv).x;
                        if (metaData == metaVal) {
                            pushDir += (x == 0.0 && y == 0.0) ? vec2(x, y) : normalize(vec2(x, y));
                            count += 1.0;
                        }
                    }
                }
                if (count == 0.0) {
                    count = 1.0;
                }
                pushDir /= count;
               //pushDir = normalize(pushDir);
               vec2 sampleUv;
               float pushStrength = edgeStrength;
               for(int i = 0; i < 5; i++) {
                sampleUv = length(pushDir) > 0.0 ? vUv + pushStrength * (pushDir / resolution) : vUv;
                if (texture2D(meta, sampleUv).x == metaVal) {
                    break;
                }
                pushStrength *= 0.5;
               }
               vec4 bestSample = texture2D(diffuse, sampleUv);
               vec4 col = texture2D(color, vUv);
               if (length(bestSample.rgb) == 0.0 && metaVal == 0.0) {
                //float distSample = texture2D(dist, sampleUv).x;
                /* vec2 sampleStep = 1.0 / (resolution * giScale);*/

                /*sampleUv += 4.0 * gradient * sampleStep;
                bestSample = texture2D(diffuse, sampleUv);
                //bestSample = texture2D(diffuse, sampleUv);*/
                vec2 sampleStep = 1.0 / (resolution * giScale);
                for(float i = 0.0; i <= 10.0; i++) {
                    bestSample = texture2D(diffuse, sampleUv + (mod(i, 2.0) == 0.0 ? 1.0 : -1.0) * pow(2.0, floor(i / 2.0)) * vec2(sin((i / 10.0) * 2.0 * PI), cos((i / 10.0) * 2.0 * PI)) * sampleStep);
                    if (length(bestSample.rgb) != 0.0) {
                        break;
                    }
                   /* bestSample = texture2D(diffuse, sampleUv + (mod(i, 2.0) == 0.0 ? 1.0 : -1.0) * pow(2.0, floor(i / 2.0)) * gradient * sampleStep);
                    if (length(bestSample.rgb) != 0.0) {
                        break;
                    }*/
                }
               }
                gl_FragColor = vec4(mix(bestSample.rgb, col.rgb, metaVal), 1.0);
            }`

    };

    const copyPass = new ShaderPass(CopyShader);
    //composer.addPass(effectPass);
    composer.addPass(copyPass);
    const blurs = [];
    for (let i = 0; i < 6; i++) {
        const hblur = new ShaderPass(HorizontalBlurShader);
        const vblur = new ShaderPass(VerticalBlurShader);
        blurs.push([hblur, vblur]);
    }
    for (const [hblur, vblur] of blurs) {
        composer.addPass(hblur);
        composer.addPass(vblur);
    }
    composer.addPass(new ShaderPass({
        uniforms: {
            'tDiffuse': {
                value: null
            }
        },
        vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
        fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
        #include <common>
        #define DITHERING
        #include <dithering_pars_fragment>
		void main() {
			vec4 tex = texture2D( tDiffuse, vUv );
			//gl_FragColor = LinearTosRGB( tex );
            gl_FragColor = tex;
            #include <dithering_fragment>
		}`
    }));
    composer.addPass(smaaPass);
    let distMap;

    function animate() {
        distMap = sdfGen(metaTex, false);
        // colorBuffer[i] = 1;
        // i++;
        colorTex.needsUpdate = true;
        metaTex.needsUpdate = true;
        blurs.forEach(([hblur, vblur], i) => {
            const blurSize = effectController.blurSize ** (blurs.length - i - 1);
            hblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            vblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            hblur.uniforms["metaTex"].value = metaTex;
            vblur.uniforms["metaTex"].value = metaTex;
            hblur.uniforms["wallAware"].value = effectController.wallAware;
            vblur.uniforms["wallAware"].value = effectController.wallAware;
            hblur.uniforms.h.value = blurSize;
            vblur.uniforms.v.value = blurSize;
            hblur.uniforms.sigma.value = effectController.blurSigma;
            vblur.uniforms.sigma.value = effectController.blurSigma;
            hblur.uniforms.bilateralBlur.value = effectController.bilateralBlur;
            vblur.uniforms.bilateralBlur.value = effectController.bilateralBlur;
            hblur.enabled = effectController.denoise;
            vblur.enabled = effectController.denoise;
        });
        //  renderer.setRenderTarget(defaultTexture);
        // renderer.clear();
        //renderer.render(scene, camera);
        effectPass.uniforms["resolution"].value = new THREE.Vector2(clientWidth * giScale, clientHeight * giScale);
        effectPass.uniforms["albedoMap"].value = colorTex;
        effectPass.uniforms["metaMap"].value = metaTex;
        effectPass.uniforms["distMap"].value = distMap;
        effectPass.uniforms["bluenoise"].value = bluenoise;
        effectPass.uniforms["time"].value = performance.now() / 1000;
        effectPass.uniforms["raysPerPixel"].value = effectController.raysPerPixel;
        renderer.setRenderTarget(defaultTexture);
        effectQuad.render(renderer);
        copyPass.uniforms.diffuse.value = defaultTexture.texture;
        copyPass.uniforms.meta.value = metaTex;
        copyPass.uniforms.color.value = colorTex;
        copyPass.uniforms.dist.value = distMap;
        /*blurs[0][0].uniforms.tDiffuse.value = defaultTexture.texture;*/
        composer.render();
        controls.update();
        stats.update();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
main();