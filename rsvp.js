// RSVP System - Complete Implementation
// Note: MODAL_LOOKUP_URL, MODAL_SUBMIT_URL, and currentPartyData are declared in script.js
// We'll use the existing currentPartyData from script.js

// DOM Elements - initialize after DOM is ready
let lookupForm, rsvpLookup, rsvpFormContainer, rsvpForm, lookupError, rsvpSuccess, cancelRsvp, partyInfo, eventsFormContainer;

// Initialize when DOM is ready
function initRSVP() {
  lookupForm = document.getElementById('lookupForm');
  rsvpLookup = document.getElementById('rsvpLookup');
  rsvpFormContainer = document.getElementById('rsvpFormContainer');
  rsvpForm = document.getElementById('rsvpForm');
  lookupError = document.getElementById('lookupError');
  rsvpSuccess = document.getElementById('rsvpSuccess');
  cancelRsvp = document.getElementById('cancelRsvp');
  partyInfo = document.getElementById('partyInfo');
  eventsFormContainer = document.getElementById('eventsFormContainer');

  if (!lookupForm || !rsvpLookup || !rsvpFormContainer || !rsvpForm) {
    console.error('RSVP elements not found');
    return;
  }

  setupEventListeners();
}

function setupEventListeners() {
  // Name Lookup Form Handler
  if (!lookupForm) {
    console.error('lookupForm not found');
    return;
  }
  
  lookupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const guestNameInput = document.getElementById('guestName');
    if (!guestNameInput) {
      console.error('guestName input not found');
      return false;
    }
    
    const guestName = guestNameInput.value.trim();
    if (!guestName) {
      showError('Please enter your name');
      return false;
    }

    // Show loading state
    const lookupButton = document.getElementById('lookupButton');
    
    if (lookupButton) {
      lookupButton.classList.add('loading');
      const buttonText = lookupButton.querySelector('.button-text');
      const buttonSpinner = lookupButton.querySelector('.button-spinner');
      if (buttonText) buttonText.textContent = 'Please Wait';
      if (buttonSpinner) buttonSpinner.style.display = 'inline-block';
    }
    
    if (guestNameInput) {
      guestNameInput.disabled = true;
    }
    hideError();

    try {
      const response = await fetch(`${MODAL_LOOKUP_URL}?name=${encodeURIComponent(guestName)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.error) {
        showError(data.error === 'party not found' 
          ? 'We couldn\'t find your invitation. Please check the spelling of your name.'
          : data.error);
        const lookupButton = document.getElementById('lookupButton');
        const guestNameInput = document.getElementById('guestName');
        if (lookupButton) {
          lookupButton.classList.remove('loading');
          lookupButton.querySelector('.button-text').textContent = 'Find My Invitation';
          lookupButton.querySelector('.button-spinner').style.display = 'none';
        }
        if (guestNameInput) {
          guestNameInput.disabled = false;
        }
        return false;
      }

      // Store party data
      currentPartyData = data;

      // Hide lookup form and show RSVP form
      rsvpLookup.style.display = 'none';
      rsvpFormContainer.style.display = 'block';
      rsvpSuccess.style.display = 'none';
      rsvpForm.style.display = 'block';

      // Populate party info
      partyInfo.innerHTML = `<h3>${data.party.name}</h3>`;
      
      // Check if there are any existing RSVPs
      // Handle both string ("Yes"/"No") and boolean (true/false) formats
      const hasExistingRSVPs = data.events.some(event => 
        event.guests.some(guest => {
          const attending = guest.attending;
          return attending !== null && attending !== undefined && attending !== '';
        })
      );
      
      if (hasExistingRSVPs) {
        const statusMessage = document.createElement('p');
        statusMessage.style.color = 'var(--text-light)';
        statusMessage.style.marginTop = '0.5rem';
        statusMessage.style.fontSize = '0.9rem';
        statusMessage.textContent = 'Your existing RSVPs are shown below. You can update them at any time.';
        partyInfo.appendChild(statusMessage);
      }

      // Build RSVP form for each event
      buildRsvpForm(data.events);

      // Scroll to form
      rsvpFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
      console.error('Lookup error:', error);
      showError('Something went wrong. Please try again later.');
    } finally {
      const lookupButton = document.getElementById('lookupButton');
      const guestNameInput = document.getElementById('guestName');
      if (lookupButton) {
        lookupButton.classList.remove('loading');
        const buttonText = lookupButton.querySelector('.button-text');
        const buttonSpinner = lookupButton.querySelector('.button-spinner');
        if (buttonText) buttonText.textContent = 'Find My Invitation';
        if (buttonSpinner) buttonSpinner.style.display = 'none';
      }
      if (guestNameInput) {
        guestNameInput.disabled = false;
      }
    }
    
    return false;
  });

  // RSVP Form Submit Handler
  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentPartyData) {
      showError('Please start over with a name lookup');
      return false;
    }

    // Show loading state
    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
      submitButton.classList.add('loading');
      const buttonText = submitButton.querySelector('.button-text');
      const buttonSpinner = submitButton.querySelector('.button-spinner');
      if (buttonText) buttonText.textContent = 'Please Wait';
      if (buttonSpinner) buttonSpinner.style.display = 'inline-block';
    }
    hideError();

    try {
      const submissions = [];

      // Collect all RSVP submissions
      currentPartyData.events.forEach(event => {
        event.guests.forEach(guest => {
          const attendingSelect = rsvpForm.querySelector(`select[name="attending_${event.eventId}_${guest.guestId}"]`);
          const mealSelect = rsvpForm.querySelector(`select[name="meal_${event.eventId}_${guest.guestId}"]`);
          
          if (attendingSelect && attendingSelect.value !== '') {
            const isAttending = attendingSelect.value === 'true';
            const isReception = event.name.toLowerCase().includes('reception');
            
            // Validate meal choice is required for reception
            if (isAttending && isReception && (!mealSelect || !mealSelect.value)) {
              showError('Meal choice is required for the Reception. Please select a meal option.');
              const submitButton = document.getElementById('submitButton');
              if (submitButton) {
                submitButton.classList.remove('loading');
                const buttonText = submitButton.querySelector('.button-text');
                const buttonSpinner = submitButton.querySelector('.button-spinner');
                if (buttonText) buttonText.textContent = 'Submit RSVP';
                if (buttonSpinner) buttonSpinner.style.display = 'none';
              }
              return false;
            }
            
            submissions.push({
              guestId: guest.guestId,
              eventId: event.eventId,
              attending: isAttending,
              meal_choice: mealSelect && mealSelect.value ? mealSelect.value : null
            });
          }
        });
      });

      if (submissions.length === 0) {
        showError('Please make at least one selection');
        const submitButton = document.getElementById('submitButton');
        if (submitButton) {
          submitButton.classList.remove('loading');
          const buttonText = submitButton.querySelector('.button-text');
          const buttonSpinner = submitButton.querySelector('.button-spinner');
          if (buttonText) buttonText.textContent = 'Submit RSVP';
          if (buttonSpinner) buttonSpinner.style.display = 'none';
        }
        return false;
      }

      // Submit all RSVPs
      const promises = submissions.map(async (submission) => {
        try {
          const response = await fetch(MODAL_SUBMIT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`RSVP submission failed: ${response.status} ${errorText}`);
            return { error: `Server error: ${response.status}` };
          }

          return await response.json();
        } catch (error) {
          console.error('Fetch error:', error);
          return { error: error.message || 'Network error' };
        }
      });

      const results = await Promise.all(promises);

      // Check for errors
      const errors = results.filter(r => r && r.error);
      if (errors.length > 0) {
        console.error('RSVP submission errors:', errors);
        const errorMessages = errors.map(e => e.error).join(', ');
        showError(`Some RSVPs could not be saved: ${errorMessages}. Please try again.`);
        const submitButton = document.getElementById('submitButton');
        if (submitButton) {
          submitButton.classList.remove('loading');
          const buttonText = submitButton.querySelector('.button-text');
          const buttonSpinner = submitButton.querySelector('.button-spinner');
          if (buttonText) buttonText.textContent = 'Submit RSVP';
          if (buttonSpinner) buttonSpinner.style.display = 'none';
        }
        return false;
      }

      // Show success message
      rsvpForm.style.display = 'none';
      rsvpSuccess.style.display = 'block';
      rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
      console.error('RSVP submission error:', error);
      showError('Something went wrong. Please try again later.');
    } finally {
      const submitButton = document.getElementById('submitButton');
      if (submitButton) {
        submitButton.classList.remove('loading');
        const buttonText = submitButton.querySelector('.button-text');
        const buttonSpinner = submitButton.querySelector('.button-spinner');
        if (buttonText) buttonText.textContent = 'Submit RSVP';
        if (buttonSpinner) buttonSpinner.style.display = 'none';
      }
    }
    
    return false;
  });

  // Cancel RSVP Handler
  if (cancelRsvp) {
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
}

// Build RSVP Form
function buildRsvpForm(events) {
  if (!eventsFormContainer) return;
  
  eventsFormContainer.innerHTML = '';

  // Sort events by sort_order if available
  const sortedEvents = [...events].sort((a, b) => {
    if (a.sort_order !== undefined && b.sort_order !== undefined) {
      return a.sort_order - b.sort_order;
    }
    return 0;
  });

  sortedEvents.forEach(event => {
    const eventGroup = document.createElement('div');
    eventGroup.className = 'event-form-group';
    
    eventGroup.innerHTML = `
      <h4>${event.name}</h4>
      ${event.guests.map(guest => {
        // Handle both string ("Yes"/"No") and boolean (true/false) formats from API
        const attendingValue = guest.attending;
        const isAttending = attendingValue === true || attendingValue === 'Yes' || attendingValue === 'yes';
        const isNotAttending = attendingValue === false || attendingValue === 'No' || attendingValue === 'no';
        const hasRSVP = attendingValue !== null && attendingValue !== undefined && attendingValue !== '';
        
        const rsvpStatus = hasRSVP 
          ? (isAttending ? ' ✓ Attending' : ' ✗ Not Attending')
          : '';
        return `
        <div class="guest-form-group">
          <label>${guest.name}${rsvpStatus}</label>
          <select name="attending_${event.eventId}_${guest.guestId}" required>
            <option value="">Select...</option>
            <option value="true" ${isAttending ? 'selected' : ''}>Attending</option>
            <option value="false" ${isNotAttending ? 'selected' : ''}>Not Attending</option>
          </select>
          ${event.name.toLowerCase().includes('reception') ? `
            <label style="margin-top: 1rem;">Meal Choice${guest.meal ? ` <span style="color: var(--text-light); font-weight: normal;">(Current: ${guest.meal})</span>` : ''} <span style="color: #c33;">*</span></label>
            <select name="meal_${event.eventId}_${guest.guestId}" ${!isAttending ? 'disabled' : ''} ${isAttending ? 'required' : ''} data-required-if-attending="true">
              <option value="">Select meal...</option>
              <option value="Chicken" ${guest.meal === 'Chicken' ? 'selected' : ''}>Chicken</option>
              <option value="Vegetarian" ${guest.meal === 'Vegetarian' || guest.meal === 'Veg' ? 'selected' : ''}>Vegetarian</option>
              <option value="Restrictions (please contact us)" ${guest.meal === 'Restrictions (please contact us)' ? 'selected' : ''}>Restrictions (please contact us)</option>
            </select>
          ` : ''}
        </div>
      `;
      }).join('')}
    `;

    // Enable/disable meal selection based on attending status
    const isReception = event.name.toLowerCase().includes('reception');
    
    eventGroup.querySelectorAll(`select[name^="attending_${event.eventId}"]`).forEach(select => {
      // Set initial state for meal selects
      const guestId = select.name.split('_')[2];
      const mealSelect = eventGroup.querySelector(`select[name="meal_${event.eventId}_${guestId}"]`);
      if (mealSelect) {
        const isAttending = select.value === 'true';
        mealSelect.disabled = !isAttending;
        mealSelect.required = isAttending && isReception;
      }
      
      // Add change listener
      select.addEventListener('change', (e) => {
        const guestId = e.target.name.split('_')[2];
        const mealSelect = eventGroup.querySelector(`select[name="meal_${event.eventId}_${guestId}"]`);
        if (mealSelect) {
          const isAttending = e.target.value === 'true';
          mealSelect.disabled = !isAttending;
          mealSelect.required = isAttending && isReception;
          if (!isAttending) {
            mealSelect.value = '';
            mealSelect.required = false;
          }
        }
      });
    });

    eventsFormContainer.appendChild(eventGroup);
  });
}

// Error Display Functions
function showError(message) {
  if (lookupError) {
    lookupError.textContent = message;
    lookupError.classList.add('show');
  }
}

function hideError() {
  if (lookupError) {
    lookupError.classList.remove('show');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRSVP);
} else {
  initRSVP();
}
