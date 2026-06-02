// RSVP System — form only (login handled by auth.js)

let rsvpFormContainer, rsvpForm, rsvpSuccess, cancelRsvp, partyInfo, eventsFormContainer, rsvpError;

function initRSVP() {
  rsvpFormContainer = document.getElementById('rsvpFormContainer');
  rsvpForm = document.getElementById('rsvpForm');
  rsvpSuccess = document.getElementById('rsvpSuccess');
  cancelRsvp = document.getElementById('cancelRsvp');
  partyInfo = document.getElementById('partyInfo');
  eventsFormContainer = document.getElementById('eventsFormContainer');
  rsvpError = document.getElementById('rsvpError');

  if (!rsvpForm) return;

  setupRsvpEventListeners();
}

function initRsvpFromPartyData(data) {
  if (!rsvpFormContainer || !rsvpForm || !partyInfo) return;

  rsvpFormContainer.style.display = 'block';
  rsvpSuccess.style.display = 'none';
  rsvpForm.style.display = 'block';
  hideRsvpError();

  partyInfo.innerHTML = `<h3>${data.party.name}</h3>`;

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

  buildRsvpForm(data.events);
}

function setupRsvpEventListeners() {
  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentPartyData) {
      showRsvpError('Please log in again to submit your RSVP.');
      return false;
    }

    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
      submitButton.classList.add('loading');
      const buttonText = submitButton.querySelector('.button-text');
      const buttonSpinner = submitButton.querySelector('.button-spinner');
      if (buttonText) buttonText.textContent = 'Please Wait';
      if (buttonSpinner) buttonSpinner.style.display = 'inline-block';
    }
    hideRsvpError();

    try {
      const submissions = [];

      currentPartyData.events.forEach(event => {
        event.guests.forEach(guest => {
          const attendingInput = rsvpForm.querySelector(`input[name="attending_${event.eventId}_${guest.guestId}"]`);
          const mealSelect = rsvpForm.querySelector(`select[name="meal_${event.eventId}_${guest.guestId}"]`);

          if (attendingInput && attendingInput.value !== '') {
            const isAttending = attendingInput.value === 'true';
            const isReception = event.name.toLowerCase().includes('reception');

            if (isAttending && isReception && (!mealSelect || !mealSelect.value)) {
              showRsvpError('Meal choice is required for the Reception. Please select a meal option.');
              resetSubmitButton();
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
        showRsvpError('Please make at least one selection');
        resetSubmitButton();
        return false;
      }

      const promises = submissions.map(async (submission) => {
        try {
          const response = await fetch(MODAL_SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
      const errors = results.filter(r => r && r.error);
      if (errors.length > 0) {
        const errorMessages = errors.map(e => e.error).join(', ');
        showRsvpError(`Some RSVPs could not be saved: ${errorMessages}. Please try again.`);
        resetSubmitButton();
        return false;
      }

      rsvpForm.style.display = 'none';
      rsvpSuccess.style.display = 'block';
      rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
      console.error('RSVP submission error:', error);
      showRsvpError('Something went wrong. Please try again later.');
    } finally {
      resetSubmitButton();
    }

    return false;
  });

  if (cancelRsvp) {
    cancelRsvp.addEventListener('click', () => {
      if (currentPartyData) {
        initRsvpFromPartyData(currentPartyData);
      }
    });
  }
}

function resetSubmitButton() {
  const submitButton = document.getElementById('submitButton');
  if (submitButton) {
    submitButton.classList.remove('loading');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonSpinner = submitButton.querySelector('.button-spinner');
    if (buttonText) buttonText.textContent = 'Submit RSVP';
    if (buttonSpinner) buttonSpinner.style.display = 'none';
  }
}

function getAttendingState(attendingValue) {
  const isAttending = attendingValue === true || attendingValue === 'Yes' || attendingValue === 'yes';
  const isNotAttending = attendingValue === false || attendingValue === 'No' || attendingValue === 'no';
  const hasRSVP = attendingValue !== null && attendingValue !== undefined && attendingValue !== '';
  return { isAttending, isNotAttending, hasRSVP };
}

function setAttendingChoice(group, value) {
  const hiddenInput = group.querySelector('input[type="hidden"]');
  const acceptBtn = group.querySelector('[data-choice="accept"]');
  const declineBtn = group.querySelector('[data-choice="decline"]');
  const mealSelect = group.querySelector('select[name^="meal_"]');
  const isReception = group.dataset.isReception === 'true';

  hiddenInput.value = value;
  acceptBtn.classList.toggle('selected', value === 'true');
  declineBtn.classList.toggle('selected', value === 'false');
  acceptBtn.setAttribute('aria-pressed', value === 'true' ? 'true' : 'false');
  declineBtn.setAttribute('aria-pressed', value === 'false' ? 'true' : 'false');

  if (mealSelect) {
    const isAttending = value === 'true';
    mealSelect.disabled = !isAttending;
    mealSelect.required = isAttending && isReception;
    if (!isAttending) {
      mealSelect.value = '';
    }
  }
}

function setupAttendingToggles(eventGroup, event) {
  const isReception = event.name.toLowerCase().includes('reception');

  eventGroup.querySelectorAll('.guest-form-group').forEach(group => {
    group.dataset.isReception = isReception ? 'true' : 'false';

    const acceptBtn = group.querySelector('[data-choice="accept"]');
    const declineBtn = group.querySelector('[data-choice="decline"]');

    acceptBtn.addEventListener('click', () => setAttendingChoice(group, 'true'));
    declineBtn.addEventListener('click', () => setAttendingChoice(group, 'false'));
  });
}

function buildRsvpForm(events) {
  if (!eventsFormContainer) return;

  eventsFormContainer.innerHTML = '';

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
        const { isAttending, isNotAttending } = getAttendingState(guest.attending);
        const fieldName = `attending_${event.eventId}_${guest.guestId}`;
        const initialValue = isAttending ? 'true' : (isNotAttending ? 'false' : '');
        return `
        <div class="guest-form-group">
          <div class="guest-rsvp-row">
            <span class="guest-name">${guest.name}</span>
            <div class="rsvp-choice-group" role="group" aria-label="RSVP for ${guest.name}">
              <button type="button" class="rsvp-choice-btn" data-choice="accept" aria-pressed="${isAttending ? 'true' : 'false'}">Accept</button>
              <button type="button" class="rsvp-choice-btn" data-choice="decline" aria-pressed="${isNotAttending ? 'true' : 'false'}">Decline</button>
            </div>
          </div>
          <input type="hidden" name="${fieldName}" value="${initialValue}">
          ${event.name.toLowerCase().includes('reception') ? `
            <label class="meal-label">Meal Choice${guest.meal ? ` <span class="meal-current">(Current: ${guest.meal})</span>` : ''} <span class="required-mark">*</span></label>
            <select name="meal_${event.eventId}_${guest.guestId}" ${!isAttending ? 'disabled' : ''} ${isAttending ? 'required' : ''}>
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

    eventGroup.querySelectorAll('.guest-form-group').forEach(group => {
      const hiddenInput = group.querySelector('input[type="hidden"]');
      const acceptBtn = group.querySelector('[data-choice="accept"]');
      const declineBtn = group.querySelector('[data-choice="decline"]');
      if (hiddenInput.value === 'true') {
        acceptBtn.classList.add('selected');
      } else if (hiddenInput.value === 'false') {
        declineBtn.classList.add('selected');
      }
    });

    setupAttendingToggles(eventGroup, event);
    eventsFormContainer.appendChild(eventGroup);
  });
}

function showRsvpError(message) {
  if (rsvpError) {
    rsvpError.textContent = message;
    rsvpError.classList.add('show');
  }
}

function hideRsvpError() {
  if (rsvpError) {
    rsvpError.classList.remove('show');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRSVP);
} else {
  initRSVP();
}
