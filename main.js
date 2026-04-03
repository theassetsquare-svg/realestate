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
