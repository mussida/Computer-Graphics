// Funzione per ridimensionare correttamente il canvas
// function resizeCanvasToDisplaySize(canvas, gl) {
//   console.log("resizeCanvasToDisplaySize");
//   const width = canvas.clientWidth;
//   const height = canvas.clientHeight;

//   if (canvas.width !== width || canvas.height !== height) {
//     canvas.width = width;
//     canvas.height = height;
//     gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
//   }
// }

  // Funzione per convertire gradi in radianti
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }