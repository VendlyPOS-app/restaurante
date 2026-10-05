/**
 * VendlyPOS Menú Digital Gastronómico — Modifiers Engine (modifiers.js)
 * Motor interactivo de personalización de platillos con grupos y opciones
 */

const Modifiers = (() => {
  let activeDish = null;
  let selectedByGroup = {}; // { [groupId]: [ { id, name, additional_price } ] }
  let specialNotes = '';
  let quantity = 1;

  // Elementos DOM del Sheet de Modificadores
  const overlay = document.getElementById('modifiers-overlay');
  const sheet = document.getElementById('modifiers-sheet');
  const dishThumb = document.getElementById('sheet-dish-thumb');
  const dishTitle = document.getElementById('sheet-dish-title');
  const dishBasePrice = document.getElementById('sheet-dish-base-price');
  const dishCategory = document.getElementById('sheet-dish-category');
  const groupsContainer = document.getElementById('sheet-groups-container');
  const notesTextarea = document.getElementById('sheet-notes-input');
  const qtyValEl = document.getElementById('sheet-qty-val');
  const confirmBtn = document.getElementById('btn-confirm-dish');
  const confirmBtnText = document.getElementById('btn-confirm-dish-text');

  /**
   * Abre el modal de modificadores para un platillo dado
   * @param {Object} dish
   */
  function open(dish) {
    if (!dish) return;

    activeDish = dish;
    selectedByGroup = {};
    specialNotes = '';
    quantity = 1;

    // Pre-selección inteligente: si un grupo obligatorio de selección única tiene opciones, pre-seleccionar la primera
    const groups = dish.modifier_groups || [];
    groups.forEach(g => {
      selectedByGroup[g.id] = [];
      if (g.min_selectable === 1 && g.max_selectable === 1 && g.options && g.options.length > 0) {
        selectedByGroup[g.id] = [g.options[0]];
      }
    });

    // Cargar datos en el header
    if (dishThumb) {
      dishThumb.src = dish.image_url || 'assets/img/placeholder-dish.svg';
      dishThumb.alt = dish.name;
    }
    if (dishTitle) dishTitle.textContent = dish.name;
    if (dishCategory) dishCategory.textContent = dish.category || '';
    if (dishBasePrice) {
      const sym = window.VendlyStore?.currencySymbol || '$';
      dishBasePrice.textContent = `${sym}${dish.price.toFixed(2)}`;
    }
    if (notesTextarea) notesTextarea.value = '';
    if (qtyValEl) qtyValEl.textContent = '1';

    renderGroups();
    updateFooter();

    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Cierra el modal de modificadores
   */
  function close() {
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    activeDish = null;
  }

  /**
   * Renderiza los grupos y opciones de modificadores
   */
  function renderGroups() {
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';

    const groups = activeDish.modifier_groups || [];
    if (groups.length === 0) {
      groupsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 20px 0; font-size: 0.9rem;">
          Este platillo no requiere opciones adicionales.
        </div>
      `;
      return;
    }

    groups.forEach(group => {
      const selected = selectedByGroup[group.id] || [];
      const isSingleChoice = group.max_selectable === 1;
      const isRequired = group.min_selectable > 0;
      const isSatisfied = selected.length >= group.min_selectable;

      const groupCard = document.createElement('div');
      groupCard.className = `mod-group-card ${isRequired && !isSatisfied ? 'has-error' : ''}`;
      groupCard.id = `mod-group-${group.id}`;

      let badgeHtml = '';
      if (isRequired) {
        badgeHtml = `<span class="mod-badge required ${isSatisfied ? 'satisfied' : ''}">
          ${isSatisfied ? 'Listo' : `Obligatorio (elige ${group.min_selectable})`}
        </span>`;
      } else {
        badgeHtml = `<span class="mod-badge optional">
          Opcional (hasta ${group.max_selectable})
        </span>`;
      }

      groupCard.innerHTML = `
        <div class="mod-group-header">
          <div class="mod-group-title-wrap">
            <span class="mod-group-title">${escapeHtml(group.title)}</span>
            <span class="mod-group-meta">
              ${isSingleChoice ? 'Selecciona 1 opción' : `Elige hasta ${group.max_selectable} opciones`}
            </span>
          </div>
          ${badgeHtml}
        </div>
        <div class="mod-options-list" id="mod-options-${group.id}"></div>
      `;

      const optionsList = groupCard.querySelector(`#mod-options-${group.id}`);

      (group.options || []).forEach(opt => {
        const isSelected = selected.some(s => s.id === opt.id);
        const atMaxLimit = !isSingleChoice && selected.length >= group.max_selectable && !isSelected;

        const optRow = document.createElement('div');
        optRow.className = `mod-option-row ${isSingleChoice ? 'radio-mode' : 'checkbox-mode'} ${isSelected ? 'selected' : ''} ${atMaxLimit ? 'disabled' : ''}`;

        const priceTag = opt.additional_price > 0
          ? `+${window.VendlyStore?.currencySymbol || '$'}${parseFloat(opt.additional_price).toFixed(2)}`
          : 'Incluido';

        optRow.innerHTML = `
          <div class="mod-option-left">
            <span class="mod-custom-control"></span>
            <span class="mod-option-name">${escapeHtml(opt.name)}</span>
          </div>
          <span class="mod-option-price">${priceTag}</span>
        `;

        if (!atMaxLimit) {
          optRow.addEventListener('click', () => {
            toggleOption(group, opt);
          });
        }

        optionsList.appendChild(optRow);
      });

      groupsContainer.appendChild(groupCard);
    });
  }

  /**
   * Maneja el clic sobre una opción (selección única o múltiple)
   */
  function toggleOption(group, option) {
    const isSingleChoice = group.max_selectable === 1;
    let selected = selectedByGroup[group.id] || [];

    if (isSingleChoice) {
      selectedByGroup[group.id] = [option];
    } else {
      const existsIndex = selected.findIndex(s => s.id === option.id);
      if (existsIndex >= 0) {
        selected.splice(existsIndex, 1);
      } else {
        if (selected.length < group.max_selectable) {
          selected.push(option);
        }
      }
      selectedByGroup[group.id] = selected;
    }

    renderGroups();
    updateFooter();
  }

  /**
   * Modifica la cantidad de platillos que se van a agregar
   */
  function changeQuantity(delta) {
    quantity = Math.max(1, quantity + delta);
    if (qtyValEl) qtyValEl.textContent = quantity;
    updateFooter();
  }

  /**
   * Calcula el precio unitario sumando el precio base del platillo más los adicionales
   */
  function calculateItemUnitPrice() {
    if (!activeDish) return 0.0;
    let unit = activeDish.price || 0.0;
    Object.values(selectedByGroup).forEach(list => {
      list.forEach(opt => {
        unit += parseFloat(opt.additional_price || 0.0);
      });
    });
    return unit;
  }

  /**
   * Valida si todos los grupos obligatorios han sido completados
   */
  function validateAllRequiredGroups() {
    if (!activeDish) return false;
    const groups = activeDish.modifier_groups || [];
    for (const g of groups) {
      if (g.min_selectable > 0) {
        const count = (selectedByGroup[g.id] || []).length;
        if (count < g.min_selectable) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Actualiza el botón de confirmación con el total dinámico
   */
  function updateFooter() {
    const unitPrice = calculateItemUnitPrice();
    const totalPrice = unitPrice * quantity;
    const isValid = validateAllRequiredGroups();
    const sym = window.VendlyStore?.currencySymbol || '$';

    if (confirmBtn) {
      confirmBtn.disabled = !isValid;
    }

    if (confirmBtnText) {
      if (isValid) {
        confirmBtnText.textContent = `Agregar a la Comanda • ${sym}${totalPrice.toFixed(2)}`;
      } else {
        confirmBtnText.textContent = `Completa las selecciones obligatorias`;
      }
    }
  }

  /**
   * Confirma la personalización y agrega el ítem a la Comanda
   */
  function confirm() {
    if (!activeDish) return;

    if (!validateAllRequiredGroups()) {
      // Hacer scroll al primer grupo obligatorio faltante
      const groups = activeDish.modifier_groups || [];
      for (const g of groups) {
        const count = (selectedByGroup[g.id] || []).length;
        if (g.min_selectable > 0 && count < g.min_selectable) {
          const el = document.getElementById(`mod-group-${g.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('has-error');
          }
          break;
        }
      }
      return;
    }

    // Aplanar opciones seleccionadas
    const allSelectedOptions = [];
    Object.keys(selectedByGroup).forEach(gid => {
      const g = (activeDish.modifier_groups || []).find(x => String(x.id) === String(gid));
      (selectedByGroup[gid] || []).forEach(opt => {
        allSelectedOptions.push({
          group_id: g ? g.id : gid,
          group_title: g ? g.title : '',
          id: opt.id,
          name: opt.name,
          additional_price: parseFloat(opt.additional_price || 0.0)
        });
      });
    });

    const notes = notesTextarea ? notesTextarea.value.trim() : '';

    if (window.Cart && typeof window.Cart.addItem === 'function') {
      window.Cart.addItem(activeDish, allSelectedOptions, notes, quantity);
    }

    close();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Enlazar eventos DOM globales del sheet
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('btn-close-modifiers');
    if (closeBtn) closeBtn.addEventListener('click', close);

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    const qtyMinus = document.getElementById('sheet-qty-minus');
    const qtyPlus = document.getElementById('sheet-qty-plus');
    if (qtyMinus) qtyMinus.addEventListener('click', () => changeQuantity(-1));
    if (qtyPlus) qtyPlus.addEventListener('click', () => changeQuantity(1));

    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirm);
    }
  });

  return {
    open,
    close,
    confirm
  };
})();

window.Modifiers = Modifiers;
