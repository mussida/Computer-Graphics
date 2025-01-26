---
sidebar_position: 2
---

# Caricamento di un file .OBJ

I file [`.OBJ`](https://paulbourke.net/dataformats/obj/) descrivono un oggetto 3D. Ogni riga contiene diverse informazioni come le seguenti:

- `v`: definisce i vertici (posizioni nello spazio 3D).
- `vt`: definisce le coordinate di texture (mapping 2D su una superficie 3D).
- `vn`: definisce i vettori normali (direzioni per l'illuminazione).
- `f`: definisce le facce.

All'interno del mio progetto, seguendo la guida fornita [webgl fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-load-obj.html), è stata implementata la funzione `parseOBJ` che legge e interpreta il contenuto del file `.OBJ`.  

Il file viene caricato come file di testo, poi suddiviso in righe, e ogni riga viene analizzata in base al comando (`v`, `vt`, `vn`, ecc.) e alle corrispondenti coordinate.  

Di seguito è mostrato uno snippet di codice commentato per facilitarne la comprensione:

```javascript
function parseOBJ(text) {
  ...
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
}
```


I file `.OBJ` descrivono un oggetto 3D. Ogni riga contiene diverse informazioni come le seguenti:

- `v`: definisce i vertici (posizioni nello spazio 3D).
- `vt`: definisce le coordinate di texture (mapping 2D su una superficie 3D).
- `vn`: definisce i vettori normali (direzioni per l'illuminazione).
- `f`: definisce le facce.

All'interno del mio progetto, seguendo la guida fornita [webgl fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-load-obj.html), è stata implementata la funzione `parseOBJ` che legge e interpreta il contenuto del file `.OBJ`. Il file viene caricato come testo, poi suddiviso in righe e ogni riga viene analizzata con il comando (es. `v`, `vt`, `vn`, ecc.) e le corrispettive coordinate.

Di seguito viene mostrato uno snippet di codice commentato per facilitarne la comprensione:

```javascript
function parseOBJ(text) {
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
}
```

Se vogliamo immaginarlo meglio, pensiamo a questo frammento di righe che potrebbe essere preso da un file `.OBJ`:

```
v 0.0 0.0 0.0
vn 1.0 1.0 1.0
f 1//1 2//1 3//1
```

La seguente tabella mostra come viene interpretata ogni riga in termini di **Keyword** e **Argomenti** grazie alla `regex`:

| Riga                   | Keyword (`w*`) | Argomenti (`.*`)     |
|------------------------|---------------|----------------------|
| `v 0.0 0.0 0.0`       | v             | `0.0 0.0 0.0`        |
| `vn 1.0 1.0 1.0`      | vn            | `1.0 1.0 1.0`        |
| `f 1//1 2//1 3//1`    | f             | `1//1 2//1 3//1`     |

Questi dati vengono raccolti e salvati in 3 array diversi, dopodiché vengono ancora raggruppati in un unico array `objVertexData`, come si può vedere dal codice:

```javascript
function parseOBJ(text) {
  // Array per memorizzare i dati grezzi degli .OBJ.
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  const objVertexData = [objPositions, objTexcoords, objNormals];
}
```

Infine, una funzione `addVertex()` converte questi dati in un altro array `webglVertexData`.

```javascript
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
```

In questo modo viene gestito il parsing e la conversione dei dati dal formato `.OBJ` al formato utilizzato da [WebGL](https://webglfundamentals.org/webgl/lessons/webgl-load-obj.html).

