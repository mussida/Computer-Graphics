const routes = {
  "/": "pages/home.html",
  "/info": "pages/info.html",
};

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    if (e.target.matches("[data-link]")) {
      e.preventDefault();
      navigateTo(e.target.href);
    }
  });

  window.onpopstate = loadContent;
  loadContent();
});

function navigateTo(url) {
  history.pushState({}, "", url);
  loadContent();
}

async function loadContent() {
  const path = window.location.pathname;
  const template = routes[path] || "404.html";

  try {
    const response = await fetch(template);
    const html = await response.text();
    document.getElementById("content").innerHTML = html;

    // Se siamo sulla home, ricarica il codice WebGL
    if (path === "/") {
      setTimeout(() => {
        startWebGL();
      }, 100); // Attendi un attimo per assicurarti che il canvas esista
    }
  } catch (error) {
    document.getElementById("content").innerHTML =
      "<h1>Errore nel caricamento della pagina</h1>";
  }
}

function startWebGL() {
  if (typeof main === "function") {
    main();
  } else {
    console.error("Il codice WebGL non è stato caricato correttamente.");
  }
}
