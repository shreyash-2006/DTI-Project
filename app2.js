// billing / POS page logic
function renderPOS() {
  document.getElementById('billNo').textContent = nextBillNo();
  document.getElementById('billDate').textContent = new Date().toLocaleString('en-IN');
  const grid = document.getElementById('posProducts');
  grid.innerHTML = products.map(p => `
    <div class="pos-product-card" onclick="addToCart('${p.id}')">
      <div class="p-name">${p.name}</div>
      <div class="p-price">₹${p.price}</div>
      <div class="p-stock">${p.stock} ${p.unit}</div>
    </div>`).join('');
  renderCart();
}

function posSearchFn(q) {
  const res = document.getElementById('posResults');
  if (!q) { res.classList.remove('open'); return; }
  const found = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode || '').toLowerCase().includes(q.toLowerCase()));
  if (!found.length) { res.classList.remove('open'); return; }
  res.innerHTML = found.map(p => `
    <div class="pos-result-item" onclick="addToCart('${p.id}');document.getElementById('posSearch').value='';document.getElementById('posResults').classList.remove('open')">
      <span>${p.name}</span><span style="color:#a5b4fc;font-weight:700">₹${p.price}</span>
    </div>`).join('');
  res.classList.add('open');
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.stock === 0) { toast('Out of stock!', 'error'); return; }
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= p.stock) { toast('Max stock reached', 'warn'); return; }
    existing.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  document.getElementById('discountInput').value = 0;
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cartItems');
  el.innerHTML = cart.length ? cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-name">${c.name}</div>
      <div class="cart-qty-wrap">
        <button class="qty-btn" onclick="changeQty('${c.id}',-1)">−</button>
        <span>${c.qty}</span>
        <button class="qty-btn" onclick="changeQty('${c.id}',1)">+</button>
      </div>
      <div class="cart-item-total">₹${(c.price * c.qty).toFixed(2)}</div>
      <button class="cart-remove" onclick="removeFromCart('${c.id}')">✕</button>
    </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🛒</div>Cart is empty</div>';
  calcTotal();
}

function calcTotal() {
  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const disc = Math.min(+document.getElementById('discountInput').value || 0, 100);
  const afterDisc = sub * (1 - disc / 100);
  const gst = afterDisc * 0.18;
  const total = afterDisc + gst;
  document.getElementById('subtotal').textContent = '₹' + sub.toFixed(2);
  document.getElementById('gstAmt').textContent = '₹' + gst.toFixed(2);
  document.getElementById('grandTotal').textContent = '₹' + total.toFixed(2);
}

// need this to hold bill data while UPI payment is being done
var _pendingBill = null;

function generateBill() {
  if (!cart.length) { toast('Cart is empty!', 'error'); return; }
  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const disc = Math.min(+document.getElementById('discountInput').value || 0, 100);
  const afterDisc = sub * (1 - disc / 100);
  const gst = afterDisc * 0.18;
  const total = afterDisc + gst;
  const bill = {
    id: nextBillNo(),
    date: new Date().toISOString(),
    customer: document.getElementById('customerName').value || 'Walk-in',
    items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
    subtotal: sub, discount: disc, gst, total,
    payment: document.getElementById('payMode').value
  };
  if (bill.payment === 'UPI') {
    _pendingBill = bill;
    showUPIModal(total);
    return;
  }
  finaliseBill(bill);
}

// shows the QR code popup for UPI payment
function showUPIModal(total) {
  document.getElementById('upiAmount').textContent = '₹' + total.toFixed(2);
  const upiStr = `upi://pay?pa=freshmart@paytm&pn=Fresh%20Mart&am=${total.toFixed(2)}&cu=INR&tn=Bill%20${_pendingBill.id}`;
  new QRious({
    element: document.getElementById('upiQR'),
    value: upiStr,
    size: 200,
    backgroundAlpha: 1,
    background: '#ffffff',
    foreground: '#1a1a2e',
    level: 'H'
  });
  const st = document.getElementById('upiStatus');
  st.className = 'upi-status';
  st.innerHTML = '<span class="upi-spinner"></span> Waiting for payment…';
  openModal('upiModal');
}

function cancelUPI() {
  _pendingBill = null;
  closeModal('upiModal');
}

