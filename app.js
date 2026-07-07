const WHATSAPP_NUMBER = "201277503326"; // غير الرقم ده لرقمك: 20 + رقمك بدون أول صفر

const fallbackProducts = [
  { id: 1, name: "فازة صغيرة", category: "فازات", price_without_finish: 60, price_finished: 120, image: "images/product1.jpg", images: ["images/product1.jpg"] },
  { id: 2, name: "فازة وسط", category: "فازات", price_without_finish: 90, price_finished: 170, image: "images/product2.jpg", images: ["images/product2.jpg"] },
  { id: 3, name: "طبق ديكور", category: "ديكور", price_without_finish: 70, price_finished: 140, image: "images/product3.jpg", images: ["images/product3.jpg"] },
  { id: 4, name: "حامل شمعة", category: "شموع", price_without_finish: 50, price_finished: 100, image: "images/product4.jpg", images: ["images/product4.jpg"] },
  { id: 5, name: "مبخرة", category: "ديكور", price_without_finish: 80, price_finished: 160, image: "images/product5.jpg", images: ["images/product5.jpg"] }
];

let products = [];
let cart = [];
let productImageIndexes = {};
let productCardQuantities = {};
let productCardFinishes = {};
let activeCategory = 'الكل';
let searchTerm = '';

const productsContainer = document.getElementById("products");
const cartItemsContainer = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const orderTotal = document.getElementById("order-total");
const sendWhatsappBtn = document.getElementById("send-whatsapp");

// --- Floating Cart Button ---
let floatingCartBtn = null;

// --- Image Modal ---
let imageModal = null;
let modalImg = null;
let modalCloseBtn = null;
let modalNextBtn = null;
let modalPrevBtn = null;
let modalCounter = null;
let currentModalProduct = null;
let currentModalImageIndex = 0;

function money(value) {
  return `${Number(value || 0).toFixed(2)} جنيه`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProductImages(product) {
  const result = [];

  if (product.image) result.push(product.image);

  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (img) result.push(img);
    });
  }

  return [...new Set(result.map((x) => String(x).trim()).filter(Boolean))];
}

function normalizePriceOptions(product) {
  const mode = product.price_mode || "dual";
  const existingOptions = Array.isArray(product.price_options)
    ? product.price_options
        .map((option) => ({
          key: String(option.key || "").trim(),
          label: String(option.label || "السعر").trim(),
          price: Number(option.price || 0)
        }))
        .filter((option) => option.key && option.price > 0)
    : [];

  if (existingOptions.length > 0) {
    return existingOptions;
  }

  const withoutPrice = Number(product.price_without_finish || 0);
  const finishedPrice = Number(product.price_finished || 0);

  if (mode === "single") {
    return [{ key: "single", label: "السعر", price: withoutPrice || finishedPrice }].filter((o) => o.price > 0);
  }

  if (mode === "without_only") {
    return [{ key: "without_finish", label: "بدون فينيش", price: withoutPrice }].filter((o) => o.price > 0);
  }

  if (mode === "finished_only") {
    return [{ key: "finished", label: "متفنش (متلون)", price: finishedPrice || withoutPrice }].filter((o) => o.price > 0);
  }

  return [
    { key: "without_finish", label: "بدون فينيش", price: withoutPrice },
    { key: "finished", label: "متفنش (متلون)", price: finishedPrice }
  ].filter((o) => o.price > 0);
}

function normalizeProducts(list) {
  return (Array.isArray(list) ? list : []).map((product, index) => {
    const productId = product.id ?? product.code ?? index + 1;
    const images = getProductImages(product);

    const priceOptions = normalizePriceOptions(product);
    const priceMode = product.price_mode || (priceOptions.length === 1 ? "single" : "dual");

    return {
      ...product,
      id: productId,
      category: product.category || "منتجات",
      price_mode: priceMode,
      price_options: priceOptions,
      price_without_finish: Number(product.price_without_finish || 0),
      price_finished: Number(product.price_finished || 0),
      image: images[0] || "",
      images
    };
  });
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) throw new Error("products.json not loaded");
    products = normalizeProducts(await response.json());
  } catch (error) {
    console.warn("Using fallback demo products:", error.message);
    products = normalizeProducts(fallbackProducts);
  }

  renderFilters();
  renderFilteredProducts();
}

function renderFilters() {
    if (document.getElementById('catalog-tools')) return;

    const toolsHTML = `
        <div id="catalog-tools" class="catalog-tools">
            <input type="search" id="product-search" class="catalog-search" placeholder="ابحث عن منتج...">
            <div id="category-filters" class="category-filters"></div>
        </div>
    `;
    productsContainer.insertAdjacentHTML('beforebegin', toolsHTML);

    const categories = [
        'الكل', 'اشكال', 'اطقم', 'فازات', 'كوسترات', 'صوانى', 'مباخر',
        'جارات', 'شغل رمضان', 'شغل شم النسيم', 'شغل عيد الاضحى',
        'علب مناديل', 'شغل كنسى', 'خامات', 'الوان', 'بودر'
    ];
    const filtersContainer = document.getElementById('category-filters');
    filtersContainer.innerHTML = categories.map(cat => 
        `<button type="button" class="category-chip ${cat === 'الكل' ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
    ).join('');

    filtersContainer.addEventListener('click', e => {
        if (e.target.classList.contains('category-chip')) {
            activeCategory = e.target.dataset.category;
            document.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderFilteredProducts();
        }
    });

    const searchInput = document.getElementById('product-search');
    searchInput.addEventListener('input', e => {
        searchTerm = e.target.value.trim();
        renderFilteredProducts();
    });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  }, 10);

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 50px)';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 500);
  }, 3000);
}

function initFloatingCartButton() {
    const btnHTML = `<button type="button" class="floating-cart-btn" id="floating-cart-btn" style="display: none;">عرض الطلب (<span id="floating-cart-count">0</span>)</button>`;
    document.body.insertAdjacentHTML('beforeend', btnHTML);
    floatingCartBtn = document.getElementById('floating-cart-btn');
    floatingCartBtn.onclick = () => {
        document.getElementById("cart-section").scrollIntoView({ behavior: "smooth", block: "start" });
    };
}

function initImageModal() {
    const modalHTML = `
        <div class="image-modal" id="image-modal" style="display: none;">
            <span class="image-modal-close" id="image-modal-close">&times;</span>
            <button type="button" class="image-modal-nav prev" id="image-modal-prev" aria-label="Previous">‹</button>
            <div class="image-modal-content">
                <img src="" alt="Product Image" class="image-modal-img" id="image-modal-img">
            </div>
            <button type="button" class="image-modal-nav next" id="image-modal-next" aria-label="Next">›</button>
            <div class="image-modal-counter" id="image-modal-counter"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    imageModal = document.getElementById('image-modal');
    modalImg = document.getElementById('image-modal-img');
    modalCloseBtn = document.getElementById('image-modal-close');
    modalNextBtn = document.getElementById('image-modal-next');
    modalPrevBtn = document.getElementById('image-modal-prev');
    modalCounter = document.getElementById('image-modal-counter');

    modalCloseBtn.onclick = closeImageModal;
    imageModal.onclick = (e) => {
        if (e.target === imageModal) {
            closeImageModal();
        }
    };
    modalNextBtn.onclick = () => changeModalImage(1);
    modalPrevBtn.onclick = () => changeModalImage(-1);
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
}

function closeImageModal() {
    if (imageModal) imageModal.style.display = 'none';
    document.removeEventListener('keydown', handleEscKey);
    currentModalProduct = null;
}

function updateImageModal() {
    if (!currentModalProduct) return;
    const images = getProductImages(currentModalProduct);
    if (images.length === 0) {
        closeImageModal();
        return;
    }
    currentModalImageIndex = Math.max(0, Math.min(currentModalImageIndex, images.length - 1));
    modalImg.src = images[currentModalImageIndex];
    if (images.length > 1) {
        modalCounter.textContent = `${currentModalImageIndex + 1} / ${images.length}`;
        modalCounter.style.display = 'block';
        modalNextBtn.style.display = 'block';
        modalPrevBtn.style.display = 'block';
    } else {
        modalCounter.style.display = 'none';
        modalNextBtn.style.display = 'none';
        modalPrevBtn.style.display = 'none';
    }
}

function changeModalImage(direction) {
    if (!currentModalProduct) return;
    const images = getProductImages(currentModalProduct);
    if (images.length <= 1) return;
    currentModalImageIndex = (currentModalImageIndex + direction + images.length) % images.length;
    updateImageModal();
}

function openImageModal(productId, imageIndex) {
    currentModalProduct = products.find(p => String(p.id) === String(productId));
    if (!currentModalProduct) return;
    if (typeof imageIndex === 'number') {
        currentModalImageIndex = imageIndex;
    } else {
        currentModalImageIndex = getCurrentImageIndex(currentModalProduct);
    }
    if (imageModal) imageModal.style.display = 'flex';
    document.addEventListener('keydown', handleEscKey);
    updateImageModal();
}

function getCurrentImageIndex(product) {
  const images = getProductImages(product);
  const current = Number(productImageIndexes[product.id] || 0);
  if (images.length === 0) return 0;
  return Math.max(0, Math.min(current, images.length - 1));
}

function updateProductImage(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const images = getProductImages(product);
  const index = getCurrentImageIndex(product);
  const imageEl = document.getElementById(`product-img-${product.id}`);
  const placeholderEl = document.getElementById(`placeholder-${product.id}`);
  const counterEl = document.getElementById(`image-counter-${product.id}`);

  if (imageEl && placeholderEl) {
    if (images[index]) {
      imageEl.src = images[index];
      imageEl.style.display = "block";
      placeholderEl.style.display = "none";
    } else {
      imageEl.style.display = "none";
      placeholderEl.style.display = "grid";
    }
  }

  if (counterEl) {
    counterEl.textContent = `${index + 1} / ${images.length}`;
  }

  document.querySelectorAll(`[data-thumb-product="${product.id}"]`).forEach((thumb) => {
    thumb.classList.toggle("active", Number(thumb.dataset.thumbIndex) === index);
  });
}

function changeProductImage(productId, direction) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const images = getProductImages(product);
  if (images.length <= 1) return;

  const current = getCurrentImageIndex(product);
  productImageIndexes[product.id] = (current + direction + images.length) % images.length;
  updateProductImage(product.id);
}

