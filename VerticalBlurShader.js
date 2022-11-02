import * as THREE from 'https://cdn.skypack.dev/pin/three@v0.137.0-X5O2PK3x44y1WRry67Kr/mode=imports/optimized/three.js';

const VerticalBlurShader = {

    uniforms: {

        'tDiffuse': { value: null },
        'v': { value: 1.0 / 512.0 },
        'resolution': { value: new THREE.Vector2() },
        'metaTex': { value: null },
        'wallAware': { value: true },
        'sigma': { value: 0.1 },
        'bilateralBlur': { value: true }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
	varying vec2 vUv;
		uniform sampler2D tDiffuse;
		uniform sampler2D metaTex;
		uniform float v;
		uniform float sigma;
		uniform vec2 resolution;
		uniform bool wallAware;
		uniform bool bilateralBlur;
		float normpdf3(in vec3 v, in float sigma)
		{
			return 0.39894*exp(-0.5*dot(v,v)/(sigma*sigma))/sigma;
		}
		void main() {
			if (texture2D(metaTex, vUv).x == 1.0) {
				gl_FragColor = texture2D(tDiffuse, vUv);
				return;
			}
			vec4 sum = vec4( 0.0 );
			float weightSum = 0.0;
			vec4 ref = texture2D(tDiffuse, vUv);
			float[9] weights =  float[9](0.051, 0.0918, 0.12245, 0.1531, 0.1633, 0.1531, 0.12245, 0.0918, 0.051);
			float radius = v / resolution.x; //max(h * (1.0 - d) * (-blurSharp * pow(b - 0.5, 2.0) + 1.0), blurThreshold / resolution.x);
			for(float i = -1.0; i >= -4.0; i--) {
				vec2 sampleUv = vec2( vUv.x, vUv.y + i * radius);
				float metaVal = texture2D(metaTex, sampleUv).x;
				if (metaVal == 1.0 && wallAware) {
					break;
				}
				vec4 sam = texture2D( tDiffuse, sampleUv);
				float w = weights[int(i + 4.0)] * (1.0 - metaVal) * (bilateralBlur ? normpdf3((sam - ref).rgb, sigma) : 1.0);
				sum += sam * w;
				weightSum += w;
			}
			for(float i = 0.0; i <= 0.0; i++) {
				vec2 sampleUv = vec2( vUv.x, vUv.y + i * radius );
				float w = weights[int(i + 4.0)] * (1.0 - texture2D(metaTex, sampleUv).x);
				sum += texture2D( tDiffuse, sampleUv) * w;
				weightSum += w;
			}
			for(float i = 1.0; i <= 4.0; i++) {
				vec2 sampleUv = vec2( vUv.x, vUv.y + i * radius);
				float metaVal = texture2D(metaTex, sampleUv).x;
				if (metaVal == 1.0 && wallAware) {
					break;
				}
				vec4 sam = texture2D( tDiffuse, sampleUv);
				float w = weights[int(i + 4.0)] * (1.0 - metaVal) * (bilateralBlur ? normpdf3((sam - ref).rgb, sigma) : 1.0);
				sum += sam * w;
				weightSum += w;
			}
			sum /= weightSum;
			gl_FragColor = sum;
			gl_FragColor = clamp(gl_FragColor, vec4(0.0), vec4(1.0));
		}`

};

export { VerticalBlurShader };