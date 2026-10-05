/**
 * VendlyPOS Menú Digital Gastronómico — Main Orchestrator (app.js)
 * Coordina la experiencia del cliente: parámetros URL, catálogo, búsqueda, mesa y comanda.
 */

const App = (() => {
  let storeData = null;
  let allProducts = [];
  let allCategories = [];
  let activeCategory = 'Todos';
  let searchTerm = '';

  // Elementos DOM del Header
  const heroHeaderEl = document.getElementById('hero-header');
  const restaurantNameEl = document.getElementById('restaurant-title');
  const restaurantTaglineEl = document.getElementById('restaurant-tagline');
  const restaurantStatusEl = document.getElementById('restaurant-status');
  const restaurantScheduleEl = document.getElementById('restaurant-schedule');
  const tablePillNumberEl = document.getElementById('table-pill-number');
  const headerTablePillBtn = document.getElementById('header-table-pill');

  // Elementos DOM de Navegación y Búsqueda
  const searchInputEl = document.getElementById('menu-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const categoriesScrollEl = document.getElementById('categories-scroll');
  const menuContentEl = document.getElementById('menu-content');

  // Modal de Selección de Mesa
  const tableModalOverlay = document.getElementById('table-modal-overlay');
  const customTableInput = document.getElementById('custom-table-input');
  const btnConfirmCustomTable = document.getElementById('btn-confirm-custom-table');
  const btnCloseTableModal = document.getElementById('btn-close-table-modal');

  /**
   * Extrae los parámetros de la URL
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('tienda') || params.get('store') || params.get('tienda_id') || 'rincon-sabor';
    const tableParam = params.get('mesa') || params.get('table') || params.get('m') || '01';

    return {
      storeId: storeId.trim(),
      tableNumber: tableParam.trim()
    };
  }

  /**
   * Actualiza los parámetros de la URL sin recargar la página
   */
  function updateUrlParams(tableNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set('mesa', tableNumber);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Inicialización de la aplicación
   */
  async function init() {
    const { storeId, tableNumber } = parseUrlParams();

    // Contexto global inicial
    window.VendlyStore = {
      id: storeId,
      tableNumber: tableNumber,
      businessName: 'Cargando restaurante...',
      currencySymbol: '$'
    };

    renderHeaderTablePill(tableNumber);
    renderSkeletons();

    try {
      // 1. Cargar datos de la tienda y del catálogo en paralelo
      const [store, menu] = await Promise.all([
        Relay.fetchStore(storeId),
        Relay.fetchMenu(storeId)
      ]);

      storeData = store;
      allProducts = menu.products || [];
      allCategories = menu.categories || ['Todos'];

      // Sincronizar contexto global
      window.VendlyStore = {
        ...storeData,
        tableNumber: tableNumber
      };

      // 2. Renderizar UI
      renderStoreHeader();
      renderCategoryTabs();
      renderProductsGrid();

      // 3. Inicializar comanda local para esta tienda y mesa
      if (window.Cart && typeof window.Cart.loadPersisted === 'function') {
        window.Cart.loadPersisted();
      }

      // 4. Configurar observador de scroll para pestañas
      setupScrollSpy();
    } catch (err) {
      console.error('[App] Error inicializando menú:', err);
      showErrorMessage('No fue posible cargar el menú gastronómico. Por favor intenta refrescar la pantalla.');
    }
  }

  /**
   * Renderiza el encabezado del restaurante con su imagen de portada e información
   */
  function renderStoreHeader() {
    if (!storeData) return;

    if (restaurantNameEl) restaurantNameEl.textContent = storeData.businessName;
    if (restaurantTaglineEl) {
      restaurantTaglineEl.textContent = storeData.tagline || 'Experiencia culinaria de alta calidad';
    }

    if (restaurantScheduleEl) {
      restaurantScheduleEl.textContent = storeData.schedule || 'Abierto de 11:30 AM a 10:00 PM';
    }

    if (restaurantStatusEl) {
      restaurantStatusEl.textContent = 'En Servicio';
      restaurantStatusEl.classList.add('open');
    }

    // Fondo del hero banner
    if (heroHeaderEl && storeData.bannerUrl) {
      heroHeaderEl.style.backgroundImage = `url('${storeData.bannerUrl}')`;
    }

    renderHeaderTablePill(window.VendlyStore.tableNumber);
  }

  /**
   * Renderiza la píldora de mesa en el encabezado
   */
  function renderHeaderTablePill(tableNum) {
    if (tablePillNumberEl) {
      tablePillNumberEl.textContent = `Mesa ${tableNum}`;
    }
  }

  /**
   * Renderiza las pestañas de navegación horizontal de categorías
   */
  function renderCategoryTabs() {
    if (!categoriesScrollEl) return;
    categoriesScrollEl.innerHTML = '';

    allCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `category-tab-btn ${cat === activeCategory ? 'active' : ''}`;
      btn.dataset.category = cat;

      // Iconos representativos según categoría
      let icon = '🍽️';
      const c = cat.toLowerCase();
      if (c.includes('todos')) icon = '✨';
      else if (c.includes('entrada') || c.includes('tapa')) icon = '🥗';
      else if (c.includes('fuerte') || c.includes('carne') || c.includes('corte') || c.includes('especialidad')) icon = '🥩';
      else if (c.includes('hamburguesa') || c.includes('rapida')) icon = '🍔';
      else if (c.includes('postre') || c.includes('dulce')) icon = '🍰';
      else if (c.includes('bebida') || c.includes('cafe') || c.includes('coctel')) icon = '☕';
      else if (c.includes('pizza') || c.includes('pasta')) icon = '🍕';

      btn.innerHTML = `<span>${icon}</span><span>${escapeHtml(cat)}</span>`;

      btn.addEventListener('click', () => {
        selectCategory(cat);
      });

      categoriesScrollEl.appendChild(btn);
    });
  }

  /**
   * Maneja la selección de una pestaña de categoría
   */
  function selectCategory(cat) {
    activeCategory = cat;

    // Actualizar clase activa en botones
    document.querySelectorAll('.category-tab-btn').forEach(btn => {
      if (btn.dataset.category === cat) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove('active');
      }
    });

    if (cat === 'Todos') {
      window.scrollTo({ top: heroHeaderEl ? heroHeaderEl.offsetHeight - 56 : 0, behavior: 'smooth' });
    } else {
      const targetSection = document.getElementById(`cat-section-${slugify(cat)}`);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /**
   * Renderiza el catálogo agrupado por categorías o filtrado por búsqueda
   */
  function renderProductsGrid() {
    if (!menuContentEl) return;
    menuContentEl.innerHTML = '';

    const sym = window.VendlyStore?.currencySymbol || '$';

    // Filtrar por término de búsqueda si existe
    let filtered = allProducts;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = allProducts.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);
        return nameMatch || descMatch || catMatch;
      });
    }

    if (filtered.length === 0) {
      menuContentEl.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3 style="color: var(--text-primary); font-size: 1.25rem; font-family: var(--font-serif); margin-bottom: 6px;">
            No encontramos platillos para "${escapeHtml(searchTerm)}"
          </h3>
          <p style="font-size: 0.9rem; margin-bottom: 20px;">
            Intenta con otro término o explora las categorías del menú.
          </p>
          <button type="button" class="btn-dish-action btn-customize" id="btn-reset-search">
            Ver todo el menú
          </button>
        </div>
      `;

      const resetBtn = document.getElementById('btn-reset-search');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (searchInputEl) searchInputEl.value = '';
          searchTerm = '';
          if (searchClearBtn) searchClearBtn.classList.remove('visible');
          renderProductsGrid();
        });
      }
      return;
    }

    // Agrupar por categoría
    const grouped = {};
    filtered.forEach(p => {
      const cat = p.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    Object.keys(grouped).forEach(categoryName => {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'category-section';
      sectionEl.id = `cat-section-${slugify(categoryName)}`;
      sectionEl.dataset.categoryName = categoryName;

      const dishes = grouped[categoryName];

      sectionEl.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">
            <span>${escapeHtml(categoryName)}</span>
          </h2>
          <span class="section-count">${dishes.length} ${dishes.length === 1 ? 'platillo' : 'platillos'}</span>
        </div>
        <div class="dishes-grid" id="grid-${slugify(categoryName)}"></div>
      `;

      const grid = sectionEl.querySelector('.dishes-grid');

      dishes.forEach(dish => {
        const hasModifiers = Array.isArray(dish.modifier_groups) && dish.modifier_groups.length > 0;
        const isSoldOut = Boolean(dish.is_sold_out);

        const card = document.createElement('article');
        card.className = `dish-card ${isSoldOut ? 'sold-out' : ''}`;
        card.id = `dish-card-${dish.id}`;

        let badgeHtml = '';
        if (dish.badge) {
          badgeHtml = `<span class="dish-badge">${escapeHtml(dish.badge)}</span>`;
        }
        if (isSoldOut) {
          badgeHtml += `<span class="dish-sold-out-badge">Agotado</span>`;
        }

        const actionBtnHtml = isSoldOut
          ? `<button type="button" class="btn-dish-action" disabled>No disponible</button>`
          : hasModifiers
            ? `<button type="button" class="btn-dish-action btn-customize" data-action="customize">
                 <span>⚙️ Personalizar</span>
               </button>`
            : `<button type="button" class="btn-dish-action btn-direct-add" data-action="add" title="Agregar a la orden">
                 <span>+ Agregar</span>
               </button>`;

        card.innerHTML = `
          <div class="dish-img-wrap">
            ${badgeHtml}
            <img class="dish-img" src="${dish.image_url}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.src='assets/img/placeholder-dish.svg'" />
          </div>
          <div class="dish-details">
            <h3 class="dish-name">${escapeHtml(dish.name)}</h3>
            <p class="dish-desc">${escapeHtml(dish.description || 'Elaborado artesanalmente con ingredientes selectos.')}</p>
            <div class="dish-footer">
              <div class="dish-price-wrap">
                <span class="dish-price-label">Precio</span>
                <span class="dish-price">${sym}${dish.price.toFixed(2)}</span>
              </div>
              <div class="dish-action-wrap">
                ${actionBtnHtml}
              </div>
            </div>
          </div>
        `;

        // Wire up de botones de acción
        const customizeBtn = card.querySelector('[data-action="customize"]');
        if (customizeBtn) {
          customizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.Modifiers && typeof window.Modifiers.open === 'function') {
              window.Modifiers.open(dish);
            }
          });
        }

        const directAddBtn = card.querySelector('[data-action="add"]');
        if (directAddBtn) {
          directAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.Cart && typeof window.Cart.addItem === 'function') {
              window.Cart.addItem(dish, [], '', 1);
            }
          });
        }

        // Clic en la tarjeta completa abre modificador si aplica
        card.addEventListener('click', () => {
          if (isSoldOut) return;
          if (hasModifiers) {
            window.Modifiers?.open(dish);
          } else {
            window.Cart?.addItem(dish, [], '', 1);
          }
        });

        grid.appendChild(card);
      });

      menuContentEl.appendChild(sectionEl);
    });
  }

  /**
   * Muestra esqueletos animados mientras cargan los datos
   */
  function renderSkeletons() {
    if (!menuContentEl) return;
    menuContentEl.innerHTML = `
      <div style="padding: 10px 0;">
        <div class="skeleton" style="height: 32px; width: 220px; border-radius: 8px; margin-bottom: 20px;"></div>
        <div class="dishes-grid">
          ${Array(4).fill(0).map(() => `
            <div class="dish-card" style="pointer-events: none;">
              <div class="skeleton" style="aspect-ratio: 16/10; width: 100%;"></div>
              <div style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div class="skeleton" style="height: 22px; width: 70%; border-radius: 6px;"></div>
                <div class="skeleton" style="height: 14px; width: 95%; border-radius: 4px;"></div>
                <div class="skeleton" style="height: 14px; width: 60%; border-radius: 4px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                  <div class="skeleton" style="height: 26px; width: 70px; border-radius: 6px;"></div>
                  <div class="skeleton" style="height: 36px; width: 110px; border-radius: 20px;"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Observador de intersección para iluminar las pestañas según la categoría en pantalla
   */
  function setupScrollSpy() {
    const sections = document.querySelectorAll('.category-section');
    if (!('IntersectionObserver' in window) || sections.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const categoryName = entry.target.dataset.categoryName;
          if (categoryName && !searchTerm.trim()) {
            document.querySelectorAll('.category-tab-btn').forEach(btn => {
              if (btn.dataset.category === categoryName) {
                btn.classList.add('active');
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              } else {
                btn.classList.remove('active');
              }
            });
          }
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(s => observer.observe(s));
  }

  /**
   * Abre el modal de cambio manual de mesa
   */
  function openTableModal() {
    if (!tableModalOverlay) return;
    if (customTableInput) {
      customTableInput.value = window.VendlyStore?.tableNumber || '';
    }
    tableModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Cierra el modal de selección de mesa
   */
  function closeTableModal() {
    if (!tableModalOverlay) return;
    tableModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Aplica un nuevo número de mesa
   */
  function setTableNumber(newTable) {
    const cleanTable = (newTable || '01').trim();
    if (!cleanTable) return;

    window.VendlyStore.tableNumber = cleanTable;
    updateUrlParams(cleanTable);
    renderHeaderTablePill(cleanTable);

    // Recargar comanda para la nueva mesa
    if (window.Cart && typeof window.Cart.loadPersisted === 'function') {
      window.Cart.loadPersisted();
    }

    closeTableModal();
  }

  function showErrorMessage(msg) {
    if (menuContentEl) {
      menuContentEl.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--color-danger);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">⚠️</div>
          <p style="font-weight: 700; font-size: 1.1rem; margin-bottom: 16px;">${escapeHtml(msg)}</p>
          <button type="button" class="btn-dish-action btn-customize" onclick="window.location.reload()">
            Reintentar
          </button>
        </div>
      `;
    }
  }

  function slugify(text) {
    return (text || '')
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Event Listeners Globales
  document.addEventListener('DOMContentLoaded', () => {
    init();

    // Selector de mesa en el Header
    if (headerTablePillBtn) {
      headerTablePillBtn.addEventListener('click', openTableModal);
    }

    if (btnCloseTableModal) {
      btnCloseTableModal.addEventListener('click', closeTableModal);
    }

    if (tableModalOverlay) {
      tableModalOverlay.addEventListener('click', (e) => {
        if (e.target === tableModalOverlay) closeTableModal();
      });
    }

    // Botones rápidos de mesa (Mesa 01 a 12)
    document.querySelectorAll('.quick-table-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.table;
        if (t) setTableNumber(t);
      });
    });

    if (btnConfirmCustomTable) {
      btnConfirmCustomTable.addEventListener('click', () => {
        if (customTableInput && customTableInput.value.trim()) {
          setTableNumber(customTableInput.value.trim());
        }
      });
    }

    // Búsqueda en vivo
    if (searchInputEl) {
      searchInputEl.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        if (searchClearBtn) {
          if (searchTerm.trim().length > 0) {
            searchClearBtn.classList.add('visible');
          } else {
            searchClearBtn.classList.remove('visible');
          }
        }
        renderProductsGrid();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        if (searchInputEl) searchInputEl.value = '';
        searchTerm = '';
        searchClearBtn.classList.remove('visible');
        renderProductsGrid();
      });
    }
  });

  return {
    init,
    setTableNumber
  };
})();

window.App = App;
