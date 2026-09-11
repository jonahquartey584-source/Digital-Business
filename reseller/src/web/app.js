/* Reseller Autopost — front end. No framework, no build step. */

const els = {
  apiKey: document.getElementById('apiKey'),
  form: document.getElementById('postForm'),
  dropzone: document.getElementById('dropzone'),
  photos: document.getElementById('photos'),
  thumbs: document.getElementById('thumbs'),
  channels: document.getElementById('channels'),
  submit: document.getElementById('submit'),
  formStatus: document.getElementById('formStatus'),
  products: document.getElementById('products'),
  refresh: document.getElementById('refresh'),
};

/* The key lives in localStorage so you don't retype it every reload. It only
   ever goes to this app's own origin. */
const KEY_STORAGE = 'reseller.apiKey';
try {
  els.apiKey.value = localStorage.getItem(KEY_STORAGE) ?? '';
} catch { /* private browsing */ }
els.apiKey.addEventListener('change', () => {
  try { localStorage.setItem(KEY_STORAGE, els.apiKey.value.trim()); } catch { /* ignore */ }
  // Reload both panels: a key that was missing at page load left them empty.
  void loadChannels();
  void loadProducts();
});

function authHeaders() {
  const key = els.apiKey.value.trim();
  return key ? { 'X-API-Key': key } : {};
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(message, kind = '') {
  els.formStatus.textContent = message;
  els.formStatus.className = `status ${kind}`;
}

/* ------------------------------------------------------------------ photos */

/** Selected files, kept in our own list so drops add to the picker's set. */
let selected = [];

function renderThumbs() {
  els.thumbs.innerHTML = '';
  selected.forEach((file, index) => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    // Release the blob once the browser has decoded it.
    img.onload = () => URL.revokeObjectURL(img.src);
    const caption = document.createElement('figcaption');
    caption.textContent = index === 0 ? 'STORY' : String(index + 1);
    figure.append(img, caption);
    els.thumbs.append(figure);
  });
}

function addFiles(fileList) {
  const images = [...fileList].filter((f) => f.type.startsWith('image/'));
  selected = [...selected, ...images].slice(0, 12);
  renderThumbs();
}

els.dropzone.addEventListener('click', () => els.photos.click());
els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.photos.click();
  }
});
els.photos.addEventListener('change', () => addFiles(els.photos.files));

for (const type of ['dragenter', 'dragover']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('over');
  });
}
for (const type of ['dragleave', 'drop']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('over');
  });
}
els.dropzone.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
});

/* ---------------------------------------------------------------- channels */

const GROUP_LABELS = {
  marketplace: 'Marketplaces',
  social: 'Social',
};

const MODE_HELP = {
  api: 'Official API',
  browser: 'Browser automation',
  assist: 'One-tap handoff',
};

function channelCheckbox(channel) {
  const label = document.createElement('label');
  label.className = `channel${channel.ready ? '' : ' disabled'}`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'channels';
  input.value = channel.id;
  input.disabled = !channel.ready;
  // Default to everything that's actually ready to go.
  input.checked = channel.ready;

  const body = document.createElement('div');
  body.className = 'channel-body';

  const name = document.createElement('div');
  name.className = 'channel-name';
  name.append(document.createTextNode(channel.label));
  const tag = document.createElement('span');
  tag.className = `tag ${channel.mode}`;
  tag.textContent = MODE_HELP[channel.mode] ?? channel.mode;
  tag.title = channel.mode;
  name.append(tag);

  const note = document.createElement('div');
  note.className = 'channel-note';
  note.textContent = channel.ready
    ? (channel.note ?? '')
    : `Needs: ${channel.missing.join(', ')}`;

  body.append(name, note);
  label.append(input, body);
  return label;
}

async function loadChannels() {
  try {
    const { channels } = await api('/channels');
    els.channels.innerHTML = '';

    for (const kind of ['marketplace', 'social']) {
      const group = channels.filter((c) => c.kind === kind);
      if (group.length === 0) continue;

      const section = document.createElement('div');
      section.className = 'channel-group';
      const heading = document.createElement('h4');
      const readyCount = group.filter((c) => c.ready).length;
      heading.textContent = `${GROUP_LABELS[kind]} · ${readyCount}/${group.length} ready`;
      const list = document.createElement('div');
      list.className = 'channel-list';
      for (const channel of group) list.append(channelCheckbox(channel));
      section.append(heading, list);
      els.channels.append(section);
    }
  } catch (err) {
    els.channels.textContent = `Could not load channels: ${err.message}`;
  }
}

