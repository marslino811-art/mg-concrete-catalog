/*
 * MG Concrete Catalog - Direct Quantity Editor
 *
 * يضيف إمكانية الضغط على رقم الكمية وكتابة العدد مباشرة:
 * - داخل كارت المنتج.
 * - داخل نافذة تفاصيل المنتج.
 * - داخل سلة الطلب.
 *
 * الملف يعمل كإضافة فوق app.js بدون حذف وظائف الكتالوج الحالية.
 */
(function () {
  "use strict";

  const MIN_QTY = 1;
  const MAX_QTY = 999999;

  function normalizeDigits(value) {
    return String(value ?? "")
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[^\d]/g, "");
  }

  function cleanQuantity(value, fallback = MIN_QTY) {
    const normalized = normalizeDigits(value);
    const parsed = Number.parseInt(normalized, 10);

    if (!Number.isFinite(parsed)) {
      return Math.max(MIN_QTY, Number(fallback) || MIN_QTY);
    }

    return Math.min(MAX_QTY, Math.max(MIN_QTY, parsed));
  }

  function selectInputText(input) {
    try {
      input.select();
    } catch (_) {
      // بعض متصفحات الهاتف لا تدعم select() في كل الحالات.
    }
  }

  function configureQuantityInput(input, onCommit) {
    input.type = "number";
    input.min = String(MIN_QTY);
    input.max = String(MAX_QTY);
    input.step = "1";
    input.inputMode = "numeric";
    input.pattern = "[0-9]*";
    input.autocomplete = "off";
    input.classList.add("direct-qty-input");
    input.setAttribute("aria-label", "اكتب الكمية المطلوبة");

    let lastValidValue = cleanQuantity(input.value || MIN_QTY);

    const commit = () => {
      const quantity = cleanQuantity(input.value, lastValidValue);
      lastValidValue = quantity;
      input.value = String(quantity);
      onCommit(quantity);
    };

    input.addEventListener("focus", () => {
      window.setTimeout(() => selectInputText(input), 0);
    });

    input.addEventListener("click", () => {
      selectInputText(input);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
        input.blur();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        input.value = String(lastValidValue);
        input.blur();
      }
    });

    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  }

  function replaceSpanWithInput(span, initialValue, onCommit, inputId = "") {
    if (!span || span.tagName === "INPUT") {
      return span;
    }

    const input = document.createElement("input");
    input.value = String(cleanQuantity(initialValue));

    if (inputId) {
      input.id = inputId;
    }

    Array.from(span.classList).forEach((className) => {
      input.classList.add(className);
    });

    configureQuantityInput(input, onCommit);
    span.replaceWith(input);
    return input;
  }

  function setCardQuantityDirect(productId, rawValue) {
    const quantity = cleanQuantity(rawValue);
    productCardQuantities[productId] = quantity;

    const quantityInput = document.getElementById(`qty-value-${productId}`);
    if (quantityInput) {
      if ("value" in quantityInput) {
        quantityInput.value = String(quantity);
      } else {
        quantityInput.textContent = String(quantity);
      }
    }

    return quantity;
  }

  function enhanceProductCardQuantities() {
    document.querySelectorAll('[id^="qty-value-"]').forEach((element) => {
      if (element.tagName === "INPUT") {
        return;
      }

      const productId = element.id.replace("qty-value-", "");
      const currentValue = productCardQuantities[productId] || element.textContent || MIN_QTY;

      replaceSpanWithInput(
        element,
        currentValue,
        (quantity) => setCardQuantityDirect(productId, quantity),
        `qty-value-${productId}`
      );
    });
  }

  function setDetailsQuantityDirect(rawValue) {
    const quantity = cleanQuantity(rawValue);
    modalProductState.qty = quantity;

    const input = document.getElementById("details-qty-value");
    if (input) {
      if ("value" in input) {
        input.value = String(quantity);
      } else {
        input.textContent = String(quantity);
      }
    }

    return quantity;
  }

  function enhanceDetailsQuantity() {
    const element = document.getElementById("details-qty-value");
    if (!element || element.tagName === "INPUT") {
      return;
    }

    replaceSpanWithInput(
      element,
      modalProductState.qty || element.textContent || MIN_QTY,
      setDetailsQuantityDirect,
      "details-qty-value"
    );
  }

  function setCartQuantityDirect(index, rawValue) {
    if (!Array.isArray(cart) || !cart[index]) {
      return;
    }

    const quantity = cleanQuantity(rawValue, cart[index].qty);
    cart[index].qty = quantity;
    cart[index].lineTotal = quantity * Number(cart[index].unitPrice || 0);
    renderCart();
  }

  function enhanceCartQuantities() {
    document.querySelectorAll(".cart-qty-controls").forEach((container, index) => {
      const element = container.querySelector(".qty-value");
      if (!element || element.tagName === "INPUT" || !cart[index]) {
        return;
      }

      const input = replaceSpanWithInput(
        element,
        cart[index].qty,
        (quantity) => setCartQuantityDirect(index, quantity)
      );

      input.dataset.cartIndex = String(index);
    });
  }

  function enhanceAllQuantityEditors() {
    enhanceProductCardQuantities();
    enhanceDetailsQuantity();
    enhanceCartQuantities();
  }

  function injectStyles() {
    if (document.getElementById("direct-quantity-editor-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "direct-quantity-editor-style";
    style.textContent = `
      .direct-qty-input,
      .qty-stepper .direct-qty-input,
      .cart-qty-controls .direct-qty-input {
        width: 78px !important;
        min-width: 64px;
        height: 42px;
        box-sizing: border-box;
        border: 2px solid #CBD5E1;
        border-radius: 10px;
        background: #FFFFFF;
        color: #0B2D4D;
        font: 800 18px Arial, sans-serif;
        text-align: center;
        direction: ltr;
        outline: none;
        padding: 4px 6px;
        appearance: textfield;
        -moz-appearance: textfield;
      }

      .direct-qty-input:focus {
        border-color: #1E6BFF;
        box-shadow: 0 0 0 3px rgba(30, 107, 255, 0.15);
      }

      .direct-qty-input::-webkit-outer-spin-button,
      .direct-qty-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .cart-qty-controls {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      @media (max-width: 600px) {
        .direct-qty-input,
        .qty-stepper .direct-qty-input,
        .cart-qty-controls .direct-qty-input {
          width: 72px !important;
          height: 40px;
          font-size: 17px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function installFunctionWrappers() {
    const originalChangeCardQuantity = changeCardQuantity;
    changeCardQuantity = function (productId, change) {
      const currentValue = cleanQuantity(productCardQuantities[productId] || MIN_QTY);
      return setCardQuantityDirect(productId, currentValue + Number(change || 0));
    };

    const originalChangeDetailsQuantity = changeDetailsModalQuantity;
    changeDetailsModalQuantity = function (change) {
      const currentValue = cleanQuantity(modalProductState.qty || MIN_QTY);
      return setDetailsQuantityDirect(currentValue + Number(change || 0));
    };

    const originalAddToCart = addToCart;
    addToCart = function (productId) {
      const result = originalAddToCart(productId);
      setCardQuantityDirect(productId, MIN_QTY);
      window.setTimeout(enhanceAllQuantityEditors, 0);
      return result;
    };

    const originalRenderCart = renderCart;
    renderCart = function () {
      const result = originalRenderCart();
      window.setTimeout(enhanceCartQuantities, 0);
      return result;
    };

    const originalRenderFilteredProducts = renderFilteredProducts;
    renderFilteredProducts = function () {
      const result = originalRenderFilteredProducts();
      window.setTimeout(enhanceProductCardQuantities, 0);
      return result;
    };

    const originalOpenDetailsModal = openDetailsModal;
    openDetailsModal = function (productId) {
      const result = originalOpenDetailsModal(productId);
      window.setTimeout(enhanceDetailsQuantity, 0);
      return result;
    };

    // احتفاظ بالمراجع يمنع بعض أدوات الضغط من اعتبارها غير مستخدمة.
    void originalChangeCardQuantity;
    void originalChangeDetailsQuantity;
  }

  function installObserver() {
    const observer = new MutationObserver(() => {
      enhanceAllQuantityEditors();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function initialize() {
    injectStyles();
    installFunctionWrappers();
    installObserver();
    enhanceAllQuantityEditors();
    console.log("MG CATALOG DIRECT QUANTITY EDITOR READY");
  }

  initialize();
})();
