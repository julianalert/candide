// Where the founding-list form sends its data. Paste a form endpoint URL here
// (Formspree, Basin, Getform or your own API: anything that accepts a JSON POST).
// While this is empty the form runs in preview mode and sends nothing.
const FORM_ENDPOINT = '';

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

// ---------- Founding-list form ----------

const form = document.querySelector('#founding-form');

if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const success = document.querySelector('#founding-success');

  const say = (message, kind) => {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
  };

  if (!FORM_ENDPOINT) form.querySelector('.preview-flag').hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form));
    if (data._gotcha) return; // filled in by a bot
    delete data._gotcha;

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
      say('Something went wrong and your details weren’t sent. Please try again in a moment.', 'error');
      button.disabled = false;
      button.textContent = label;
    }
  });
}
