export interface SaveAnswerBannerOptions {
  question: string;
  answer: string;
  onSave: () => void;
  onDismiss: () => void;
}

/** A small, non-blocking banner near the field, in a shadow root so host CSS cannot style it. */
export function showSaveAnswerBanner(anchor: HTMLElement, options: SaveAnswerBannerOptions): () => void {
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.zIndex = "2147483647";
  const rect = anchor.getBoundingClientRect();
  host.style.top = `${window.scrollY + rect.bottom + 4}px`;
  host.style.left = `${window.scrollX + rect.left}px`;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .card { font: 13px -apple-system, sans-serif; background: #fffdf8; border: 1px solid #e3d9c6; border-radius: 8px;
        padding: 8px 10px; box-shadow: 0 2px 8px rgba(0,0,0,.12); display: flex; align-items: center; gap: 8px; }
      button { font: inherit; border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
      .save { background: #1f6b4a; color: white; }
      .dismiss { background: transparent; color: #6b645b; }
    </style>
    <div class="card">
      <span>Save this answer for future applications?</span>
      <button class="save">Save</button>
      <button class="dismiss">Not now</button>
    </div>
  `;

  function remove() {
    host.remove();
  }

  shadow.querySelector(".save")?.addEventListener("click", () => {
    options.onSave();
    remove();
  });
  shadow.querySelector(".dismiss")?.addEventListener("click", () => {
    options.onDismiss();
    remove();
  });

  const timer = setTimeout(remove, 15_000);
  return () => {
    clearTimeout(timer);
    remove();
  };
}
