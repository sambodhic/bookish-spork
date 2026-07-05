const app = document.querySelector('#app');
const modal = document.querySelector('#detailModal');
const modalContent = document.querySelector('#modalContent');
const cartCount = document.querySelector('#cartCount');
const toastEl = document.querySelector('#toast');

const supportEmail = 'booktalkietees@gmail.com';
const productTypes = ['T-shirt', 'iPhone Case', 'Tote Bag', 'Tumbler', 'Throw Pillow', 'Ceramic Mug', 'Water Bottle'];
const amazonMarketplaces = {
  US: 'amazon.com',
  UK: 'amazon.co.uk',
  JP: 'amazon.co.jp',
  IT: 'amazon.it',
  FR: 'amazon.fr',
  DE: 'amazon.de',
  ES: 'amazon.es',
};
let marketplaceSymbols = { US: '$', UK: '£', JP: '¥', IT: '€', FR: '€', DE: '€', ES: '€' };
let suggestedPrices = {
  'T-shirt': { US: 24.99, UK: 22.99, JP: 3200, IT: 24.99, FR: 24.99, DE: 24.99, ES: 24.99 },
  'iPhone Case': { US: 19.99, UK: 18.99, JP: 2800, IT: 21.99, FR: 21.99, DE: 21.99, ES: 21.99 },
  'Tote Bag': { US: 21.99, UK: 19.99, JP: 3000, IT: 22.99, FR: 22.99, DE: 22.99, ES: 22.99 },
  Tumbler: { US: 27.99, UK: 25.99, JP: 3900, IT: 29.99, FR: 29.99, DE: 29.99, ES: 29.99 },
  'Throw Pillow': { US: 26.99, UK: 24.99, JP: 3800, IT: 28.99, FR: 28.99, DE: 28.99, ES: 28.99 },
  'Ceramic Mug': { US: 16.99, UK: 14.99, JP: 2200, IT: 17.99, FR: 17.99, DE: 17.99, ES: 17.99 },
  'Water Bottle': { US: 25.99, UK: 23.99, JP: 3600, IT: 27.99, FR: 27.99, DE: 27.99, ES: 27.99 },
};
const state = {
  view: 'home',
  genre: 'Sci-Fi',
  query: '',
  books: [],
  designs: [],
  favorites: readStore('booktalkietees:favorites', []),
  cart: readStore('booktalkietees:cart', []),
  marketplace: readStore('booktalkietees:marketplace', defaultMarketplaceForTimezone()),
};

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultMarketplaceForTimezone() {
  const offsetHours = -new Date().getTimezoneOffset() / 60;
  if (offsetHours >= 8 && offsetHours <= 10) return 'JP';
  if (offsetHours <= -4 && offsetHours >= -10) return 'US';
  if (offsetHours === 0) return 'UK';
  if (offsetHours === 1 || offsetHours === 2) return 'DE';
  return 'US';
}

function marketplaceLabel(marketplace) {
  return `${marketplace} / ${amazonMarketplaces[marketplace] ?? marketplace}`;
}

function suggestedPriceFor(product, marketplace = state.marketplace) {
  return suggestedPrices[product]?.[marketplace] ?? suggestedPrices[product]?.US ?? 0;
}

function formatPrice(value, marketplace = state.marketplace) {
  const symbol = marketplaceSymbols[marketplace] ?? '';
  if (marketplace === 'JP') return `${symbol}${Math.round(value)}`;
  return `${symbol}${Number(value).toFixed(2)}`;
}

function cartTotals() {
  return state.cart.reduce((totals, item) => {
    const marketplace = item.marketplace ?? state.marketplace;
    totals[marketplace] = (totals[marketplace] ?? 0) + suggestedPriceFor(item.product, marketplace);
    return totals;
  }, {});
}

function formatCartTotals() {
  const totals = cartTotals();
  return Object.entries(totals).map(([marketplace, value]) => `${formatPrice(value, marketplace)} ${marketplace}`).join(' + ');
}

