document.addEventListener('DOMContentLoaded', () => {
  console.log('[Aarna Web] Editorial system initialized.');

  // Initialize Blueprint Grid lines reveal
  const lines = document.querySelectorAll('.blueprint-grid .line');
  lines.forEach((line, index) => {
    setTimeout(() => {
      line.style.opacity = '1';
    }, index * 100);
  });

  // Initialize smooth scroll reveal for sections
  const scrollElements = document.querySelectorAll('.reveal-on-scroll');
  const elementInView = (el, dividend = 1) => {
    const elementTop = el.getBoundingClientRect().top;
    return (
      elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend
    );
  };
  
  const displayScrollElement = (element) => {
    element.classList.add('scrolled');
  };
  
  const handleScrollAnimation = () => {
    scrollElements.forEach((el) => {
      if (elementInView(el, 1.15)) {
        displayScrollElement(el);
      }
    });
  };

  window.addEventListener('scroll', () => {
    handleScrollAnimation();
  });
  
  // Trigger initial reveal check
  setTimeout(handleScrollAnimation, 300);

  // Initialize mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const header = document.querySelector('header');
  if (menuToggle && header) {
    menuToggle.addEventListener('click', () => {
      header.classList.toggle('nav-active');
    });
  }

  // Initialize Showcase Carousel / Slider (index.html)
  initHeroSlider();

  // Initialize Property Portfolio Filters (portfolio.html)
  initPortfolioFilters();

  // Initialize Form Submissions (contact.html)
  initContactForm();
});

/**
 * Hero image slideshow/carousel logic for index.html
 */
function initHeroSlider() {
  const images = ['assets/hero_facade.png', 'assets/steel_beams.png', 'assets/light_shadow.png'];
  const heroImage = document.querySelector('.hero-image-block img');
  if (!heroImage) return;

  let currentIndex = 0;
  setInterval(() => {
    currentIndex = (currentIndex + 1) % images.length;
    // Elegant transition overlay effect
    heroImage.style.opacity = '0';
    setTimeout(() => {
      heroImage.src = images[currentIndex];
      heroImage.style.opacity = '1';
    }, 450);
  }, 6000);
}

/**
 * Filter properties portfolio by categories
 */
function initPortfolioFilters() {
  const tabs = document.querySelectorAll('.portfolio-tabs .tab-link');
  const items = document.querySelectorAll('.portfolio-grid .portfolio-item');
  if (tabs.length === 0 || items.length === 0) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filterValue = tab.getAttribute('data-filter');

      items.forEach(item => {
        const itemType = item.getAttribute('data-type');
        
        if (filterValue === 'all' || itemType === filterValue) {
          // Smooth fade in
          item.style.display = 'flex';
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          }, 50);
        } else {
          // Smooth fade out
          item.style.opacity = '0';
          item.style.transform = 'translateY(20px)';
          setTimeout(() => {
            item.style.display = 'none';
          }, 300);
        }
      });
    });
  });
}

/**
 * Mock inquiry form submission logic with clean alerts
 */
function initContactForm() {
  const form = document.querySelector('.editorial-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const city = document.getElementById('city')?.value || '';
    const budget = document.getElementById('budget')?.value || '';

    if (!name || !phone) {
      alert('Please fill in your Name and Contact Phone Number.');
      return;
    }

    // Success response
    const successMsg = `✨ INQUIRY SUBMITTED SUCCESSFULLY ✨\n\n` +
      `Thank you, ${name}.\n` +
      `Our premier consultant in ${city || 'Patna/Delhi'} has received your request.\n` +
      `We will contact you shortly on ${phone} regarding your budget plan of ${budget || 'Not specified'}.`;

    alert(successMsg);
    form.reset();
  });
}
