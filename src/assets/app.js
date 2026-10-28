// Archive page: filter chips (?tipo=podcast|instagram|omelete) and "Carregar mais".
(() => {
  const grid = document.getElementById('archive-grid');
  if (!grid) return;
  const PAGE = 24;
  const cards = [...grid.querySelectorAll('.card')];
  const chips = [...document.querySelectorAll('.chip')];
  const more = document.getElementById('load-more');
  const params = new URLSearchParams(location.search);
  let filter = chips.some((c) => c.dataset.filter === params.get('tipo')) ? params.get('tipo') : 'todos';
  let limit = PAGE;

  function render() {
    const matching = cards.filter((c) => filter === 'todos' || c.dataset.source === filter);
    cards.forEach((c) => c.classList.add('is-hidden'));
    matching.slice(0, limit).forEach((c) => c.classList.remove('is-hidden'));
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
    more.hidden = matching.length <= limit;
  }

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      filter = chip.dataset.filter;
      limit = PAGE;
      const url = new URL(location.href);
      if (filter === 'todos') url.searchParams.delete('tipo');
      else url.searchParams.set('tipo', filter);
      history.replaceState(null, '', url);
      render();
    }),
  );
  more.addEventListener('click', () => {
    limit += PAGE;
    render();
  });
  render();
})();
