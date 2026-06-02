// Events visibility — match Airtable Events by record id (name fallback)
// Reception: rec1xtXaKkk48vZmD | Welcome Dinner: recsdp2OAZauKrGFf

const EVENT_MATCHERS = {
  rec1xtXaKkk48vZmD: (name) => name.includes('reception'),
  recsdp2OAZauKrGFf: (name) => name.includes('welcome')
};

function isInvitedToEvent(invitedEvents, eventId) {
  const nameMatcher = EVENT_MATCHERS[eventId];
  return invitedEvents.some((event) => {
    if (event.eventId === eventId) return true;
    if (nameMatcher && event.name) {
      return nameMatcher(event.name.toLowerCase());
    }
    return false;
  });
}

function renderEvents(partyData) {
  const cards = document.querySelectorAll('[data-event-id]');
  const eventsEmpty = document.getElementById('eventsEmpty');
  if (!cards.length) return;

  const invitedEvents = partyData?.events || [];
  let visibleCount = 0;

  cards.forEach((card) => {
    const eventId = card.getAttribute('data-event-id');
    const invited = isInvitedToEvent(invitedEvents, eventId);
    card.hidden = !invited;
    if (invited) visibleCount++;
  });

  if (eventsEmpty) {
    eventsEmpty.hidden = visibleCount > 0;
  }
}