function chooseProductImage(productId, index) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const images = getProductImages(product);
  if (index < 0 || index >= images.length) return;

  productImageIndexes[product.id] = index;
  updateProductImage(product.id);
}

function selectFinish(productId, finishValue) {
    productCardFinishes[productId] = finishValue;
    const pricesContainer = document.getElementById(`prices-${productId}`);
    if (!pricesContainer) return;
    const priceBoxes = pricesContainer.querySelectorAll('.price-box');
    priceBoxes.forEach(box => {
        box.classList.toggle('active', box.dataset.finish === finishValue);
    });
}

function changeCardQuantity(productId, change) {
    const currentValue = productCardQuantities[productId] || 1;
    const newValue = Math.max(1, currentValue + change);
    productCardQuantities[productId] = newValue;
    
    const qtyValueEl = document.getElementById(`qty-value-${productId}`);
    if (qtyValueEl) {
        qtyValueEl.textContent = newValue;
    }
}

function updateCartQuantity(index, change) {
    if (!cart[index]) return;
    cart[index].qty += change;
    cart[index].lineTotal = cart[index].qty * cart[index].unitPrice;
    if (cart[index].qty <= 0) removeFromCart(index); else renderCart();
}

function renderFilteredProducts() {
  let filteredProducts = products;

  if (activeCategory !== 'الكل') {
      filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
  }

  if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(lowerSearchTerm) ||
          (p.category && p.category.toLowerCase().includes(lowerSearchTerm)) ||
          (p.code && String(p.code).toLowerCase().includes(lowerSearchTerm))
      );
  }

  productsContainer.innerHTML = "";

  filteredProducts.forEach((product) => {
    const images = getProductImages(product);
    const currentImage = images[0] || "";
    productImageIndexes[product.id] = 0;
    productCardQuantities[product.id] = 1;
    const defaultPriceOption = (product.price_options && product.price_options[0]) ? product.price_options[0].key : 'single';
    productCardFinishes[product.id] = defaultPriceOption;

    const galleryButtons = images.length > 1 ? `
      <button type="button" class="gallery-nav gallery-prev" onclick="changeProductImage('${product.id}', -1)" aria-label="الصورة السابقة">‹</button>
      <button type="button" class="gallery-nav gallery-next" onclick="changeProductImage('${product.id}', 1)" aria-label="الصورة التالية">›</button>
      <div class="image-counter" id="image-counter-${product.id}">1 / ${images.length}</div>
    ` : "";

    const thumbnails = images.length > 1 ? `
      <div class="image-thumbs">
        ${images.map((img, index) => `
          <button type="button"
                  class="image-thumb ${index === 0 ? "active" : ""}"
                  data-thumb-product="${product.id}"
                  data-thumb-index="${index}"
                  onclick="chooseProductImage('${product.id}', ${index})">
            <img src="${escapeHtml(img)}" alt="صورة ${index + 1}" onerror="this.style.display='none';" />
          </button>
        `).join("")}
      </div>
    ` : "";

    const card = document.createElement("article");
    card.className = "product-card";

    const priceBoxesHTML = (product.price_options || []).map(option => `
        <div class="price-box ${productCardFinishes[product.id] === option.key ? 'active' : ''}" data-finish="${option.key}" onclick="selectFinish('${product.id}', '${option.key}')">
            <span>${escapeHtml(option.label)}</span>
            <strong>${money(option.price)}</strong>
        </div>
    `).join('');

    card.innerHTML = `
      <div class="product-image">
        ${currentImage ? `
          <img id="product-img-${product.id}" src="${escapeHtml(currentImage)}" alt="${escapeHtml(product.name)}" onclick="openImageModal('${product.id}')" onerror="this.style.display='none'; document.getElementById('placeholder-${product.id}').style.display='grid';" />
          <div class="placeholder" id="placeholder-${product.id}" style="display:none;" onclick="openImageModal('${product.id}')">صورة المنتج</div>
        ` : `
          <img id="product-img-${product.id}" src="" alt="${escapeHtml(product.name)}" style="display:none;" />
          <div class="placeholder" id="placeholder-${product.id}" style="display:grid;" onclick="openImageModal('${product.id}')">صورة المنتج</div>
        `}
        ${galleryButtons}
      </div>
      ${thumbnails}
      <div class="product-body">
        <div class="product-top">
          <div class="product-title">${escapeHtml(product.name)}</div>
          <div class="category">${escapeHtml(product.category)}</div>
        </div>
        ${product.availability_label ? `<div class="availability-badge ${product.availability_type}">${escapeHtml(product.availability_label)}</div>` : ''}

        <div class="prices ${((product.price_options || []).length === 1) ? 'single-price' : 'dual-price'}" id="prices-${product.id}">
          ${priceBoxesHTML}
        </div>

        <div class="controls">
            <div class="qty-stepper">
                <button class="qty-btn" onclick="changeCardQuantity('${product.id}', -1)" aria-label="Decrease quantity">-</button>
                <span class="qty-value" id="qty-value-${product.id}">1</span>
                <button class="qty-btn" onclick="changeCardQuantity('${product.id}', 1)" aria-label="Increase quantity">+</button>
            </div>
            <button class="add-btn" onclick="addToCart('${product.id}')">➕ إضافة للطلب</button>
        </div>
      </div>
    `;
    
    productsContainer.appendChild(card);
  });
}

