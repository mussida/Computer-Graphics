("use strict");

async function main() {
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
  webglUtils.resizeCanvasToDisplaySize(canvas, gl);

  // Imposta WebGL
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  // Variabili per l'interazione con il moodello
  let lightPos = [20, 17.5, 14.5];
  let defaultLightPos = lightPos;
  let distance = 5;
  let theta = 0.87;
  let phi = 0.36;
  let near = 1;
  let far = 100;
  let fovy = 5;
  var dr = (5.0 * Math.PI) / 180.0;

  // Luci per gli animali
  const lightPositions = {
    horseEye: [2.8, 10.4, 20],
    horseFlash: [-20, 2.9, -14.7],
    fox001: [-2.9, 4.6, -20],
    fox002: [2.9, 4.1, -20],
    pony: [-20, 3.8, 3.9],
    fawn: [20, 6.5, 0.4],
    falcon: [20, 3.7, -8.9],
    wildBoar: [14.3, 3, -20],
  };

  // Impostazioni della camera
  var cameraPosition = [0, 0, 20];
  var cameraTarget = [0, 1, 0];

  // Variabili per gestire l'input dell'utente mouse e touch
  let mouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Vertex e Fragment shader
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

  document.addEventListener("DOMContentLoaded", function () {
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        if (this.checked) {
          checkboxes.forEach((cb) => {
            if (cb !== this) cb.checked = false;
          });
          const lightKey = this.dataset.lightKey;
          updateLightPosition(lightKey);
        } else {
          lightPos = defaultLightPos;
        }
      });
    });
  });

  function updateLightPosition(key) {
    if (lightPositions[key]) {
      lightPos = lightPositions[key];
    } else {
      lightPos = defaultLightPos;
    }
  }

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

      if (phi + dy * 0.01 <= Math.PI / 2 - 0.1 && phi + dy * 0.01 > 0) {
        phi += dy * 0.01;
        phiTag.value = phi;
      }
      theta -= dx * 0.01;
      thetaTag.value = theta;

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (mouseDown) {
      const dx = e.touches[0].clientX - lastMouseX;
      const dy = e.touches[0].clientY - lastMouseY;

      if (phi + dy * 0.01 <= Math.PI / 2 - 0.1 && phi + dy * 0.01 > 0) {
        phi += dy * 0.01;
        phiTag.value = phi;
      }

      theta -= dx * 0.01;
      thetaTag.value = theta;

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

  document.addEventListener("keydown", (e) => {
    const rotationSpeed = 0.05;
    switch (e.key) {
      case "ArrowUp":
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
      case "ArrowLeft":
        if (true) {
          theta -= rotationSpeed;
          thetaTag.value = theta;
        }
        break;
      case "ArrowRight":
        theta += rotationSpeed;
        thetaTag.value = theta;
        break;
    }
    e.preventDefault();
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomSpeed = 0.2;
      if (
        distance - e.deltaY * zoomSpeed > 4 &&
        distance - e.deltaY * zoomSpeed < 40
      ) {
        distance -= e.deltaY * zoomSpeed;
        distanceTag.value = distance;
      }
    },
    { passive: false }
  );

  // Gestione degli input range e aggiornamento delle variabili
  const lightPosYTag = document.getElementById("lightPosY");
  lightPosYTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    lightPos[1] = parseFloat(event.target.value);
  });
  const lightPosXTag = document.getElementById("lightPosX");
  lightPosXTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    lightPos[0] = parseFloat(event.target.value);
  });
  const lightPosZTag = document.getElementById("lightPosZ");
  lightPosZTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    lightPos[2] = parseFloat(event.target.value);
  });
  const distanceTag = document.getElementById("distance");
  distanceTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    distance = parseFloat(event.target.value);
  });
  const thetaTag = document.getElementById("theta");
  thetaTag.step = dr;
  thetaTag.value = 0.87;
  thetaTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    theta = parseFloat(event.target.value);
  });
  phiTag = document.getElementById("phi");
  phiTag.step = dr;
  phiTag.value = 0.36;
  phiTag.addEventListener("input", (event) => {
    console.log(event.target.value);
    phi = parseFloat(event.target.value);
  });
  nearTag = document.getElementById("near");
  nearTag.addEventListener("input", (event) => {
    near = parseFloat(event.target.value);
  });
  farTag = document.getElementById("far");
  farTag.addEventListener("input", (event) => {
    far = parseFloat(event.target.value);
  });
  fovyTag = document.getElementById("fovy");
  fovyTag.addEventListener("input", (event) => {
    fovy = parseFloat(event.target.value);
  });

  // Compilazione dei programmi shader
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  // Caricamento due modelli
  const forest = await loadModel(gl, "assets/Me/Me.obj");

  const complexModel = [{ model: forest, programInfo: meshProgramInfo }];

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
      lightPos: lightPos,
      ambient: [0.0, 0.0, 0.0],
      Ka: 1.0,
      Kd: 1.0,
      Ks: 1.0,
      shininessAmbient: 100.0,
      near: near,
    };

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
