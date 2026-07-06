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

const productsContainer = document.getElementById("products");
const cartItemsContainer = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const orderTotal = document.getElementById("order-total");
const sendWhatsappBtn = document.getElementById("send-whatsapp");

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

function normalizeProducts(list) {
  return (Array.isArray(list) ? list : []).map((product, index) => {
    const productId = product.id ?? product.code ?? index + 1;
    const images = getProductImages(product);

    return {
      ...product,
      id: productId,
      category: product.category || "منتجات",
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

  renderProducts();
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

function renderProducts() {
  productsContainer.innerHTML = "";

  products.forEach((product) => {
    const images = getProductImages(product);
    const currentImage = images[0] || "";
    productImageIndexes[product.id] = 0;

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

        <div class="prices">
          <div class="price-box">
            <span>بدون فينيش</span>
            <strong>${money(product.price_without_finish)}</strong>
          </div>
          <div class="price-box">
            <span>متفنر / Finished</span>
            <strong>${money(product.price_finished)}</strong>
          </div>
        </div>

        <div class="controls">
          <select id="finish-${product.id}">
            <option value="without_finish">Without Finish</option>
            <option value="finished">Finished</option>
          </select>
          <input id="qty-${product.id}" type="number" min="1" value="1" />
        </div>

        <button class="add-btn" onclick="addToCart('${product.id}')">➕ إضافة للطلب</button>
      </div>
    `;

    productsContainer.appendChild(card);
  });
}

function addToCart(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const finishValue = document.getElementById(`finish-${product.id}`).value;
  const qtyInput = document.getElementById(`qty-${product.id}`);
  const qty = Math.max(1, Number(qtyInput.value || 1));

  const finishLabel = finishValue === "finished" ? "Finished" : "Without Finish";
  const unitPrice = finishValue === "finished" ? product.price_finished : product.price_without_finish;
  const lineTotal = unitPrice * qty;

  cart.push({
    productId: product.id,
    name: product.name,
    finish: finishLabel,
    qty,
    unitPrice,
    lineTotal
  });

  renderCart();
  document.getElementById("cart-section").scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (cart.length === 0) {
    cartItemsContainer.className = "cart-items empty-cart";
    cartItemsContainer.innerHTML = "لسه مفيش منتجات في الطلب";
    return;
  }

  cartItemsContainer.className = "cart-items";
  cartItemsContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <strong>${escapeHtml(item.name)}</strong>
      <small>النوع: ${escapeHtml(item.finish)}</small>
      <small>الكمية: ${item.qty} × ${money(item.unitPrice)}</small>
      <small>الإجمالي: ${money(item.lineTotal)}</small>
      <button class="remove-btn" onclick="removeFromCart(${index})">حذف</button>
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
  message += `ملاحظات: ${notes || "لا توجد"}`;
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

sendWhatsappBtn.addEventListener("click", sendToWhatsapp);
loadProducts();
initImageModal();