function addToCart(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const finishValue = productCardFinishes[productId] || ((product.price_options && product.price_options[0]) ? product.price_options[0].key : 'single');
  const qty = productCardQuantities[productId] || 1;

  // Explicitly find the selected price option with a fallback
  let selectedOption = (product.price_options || []).find(opt => opt.key === finishValue);
  if (!selectedOption && product.price_options && product.price_options.length > 0) {
      selectedOption = product.price_options[0];
  }

  if (!selectedOption) {
      console.error("No price option found for product", productId);
      return;
  }

  const finishLabel = selectedOption.label;
  const unitPrice = selectedOption.price;

  // Check if the same product with the same finish and price already exists
  const existingItem = cart.find(item =>
    String(item.productId) === String(product.id) &&
    item.finish === finishLabel &&
    Number(item.unitPrice) === Number(unitPrice)
  );

  if (existingItem) {
    // If found, just increase the quantity and recalculate the total
    existingItem.qty += qty;
    existingItem.lineTotal = existingItem.qty * existingItem.unitPrice;
  } else {
    // If not found, add a new item to the cart
    cart.push({
      productId: product.id,
      name: product.name,
      finish: finishLabel,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty
    });
  }

  // Reset quantity on card to 1 after adding
  productCardQuantities[productId] = 1;
  document.getElementById(`qty-value-${productId}`).textContent = 1;

  renderCart();
  showToast("تمت إضافة المنتج للطلب ✅");
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  cartCount.textContent = `${totalQty} منتج`;
  orderTotal.textContent = money(total);

  // Update floating cart button
  if (floatingCartBtn) {
      const floatingCartCount = document.getElementById('floating-cart-count');
      if (cart.length > 0) {
          floatingCartBtn.style.display = 'flex';
          if (floatingCartCount) floatingCartCount.textContent = totalQty;
      } else {
          floatingCartBtn.style.display = 'none';
      }
  }

  if (cart.length === 0) {
    cartItemsContainer.className = "cart-items empty-cart";
    cartItemsContainer.innerHTML = "لسه مفيش منتجات في الطلب";
    return;
  }

  cartItemsContainer.className = "cart-items";
  cartItemsContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
        <div class="cart-item-header">
            <div class="cart-item-details">
                <strong>${escapeHtml(item.name)}</strong>
                <small>النوع: ${escapeHtml(item.finish)}</small>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${index})">حذف</button>
        </div>
        <div class="cart-item-footer">
            <div class="cart-qty-controls">
                <button class="qty-btn" onclick="updateCartQuantity(${index}, -1)" aria-label="Decrease quantity">-</button>
                <span class="qty-value">${item.qty}</span>
                <button class="qty-btn" onclick="updateCartQuantity(${index}, 1)" aria-label="Increase quantity">+</button>
            </div>
            <div class="cart-item-total">${money(item.lineTotal)}</div>
        </div>
    </div>
  `).join("");
}

function buildWhatsappMessage() {
  const customerName = document.getElementById("customer-name").value.trim();
  const customerPhone = document.getElementById("customer-phone").value.trim();
  const notes = document.getElementById("order-notes").value.trim();
  const total = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  let message = "طلب جديد من كتالوج MG Concrete\n\n";
  message += `اسم العميل: ${customerName || "غير مذكور"}\n`;
  message += `رقم العميل: ${customerPhone || "غير مذكور"}\n\n`;
  message += "المنتجات:\n";

  cart.forEach((item, index) => {
    message += `${index + 1}) ${item.name}\n`;
    message += `- النوع: ${item.finish}\n`;
    message += `- الكمية: ${item.qty}\n`;
    message += `- سعر الوحدة: ${money(item.unitPrice)}\n`;
    message += `- إجمالي السطر: ${money(item.lineTotal)}\n\n`;
  });

  message += `إجمالي الطلب: ${money(total)}\n`;
  message += `ملاحظات: ${notes || "لا توجد"}\n\n`;
  message += `ملاحظة التوفر: بعض المنتجات قد تحتاج وقت تصنيع حسب التوفر.`;
  return encodeURIComponent(message);
}

function sendToWhatsapp() {
  if (cart.length === 0) {
    alert("ضيف منتج واحد على الأقل للطلب الأول.");
    return;
  }

  const message = buildWhatsappMessage();
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  window.open(url, "_blank");
}

function injectSocialSections() {
  if (document.querySelector('.social-section')) return; // Guard against multiple injections

  const socialLinks = [
      { name: 'YouTube', icon: '▶️', url: 'https://www.youtube.com/@MG_Concrete' },
      { name: 'Facebook', icon: '📘', url: 'https://www.facebook.com/groups/630006006204038/?ref=share&mibextid=NSMWBT' },
      { name: 'TikTok', icon: '🎵', url: 'https://www.tiktok.com/@mg.candles1' },
      { name: 'Instagram', icon: '📸', url: 'https://www.instagram.com/mg___candles/' },
      { name: 'WhatsApp', icon: '💬', url: `https://wa.me/${WHATSAPP_NUMBER}` }
  ];

  const createSocialLinksHTML = () => `
      <div class="social-links">
          ${socialLinks.map(link => `
              <a href="${link.url}" target="_blank" rel="noopener" class="social-btn social-${link.name.toLowerCase()}">
                  <span class="social-icon">${link.icon}</span>
                  <span class="social-text">${link.name}</span>
              </a>
          `).join('')}
      </div>
  `;

  const header = document.querySelector('header');
  if (header) {
      const socialSectionHTML = `
          <section class="social-section">
              <p class="social-promo-text">تابعنا وشوف أحدث المنتجات وخطوات التصنيع على صفحات MG Concrete</p>
              ${createSocialLinksHTML()}
          </section>
      `;
      header.insertAdjacentHTML('afterend', socialSectionHTML);
  }

  let footer = document.querySelector('footer');
  if (!footer) {
      footer = document.createElement('footer');
      document.body.appendChild(footer);
  }
  const footerSocialHTML = `
      <div class="footer-social-section">
          <h3>تابعنا على</h3>
          ${createSocialLinksHTML()}
      </div>
  `;
  footer.insertAdjacentHTML('beforeend', footerSocialHTML);
}

