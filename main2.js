("use strict");

async function main() {
  // Prende il canvas e il contesto WebGL
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  if (!canvas) {
    console.warn("Canvas non trovato, WebGL non inizializzato.");
    return;
  }

  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.error("Errore: WebGL non supportato!");
    return;
  }

  // Imposta la dimensione del canvas
  resizeCanvasToDisplaySize(canvas, gl);

  // Imposta WebGL
  gl.clearColor(0, 0, 0, 1); // Sfondo nero
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); // Abilita il depth test per il 3D

  console.log("WebGL inizializzato con successo!");

  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_texcoord;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  varying vec3 v_normal;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `
  precision highp float;

  varying vec3 v_normal;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  void main () {
    vec3 normal = normalize(v_normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);

    vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    gl_FragColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        specular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;

  // compila i programmi shader e li collega
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  const objHref = "assets/textureprova/LowOkVersion.obj";
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  console.log(obj);
  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(
    obj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );
  const materials = parseMTL(matTexts.join("\n"));

  const textures = {
    defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]),
  };

  // carica le texture e le associa ai materiali
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith("Map"))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = createTexture(gl, textureHref);
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({ material, data }) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
    };
  });

  function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return { min, max };
  }

  function getGeometriesExtents(geometries) {
    return geometries.reduce(
      ({ min, max }, { data }) => {
        const minMax = getExtents(data.position);
        return {
          min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
          max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
        };
      },
      {
        min: Array(3).fill(Number.POSITIVE_INFINITY),
        max: Array(3).fill(Number.NEGATIVE_INFINITY),
      }
    );
  }

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  // amount to move the object so its center is at the origin
  const objOffset = m4.scaleVector(
    m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
    -1
  );

  // Crea un buffer info dai dati OBJ
  // const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);

  // Impostazioni della camera
  const cameraPosition = [0, 0, 20]; // Posizione della camera
  const cameraTarget = [0, 0, 0]; // Punto verso cui la camera è rivolta
  const zNear = 0.1;
  const zFar = 50;
  // Variabili per gestire l'input dell'utente
  let mouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let rotation = [0, 0]; // Angoli di rotazione del modello

  // Event listeners per gestire l'input dell'utente
  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (mouseDown) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;

      // Aggiorna gli angoli di rotazione del modello
      rotation[0] += dy * 0.01; // Ruota lungo l'asse X
      rotation[1] += dx * 0.01; // Ruota lungo l'asse Y

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  canvas.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  // Event listener per la tastiera
  document.addEventListener("keydown", (e) => {
    const rotationSpeed = 0.05; // Velocità di rotazione per ogni tasto premuto

    switch (e.key) {
      case "ArrowUp": // Rotazione verso l'alto
        rotation[0] -= rotationSpeed;
        break;
      case "ArrowDown": // Rotazione verso il basso
        rotation[0] += rotationSpeed;
        break;
      case "ArrowLeft": // Rotazione verso sinistra
        rotation[1] -= rotationSpeed;
        break;
      case "ArrowRight": // Rotazione verso destra
        rotation[1] += rotationSpeed;
        break;
    }

    // Impedisci lo scrolling della pagina con le frecce
    e.preventDefault();
  });

  // Imposta un limite per lo zoom
  const minZoom = 5; // Distanza minima della camera
  const maxZoom = 50; // Distanza massima della camera

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault(); // Evita lo scroll della pagina

    const zoomSpeed = 1; // Sensibilità dello zoom
    cameraPosition[2] += e.deltaY * 0.05 * zoomSpeed; // Modifica la posizione Z della camera

    // Limita lo zoom per evitare di passare attraverso l'oggetto o allontanarsi troppo
    cameraPosition[2] = Math.max(minZoom, Math.min(maxZoom, cameraPosition[2]));
  });

  // Funzione per convertire gradi in radianti
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  // Render function
  function render() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfViewRadians = degToRad(100);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    // Applica la rotazione al modello in base all'input dell'utente
    const modelMatrix = m4.multiply(
      m4.xRotation(rotation[0]),
      m4.yRotation(rotation[1])
    );

    const worldMatrix = m4.multiply(modelMatrix, m4.scaling(0.5, 0.5, 0.5));
    const worldInverseMatrix = m4.inverse(worldMatrix);
    const worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.

    webglUtils.setUniforms(meshProgramInfo, {
      u_world: worldMatrix,
      u_worldInverseTranspose: worldInverseTransposeMatrix,
      u_diffuse: [1, 0.7, 0.5, 1],
    });

    for (const { bufferInfo, material } of parts) {
      // calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
      webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
      // calls gl.uniform
      webglUtils.setUniforms(meshProgramInfo, {}, material);
      // calls gl.drawArrays or gl.drawElements
      webglUtils.drawBufferInfo(gl, bufferInfo);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
