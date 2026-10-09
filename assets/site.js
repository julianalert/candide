// Where the founding-list form sends its data. Paste a form endpoint URL here
// (Formspree, Basin, Getform or your own API: anything that accepts a JSON POST).
// While this is empty the form runs in preview mode and sends nothing.
const FORM_ENDPOINT = '';

// ---------- Mobile menu ----------

const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('#nav-links');

if (toggle && links) {
  const setOpen = (open) => {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!links.classList.contains('is-open')));
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

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