// --- Order Card Image Generation ---

function getMergedCartItems() {
  const merged = {};
  cart.forEach(item => {
    // Key ensures that items with same product, finish, and price are grouped
    const key = `${item.productId}-${item.finish}-${item.unitPrice}`;
    if (merged[key]) {
      merged[key].qty += item.qty;
      // Recalculate line total for the merged item
      merged[key].lineTotal = merged[key].qty * merged[key].unitPrice;
    } else {
      // Create a copy to avoid modifying the original cart item
      merged[key] = { ...item };
    }
  });
  return Object.values(merged);
}

function formatMoneySimple(value) {
  return Number(value || 0).toFixed(2);
}

function generateOrderNumber() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MIN = String(now.getMinutes()).padStart(2, '0');
  return `MG-${YYYY}${MM}${DD}-${HH}${MIN}`;
}

async function wrapArabicText(context, text, x, y, maxWidth, lineHeight) {
  const lines = text.split('\n');
  let currentY = y;
  for (const singleLine of lines) {
    const words = singleLine.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

async function canvasToFile(canvas, fileName = 'mg-concrete-order.png') {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png');
  });
}

async function generateOrderCardCanvas() {
  const mergedCart = getMergedCartItems();
  if (mergedCart.length === 0) return null;

  const customerName = document.getElementById("customer-name").value.trim() || "غير محدد";
  const customerPhone = document.getElementById("customer-phone").value.trim() || "غير محدد";
  const notes = document.getElementById("order-notes").value.trim() || "لا توجد";
  const grandTotal = mergedCart.reduce((sum, item) => sum + item.lineTotal, 0);

  // Estimate dynamic height
  const tempCtx = document.createElement('canvas').getContext('2d');
  tempCtx.font = '20px Arial';
  const notesLines = (notes.split('\n').length) + Math.floor(tempCtx.measureText(notes).width / 800);
  const dynamicHeight = 590 + (mergedCart.length * 40) + (notesLines * 30);

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = dynamicHeight;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header
  ctx.fillStyle = '#0B2D4D';
  ctx.fillRect(0, 0, canvas.width, 100);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MG Concrete', canvas.width / 2, 65);

  let y = 160;
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('كارت طلب عميل', canvas.width / 2, y);
  y += 60;

  // Order Info
  ctx.font = '22px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`رقم الطلب: ${generateOrderNumber()}`, 850, y);
  ctx.fillText(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, 850, y + 35);
  ctx.fillText(`اسم العميل: ${customerName}`, 500, y);
  ctx.fillText(`رقم الهاتف: ${customerPhone}`, 500, y + 35);
  y += 80;

  // Table Header
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(50, y, 800, 40);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('الصنف', 830, y + 28);
  ctx.textAlign = 'center';
  ctx.fillText('الكمية', 420, y + 28);
  ctx.fillText('سعر الوحدة', 280, y + 28);
  ctx.fillText('الإجمالي', 140, y + 28);
  y += 55;

  // Table Items
  ctx.font = '20px Arial';
  mergedCart.forEach(item => {
    ctx.textAlign = 'right';
    ctx.fillText(item.finish === 'السعر' ? item.name : `${item.name} (${item.finish.replace(' (متلون)', '')})`, 830, y);
    ctx.textAlign = 'center';
    ctx.fillText(item.qty, 420, y);
    ctx.fillText(formatMoneySimple(item.unitPrice), 280, y);
    ctx.fillText(formatMoneySimple(item.qty * item.unitPrice), 140, y);
    y += 40;
  });

  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(50, y - 15, 800, 2);
  y += 20;

  // Grand Total
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('الإجمالي الكلي:', 850, y);
  ctx.textAlign = 'left';
  ctx.fillText(`${formatMoneySimple(grandTotal)} جنيه`, 250, y);
  y += 60;

  // Notes
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('ملاحظات:', 850, y);
  y += 35;
  ctx.font = '20px Arial';
  y = await wrapArabicText(ctx, notes, 850, y, 800, 30);

  // Availability Note
  ctx.font = 'italic 18px Arial';
  ctx.fillStyle = '#6B7280';
  ctx.textAlign = 'center';
  ctx.fillText('ملاحظة: بعض المنتجات قد تحتاج وقت تصنيع حسب التوفر.', canvas.width / 2, canvas.height - 70);

  // Footer
  ctx.fillStyle = '#0B2D4D';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('شكراً لاختيارك MG Concrete', canvas.width / 2, canvas.height - 20);

  return canvas;
}

