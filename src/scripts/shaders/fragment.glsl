precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uImageResolution;
uniform float uAlpha;
uniform float uOpacity;
uniform float uSplit;

varying vec2 vUv;

vec2 getCorrectUv (vec2 uv, vec2 resolution, vec2 textureResolution){
  vec2 ratio = vec2(
    min((resolution.x / resolution.y) / (textureResolution.x / textureResolution.y), 1.0),
    min((resolution.y / resolution.x) / (textureResolution.y / textureResolution.x), 1.0)
  );

  return vec2(
    uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    uv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );
}

void main(){
  vec2 uv = vUv;

  // The top half slides up, the bottom half down; the gap shows what is under.
  if (uv.y >= 0.5 + uSplit) {
    uv.y -= uSplit;
  } else if (uv.y < 0.5 - uSplit) {
    uv.y += uSplit;
  } else {
    discard;
  }

  vec4 texture = texture2D(uTexture, getCorrectUv(uv, uResolution, uImageResolution));

  gl_FragColor = vec4(texture.rgb, uAlpha * uOpacity);
}
