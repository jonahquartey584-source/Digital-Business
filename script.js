(function () {
  const artistNameEl = document.getElementById("artistName");
  const artistGenreEl = document.getElementById("artistGenre");
  const artistLinkEl = document.getElementById("artistLink");
  const badgeEl = document.getElementById("badge");
  const generateBtn = document.getElementById("generateBtn");
  const noRepeatToggle = document.getElementById("noRepeatToggle");
  const progressEl = document.getElementById("progress");
  const viewAllBtn = document.getElementById("viewAllBtn");
  const closeListBtn = document.getElementById("closeListBtn");
  const listDialog = document.getElementById("listDialog");
  const artistListEl = document.getElementById("artistList");
  const cardEl = document.getElementById("card");

  let remainingIndexes = [];
  let lastIndex = null;

  function resetPool() {
    remainingIndexes = ARTISTS.map((_, i) => i);
  }

  function updateProgress() {
    if (!noRepeatToggle.checked) {
      progressEl.textContent = "";
      return;
    }
    const shown = ARTISTS.length - remainingIndexes.length;
    progressEl.textContent = `${shown} / ${ARTISTS.length} artists shown this round`;
  }

  function pickIndex() {
    if (noRepeatToggle.checked) {
      if (remainingIndexes.length === 0) resetPool();
      const pick = Math.floor(Math.random() * remainingIndexes.length);
      const [index] = remainingIndexes.splice(pick, 1);
      return index;
    }
    let index;
    do {
      index = Math.floor(Math.random() * ARTISTS.length);
    } while (ARTISTS.length > 1 && index === lastIndex);
    return index;
  }

  function generate() {
    const index = pickIndex();
    lastIndex = index;
    const artist = ARTISTS[index];

    cardEl.classList.remove("card--pop");
    void cardEl.offsetWidth; // restart animation
    cardEl.classList.add("card--pop");

    badgeEl.textContent = `#${index + 1} of ${ARTISTS.length}`;
    artistNameEl.textContent = artist.name;
    artistGenreEl.textContent = artist.genre;
    artistLinkEl.href = `https://www.google.com/search?q=${encodeURIComponent(artist.name + " musician")}`;

    updateProgress();
  }

  function renderList() {
    artistListEl.innerHTML = "";
    ARTISTS.forEach((artist) => {
      const li = document.createElement("li");
      li.textContent = `${artist.name} — ${artist.genre}`;
      artistListEl.appendChild(li);
    });
  }

  generateBtn.addEventListener("click", generate);

  noRepeatToggle.addEventListener("change", () => {
    resetPool();
    updateProgress();
  });

  viewAllBtn.addEventListener("click", () => {
    renderList();
    if (typeof listDialog.showModal === "function") {
      listDialog.showModal();
    } else {
      listDialog.setAttribute("open", "");
    }
  });

  closeListBtn.addEventListener("click", () => listDialog.close());
  listDialog.addEventListener("click", (e) => {
    if (e.target === listDialog) listDialog.close();
  });

  resetPool();
  updateProgress();
})();
