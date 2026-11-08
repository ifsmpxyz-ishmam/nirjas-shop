const CURRENCY = '$ ';
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const KNOWN = ['pending', 'paid', 'shipped', 'delivered', 'failed', 'cancelled'];

const stateBox = document.getElementById('admin-state');
const listBox = document.getElementById('admin-orders');
const searchInput = document.getElementById('admin-search');
const chips = document.querySelectorAll('#admin-filters .chip');

let allOrders = [];
let currentFilter = 'all';
let searchText = '';

function money(n) {
  return CURRENCY + Number(n).toFixed(2);
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showState(text) {
  stateBox.textContent = text;
  stateBox.hidden = !text;
}

function countStatus(list) {
  return allOrders.filter(order => list.includes(order.status)).length;
}

function updateStats() {
  document.getElementById('stat-total').textContent = allOrders.length;
  document.getElementById('stat-new').textContent = countStatus(['pending', 'paid']);
  document.getElementById('stat-shipped').textContent = countStatus(['shipped']);
  document.getElementById('stat-delivered').textContent = countStatus(['delivered']);
}

function makeText(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function buildRow(order) {
  const row = document.createElement('article');
  row.className = 'a-order';

  const status = KNOWN.includes(order.status) ? order.status : 'pending';

  const first = document.createElement('div');
  first.appendChild(makeText('div', 'a-no', order.tran_id || '#' + order.id));
  first.appendChild(makeText('div', 'a-sub', formatDate(order.created_at)));

  const second = document.createElement('div');
  second.appendChild(makeText('div', 'a-name', order.customer_name || ''));
  second.appendChild(makeText('div', 'a-sub', (order.phone || '') + ' · ' + (order.email || 'Guest')));

  const total = makeText('div', 'a-total', money(order.total));

  const controls = document.createElement('div');
  controls.className = 'a-controls';

  const badge = makeText('span', 'badge badge-' + status, order.status);

  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Order status');
  const options = STATUSES.includes(order.status) ? STATUSES : [...STATUSES, order.status];
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (!STATUSES.includes(value)) option.disabled = true;
    select.appendChild(option);
  });
  select.value = order.status;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Update';

  const msg = document.createElement('div');
  msg.className = 'a-msg';

  button.addEventListener('click', async () => {
    const newStatus = select.value;
    if (newStatus === order.status) {
      msg.className = 'a-msg';
      msg.textContent = 'No change';
      return;
    }

    button.disabled = true;
    msg.className = 'a-msg';
    msg.textContent = '';

    try {
      const response = await fetch('/api/admin/orders/' + order.id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('failed');

      order.status = newStatus;
      badge.className = 'badge badge-' + newStatus;
      badge.textContent = newStatus;
      msg.textContent = 'Saved';
      updateStats();
    } catch (error) {
      console.error(error);
      msg.className = 'a-msg error';
      msg.textContent = 'Could not save. Try again.';
    }
    button.disabled = false;
  });

  controls.appendChild(badge);
  controls.appendChild(select);
  controls.appendChild(button);
  controls.appendChild(msg);

  row.appendChild(first);
  row.appendChild(second);
  row.appendChild(total);
  row.appendChild(controls);
  return row;
}

function render() {
  const text = searchText.trim().toLowerCase();

  const shown = allOrders.filter(order => {
    const okStatus = currentFilter === 'all' || order.status === currentFilter;
    const haystack = [order.tran_id, order.customer_name, order.phone, order.email]
      .map(value => value || '')
      .join(' ')
      .toLowerCase();
    return okStatus && haystack.includes(text);
  });

  updateStats();
  listBox.innerHTML = '';

  if (shown.length === 0) {
    showState('No orders found.');
    return;
  }

  showState('');
  shown.forEach(order => listBox.appendChild(buildRow(order)));
}

async function loadOrders() {
  try {
    const response = await fetch('/api/admin/orders', { credentials: 'same-origin' });

    if (response.status === 401) {
      window.location.href = 'login.html?next=admin-orders.html';
      return;
    }
    if (response.status === 403) {
      showState('Admins only.');
      return;
    }
    if (!response.ok) {
      showState('Could not load orders.');
      return;
    }

    allOrders = await response.json();
    render();
  } catch (error) {
    console.error(error);
    showState('Could not load orders.');
  }
}

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => {
      c.classList.remove('on');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('on');
    chip.setAttribute('aria-pressed', 'true');
    currentFilter = chip.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', () => {
  searchText = searchInput.value;
  render();
});

loadOrders();