function confirmUPI() {
  if (!_pendingBill) return;
  const st = document.getElementById('upiStatus');
  st.className = 'upi-status paid';
  st.innerHTML = '✅ Payment received!';
  setTimeout(() => {
    closeModal('upiModal');
    finaliseBill(_pendingBill);
    _pendingBill = null;
  }, 900);
}

function finaliseBill(bill) {
  cart.forEach(c => {
    const p = products.find(x => x.id === c.id);
    if (p) p.stock = Math.max(0, p.stock - c.qty);
  });
  bills.push(bill);
  save();
  showReceipt(bill);
  clearCart();
  document.getElementById('customerName').value = '';
  toast('Bill generated! ' + bill.id, 'success');
}

function showReceipt(bill) {
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt">
      <div class="receipt-shop">
        <h3>🛒 Fresh Mart</h3>
        <div style="font-size:12px;color:#888">GST No: 27AABCU9603R1ZX</div>
        <div style="font-size:12px;color:#888">${new Date(bill.date).toLocaleString('en-IN')}</div>
      </div>
      <hr class="receipt-divider"/>
      <div class="receipt-row"><span>Bill #</span><strong>${bill.id}</strong></div>
      <div class="receipt-row"><span>Customer</span><span>${bill.customer}</span></div>
      <div class="receipt-row"><span>Payment</span><span>${bill.payment}</span></div>
      <hr class="receipt-divider"/>
      <div class="receipt-items">
        ${bill.items.map(i => `<div class="receipt-row"><span>${i.name} × ${i.qty}</span><span>₹${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
      </div>
      <hr class="receipt-divider"/>
      <div class="receipt-row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
      ${bill.discount ? `<div class="receipt-row"><span>Discount (${bill.discount}%)</span><span>−₹${(bill.subtotal * bill.discount / 100).toFixed(2)}</span></div>` : ''}
      <div class="receipt-row"><span>GST (18%)</span><span>₹${bill.gst.toFixed(2)}</span></div>
      <div class="receipt-row receipt-total-row"><span>TOTAL</span><span>₹${bill.total.toFixed(2)}</span></div>
      <hr class="receipt-divider"/>
      <div style="text-align:center;font-size:12px;margin-top:8px">Thank you for shopping! Visit again 🙏</div>
    </div>`;
  openModal('receiptModal');
}

function printReceipt() {
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write('<html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px;font-size:13px;}.receipt-row{display:flex;justify-content:space-between;}.receipt-total-row{font-weight:bold;font-size:15px;border-top:1px dashed #ccc;padding-top:6px;margin-top:4px;}hr{border:none;border-top:1px dashed #ccc;margin:8px 0;}</style></head><body>' + document.getElementById('receiptContent').innerHTML + '</body></html>');
  w.document.close(); w.print(); w.close();
}

// supplier management stuff
function renderSuppliers() {
  document.getElementById('supplierBody').innerHTML = suppliers.length ? suppliers.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.contact}</td>
      <td>${s.email || '—'}</td>
      <td>${s.products || '—'}</td>
      <td style="color:${s.balance > 0 ? 'var(--warning)' : 'var(--success)'}">₹${s.balance}</td>
      <td><button class="btn-outline btn-sm" style="color:var(--danger)" onclick="deleteSupplier('${s.id}')">🗑️</button></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🚚</div>No suppliers added</div></td></tr>';
}

function saveSupplier(e) {
  e.preventDefault();
  suppliers.push({ id: 's' + Date.now(), name: document.getElementById('sName').value, contact: document.getElementById('sContact').value, email: document.getElementById('sEmail').value, products: document.getElementById('sProducts').value, balance: +document.getElementById('sBalance').value || 0 });
  save(); closeModal('addSupplierModal'); document.getElementById('supplierForm').reset();
  renderSuppliers(); toast('Supplier added!', 'success');
}

function deleteSupplier(id) {
  if (!confirm('Delete supplier?')) return;
  suppliers = suppliers.filter(s => s.id !== id);
  save(); renderSuppliers(); toast('Supplier deleted', 'warn');
}

// stock report - shows inventory status with chart
function renderStockReport() {
  const total = products.length;
  const instock = products.filter(p => p.stock > p.threshold).length;
  const low = products.filter(p => p.stock > 0 && p.stock <= p.threshold).length;
  const out = products.filter(p => p.stock === 0).length;
  document.getElementById('sr-total').textContent = total;
  document.getElementById('sr-instock').textContent = instock;
  document.getElementById('sr-low').textContent = low;
  document.getElementById('sr-out').textContent = out;
  const ctx = document.getElementById('stockBarChart').getContext('2d');
  if (charts.stockBar) charts.stockBar.destroy();
  const top = [...products].sort((a, b) => b.stock - a.stock).slice(0, 12);
  charts.stockBar = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(p => p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name), datasets: [{ label: 'Stock', data: top.map(p => p.stock), backgroundColor: top.map(p => p.stock === 0 ? '#ef444480' : p.stock <= p.threshold ? '#f59e0b80' : '#10b98180'), borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b92b8', maxRotation: 45 }, grid: { display: false } }, y: { ticks: { color: '#8b92b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });
  document.getElementById('stockReportBody').innerHTML = products.map(p => {
    const s = p.stock === 0 ? '<span class="badge badge-danger">Out of Stock</span>' : p.stock <= p.threshold ? '<span class="badge badge-warning">Low Stock</span>' : '<span class="badge badge-success">In Stock</span>';
    return `<tr><td><strong>${p.name}</strong></td><td>${p.category}</td><td>${p.stock}</td><td>${p.unit}</td><td>${s}</td></tr>`;
  }).join('');
}

// sales report with filtering by period
function renderSalesReport() {
  const period = document.getElementById('salesPeriod').value;
  const now = new Date();
  const filtered = bills.filter(b => {
    const d = new Date(b.date);
    if (period === 'daily') return d.toDateString() === now.toDateString();
    if (period === 'weekly') { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
    if (period === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });
  const revenue = filtered.reduce((s, b) => s + b.total, 0);
  const items = filtered.reduce((s, b) => s + b.items.reduce((a, i) => a + i.qty, 0), 0);
  document.getElementById('sl-revenue').textContent = '₹' + revenue.toFixed(2);
  document.getElementById('sl-bills').textContent = filtered.length;
  document.getElementById('sl-items').textContent = items;
  document.getElementById('sl-avg').textContent = filtered.length ? '₹' + (revenue / filtered.length).toFixed(2) : '₹0';

  // building the trend chart data
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : 7;
  const labels = [], data = [];
  for (let i = Math.min(days, 7) - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
    const ds = d.toDateString();
    data.push(filtered.filter(b => new Date(b.date).toDateString() === ds).reduce((s, b) => s + b.total, 0));
  }
  const ctx1 = document.getElementById('salesTrendChart').getContext('2d');
  if (charts.salesTrend) charts.salesTrend.destroy();
  charts.salesTrend = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Sales (₹)', data, backgroundColor: '#6366f180', borderColor: '#6366f1', borderWidth: 2, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b92b8' }, grid: { display: false } }, y: { ticks: { color: '#8b92b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });

  // top selling products chart
  const prodSales = {};
  filtered.forEach(b => b.items.forEach(i => { prodSales[i.name] = (prodSales[i.name] || 0) + i.qty; }));
  const top5 = Object.entries(prodSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ctx2 = document.getElementById('topProductsChart').getContext('2d');
  if (charts.topProd) charts.topProd.destroy();
  charts.topProd = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: top5.map(x => x[0].length > 12 ? x[0].slice(0, 12) + '…' : x[0]), datasets: [{ data: top5.map(x => x[1]), backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }] },
    options: { plugins: { legend: { labels: { color: '#8b92b8', boxWidth: 12 } } }, cutout: '60%' }
  });

  document.getElementById('salesTableBody').innerHTML = [...filtered].reverse().map(b => `
    <tr><td>${b.id}</td><td>${new Date(b.date).toLocaleString('en-IN')}</td><td>${b.customer}</td>
    <td>${b.items.reduce((s, i) => s + i.qty, 0)}</td><td>₹${b.total.toFixed(2)}</td><td>${b.payment}</td></tr>`).join('') ||
    '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📊</div>No sales in this period</div></td></tr>';
}

// account/profit report
function renderAccountReport() {
  const revenue = bills.reduce((s, b) => s + b.total, 0);
  const cost = bills.reduce((s, b) => s + b.items.reduce((a, i) => {
    const p = products.find(x => x.name === i.name); return a + (p ? p.cost : 0) * i.qty;
  }, 0), 0);
  const profit = revenue - cost;
  const margin = revenue ? (profit / revenue * 100) : 0;
  document.getElementById('ac-revenue').textContent = '₹' + revenue.toFixed(2);
  document.getElementById('ac-cost').textContent = '₹' + cost.toFixed(2);
  document.getElementById('ac-profit').textContent = '₹' + profit.toFixed(2);
  document.getElementById('ac-margin').textContent = margin.toFixed(1) + '%';

  const ctx = document.getElementById('profitChart').getContext('2d');
  if (charts.profit) charts.profit.destroy();
  charts.profit = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Revenue', 'Cost of Goods', 'Gross Profit'], datasets: [{ data: [revenue, cost, profit], backgroundColor: ['#6366f180', '#ef444480', '#10b98180'], borderColor: ['#6366f1', '#ef4444', '#10b981'], borderWidth: 2, borderRadius: 8 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b92b8' }, grid: { display: false } }, y: { ticks: { color: '#8b92b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });

  const payModes = {};
  bills.forEach(b => { if (!payModes[b.payment]) payModes[b.payment] = { count: 0, total: 0 }; payModes[b.payment].count++; payModes[b.payment].total += b.total; });
  document.getElementById('payModeBody').innerHTML = Object.entries(payModes).map(([k, v]) => `
    <tr><td>${k}</td><td>${v.count}</td><td>₹${v.total.toFixed(2)}</td></tr>`).join('') ||
    '<tr><td colspan="3"><div class="empty-state">No data yet</div></td></tr>';
}

// expiry tracking
function renderExpiry() {
  const days = document.getElementById('expiryFilter').value;
  const now = Date.now();
  const filtered = products.filter(p => {
    if (!p.expiry) return false;
    const diff = (new Date(p.expiry) - now) / 86400000;
    return days === 'all' ? true : diff <= +days;
  }).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

  document.getElementById('expiryList').innerHTML = filtered.length ? filtered.map(p => {
    const diff = Math.ceil((new Date(p.expiry) - now) / 86400000);
    const cls = diff < 0 ? 'critical' : diff <= 7 ? 'critical' : diff <= 15 ? 'warning' : 'ok';
    const label = diff < 0 ? `Expired ${Math.abs(diff)} days ago` : diff === 0 ? 'Expires TODAY' : `Expires in ${diff} days`;
    return `<div class="expiry-card ${cls}">
      <div class="expiry-name">${p.name}</div>
      <div class="expiry-date">📅 ${new Date(p.expiry).toLocaleDateString('en-IN')}</div>
      <div class="expiry-stock">📦 Stock: ${p.stock} ${p.unit}</div>
      <div class="expiry-days" style="color:${cls === 'critical' ? 'var(--danger)' : cls === 'warning' ? 'var(--warning)' : 'var(--success)'}">${label}</div>
    </div>`;
  }).join('') : '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">✅</div>No expiry alerts for this period</div>';
}

// topbar search functionality
function globalSearchFn(q) {
  const res = document.getElementById('searchResults');
  if (!q) { res.classList.remove('open'); return; }
  const found = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  if (!found.length) { res.classList.remove('open'); return; }
  res.innerHTML = found.slice(0, 6).map(p => `
    <div class="search-result-item" onclick="navigate('inventory');document.getElementById('invSearch').value='${p.name}';filterInventory();document.getElementById('globalSearch').value='';document.getElementById('searchResults').classList.remove('open')">
      <span>${p.name}</span><span style="color:var(--text-muted);font-size:11px">${p.stock} ${p.unit}</span>
    </div>`).join('');
  res.classList.add('open');
}

function showNotifications() {
  const low = products.filter(p => p.stock <= p.threshold && p.stock > 0);
  const exp = products.filter(p => { if (!p.expiry) return false; return (new Date(p.expiry) - Date.now()) / 86400000 <= 7; });
  let msg = '';
  if (low.length) msg += `⚠️ ${low.length} low stock item(s)\n`;
  if (exp.length) msg += `⏳ ${exp.length} item(s) expiring within 7 days`;
  alert(msg || '✅ All good! No alerts.');
}

function printSection(id) {
  const content = document.getElementById(id).innerHTML;
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Report</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f5f5f5;}</style></head><body>' + content + '</body></html>');
  w.document.close(); w.print(); w.close();
}

// close modals when clicking outside
document.getElementById('addProductModal').addEventListener('click', function (e) { if (e.target === this) closeModal('addProductModal'); });
document.getElementById('addSupplierModal').addEventListener('click', function (e) { if (e.target === this) closeModal('addSupplierModal'); });
document.getElementById('receiptModal').addEventListener('click', function (e) { if (e.target === this) closeModal('receiptModal'); });
document.getElementById('qrLabelsModal').addEventListener('click', function (e) { if (e.target === this) closeModal('qrLabelsModal'); });

// reset form when opening add product modal
document.querySelector('[onclick="openModal(\'addProductModal\')"]').addEventListener('click', function () {
  editingProductId = null;
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('productForm').reset();
});

// QR scanner using html5-qrcode library (found on github)
var _scanner = null;
var _scannerActive = false;

function toggleScanner() {
  _scannerActive ? stopScanner() : startScanner();
}

function startScanner() {
  const wrap = document.getElementById('qrScannerWrap');
  const btn = document.getElementById('scanBtn');
  wrap.style.display = 'block';
  btn.classList.add('active');
  btn.textContent = '⏹ Stop Scan';
  _scannerActive = true;

  _scanner = new Html5Qrcode('qrScannerView');
  _scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onQRScanSuccess,
    () => { }
  ).catch(err => {
    toast('Camera access denied: ' + err, 'error');
    stopScanner();
  });
}

function stopScanner() {
  const wrap = document.getElementById('qrScannerWrap');
  const btn = document.getElementById('scanBtn');
  wrap.style.display = 'none';
  btn.classList.remove('active');
  btn.textContent = '📷 Scan QR';
  _scannerActive = false;
  if (_scanner) {
    _scanner.stop().catch(() => { });
    _scanner = null;
  }
}

// when scanner reads a QR code, find the product and add to cart
function onQRScanSuccess(text) {
  let p = products.find(x => x.barcode && x.barcode === text);
  if (!p) p = products.find(x => x.id === text);
  if (!p) {
    p = products.find(x => x.barcode && x.barcode.toLowerCase() === text.toLowerCase());
  }
  if (p) {
    addToCart(p.id);

    toast('✅ Scanned: ' + p.name, 'success');
    // small delay so it doesnt scan the same thing twice
    if (_scanner) {
      _scanner.pause();
      setTimeout(() => { if (_scanner) _scanner.resume(); }, 1500);
    }
  } else {
    toast('❌ Product not found for QR: ' + text, 'error');
  }
}

// QR label printing for products
function openQRLabels() {
  openModal('qrLabelsModal');
  renderQRLabels(products);
}

function renderQRLabels(list) {
  const grid = document.getElementById('qrLabelsGrid');
  grid.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'qr-label-card';
    // prefer barcode for QR value, fallback to product id
    const qrValue = p.barcode || p.id;
    const canvas = document.createElement('canvas');
    canvas.className = 'qr-label-canvas';
    card.innerHTML = `
      <div class="qr-label-name">${p.name}</div>
      <div class="qr-label-price">₹${p.price}</div>
      <div class="qr-label-sku">${qrValue}</div>`;
    card.insertBefore(canvas, card.firstChild);
    grid.appendChild(card);
    new QRious({
      element: canvas,
      value: qrValue,
      size: 140,
      background: '#ffffff',
      foreground: '#0f0f1a',
      level: 'H'
    });
  });
}

