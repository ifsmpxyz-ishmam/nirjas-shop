let cart = JSON.parse(localStorage.getItem('cart')) || [];

const box = document.getElementById('cart-items');
const totalBox = document.getElementById('cart-total');

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').textContent = 'Cart (' + total + ')';
}
updateCartCount();
function changeQty(id, change) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = item.qty + change;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
}

function renderCart() {
  box.innerHTML = '';
  updateCartCount();

  if (cart.length === 0) {
    box.innerHTML = '<div class="cart-empty"><p>Your cart is empty.</p><a href="index.html">Browse products</a></div>';
    totalBox.textContent = '$ 0';
    return;
  }

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    let pic;
    if (item.image_url) {
      pic = document.createElement('img');
      pic.src = item.image_url;
      pic.alt = item.name;
    } else {
      pic = document.createElement('div')
    }

    const info = document.createElement('div');

    const name = document.createElement('p');
    name.className = 'ci-name';
    name.textContent = item.name;

    const price = document.createElement('p');
    price.className = 'ci-price';
    price.textContent = '$ ' + Number(item.price).toLocaleString();

    const controls = document.createElement('div');
    controls.className = 'qty-controls';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.addEventListener('click', () => changeQty(item.id, -1));

    const qty = document.createElement('span');
    qty.textContent = item.qty;

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.addEventListener('click', () => changeQty(item.id, 1));

    controls.appendChild(minus);
    controls.appendChild(qty);
    controls.appendChild(plus);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeItem(item.id));

    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(controls);
    info.appendChild(remove);

    const line = document.createElement('div');
    line.className = 'ci-line';
    line.textContent = '$ ' + (Number(item.price) * item.qty).toLocaleString();

    row.appendChild(pic);
    row.appendChild(info);
    row.appendChild(line);
    box.appendChild(row);
  });

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  totalBox.textContent = '$ ' + total.toLocaleString();
}

renderCart();
const checkoutForm = document.getElementById('checkout-form');
const message = document.getElementById('order-message');
const placeBtn = document.getElementById('place-order');

document.querySelector('.checkout-btn').addEventListener('click', () => {
  if (cart.length === 0) {
    message.textContent = 'Your cart is empty.';
    return;
  }
window.location.href = 'checkout.html';
});

