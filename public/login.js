
const params = new URLSearchParams(window.location.search);
const nextParam = params.get('next') || '';

const nextPage = /^[a-z0-9-]+\.html$/i.test(nextParam) ? nextParam : 'shop.html';


const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');

document.getElementById('show-signup').addEventListener('click', () => {
  loginView.hidden = true;
  signupView.hidden = false;
});
document.getElementById('show-login').addEventListener('click', () => {
  signupView.hidden = true;
  loginView.hidden = false;
});

async function send(url, data, msgBox, button) {
  msgBox.textContent = '';
  button.disabled = true;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (response.ok) {
      window.location.href = nextPage;
      return;
    }
    msgBox.textContent = result.error || 'Something went wrong';
  } catch (error) {
    msgBox.textContent = 'Could not reach the server. Please try again.';
  } finally {
    button.disabled = false;
  }
}


document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  send('/api/login', {
    email: document.getElementById('login-email').value.trim(),
    password: document.getElementById('login-password').value
  }, document.getElementById('login-msg'), e.target.querySelector('button[type="submit"]'));
});


document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  send('/api/signup', {
    name: document.getElementById('signup-name').value.trim(),
    email: document.getElementById('signup-email').value.trim(),
    password: document.getElementById('signup-password').value
  }, document.getElementById('signup-msg'), e.target.querySelector('button[type="submit"]'));


let cart = [];
try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) {}
const count = cart.reduce((sum, item) => sum + item.qty, 0);
document.getElementById('cart-count').textContent = 'Cart (' + count + ')';
const data = await response.json();
if (data.role === 'admin') {
  window.location.href = 'admin-orders.html';
} else {
  window.location.href = 'shop.html';
}
});
