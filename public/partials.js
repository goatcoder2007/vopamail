(function () {
  var partials = [
    "partials/sprite.html",
    "partials/demo-banner.html",
    "partials/auth-screen.html",
    "partials/sidebar.html",
    "partials/mail-main.html",
    "partials/compose.html",
    "partials/alert.html"
  ];

  var root = document.getElementById("appRoot");
  var ordered = [];

  Promise.all(partials.map(function (path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error("Could not load " + path);
      return response.text();
    });
  })).then(function (parts) {
    parts.forEach(function (html, index) {
      ordered[index] = html.trim();
    });

    root.innerHTML =
      ordered[0] + "\n" +
      ordered[1] + "\n" +
      ordered[2] + "\n" +
      '<div id="appShell" class="app-shell" hidden>\n' + ordered[3] + "\n" + ordered[4] + "\n</div>\n" +
      ordered[5] + "\n" +
      ordered[6];

    root.classList.remove("boot-screen");

    var script = document.createElement("script");
    script.src = "app.js";
    document.body.appendChild(script);
  }).catch(function (error) {
    root.innerHTML =
      '<div class="boot-error">' +
        "<strong>Vopa Mail could not start.</strong>" +
        "<span>" + error.message + "</span>" +
        "<button type=\"button\" onclick=\"location.reload()\">Try again</button>" +
      "</div>";
  });
})();
