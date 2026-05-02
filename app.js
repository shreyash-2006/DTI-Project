/*
    app.js - Main application logic
    Handles: data storage, navigation, dashboard, inventory CRUD
    Using localStorage for now since we dont have a backend
*/

// loading data from localStorage (or empty arrays if first time)
var products = JSON.parse(localStorage.getItem('erp_products') || '[]');
var bills = JSON.parse(localStorage.getItem('erp_bills') || '[]');
var suppliers = JSON.parse(localStorage.getItem('erp_suppliers') || '[]');
var cart = [];
var editingProductId = null;
var charts = {}; // storing chart instances so we can destroy and recreate them

// save everything to localStorage
function save() {
  localStorage.setItem('erp_products', JSON.stringify(products));
  localStorage.setItem('erp_bills', JSON.stringify(bills));
  localStorage.setItem('erp_suppliers', JSON.stringify(suppliers));
}

// fill in some sample data on first load so the app doesn't look empty
function seedData() {
  if (products.length) return; // already has data, skip

  products = [
    { id: 'p1', name: 'Amul Butter 100g', category: 'Dairy', price: 55, cost: 42, stock: 30, unit: 'pcs', threshold: 5, expiry: '2025-07-15', barcode: 'AMB100' },
    { id: 'p2', name: 'Tata Salt 1kg', category: 'Grains & Pulses', price: 24, cost: 18, stock: 50, unit: 'kg', threshold: 10, expiry: '2026-12-01', barcode: 'TTS1KG' },
    { id: 'p3', name: 'Parle-G Biscuits', category: 'Snacks', price: 10, cost: 7, stock: 4, unit: 'pack', threshold: 5, expiry: '2025-09-20', barcode: 'PRLG' },
    { id: 'p4', name: 'Maggi Noodles 70g', category: 'Snacks', price: 14, cost: 10, stock: 60, unit: 'pcs', threshold: 10, expiry: '2025-11-30', barcode: 'MGGI70' },
    { id: 'p5', name: 'Aashirvaad Atta 5kg', category: 'Grains & Pulses', price: 250, cost: 200, stock: 3, unit: 'kg', threshold: 5, expiry: '2026-03-15', barcode: 'AATA5K' },
    { id: 'p6', name: 'Colgate Toothpaste', category: 'Personal Care', price: 99, cost: 70, stock: 20, unit: 'pcs', threshold: 5, expiry: '2027-01-01', barcode: 'CLG100' },
    { id: 'p7', name: 'Surf Excel 1kg', category: 'Household', price: 180, cost: 140, stock: 15, unit: 'kg', threshold: 5, expiry: '2028-01-01', barcode: 'SRFX1K' },
    { id: 'p8', name: 'Mother Dairy Milk 500ml', category: 'Dairy', price: 28, cost: 22, stock: 0, unit: 'mL', threshold: 5, expiry: '2025-05-10', barcode: 'MDM500' },
    { id: 'p9', name: 'Real Mango Juice 1L', category: 'Beverages', price: 120, cost: 90, stock: 18, unit: 'L', threshold: 5, expiry: '2025-08-01', barcode: 'RMJ1L' },
    { id: 'p10', name: 'Lay\'s Classic Chips', category: 'Snacks', price: 20, cost: 14, stock: 40, unit: 'pcs', threshold: 10, expiry: '2025-10-15', barcode: 'LAYS26' }
  ];

  suppliers = [
    { id: 's1', name: 'Fresh Dairy Co.', contact: '9876543210', email: 'dairy@fresh.com', products: 'Dairy', balance: 5000 },
    { id: 's2', name: 'Agro Traders', contact: '9988776655', email: 'agro@traders.com', products: 'Grains & Pulses', balance: 12000 }
  ];

  // some dummy bills for today and past few days
  bills = [
    { id: 'B001', date: new Date(Date.now() - 86400000 * 0).toISOString(), customer: 'Walk-in', items: [{ name: 'Amul Butter 100g', qty: 2, price: 55 }, { name: 'Tata Salt 1kg', qty: 1, price: 24 }], subtotal: 134, discount: 0, gst: 24.12, total: 158.12, payment: 'Cash' },
    { id: 'B002', date: new Date(Date.now() - 86400000 * 0).toISOString(), customer: 'Rahul', items: [{ name: 'Parle-G Biscuits', qty: 5, price: 10 }, { name: 'Maggi Noodles 70g', qty: 3, price: 14 }], subtotal: 92, discount: 5, gst: 15.64, total: 107.64, payment: 'UPI' },
    { id: 'B003', date: new Date(Date.now() - 86400000 * 1).toISOString(), customer: 'Priya', items: [{ name: 'Surf Excel 1kg', qty: 1, price: 180 }], subtotal: 180, discount: 0, gst: 32.4, total: 212.4, payment: 'Card' },
    { id: 'B004', date: new Date(Date.now() - 86400000 * 2).toISOString(), customer: 'Walk-in', items: [{ name: 'Real Mango Juice 1L', qty: 2, price: 120 }], subtotal: 240, discount: 10, gst: 38.88, total: 278.88, payment: 'Cash' },
    { id: 'B005', date: new Date(Date.now() - 86400000 * 3).toISOString(), customer: 'Amit', items: [{ name: 'Aashirvaad Atta 5kg', qty: 1, price: 250 }], subtotal: 250, discount: 0, gst: 45, total: 295, payment: 'UPI' }
  ];
  save();
}


