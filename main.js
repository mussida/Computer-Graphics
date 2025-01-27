("use strict");

async function loadModel(gl, objHref) {
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);

  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(
    obj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );
  const materials = parseMTL(matTexts.join("\n"));
  console.log("Materiali caricati:", materials);

  const textures = {
    defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]),
  };

  // Carichiamo le texture per i materiali
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith("Map"))
      .forEach(([key, filename]) => {
        if (!filename) return; // Evitiamo errori su materiali senza texture
        let texture = textures[filename];

        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          console.log("Caricamento texture:", textureHref);
          texture = createTexture(gl, textureHref);
          textures[filename] = texture;
        }

        material[key] = texture;
      });
  }

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    ambient: [0.0, 0.0, 0.0],
    specular: [1, 1, 1],
    shininess: 400,
    opacity: 1,
    emissive: [0, 0, 0],
  };

  const parts = obj.geometries.map(({ material, data }) => {
    if (data.color) {
      if (data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      data.color = { value: [1, 1, 1, 1] };
    }

    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
    };
  });

  return { obj, parts };
}

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
  attribute vec3 a_position;
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
  varying vec3 vertPos;

  void main() {
    vec4 vertPos4 = u_world * vec4(a_position, 1.0); 
    vertPos = vec3(vertPos4) / vertPos4.w;            
    v_normal = vec3(u_world * vec4(a_normal, 0.0));   
    gl_Position = u_projection * u_view * vertPos4;   
    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `
  precision highp float;

  varying vec3 v_normal;
  varying vec3 v_surfaceToView;
  varying vec3 vertPos;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  uniform vec3 lightPos;
  uniform vec3 u_ambientLight;
  uniform float shininessAmbient;
  
  uniform vec3 diffuse;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform float shininess;
  uniform float opacity;

  uniform float Ka;
  uniform float Kd;
  uniform float Ks;

  uniform int mode;

  uniform sampler2D diffuseMap;
  uniform sampler2D specularMap;

  void main () {
    vec3 N = normalize(v_normal);
    vec3 L = normalize(lightPos - vertPos);
    float lambertian = max(dot(N, L), 0.0);
    float specularLight = 0.0;

    if (lambertian > 0.0) {
        vec3 R = reflect(-L, N);      // Reflected light vector
        vec3 V = normalize(-vertPos); // Vector to viewer
        float specAngle = max(dot(R, V), 0.0);
        specularLight = pow(specAngle, shininessAmbient);
    }

    // Leggi la mappa di diffusione e combina con il colore dell'oggetto
    vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;

    // Leggi la mappa di specularità
    vec4 specularMapColor = texture2D(specularMap, v_texcoord);
    vec3 effectiveSpecular = specularMapColor.rgb * specularLight * specular;

    // Calcola il colore finale
    gl_FragColor = vec4(
      Ka * ambient + 
      Kd * lambertian * effectiveDiffuse + 
      Ks * effectiveSpecular + emissive, 
      diffuseMapColor.a * v_color.a * opacity 
    );

   // only ambient
  if(mode == 2) gl_FragColor = vec4(Ka * u_ambientLight, 1.0);
  // only diffuse
  if(mode == 3) gl_FragColor = vec4(Kd * lambertian * diffuse, 1.0);
  // only specular
  if(mode == 4) gl_FragColor = vec4(Ks * specularLight * specular, 1.0);

  }
`;

  // compila i programmi shader e li collega
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  // Carichiamo i due modelli
  const model1 = await loadModel(gl, "assets/textureprova/LowOkVersion.obj");
  const model2 = await loadModel(
    gl,
    "assets/lantern/LanternCompleteVersion.obj"
  );

  // Creiamo una lista di modelli da renderizzare
  const models = [model1, model2];

  // function getExtents(positions) {
  //   const min = positions.slice(0, 3);
  //   const max = positions.slice(0, 3);
  //   for (let i = 3; i < positions.length; i += 3) {
  //     for (let j = 0; j < 3; ++j) {
  //       const v = positions[i + j];
  //       min[j] = Math.min(v, min[j]);
  //       max[j] = Math.max(v, max[j]);
  //     }
  //   }
  //   return { min, max };
  // }

  // function getGeometriesExtents(geometries) {
  //   return geometries.reduce(
  //     ({ min, max }, { data }) => {
  //       const minMax = getExtents(data.position);
  //       return {
  //         min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
  //         max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
  //       };
  //     },
  //     {
  //       min: Array(3).fill(Number.POSITIVE_INFINITY),
  //       max: Array(3).fill(Number.NEGATIVE_INFINITY),
  //     }
  //   );
  // }

  // const extents = getGeometriesExtents(obj.geometries);
  // const range = m4.subtractVectors(extents.max, extents.min);
  // // amount to move the object so its center is at the origin
  // const objOffset = m4.scaleVector(
  //   m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
  //   -1
  // );

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

  // Variabile globale per la posizione Y della luce
  let lightPosY = 20.0; // Valore iniziale

  // Trova l'elemento input range per la posizione della luce
  const lightPosRange = document.getElementById("lightPosRange");

  // Aggiungi un event listener per l'input range
  lightPosRange.addEventListener("input", (event) => {
    console.log("shininess", parseFloat(event.target.value));
    lightPosY = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });

  // Funzione per convertire gradi in radianti
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

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
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
      lightPos: [0.0, lightPosY, 20.0],
      ambient: [0.0, 0.0, 0.0],
      Ka: 1.0,
      Kd: 1.0,
      Ks: 1.0,
      shininessAmbient: 100.0,
    };

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.

    webglUtils.setUniforms(meshProgramInfo, {
      u_world: worldMatrix,
      u_worldInverseTranspose: worldInverseTransposeMatrix,
      diffuse: [1, 0.7, 0.5, 1],
    });

    for (model of models) {
      for (const { material, bufferInfo } of model.parts) {
        webglUtils.setUniforms(meshProgramInfo, {
          ...material,
          mode: 1,
          diffuseMap: material.diffuseMap,
          specularMap: material.specularMap,
        });

        webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
        webglUtils.drawBufferInfo(gl, bufferInfo);
      }
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
