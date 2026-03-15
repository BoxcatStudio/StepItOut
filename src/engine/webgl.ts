// WebGL 2D Compositor Engine for High-Performance Additive Blending
// This takes the load completely off the CPU Canvas2D context

export class WebGLCompositor {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;

  private positionLocation: number;
  private texcoordLocation: number;
  private opacityLocation: WebGLUniformLocation;
  private transformLocation: WebGLUniformLocation;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { 
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
      depth: false 
    });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    // Additive blending setup: color = src * alpha + dst * 1
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

    const vsSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texcoord;
      uniform vec4 u_transform; 
      out vec2 v_texcoord;
      void main() {
        vec2 mappedPos = a_position * u_transform.zw + u_transform.xy;
        vec2 clipSpace = mappedPos * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_texcoord = a_texcoord;
      }
    `;

    const fsSource = `#version 300 es
      precision mediump float;
      in vec2 v_texcoord;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      out vec4 outColor;
      void main() {
        vec4 texColor = texture(u_texture, v_texcoord);
        outColor = vec4(texColor.rgb * u_opacity, texColor.a * u_opacity);
      }
    `;

    this.program = this.createProgram(vsSource, fsSource)!;
    this.gl.useProgram(this.program);

    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.texcoordLocation = this.gl.getAttribLocation(this.program, "a_texcoord");
    this.opacityLocation = this.gl.getUniformLocation(this.program, "u_opacity")!;
    this.transformLocation = this.gl.getUniformLocation(this.program, "u_transform")!;

    // Position Buffer (unit rect)
    this.positionBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), this.gl.STATIC_DRAW);

    // TexCoord Buffer
    this.texCoordBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), this.gl.STATIC_DRAW);
    
    // Setup VAO properties
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.enableVertexAttribArray(this.texcoordLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  private createShader(type: number, source: string) {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string) {
    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource)!;
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource)!;
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(this.gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  public createTexture(img: HTMLImageElement | HTMLCanvasElement): WebGLTexture {
    const tex = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    // Use raw pixel data correctly
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
    
    // Linear scaling
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    
    return tex;
  }

  public resize(width: number, height: number) {
    if (this.gl.canvas.width !== width || this.gl.canvas.height !== height) {
      this.gl.canvas.width = width;
      this.gl.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  public clear() {
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  public drawTexture(tex: WebGLTexture, opacity: number, imgWidth: number, imgHeight: number) {
    if (opacity <= 0) return;

    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.uniform1f(this.opacityLocation, opacity);

    // Calculate object-fit: contain geometry
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const canvasAspect = canvas.width / canvas.height;
    const imgAspect = imgWidth / imgHeight;

    let drawW, drawH, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
      // Image is wider than canvas
      drawW = 1.0;
      drawH = canvasAspect / imgAspect;
      offsetX = 0;
      offsetY = (1.0 - drawH) / 2.0;
    } else {
      // Image is taller than canvas
      drawH = 1.0;
      drawW = imgAspect / canvasAspect;
      offsetX = (1.0 - drawW) / 2.0;
      offsetY = 0;
    }

    this.gl.uniform4f(this.transformLocation, offsetX, offsetY, drawW, drawH);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  public destroyTexture(tex: WebGLTexture) {
    this.gl.deleteTexture(tex);
  }
}