// --- page navigation ---
// this handles switching between different pages/sections
function navigate(page) {
  // hide all pages first, then show the selected one
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector('[data-page="' + page + '"]').classList.add('active');

  // update title in topbar
  var titles = {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    billing: 'Billing / POS',
    suppliers: 'Suppliers',
    'stock-report': 'Stock Report',
    'sales-report': 'Sales Report',
    'account-report': 'Account Report',
    expiry: 'Expiry Alerts'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // render the page content
  if (page === 'dashboard') renderDashboard();
  else if (page === 'inventory') renderInventory();
  else if (page === 'billing') renderPOS();
  else if (page === 'suppliers') renderSuppliers();
  else if (page === 'stock-report') renderStockReport();
  else if (page === 'sales-report') renderSalesReport();
  else if (page === 'account-report') renderAccountReport();
  else if (page === 'expiry') renderExpiry();

  // close sidebar on mobile after navigating
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// simple toast notification - shows a message at bottom right
function toast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(function () { t.className = 'toast'; }, 2800);
}

// modal helpers
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// generate next bill number like B001, B002 etc.
function nextBillNo() {
  var n = bills.length + 1;
  return 'B' + String(n).padStart(3, '0');
}


// --- Dashboard ---
function renderDashboard() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  var today = new Date().toDateString();

  // calculate today's total sales
  var todaySales = 0;
  for (var i = 0; i < bills.length; i++) {
    if (new Date(bills[i].date).toDateString() === today) {
      todaySales += bills[i].total;
    }
  }

  // find items with low stock
  var lowStock = products.filter(function (p) {
    return p.stock <= p.threshold && p.stock > 0;
  });

  // items expiring within 30 days
  var expiring = products.filter(function (p) {
    if (!p.expiry) return false;
    var daysLeft = (new Date(p.expiry) - Date.now()) / 86400000; // convert ms to days
    return daysLeft >= 0 && daysLeft <= 30;
  });

  // update the KPI cards
  document.getElementById('kpi-sales').textContent = '₹' + todaySales.toFixed(2);
  document.getElementById('kpi-products').textContent = products.length;
  document.getElementById('kpi-lowstock').textContent = lowStock.length;
  document.getElementById('kpi-expiry').textContent = expiring.length;
  document.getElementById('notifBadge').textContent = lowStock.length + expiring.length;

  // recent bills - show last 5
  var rbl = document.getElementById('recentBillsList');
  var recent = bills.slice().reverse().slice(0, 5);
  if (recent.length) {
    rbl.innerHTML = recent.map(function (b) {
      return '<div class="recent-item">' +
        '<div><div class="recent-item-name">' + b.id + ' – ' + b.customer + '</div>' +
        '<div class="recent-item-sub">' + new Date(b.date).toLocaleString('en-IN') + '</div></div>' +
        '<span class="badge badge-success">₹' + b.total.toFixed(2) + '</span></div>';
    }).join('');
  } else {
    rbl.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div>No bills yet</div>';
  }

  // low stock list
  var lsl = document.getElementById('lowStockList');
  if (lowStock.length) {
    lsl.innerHTML = lowStock.map(function (p) {
      var badgeClass = p.stock === 0 ? 'badge-danger' : 'badge-warning';
      return '<div class="recent-item">' +
        '<div><div class="recent-item-name">' + p.name + '</div>' +
        '<div class="recent-item-sub">' + p.category + '</div></div>' +
        '<span class="badge ' + badgeClass + '">' + p.stock + ' ' + p.unit + '</span></div>';
    }).join('');
  } else {
    lsl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>All items well stocked!</div>';
  }

  renderWeeklyChart();
  renderCategoryChart();
}

