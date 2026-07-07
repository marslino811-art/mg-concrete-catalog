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
  // Remove any old social sections to prevent duplicates and ensure a clean replacement.
  document.querySelectorAll('.social-section, .footer-social-section').forEach(el => el.remove());

  const icons = {
    youtube: `<svg viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.4333 3.1C27.1333 1.88333 26.1167 0.9 24.9 0.6C22.7333 0 14 0 14 0C14 0 5.26667 0 3.1 0.6C1.88333 0.9 0.866667 1.88333 0.566667 3.1C0 5.26667 0 10 0 10C0 10 0 14.7333 0.566667 16.9C0.866667 18.1167 1.88333 19.1 3.1 19.4C5.26667 20 14 20 14 20C14 20 22.7333 20 24.9 19.4C26.1167 19.1 27.1333 18.1167 27.4333 16.9C28 14.7333 28 10 28 10C28 10 28 5.26667 27.4333 3.1Z" fill="#FF0000"/><path d="M11.2 14.2833L18.4833 10L11.2 5.71667V14.2833Z" fill="white"/></svg>`,
    facebook: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 1.5H2C1.725 1.5 1.5 1.725 1.5 2V18C1.5 18.275 1.725 18.5 2 18.5H10.5V12.5H8.5V10H10.5V8C10.5 5.79 11.97 4.5 14.04 4.5C15.03 4.5 15.91 4.58 16.19 4.62V6.9H14.82C13.71 6.9 13.5 7.44 13.5 8.23V10H16L15.5 12.5H13.5V18.5H18C18.275 18.5 18.5 18.275 18.5 18V2C18.5 1.725 18.275 1.5 18 1.5Z" fill="#1877F2"/></svg>`,
    instagram: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ig-grad" cx="0.3" cy="1.2" r="1.5"><stop stop-color="#f09433"/><stop offset="0.4" stop-color="#e6683c"/><stop offset="0.6" stop-color="#dc2743"/><stop offset="0.8" stop-color="#cc2366"/><stop offset="1" stop-color="#bc1888"/></radialGradient></defs><path d="M10 1.5C6.41 1.5 6.02 1.515 5.105 1.56C4.19 1.605 3.515 1.75 2.93 1.965C2.33 2.185 1.845 2.48 1.365 2.96C0.885 3.44 0.59 3.925 0.37 4.525C0.155 5.11 0.01 5.785 0.06 6.695C0.015 7.61 0 7.995 0 10C0 12.005 0.015 12.39 0.06 13.305C0.01 14.215 0.155 14.89 0.37 15.475C0.59 16.075 0.885 16.56 1.365 17.04C1.845 17.52 2.33 17.815 2.93 18.035C3.515 18.25 4.19 18.395 5.105 18.44C6.02 18.485 6.41 18.5 10 18.5C13.59 18.5 13.98 18.485 14.895 18.44C15.81 18.395 16.485 18.25 17.07 18.035C17.67 17.815 18.155 17.52 18.635 17.04C19.115 16.56 19.41 16.075 19.63 15.475C19.845 14.89 19.99 14.215 19.94 13.305C19.985 12.39 20 12.005 20 10C20 7.995 19.985 7.61 19.94 6.695C19.99 5.785 19.845 5.11 19.63 4.525C19.41 3.925 19.115 3.44 18.635 2.96C18.155 2.48 17.67 2.185 17.07 1.965C16.485 1.75 15.81 1.605 14.895 1.56C13.98 1.515 13.59 1.5 10 1.5ZM10 3.18C13.515 3.18 13.88 3.195 14.79 3.24C15.61 3.28 16.115 3.415 16.44 3.545C16.86 3.71 17.165 3.915 17.455 4.205C17.745 4.495 17.95 4.8 18.115 5.22C18.245 5.545 18.38 6.05 18.42 6.87C18.465 7.78 18.48 8.145 18.48 10C18.48 11.855 18.465 12.22 18.42 13.13C18.38 13.95 18.245 14.455 18.115 14.78C17.95 15.2 17.745 15.505 17.455 15.795C17.165 16.085 16.86 16.29 16.44 16.455C16.115 16.585 15.61 16.72 14.79 16.76C13.88 16.805 13.515 16.82 10 16.82C6.485 16.82 6.12 16.805 5.21 16.76C4.39 16.72 3.885 16.585 3.56 16.455C3.14 16.29 2.835 16.085 2.545 15.795C2.255 15.505 2.05 15.2 1.885 14.78C1.755 14.455 1.62 13.95 1.58 13.13C1.535 12.22 1.52 11.855 1.52 10C1.52 8.145 1.535 7.78 1.58 6.87C1.62 6.05 1.755 5.545 1.885 5.22C2.05 4.8 2.255 4.495 2.545 4.205C2.835 3.915 3.14 3.71 3.56 3.545C3.885 3.415 4.39 3.28 5.21 3.24C6.12 3.195 6.485 3.18 10 3.18Z" fill="url(#ig-grad)"/><path d="M10 6.36C7.99 6.36 6.36 7.99 6.36 10C6.36 12.01 7.99 13.64 10 13.64C12.01 13.64 13.64 12.01 13.64 10C13.64 7.99 12.01 6.36 10 6.36ZM10 12.06C8.86 12.06 7.94 11.14 7.94 10C7.94 8.86 8.86 7.94 10 7.94C11.14 7.94 12.06 8.86 12.06 10C12.06 11.14 11.14 12.06 10 12.06Z" fill="url(#ig-grad)"/><path d="M15.335 5.51C15.335 5.92 15.005 6.25 14.595 6.25C14.185 6.25 13.855 5.92 13.855 5.51C13.855 5.1 14.185 4.77 14.595 4.77C15.005 4.77 15.335 5.1 15.335 5.51Z" fill="url(#ig-grad)"/></svg>`,
    tiktok: `<svg viewBox="0 0 20 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.53 0.11C12.37 0.04 12.19 0 12 0H8.5C8.22 0 8 0.22 8 0.5V13.5C8 13.78 8.22 14 8.5 14H12C12.28 14 12.5 13.78 12.5 13.5V9.5C12.5 9.22 12.28 9 12 9H9V2H11.5C11.63 2 11.75 2.05 11.84 2.14C11.93 2.23 11.98 2.35 12 2.48V6.5C12 6.78 12.22 7 12.5 7H16C16.28 7 16.5 6.78 16.5 6.5V2.5C16.5 1.12 15.38 0 14 0C13.35 0 12.89 0.21 12.53 0.11ZM20 5.5C20 5.22 19.78 5 19.5 5H16C15.72 5 15.5 5.22 15.5 5.5V17.5C15.5 19.99 13.49 22 11 22C8.51 22 6.5 19.99 6.5 17.5C6.5 15.01 8.51 13 11 13C11.28 13 11.5 13.22 11.5 13.5V15.5C11.5 15.78 11.28 16 11 16C9.62 16 8.5 17.12 8.5 18.5C8.5 19.88 9.62 21 11 21C12.38 21 13.5 19.88 13.5 18.5V9.5C13.5 9.22 13.72 9 14 9H19.5C19.78 9 20 9.22 20 9.5V5.5ZM4 8.5C4 8.22 3.78 8 3.5 8H0.5C0.22 8 0 8.22 0 8.5V12.5C0 12.78 0.22 13 0.5 13H4C4.28 13 4.5 12.78 4.5 12.5V8.5H4Z" fill="black"/></svg>`,
    whatsapp: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 0C4.48 0 0 4.48 0 10C0 11.85 0.53 13.55 1.44 15.01L0.1 19.9L5.13 18.56C6.53 19.42 8.19 19.99 10 19.99C15.52 19.99 20 15.51 20 9.99C20 4.47 15.52 0 10 0ZM10 18.33C8.39 18.33 6.86 17.82 5.59 16.91L5.24 16.69L2.41 17.58L3.32 14.84L3.08 14.48C2.11 13.14 1.67 11.59 1.67 10C1.67 5.4 5.4 1.67 10 1.67C14.6 1.67 18.33 5.4 18.33 10C18.33 14.6 14.6 18.33 10 18.33ZM14.53 12.05C14.31 12.58 13.31 13.12 12.83 13.27C12.35 13.42 11.76 13.44 11.31 13.27C10.86 13.12 10.08 12.85 9.14 11.99C7.96 10.91 7.21 9.61 7.03 9.31C6.85 9.01 6.73 8.83 6.73 8.56C6.73 8.29 6.82 8.08 7 7.9C7.17 7.73 7.38 7.58 7.59 7.58C7.72 7.58 7.85 7.58 7.96 7.59C8.15 7.61 8.28 7.63 8.41 7.93C8.54 8.23 8.85 9.01 8.93 9.13C9.01 9.25 9.05 9.34 8.97 9.46C8.89 9.58 8.85 9.64 8.73 9.77C8.61 9.89 8.49 10.01 8.38 10.1C8.28 10.18 8.18 10.27 8.31 10.48C8.44 10.69 8.81 11.23 9.31 11.67C9.94 12.23 10.53 12.5 10.74 12.62C10.95 12.74 11.09 12.71 11.23 12.59C11.37 12.47 11.65 12.13 11.83 11.89C12.01 11.65 12.22 11.62 12.44 11.7C12.66 11.78 13.51 12.21 13.73 12.31C13.95 12.41 14.12 12.47 14.18 12.53C14.24 12.59 14.24 12.77 14.18 12.89C14.12 13.01 14.03 13.13 13.94 13.22C14.75 12.52 14.63 12.23 14.53 12.05Z" fill="#25D366"/></svg>`
  };

  const socialLinks = [
    { name: 'YouTube', url: 'https://www.youtube.com/@MG_Concrete', class: 'youtube', icon: icons.youtube },
    { name: 'Facebook', url: 'https://www.facebook.com/groups/630006006204038/?ref=share&mibextid=NSMWBT', class: 'facebook', icon: icons.facebook },
    { name: 'Instagram', url: 'https://www.instagram.com/mg___candles/', class: 'instagram', icon: icons.instagram },
    { name: 'WhatsApp', url: `https://wa.me/${WHATSAPP_NUMBER}`, class: 'whatsapp', icon: icons.whatsapp },
    { name: 'TikTok', url: 'https://www.tiktok.com/@mg.candles1', class: 'tiktok', icon: icons.tiktok }
  ];

  const socialGridHTML = socialLinks.map(link => `
    <a href="${link.url}" target="_blank" rel="noopener" class="social-card ${link.class}-card">
      <div class="social-icon">${link.icon}</div>
      <span class="social-name">${link.name}</span>
    </a>
  `).join('');

  const header = document.querySelector('header');
  if (header) {
      const socialSectionHTML = `
          <section class="social-section">
              <h2 class="social-title">تابعنا على صفحاتنا</h2>
              <p class="social-subtitle">شوف أحدث المنتجات وخطوات التصنيع والعروض على صفحات MG Concrete</p>
              <div class="social-grid">
                ${socialGridHTML}
              </div>
          </section>
      `;
      header.insertAdjacentHTML('afterend', socialSectionHTML);
  }
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
