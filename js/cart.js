/**
 * VendlyPOS Menú Digital Gastronómico — Table Cart & Comanda (cart.js)
 * Gestión de la comanda activa de la mesa, cálculo de totales y despacho a cocina
 */

const Cart = (() => {
  const STORAGE_KEY_PREFIX = 'vendly_menu_comanda_';

  let items = [];
  let tipPercent = 10; // 10% de propina sugerida por defecto
  let customCustomerName = '';
  let customTableNotes = '';

  // Elementos DOM
  const floatingBar = document.getElementById('floating-comanda-bar');
  const comandaCountBadge = document.getElementById('comanda-badge-count');
  const comandaBarTotal = document.getElementById('comanda-bar-total');
  const comandaBarSubtitle = document.getElementById('comanda-bar-subtitle');

  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerItemsContainer = document.getElementById('drawer-items-container');
  const drawerSubtotalEl = document.getElementById('drawer-subtotal');
  const drawerTipEl = document.getElementById('drawer-tip');
  const drawerTotalEl = document.getElementById('drawer-total');
  const drawerTableTag = document.getElementById('drawer-table-tag');
  const customerNameInput = document.getElementById('drawer-customer-name');
  const tableNotesInput = document.getElementById('drawer-table-notes');
  const btnSubmitKitchen = document.getElementById('btn-submit-kitchen');

  /**
   * Clave única de almacenamiento local según la tienda y la mesa
   */
  function getStorageKey() {
    const store = window.VendlyStore?.id || 'default';
    const table = window.VendlyStore?.tableNumber || 'default';
    return `${STORAGE_KEY_PREFIX}${store}_${table}`;
  }

  /**
   * Carga la comanda persistida en localStorage
   */
  function loadPersisted() {
    items = [];
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      }
    } catch (e) {
      console.warn('[Cart] Error cargando comanda local:', e);
      items = [];
    }
    render();
  }

  /**
   * Guarda la comanda en localStorage
   */
  function persist() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(items));
    } catch (e) {
      console.warn('[Cart] Error persistiendo comanda local:', e);
    }
  }

  /**
   * Agrega un platillo con sus opciones de personalización a la comanda
   * @param {Object} dish
   * @param {Array} options
   * @param {string} notes
   * @param {number} qty
   */
  function addItem(dish, options = [], notes = '', qty = 1) {
    if (!dish) return;

    // Calcular precio unitario con redondeo a 2 decimales
    let unitPrice = parseFloat(dish.price || 0.0);
    options.forEach(opt => {
      unitPrice += parseFloat(opt.additional_price || 0.0);
    });
    unitPrice = Math.round(unitPrice * 100) / 100;

    // Generar hash único para la línea de pedido
    const sortedOptionIds = options.map(o => o.id).sort().join('-');
    const cleanNotes = (notes || '').trim().toLowerCase();
    const lineId = `${dish.id}__${sortedOptionIds}__${cleanNotes}`;

    const existingIndex = items.findIndex(it => it.line_id === lineId);
    if (existingIndex >= 0) {
      items[existingIndex].quantity += qty;
    } else {
      items.push({
        line_id: lineId,
        dish_id: dish.id,
        sku: dish.sku || dish.id,
        name: dish.name,
        category: dish.category || 'General',
        base_price: parseFloat(dish.price || 0.0),
        unit_price: unitPrice,
        quantity: qty,
        options: options,
        notes: (notes || '').trim(),
        image_url: dish.image_url || 'assets/img/placeholder-dish.svg'
      });
    }

    persist();
    render();
    animateBarBump();
  }

  /**
   * Modifica la cantidad de una línea
   */
  function updateItemQty(lineId, delta) {
    const idx = items.findIndex(it => it.line_id === lineId);
    if (idx >= 0) {
      items[idx].quantity += delta;
      if (items[idx].quantity <= 0) {
        items.splice(idx, 1);
      }
      persist();
      render();
    }
  }

  /**
   * Elimina un ítem de la comanda
   */
  function removeItem(lineId) {
    items = items.filter(it => it.line_id !== lineId);
    persist();
    render();
  }

  /**
   * Vacía toda la comanda
   */
  function clear() {
    items = [];
    persist();
    render();
  }

  /**
   * Cálculos de totales
   */
  function getSubtotal() {
    return Math.round(items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0.0) * 100) / 100;
  }

  function getTipAmount() {
    if (tipPercent <= 0) return 0.0;
    return Math.round((getSubtotal() * (tipPercent / 100)) * 100) / 100;
  }

  function getTotal() {
    return Math.round((getSubtotal() + getTipAmount()) * 100) / 100;
  }

  function getTotalItemCount() {
    return items.reduce((count, it) => count + it.quantity, 0);
  }

  /**
   * Cambia el porcentaje de propina
   */
  function setTipPercent(percent) {
    tipPercent = parseInt(percent, 10) || 0;
    renderDrawerTotals();
  }

  /**
   * Abre el drawer / modal de revisión de la comanda
   */
  function openDrawer() {
    if (items.length === 0) return;
    if (drawerOverlay) {
      drawerOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      renderDrawer();
    }
  }

  /**
   * Cierra el drawer
   */
  function closeDrawer() {
    if (drawerOverlay) {
      drawerOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  /**
   * Efecto visual de rebote en la barra flotante
   */
  function animateBarBump() {
    if (floatingBar) {
      floatingBar.classList.remove('badge-bump-animate');
      void floatingBar.offsetWidth; // Forzar reflow
      floatingBar.classList.add('badge-bump-animate');
    }
  }

  /**
   * Renderiza el estado completo en la UI
   */
  function render() {
    const totalCount = getTotalItemCount();
    const sym = window.VendlyStore?.currencySymbol || '$';
    const subtotal = getSubtotal();

    // 1. Barra Flotante
    if (floatingBar) {
      if (totalCount > 0) {
        floatingBar.classList.add('visible');
      } else {
        floatingBar.classList.remove('visible');
        closeDrawer();
      }
    }

    if (comandaCountBadge) comandaCountBadge.textContent = totalCount;
    if (comandaBarTotal) comandaBarTotal.textContent = `${sym}${subtotal.toFixed(2)}`;
    if (comandaBarSubtitle) {
      const mesa = window.VendlyStore?.tableNumber || 'En Salón';
      const mesaClean = mesa.toLowerCase().startsWith('mesa') ? mesa : `Mesa ${mesa}`;
      comandaBarSubtitle.textContent = `${mesaClean} • ${totalCount} ${totalCount === 1 ? 'platillo' : 'platillos'}`;
    }

    // 2. Si el drawer está visible, actualizar su contenido
    if (drawerOverlay && drawerOverlay.classList.contains('active')) {
      renderDrawer();
    }
  }

  /**
   * Renderiza la lista de ítems dentro del drawer
   */
  function renderDrawer() {
    if (!drawerItemsContainer) return;
    drawerItemsContainer.innerHTML = '';

    const sym = window.VendlyStore?.currencySymbol || '$';
    const mesaRaw = window.VendlyStore?.tableNumber || 'Mesa no asignada';
    const mesaClean = mesaRaw.toLowerCase().startsWith('mesa') ? mesaRaw : `Mesa ${mesaRaw}`;
    if (drawerTableTag) drawerTableTag.textContent = mesaClean;

    if (items.length === 0) {
      drawerItemsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">Tu orden está vacía</p>
          <p style="font-size: 0.85rem;">Explora el menú y agrega tus platillos favoritos.</p>
        </div>
      `;
      renderDrawerTotals();
      return;
    }

    items.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'comanda-item';

      const lineTotal = item.unit_price * item.quantity;

      // Generar píldoras de modificadores
      let modsHtml = '';
      if (item.options && item.options.length > 0) {
        const pills = item.options.map(o => {
          const addPrice = o.additional_price > 0 ? ` (+${sym}${o.additional_price.toFixed(2)})` : '';
          return `<span class="mod-pill-tag">${escapeHtml(o.name)}${addPrice}</span>`;
        }).join('');
        modsHtml = `<div class="comanda-item-modifiers">${pills}</div>`;
      }

      // Notas especiales
      let notesHtml = '';
      if (item.notes) {
        notesHtml = `<div class="comanda-item-notes">Nota: ${escapeHtml(item.notes)}</div>`;
      }

      itemRow.innerHTML = `
        <div class="comanda-item-header">
          <span class="comanda-item-name">${escapeHtml(item.name)}</span>
          <span class="comanda-item-price">${sym}${lineTotal.toFixed(2)}</span>
        </div>
        ${modsHtml}
        ${notesHtml}
        <div class="comanda-item-footer">
          <div class="item-stepper">
            <button type="button" class="stepper-btn" data-action="minus">−</button>
            <span class="stepper-val">${item.quantity}</span>
            <button type="button" class="stepper-btn" data-action="plus">+</button>
          </div>
          <button type="button" class="btn-remove-item">Eliminar</button>
        </div>
      `;

      itemRow.querySelector('[data-action="minus"]').addEventListener('click', () => {
        updateItemQty(item.line_id, -1);
      });
      itemRow.querySelector('[data-action="plus"]').addEventListener('click', () => {
        updateItemQty(item.line_id, 1);
      });
      itemRow.querySelector('.btn-remove-item').addEventListener('click', () => {
        removeItem(item.line_id);
      });

      drawerItemsContainer.appendChild(itemRow);
    });

    renderDrawerTotals();
  }

  function renderDrawerTotals() {
    const sym = window.VendlyStore?.currencySymbol || '$';
    const subtotal = getSubtotal();
    const tip = getTipAmount();
    const total = getTotal();

    if (drawerSubtotalEl) drawerSubtotalEl.textContent = `${sym}${subtotal.toFixed(2)}`;
    if (drawerTipEl) drawerTipEl.textContent = `${sym}${tip.toFixed(2)}`;
    if (drawerTotalEl) drawerTotalEl.textContent = `${sym}${total.toFixed(2)}`;

    // Resaltar botón de propina seleccionado
    document.querySelectorAll('.tip-btn').forEach(btn => {
      const p = parseInt(btn.dataset.tip, 10);
      if (p === tipPercent) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Envía la comanda formal a Cocina / KDS
   */
  async function submitKitchenOrder() {
    if (items.length === 0) return;

    const mesa = window.VendlyStore?.tableNumber || '01';
    const customer = customerNameInput ? customerNameInput.value.trim() : '';
    const tableNotes = tableNotesInput ? tableNotesInput.value.trim() : '';

    if (btnSubmitKitchen) {
      btnSubmitKitchen.disabled = true;
      btnSubmitKitchen.innerHTML = `
        <span class="spinner-icon"></span>
        <span>Enviando a cocina...</span>
      `;
    }

    const payload = {
      store_id: window.VendlyStore?.id || 'rincon-sabor',
      table_number: mesa,
      customer_name: customer || `Comensal Mesa ${mesa}`,
      notes: tableNotes,
      total_amount: getTotal(),
      items: items.map(it => ({
        id: it.dish_id,
        dish_id: it.dish_id,
        sku: it.sku,
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        base_price: it.base_price,
        price: it.base_price,
        unit_price: it.base_price,
        total: Math.round((it.unit_price * it.quantity) * 100) / 100,
        notes: it.notes,
        options: it.options
      }))
    };

    try {
      const res = await Relay.submitOrder(payload);
      if (res && res.ok) {
        // Limpiar comanda local y notas del comensal
        clear();
        if (customerNameInput) customerNameInput.value = '';
        if (tableNotesInput) tableNotesInput.value = '';
        closeDrawer();
        showSuccessModal(res.order_code, mesa);
      } else {
        alert('Hubo un inconveniente al registrar el pedido. Por favor consulta con tu mesero.');
      }
    } catch (e) {
      console.error('[Cart] Error enviando pedido:', e);
      alert('Error de conexión. Intenta de nuevo o avisa al personal de sala.');
    } finally {
      if (btnSubmitKitchen) {
        btnSubmitKitchen.disabled = false;
        btnSubmitKitchen.innerHTML = `
          <span>Enviar Pedido a Cocina</span>
        `;
      }
    }
  }

  /**
   * Genera el mensaje de WhatsApp y abre la conversación
   */
  function sendViaWhatsApp() {
    if (items.length === 0) return;

    const phone = window.VendlyStore?.whatsappNumber || window.VendlyStore?.phone || '';
    const storeName = window.VendlyStore?.businessName || 'Restaurante';
    const mesa = window.VendlyStore?.tableNumber || 'Mesa no asignada';
    const sym = window.VendlyStore?.currencySymbol || '$';

    let text = `*NUEVA ORDEN — ${storeName.toUpperCase()}*\n`;
    text += `*Ubicación:* Mesa ${mesa}\n`;
    if (customerNameInput && customerNameInput.value.trim()) {
      text += `*Cliente:* ${customerNameInput.value.trim()}\n`;
    }
    text += `───────────────────────\n`;

    items.forEach(it => {
      text += `• *${it.quantity}x ${it.name}* (${sym}${(it.unit_price * it.quantity).toFixed(2)})\n`;
      if (it.options && it.options.length > 0) {
        it.options.forEach(opt => {
          const add = opt.additional_price > 0 ? ` (+${sym}${opt.additional_price.toFixed(2)})` : '';
          text += `   - ${opt.name}${add}\n`;
        });
      }
      if (it.notes) {
        text += `   _Nota: ${it.notes}_\n`;
      }
    });

    text += `───────────────────────\n`;
    text += `Subtotal: ${sym}${getSubtotal().toFixed(2)}\n`;
    if (tipPercent > 0) {
      text += `Propina sugerida (${tipPercent}%): ${sym}${getTipAmount().toFixed(2)}\n`;
    }
    text += `*TOTAL ESTIMADO: ${sym}${getTotal().toFixed(2)}*\n\n`;

    if (tableNotesInput && tableNotesInput.value.trim()) {
      text += `*Instrucciones:* ${tableNotesInput.value.trim()}\n`;
    }
    text += `_Pedido registrado desde Menú Digital VendlyPOS_`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  }

  /**
   * Muestra la pantalla de confirmación exitosa
   */
  function showSuccessModal(orderCode, mesa) {
    const successModal = document.getElementById('order-success-modal');
    const folioEl = document.getElementById('success-order-folio');
    const mesaEl = document.getElementById('success-order-mesa');

    if (folioEl) folioEl.textContent = orderCode || '#M01-0000';
    if (mesaEl) mesaEl.textContent = mesa || '01';

    if (successModal) {
      successModal.style.display = 'flex';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Inicialización de eventos DOM
  document.addEventListener('DOMContentLoaded', () => {
    if (floatingBar) {
      floatingBar.addEventListener('click', openDrawer);
    }

    const closeBtn = document.getElementById('btn-close-drawer');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeDrawer();
      });
    }

    // Botones de propina
    document.querySelectorAll('.tip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.tip, 10);
        setTipPercent(p);
      });
    });

    if (btnSubmitKitchen) {
      btnSubmitKitchen.addEventListener('click', submitKitchenOrder);
    }

    const btnWhatsApp = document.getElementById('btn-submit-whatsapp');
    if (btnWhatsApp) {
      btnWhatsApp.addEventListener('click', sendViaWhatsApp);
    }

    const btnSuccessOk = document.getElementById('btn-success-modal-ok');
    if (btnSuccessOk) {
      btnSuccessOk.addEventListener('click', () => {
        const successModal = document.getElementById('order-success-modal');
        if (successModal) successModal.style.display = 'none';
      });
    }
  });

  return {
    addItem,
    updateItemQty,
    removeItem,
    clear,
    loadPersisted,
    openDrawer,
    closeDrawer,
    setTipPercent
  };
})();

window.Cart = Cart;