async function loadPricing() {
  try {
    const response = await fetch('pricing.json', { cache: 'no-store' });
    if (!response.ok) return;
    const pricing = await response.json();
    if (pricing.currencySymbols && typeof pricing.currencySymbols === 'object') {
      marketplaceSymbols = { ...marketplaceSymbols, ...pricing.currencySymbols };
    }
    if (pricing.suggestedPrices && typeof pricing.suggestedPrices === 'object') {
      suggestedPrices = normalizeSuggestedPrices(pricing.suggestedPrices);
    }
  } catch {
    // Keep fallback prices if pricing.json is unavailable.
  }
}

function normalizeSuggestedPrices(rawPrices) {
  return Object.fromEntries(
    Object.entries(rawPrices).map(([product, markets]) => [
      product,
      Object.fromEntries(
        Object.entries(markets ?? {}).map(([marketplace, value]) => [marketplace, Number(value)]),
      ),
    ]),
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function resolveAsset(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return path.replace(/^\.\//, '');
}

async function boot() {
  try {
    const [books, catalog] = await Promise.all([
      fetch('books.json').then((response) => response.json()),
      fetch('catalog.json').then((response) => response.json()),
      loadPricing(),
    ]);
    state.books = books;
    state.designs = catalog.designs ?? [];
  } catch (error) {
    app.innerHTML = `<section class="panel empty-state"><h1>BookTalkieTees</h1><p>${escapeHtml(error.message)}</p></section>`;
    return;
  }

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  setupMarketplaceSelector();
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeMarketplaceMenu();
    }
  });
  updateCartCount();
  render();
}

function setupMarketplaceSelector() {
  const button = document.querySelector('#marketplaceButton');
  const menu = document.querySelector('#marketplaceMenu');
  if (!button || !menu) return;

  state.marketplace = amazonMarketplaces[state.marketplace] ? state.marketplace : defaultMarketplaceForTimezone();
  menu.innerHTML = Object.entries(amazonMarketplaces)
    .map(([key, domain]) => `<button class="market-option" type="button" role="menuitemradio" data-marketplace-option="${key}">${key}<span>${domain}</span></button>`)
    .join('');

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMarketplaceMenu();
  });
  menu.querySelectorAll('[data-marketplace-option]').forEach((option) => {
    option.addEventListener('click', () => {
      setPreferredMarketplace(option.dataset.marketplaceOption);
      closeMarketplaceMenu();
      render();
    });
  });
  document.addEventListener('click', closeMarketplaceMenu);
  syncMarketplaceSelector();
  writeStore('booktalkietees:marketplace', state.marketplace);
}

