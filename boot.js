/* Registers the offline service worker. Kept in its own file so the strict
   Content-Security-Policy can stay free of inline scripts. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          console.info("离线缓存有新版本，下次打开会自动更新。");
        });
      })
      .catch((error) => {
        // Offline support is a bonus: never let it break the game.
        console.info("离线缓存未启用：", error && error.message);
      });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("未处理的异步错误", event.reason);
  });

  // Install-to-desktop affordance. Chromium fires beforeinstallprompt when the
  // PWA criteria are met; other browsers simply never show the button.
  let installPrompt = null;
  const installButton = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
  });

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    installPrompt = null;
    installButton.hidden = true;
  });
})();
