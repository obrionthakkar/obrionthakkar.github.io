// Modal API endpoints
const MODAL_LOOKUP_URL = 'https://devangthakkar--wedding-rsvp-lookup.modal.run';
const MODAL_SUBMIT_URL = 'https://devangthakkar--wedding-rsvp-submit-rsvp.modal.run';

// DOM Elements
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Store current party data
let currentPartyData = null;

// Mobile Navigation Toggle
navToggle.addEventListener('click', () => {
  navMenu.classList.toggle('active');
  navToggle.classList.toggle('active');
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('active');
    navToggle.classList.remove('active');
  });
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Navbar scroll behavior - show hamburger on mobile when navbar reaches top (sticky)
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const navToggle = document.getElementById('navToggle');
  if (!navToggle) return;
  
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  
  // Only on mobile
  if (window.innerWidth <= 768) {
    // Get the hero section to calculate when navbar reaches top
    const hero = document.getElementById('home');
    const navbar = document.getElementById('navbar');
    
    if (hero && navbar) {
      const heroHeight = hero.offsetHeight;
      const navbarRect = navbar.getBoundingClientRect();
      
      // Show hamburger only when navbar is actually at the top (sticky position)
      // This happens when we've scrolled past the hero section and navbar is at top: 0
      if (currentScroll >= heroHeight && navbarRect.top <= 0) {
        navToggle.classList.add('show');
      } else {
        navToggle.classList.remove('show');
      }
    }
  } else {
    // Desktop - always hide (it's hidden via CSS anyway)
    navToggle.classList.remove('show');
  }
  
  lastScrollTop = currentScroll;
});

// RSVP section removed - all RSVP-related code commented out
/*
// Name Lookup Form Handler
const lookupForm = document.getElementById('lookupForm');
if (lookupForm) {
  lookupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
  
  const guestName = document.getElementById('guestName').value.trim();
  if (!guestName) {
    showError('Please enter your name');
    return;
  }

  // Show loading state
  lookupForm.classList.add('loading');
  hideError();

  try {
    const response = await fetch(`${MODAL_LOOKUP_URL}?name=${encodeURIComponent(guestName)}`);
    const data = await response.json();

    if (data.error) {
      showError(data.error === 'party not found' 
        ? 'We couldn\'t find your invitation. Please check the spelling of your name.'
        : data.error);
      lookupForm.classList.remove('loading');
      return;
    }

    // Store party data
    currentPartyData = data;

    // Hide lookup form and show RSVP form
    rsvpLookup.style.display = 'none';
    rsvpFormContainer.style.display = 'block';
    rsvpSuccess.style.display = 'none';

    // Populate party info
    partyInfo.innerHTML = `<h3>${data.party.name}</h3>`;

    // Build RSVP form for each event
    buildRsvpForm(data.events);

    // Scroll to form
    rsvpFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (error) {
    console.error('Lookup error:', error);
    showError('Something went wrong. Please try again later.');
  } finally {
    lookupForm.classList.remove('loading');
  }
});

// Build RSVP Form
function buildRsvpForm(events) {
  eventsFormContainer.innerHTML = '';

  events.forEach(event => {
    const eventGroup = document.createElement('div');
    eventGroup.className = 'event-form-group';
    
    eventGroup.innerHTML = `
      <h4>${event.name}</h4>
      ${event.guests.map(guest => `
        <div class="guest-form-group">
          <label>${guest.name}</label>
          <select name="attending_${event.eventId}_${guest.guestId}" required>
            <option value="">Select...</option>
            <option value="true" ${guest.attending === true ? 'selected' : ''}>Attending</option>
            <option value="false" ${guest.attending === false ? 'selected' : ''}>Not Attending</option>
          </select>
          ${event.requiresMeal ? `
            <label style="margin-top: 1rem;">Meal Choice</label>
            <select name="meal_${event.eventId}_${guest.guestId}" ${guest.attending !== true ? 'disabled' : ''}>
              <option value="">Select meal...</option>
              <option value="Chicken" ${guest.meal === 'Chicken' ? 'selected' : ''}>Chicken</option>
              <option value="Veg" ${guest.meal === 'Veg' ? 'selected' : ''}>Vegetarian</option>
              <option value="Pork" ${guest.meal === 'Pork' ? 'selected' : ''}>Pork</option>
            </select>
          ` : ''}
        </div>
      `).join('')}
    `;

    // Enable/disable meal selection based on attending status
    eventGroup.querySelectorAll(`select[name^="attending_${event.eventId}"]`).forEach(select => {
      select.addEventListener('change', (e) => {
        const guestId = e.target.name.split('_')[2];
        const mealSelect = eventGroup.querySelector(`select[name="meal_${event.eventId}_${guestId}"]`);
        if (mealSelect) {
          mealSelect.disabled = e.target.value !== 'true';
          if (e.target.value !== 'true') {
            mealSelect.value = '';
          }
        }
      });
    });

    eventsFormContainer.appendChild(eventGroup);
  });
}

// RSVP Form Submit Handler
rsvpForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentPartyData) {
    showError('Please start over with a name lookup');
    return;
  }

  // Show loading state
  rsvpForm.classList.add('loading');
  hideError();

  try {
    const formData = new FormData(rsvpForm);
    const submissions = [];

    // Collect all RSVP submissions
    currentPartyData.events.forEach(event => {
      event.guests.forEach(guest => {
        const attendingSelect = rsvpForm.querySelector(`select[name="attending_${event.eventId}_${guest.guestId}"]`);
        const mealSelect = rsvpForm.querySelector(`select[name="meal_${event.eventId}_${guest.guestId}"]`);
        
        if (attendingSelect && attendingSelect.value !== '') {
          submissions.push({
            guestId: guest.guestId,
            eventId: event.eventId,
            attending: attendingSelect.value === 'true',
            meal_choice: mealSelect && mealSelect.value ? mealSelect.value : null
          });
        }
      });
    });

    if (submissions.length === 0) {
      showError('Please make at least one selection');
      rsvpForm.classList.remove('loading');
      return;
    }

    // Submit all RSVPs
    const promises = submissions.map(submission => 
      fetch(MODAL_SUBMIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submission)
      })
    );

    const results = await Promise.all(promises);
    const data = await Promise.all(results.map(r => r.json()));

    // Check for errors
    const errors = data.filter(r => r.error);
    if (errors.length > 0) {
      showError('Some RSVPs could not be saved. Please try again.');
      rsvpForm.classList.remove('loading');
      return;
    }

    // Show success message
    rsvpForm.style.display = 'none';
    rsvpSuccess.style.display = 'block';
    rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (error) {
    console.error('RSVP submission error:', error);
    showError('Something went wrong. Please try again later.');
  } finally {
    rsvpForm.classList.remove('loading');
  }
});

// Cancel RSVP Handler
cancelRsvp.addEventListener('click', () => {
  rsvpFormContainer.style.display = 'none';
  rsvpLookup.style.display = 'block';
  rsvpSuccess.style.display = 'none';
  lookupForm.reset();
  currentPartyData = null;
  hideError();
  
  // Scroll back to lookup form
  rsvpLookup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// Error Display Functions
function showError(message) {
  const lookupError = document.getElementById('lookupError');
  if (lookupError) {
    lookupError.textContent = message;
    lookupError.classList.add('show');
  }
}

function hideError() {
  const lookupError = document.getElementById('lookupError');
  if (lookupError) {
    lookupError.classList.remove('show');
  }
}
*/

