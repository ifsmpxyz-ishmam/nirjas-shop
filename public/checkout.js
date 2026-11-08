let cart = JSON.parse(localStorage.getItem('cart')) || [];

const summaryBox = document.getElementById('summary-items');
const totalBox = document.getElementById('summary-total');
const checkoutForm = document.getElementById('checkout-form');
const message = document.getElementById('order-message');
const placeBtn = document.getElementById('place-order');

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').textContent = 'Cart (' + count + ')';
}
updateCartCount();

function renderCart() {
  summaryBox.innerHTML = '';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'sum-row';

    const label = document.createElement('span');
    label.textContent = item.name + ' x ' + item.qty;

    const price = document.createElement('span');
    price.textContent = '$ ' + (Number(item.price) * item.qty).toLocaleString();

    row.appendChild(label);
    row.appendChild(price);
    summaryBox.appendChild(row);
  });

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  totalBox.textContent = 'Total: $' + total.toLocaleString();
}
renderCart();

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (cart.length === 0) {
    message.textContent = 'Your cart is empty.';
    return;
  }

  message.textContent = '';
  placeBtn.disabled = true;

  const formData = new FormData(checkoutForm);
  const orderData = {
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim(),
    payment: formData.get('payment'),
    items: cart.map(item => ({ id: item.id, qty: item.qty }))
  };

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await response.json();

    if (!response.ok) {
      message.textContent = 'Error: ' + result.error;
      return;
    }

    // 
    if (orderData.payment === 'online') {
      const payRes = await fetch('/api/pay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tranId: result.tranId })
      });
      const payData = await payRes.json();

      if (payRes.ok) {
        window.location.href = payData.url;
        return;
      }
      message.textContent = 'Could not start payment: ' + payData.error;
      return;
    }

    // Cash on delivery
    localStorage.removeItem('cart');
    window.location.href = 'order-result.html?status=placed&tran=' + encodeURIComponent(result.tranId);
  } catch (error) {
    message.textContent = 'An error occurred while placing the order.';
  } finally {
    placeBtn.disabled = false;

  }
});
document.addEventListener('auth-ready', () => {
  if (window.currentUser && window.currentUser.name) {
    document.getElementById('name').value = window.currentUser.name;
  }
});