function toggleMarketplaceMenu() {
  const menu = document.querySelector('#marketplaceMenu');
  const button = document.querySelector('#marketplaceButton');
  if (!menu || !button) return;
  const open = menu.hidden;
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

function closeMarketplaceMenu() {
  const menu = document.querySelector('#marketplaceMenu');
  const button = document.querySelector('#marketplaceButton');
  if (!menu || !button) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

function syncMarketplaceSelector() {
  const code = document.querySelector('#marketplaceCode');
  if (code) code.textContent = state.marketplace;
  document.querySelector('#marketplaceButton')?.setAttribute('aria-label', `Marketplace ${marketplaceLabel(state.marketplace)}`);
  document.querySelectorAll('[data-marketplace-option]').forEach((option) => {
    const selected = option.dataset.marketplaceOption === state.marketplace;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
}

function setPreferredMarketplace(marketplace) {
  if (!amazonMarketplaces[marketplace]) return;
  state.marketplace = marketplace;
  writeStore('booktalkietees:marketplace', marketplace);
  syncMarketplaceSelector();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === view));
  render();
  app.focus({ preventScroll: true });
}

function dailyPick() {
  const index = new Date().getDate() % state.books.length;
  return state.books[index];
}

function designsFor(book) {
  const remote = state.designs.filter((design) => design.bookId === book.id);
  if (remote.length) return remote.map((design) => ({
    ...design,
    products: design.products?.length ? design.products : productTypes,
    amazonListings: design.amazonListings ?? (design.amazonUrl ? { 'T-shirt': { US: design.amazonUrl } } : {}),
  }));
  return book.shirtIdeas.map((idea, index) => ({
    id: `${book.id}-idea-${index + 1}`,
    bookId: book.id,
    title: idea.split(':')[0].slice(0, 44),
    concept: idea,
    products: productTypes,
    imageUrl: '',
  }));
}

function favoriteKey(kind, id) {
  return `${kind}:${id}`;
}

function isFavorite(kind, id) {
  return state.favorites.includes(favoriteKey(kind, id));
}

function toggleFavorite(kind, id) {
  const key = favoriteKey(kind, id);
  state.favorites = state.favorites.includes(key)
    ? state.favorites.filter((item) => item !== key)
    : [...state.favorites, key];
  writeStore('booktalkietees:favorites', state.favorites);
  render();
}

function addToCart(book, design, products, marketplace = state.marketplace) {
  const chosen = products.length ? products : [design.products[0] ?? productTypes[0]];
  const additions = chosen.map((product) => ({
    id: `${design.id}:${product}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    bookId: book.id,
    bookTitle: book.title,
    designId: design.id,
    designTitle: design.title,
    product,
    marketplace,
  }));
  state.cart = [...state.cart, ...additions];
  writeStore('booktalkietees:cart', state.cart);
  updateCartCount();
  showToast(`${additions.length} item${additions.length === 1 ? '' : 's'} added to cart`);
  render();
}

function updateCartCount() {
  cartCount.textContent = state.cart.length;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
}

function render() {
  if (state.view === 'home') return renderHome();
  if (state.view === 'explore') return renderExplore();
  if (state.view === 'search') return renderSearch();
  if (state.view === 'favorites') return renderFavorites();
  if (state.view === 'cart') return renderCart();
}

function renderHome() {
  const pick = dailyPick();
  const featured = designsFor(pick)[0];
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Daily pick</p>
        <h1>${escapeHtml(pick.title)}</h1>
        <p class="lede">${escapeHtml(pick.bookSummary)}</p>
        <div class="hero-actions">
          <button class="button" data-open-book="${pick.id}">Open detail</button>
          <button class="button secondary" data-favorite="book:${pick.id}">${isFavorite('book', pick.id) ? 'Saved' : 'Save book'}</button>
        </div>
      </div>
      <figure class="hero-art">
        ${designArt(featured, pick)}
        <figcaption>${escapeHtml(featured.title)} for ${escapeHtml(pick.movie)} (${escapeHtml(pick.movieYear)})</figcaption>
      </figure>
    </section>
    <div class="section-head">
      <div><h2>Explore connections</h2><p>Books, adaptations, quotes, and product design ideas.</p></div>
      ${genreChips()}
    </div>
    <section class="card-grid">${state.books.map(bookCard).join('')}</section>
  `;
  bindCommonActions();
}

function renderExplore() {
  const visible = state.books.filter((book) => book.genre === state.genre);
  app.innerHTML = `
    <div class="section-head">
      <div><h1>Explore</h1><p>${visible.length} ${escapeHtml(state.genre)} connection${visible.length === 1 ? '' : 's'}.</p></div>
      ${genreChips()}
    </div>
    <section class="card-grid">${visible.map(bookCard).join('')}</section>
  `;
  bindCommonActions();
}

function renderSearch() {
  const query = state.query.trim().toLowerCase();
  const visible = state.books.filter((book) => {
    const haystack = [book.title, book.author, book.movie, book.genre, ...book.quotes, ...book.shirtIdeas].join(' ').toLowerCase();
    return !query || haystack.includes(query);
  });
  app.innerHTML = `
    <section class="panel">
      <h1>Search</h1>
      <input class="search-box" value="${escapeHtml(state.query)}" placeholder="Title, author, movie, quote, genre" aria-label="Search catalog">
    </section>
    <div class="section-head"><div><h2>Results</h2><p>${visible.length} match${visible.length === 1 ? '' : 'es'}</p></div></div>
    <section class="card-grid">${visible.map(bookCard).join('')}</section>
  `;
  document.querySelector('.search-box').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderSearch();
    document.querySelector('.search-box').focus();
  });
  bindCommonActions();
}

function renderFavorites() {
  const rows = state.favorites.map((key) => favoriteRow(key)).filter(Boolean);
  app.innerHTML = `
    <div class="section-head"><div><h1>Favorites</h1><p>${rows.length} saved item${rows.length === 1 ? '' : 's'}.</p></div></div>
    <section class="stack">${rows.length ? rows.join('') : '<div class="panel empty-state">No favorites yet.</div>'}</section>
  `;
  bindCommonActions();
}

function renderCart() {
  app.innerHTML = `
    <div class="section-head"><div><h1>Cart</h1><p>${state.cart.length} item${state.cart.length === 1 ? '' : 's'} ready to email.</p></div></div>
    <section class="panel price-summary">
      <strong>Suggested subtotal: ${state.cart.length ? escapeHtml(formatCartTotals()) : formatPrice(0, state.marketplace)}</strong>
      <p>Taxes and shipping are based on delivery address. Amazon listing prices can vary by marketplace and availability.</p>
    </section>
    <section class="stack">
      ${state.cart.length ? state.cart.map(cartRow).join('') : '<div class="panel empty-state">Your cart is empty.</div>'}
      ${state.cart.length ? '<button class="button tonal" data-checkout>Email support</button>' : ''}
    </section>
  `;
  bindCommonActions();
  document.querySelectorAll('[data-remove-cart]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      state.cart = state.cart.filter((item) => item.id !== button.dataset.removeCart);
      writeStore('booktalkietees:cart', state.cart);
      updateCartCount();
      renderCart();
    });
  });
  document.querySelector('[data-checkout]')?.addEventListener('click', emailSupportForCart);
}