// weekly sales line chart
function renderWeeklyChart() {
  var labels = [];
  var data = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
    var dateStr = d.toDateString();
    // sum up all bills for that day
    var dayTotal = 0;
    bills.forEach(function (b) {
      if (new Date(b.date).toDateString() === dateStr) dayTotal += b.total;
    });
    data.push(dayTotal);
  }

  var ctx = document.getElementById('weeklySalesChart').getContext('2d');
  if (charts.weekly) charts.weekly.destroy();
  charts.weekly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sales (₹)',
        data: data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointRadius: 5
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b92b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8b92b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// doughnut chart for stock by category
function renderCategoryChart() {
  var cats = {};
  products.forEach(function (p) {
    cats[p.category] = (cats[p.category] || 0) + p.stock;
  });

  var ctx = document.getElementById('categoryChart').getContext('2d');
  if (charts.cat) charts.cat.destroy();
  charts.cat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(cats),
      datasets: [{
        data: Object.values(cats),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6']
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#8b92b8', boxWidth: 12 } } },
      cutout: '65%'
    }
  });
}


// --- Inventory management ---

function renderInventory() {
  // populate category filter dropdown
  var cats = [];
  products.forEach(function (p) {
    if (cats.indexOf(p.category) === -1) cats.push(p.category);
  });
  var sel = document.getElementById('invCategory');
  var curVal = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>';
  cats.forEach(function (c) {
    sel.innerHTML += '<option ' + (c === curVal ? 'selected' : '') + '>' + c + '</option>';
  });
  filterInventory();
}

function filterInventory() {
  var searchQuery = document.getElementById('invSearch').value.toLowerCase();
  var catFilter = document.getElementById('invCategory').value;
  var stockFilter = document.getElementById('invStock').value;

  var filtered = products.filter(function (p) {
    // search by name, category or barcode
    var matchSearch = p.name.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery) ||
      (p.barcode || '').toLowerCase().includes(searchQuery);
    var matchCat = !catFilter || p.category === catFilter;
    var matchStock = !stockFilter || (stockFilter === 'low' ? p.stock <= p.threshold : p.stock > p.threshold);
    return matchSearch && matchCat && matchStock;
  });

  var tbody = document.getElementById('inventoryBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div>No products found</div></td></tr>';
    return;
  }

  var html = '';
  filtered.forEach(function (p) {
    var isLow = p.stock <= p.threshold && p.stock > 0;
    var isOut = p.stock === 0;
    var badge;
    if (isOut) badge = '<span class="badge badge-danger">Out</span>';
    else if (isLow) badge = '<span class="badge badge-warning">Low</span>';
    else badge = '<span class="badge badge-success">OK</span>';

    html += '<tr>' +
      '<td><strong>' + p.name + '</strong><br/><small style="color:var(--text-muted)">' + (p.barcode || '') + '</small></td>' +
      '<td>' + p.category + '</td>' +
      '<td>₹' + p.price + '</td>' +
      '<td>₹' + p.cost + '</td>' +
      '<td>' + badge + ' ' + p.stock + '</td>' +
      '<td>' + p.unit + '</td>' +
      '<td>' + (p.expiry ? new Date(p.expiry).toLocaleDateString('en-IN') : '—') + '</td>' +
      '<td style="display:flex;gap:6px">' +
      '<button class="btn-outline btn-sm" onclick="editProduct(\'' + p.id + '\')">✏️ Edit</button>' +
      '<button class="btn-outline btn-sm" style="color:var(--danger)" onclick="deleteProduct(\'' + p.id + '\')">🗑️</button>' +
      '</td></tr>';
  });
  tbody.innerHTML = html;
}

function saveProduct(e) {
  e.preventDefault();

  var productData = {
    id: editingProductId || 'p' + Date.now(),
    name: document.getElementById('pName').value,
    category: document.getElementById('pCategory').value,
    price: parseFloat(document.getElementById('pPrice').value),
    cost: parseFloat(document.getElementById('pCost').value),
    stock: parseInt(document.getElementById('pStock').value),
    unit: document.getElementById('pUnit').value,
    threshold: parseInt(document.getElementById('pThreshold').value) || 5,
    expiry: document.getElementById('pExpiry').value,
    barcode: document.getElementById('pBarcode').value
  };

  if (editingProductId) {
    // updating existing product
    var idx = products.findIndex(function (x) { return x.id === editingProductId; });
    products[idx] = productData;
    toast('Product updated!', 'success');
  } else {
    products.push(productData);
    toast('Product added!', 'success');
  }

  save();
  closeModal('addProductModal');
  document.getElementById('productForm').reset();
  editingProductId = null;
  filterInventory();
}

function editProduct(id) {
  var p = products.find(function (x) { return x.id === id; });
  if (!p) return;

  editingProductId = id;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pCost').value = p.cost;
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pUnit').value = p.unit;
  document.getElementById('pThreshold').value = p.threshold;
  document.getElementById('pExpiry').value = p.expiry || '';
  document.getElementById('pBarcode').value = p.barcode || '';
  openModal('addProductModal');
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  products = products.filter(function (p) { return p.id !== id; });
  save();
  filterInventory();
  toast('Product deleted', 'warn');
}
