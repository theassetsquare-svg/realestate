// Category filter
document.addEventListener('DOMContentLoaded', function() {
  var buttons = document.querySelectorAll('.cat-btn');
  var cards = document.querySelectorAll('.property-card');

  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cat = this.getAttribute('data-cat');

      buttons.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');

      cards.forEach(function(card) {
        if (cat === 'all' || card.getAttribute('data-cat') === cat) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
});
