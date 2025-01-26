---
sidebar_position: 1
---

# Vertex Shader e Fragment Shader

**WebGl** lavora direttamente con la **GPU**, in particolare ci sono due funzioni che vengono eseguite dalla GPU: il **Vertex Shader** e il **Fragment Shader**. Sono scritte in un linguaggio strettamente tipizzato chiamato [**GLSL**](https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html).

## Vertex Shader

Il **Vertex Shader** calcola le posizioni dei vertici e in questo modo definisce la geometria dgli oggetti e può rasterizzare diversi tipi di primitive, come punti, linee e triangoli. Mentre rasterizza le primitive, chiama la funzione **Fragment Shader** per calcolare il colore dei pixel.

## Fragment Shader

Il **Fragment Shader** calcola il colore dei pixel dopo che il **Vertex Shader** ha calcolato le posizioni dei vertici. Il **Fragment Shader** è chiamato per ogni pixel rasterizzato.

## Input e Output degli Shader

In pratica quando si vuole disegnare qualcosa bisogna eseguire il rendering con `gl.drawArrays` o `gl.drawElements`, che eseguirà gli shader su GPU. Ci sono 4 modi principali tramite i quali si possono passare i dati agli shader:

1. **Buffer e attributi**. I buffer sono array di dati binari che solitamente contengono le posizioni dei vertici, i colori, le normali, le coordinate delle texture, ecc. Gli attributi sono variabili che vengono lette dagli shader e che possono essere associate ai buffer. Gli attributi specificano a WebGL come interpretare i dati nei buffer e passarli ai vertex shader.

2. **Uniforms**.Gli uniforms sono variabili globali impostate prima dell'esecuzione dello shader. Sono valori che rimangono costanti per tutti i vertici durante un singolo disegno (draw call), come un colore ad esempio.

3. **Textures**. Le textures sono array di dati che possono che solitamente contengono immagini.

4. **Varyings**. I varyings sono variabili che vengono passate dal vertex shader al fragment shader.

## Flusso semplificato

Prima di tutto all'interno del nostro codice sarà necessario definire i due shader, con le rispettive stringhe di codice GLSL. Successivamente, si dovrà iniziare con WebGL, in particolare abbiamo bisogno di un `canvas`

```html
<canvas id="canvas"></canvas>
```

Poi in javascript si dovrà inizializzare il contesto WebGL

```javascript
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
```

Ora bisogna caricare gli shader nella GPU, nel nostro caso sono stati definit concatenando stringhe in JavaScript. Successivamente viene utilizzata la funzione `createProgramInfo()` della libreria `webgl-utils` che prende in input il contesto WebGL e gli shader caricati, crea un programma e li compila restituendo un oggetto con tutte le informazioni necessarie per disegnare

```javascript
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);
```

In seguito vengono presi i dati da un file `.OBJ` e caricati in un buffer. La funzione `createBufferInfoFromArrays()` della libreria `webgl-utils` prende in input il contesto WebGL e i dati, crea un buffer e lo compila restituendo un oggetto con tutte le informazioni necessarie per disegnare

```javascript
const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
```

## Rendering
Dopo aver create e definito il canvas dobbiamo mappare le coordinate del clip space alle coordinate in pixel dello schermo utilizzato, e per farlo usiamo una funzione la funzione `gl.viewport()`

```javascript
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
```

i primi due parametri in input sono la posizione orizzontale e verticale in cui inizia il rendering, mentre gli ultimi due parametri sono la larghezza e l'altezza del rendering.

Dopo, nel nostro caso, sono state definite le `sharedUniforms`, che contengono i valori che verranno passati agli shader. In seguito, si attiva il programma con questo comando:

```javascript
gl.useProgram(meshProgramInfo.program);
```

Qui viene attivato il programma di shader che è stato creato in precedenza. Dopodiché li vengono settati gli attributi e gli uniforms con i valori che abbiamo definito in precedenza. E in seguito, nel mio codice viene iterato il `bufferInfo` (contiene le informazioni sui buffer WebGL che descrivono la geometria dell'oggetto come posizione, normale, texture, ecc.) e `material` (sono le informazioni sul materiale dell'oggetto come colore, mappa delle texture, riflettività, ecc). In questo ciclo for vengono effetuate i seguenti comandi:

1. `setBuffersAndAttributes()`: setta gli attributi e i buffer per il rendering.
2. `setUniforms()`: setta gli uniforms per il rendering.
3. `drawBufferInfo()`: disegna il buffer.

```javascript
  webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
  webglUtils.setUniforms(meshProgramInfo, {}, material);
  webglUtils.drawBufferInfo(gl, bufferInfo);
```
 
## Configure the Sidebar

Docusaurus automatically **creates a sidebar** from the `docs` folder.

Add metadata to customize the sidebar label and position:

```md title="docs/hello.md" {1-4}
---
sidebar_label: 'Hi!'
sidebar_position: 3
---

# Hello

This is my **first Docusaurus document**!
```

It is also possible to create your sidebar explicitly in `sidebars.js`:

```js title="sidebars.js"
export default {
  tutorialSidebar: [
    'intro',
    // highlight-next-line
    'hello',
    {
      type: 'category',
      label: 'Tutorial',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
};
```
