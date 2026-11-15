// ---------- Helpers ----------
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatPrice(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- Cart (stored in localStorage) ----------
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function addToCart(product, quantity) {
  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, product.stock);
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, quantity });
  }
  saveCart(cart);
}

function updateCartCount() {
  const count = getCart().reduce((sum, i) => sum + i.quantity, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = count);
}

// ---------- Navigation: show Login or Logout ----------
async function updateNav() {
  updateCartCount();
  const slot = document.getElementById('auth-links');
  if (!slot) return;
  try {
    const me = await api('/api/me');
    if (me) {
      slot.innerHTML = `<span class="muted">Hi, ${esc(me.name)}</span> <a href="#" id="logout-link">Logout</a>`;
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        await api('/api/logout', { method: 'POST' });
        window.location.reload();
      });
    } else {
      slot.innerHTML = '<a href="auth.html">Login</a>';
    }
  } catch {
    slot.innerHTML = '<a href="auth.html">Login</a>';
  }
}
