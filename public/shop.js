
const grid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-search');
const countBox = document.getElementById('result-count');
const suggestBox = document.getElementById('suggestions');

const colors = {
  Cleansers: '#6F8F72',
  Sunscreen: '#3F6C8C',
  Moisturisers: '#B5533C',
  Serums: '#C98A2B',
  Toners: '#7A9E9F'
};

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let allProducts = [];
let currentCategory = 'All';
let searchtext = '';
let currentWords = [];
let activeIndex = -1;


function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').textContent = 'Cart (' + total + ')';
}
updateCartCount();


async function loadProducts() {
  const response = await fetch('/api/products');
  if (!response.ok) return;
  allProducts = await response.json();
  filterProducts();
}


function getScore(product, words) {
  const name = product.name.toLowerCase();
  const category = product.category.toLowerCase();
  const desc = (product.description || '').toLowerCase();
  let score = 0;

  for (const word of words) {
    let wordScore = 0;

    if (name.startsWith(word)) wordScore = 10;
    else if (name.includes(word)) wordScore = 6;
    else if (category.includes(word)) wordScore = 3;
    else if (desc.includes(word)) wordScore = 1;

    if (wordScore === 0) return 0; // একটা শব্দও না মিললে প্রোডাক্ট বাদ
    score += wordScore;
  }

  return score;
}

function renderProducts(list) {
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<p>No products found.</p>';
    return;
  }

  list.forEach(product => {
    const card = document.createElement('article');
    card.className = 'card';

    const shelf = document.createElement('div');
    shelf.className = 'shelf';

    if (product.image_url) {
      const img = document.createElement('img');
      img.src = product.image_url;
      img.alt = product.name;
      img.loading = 'lazy';
      shelf.appendChild(img);
    } else {
      const bottle = document.createElement('span');
      bottle.className = 'bottle';
      bottle.style.setProperty('--c', colors[product.category]);
      shelf.appendChild(bottle);
    }

    const label = document.createElement('div');
    label.className = 'label';

    const name = document.createElement('h3');
    name.classList.add('product-name');
    name.textContent = product.name;

    const inc = document.createElement('p');
    inc.className = 'inc';
    inc.textContent = (product.description || '').split('.')[0];

    const row = document.createElement('div');
    row.className = 'row';

    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = '$ ' + Number(product.price).toLocaleString();

    const button = document.createElement('button');
    button.classList.add('payment-btn');
    button.textContent = 'Add to cart';
    button.addEventListener('click', () => {
      const existing = cart.find(item => item.id === product.id);

      if (existing) {
        existing.qty = existing.qty + 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          qty: 1
        });
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();
    });

    row.appendChild(price);
    row.appendChild(button);
    label.appendChild(name);
    label.appendChild(inc);
    label.appendChild(row);
    card.appendChild(shelf);
    card.appendChild(label);
    grid.appendChild(card);
  });
}


function updateCount(n) {
  let text = n + (n === 1 ? ' product' : ' products');
  if (searchtext.trim()) text += ' for "' + searchtext.trim() + '"';
  countBox.textContent = text;
}

function filterProducts() {
  currentWords = searchtext.trim().split(/\s+/).filter(Boolean);

  let results = allProducts.filter(p =>
    currentCategory === 'All' || p.category === currentCategory
  );

  if (currentWords.length > 0) {
    results = results
      .map(p => ({ product: p, score: getScore(p, currentWords) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.product);
  }

  updateCount(results.length);
  renderProducts(results);
}


const categoryLinks = document.querySelectorAll('.cats a[data-category]');

categoryLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    currentCategory = link.dataset.category;

    categoryLinks.forEach(l => l.classList.remove('on'));
    link.classList.add('on');

    filterProducts();
  });
});


function clearSearch() {
  searchInput.value = '';
  searchtext = '';
  clearBtn.hidden = true;
  suggestBox.hidden = true;
  filterProducts();
  searchInput.focus();
}

function showSuggestions() {
  suggestBox.innerHTML = '';
  activeIndex = -1;

  if (currentWords.length === 0) {
    suggestBox.hidden = true;
    return;
  }

  const top = allProducts
    .map(p => ({ product: p, score: getScore(p, currentWords) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (top.length === 0) {
    suggestBox.hidden = true;
    return;
  }

  top.forEach(r => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.textContent = r.product.name;

    li.addEventListener('click', () => {
      searchInput.value = r.product.name;
      searchtext = r.product.name.toLowerCase();
      clearBtn.hidden = false;
      suggestBox.hidden = true;
      filterProducts();
    });

    suggestBox.appendChild(li);
  });

  suggestBox.hidden = false;
}

searchInput.addEventListener('input', () => {
  searchtext = searchInput.value.toLowerCase();
  clearBtn.hidden = searchtext === '';
  filterProducts();
  showSuggestions();
});

clearBtn.addEventListener('click', clearSearch);


searchInput.addEventListener('keydown', (e) => {
  const items = suggestBox.querySelectorAll('li');

  if (e.key === 'ArrowDown' && items.length) {
    e.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === 'ArrowUp' && items.length) {
    e.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === 'Enter' && activeIndex >= 0) {
    items[activeIndex].click();
    return;
  } else if (e.key === 'Escape') {
    clearSearch();
    return;
  } else {
    return;
  }

  items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
});

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === '/' && !typing) {
    e.preventDefault();
    searchInput.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) suggestBox.hidden = true;
});


loadProducts();