function genreChips() {
  const genres = [...new Set(state.books.map((book) => book.genre))];
  return `<div class="chip-row">${genres.map((genre) => `<button class="chip ${genre === state.genre ? 'is-selected' : ''}" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join('')}</div>`;
}

function bookCard(book) {
  const previewDesigns = designsFor(book);
  return `
    <article class="book-card" data-genre="${escapeHtml(book.genre)}">
      <div class="book-card-top"><span class="badge">${escapeHtml(book.genre)}</span></div>
      <div class="book-card-body">
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author)} / ${escapeHtml(book.movie)} (${escapeHtml(book.movieYear)})</p>
        <p>${escapeHtml(book.bookSummary)}</p>
        <div class="book-design-strip" aria-label="Design previews">
          ${previewDesigns.map((design) => `<div class="book-design-preview">${designArt(design, book)}</div>`).join('')}
        </div>
        <div class="book-card-actions">
          <button class="button" data-open-book="${book.id}">Open</button>
          <button class="icon-button ${isFavorite('book', book.id) ? 'is-active' : ''}" data-favorite="book:${book.id}" aria-label="Save ${escapeHtml(book.title)}">♥</button>
        </div>
      </div>
    </article>
  `;
}

function designArt(design, book) {
  const src = resolveAsset(design.imageUrl);
  if (src) return `<img src="${escapeHtml(src)}" alt="${escapeHtml(design.title)} design">`;
  return `<div class="generated-art"><strong>${escapeHtml(book.title)}<br>${escapeHtml(design.title)}</strong></div>`;
}

function rowThumbnail(book, design) {
  if (!book || !design) return '';
  return `<div class="row-thumbnail">${designArt(design, book)}</div>`;
}

function openBook(bookId, focusDesignId = '') {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  const designs = designsFor(book);
  modalContent.innerHTML = `
    <div class="detail-layout">
      <section class="panel">
        <p class="eyebrow">${escapeHtml(book.genre)}</p>
        <h2 class="detail-title" id="modalTitle">${escapeHtml(book.title)}</h2>
        <p class="meta">${escapeHtml(book.author)} / ${escapeHtml(book.movie)} (${escapeHtml(book.movieYear)})</p>
        <p>${escapeHtml(book.bookSummary)}</p>
        <h3>Movie adaptation</h3>
        <p>${escapeHtml(book.movieSummary)}</p>
        <h3>Quotes</h3>
        <div class="quote-list">${book.quotes.map((quote) => `<blockquote class="quote">${escapeHtml(quote)}</blockquote>`).join('')}</div>
        <div class="hero-actions">
          <button class="button secondary" data-favorite="book:${book.id}">${isFavorite('book', book.id) ? 'Book saved' : 'Save book'}</button>
          <button class="button secondary" data-favorite="movie:${book.id}">${isFavorite('movie', book.id) ? 'Movie saved' : 'Save movie'}</button>
          <button class="button secondary" data-favorite="quote:${book.id}">${isFavorite('quote', book.id) ? 'Quotes saved' : 'Save quotes'}</button>
        </div>
      </section>
      <section>
        <div class="section-head"><div><h2>Product designs</h2><p>Select one or more products.</p></div></div>
        <div class="design-grid">${designs.map((design) => designCard(book, design)).join('')}</div>
      </section>
    </div>
  `;
  modal.hidden = false;
  bindCommonActions(modalContent);
  bindDesignActions(book, designs);
  if (focusDesignId) {
    const focusedCard = modalContent.querySelector(`[data-design-id="${CSS.escape(focusDesignId)}"]`);
    if (focusedCard) {
      focusedCard.classList.add('is-focused');
      focusedCard.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

function designCard(book, design) {
  const hasAmazonListings = Object.keys(design.amazonListings ?? {}).length > 0;
  return `
    <article class="design-card" data-design-id="${escapeHtml(design.id)}">
      <div class="design-art">${designArt(design, book)}</div>
      <div class="design-body">
        <h3>${escapeHtml(design.title)}</h3>
        <p>${escapeHtml(design.concept)}</p>
        <div class="product-picker">
          ${design.products.map((product, index) => `<button class="product-chip ${index === 0 ? 'is-selected' : ''}" data-product="${escapeHtml(product)}">${escapeHtml(product)} <span>${escapeHtml(formatPrice(suggestedPriceFor(product, state.marketplace), state.marketplace))}</span></button>`).join('')}
        </div>
        ${hasAmazonListings ? `<div class="marketplace-picker">${Object.entries(amazonMarketplaces).map(([key, domain]) => `<button class="product-chip marketplace-chip ${key === state.marketplace ? 'is-selected' : ''}" data-marketplace="${key}" title="${escapeHtml(domain)}">${key}</button>`).join('')}</div>` : ''}
        <div class="book-card-actions">
          <button class="button tonal" data-commerce-action="${escapeHtml(design.id)}">Add to cart</button>
          <button class="icon-button ${isFavorite('design', design.id) ? 'is-active' : ''}" data-favorite="design:${design.id}" aria-label="Save ${escapeHtml(design.title)}">♥</button>
        </div>
      </div>
    </article>
  `;
}

function amazonUrlForSelection(card, design) {
  const selectedProducts = [...card.querySelectorAll('[data-product].is-selected')].map((chip) => chip.dataset.product);
  if (selectedProducts.length !== 1) return '';
  const marketplace = selectedMarketplaceForCard(card);
  return design.amazonListings?.[selectedProducts[0]]?.[marketplace] ?? '';
}

function selectedMarketplaceForCard(card) {
  return card.querySelector('[data-marketplace].is-selected')?.dataset.marketplace ?? state.marketplace;
}

function updateCommerceButton(card, design) {
  const button = card.querySelector('[data-commerce-action]');
  if (!button) return;
  const amazonUrl = amazonUrlForSelection(card, design);
  button.textContent = amazonUrl ? 'Buy on Amazon' : 'Add to cart';
}

function bindDesignActions(book, designs) {
  modalContent.querySelectorAll('[data-design-id]').forEach((card) => {
    const design = designs.find((item) => item.id === card.dataset.designId);
    card.querySelectorAll('[data-product]').forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-selected');
        updateCommerceButton(card, design);
      });
    });
    card.querySelectorAll('[data-marketplace]').forEach((chip) => {
      chip.addEventListener('click', () => {
        card.querySelectorAll('[data-marketplace]').forEach((item) => item.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        setPreferredMarketplace(chip.dataset.marketplace);
        updateCommerceButton(card, design);
      });
    });
    updateCommerceButton(card, design);
  });
  modalContent.querySelectorAll('[data-commerce-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-design-id]');
      const design = designs.find((item) => item.id === button.dataset.commerceAction);
      const amazonUrl = amazonUrlForSelection(card, design);
      if (amazonUrl) {
        window.open(amazonUrl, '_blank', 'noopener');
        return;
      }
      const selected = [...card.querySelectorAll('[data-product].is-selected')].map((chip) => chip.dataset.product);
      addToCart(book, design, selected, selectedMarketplaceForCard(card));
    });
  });
}

function bindCommonActions(root = document) {
  root.querySelectorAll('[data-open-book]').forEach((button) => {
    const openTarget = () => openBook(button.dataset.openBook, button.dataset.focusDesign ?? '');
    button.addEventListener('click', openTarget);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openTarget();
      }
    });
  });
  root.querySelectorAll('[data-favorite]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const [kind, id] = button.dataset.favorite.split(':');
      toggleFavorite(kind, id);
    });
  });
  root.querySelectorAll('button[data-genre]').forEach((button) => {
    button.addEventListener('click', () => {
      state.genre = button.dataset.genre;
      if (state.view !== 'explore') setView('explore');
      else renderExplore();
    });
  });
}

function favoriteRow(key) {
  const [kind, id] = key.split(':');
  if (kind === 'design') {
    const design = state.designs.find((item) => item.id === id);
    if (!design) return null;
    const book = state.books.find((item) => item.id === design.bookId);
    return `<div class="favorite-row is-clickable" data-open-book="${escapeHtml(book?.id ?? design.bookId)}" data-focus-design="${escapeHtml(design.id)}" role="button" tabindex="0">${rowThumbnail(book, design)}<div class="row-copy"><strong>${escapeHtml(design.title)}</strong><span>${escapeHtml(book?.title ?? 'Design')} design</span></div><button class="icon-button is-active" data-favorite="design:${escapeHtml(id)}" aria-label="Remove favorite">♥</button></div>`;
  }
  const book = state.books.find((item) => item.id === id);
  if (!book) return null;
  const label = kind === 'movie' ? book.movie : kind === 'quote' ? `${book.title} quotes` : book.title;
  const design = designsFor(book)[0];
  return `<div class="favorite-row is-clickable" data-open-book="${escapeHtml(book.id)}" role="button" tabindex="0">${rowThumbnail(book, design)}<div class="row-copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(kind)}</span></div><button class="icon-button is-active" data-favorite="${escapeHtml(kind)}:${escapeHtml(id)}" aria-label="Remove favorite">♥</button></div>`;
}


