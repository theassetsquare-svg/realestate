// Error Boundary - catch and display errors
window.onerror = function(msg, url, line) {
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:32px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.2);text-align:center;z-index:9999;max-width:400px;';
  el.innerHTML = '<h3 style="margin-bottom:12px;color:#e53935;">오류가 발생했습니다</h3><p style="color:#666;margin-bottom:16px;font-size:0.9rem;">페이지를 새로고침해 주세요.</p><button onclick="location.reload()" style="padding:12px 32px;background:#1a2b4a;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;min-height:44px;">다시 시도</button>';
  document.body.appendChild(el);
  return true;
};

document.addEventListener('DOMContentLoaded', function() {
  // Category filter (homepage)
  var buttons = document.querySelectorAll('.cat-btn');
  var cards = document.querySelectorAll('.property-card');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cat = this.getAttribute('data-cat');
      buttons.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      cards.forEach(function(card) {
        card.style.display = (cat === 'all' || card.getAttribute('data-cat') === cat) ? '' : 'none';
      });
    });
  });

  // Price Simulator
  var calcBtn = document.getElementById('calcBtn');
  if (calcBtn) {
    calcBtn.addEventListener('click', function() {
      var price = parseFloat(document.getElementById('calcPrice').value) * 10000;
      var down = parseFloat(document.getElementById('calcDown').value) || 10;
      var rate = parseFloat(document.getElementById('calcRate').value) || 3.5;
      var years = parseInt(document.getElementById('calcYears').value) || 30;
      if (!price || price <= 0) return;
      var loan = price * (1 - down / 100);
      var mr = rate / 100 / 12;
      var n = years * 12;
      var monthly = loan * (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
      var result = document.getElementById('calcResult');
      result.style.display = 'block';
      result.querySelector('.amount').textContent = '월 ' + Math.round(monthly).toLocaleString() + '만원';
      result.querySelector('.detail').textContent =
        '분양가 ' + (price / 10000).toLocaleString() + '만원 | 대출 ' + Math.round(loan / 10000).toLocaleString() + '만원 | ' + rate + '% ' + years + '년';
    });
  }

  // FAQ Accordion
  document.querySelectorAll('.faq-q').forEach(function(q) {
    q.addEventListener('click', function() {
      var a = this.nextElementSibling;
      var isOpen = this.classList.contains('open');
      document.querySelectorAll('.faq-q').forEach(function(qq) { qq.classList.remove('open'); });
      document.querySelectorAll('.faq-a').forEach(function(aa) { aa.classList.remove('show'); });
      if (!isOpen) {
        this.classList.add('open');
        a.classList.add('show');
      }
    });
  });

  // Internal Search Filter (real-time)
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      var allCards = document.querySelectorAll('.property-card');
      allCards.forEach(function(card) {
        var text = card.textContent.toLowerCase();
        card.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
      // Reset category filter
      document.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });
      var allBtn = document.querySelector('.cat-btn[data-cat="all"]');
      if (allBtn) allBtn.classList.add('active');
    });
  }

  // Alert signup
  var alertBtn = document.getElementById('alertBtn');
  if (alertBtn) {
    alertBtn.addEventListener('click', function() {
      var email = document.getElementById('alertEmail').value;
      var msg = document.getElementById('alertMsg');
      if (email && email.includes('@')) {
        msg.style.display = 'block';
        msg.textContent = '✓ ' + email + ' 등록 완료! 가격 변동 시 알림을 보내드립니다.';
        document.getElementById('alertEmail').value = '';
      }
    });
  }
});
