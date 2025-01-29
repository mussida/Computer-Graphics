function toggleSidebar() {
  console.log("toggle sidebar");
  const sidebar = document.getElementById("sidebar");
  const arrow = document.getElementById("arrow-icon");
  sidebar.classList.toggle("translate-x-0");
  sidebar.classList.toggle("-translate-x-full");
  arrow.classList.toggle("rotate-180");
}