function emailSupportForCart() {
  const body = [
    'Hi BookTalkieTees support,',
    '',
    'I would like to order these inspired products:',
    '',
    ...state.cart.map((item) => {
      const marketplace = item.marketplace ?? state.marketplace;
      const price = suggestedPriceFor(item.product, marketplace);
      return `- ${item.product}: ${item.designTitle} / ${item.bookTitle} - ${marketplaceLabel(marketplace)} - ${formatPrice(price, marketplace)} estimate`;
    }),
    '',
    `Suggested subtotal: ${formatCartTotals()}`,
    'Taxes and shipping are based on delivery address. Amazon listing prices can vary by marketplace and availability.',
    '',
    'Please send next steps for availability and shipping.',
  ].join('\n');
  const url = `mailto:${supportEmail}?subject=${encodeURIComponent('BookTalkieTees order request')}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

function cartRow(item) {
  const marketplace = item.marketplace ?? state.marketplace;
  const price = suggestedPriceFor(item.product, marketplace);
  const book = state.books.find((book) => book.id === item.bookId);
  const design = state.designs.find((design) => design.id === item.designId)
    ?? (book ? designsFor(book).find((design) => design.id === item.designId) : null);
  const openAttrs = book ? ` data-open-book="${escapeHtml(book.id)}" data-focus-design="${escapeHtml(item.designId)}" role="button" tabindex="0"` : '';
  return `<div class="cart-row ${book ? 'is-clickable' : ''}"${openAttrs}>${rowThumbnail(book, design)}<div class="row-copy"><strong>${escapeHtml(item.designTitle)}</strong><span>${escapeHtml(item.product)} / ${escapeHtml(item.bookTitle)} / ${escapeHtml(marketplaceLabel(marketplace))} / ${escapeHtml(formatPrice(price, marketplace))} estimate</span></div><button class="icon-button" data-remove-cart="${escapeHtml(item.id)}" aria-label="Remove item">x</button></div>`;
}

function closeModal() {
  modal.hidden = true;
  modalContent.innerHTML = '';
}

boot();
