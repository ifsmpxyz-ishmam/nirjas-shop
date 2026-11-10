
window.currentUser = null;

function buildUserMenu(user) {
  const display = user.name || (user.email ? user.email.split('@')[0] : 'Account');
  const initial = display.trim().charAt(0).toUpperCase() || '?';

  const wrap = document.createElement('div');
  wrap.className = 'user-menu';

 
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'user-btn';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');

  const avatar = document.createElement('span');
  avatar.className = 'user-avatar';
  avatar.textContent = initial;

  const nameEl = document.createElement('span');
  nameEl.className = 'user-name';
  nameEl.textContent = display;

  const caret = document.createElement('span');
  caret.className = 'user-caret';
  caret.textContent = '▾';

  btn.appendChild(avatar);
  btn.appendChild(nameEl);
  btn.appendChild(caret);

  const menu = document.createElement('div');
  menu.className = 'user-dropdown';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const info = document.createElement('div');
  info.className = 'user-info';
  const infoName = document.createElement('strong');
  infoName.textContent = display;
  const infoEmail = document.createElement('span');
  infoEmail.textContent = user.email || '';
  info.appendChild(infoName);
  info.appendChild(infoEmail);

  const ordersLink = document.createElement('a');
  ordersLink.href = 'my-orders.html';
  ordersLink.className = 'menu-item';
  ordersLink.setAttribute('role', 'menuitem');
  ordersLink.textContent = 'My orders';
  if (user.role === 'admin') {
  const adminLink = document.createElement('a');
  adminLink.href = 'admin-orders.html';
  adminLink.className = 'menu-item';
  adminLink.setAttribute('role', 'menuitem');
  adminLink.textContent = 'Admin orders';
  menu.appendChild(adminLink);
}

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'menu-item';
  logout.setAttribute('role', 'menuitem');
  logout.textContent = 'Log out';

  menu.appendChild(info);
  menu.appendChild(ordersLink);
  menu.appendChild(logout);

  wrap.appendChild(btn);
  wrap.appendChild(menu);


  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', () => setOpen(menu.hidden));

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });


  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (error) {
     
    }
    window.location.href = 'shop.html';
  });

  return wrap;
}

(async function () {
  const link = document.getElementById('auth-link');

  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    const data = await res.json();
    window.currentUser = data.user || null;
  } catch (error) {
    window.currentUser = null;
  }

  if (link && window.currentUser) {
    link.replaceWith(buildUserMenu(window.currentUser));
  }

  document.dispatchEvent(new CustomEvent('auth-ready'));
})();
