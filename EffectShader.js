import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
const EffectShader = {

    uniforms: {

        'albedoMap': { value: null },
        'metaMap': { value: null },
        'distMap': { value: null },
        'bluenoise': { value: null },
        'resolution': { value: new THREE.Vector2() },
        'time': { value: 0 },
        'raysPerPixel': { value: 32.0 }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D albedoMap;
    uniform sampler2D metaMap;
		uniform sampler2D distMap;
    uniform sampler2D bluenoise;
    uniform float time;
    uniform float raysPerPixel;
    uniform vec2 resolution;
        varying vec2 vUv;
    #define PI 3.141592653589793
    #include <common>
// based on https://www.shadertoy.com/view/MslGR8
vec3 dithering( vec3 color ) {
  //Calculate grid position
  float grid_position = rand( gl_FragCoord.xy );
  //Shift the individual colors differently, thus making it even harder to see the dithering pattern
  vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
  //modify shift according to grid position.
  dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
  //shift the color by dither_shift
  return color + dither_shift_RGB;
}
    vec3 castRay(vec2 origin, vec2 dir) {
      float currentDist = 0.0;
      bool hit = false;
      int i;
      for(i = 0; i < 2048; i++) {
        vec2 samplePoint = origin + dir * currentDist;
        if (samplePoint.x < 0.0 || samplePoint.x > 1.0
          || samplePoint.y < 0.0 || samplePoint.y > 1.0) {
            break;
        }
        float distToSurface = texture2D(distMap, samplePoint).x;
        currentDist += distToSurface;
        if (distToSurface < 0.0) {
          currentDist -= 2.0 * distToSurface;
          hit = true;
          break;
        }
      }
      if (hit) {
        vec4 hitInfo = texture2D(albedoMap, origin + (dir) * currentDist).rgba;
        return hitInfo.rgb * hitInfo.a;
      } else {
        return vec3(0.0);
      }
    }
		void main() {
            vec4 diffuse = texture2D(albedoMap, vUv);
            vec4 meta = texture2D(metaMap, vUv);
            vec4 dist = texture2D(distMap, vUv);
            vec4 noise = texture2D(bluenoise, vUv * (resolution / vec2(1024.0)));
           if (meta.r == 1.0) {
             gl_FragColor = vec4(0.0, 0.0, 0.0/*diffuse.rgb * 0.5*/, 1.0);
             return;
            } else {
              vec3 finalColor = vec3(0.0);
              float count = 0.0;
              float offsetAngle = noise.x * 2.0 * PI;
              for(float i = 0.0; i < 2.0 * PI; i += PI / (raysPerPixel * 0.5)) {
                vec3 result = castRay(vUv, vec2(cos(i + offsetAngle), sin(i + offsetAngle)));
                finalColor += result;
                count++;
              }
              finalColor /= max(count, 1.0);
              gl_FragColor = vec4(vec3(finalColor), 1.0);
            }
            gl_FragColor.rgb = dithering(gl_FragColor.rgb);
            gl_FragColor = clamp(gl_FragColor, vec4(0.0), vec4(1.0));
            gl_FragColor = LinearTosRGB(gl_FragColor);
		}`

};

export { EffectShader };