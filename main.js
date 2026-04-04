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
      document.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });
      var allBtn = document.querySelector('.cat-btn[data-cat="all"]');
      if (allBtn) allBtn.classList.add('active');
    });
  }

  // ===== Interactive Checklist =====
  document.querySelectorAll('.check-item').forEach(function(item) {
    item.addEventListener('click', function() {
      this.classList.toggle('checked');
      var box = this.querySelector('.check-box');
      box.textContent = this.classList.contains('checked') ? '✓' : '';
      updateChecklistProgress();
    });
  });

  function updateChecklistProgress() {
    var total = document.querySelectorAll('.check-item').length;
    var checked = document.querySelectorAll('.check-item.checked').length;
    var progressText = document.querySelector('.checklist-progress');
    var progressFill = document.querySelector('.progress-fill');
    if (progressText && total > 0) {
      var pct = Math.round((checked / total) * 100);
      progressText.firstChild.textContent = checked + '/' + total + ' 완료 (' + pct + '%)';
      if (progressFill) progressFill.style.width = pct + '%';
      if (pct === 100) {
        progressText.firstChild.textContent = '모든 준비 완료! 분양 상담을 시작하세요';
      }
    }
  }

  // ===== Compare Feature (Homepage) =====
  var compareList = [];
  var MAX_COMPARE = 3;
  var compareTray = document.getElementById('compareTray');
  var compareModal = document.getElementById('compareModal');

  document.querySelectorAll('.compare-toggle').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var name = this.getAttribute('data-name');
      var href = this.getAttribute('data-href');
      var location = this.getAttribute('data-location');
      var cat = this.getAttribute('data-type');

      if (this.classList.contains('active')) {
        // Remove from compare
        compareList = compareList.filter(function(item) { return item.name !== name; });
        this.classList.remove('active');
        this.textContent = '⚖ 비교함에 담기';
      } else {
        if (compareList.length >= MAX_COMPARE) {
          alert('최대 ' + MAX_COMPARE + '개까지 비교할 수 있습니다.');
          return;
        }
        compareList.push({ name: name, href: href, location: location, cat: cat });
        this.classList.add('active');
        this.textContent = '✓ 비교함에 담김';
      }
      updateCompareTray();
    });
  });

  function updateCompareTray() {
    if (!compareTray) return;
    if (compareList.length === 0) {
      compareTray.classList.remove('show');
      return;
    }
    compareTray.classList.add('show');
    var slots = compareTray.querySelectorAll('.compare-tray-slot');
    slots.forEach(function(slot, i) {
      if (compareList[i]) {
        slot.classList.add('filled');
        slot.innerHTML = compareList[i].name + '<button class="remove-item" data-idx="' + i + '">✕</button>';
      } else {
        slot.classList.remove('filled');
        slot.innerHTML = '비어있음';
      }
    });
    // Bind remove buttons
    compareTray.querySelectorAll('.remove-item').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        var removed = compareList[idx];
        compareList.splice(idx, 1);
        // Deactivate the toggle button
        document.querySelectorAll('.compare-toggle').forEach(function(t) {
          if (t.getAttribute('data-name') === removed.name) {
            t.classList.remove('active');
            t.textContent = '⚖ 비교함에 담기';
          }
        });
        updateCompareTray();
      });
    });
    var compareBtn = compareTray.querySelector('.compare-tray-btn');
    if (compareBtn) {
      compareBtn.disabled = compareList.length < 2;
    }
  }

  // Close compare tray
  var trayClose = document.getElementById('compareTrayClose');
  if (trayClose) {
    trayClose.addEventListener('click', function() {
      compareTray.classList.remove('show');
    });
  }

  // Open compare modal
  var compareStartBtn = document.getElementById('compareStartBtn');
  if (compareStartBtn) {
    compareStartBtn.addEventListener('click', function() {
      if (compareList.length < 2) return;
      showCompareModal();
    });
  }

  function showCompareModal() {
    if (!compareModal) return;
    var tbody = compareModal.querySelector('.compare-modal-body');
    if (!tbody) return;
    // Build comparison table
    var headers = '<tr><th>항목</th>';
    compareList.forEach(function(item) {
      headers += '<th class="highlight">' + item.name + '</th>';
    });
    headers += '</tr>';

    var rows = [
      { label: '위치', key: 'location' },
      { label: '유형', key: 'cat' }
    ];
    var rowsHtml = '';
    rows.forEach(function(row) {
      rowsHtml += '<tr><td>' + row.label + '</td>';
      compareList.forEach(function(item) {
        rowsHtml += '<td>' + (item[row.key] || '-') + '</td>';
      });
      rowsHtml += '</tr>';
    });
    // Link row
    rowsHtml += '<tr><td>상세보기</td>';
    compareList.forEach(function(item) {
      rowsHtml += '<td><a href="' + item.href + '" style="color:#1a2b4a;font-weight:700;">상세 보기 →</a></td>';
    });
    rowsHtml += '</tr>';

    tbody.innerHTML = headers + rowsHtml;
    compareModal.classList.add('show');
  }

  // Close compare modal
  var modalClose = document.getElementById('compareModalClose');
  if (modalClose) {
    modalClose.addEventListener('click', function() {
      compareModal.classList.remove('show');
    });
  }
  if (compareModal) {
    compareModal.addEventListener('click', function(e) {
      if (e.target === compareModal) compareModal.classList.remove('show');
    });
  }
});
