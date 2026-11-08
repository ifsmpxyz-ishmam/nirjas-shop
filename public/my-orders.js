const CURRENCY = '$ ';

const list = document.getElementById('orders');
const stateBox = document.getElementById('orders-state');
const emptyBox = document.getElementById('orders-empty');

function money(n) {
  return CURRENCY + Number(n).toLocaleString();
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function makeBlock(title, lines) {
  const block = document.createElement('div');
  block.className = 'info-block';
  const h4 = document.createElement('h4');
  h4.textContent = title;
  block.appendChild(h4);
  lines.forEach(text => {
    const p = document.createElement('p');
    p.textContent = text;
    block.appendChild(p);
  });
  return block;
}

function showState(text) {
  stateBox.textContent = text;
  stateBox.hidden = !text;
}

function updateCartCount() {
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) {}
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').textContent = 'Cart (' + count + ')';
}
updateCartCount();
const flow = ['pending', 'paid', 'shipped', 'delivered'];
const labels = ['Order placed', 'Confirmed', 'On the way', 'Delivered'];

function buildSteps(status) {
  const current = flow.indexOf(status);
  const ul = document.createElement('ul');
  ul.className = 'steps';

  flow.forEach((key, i) => {
    const li = document.createElement('li');
    li.className = 'step ' + (i < current ? 'completed' : i === current ? 'current' : 'pending');

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = i < current ? '✓' : i + 1;

    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = labels[i];

    li.appendChild(dot);
    li.appendChild(label);
    ul.appendChild(li);
  });
  return ul;
}

function buildOrder(order) {
  const card = document.createElement('article');
  card.className = 'order-card';

  // ---- উপরের অংশ: অর্ডার নম্বর, তারিখ, অবস্থা ----
  const head = document.createElement('div');
  head.className = 'order-head';

  const left = document.createElement('div');
  const no = document.createElement('div');
  no.className = 'order-no';
  no.textContent = 'Order ' + (order.tran_id || '#' + order.id);
  const date = document.createElement('div');
  date.className = 'order-date';
  date.textContent = formatDate(order.created_at);
  left.appendChild(no);
  left.appendChild(date);

  const known = ['pending', 'paid', 'failed', 'cancelled', 'shipped', 'delivered'];
  const status = known.includes(order.status) ? order.status : 'pending';
  const badge = document.createElement('span');
  badge.className = 'badge badge-' + status;
  badge.textContent = status;

  head.appendChild(left);
  head.appendChild(badge);

  // ---- মাঝের অংশ: আইটেম ----
  const items = document.createElement('ul');
  items.className = 'order-items';
  (order.items || []).forEach(item => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = item.name + ' x ' + item.qty;
    const price = document.createElement('span');
    price.textContent = money(Number(item.price) * item.qty);
    li.appendChild(label);
    li.appendChild(price);
    items.appendChild(li);
  });
  const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'order-toggle';
toggle.textContent = 'Show order status';

const details = document.createElement('div');
details.className = 'order-details';
details.hidden = true;

if (status === 'failed' || status === 'cancelled') {
  const banner = document.createElement('div');
  banner.className = 'order-banner';
  banner.textContent = 'This order was ' + status + '.';
  details.appendChild(banner);
} else {
  details.appendChild(buildSteps(status));
}

const grid = document.createElement('div');
grid.className = 'info-grid';
grid.appendChild(makeBlock('Delivery', [order.customer_name, order.phone, order.address]));
grid.appendChild(makeBlock('Payment', [order.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment', 'Total: ' + money(order.total)]));
details.appendChild(grid);

toggle.addEventListener('click', () => {
  details.hidden = !details.hidden;
  toggle.textContent = details.hidden ? 'Show order status' : 'Hide order status';
});
    
  
 

  // ---- নিচের অংশ: পেমেন্টের ধরন আর মোট ----
  const foot = document.createElement('div');
  foot.className = 'order-foot';
  const pay = document.createElement('span');
  pay.className = 'order-pay';
  pay.textContent = order.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment';
  const total = document.createElement('span');
  total.className = 'order-total';
  total.textContent = money(order.total);
  foot.appendChild(pay);
  foot.appendChild(total);

  card.appendChild(head);
  card.appendChild(items);
  card.appendChild(toggle);
card.appendChild(details);
  card.appendChild(foot);
  return card;
}

async function loadOrders() {
  showState('Loading your orders...');
  emptyBox.hidden = true;

  try {
    const response = await fetch('/api/my/orders', { credentials: 'same-origin' });

    if (response.status === 401) {
      window.location.href = 'login.html?next=my-orders.html';
      return;
    }
    if (!response.ok) {
      showState('Could not load your orders. Please try again.');
      return;
    }

    const orders = await response.json();
    list.innerHTML = '';
    showState('');

    if (orders.length === 0) {
      emptyBox.hidden = false;
      return;
    }
    orders.forEach(order => list.appendChild(buildOrder(order)));
  } catch (error) {
    showState('Could not reach the server. Please try again.');
  }
}

loadOrders();