/* ---------------------------------------------------------------- products */

function postChip(post) {
  const chip = document.createElement('span');
  chip.className = `post ${post.status}`;

  const pip = document.createElement('span');
  pip.className = 'pip';
  chip.append(pip);

  const name = post.externalUrl ? document.createElement('a') : document.createElement('span');
  if (post.externalUrl) {
    name.href = post.externalUrl;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
  }
  name.textContent = `${post.channelId} · ${post.status.replace('_', ' ')}`;
  chip.append(name);

  if (post.status === 'failed' || post.status === 'skipped') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'link';
    retry.textContent = 'retry';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      try {
        await api(`/posts/${post.id}/retry`, { method: 'POST' });
        await loadProducts();
      } catch (err) {
        alert(err.message);
        retry.disabled = false;
      }
    });
    chip.append(retry);
  }

  if (post.message) chip.title = post.message;
  return chip;
}

function productCard(product) {
  const card = document.createElement('div');
  card.className = 'product';

  if (product.thumbnail) {
    const img = document.createElement('img');
    img.src = `/media/${product.thumbnail}`;
    img.alt = product.title;
    img.loading = 'lazy';
    card.append(img);
  }

  const body = document.createElement('div');
  body.className = 'product-body';

  const title = document.createElement('p');
  title.className = 'product-title';
  title.textContent = product.title;

  const meta = document.createElement('p');
  meta.className = 'product-meta';
  meta.textContent = [product.priceLabel, product.brand, product.size]
    .filter(Boolean)
    .join(' · ') || '—';

  const posts = document.createElement('div');
  posts.className = 'posts';
  for (const post of product.posts) posts.append(postChip(post));

  body.append(title, meta, posts);

  // Surface whatever needs a human (Snapchat handoff, dry-run screenshots).
  const attention = product.posts.filter((p) => p.status === 'needs_action' && p.externalUrl);
  for (const post of attention) {
    const line = document.createElement('p');
    line.className = 'post-message';
    const link = document.createElement('a');
    link.href = post.externalUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Finish ${post.channelId} →`;
    line.append(link);
    body.append(line);
  }

  card.append(body);
  return card;
}

async function loadProducts() {
  try {
    const { products } = await api('/products');
    els.products.innerHTML = '';
    if (products.length === 0) {
      els.products.innerHTML = '<p class="empty">Nothing posted yet.</p>';
      return;
    }
    for (const product of products) els.products.append(productCard(product));
  } catch (err) {
    els.products.textContent = `Could not load items: ${err.message}`;
  }
}

els.refresh.addEventListener('click', () => void loadProducts());

/* ------------------------------------------------------------------ submit */

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (selected.length === 0) {
    setStatus('Add at least one photo.', 'error');
    return;
  }
  const chosen = [...els.form.querySelectorAll('input[name="channels"]:checked')].map((i) => i.value);
  if (chosen.length === 0) {
    setStatus('Pick at least one channel.', 'error');
    return;
  }

  const body = new FormData(els.form);
  // Replace the file input's own entries with our accumulated list (drag-and-
  // drop and repeated picks both add to `selected`).
  body.delete('photos');
  selected.forEach((file) => body.append('photos', file, file.name));

  els.submit.disabled = true;
  setStatus(`Queueing ${chosen.length} channel${chosen.length === 1 ? '' : 's'}…`);

  try {
    const result = await api('/products', { method: 'POST', body });
    setStatus(`Queued for ${result.queued.join(', ')}`, 'ok');
    els.form.reset();
    selected = [];
    renderThumbs();
    await loadChannels();
    await loadProducts();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    els.submit.disabled = false;
  }
});

/* Poll while anything is still in flight so statuses settle on their own. */
setInterval(() => {
  if (document.hidden) return;
  void loadProducts();
}, 6000);

void loadChannels();
void loadProducts();
