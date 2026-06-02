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
          const attendingSelect = rsvpForm.querySelector(`select[name="attending_${event.eventId}_${guest.guestId}"]`);
          const mealSelect = rsvpForm.querySelector(`select[name="meal_${event.eventId}_${guest.guestId}"]`);

          if (attendingSelect && attendingSelect.value !== '') {
            const isAttending = attendingSelect.value === 'true';
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

    const isReception = event.name.toLowerCase().includes('reception');

    eventGroup.querySelectorAll(`select[name^="attending_${event.eventId}"]`).forEach(select => {
      const guestId = select.name.split('_')[2];
      const mealSelect = eventGroup.querySelector(`select[name="meal_${event.eventId}_${guestId}"]`);
      if (mealSelect) {
        const isAttending = select.value === 'true';
        mealSelect.disabled = !isAttending;
        mealSelect.required = isAttending && isReception;
      }

      select.addEventListener('change', (e) => {
        const guestIdFromEvent = e.target.name.split('_')[2];
        const mealSelectFromEvent = eventGroup.querySelector(`select[name="meal_${event.eventId}_${guestIdFromEvent}"]`);
        if (mealSelectFromEvent) {
          const isAttendingNow = e.target.value === 'true';
          mealSelectFromEvent.disabled = !isAttendingNow;
          mealSelectFromEvent.required = isAttendingNow && isReception;
          if (!isAttendingNow) {
            mealSelectFromEvent.value = '';
            mealSelectFromEvent.required = false;
          }
        }
      });
    });

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
