// Where the demo-request form sends its data: the platform's API, which saves
// the request and emails the team and the person who asked.
// While this is empty the form runs in preview mode and sends nothing.
const FORM_ENDPOINT = 'https://app.candideai.com/api/demo-request';

// ---------- Video ----------
// The page shows a thumbnail that links to YouTube. Pressing play swaps in the
// player, so YouTube's player code is only loaded for people who watch.

document.querySelectorAll('a.video[data-video-id]').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work

    e.preventDefault();
    const player = document.createElement('iframe');
    player.className = 'video';
    player.src = `https://www.youtube-nocookie.com/embed/${link.dataset.videoId}?autoplay=1&rel=0`;
    player.title = link.dataset.videoTitle;
    player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    player.allowFullscreen = true;
    link.replaceWith(player);
    player.focus();
  });
});

// ---------- Demo-request form ----------

const form = document.querySelector('#demo-form');

if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const success = document.querySelector('#demo-success');

  const say = (message, kind) => {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
  };

  if (!FORM_ENDPOINT) form.querySelector('.preview-flag').hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fields = new FormData(form);
    if (fields.get('_gotcha')) return; // filled in by a bot
    fields.delete('_gotcha');

    const data = Object.fromEntries(fields);
    data.ages = fields.getAll('ages'); // several boxes can be ticked

    if (!FORM_ENDPOINT) {
      say('Preview mode: this form isn’t connected yet, so nothing was sent.', 'warn');
      return;
    }

    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.hidden = true;

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Form endpoint responded ${res.status}`);

      success.querySelector('[data-email]').textContent = data.email;
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (err) {
      console.error(err);
      say('Something went wrong and your request wasn’t sent. Please try again in a moment, or write to hello@candideai.com.', 'error');
      button.disabled = false;
      button.textContent = label;
    }
  });
}

// ---------- Terms menu in the top bar ----------
// A disclosure: the button opens and closes the list of term pages.

document.querySelectorAll('.nav-menu').forEach((menu) => {
  const trigger = menu.querySelector('.tab-trigger');
  const panel = menu.querySelector('.menu');

  const setOpen = (open) => {
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };

  trigger.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
  // Close when keyboard focus moves on past the menu.
  menu.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !menu.contains(e.relatedTarget)) setOpen(false);
  });
});
