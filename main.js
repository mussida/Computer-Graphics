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

  var dr = (5.0 * Math.PI) / 180.0;

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

  const fsLantern = `
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

      vec2 st = gl_FragCoord.xy / vec2(1000.0, 1000.0);

      vec2 center = vec2(0.5, 0.5);

      // Euclidean distance from center
      float dist = distance(st, center);

      // Create a soft circular glow, gradual falloff from center 0.0 to 0.5
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);

      vec3 color = vec3(1,1,1) * glow;

      // Add a brighter core, gradual falloff from center 0.1 to 0.0
      color += vec3(1.0, 0.8, 0.8) * smoothstep(0.1, 0.0, dist);

      // gl_FragColor = vec4(color, 1.0);

      // Calcola il colore finale
      gl_FragColor = vec4(
        Ka * ambient + 
        Kd * lambertian * effectiveDiffuse + 
        Ks * effectiveSpecular + emissive, 
        diffuseMapColor.a * v_color.a * opacity 
      );
  }
  `;

  // compila i programmi shader e li collega
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);
  const meshProgramInfoLantern = webglUtils.createProgramInfo(gl, [
    vs,
    fsLantern,
  ]);

  // Carichiamo i due modelli
  const model1 = await loadModel(gl, "assets/Aculei_Forest/Aculei_Forest.obj");
  const model2 = await loadModel(gl, "assets/Lantern/Lantern.obj");

  // Creiamo una lista di modelli da renderizzare
  // const models = [model1, model2];

  const complexModel = [
    { model: model1, programInfo: meshProgramInfo },
    { model: model2, programInfo: meshProgramInfoLantern },
  ];

  // Impostazioni della camera
  var cameraPosition = [0, 0, 20];
  var cameraTarget = [0, 1, 0];

  // Variabili per gestire l'input dell'utente
  let mouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mouseDown = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    console.log("touchstart");
    console.log(e.touches[0].clientX);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (mouseDown) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;

      // Aggiorna gli angoli di rotazione del modello
      if (phi + dy * 0.01 <= Math.PI / 2 - 0.1 && phi + dy * 0.01 > 0) {
        phi += dy * 0.01;
        phiTag.value = phi;
      }
      if (
        // theta - dx * 0.01 <= Math.PI / 2 &&
        // theta - dx * 0.01 > 0
        true
      ) {
        theta -= dx * 0.01;
        thetaTag.value = theta;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (mouseDown) {
      const dx = e.touches[0].clientX - lastMouseX;
      const dy = e.touches[0].clientY - lastMouseY;

      // Aggiorna gli angoli di rotazione del modello
      if (phi + dy * 0.01 <= Math.PI / 2 - 0.1 && phi + dy * 0.01 > 0) {
        // if (true) {
        phi += dy * 0.01;
        phiTag.value = phi;
        console.log("phi:", phi);
      }
      if (
        // theta - dx * 0.01 <= Math.PI / 2 &&
        // theta - dx * 0.01 > 0
        true
      ) {
        theta -= dx * 0.01;
        console.log("theta:", theta);
        thetaTag.value = theta;
      }
      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
    }
  });

  canvas.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  canvas.addEventListener("touchend", () => {
    mouseDown = false;
  });

  // Event listener per la tastiera
  document.addEventListener("keydown", (e) => {
    const rotationSpeed = 0.05; // Velocità di rotazione per ogni tasto premuto
    switch (e.key) {
      case "ArrowUp": // Rotazione verso l'alto
        // aumenta phi
        if (phi + rotationSpeed <= Math.PI / 2 - 0.1) {
          phi += rotationSpeed;
          phiTag.value = phi;
        }
        break;
      case "ArrowDown":
        if (phi - rotationSpeed > 0) {
          phi -= rotationSpeed;
          phiTag.value = phi;
        }
        break;
      case "ArrowLeft": // Rotazione verso sinistra
        // rotation[1] -= rotationSpeed;
        if (true) {
          // if (theta - rotationSpeed > 0) {
          theta -= rotationSpeed;
          thetaTag.value = theta;
        }
        break;
      case "ArrowRight":
        // if (theta + rotationSpeed <= Math.PI / 2) {
        if (true) {
          theta += rotationSpeed;
          thetaTag.value = theta;
        }
        break;
    }
    e.preventDefault();
  });

  document.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomSpeed = 0.2;
      if (
        distance - e.deltaY * zoomSpeed > 7 &&
        distance - e.deltaY * zoomSpeed < 40
      ) {
        distance -= e.deltaY * zoomSpeed;
        distanceTag.value = distance;
      }
    },
    { passive: false }
  );

  // canvas.ontouchstart = (e) => {
  //   e.preventDefault();
  // };

  // Variabile globale per la posizione Y della luce
  let lightPosY = 3.5; // Valore iniziale
  let lightPosX = 5.5; // Valore iniziale
  let lightPosZ = -14.6; // Valore iniziale
  let distance = 24; // Distanza iniziale della camera
  let theta = 3.14;
  let phi = 0.274532925199433;
  let near = 1;
  let far = 100;
  let fovy = 5;

  // Trova l'elemento input range per la posizione della luce
  const lightPosYTag = document.getElementById("lightPosY");
  lightPosYTag.addEventListener("input", (event) => {
    lightPosY = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  const lightPosXTag = document.getElementById("lightPosX");
  lightPosXTag.addEventListener("input", (event) => {
    lightPosX = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  const lightPosZTag = document.getElementById("lightPosZ");
  lightPosZTag.addEventListener("input", (event) => {
    lightPosZ = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  const distanceTag = document.getElementById("distance");
  distanceTag.addEventListener("input", (event) => {
    distance = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  const thetaTag = document.getElementById("theta");
  thetaTag.step = dr;
  thetaTag.value = 3.14;
  thetaTag.addEventListener("input", (event) => {
    theta = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  phiTag = document.getElementById("phi");
  phiTag.step = dr;
  phiTag.value = 0.274532925199433;
  phiTag.addEventListener("input", (event) => {
    phi = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  nearTag = document.getElementById("near");
  nearTag.addEventListener("input", (event) => {
    near = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  farTag = document.getElementById("far");
  farTag.addEventListener("input", (event) => {
    far = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });
  fovyTag = document.getElementById("fovy");
  fovyTag.addEventListener("input", (event) => {
    fovy = parseFloat(event.target.value); // Aggiorna la posizione Y della luce
  });

  // Funzione per convertire gradi in radianti
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  // Imposta un limite per lo zoom
  const minZoom = 5; // Distanza minima della camera
  const maxZoom = 50; // Distanza massima della camera

  // canvas.addEventListener("wheel", (e) => {
  //   e.preventDefault(); // Evita lo scroll della pagina

  //   const zoomSpeed = 1; // Sensibilità dello zoom
  //   cameraPosition[2] += e.deltaY * 0.05 * zoomSpeed; // Modifica la posizione Z della camera

  //   // Limita lo zoom per evitare di passare attraverso l'oggetto o allontanarsi troppo
  //   cameraPosition[2] = Math.max(minZoom, Math.min(maxZoom, cameraPosition[2]));
  // });

  // Funzione per convertire gradi in radianti
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }
  // console.log(complexModel[0]);

  // Render function
  function render() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfViewRadians = degToRad(100);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, near, far);

    cameraPosition = [
      distance * Math.cos(phi) * Math.sin(theta),
      distance * Math.sin(phi),
      distance * Math.cos(phi) * Math.cos(theta),
    ];

    const up = [0, 1, 0];
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);
    view = m4.inverse(camera);

    var worldMatrix = m4.identity();
    const worldInverseMatrix = m4.inverse(worldMatrix);
    const worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

    const sharedUniforms = {
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
      lightPos: [lightPosX, lightPosY, lightPosZ],
      ambient: [0.0, 0.0, 0.0],
      Ka: 1.0,
      Kd: 1.0,
      Ks: 1.0,
      shininessAmbient: 100.0,
      near: near,
    };

    // gl.useProgram(meshProgramInfo.program);
    // gl.useProgram(meshProgramInfoLantern.program);

    // calls gl.uniform
    // webglUtils.setUniforms(meshProgramInfo, sharedUniforms);
    // webglUtils.setUniforms(meshProgramInfoLantern, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.

    // webglUtils.setUniforms(meshProgramInfo, {
    //   u_world: worldMatrix,
    //   u_worldInverseTranspose: worldInverseTransposeMatrix,
    //   diffuse: [1, 0.7, 0.5, 1],
    // });

    // for (model of models) {
    //   for (const { material, bufferInfo } of model.parts) {
    //     webglUtils.setUniforms(meshProgramInfo, {
    //       ...material,
    //       mode: 1,
    //       diffuseMap: material.diffuseMap,
    //       specularMap: material.specularMap,
    //     });

    //     webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);

    //     webglUtils.drawBufferInfo(gl, bufferInfo);
    //   }
    // }
    for (model of complexModel) {
      gl.useProgram(model.programInfo.program);
      webglUtils.setUniforms(model.programInfo, sharedUniforms);
      webglUtils.setUniforms(model.programInfo, {
        u_world: worldMatrix,
        u_worldInverseTranspose: worldInverseTransposeMatrix,
        diffuse: [1, 0.7, 0.5, 1],
      });
      for (const { material, bufferInfo } of model.model.parts) {
        webglUtils.setUniforms(model.programInfo, {
          ...material,
          mode: 1,
          diffuseMap: material.diffuseMap,
          specularMap: material.specularMap,
        });

        webglUtils.setBuffersAndAttributes(gl, model.programInfo, bufferInfo);

        webglUtils.drawBufferInfo(gl, bufferInfo);
      }
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
