function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function getDistance(touch1, touch2) {
  let dx = touch1.clientX - touch2.clientX;
  let dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