function filterQRLabels() {
  const q = document.getElementById('qrLabelSearch').value.toLowerCase();
  const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)) : products;
  renderQRLabels(filtered);
}

function printQRLabels() {
  const grid = document.getElementById('qrLabelsGrid');
  // need to convert canvas to images for the print popup
  const cards = [...grid.querySelectorAll('.qr-label-card')];
  const rows = cards.map(card => {
    const canvas = card.querySelector('canvas');
    const img = canvas ? canvas.toDataURL() : '';
    const name = card.querySelector('.qr-label-name').textContent;
    const price = card.querySelector('.qr-label-price').textContent;
    const sku = card.querySelector('.qr-label-sku').textContent;
    return `<div class="label"><img src="${img}"/><div class="lname">${name}</div><div class="lprice">${price}</div><div class="lsku">${sku}</div></div>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR Labels</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:12px;background:#fff;}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
    .label{border:1px solid #ccc;border-radius:8px;padding:10px;text-align:center;page-break-inside:avoid;}
    .label img{width:120px;height:120px;}
    .lname{font-size:11px;font-weight:600;margin-top:4px;}
    .lprice{font-size:13px;font-weight:700;color:#333;}
    .lsku{font-size:9px;color:#888;font-family:monospace;}
    @media print{.label{break-inside:avoid;}}
  </style></head><body><div class="grid">${rows}</div></body></html>`);
  w.document.close();
  w.print();
  w.close();
}
// dark/light theme toggle - saves preference
var _theme = localStorage.getItem('erp_theme') || 'dark';

function applyTheme(t) {
  _theme = t;
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('erp_theme', t);
}

function toggleTheme() {
  applyTheme(_theme === 'dark' ? 'light' : 'dark');
}

// export reports as Excel files using SheetJS library
function exportToExcel(type) {
  if (typeof XLSX === 'undefined') {
    toast('Excel library still loading, try again…', 'warn');
    return;
  }
  let wb, ws, filename;

  if (type === 'stock') {
    const rows = products.map(p => ({
      'Product': p.name,
      'Category': p.category,
      'Selling Price (₹)': p.price,
      'Cost Price (₹)': p.cost,
      'Stock Qty': p.stock,
      'Unit': p.unit,
      'Threshold': p.threshold,
      'Expiry': p.expiry || 'N/A',
      'Status': p.stock === 0 ? 'Out of Stock' : p.stock <= p.threshold ? 'Low Stock' : 'In Stock'
    }));
    ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    filename = 'Stock_Report.xlsx';

  } else if (type === 'sales') {
    const rows = bills.map(b => ({
      'Bill #': b.id,
      'Date': new Date(b.date).toLocaleString('en-IN'),
      'Customer': b.customer,
      'Items': b.items.map(i => `${i.name} × ${i.qty}`).join(', '),
      'Subtotal (₹)': +b.subtotal.toFixed(2),
      'Discount (%)': b.discount,
      'GST (₹)': +b.gst.toFixed(2),
      'Total (₹)': +b.total.toFixed(2),
      'Payment Mode': b.payment
    }));
    ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    filename = 'Sales_Report.xlsx';

  } else if (type === 'account') {
    // first sheet: overall summary
    const rev = bills.reduce((s, b) => s + b.total, 0);
    const cost = bills.reduce((s, b) => s + b.items.reduce((a, i) => {
      const p = products.find(x => x.name === i.name);
      return a + (p ? p.cost : 0) * i.qty;
    }, 0), 0);
    const profit = rev - cost;
    const summary = [
      { 'Metric': 'Total Revenue', 'Value (₹)': +rev.toFixed(2) },
      { 'Metric': 'Cost of Goods Sold', 'Value (₹)': +cost.toFixed(2) },
      { 'Metric': 'Gross Profit', 'Value (₹)': +profit.toFixed(2) },
      { 'Metric': 'Profit Margin (%)', 'Value (₹)': rev ? +(profit / rev * 100).toFixed(2) : 0 }
    ];
    const ws1 = XLSX.utils.json_to_sheet(summary);
    ws1['!cols'] = [{ wch: 22 }, { wch: 14 }];

    // second sheet: payment mode wise data
    const payModes = {};
    bills.forEach(b => {
      if (!payModes[b.payment]) payModes[b.payment] = { Transactions: 0, 'Total (₹)': 0 };
      payModes[b.payment].Transactions++;
      payModes[b.payment]['Total (₹)'] = +(payModes[b.payment]['Total (₹)'] + b.total).toFixed(2);
    });
    const ws2 = XLSX.utils.json_to_sheet(
      Object.entries(payModes).map(([k, v]) => ({ 'Payment Mode': k, ...v }))
    );
    ws2['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }];

    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Payment Modes');
    XLSX.writeFile(wb, 'Account_Report.xlsx');
    toast('Account report exported! 📥', 'success');
    return;
  }

  wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type.charAt(0).toUpperCase() + type.slice(1));
  XLSX.writeFile(wb, filename);
  toast(type.charAt(0).toUpperCase() + type.slice(1) + ' report exported! 📥', 'success');
}

// start the app
seedData();
applyTheme(_theme);
document.getElementById('todayDate') && (document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
navigate('dashboard');
