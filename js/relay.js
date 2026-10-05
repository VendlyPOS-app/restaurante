/**
 * VendlyPOS Menú Digital Gastronómico — Relay Service (relay.js)
 * Conexión resiliente con PocketBase y despacho directo a cocina
 */

const Relay = (() => {
  const DEFAULT_POCKETBASE_URL = 'https://api.vendlypos.shop';

  let baseUrl = DEFAULT_POCKETBASE_URL;

  function setBaseUrl(url) {
    if (url && typeof url === 'string') {
      baseUrl = url.replace(/\/+$/, '');
    }
  }

  /**
   * Carga los datos de la tienda (perfil comercial y configuración de mesa)
   * @param {string} storeId
   * @returns {Promise<Object|null>}
   */
  async function fetchStore(storeId) {
    const cleanId = (storeId || '').toLowerCase().trim();
    if (!cleanId) return null;

    try {
      const endpoint = `${baseUrl}/api/collections/stores/records?filter=(store_id='${cleanId}')`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const rec = data.items[0];
          return {
            id: rec.store_id || cleanId,
            store_id: rec.store_id || cleanId,
            businessName: rec.businessName || rec.business_name || '',
            businessType: rec.businessType || 'restaurant',
            tagline: rec.tagline || '',
            phone: rec.phone || '',
            whatsappNumber: rec.whatsappNumber || rec.whatsapp_number || rec.phone || '',
            address: rec.address || '',
            schedule: rec.schedule || '',
            footer: rec.footer || '',
            currencySymbol: rec.currencySymbol || '$',
            allowDineIn: rec.allowDineIn !== false,
            bannerUrl: rec.banner_url || rec.bannerUrl || '',
            logoUrl: 'assets/img/logo-vendlypos.svg'
          };
        }
      }
    } catch (err) {
      console.warn('[Relay] Error conectando a PocketBase para store:', err);
    }

    return null;
  }

  /**
   * Carga el catálogo gastronómico de productos y modificadores
   * @param {string} storeId
   * @returns {Promise<{categories: string[], products: Array}>}
   */
  async function fetchMenu(storeId) {
    const cleanId = (storeId || '').toLowerCase().trim();
    if (!cleanId) {
      return { categories: ['Todos'], products: [] };
    }

    try {
      const endpoint = `${baseUrl}/api/collections/products/records?filter=(store_id='${cleanId}')&perPage=500`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const products = data.items.map(p => {
            // Deserializar modifier_groups si viene como string JSON
            let modGroups = p.modifier_groups;
            if (typeof modGroups === 'string' && modGroups.trim()) {
              try {
                modGroups = JSON.parse(modGroups);
              } catch (e) {
                modGroups = [];
              }
            }
            if (!Array.isArray(modGroups)) {
              modGroups = [];
            }

            return {
              id: p.sku || p.id,
              sku: p.sku || p.id,
              name: p.name || 'Platillo',
              category: p.category || 'General',
              description: p.description || p.web_description || '',
              price: parseFloat(p.price || 0.0),
              stock: parseInt(p.stock || 0, 10),
              image_url: p.image_url || p.imagePath || p.image || 'assets/img/placeholder-dish.svg',
              is_active: p.isActive !== false && p.is_active !== false,
              is_sold_out: p.is_sold_out !== undefined ? Boolean(p.is_sold_out) : Boolean(p.stock !== undefined && p.stock <= 0),
              badge: p.badge || p.web_badge || '',
              modifier_groups: modGroups
            };
          });

          // Extraer categorías dinámicamente preservando orden
          const catsSet = new Set(['Todos']);
          products.forEach(p => {
            if (p.category) catsSet.add(p.category.trim());
          });

          return {
            categories: Array.from(catsSet),
            products: products
          };
        }
      }
    } catch (err) {
      console.warn('[Relay] Error conectando a PocketBase para productos:', err);
    }

    return { categories: ['Todos'], products: [] };
  }

  /**
   * Envía la comanda de la mesa hacia la colección 'orders' de PocketBase
   * @param {Object} orderPayload
   * @returns {Promise<{ok: boolean, order_code: string, message?: string}>}
   */
  async function submitOrder(orderPayload) {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const mesaPrefix = (orderPayload.table_number || 'M01').replace(/[^a-zA-Z0-9]/g, '').slice(-3);
    const generatedOrderCode = `#M${mesaPrefix}-${randomCode}`;

    const pbPayload = {
      store_id: orderPayload.store_id || '',
      order_number: generatedOrderCode,
      order_code: generatedOrderCode,
      customer_name: orderPayload.customer_name || `Mesa ${orderPayload.table_number || ''}`,
      customer_phone: orderPayload.customer_phone || '',
      delivery_address: `En Salón — Mesa ${orderPayload.table_number || 'N/A'}`,
      payment_method: 'mesa_en_salon',
      total_amount: parseFloat(orderPayload.total_amount || 0.0),
      notes: `[PEDIDO MESA ${orderPayload.table_number || 'N/A'}] ${orderPayload.notes || ''}`.trim(),
      items: orderPayload.items || [],
      status: 'pending'
    };

    try {
      const endpoint = `${baseUrl}/api/collections/orders/records`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(pbPayload),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const saved = await res.json();
        return {
          ok: true,
          order_code: saved.order_number || generatedOrderCode,
          record_id: saved.id
        };
      }
    } catch (err) {
      console.warn('[Relay] Error enviando orden a PocketBase:', err);
    }

    return {
      ok: false,
      message: 'No fue posible registrar la orden. Por favor solicita atención a tu mesero.'
    };
  }

  return {
    setBaseUrl,
    fetchStore,
    fetchMenu,
    submitOrder
  };
})();
