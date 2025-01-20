"use strict";

function parseOBJ(text) {
  // Array per memorizzare i dati grezzi degli .OBJ.
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  const objVertexData = [objPositions, objTexcoords, objNormals];

  // Array per accumulare i dati dei vertici in formato WebGL.
  let webglVertexData = [
    [], // posizioni
    [], // coordinate texture
    [], // normali
  ];

  // Elabora un indice di vertice nel formato .OBJ e aggiunge i dati corrispondenti a webglVertexData.
  function addVertex(vert) {
    const ptn = vert.split("/");
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/; // regex per separare la keyword dagli argomenti
  const lines = text.split("\n"); // separazione testo in righe
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // gestisce le keyword non riconosciute
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return {
    position: webglVertexData[0],
    texcoord: webglVertexData[1],
    normal: webglVertexData[2],
  };
}

async function loadMTL(url) {
  const response = await fetch(url);
  const text = await response.text();
  return parseMTL(text);
}

async function main() {
  // Prende il canvas e il contesto WebGL
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform mat4 u_worldInverseTranspose;

  varying vec3 v_normal;

  void main() {
    gl_Position = u_projection * u_view * u_world * a_position;
    v_normal = mat3(u_worldInverseTranspose) * a_normal;
  }
  `;

  const fs = `
  precision mediump float;

  varying vec3 v_normal;

  uniform vec4 u_diffuse;
  uniform vec3 u_lightDirection;

  void main () {
    vec3 normal = normalize(v_normal);
    float light = max(dot(u_lightDirection, normal), 0.0);
    gl_FragColor = vec4(u_diffuse.rgb * light, u_diffuse.a);
  }
  `;

  // compila i programmi shader e li collega
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  const response = await fetch("assets/Low poly House.obj");
  const text = await response.text();
  const data = parseOBJ(text);

  // Crea un buffer info dai dati OBJ
  const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);

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
    gl.enable(gl.CULL_FACE);

    const fieldOfViewRadians = degToRad(100);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Calcola la matrice di vista
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);
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
      u_lightDirection: m4.normalize([0, 1, 1]), // Luce dall'alto
      u_view: view,
      u_projection: projection,
    };

    gl.useProgram(meshProgramInfo.program);
    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);
    webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);

    webglUtils.setUniforms(meshProgramInfo, {
      u_world: worldMatrix,
      u_worldInverseTranspose: worldInverseTransposeMatrix,
      u_diffuse: [1, 0.7, 0.5, 1],
    });

    webglUtils.drawBufferInfo(gl, bufferInfo);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