async function shareOrderCard() {
  if (cart.length === 0) {
    alert("لا يمكن مشاركة كارت طلب فارغ. ضيف منتجات الأول.");
    return;
  }

  const canvas = await generateOrderCardCanvas();
  if (!canvas) return;

  const orderFile = await canvasToFile(canvas);
  const shareData = {
    files: [orderFile],
    title: 'طلب جديد - MG Concrete',
    text: 'طلب جديد من كتالوج MG Concrete',
  };

  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error('Share failed:', err.message);
    }
  } else {
    const link = document.createElement('a');
    link.download = 'mg-concrete-order.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    alert('متصفحك لا يدعم المشاركة المباشرة للملفات.\n\nتم تحميل صورة الطلب. من فضلك أرسلها يدويًا على واتساب.');
  }
}

sendWhatsappBtn.addEventListener("click", sendToWhatsapp);
loadProducts();
initImageModal();
initFloatingCartButton();
injectSocialSections();

const shareCardBtn = document.createElement('button');
shareCardBtn.id = 'share-order-card-btn';
shareCardBtn.className = 'order-card-btn';
shareCardBtn.textContent = '📸 مشاركة كارت الطلب';
shareCardBtn.addEventListener('click', shareOrderCard);
sendWhatsappBtn.after(shareCardBtn);