// Load events dynamically (if you want to fetch from API)
async function loadEvents() {
  // This is a placeholder - you can integrate with your API if needed
  // For now, events are hardcoded in HTML
}

// Dynamic font sizing for hero names on desktop
function adjustHeroNamesFontSize() {
  const heroNames = document.querySelector('.hero-names');
  if (!heroNames) return;
  
  // Only adjust on desktop
  if (window.innerWidth <= 768) {
    // Show text immediately on mobile
    heroNames.classList.add('font-size-calculated');
    return;
  }
  
  const container = document.querySelector('.hero-content');
  if (!container) return;
  
  // Wait for layout to be ready
  requestAnimationFrame(() => {
    const containerWidth = container.offsetWidth;
    
    // Ensure we have a valid width
    if (containerWidth <= 0) {
      setTimeout(adjustHeroNamesFontSize, 50);
      return;
    }
    
    const maxFontSize = 60; // Maximum font size in pixels
    const minFontSize = 20; // Minimum font size in pixels
    
    // Create a temporary element to measure text width
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.whiteSpace = 'nowrap';
    temp.style.fontFamily = getComputedStyle(heroNames).fontFamily;
    temp.style.fontWeight = getComputedStyle(heroNames).fontWeight;
    temp.style.letterSpacing = getComputedStyle(heroNames).letterSpacing;
    temp.textContent = heroNames.textContent.trim();
    document.body.appendChild(temp);
    
    // Binary search for optimal font size
    let fontSize = maxFontSize;
    let low = minFontSize;
    let high = maxFontSize;
    
    while (low <= high) {
      fontSize = Math.floor((low + high) / 2);
      temp.style.fontSize = fontSize + 'px';
      const textWidth = temp.offsetWidth;
      
      if (textWidth <= containerWidth * 0.95) { // 95% to leave some padding
        low = fontSize + 1;
      } else {
        high = fontSize - 1;
      }
    }
    
    // Use the last valid size
    fontSize = high;
    if (fontSize >= minFontSize) {
      heroNames.style.fontSize = fontSize + 'px';
    }
    
    // Show the text after font size is calculated
    heroNames.classList.add('font-size-calculated');
    
    document.body.removeChild(temp);
  });
}

// Wait for fonts to load
function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    return document.fonts.ready;
  }
  return Promise.resolve();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Any initialization code
  console.log('Wedding website loaded');
  
  // Ensure hamburger is hidden on initial load
  const navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.classList.remove('show');
  }
  
  // Wait for fonts to load, then adjust font size
  waitForFonts().then(() => {
    // Small delay to ensure layout is calculated
    setTimeout(() => {
      adjustHeroNamesFontSize();
    }, 100);
  });
  
  // Adjust on window resize (with debounce)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      adjustHeroNamesFontSize();
      
      // Update hamburger visibility on resize
      if (navToggle) {
        if (window.innerWidth <= 768 && window.pageYOffset <= 10) {
          navToggle.classList.add('show');
        } else {
          navToggle.classList.remove('show');
        }
      }
    }, 150);
  });
});

