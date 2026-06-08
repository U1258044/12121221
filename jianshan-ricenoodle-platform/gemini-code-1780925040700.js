// ==========================================================================
// 苗栗頭份尖山米粉數位轉型專案 - 前端智慧金流與 Offline-First 備援引擎
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 商業常數與金流指標
    const FREE_SHIPPING_LIMIT = 1000;
    const FLAT_SHIPPING_FEE = 100;
    let cart = {};
    let totalItemsInCart = 0;
    let computedCartTotal = 0;
    let computedTotalBags = 0;
    let currentRepurchaseString = '';
    let isExitIntentTriggered = false;
    let isCouponApplied = false;

    // DOM 節點快取
    const botScreen = document.getElementById('chatbot-screen');
    const botInput = document.getElementById('ai-input');
    const offlineBadge = document.getElementById('offline-badge');

    // ==========================================
    // 1. GA4 事件追蹤機制 
    // ==========================================
    window.logGA4Event = function(eventName, params = {}) {
        if (typeof gtag!== 'undefined') {
            gtag('event', eventName, params);
            console.log(`%c[GA4]%c ${eventName}`, 'color: #059669; font-weight: bold;', 'color: inherit;', params);
        } else {
            console.log(`%c[Mock GA4]%c ${eventName}`, 'color: #94a3b8; font-style: italic;', 'color: inherit;', params);
        }
    };

    window.trackClick = function(ctaId) {
        logGA4Event('click_cta_button', { cta_identifier: ctaId, page_path: window.location.pathname });
    };

    // ==========================================
    // 2. Offline-First 智慧灶腳 (本機離線正則匹配引擎) 
    // ==========================================
    function updateOnlineStatus() {
        if (navigator.onLine) {
            offlineBadge.classList.add('hidden');
            offlineBadge.classList.remove('flex');
            console.log("🟢 網路已連線，AI Assistant 進入雲端最佳化運作。");
        } else {
            offlineBadge.classList.remove('hidden');
            offlineBadge.classList.add('flex');
            toast("📡 已啟用訊號保護模式，AI將離線本端回答您的問題！", "warning");
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // 初始化即時連線監測

    // 常用智慧標籤離線庫 
    const aiResponses = {
        '⏱️ 15分鐘科技速煮': '【阿婆15分鐘快手乾拌水粉】：科技人加班太晚？阿婆推薦這道！<br>1. 燒一鍋熱水，將尖山水粉放入煮2分鐘撈出。<br>2. 拌入紅蔥頭油、一點薄鹽醬油、香菇肉燥。<br>3. 丟幾片小白菜與一個荷包蛋。<br>水粉本身是熟的，極速吸香，吃完胃溫慢好消化！',
        '👶 告別挑食！親子黃金南瓜水粉': '【親子黃金南瓜吸汁水粉】：家裡孩子挑食不吃青菜？<br>1. 南瓜去皮蒸熟，用叉子壓成南瓜泥。<br>2. 爆香蒜末，放入南瓜泥與高湯熬成金黃色濃郁湯底。<br>3. 將尖山粗水粉放下去，因為條體有天然風乾微孔，會像吸管一樣把金黃南瓜甜湯吸得滿滿的，孩子超愛！',
        '🌱 輕盈食安！低卡高纖鮮蔬拌': '【低卡高纖涼拌水粉】：減脂期或夏日沒胃口？<br>1. 尖山純米水粉滾水燙2分鐘，撈起泡冰水定型維持Ｑ彈。<br>2. 拌入小黃瓜絲、胡蘿蔔絲、黑木耳絲。淋上和風醬汁，低GI高飽足，完全無負擔！',
        '🏮 節慶辦桌！古法香菇肉絲炒水粉': '【頭份四月八傳統香菇肉絲炒米粉】：這是最經典的客家辦桌大菜！<br>1. 香菇切絲、紅蔥頭爆香，炒熟五花肉絲與蝦米。<br>2. 放入高麗菜、韭菜段，倒入大骨高湯與少許醬油熬煮。<br>3. 將沖過冷水的尖山水粉放入，大火翻炒吸飽醬汁，起鍋撒上白胡椒粉，經典Q彈！'
    };

    const keywordResponses = [
        { keys: ['湯', '芋頭', '小卷'], reply: '【阿婆私房芋頭小卷米粉湯】：<br>1. 爆香紅蔥頭，下五花肉絲、大香菇絲。放入切塊、炸過定型的芋頭與大骨高湯煮至芋頭微鬆。<br>2. 下新鮮小卷與尖山純米水粉，粗水粉能吸飽芋頭與海鮮湯汁。起鍋放芹菜末、胡椒，胃暖好消化！' },
        { keys: ['脹氣', '胃', '消化', '不舒服', '胃痛'], reply: '您好，市售米粉多添加「修飾澱粉」，這就是引發胃酸脹氣的主因。尖山純米水粉採用 100% 在來米製成，無任何化學添加，吃起來就像吃飯一樣輕鬆，特別能溫慢保護脆弱的腸胃。' },
        { keys: ['金流', '付款', '信用卡', 'visa', 'mastercard', 'pay'], reply: '阿婆的系統支援完整的 VISA、Mastercard、JCB 信用卡，以及 LINE Pay 和貨到付款，結帳前會進行安全的 Luhn 校驗，安全又無摩擦！ [1, 1]' }
    ];

    window.aiPreset = function(presetName) {
        trackClick('ai_preset_' + presetName);
        appendChatMessage(presetName, true);
        const typingId = 'typing-' + Date.now();
        appendTyping(typingId);

        setTimeout(() => {
            removeTyping(typingId);
            appendChatMessage(aiResponses[presetName] || '阿婆推薦您試試其他常用智慧烹飪標籤！', false);
        }, 850);
    };

    window.handleAISubmit = function() {
        const query = botInput.value.trim();
        if (!query) return;
        trackClick('ai_query_submitted');
        appendChatMessage(query, true);
        botInput.value = '';

        const typingId = 'typing-' + Date.now();
        appendTyping(typingId);

        setTimeout(() => {
            removeTyping(typingId);
            let reply = '您的食材阿婆聽到了！不論您打算怎麼煮，阿婆最推薦使用【經典手工水粉】，它吸飽料汁後極佳的Ｑ彈感能完美展現地方風土。';
            for (const item of keywordResponses) {
                if (item.keys.some(k => query.toLowerCase().includes(k))) { reply = item.reply; break; }
            }
            appendChatMessage(reply, false);
        }, 800);
    };

    function appendChatMessage(text, isUser) {
        const wrapper = document.createElement('div');
        wrapper.className = `flex items-start gap-3 ${isUser? 'justify-end' : ''} animate-fade-in`;
        wrapper.innerHTML = isUser? 
            `<div class="bg-sun-amber text-white text-xs sm:text-sm p-3.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">${text}</div>` :
            `<div class="w-9 h-9 rounded-full bg-sun-amber flex items-center justify-center text-white text-lg font-bold flex-shrink-0">👵</div><div class="bg-flax-gray/50 text-gray-800 text-xs sm:text-sm p-3.5 rounded-2xl rounded-tl-none max-w-[85%] border border-flax-gray/40 shadow-sm" style="color: #2e2b2a!important;">${text}</div>`;
        botScreen.appendChild(wrapper);
        botScreen.scrollTop = botScreen.scrollHeight;
    }

    function appendTyping(id) {
        const wrapper = document.createElement('div');
        wrapper.id = id;
        wrapper.className = 'flex items-start gap-3 opacity-60';
        wrapper.innerHTML = `<div class="w-9 h-9 rounded-full bg-sun-amber flex items-center justify-center text-white text-lg font-bold flex-shrink-0">👵</div><div class="bg-flax-gray/30 text-warm-dark text-xs p-3.5 rounded-2xl rounded-tl-none">阿婆正在為您調配客庄祕方... 🥣</div>`;
        botScreen.appendChild(wrapper);
        botScreen.scrollTop = botScreen.scrollHeight;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // ==========================================
    // 3. 萬用金流與台灣發票載具前端校驗 [1, 1]
    // ==========================================
    window.selectPayment = function(method) {
        const panel = document.getElementById('credit-card-panel');
        const ccNumber = document.getElementById('cc-number');
        const ccExpiry = document.getElementById('cc-expiry');
        const ccCvv = document.getElementById('cc-cvv');
        
        if (method === 'credit') {
            panel.classList.remove('hidden');
            ccNumber.setAttribute('required', 'required');
            ccExpiry.setAttribute('required', 'required');
            ccCvv.setAttribute('required', 'required');
        } else {
            panel.classList.add('hidden');
            ccNumber.removeAttribute('required');
            ccExpiry.removeAttribute('required');
            ccCvv.removeAttribute('required');
        }
    };

    // 信用卡格式化（每4碼自動空白）
    const ccNumberInput = document.getElementById('cc-number');
    if (ccNumberInput) {
        ccNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let formatted = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) formatted += ' ';
                formatted += value[i];
            }
            e.target.value = formatted.substring(0, 19); 

            // 卡號 Luhn 演算法校驗 
            const digits = value.replace(/\D/g, '');
            if (digits.length === 16) {
                if (validateLuhn(digits)) {
                    ccNumberInput.classList.remove('input-invalid');
                    ccNumberInput.classList.add('input-valid');
                } else {
                    ccNumberInput.classList.remove('input-valid');
                    ccNumberInput.classList.add('input-invalid');
                }
            } else {
                ccNumberInput.classList.remove('input-valid', 'input-invalid');
            }
        });
    }

    function validateLuhn(cardNumber) {
        let sum = 0;
        let shouldDouble = false;
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber.charAt(i));
            if (shouldDouble) {
                if ((digit *= 2) > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble =!shouldDouble;
        }
        return (sum % 10 === 0);
    }

    // 信用卡過期日斜線格式化
    const ccExpiryInput = document.getElementById('cc-expiry');
    if (ccExpiryInput) {
        ccExpiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
            } else {
                e.target.value = value;
            }
        });
    }

    // 發票選項連動機制
    window.toggleInvoiceFields = function() {
        const type = document.getElementById('invoice-type').value;
        const mobileField = document.getElementById('invoice-mobile-field');
        const companyField = document.getElementById('invoice-company-field');

        mobileField.classList.add('hidden');
        companyField.classList.add('hidden');
        document.getElementById('inv-mobile').removeAttribute('required');
        document.getElementById('inv-tax-id').removeAttribute('required');
        document.getElementById('inv-company-title').removeAttribute('required');

        if (type === 'mobile') {
            mobileField.classList.remove('hidden');
            document.getElementById('inv-mobile').setAttribute('required', 'required');
        } else if (type === 'company') {
            companyField.classList.remove('hidden');
            document.getElementById('inv-tax-id').setAttribute('required', 'required');
            document.getElementById('inv-company-title').setAttribute('required', 'required');
        }
    };

    // ==========================================
    // 4. 一頁式購物車與免運進度條動態計算 
    // ==========================================
    window.addToCart = function(id, name, price) {
        trackClick('add_to_cart_' + id);
        cart[id] = cart[id]? {...cart[id], qty: cart[id].qty + 1 } : { name, price, qty: 1 };
        totalItemsInCart += 1;
        updateCartUI();
        toast(`已將「${name}」加入購物車！`);
    };

    window.updateCartQuantity = function(id, delta) {
        if (!cart[id]) return;
        cart[id].qty += delta;
        totalItemsInCart += delta;
        if (cart[id].qty <= 0) delete cart[id];
        updateCartUI();
    };

    function updateCartUI() {
        const cartItemsEl = document.getElementById('cart-items');
        const cartCountEl = document.getElementById('cart-count');
        const progressContainer = document.getElementById('shipping-progress-container');
        const progressBar = document.getElementById('shipping-progress-bar');
        const progressDesc = document.getElementById('shipping-progress-desc');
        const progressPercent = document.getElementById('shipping-progress-percent');
        
        cartCountEl.textContent = totalItemsInCart;

        if (totalItemsInCart <= 0) {
            cartItemsEl.innerHTML = `<p class="text-xs text-warm-dark/40 text-center py-6">購物車內尚未加入米粉...</p>`;
            document.getElementById('repurchase-feedback').textContent = '';
            progressContainer.classList.add('hidden');
            return;
        }

        progressContainer.classList.remove('hidden');
        let html = '', total = 0, totalBags = 0;
        for (const id in cart) {
            const item = cart[id];
            total += item.price * item.qty;
            totalBags += id === 'p1'? item.qty * 5 : item.qty * 3;
            html += `
                <div class="flex justify-between items-center bg-flax-gray/20 p-2.5 rounded-xl border border-flax-gray/50 text-xs animate-fade-in">
                    <div class="flex-1">
                        <span class="font-serif font-bold text-hakka-blue block">${item.name}</span>
                        <span class="text-sun-amber font-bold">NT$ ${item.price}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="updateCartQuantity('${id}', -1)" class="w-5 h-5 bg-white border border-flax-gray rounded flex items-center justify-center font-bold hover:bg-gray-100">-</button>
                        <span class="font-bold">${item.qty}</span>
                        <button type="button" onclick="updateCartQuantity('${id}', 1)" class="w-5 h-5 bg-white border border-flax-gray rounded flex items-center justify-center font-bold hover:bg-gray-100">+</button>
                    </div>
                </div>
            `;
        }

        // 動態免運進度條運算 
        const progressVal = Math.min((total / FREE_SHIPPING_LIMIT) * 100, 100);
        progressBar.style.width = `${progressVal}%`;
        progressPercent.textContent = `${Math.round(progressVal)}%`;
        if (total < FREE_SHIPPING_LIMIT) {
            progressDesc.innerHTML = `距離免運門檻還差 <span class="text-sun-amber font-bold">NT$ ${FREE_SHIPPING_LIMIT - total}</span>`;
        } else {
            progressDesc.innerHTML = `🎉 <span class="text-green-600 font-bold">恭喜！您已達免運門檻，已為您免除 NT$ 100 運費。</span>`;
        }

        if (isCouponApplied) {
            total -= 50;
            html += `<div class="flex justify-between items-center text-xs text-green-700 font-bold border-t border-dashed border-flax-gray pt-2"><span>🎁 離意圖挽回折價券</span><span>- NT$ 50</span></div>`;
        }

        const shippingFee = total >= FREE_SHIPPING_LIMIT? 0 : FLAT_SHIPPING_FEE;
        html += `
            <div class="space-y-1.5 pt-3 border-t border-flax-gray">
                <div class="flex justify-between text-xs text-warm-dark/60"><span>商品小計：</span><span>NT$ ${total}</span></div>
                <div class="flex justify-between text-xs text-warm-dark/60"><span>系統運費：</span><span>NT$ ${shippingFee}</span></div>
                <div class="flex justify-between items-center font-serif font-black text-sm text-hakka-blue border-t border-flax-gray pt-2">
                    <span>應付總額</span>
                    <span class="text-base text-sun-amber">NT$ ${Math.max(0, total + shippingFee)}</span>
                </div>
            </div>
        `;

        cartItemsEl.innerHTML = html;
        computedCartTotal = total + shippingFee;
        computedTotalBags = totalBags;
        calculateRepurchaseForecast();
    }

    // AI 週期補貨預估算法 
    window.calculateRepurchaseForecast = function() {
        if (totalItemsInCart <= 0) return;
        const people = parseInt(document.getElementById('repurchase-people').value) || 3;
        const daysToConsume = Math.round(computedTotalBags / (people * 0.15));
        const forecastDate = new Date();
        forecastDate.setDate(new Date().getDate() + daysToConsume);
        const formatString = `${forecastDate.getFullYear()}/${(forecastDate.getMonth() + 1).toString().padStart(2, '0')}/${forecastDate.getDate().toString().padStart(2, '0')}`;
        
        document.getElementById('repurchase-feedback').innerHTML = `
            ✨ AI預測：您的家庭約在 <span class="font-bold underline">${daysToConsume} 天內</span> 吃完米粉。<br>建議下次補貨日為 <span class="font-bold underline text-hakka-blue">${formatString}</span>。
        `;
        currentRepurchaseString = `估計您的家庭將在 ${daysToConsume} 天內（於 ${formatString} 前後）消耗完這批純米水粉。`;
    };

    // ==========================================
    // 5. 模組化彈窗與 Exit-Intent 挽回機制 
    // ==========================================
    window.toggleModal = function(modalId, action) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        const dialog = modal.querySelector('div');
        if (action === 'open') {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            dialog?.classList.replace('scale-95', 'scale-100');
        } else {
            modal.classList.add('opacity-0', 'pointer-events-none');
            dialog?.classList.replace('scale-100', 'scale-95');
        }
    };

    document.addEventListener('mouseleave', (e) => {
        if (e.clientY < 15 && totalItemsInCart > 0 &&!isExitIntentTriggered &&!isCouponApplied) {
            isExitIntentTriggered = true;
            logGA4Event('exit_intent_triggered', { cart_value: computedCartTotal });
            toggleModal('exit-intent-modal', 'open');
        }
    });

    window.closeExitIntentModal = function() { toggleModal('exit-intent-modal', 'close'); };
    window.applyExitCoupon = function() {
        isCouponApplied = true;
        trackClick('exit_coupon_applied');
        closeExitIntentModal();
        updateCartUI();
        toast('已為您套用限時 50 元優惠券！');
    };

    // ==========================================
    // 6. 表單提交、後置註冊與微體驗預約 
    // ==========================================
    window.processGuestCheckout = function(e) {
        e.preventDefault();
        if (totalItemsInCart <= 0) {
            toast('您的購物車內尚未加入米粉，無法結帳喔。', 'warning');
            return;
        }

        const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
        if (payMethod === 'credit') {
            const cc = ccNumberInput.value.replace(/\s/g, '');
            if (cc.length < 16 ||!validateLuhn(cc)) {
                toast('請輸入正確的 16 位信用卡號。', 'warning');
                ccNumberInput.focus();
                return;
            }
        }

        const name = document.getElementById('cust-name').value;
        const email = document.getElementById('cust-email').value;
        logGA4Event('submit_purchase_checkout', { purchase_value: computedCartTotal, reminder_channel: document.getElementById('repurchase-reminder').value });

        const reminderSelect = document.getElementById('repurchase-reminder');
        const reminderText = reminderSelect? reminderSelect.options.text : 'LINE 溫慢提醒';

        document.getElementById('ty-forecast').innerHTML = `
            <strong>收件人：</strong>${name} 先生/女士<br>
            <strong>通知郵件：</strong>${email}<br>
            <strong>AI 消耗量評估：</strong>${currentRepurchaseString}<br>
            <strong>提醒管道：</strong>${reminderText}
        `;

        cart = {}; totalItemsInCart = 0;
        updateCartUI();
        e.target.reset();
        selectPayment('credit'); 
        toggleModal('thank-you-modal', 'open');
    };

    window.submitPostRegister = function() {
        const pwd = document.getElementById('post-reg-password').value;
        if (!pwd || pwd.length < 4) {
            toast('請輸入至少 4 位數的安全密碼。', 'warning');
            return;
        }
        trackClick('post_purchase_register_success');
        toast('會員帳號建立成功！已自動發放 50 元購物金。');
        closeThankYouModal();
    };

    window.closeThankYouModal = function() { toggleModal('thank-you-modal', 'close'); };

    window.processO2OForm = function(e) {
        e.preventDefault();
        const name = document.getElementById('o2o-name').value;
        const session = document.getElementById('o2o-session').options.text;
        logGA4Event('submit_o2o_booking_success', { session_selected: document.getElementById('o2o-session').value });

        document.getElementById('ty-forecast').innerHTML = `
            <strong>預約聯絡人：</strong>${name} 先生/女士<br>
            <strong>體驗項目：</strong>四月八靚燈好客節 庄庄祈福體驗<br>
            <strong>體驗梯次：</strong>${session}<br>
            <span class="text-green-600">🔴 我們已向您的電話發送永貞宮庄前集合指南與手作教學。</span>
        `;
        e.target.reset();
        toggleModal('thank-you-modal', 'open');
        toast('預約提交成功！');
    };

    // ==========================================
    // 7. 通用 UI 輔助組件 (Toast, FAQ, Radar Chart)
    // ==========================================
    window.toast = function(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const item = document.createElement('div');
        item.className = `p-4 rounded-xl text-xs font-bold shadow-lg border pointer-events-auto transform translate-y-2 transition-all duration-300 flex items-center gap-2 ${
            type === 'success'? 'bg-white border-green-200 text-green-800' : 'bg-white border-sun-amber/20 text-sun-amber'
        }`;
        const icon = type === 'success'? '✅' : '⚠️';
        item.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(item);

        setTimeout(() => {
            item.classList.remove('translate-y-2');
            item.classList.add('translate-y-0');
        }, 50);

        setTimeout(() => {
            item.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => item.remove(), 300);
        }, 3000);
    };

    window.scrollToSection = function(id) {
        const el = document.getElementById(id);
        if (el) {
            const navHeight = document.getElementById('main-nav').offsetHeight;
            const top = el.getBoundingClientRect().top + window.pageYOffset - navHeight;
            window.scrollTo({ top, behavior: 'smooth' });
            logGA4Event('scroll_story', { target_section: id });
        }
    };

    const sampleLots = {
        'LOT-20260601': {
            date: '2026/06/01', temp: '29.2 °C', wind: '8.2 m/s (九降風)',
            humidity: '48%', status: '🟢 優異。此批次米粉呈現淡雅米黃金澤，纖維收縮勻稱。'
        },
        'LOT-20260604': {
            date: '2026/06/04', temp: '28.5 °C', wind: '7.5 m/s (乾涼季風)',
            humidity: '55%', status: '🟢 優良。口感極具Ｑ彈度，湯汁吸附力指標高。'
        }
    };

    window.fillLotSample = function(lotNum) {
        document.getElementById('lot-input').value = lotNum;
        queryLotData();
    };

    window.queryLotData = function() {
        const input = document.getElementById('lot-input').value.trim().toUpperCase();
        const resultBox = document.getElementById('lot-result');
        if (!input) {
            toast('請先輸入或點選示範批號！', 'warning');
            return;
        }
        logGA4Event('query_lot_number', { lot_input: input });
        resultBox.innerHTML = `<div class="space-y-2"><div class="shimmer h-4 rounded w-1/2"></div><div class="shimmer h-3 rounded w-3/4"></div></div>`;

        setTimeout(() => {
            const data = sampleLots[input];
            if (data) {
                resultBox.innerHTML = `
                    <div class="text-xs space-y-1 text-warm-dark animate-fade-in">
                        <p class="font-bold text-hakka-blue">🔎 查詢成功：${input}</p>
                        <p><strong>日曬日期：</strong>${data.date} ｜ <strong>均溫：</strong>${data.temp}</p>
                        <p><strong>平均風速：</strong>${data.wind} ｜ <strong>相對濕度：</strong>${data.humidity}</p>
                        <p class="mt-2 text-sun-amber font-bold">${data.status}</p>
                    </div>
                `;
                toast('批號查詢成功！');
            } else {
                resultBox.innerHTML = `<p class="text-xs text-warm-dark/40 text-center">❌ 未找到此批號 (${input}) 資料。</p>`;
                toast('查無此批號，請確認輸入是否正確。', 'warning');
            }
        }, 600);
    };

    // 數據雷達
    function initComparisonChart() {
        const ctx = document.getElementById('comparisonRadarChart');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['好消化不易脹氣', '吸湯飽滿度', 'Q彈抗斷性', '純米香濃度', '無化學修飾澱粉'],
                datasets: [
                    {
                        label: '尖山純米手工水粉',
                        data: ,
                        fill: true,
                        backgroundColor: 'rgba(217, 119, 6, 0.15)',
                        borderColor: 'rgb(217, 119, 6)',
                        pointBackgroundColor: 'rgb(217, 119, 6)'
                    },
                    {
                        label: '市售修飾澱粉炊粉',
                        data: ,
                        fill: true,
                        backgroundColor: 'rgba(28, 53, 94, 0.1)',
                        borderColor: 'rgb(28, 53, 94)',
                        pointBackgroundColor: 'rgb(28, 53, 94)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(46, 43, 42, 0.1)' },
                        grid: { color: 'rgba(46, 43, 42, 0.05)' },
                        pointLabels: { font: { family: 'Noto Sans TC', size: 10, weight: 'bold' }, color: '#2e2b2a' },
                        ticks: { display: false, stepSize: 2 },
                        min: 0, max: 10
                    }
                }
            }
        });
    }

    const faqData =" },
        { q: "水粉跟一般市售新竹米粉在烹調上有何不同？", a: "市售新竹米粉多為『炊粉』（蒸熟且條體極細）。尖山水粉為『水煮粗粉』。下鍋前請勿浸泡熱水，僅需用冷水稍微沖洗即可！煮湯時不易軟爛，極其吸飽料汁；炒米粉時也更具有勁與彈性。" },
        { q: "補貨預測與週期性回購系統是怎麼運作的？", a: "這是完全免費的溫慢科技服務。系統會根據您的家庭常住人數與購買包數自動建立消耗率模型。吃完前一週，我們將透過 LINE 官方帳號向您發送一條補貨提示，您只需點選『一鍵續購』，即可極速補貨，免去重複填單與斷糧煩惱。 [1]" }
    ];

    function initFAQAccordion() {
        const wrapper = document.getElementById('faq-wrapper');
        if (!wrapper) return;
        faqData.forEach((item, idx) => {
            const node = document.createElement('div');
            node.className = 'border border-flax-gray rounded-2xl overflow-hidden bg-flax-gray/10';
            node.innerHTML = `
                <button type="button" onclick="toggleFAQ(${idx})" class="w-full text-left px-6 py-4 font-serif font-bold text-hakka-blue flex justify-between items-center focus:outline-none hover:bg-flax-gray/30 transition-all text-xs sm:text-sm">
                    <span>${item.q}</span>
                    <span id="faq-icon-${idx}" class="text-lg font-bold text-sun-amber transform transition-transform duration-300">+</span>
                </button>
                <div id="faq-body-${idx}" class="max-h-0 overflow-hidden transition-all duration-300 ease-in-out bg-white text-xs sm:text-sm text-warm-dark/80">
                    <p class="p-6 border-t border-flax-gray/40 leading-relaxed">${item.a}</p>
                </div>
            `;
            wrapper.appendChild(node);
        });
    }

    let activeFAQIndex = null;
    window.toggleFAQ = function(idx) {
        const body = document.getElementById(`faq-body-${idx}`);
        const icon = document.getElementById(`faq-icon-${idx}`);
        logGA4Event('toggle_faq_accordion', { faq_index: idx });

        if (activeFAQIndex!== null && activeFAQIndex!== idx) {
            const oldBody = document.getElementById(`faq-body-${activeFAQIndex}`);
            const oldIcon = document.getElementById(`faq-icon-${activeFAQIndex}`);
            if (oldBody && oldIcon) { oldBody.style.maxHeight = '0px'; oldIcon.textContent = '+'; oldIcon.style.transform = 'rotate(0deg)'; }
        }

        if (body.style.maxHeight === '0px' ||!body.style.maxHeight) {
            body.style.maxHeight = body.scrollHeight + 'px';
            icon.textContent = '−';
            icon.style.transform = 'rotate(180deg)';
            activeFAQIndex = idx;
        } else {
            body.style.maxHeight = '0px';
            icon.textContent = '+';
            icon.style.transform = 'rotate(0deg)';
            activeFAQIndex = null;
        }
    };

    // 美食日記上傳彈窗
    window.openMockShareModal = function() { toggleModal('share-modal', 'open'); };
    window.closeShareModal = function() { toggleModal('share-modal', 'close'); };
    window.submitMockShare = function(e) {
        e.preventDefault();
        logGA4Event('community_share_submitted');
        closeShareModal();
        toast('分享成功！折價券 WARM50 已寄送至信箱，審核過後將正式刊登。');
    };

    // 初始化頁面
    initComparisonChart();
    initFAQAccordion();
    logGA4Event('page_view_home', { page_title: document.title });
});