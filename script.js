// --- إدارة التخزين المحلي الحقيقي (Persistent Storage) ---
function loadData(key, defaultVal) {
    const saved = localStorage.getItem('lamsa_' + key);
    return saved ? JSON.parse(saved) : defaultVal;
}

function saveData(key, val) {
    localStorage.setItem('lamsa_' + key, JSON.stringify(val));
}

let currentUserRole = 'engineer';
let currentUserPhone = '';

let projectAutoCounter = loadData('projectAutoCounter', 1);
let orderAutoCounter = loadData('orderAutoCounter', 1);
let quoteAutoCounter = loadData('quoteAutoCounter', 1);
let usersDatabase = loadData('usersDatabase', {});
let clientsList = loadData('clientsList', []);
let categoriesList = loadData('categoriesList', []);
let productsList = loadData('productsList', []);
let inventoryList = loadData('inventoryList', []);
let projectsList = loadData('projectsList', []);
let fullOrdersList = loadData('fullOrdersList', []);
let quotationsList = loadData('quotationsList', []);
let financeTransactions = loadData('financeTransactions', []);

let trashBinList = loadData('trashBinList', []);
let payrollList = loadData('payrollList', []);

let activeQuoteData = null;
let pastedImageData = null;
let editTransactionIndex = null;
let targetOrderIndexToDelete = null;

// --- إدارة تسجيل الدخول والصفحات ---
function updateHeaderUserInfo() {
    const currentPhone = localStorage.getItem('currentUserPhone');
    if (currentPhone && typeof usersDatabase !== 'undefined' && usersDatabase[currentPhone]) {
        const user = usersDatabase[currentPhone];
        const nameEl = document.getElementById('display-username');
        const roleEl = document.getElementById('display-role');
        
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = user.role || 'موظف';
    }
}

function handleLogout() {
    localStorage.removeItem('currentUserPhone');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function getCurrentUserName() {
    const currentPhone = localStorage.getItem('currentUserPhone');
    if (currentPhone && typeof usersDatabase !== 'undefined' && usersDatabase[currentPhone]) {
        return usersDatabase[currentPhone].name;
    }
    return 'مدير النظام';
}

function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();

    const user = usersDatabase[phone];
    if (!user || user.pass !== pass) {
        alert('خطأ: بيانات الدخول غير صحيحة!');
        return;
    }

    localStorage.setItem('currentUserPhone', phone);

    const nameEl = document.getElementById('display-username');
    const roleEl = document.getElementById('display-role');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role || 'موظف';

    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');

    renderAllTables();
    populateOrderDropdowns();
    populateCategoriesDropdown();

    applyUserPermissions();
    switchTab('home');
}

function hasPerm(permKey) {
    if (currentUserRole === 'admin') return true;
    const u = usersDatabase[currentUserPhone];
    return u && u.perms && u.perms[permKey];
}

function switchTab(pageId) {
    // 1. إخفاء كل صفحات الـ tab والـ page الموجودة في النظام
    const allPages = document.querySelectorAll('.tab-page');
    allPages.forEach(p => p.classList.add('hidden'));

    // 2. البحث عن الصفحة المستهدفة سواء كانت تبدأ بـ tab- أو page- وعرضها فوراً
    let target = document.getElementById('tab-' + pageId) || 
                 document.getElementById('page-' + pageId) || 
                 document.getElementById(pageId);

    if (target) {
        target.classList.remove('hidden');
    } else {
        console.warn('الصفحة غير موجودة:', pageId);
    }

    // 3. تحديث القائمة الجانبية (Sidebar Active State)
    const navs = ['home', 'users', 'clients', 'products', 'inventory', 'projects', 'orders', 'sales', 'finance', 'client-ledger', 'trash-bin'];
    navs.forEach(n => {
        const navEl = document.getElementById('nav-' + n);
        if (navEl) {
            if (n === pageId) {
                navEl.classList.add('bg-amber-500', 'text-neutral-900', 'border-r-4', 'border-amber-400');
                navEl.classList.remove('hover:bg-neutral-800', 'hover:text-amber-400');
            } else {
                navEl.classList.remove('bg-amber-500', 'text-neutral-900', 'border-r-4', 'border-amber-400');
                navEl.classList.add('hover:bg-neutral-800', 'hover:text-amber-400');
            }
        }
    });
}

function applyHomeStatsPermissions() {
    const currentPhone = localStorage.getItem('currentUserPhone');
    if (!currentPhone || typeof usersDatabase === 'undefined' || !usersDatabase[currentPhone]) return;

    const user = usersDatabase[currentPhone];
    const isOwnerOrAdmin = user.role === 'admin';

    const statsContainer = document.querySelector('#tab-home .grid');
    if (statsContainer) {
        if (isOwnerOrAdmin) {
            statsContainer.classList.remove('hidden');
        } else {
            statsContainer.classList.add('hidden');
        }
    }
}

// --- الأرشيف وسجل المهملات ---
function sendToTrash(type, itemCode, clientName, projectName, reason, deletedByData, deletedData = null) {
    const trashItem = {
        date: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('ar-EG'),
        type: type,
        code: itemCode || '—',
        client: clientName || '—',
        project: projectName || '—',
        reason: reason || 'بدون سبب مذكور',
        deletedBy: deletedByData || getCurrentUserName(),
        deletedData: deletedData ? JSON.parse(JSON.stringify(deletedData)) : null
    };
    trashBinList.unshift(trashItem);
    saveData('trashBinList', trashBinList);
}

function emptyTrashBin() {
    if (!Array.isArray(trashBinList) || trashBinList.length === 0) {
        alert('المهملات فارغة بالفعل.');
        return;
    }
    const confirmed = confirm(`هل أنت متأكد من حذف ${trashBinList.length} عنصر نهائياً من المهملات؟ لا يمكن التراجع عن هذه الخطوة.`);
    if (!confirmed) return;
    trashBinList = [];
    saveData('trashBinList', trashBinList);
    renderTrashBinTable();
    alert('تم تفريغ المهملات نهائياً.');
}

function renderTrashBinTable() {
    const tbody = document.getElementById('trash-bin-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (trashBinList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">الأرشيف/المهملات فارغ حالياً</td></tr>`;
        return;
    }

    trashBinList.forEach((t) => {
        tbody.innerHTML += `
            <tr class="hover:bg-red-50/40 border-b text-center text-xs">
                <td class="p-2.5 font-mono text-gray-600">${t.date}</td>
                <td class="p-2.5"><span class="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">${t.type}</span></td>
                <td class="p-2.5 font-mono font-bold text-amber-700">${t.code}</td>
                <td class="p-2.5 font-bold text-gray-800">${t.client}</td>
                <td class="p-2.5 font-bold text-blue-700">${t.project}</td>
                <td class="p-2.5 text-right font-semibold text-red-600">${t.reason}</td>
                <td class="p-2.5 font-bold text-gray-700">${t.deletedBy}</td>
            </tr>
        `;
    });
}

// --- إدارة الموظفين ---
function toggleEmployeePassword() {
    const passInput = document.getElementById('new-pass');
    const icon = document.getElementById('toggle-emp-pass-icon');
    if (!passInput || !icon) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function openUserPage() {
    document.getElementById('edit-user-ph').value = '';
    document.getElementById('new-name').value = '';
    document.getElementById('new-phone').value = '';
    document.getElementById('new-pass').value = '';
    document.getElementById('new-role').value = 'engineer';
    if(document.getElementById('new-salary')) document.getElementById('new-salary').value = '';

    const permsCheckboxes = document.querySelectorAll('#page-user-form input[type="checkbox"]');
    permsCheckboxes.forEach(cb => { if (!cb.disabled) cb.checked = false; });

    document.getElementById('user-page-title').innerHTML = `<i class="fa-solid fa-user-plus text-amber-500 ml-2"></i> إضافة موظف جديد`;
    switchTab('user-form');
}

// --- دالة حفظ الموظف المصححة بالكامل ---
function saveEmployee(e) {
    if (e) e.preventDefault();
    const editPh = document.getElementById('edit-user-ph')?.value || '';
    const name = document.getElementById('new-name')?.value || '';
    const phone = document.getElementById('new-phone')?.value.trim() || '';
    const pass = document.getElementById('new-pass')?.value.trim() || '';
    const role = document.getElementById('new-role')?.value || 'engineer';
    const salary = parseFloat(document.getElementById('new-salary')?.value) || 0;

    if (!phone || !pass) {
        alert('برجاء كتابة رقم الهاتف وكلمة السر بشكل صحيح');
        return;
    }

    const perms = {
        viewHome: true, // تفعيل الرئيسية تلقائياً
        viewUsers: !!document.getElementById('perm-view-users')?.checked,
        editUsers: !!document.getElementById('perm-edit-users')?.checked,
        deleteUsers: !!document.getElementById('perm-delete-users')?.checked,
        viewClients: !!document.getElementById('perm-view-clients')?.checked,
        editClient: !!document.getElementById('perm-edit-client')?.checked,
        deleteClient: !!document.getElementById('perm-delete-client')?.checked,
        viewClientLedger: !!document.getElementById('perm-view-client-ledger')?.checked,
        viewProducts: !!document.getElementById('perm-view-products')?.checked,
        editProduct: !!document.getElementById('perm-edit-product')?.checked,
        deleteProduct: !!document.getElementById('perm-delete-product')?.checked,
        viewProjects: !!document.getElementById('perm-view-projects')?.checked,
        editProject: !!document.getElementById('perm-edit-project')?.checked,
        deleteProject: !!document.getElementById('perm-delete-project')?.checked,
        viewOrders: !!document.getElementById('perm-view-orders')?.checked,
        editOrder: !!document.getElementById('perm-edit-order')?.checked,
        deleteOrder: !!document.getElementById('perm-delete-order')?.checked,
        viewSales: !!document.getElementById('perm-view-sales')?.checked,
        viewFinance: !!document.getElementById('perm-view-finance')?.checked,
        editFinance: !!document.getElementById('perm-edit-finance')?.checked,
        deleteFinance: !!document.getElementById('perm-delete-finance')?.checked
    };

    let title = role === 'accountant' ? 'محاسب ماليات' : (role === 'admin' ? 'مدير نظام' : 'مهندس تشغيل');

    if (editPh && editPh !== phone) {
        delete usersDatabase[editPh];
    }

    usersDatabase[phone] = { 
        pass: pass, 
        role: role, 
        name: name, 
        title: title, 
        salary: salary, 
        perms: perms 
    };

    saveData('usersDatabase', usersDatabase);
    alert('تم حفظ بيانات الموظف بنجاح!');
    
    if (typeof renderAllTables === 'function') renderAllTables();
    if (typeof switchTab === 'function') switchTab('users');
}



// --- دالة تسجيل الدخول المصححة ---
function handleLogin(event) {
    if (event) event.preventDefault();
    
    // إعادة قراءة بيانات المستخدمين من التخزين المحلي لضمان وجود الحسابات الجديدة
    usersDatabase = loadData('usersDatabase', usersDatabase);

    const phoneInput = document.getElementById('username');
    const passInput = document.getElementById('password');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!usersDatabase[phone]) {
        alert('خطأ: رقم الهاتف غير مسجل بالنظام!');
        return;
    }

    const user = usersDatabase[phone];

    if (user.pass !== pass) {
        alert('خطأ: كلمة المرور غير صحيحة!');
        return;
    }

    // تعيين الحساب الحالي وقفظ البيانات في التخزين المحلي والذاكرة
    currentUserPhone = phone;
    currentUserRole = user.role || 'engineer';
    localStorage.setItem('currentUserPhone', phone);

    const nameEl = document.getElementById('display-username');
    const roleEl = document.getElementById('display-role');
    if (nameEl) nameEl.textContent = user.name || 'موظف';
    if (roleEl) roleEl.textContent = user.title || (user.role === 'admin' ? 'مدير النظام' : 'موظف');

    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('dashboard-section')?.classList.remove('hidden');

    if (typeof renderAllTables === 'function') renderAllTables();
    if (typeof populateOrderDropdowns === 'function') populateOrderDropdowns();
    if (typeof populateCategoriesDropdown === 'function') populateCategoriesDropdown();

    applyUserPermissions();
    switchTab('home');
}

function editUser(ph) {
    const u = usersDatabase[ph];
    if (!u) return;

    document.getElementById('edit-user-ph').value = ph;
    document.getElementById('new-name').value = u.name || '';
    document.getElementById('new-phone').value = ph;
    document.getElementById('new-pass').value = u.pass || '';
    document.getElementById('new-role').value = u.role || 'engineer';
    if(document.getElementById('new-salary')) document.getElementById('new-salary').value = u.salary || 0;

    const p = u.perms || {};
    if (document.getElementById('perm-view-home-stats')) document.getElementById('perm-view-home-stats').checked = !!p.viewHomeStats;
    if (document.getElementById('perm-view-users')) document.getElementById('perm-view-users').checked = !!p.viewUsers;
    if (document.getElementById('perm-edit-users')) document.getElementById('perm-edit-users').checked = !!p.editUsers;
    if (document.getElementById('perm-delete-users')) document.getElementById('perm-delete-users').checked = !!p.deleteUsers;

    document.getElementById('user-page-title').innerHTML = `<i class="fa-solid fa-user-pen text-amber-500 ml-2"></i> تعديل بيانات الموظف`;
    switchTab('user-form');
}

function deleteEmployee(phone) {
    if (phone === currentUserPhone) {
        alert('لا يمكنك حذف حسابك أثناء تسجيل الدخول.');
        return;
    }

    const reason = prompt('يرجى كتابة سبب حذف الموظف:');
    if (!reason || !reason.trim()) {
        alert('يلزم إدخال سبب الحذف بنجاح!');
        return;
    }

    const u = usersDatabase[phone];
    if (u) {
        sendToTrash('موظف', phone, u.name, '—', reason, getCurrentUserName(), u);
        delete usersDatabase[phone];
        saveData('usersDatabase', usersDatabase);
        renderAllTables();
    }
}

// --- إدارة وحسابات العملاء ---
function openClientPage() {
    document.getElementById('edit-client-index').value = '';
    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-address').value = '';
    if (document.getElementById('client-type')) document.getElementById('client-type').value = 'A';

    document.getElementById('client-page-title').innerHTML = `<i class="fa-solid fa-user-plus text-amber-500 ml-2"></i> إضافة عميل جديد`;
    switchTab('client-form');
}

function saveClient(e) {
    e.preventDefault();
    const index = document.getElementById('edit-client-index').value;
    const data = {
        name: document.getElementById('client-name').value,
        phone: document.getElementById('client-phone').value,
        email: document.getElementById('client-email').value,
        address: document.getElementById('client-address').value,
        type: document.getElementById('client-type') ? document.getElementById('client-type').value : 'A'
    };

    if (index !== '') {
        clientsList[index] = data;
    } else {
        clientsList.push(data);
    }

    saveData('clientsList', clientsList);
    renderAllTables();
    populateOrderDropdowns();
    switchTab('clients');
}

function editClient(index) {
    const c = clientsList[index];
    if (!c) return;
    document.getElementById('edit-client-index').value = index;
    document.getElementById('client-name').value = c.name || '';
    document.getElementById('client-phone').value = c.phone || '';
    document.getElementById('client-email').value = c.email || '';
    document.getElementById('client-address').value = c.address || '';
    if (document.getElementById('client-type')) document.getElementById('client-type').value = c.type || 'A';

    document.getElementById('client-page-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500 ml-2"></i> تعديل بيانات العميل`;
    switchTab('client-form');
}

function deleteClient(index) {
    if (confirm('هل أنت تأكد من حذف هذا العميل؟')) {
        clientsList.splice(index, 1);
        saveData('clientsList', clientsList);
        renderAllTables();
        populateOrderDropdowns();
    }
}
function openClientLedger() {
    switchTab('client-ledger');
    renderClientLedger();
}

function calculateClientTotalDues(clientName) {
    let totalDues = 0;
    const clientObj = clientsList.find(c => c.name === clientName) || {};
    const clientDiscount = parseFloat(clientObj.discount) || 0;
    const clientOrders = fullOrdersList.filter(o => o.client === clientName);

    clientOrders.forEach(order => {
        let orderCost = parseFloat(order.totalPrice || order.totalAmount) || 0;
        let orderPaid = parseFloat(order.paidAmount) || 0;
        totalDues += (orderCost - orderPaid);
    });

    return Math.max(0, totalDues - clientDiscount);
}

function renderClientLedger() {
    const tbody = document.getElementById('client-ledger-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const list = clientsList || [];
    const orders = fullOrdersList || [];

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">لا توجد بيانات عملاء مسجلة حتى الآن</td></tr>`;
        return;
    }

    // عرض العملاء الذين لديهم مشاريع/أوامر فقط
    const activeClients = list.filter(client => {
        const clientOrders = orders.filter(o => o.client === client.name);
        return clientOrders.length > 0;
    });

    if (activeClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">لا توجد حسابات عملاء مرتبطة بمشاريع حالياً</td></tr>`;
        return;
    }

    activeClients.forEach((client, index) => {
        const clientOrders = orders.filter(o => o.client === client.name);
        let clientTotalCost = 0;
        let clientPaidAmount = 0;

        clientOrders.forEach(order => {
            clientTotalCost += parseFloat(order.totalPrice || order.totalAmount) || 0;
            clientPaidAmount += parseFloat(order.paidAmount) || 0;
        });

        const clientRemaining = clientTotalCost - clientPaidAmount;

        tbody.innerHTML += `
            <tr class="hover:bg-amber-50/50 text-center border-b">
                <td class="p-3 border font-mono font-bold text-gray-700">${index + 1}</td>
                <td class="p-3 border font-bold text-gray-900 text-right">
                    ${client.name}
                    <span class="mr-1 px-1.5 py-0.5 rounded text-[10px] ${client.type === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                        ${client.type === 'B' ? 'عميل B (ورشة)' : 'عميل A (مباشر)'}
                    </span>
                </td>
                <td class="p-3 border font-mono text-gray-600">${client.phone || '—'}</td>
                <td class="p-3 border font-mono font-bold text-blue-600">${clientTotalCost.toLocaleString()} ج.م</td>
                <td class="p-3 border font-mono font-bold text-emerald-600">${clientPaidAmount.toLocaleString()} ج.م</td>
                <td class="p-3 border font-mono font-bold ${clientRemaining > 0 ? 'text-amber-600' : 'text-gray-800'}">${clientRemaining.toLocaleString()} ج.م</td>
                <td class="p-3 border text-center">
                    <button type="button" onclick="printSingleClientLedger('${client.name}')" class="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 inline-flex items-center justify-center shadow-sm" title="طباعة تقرير">
                        <i class="fa-solid fa-print"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function printSingleClientLedger(clientName) {
    if (!clientName) return;

    const clientObj = clientsList.find(c => c.name === clientName) || {};
    const clientProjects = projectsList.filter(p => p.client === clientName);
    const clientOrders = fullOrdersList.filter(o => o.client === clientName);

    let projectsRowsHtml = '';
    if (clientProjects.length > 0) {
        clientProjects.forEach((p, idx) => {
            projectsRowsHtml += `
                <tr style="border-bottom: 1px solid #ddd; text-align: center;">
                    <td style="padding: 6px;">${idx + 1}</td>
                    <td style="padding: 6px; font-weight: bold; font-family: monospace;">${p.code || '—'}</td>
                    <td style="padding: 6px; font-weight: bold;">${p.name || '—'}</td>
                    <td style="padding: 6px;">${p.engineer || '—'}</td>
                    <td style="padding: 6px;">${p.ownerPhone || '—'}</td>
                </tr>
            `;
        });
    } else {
        projectsRowsHtml = `<tr><td colspan="5" style="text-align:center; padding: 10px;">لا توجد مشاريع مسجلة لهذا العميل</td></tr>`;
    }

    let ordersRowsHtml = '';
    let totalSales = 0;
    let totalPaid = 0;

    if (clientOrders.length > 0) {
        clientOrders.forEach((o, idx) => {
            const orderTotal = parseFloat(o.totalPrice || o.totalAmount) || 0;
            const orderPaid = parseFloat(o.paidAmount) || 0;
            const orderRem = orderTotal - orderPaid;

            totalSales += orderTotal;
            totalPaid += orderPaid;

            ordersRowsHtml += `
                <tr style="border-bottom: 1px solid #ccc; text-align: center;">
                    <td style="padding: 6px;">${idx + 1}</td>
                    <td style="padding: 6px; font-weight: bold; font-family: monospace;">${o.code || '—'}</td>
                    <td style="padding: 6px;">${o.project || '—'}</td>
                    <td style="padding: 6px; text-align: right;">${o.products || '—'}</td>
                    <td style="padding: 6px; font-family: monospace;">${o.contractDate || '—'}</td>
                    <td style="padding: 6px; color: #2563eb; font-weight: bold;">${orderTotal.toLocaleString()} ج.م</td>
                    <td style="padding: 6px; color: #059669; font-weight: bold;">${orderPaid.toLocaleString()} ج.م</td>
                    <td style="padding: 6px; color: #dc2626; font-weight: bold;">${orderRem.toLocaleString()} ج.م</td>
                </tr>
            `;
        });
    } else {
        ordersRowsHtml = `<tr><td colspan="8" style="text-align:center; padding: 10px;">لا توجد أوامر شغل مسجلة لهذا العميل</td></tr>`;
    }

    const discount = parseFloat(clientObj.discount) || 0;
    const remainingTotal = (totalSales - discount) - totalPaid;
    const todayStr = new Date().toISOString().split('T')[0];

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير عميل شامل - ${clientName}</title>
            <style>
                @page { size: auto; margin: 12mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 10px; color: #111; background: #fff; }
                .box { border: 2px solid #111; border-radius: 8px; padding: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 15px; }
                .badge { background: #000; color: #fff; padding: 4px 15px; border-radius: 4px; font-weight: bold; font-size: 14px; }
                .section-title { font-size: 13px; font-weight: bold; color: #b45309; margin: 15px 0 6px 0; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
                th, td { border: 1px solid #6b7280; padding: 6px; }
                th { background-color: #1f2937 !important; color: #fff !important; }
                .summary { display: flex; justify-content: space-between; background-color: #fffbe3; border: 1px solid #fef08a; padding: 10px; border-radius: 6px; font-size: 12px; font-weight: bold; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="header">
                    <div>
                        <h1 style="margin: 0; color: #d97706; font-size: 22px;">LAMSA</h1>
                        <p style="margin: 2px 0 0; font-size: 11px; font-weight: bold; color: #4b5563;">شركة لمسة للدعاية والإعلان والطباعة</p>
                    </div>
                    <div><span class="badge">تقرير عميل شامل</span></div>
                    <div style="text-align: left; font-size: 11px; font-family: monospace;">
                        <p style="margin: 0; color: #d97706; font-weight: bold;">تاريخ التقرير: ${todayStr}</p>
                    </div>
                </div>

                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 12px;">
                    <span style="margin-left: 20px;"><strong>اسم العميل:</strong> <span style="color: #b45309; font-weight: bold;">${clientName} (${clientObj.type === 'B' ? 'عميل ورشة B' : 'عميل مباشر A'})</span></span>
                    <span style="margin-left: 20px;"><strong>رقم الهاتف:</strong> ${clientObj.phone || '—'}</span>
                    <span><strong>العنوان:</strong> ${clientObj.address || '—'}</span>
                </div>

                <div class="section-title">أولاً: المشاريع المربوطة بالعميل</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">#</th>
                            <th style="width: 15%;">كود المشروع</th>
                            <th style="width: 35%;">اسم المشروع</th>
                            <th style="width: 25%;">المهندس المسؤول</th>
                            <th style="width: 20%;">رقم الهاتف</th>
                        </tr>
                    </thead>
                    <tbody>${projectsRowsHtml}</tbody>
                </table>

                <div class="section-title">ثانياً: تفاصيل أوامر الشغل والمنتجات</div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th><th>كود الأمر</th><th>المشروع</th><th>تفاصيل المنتجات والمواصفات</th><th>تاريخ التعاقد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th>
                        </tr>
                    </thead>
                    <tbody>${ordersRowsHtml}</tbody>
                </table>

                <div class="summary">
                    <span>إجمالي الأعمال: ${totalSales.toLocaleString()} ج.م</span>
                    <span style="color: #dc2626;">الخصم المباشر: ${discount.toLocaleString()} ج.م</span>
                    <span style="color: #059669;">إجمالي المدفوعات: ${totalPaid.toLocaleString()} ج.م</span>
                    <span style="color: #2563eb;">الرصيد المتبقي المستحق: ${remainingTotal.toLocaleString()} ج.م</span>
                </div>
            </div>
        </body>
        </html>
    `;

    executeWindowPrint(printContent);
}

// --- إدارة حسابات وتسعير الأكريليك والمنتجات ---
function calculateRowUnitSpecs(rowId) {
    const row = document.getElementById('ord-prod-row-' + rowId);
    if (!row) return;

    const prodName = row.querySelector('.product-select').value;
    const width = parseFloat(row.querySelector('.product-width').value) || 0;
    const height = parseFloat(row.querySelector('.product-height').value) || 0;
    const qty = parseFloat(row.querySelector('.product-qty').value) || 1;
    const resultInput = document.getElementById('unit-calc-result-' + rowId);

    const prodObj = productsList.find(p => p.name === prodName);

    if (!prodObj) {
        if (resultInput) resultInput.value = '—';
        return;
    }

    if (prodObj.priceType === 'unit') {
        resultInput.value = `${qty} قطعة`;
    } else if (prodObj.priceType === 'lm') {
        const totalLM = (height / 100) * qty;
        resultInput.value = `${totalLM.toFixed(2)} متر طولي`;
    } else if (prodObj.priceType === 'acrylic_facade') {
        let heightMultiplier = Math.ceil(height / 50);
        if (heightMultiplier < 1) heightMultiplier = 1;
        const widthFactor = width / 100;
        const totalUnits = heightMultiplier * widthFactor * qty;
        resultInput.value = `${totalUnits.toFixed(2)} متر احتسابي (واجهة أكريليك)`;
    } else {
        const totalSqm = ((width * height) / 10000) * qty;
        resultInput.value = `${totalSqm.toFixed(2)} م²`;
    }
}

function openProductPage() {
    document.getElementById('edit-product-index').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-price-type').value = 'sqm';
    document.getElementById('product-price').value = '';
    if (document.getElementById('product-cost')) document.getElementById('product-cost').value = '';
    document.getElementById('product-page-title').innerHTML = `<i class="fa-solid fa-box text-amber-500 ml-2"></i> إضافة منتج جديد`;
    switchTab('product-form');
}

function saveProduct(e) {
    e.preventDefault();
    const index = document.getElementById('edit-product-index').value;
    const costInput = document.getElementById('product-cost');
    
    const data = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        priceType: document.getElementById('product-price-type').value,
        price: parseFloat(document.getElementById('product-price').value) || 0,
        cost: costInput ? (parseFloat(costInput.value) || 0) : 0
    };

    if (index !== '') {
        productsList[index] = data;
    } else {
        productsList.push(data);
    }

    saveData('productsList', productsList);
    renderAllTables();
    populateOrderDropdowns();
    switchTab('products');
}

function editProduct(index) {
    if (!hasPerm('editProduct')) { alert('ليس لديك صلاحية لتعديل المنتجات'); return; }
    const p = productsList[index];
    document.getElementById('edit-product-index').value = index;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-category').value = p.category;
    document.getElementById('product-price-type').value = p.priceType || 'sqm';
    document.getElementById('product-price').value = p.price;
    if (document.getElementById('product-cost')) document.getElementById('product-cost').value = p.cost || 0;
    
    document.getElementById('product-page-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500 ml-2"></i> تعديل بيانات المنتج`;
    switchTab('product-form');
}

function deleteProduct(index) {
    if (!hasPerm('deleteProduct')) { alert('ليس لديك صلاحية لحذف المنتجات'); return; }
    const p = productsList[index];
    if (!p) return;

    const reason = prompt(`سبب حذف المنتَج (${p.name})؟`);
    if (!reason) return;

    sendToTrash('منتج/خامة', p.name, '—', '—', reason, getCurrentUserName(), p);
    productsList.splice(index, 1);
    saveData('productsList', productsList);
    renderAllTables();
    populateOrderDropdowns();
}

function openCategoryPage() { switchTab('category-form'); }

function addNewCategory(e) {
    e.preventDefault();
    const input = document.getElementById('new-category-input');
    const val = input.value.trim();
    if(val && !categoriesList.includes(val)) {
        categoriesList.push(val);
        saveData('categoriesList', categoriesList);
        input.value = '';
        populateCategoriesDropdown();
    }
}

function deleteCategory(index) {
    if(confirm('مسح هذا التصنيف؟')) {
        categoriesList.splice(index, 1);
        saveData('categoriesList', categoriesList);
        populateCategoriesDropdown();
    }
}

// --- إدارة المخزن وجرد الخامات ---
function openInventoryPage() {
    const form = document.querySelector('#page-inventory-form form');
    if (form) form.reset();
    const editIndex = document.getElementById('edit-inventory-index');
    if (editIndex) editIndex.value = '';
    const title = document.getElementById('inventory-page-title');
    if (title) title.innerHTML = '<i class="fa-solid fa-boxes-packing text-amber-500 ml-2"></i> إضافة صنف جديد للمخزن';
    
    if (typeof populateCategoriesDropdown === 'function') {
        populateCategoriesDropdown();
    }
    switchTab('inventory-form');
}

function saveInventoryItem(e) {
    if (e) e.preventDefault();
    const editIndex = document.getElementById('edit-inventory-index')?.value;
    const name = document.getElementById('inv-item-name')?.value || '';
    const cat = document.getElementById('inv-item-cat')?.value || 'عام';
    const qty = parseFloat(document.getElementById('inv-item-qty')?.value) || 0;
    const unit = document.getElementById('inv-item-unit')?.value || 'قطعة';
    const cost = parseFloat(document.getElementById('inv-item-cost')?.value) || 0;

    const invData = { name, category: cat, qty, stockQuantity: qty, unit, cost, costPrice: cost };

    if (editIndex !== undefined && editIndex !== '') {
        inventoryList[editIndex] = invData;
    } else {
        inventoryList.push(invData);
    }

    saveData('inventoryList', inventoryList);
    renderAllTables();
    switchTab('inventory');
}

function editInventoryItem(index) {
    const item = inventoryList[index];
    if (!item) return;

    if (document.getElementById('edit-inventory-index')) document.getElementById('edit-inventory-index').value = index;
    if (document.getElementById('inv-item-name')) document.getElementById('inv-item-name').value = item.name || '';
    if (document.getElementById('inv-item-cat')) document.getElementById('inv-item-cat').value = item.category || '';
    if (document.getElementById('inv-item-qty')) document.getElementById('inv-item-qty').value = item.qty || item.stockQuantity || 0;
    if (document.getElementById('inv-item-unit')) document.getElementById('inv-item-unit').value = item.unit || 'قطعة';
    if (document.getElementById('inv-item-cost')) document.getElementById('inv-item-cost').value = item.cost || item.costPrice || 0;

    const title = document.getElementById('inventory-page-title');
    if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-500 ml-2"></i> تعديل صنف بالمخزن';

    if (typeof populateCategoriesDropdown === 'function') {
        populateCategoriesDropdown();
    }
    switchTab('inventory-form');
}

function deleteInventoryItem(index) {
    if (confirm('هل أنت تأكد من حذف هذا الصنف من المخزن؟')) {
        inventoryList.splice(index, 1);
        saveData('inventoryList', inventoryList);
        renderAllTables();
    }
}

function depositStock(index) {
    const item = inventoryList[index];
    if (!item) return;
    const addQty = prompt(`إيداع كمية لخامة (${item.name}):\nأدخل الكمية المراد إضافتها:`, "0");
    if (addQty !== null && !isNaN(addQty) && parseFloat(addQty) > 0) {
        item.qty = (parseFloat(item.qty || item.stockQuantity) || 0) + parseFloat(addQty);
        item.stockQuantity = item.qty;
        saveData('inventoryList', inventoryList);
        renderAllTables();
    }
}

function withdrawStock(index) {
    const item = inventoryList[index];
    if (!item) return;
    const currentQty = parseFloat(item.qty || item.stockQuantity) || 0;
    const subQty = prompt(`صرف كمية من خامة (${item.name}):\nالرصيد المتاح: ${currentQty}\nأدخل الكمية المراد صرفها:`, "0");
    if (subQty !== null && !isNaN(subQty) && parseFloat(subQty) > 0) {
        if (parseFloat(subQty) > currentQty) {
            alert('خطأ: الكمية المنصرفة أكبر من الرصيد المتاح بالمخزن!');
            return;
        }
        item.qty = currentQty - parseFloat(subQty);
        item.stockQuantity = item.qty;
        saveData('inventoryList', inventoryList);
        renderAllTables();
    }
}
// --- إدارة المشاريع ---
function openProjectPage() {
    document.getElementById('edit-project-index').value = '';
    document.getElementById('proj-client').value = '';
    document.getElementById('proj-name').value = '';
    
    document.getElementById('project-page-title').innerHTML = `<i class="fa-solid fa-folder-plus text-amber-500 ml-2"></i> إضافة مشروع جديد`;
    populateOrderDropdowns();
    switchTab('project-form');
}

function saveProject(e) {
    if (e) e.preventDefault();
    const idx = document.getElementById('edit-project-index').value;
    const clientName = document.getElementById('proj-client').value;
    const projName = document.getElementById('proj-name').value;

    // جلب رقم هاتف العميل المختار تلقائياً من قائمة العملاء
    const clientObj = clientsList.find(c => c.name === clientName) || {};
    const ownerPhone = clientObj.phone || '—';

    let pCode = '';
    if (idx !== '' && projectsList[idx]) {
        pCode = projectsList[idx].code;
    } else {
        let nextCodeNum = projectsList.length + 1;
        let savedCounter = parseInt(localStorage.getItem('projectAutoCounter')) || nextCodeNum;
        if (savedCounter < nextCodeNum) savedCounter = nextCodeNum;
        pCode = 'PRJ-' + savedCounter;
        
        saveData('projectAutoCounter', savedCounter + 1);
    }

    const pData = {
        client: clientName,
        name: projName,
        code: pCode,
        engineer: idx !== '' && projectsList[idx] ? projectsList[idx].engineer : getCurrentUserName(),
        ownerPhone: ownerPhone
    };

    if (idx !== '') {
        projectsList[idx] = pData;
    } else {
        projectsList.push(pData);
    }

    saveData('projectsList', projectsList);
    renderAllTables();
    populateOrderDropdowns();
    switchTab('projects');
}

function editProject(index) {
    if (!hasPerm('editProject')) { alert('ليس لديك صلاحية لتعديل المشاريع'); return; }
    const p = projectsList[index];
    if (!p) return;

    document.getElementById('edit-project-index').value = index;
    document.getElementById('proj-client').value = p.client;
    document.getElementById('proj-name').value = p.name;
    
    document.getElementById('project-page-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500 ml-2"></i> تعديل بيانات المشروع`;
    switchTab('project-form');
}

function deleteProject(index) {
    if (!projectsList[index]) return;

    const targetProject = projectsList[index];
    const linkedOrders = fullOrdersList.filter(o => o.projectCode === targetProject.code || o.project === targetProject.name);

    if (linkedOrders.length > 0) {
        alert(`عذراً، لا يمكن حذف المشروع (${targetProject.code}) لأنه يحتوي على عدد (${linkedOrders.length}) أمر شغل مرتبط به.`);
        return;
    }

    const reason = prompt(`سبب حذف المشروع (${targetProject.name})؟`);
    if (!reason) return;

    sendToTrash('مشروع', targetProject.code, targetProject.client, targetProject.name, reason, getCurrentUserName(), targetProject);

    projectsList.splice(index, 1);
    saveData('projectsList', projectsList);
    renderAllTables();
}

function filterProjectsTable() {
    const input = document.getElementById('search-projects-input');
    if (!input) return;
    const query = input.value.trim().toLowerCase();

    const rows = document.querySelectorAll('#projects-table-body tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}


// --- إدارة أوامر الشغل ---

function openOrderPage() {
    document.getElementById('edit-order-index').value = '';
    document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
    let currentCounter = parseInt(localStorage.getItem('orderAutoCounter')) || 1;
    const codeInput = document.getElementById('order-code-input');
    if (codeInput) codeInput.value = `ORD - ${currentCounter}`;

    document.getElementById('select-order-client').value = '';
    
    const projSelect = document.getElementById('select-order-project');
    if (projSelect) projSelect.innerHTML = '<option value="">-- اختر العميل أولاً --</option>';

    const deliveryDateInput = document.getElementById('order-delivery-date');
    if (deliveryDateInput) deliveryDateInput.value = '';

    const paidInput = document.getElementById('order-paid-amount');
    if (paidInput) paidInput.value = '';

    document.getElementById('order-image-input').value = '';
    pastedImageData = null;
    const previewDiv = document.getElementById('pasted-image-preview');
    if (previewDiv) previewDiv.classList.add('hidden');

    document.getElementById('order-page-title').innerHTML = `<i class="fa-solid fa-file-signature text-amber-500 ml-2"></i> إضافة أمر شغل جديد`;
    
    document.getElementById('products-dynamic-container').innerHTML = '';
    addProductRow();
    populateOrderDropdowns();

    switchTab('order-form');
    setupPasteEventListener();
}

function addProductRow() {
    const container = document.getElementById('products-dynamic-container');
    if (!container) return;
    
    const rowId = Date.now();
    const newRow = document.createElement('div');
    newRow.className = 'product-row grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg border items-end mt-2';
    newRow.id = 'ord-prod-row-' + rowId;
    newRow.innerHTML = `
        <div class="md:col-span-3">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">المنتج</label>
            <select onchange="calculateRowUnitSpecs('${rowId}')" class="product-select w-full px-2 py-1.5 border rounded text-xs bg-white outline-none" required></select>
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">العرض (سم)</label>
            <input type="number" oninput="calculateRowUnitSpecs('${rowId}')" placeholder="العرض" class="product-width w-full px-2 py-1.5 border rounded text-xs outline-none">
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">الارتفاع (سم)</label>
            <input type="number" oninput="calculateRowUnitSpecs('${rowId}')" placeholder="الارتفاع" class="product-height w-full px-2 py-1.5 border rounded text-xs outline-none">
        </div>
        <div class="md:col-span-1">
            <label class="block text-[11px] font-bold text-amber-800 mb-1">العدد</label>
            <input type="number" value="1" min="1" oninput="calculateRowUnitSpecs('${rowId}')" placeholder="1" class="product-qty w-full px-2 py-1.5 border rounded text-xs font-bold outline-none">
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-blue-700 mb-1">وحدة القياس / الناتِج</label>
            <input type="text" id="unit-calc-result-${rowId}" readonly value="—" class="w-full px-2 py-1.5 border rounded text-xs font-black bg-blue-50 text-blue-800 outline-none">
        </div>
        <div class="md:col-span-1">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">الملاحظات</label>
            <input type="text" placeholder="ملاحظات..." class="product-notes w-full px-2 py-1.5 border rounded text-xs outline-none">
        </div>
        <div class="md:col-span-1 text-center">
            <button type="button" onclick="document.getElementById('ord-prod-row-${rowId}').remove()" class="bg-red-100 text-red-600 font-bold p-1.5 rounded text-xs w-full"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    container.appendChild(newRow);
    populateSingleProductDropdown(newRow.querySelector('.product-select'));
}

function populateSingleProductDropdown(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- اختر المنتج --</option>';
    if (typeof productsList !== 'undefined') {
        productsList.forEach(p => {
            selectEl.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
    }
}

// --- دالة حفظ أمر الشغل (المصححة لتعمل 100% مع السيستم) ---
function saveFullOrder(e) {
    if (e) e.preventDefault();
    
    const clientName = document.getElementById('select-order-client')?.value;
    const projectName = document.getElementById('select-order-project')?.value;
    
    if (!clientName) {
        alert('برجاء اختيار العميل');
        return;
    }
    if (!projectName) {
        alert('برجاء اختيار المشروع التابع له');
        return;
    }

    const idx = document.getElementById('edit-order-index')?.value;
    const deliveryDate = document.getElementById('order-delivery-date')?.value || new Date().toISOString().split('T')[0];
    const paidAmount = parseFloat(document.getElementById('order-paid-amount')?.value) || 0;

    // تجميع الأصناف من الصفوف الديناميكية بدقة
    const rows = document.querySelectorAll('.product-row');
    let productsSummaryText = '';
    let grandTotal = 0;

    rows.forEach(row => {
        const prodName = row.querySelector('.product-select')?.value;
        const width = parseFloat(row.querySelector('.product-width')?.value) || 0;
        const height = parseFloat(row.querySelector('.product-height')?.value) || 0;
        const qty = parseFloat(row.querySelector('.product-qty')?.value) || 1;
        const notes = row.querySelector('.product-notes')?.value || '';

        if (prodName) {
            const prodObj = productsList.find(p => p.name === prodName);
            const unitPrice = prodObj ? (parseFloat(prodObj.price) || 0) : 0;
            
            let itemTotal = 0;
            if (width > 0 && height > 0) {
                itemTotal = ((width / 100) * (height / 100) * qty * unitPrice);
            } else {
                itemTotal = qty * unitPrice;
            }

            grandTotal += itemTotal;
            productsSummaryText += `- ${prodName} (مقاس: ${width}×${height} سم، عدد: ${qty}) [إجمالي: ${itemTotal} ج.م] ${notes ? ' - ملاحظات: ' + notes : ''}\n`;
        }
    });

    let orderCode = document.getElementById('order-code-input')?.value;
    if (!orderCode) {
        let currentCounter = parseInt(localStorage.getItem('orderAutoCounter')) || (fullOrdersList.length + 1);
        orderCode = `ORD - ${currentCounter}`;
    }

    const orderData = {
        code: orderCode,
        client: clientName,
        project: projectName,
        engineer: getCurrentUserName(),
        contractDate: new Date().toISOString().split('T')[0],
        deliveryDate: deliveryDate,
        paidAmount: paidAmount,
        totalAmount: grandTotal,
        products: productsSummaryText || 'بدون تفاصيل',
        image: pastedImageData || ''
    };

    if (idx !== undefined && idx !== '' && fullOrdersList[idx]) {
        fullOrdersList[idx] = orderData;
    } else {
        fullOrdersList.unshift(orderData);
        let currentCounter = parseInt(localStorage.getItem('orderAutoCounter')) || (fullOrdersList.length + 1);
        localStorage.setItem('orderAutoCounter', currentCounter + 1);
    }

    saveData('fullOrdersList', fullOrdersList);
    
    // تسجيل دفعة العربون في الخزينة تلقائياً لو تم إدخال مبلغ مدفوع
    if (paidAmount > 0 && (idx === undefined || idx === '')) {
        const transObj = {
            date: new Date().toISOString().split('T')[0],
            type: 'in',
            category: 'مبيعات وعملاء',
            desc: `دفعة مقدمة / عربون أمر شغل (${orderCode})`,
            amount: paidAmount,
            method: 'نقداً (كاش)',
            user: getCurrentUserName(),
            client: clientName,
            project: projectName,
            orderCode: orderCode
        };
        financeTransactions.unshift(transObj);
        saveData('financeTransactions', financeTransactions);
    }

    if (typeof renderAllTables === 'function') renderAllTables();
    if (typeof switchTab === 'function') switchTab('orders');
}

function editOrder(index) {
    if (!hasPerm('editOrder')) { alert('ليس لديك صلاحية لتعديل أوامر الشغل'); return; }
    const o = fullOrdersList[index];
    document.getElementById('edit-order-index').value = index;
    document.getElementById('order-code-input').value = o.code;
    document.getElementById('select-order-client').value = o.client;
    updateProjectsDropdown();
    document.getElementById('select-order-project').value = o.project;
    document.getElementById('order-delivery-date').value = o.deliveryDate;
    if (document.getElementById('order-paid-amount')) document.getElementById('order-paid-amount').value = o.paidAmount || 0;
    
    if (o.image) {
        pastedImageData = o.image;
        showPastedPreview(o.image);
    }

    document.getElementById('order-page-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500 ml-2"></i> تعديل أمر الشغل`;
    switchTab('order-form');
}

function deleteOrder(index) {
    if (!hasPerm('deleteOrder')) { alert('ليس لديك صلاحية لحذف أوامر الشغل'); return; }
    if (!fullOrdersList[index]) return;

    const modal = document.getElementById('delete-order-modal');
    targetOrderIndexToDelete = index;
    document.getElementById('delete-order-reason').value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeDeleteOrderModal() {
    targetOrderIndexToDelete = null;
    const modal = document.getElementById('delete-order-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function confirmDeleteOrderWithReason() {
    if (targetOrderIndexToDelete === null || !fullOrdersList[targetOrderIndexToDelete]) {
        closeDeleteOrderModal();
        return;
    }

    const reason = document.getElementById('delete-order-reason').value.trim();
    if (!reason) {
        alert('ممنوع مسح أمر الشغل بدون توضيح السبب!');
        return;
    }

    const o = fullOrdersList[targetOrderIndexToDelete];
    sendToTrash('أمر شغل', o.code, o.client, o.project, reason, getCurrentUserName(), o);

const deletedOrderIndex = targetOrderIndexToDelete;
const deletedOrderCode = String(o.code || '');
const deletedOrderNumber = parseInt(deletedOrderCode.replace('ORD - ', ''), 10);

fullOrdersList.splice(deletedOrderIndex, 1);

if (
    !isNaN(deletedOrderNumber) &&
    deletedOrderIndex === 0 &&
    !fullOrdersList.some(order => {
        return parseInt(String(order.code || '').replace('ORD - ', ''), 10) > deletedOrderNumber;
    })
) {
    orderAutoCounter = deletedOrderNumber;
    saveData('orderAutoCounter', orderAutoCounter);
}    saveData('fullOrdersList', fullOrdersList);
    closeDeleteOrderModal();
    renderAllTables();
}

function filterOrdersTable() {
    const input = document.getElementById('search-orders-input');
    if (!input) return;
    const query = input.value.trim().toLocaleLowerCase('ar');
    const rows = document.querySelectorAll('#operations-table-body tr');
    rows.forEach(row => {
        const text = (row.innerText || '').toLocaleLowerCase('ar');
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function printWorkshopOrder(index) {
    const o = fullOrdersList[index];
    if (!o) return;

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>أمر شغل / تنفيذ - ${o.code || ''}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 15px; color: #000; }
                .border-box { border: 2px solid #000; border-radius: 8px; padding: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
                .badge { background: #000; color: #fff; padding: 6px 16px; border-radius: 4px; font-weight: bold; font-size: 16px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px; }
                td { border: 1px solid #000; padding: 8px; }
                .bg-gray { background-color: #f3f4f6; }
                .products-box { border: 1px solid #000; padding: 15px; border-radius: 6px; margin-bottom: 15px; background: #fafafa; }
                img { max-height: 380px; max-width: 100%; border-radius: 6px; border: 1px solid #000; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="border-box">
                <div class="header">
                    <div>
                        <h1 style="margin:0; font-size: 24px;">LAMSA - أمر تنفيذ وتشغيل</h1>
                        <p style="margin:3px 0 0; font-size:12px; font-weight:bold;">شركة لمسة للدعاية والإعلان</p>
                    </div>
                    <div><span class="badge">أمر شغل</span></div>
                    <div style="font-family: monospace; font-size: 13px;">
                        <p style="margin:0; font-weight:bold;">كود الأمر: ${o.code}</p>
                        <p style="margin:2px 0 0;">تاريخ التسليم: ${o.deliveryDate || '—'}</p>
                    </div>
                </div>
                <table>
                    <tr class="bg-gray">
                        <td style="font-weight:bold; width: 15%;">اسم العميل:</td><td>${o.client || '—'}</td>
                        <td style="font-weight:bold; width: 15%;">اسم المشروع:</td><td style="font-weight:bold;">${o.project || '—'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight:bold;">المهندس المسؤول:</td><td colspan="3">${o.engineer || '—'}</td>
                    </tr>
                </table>
                <div class="products-box">
                    <h3 style="margin-top:0;">تفاصيل الأصناف والمواصفات الفنية المطلوبة:</h3>
                    <p style="font-size: 14px; line-height: 1.6; font-weight: bold;">${o.products || '—'}</p>
                </div>
                ${o.image ? `<div style="text-align:center;"><h4>صورة المعاينة / التصميم التنفيذي:</h4><img src="${o.image}"></div>` : ''}
            </div>
        </body>
        </html>
    `;
    executeWindowPrint(printContent);
}

function setupPasteEventListener() {
    window.removeEventListener('paste', handleImagePaste);
    window.addEventListener('paste', handleImagePaste);

    const fileInput = document.getElementById('order-image-input');
    if (fileInput) {
        fileInput.onchange = function () {
            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    pastedImageData = e.target.result;
                    showPastedPreview(pastedImageData);
                };
                reader.readAsDataURL(fileInput.files[0]);
            }
        };
    }
}

function handleImagePaste(e) {
    const orderForm = document.getElementById('page-order-form');
    if (orderForm && orderForm.classList.contains('hidden')) return;

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function (event) {
                pastedImageData = event.target.result;
                showPastedPreview(pastedImageData);
            };
            reader.readAsDataURL(blob);
            break;
        }
    }
}

function showPastedPreview(src) {
    const previewDiv = document.getElementById('pasted-image-preview');
    const imgTag = document.getElementById('pasted-img-tag');
    if (previewDiv && imgTag) {
        imgTag.src = src;
        previewDiv.classList.remove('hidden');
    }
}

// --- إدارة عروض الأسعار والمبيعات ---
function openQuotationBuilder() {
    const dateInput = document.getElementById('quote-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const clientSelect = document.getElementById('quote-select-client');
    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">-- اختر العميل --</option>';
        if (typeof clientsList !== 'undefined' && Array.isArray(clientsList)) {
            clientsList.forEach(c => {
                clientSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        }
    }

    const container = document.getElementById('quote-items-container');
    if (container) {
        container.innerHTML = '';
        addQuoteItemRow();
    }

    switchTab('quotation-form');
}

function addQuoteItemRow() {
    const container = document.getElementById('quote-items-container');
    if (!container) return;

    const rowId = Date.now();
    const newRow = document.createElement('div');
    newRow.className = 'quote-row grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-white rounded-lg border items-end';
    newRow.id = 'quote-row-' + rowId;
    
    newRow.innerHTML = `
        <div class="md:col-span-4">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">المنتج / الخامة</label>
            <select onchange="calculateQuoteRowTotal('${rowId}')" class="quote-prod-select w-full px-2 py-1.5 border rounded text-xs outline-none bg-white"></select>
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">العرض (سم)</label>
            <input type="number" oninput="calculateQuoteRowTotal('${rowId}')" placeholder="0" class="quote-width w-full px-2 py-1.5 border rounded text-xs outline-none">
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">الارتفاع (سم)</label>
            <input type="number" oninput="calculateQuoteRowTotal('${rowId}')" placeholder="0" class="quote-height w-full px-2 py-1.5 border rounded text-xs outline-none">
        </div>
        <div class="md:col-span-1">
            <label class="block text-[11px] font-bold text-gray-700 mb-1">العدد</label>
            <input type="number" value="1" min="1" oninput="calculateQuoteRowTotal('${rowId}')" class="quote-qty w-full px-2 py-1.5 border rounded text-xs font-bold outline-none">
        </div>
        <div class="md:col-span-2">
            <label class="block text-[11px] font-bold text-emerald-700 mb-1">الإجمالي (ج.م)</label>
            <input type="text" readonly id="quote-row-total-${rowId}" value="0.00" class="quote-row-total-val w-full px-2 py-1.5 border rounded text-xs font-black bg-emerald-50 text-emerald-700 outline-none">
        </div>
        <div class="md:col-span-1 text-center">
            <button type="button" onclick="removeQuoteRow('${rowId}')" class="bg-red-50 text-red-600 font-bold p-1.5 rounded text-xs w-full border border-red-200"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    container.appendChild(newRow);

    const prodSelect = newRow.querySelector('.quote-prod-select');
    if (prodSelect) {
        prodSelect.innerHTML = '<option value="">-- اختر المنتَج --</option>';
        productsList.forEach((p, idx) => {
            prodSelect.innerHTML += `<option value="${idx}">${p.name} (${p.price} ج.م)</option>`;
        });
    }
}

// دالة حفظ وعرض السعر مع الترقيم التلقائي المبتدئ من Q-1
function saveAndPreviewQuotation() {
    const clientSelect = document.getElementById('quote-select-client');
    const client = clientSelect ? clientSelect.value : '';
    const date = document.getElementById('quote-date').value;
    const rows = document.querySelectorAll('.quote-row');

    let items = [];
    let total = 0;

    rows.forEach(row => {
        const prodIdx = row.querySelector('.quote-prod-select').value;
        const width = parseFloat(row.querySelector('.quote-width').value) || 0;
        const height = parseFloat(row.querySelector('.quote-height').value) || 0;
        const qty = parseFloat(row.querySelector('.quote-qty').value) || 1;

        if (prodIdx !== '' && productsList[prodIdx]) {
            const prod = productsList[prodIdx];
            let itemTotal = 0;
            let areaFormatted = `${qty} قطعة`;

            if (prod.priceType === 'acrylic_facade') {
                let heightMultiplier = Math.ceil(height / 50);
                if (heightMultiplier < 1) heightMultiplier = 1;
                const totalUnits = heightMultiplier * (width / 100) * qty;
                itemTotal = totalUnits * prod.price;
                areaFormatted = `${totalUnits.toFixed(2)} م.احتسابي`;
            } else if (prod.priceType === 'unit') {
                itemTotal = prod.price * qty;
            } else if (prod.priceType === 'lm') {
                itemTotal = (height / 100) * qty * prod.price;
                areaFormatted = `${((height / 100) * qty).toFixed(2)} م.ط`;
            } else {
                let totalArea = ((width * height) / 10000) * qty;
                itemTotal = totalArea * prod.price;
                areaFormatted = `${totalArea.toFixed(2)} م²`;
            }

            items.push({
                name: prod.name,
                width: width,
                height: height,
                qty: qty,
                areaFormatted: areaFormatted,
                unitPrice: prod.price,
                total: itemTotal
            });
            total += itemTotal;
        }
    });

    if (items.length === 0) {
        alert('برجاء اختيار خامة واحدة على الأقل وتحديد المقاسات والعدد بشكل صحيح');
        return;
    }

    activeQuoteData = {
        id: '', 
        client: client || 'عميل نقدي',
        date: date,
        items: items,
        total: total
    };

    quotationsList.unshift(activeQuoteData);

    // إعادة الترقيم التسلسلي ليبدأ من Q-1 تلقائياً
    quotationsList.forEach((q, index) => {
        q.id = 'Q-' + (quotationsList.length - index);
    });

    saveData('quotationsList', quotationsList);

    renderAllTables();
    showQuotationPreviewModal(activeQuoteData);
}

// دالة تعديل عرض السعر
function editQuotation(index) {
    const q = quotationsList[index];
    if (!q) return;

    openQuotationBuilder();
    
    if (document.getElementById('quote-date')) document.getElementById('quote-date').value = q.date;
    if (document.getElementById('quote-select-client')) document.getElementById('quote-select-client').value = q.client;

    const container = document.getElementById('quote-items-container');
    if (container && q.items) {
        container.innerHTML = '';
        q.items.forEach(item => {
            addQuoteItemRow();
            const rows = container.querySelectorAll('.quote-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                const prodSelect = lastRow.querySelector('.quote-prod-select');
                if (prodSelect) {
                    for (let i = 0; i < prodSelect.options.length; i++) {
                        if (prodSelect.options[i].text.includes(item.name)) {
                            prodSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
                if (lastRow.querySelector('.quote-width')) lastRow.querySelector('.quote-width').value = item.width || 0;
                if (lastRow.querySelector('.quote-height')) lastRow.querySelector('.quote-height').value = item.height || 0;
                if (lastRow.querySelector('.quote-qty')) lastRow.querySelector('.quote-qty').value = item.qty || 1;
            }
        });
        
        const rows = container.querySelectorAll('.quote-row');
        rows.forEach(r => {
            const rowId = r.id.replace('quote-row-', '');
            calculateQuoteRowTotal(rowId);
        });
    }

    quotationsList.splice(index, 1);
    
    quotationsList.forEach((item, idx) => {
        item.id = 'Q-' + (quotationsList.length - idx);
    });

    saveData('quotationsList', quotationsList);
    renderAllTables();
}

// دالة الموافقة على عرض السعر وتحويله مباشرة لأمر شغل
function approveQuotation(index) {
    const q = quotationsList[index];
    if (!q) return;

    if (confirm(`هل تم الموافقة على عرض السعر (${q.id}) للعميل (${q.client}) ونقله إلى أوامر التشغيل؟`)) {
        openOrderPage();
        if (document.getElementById('select-order-client')) document.getElementById('select-order-client').value = q.client;
        updateProjectsDropdown();
        
        alert(`تم اعتماد عرض السعر (${q.id})، يمكنك الآن اختيار المشروع وتحديد تاريخ التسليم للحفظ كأمر شغل!`);
    }
}

function calculateQuoteRowTotal(rowId) {
    const row = document.getElementById('quote-row-' + rowId);
    if (!row) return;

    const prodIdx = row.querySelector('.quote-prod-select').value;
    const width = parseFloat(row.querySelector('.quote-width').value) || 0;
    const height = parseFloat(row.querySelector('.quote-height').value) || 0;
    const qty = parseFloat(row.querySelector('.quote-qty').value) || 1;
    const totalInput = document.getElementById('quote-row-total-' + rowId);

    if (prodIdx !== '' && productsList[prodIdx]) {
        const prod = productsList[prodIdx];
        let itemTotal = 0;

        if (prod.priceType === 'unit') {
            itemTotal = prod.price * qty;
        } else if (prod.priceType === 'lm') {
            itemTotal = (height / 100) * qty * prod.price;
        } else if (prod.priceType === 'acrylic_facade') {
            let heightMultiplier = Math.ceil(height / 50);
            if (heightMultiplier < 1) heightMultiplier = 1;
            itemTotal = heightMultiplier * (width / 100) * qty * prod.price;
        } else {
            const totalSqm = ((width * height) / 10000) * qty;
            itemTotal = totalSqm * prod.price;
        }

        if (totalInput) totalInput.value = itemTotal.toFixed(2);
    } else {
        if (totalInput) totalInput.value = '0.00';
    }

    calculateQuoteGrandTotal();
}

function calculateQuoteGrandTotal() {
    const totalInputs = document.querySelectorAll('.quote-row-total-val');
    let grandTotal = 0;
    totalInputs.forEach(inp => {
        grandTotal += parseFloat(inp.value) || 0;
    });

    const grandEl = document.getElementById('quote-calculated-total');
    if (grandEl) grandEl.textContent = grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' ج.م';
}

function removeQuoteRow(rowId) {
    const row = document.getElementById('quote-row-' + rowId);
    if (row) {
        row.remove();
        calculateQuoteGrandTotal();
    }
}

function closeQuotationBuilder() {
    switchTab('sales');
}

function renderSalesTable() {
    const tbody = document.getElementById('quotations-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalVal = 0;

    if (!quotationsList || quotationsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">لا توجد عروض أسعار مسجلة حتى الآن</td></tr>`;
    } else {
        quotationsList.forEach((q, idx) => {
            const val = parseFloat(q.total) || 0;
            totalVal += val;

            tbody.innerHTML += `
                <tr class="hover:bg-amber-50/50 text-center border-b">
                    <td class="p-3 border font-mono font-bold text-amber-600">${q.id || '—'}</td>
                    <td class="p-3 border text-right font-bold text-gray-800">${q.client || '—'}</td>
                    <td class="p-3 border font-mono">${q.date || '—'}</td>
                    <td class="p-3 border font-mono font-bold text-blue-600">${val.toLocaleString()} ج.م</td>
                    <td class="p-3 border text-center">
                        <button onclick="showQuotationPreviewModal(quotationsList[${idx}])" class="bg-amber-50 text-amber-600 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-200 inline-flex items-center justify-center shadow-sm" title="معاينة عرض السعر">
                            <i class="fa-solid fa-file-lines ml-1"></i> معاينة
                        </button>
                    </td>
                    <td class="p-3 border text-center space-x-1 space-x-reverse">
                        <button onclick="approveQuotation(${idx})" class="text-emerald-600 hover:text-emerald-800 px-1 font-bold" title="موافقة تحويل لأمر شغل"><i class="fa-solid fa-circle-check"></i></button>
                        <button onclick="editQuotation(${idx})" class="text-blue-600 hover:text-blue-800 px-1 font-bold" title="تعديل عرض السعر"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteQuotation(${idx})" class="text-red-600 hover:text-red-800 px-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    const statTotal = document.getElementById('stat-total-quotes');
    const statCount = document.getElementById('stat-quotes-count');
    const statDate = document.getElementById('stat-latest-quote-date');

    if (statTotal) statTotal.innerText = totalVal.toLocaleString() + ' ج.م';
    if (statCount) statCount.innerText = quotationsList ? quotationsList.length : 0;
    if (statDate) statDate.innerText = (quotationsList && quotationsList.length > 0) ? quotationsList[0].date : '—';
}
function deleteQuotation(index) {
    if (!quotationsList[index]) return;
    const q = quotationsList[index];

    const isLinkedToProject = projectsList.some(p => p.client === q.client);
    const isLinkedToOrder = fullOrdersList.some(o => o.client === q.client);

    if (isLinkedToProject || isLinkedToOrder) {
        alert(`عذراً! ممنوع منعا باتاً حذف عرض السعر (${q.id}) لأنه مرتبط بمشروع أو أمر شغل خاص بالعميل (${q.client}).`);
        return;
    }

    const reason = prompt(`سبب حذف عرض السعر (${q.id})؟`);
    if (!reason || !reason.trim()) {
        alert('يلزم إدخال سبب الحذف!');
        return;
    }

    sendToTrash('عرض سعر', q.id, q.client, '—', reason, getCurrentUserName(), q);
    quotationsList.splice(index, 1);

    quotationsList.forEach((item, idx) => {
        item.id = 'Q-' + (quotationsList.length - idx);
    });

    saveData('quotationsList', quotationsList);
    renderAllTables();
}

function showQuotationPreviewModal(qData) {
    const q = qData || activeQuoteData;
    if (!q) return;

    const elId = document.getElementById('preview-quote-id');
    const elDate = document.getElementById('preview-quote-date');
    const elClient = document.getElementById('preview-quote-client');
    const elTotal = document.getElementById('preview-quote-total');

    if (elId) elId.textContent = q.id;
    if (elDate) elDate.textContent = q.date;
    if (elClient) elClient.textContent = q.client;
    if (elTotal) elTotal.textContent = q.total.toLocaleString() + ' ج.م';

    const tbody = document.getElementById('preview-quote-items-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        q.items.forEach((item, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td class="p-2 border border-gray-300 font-bold text-center">${idx + 1}</td>
                    <td class="p-2 border border-gray-300 font-bold">${item.name}</td>
                    <td class="p-2 border border-gray-300 text-center font-mono">${item.width} × ${item.height} سم</td>
                    <td class="p-2 border border-gray-300 text-center font-bold text-amber-700">${item.qty}</td>
                    <td class="p-2 border border-gray-300 text-center font-bold">${item.areaFormatted}</td>
                    <td class="p-2 border border-gray-300 text-center font-mono">${item.unitPrice.toLocaleString()} ج.م</td>
                    <td class="p-2 border border-gray-300 text-left font-black text-emerald-600">${item.total.toLocaleString()} ج.م</td>
                </tr>
            `;
        });
    }

    const modal = document.getElementById('modal-quotation-preview');
    if (modal) modal.classList.remove('hidden');
}

function closeQuotationModal() {
    const modal = document.getElementById('modal-quotation-preview');
    if (modal) modal.classList.add('hidden');
}

function printQuotationDocument(qData) {
    const q = qData || activeQuoteData;
    if (!q) return;

    let rowsHtml = '';
    q.items.forEach((item, idx) => {
        rowsHtml += `
            <tr style="border-bottom: 1px solid #ccc; text-align: center;">
                <td style="padding: 6px;">${idx + 1}</td>
                <td style="padding: 6px; font-weight: bold; text-align: right;">${item.name}</td>
                <td style="padding: 6px; font-family: monospace;">${item.width} × ${item.height} سم</td>
                <td style="padding: 6px; font-weight: bold;">${item.qty}</td>
                <td style="padding: 6px;">${item.areaFormatted}</td>
                <td style="padding: 6px; font-family: monospace;">${item.unitPrice.toLocaleString()} ج.م</td>
                <td style="padding: 6px; font-weight: bold; color: #059669;">${item.total.toLocaleString()} ج.م</td>
            </tr>
        `;
    });

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>عرض سعر - ${q.id}</title>
            <style>
                @page { size: auto; margin: 15mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 15px; color: #111; }
                .box { border: 2px solid #111; border-radius: 8px; padding: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 15px; }
                .badge { background: #000; color: #fff; padding: 6px 18px; border-radius: 4px; font-weight: bold; font-size: 15px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; }
                th, td { border: 1px solid #6b7280; padding: 6px; }
                th { background-color: #1f2937 !important; color: #fff !important; }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="header">
                    <div>
                        <h1 style="margin: 0; color: #d97706; font-size: 24px;">LAMSA</h1>
                        <p style="margin: 3px 0 0; font-size: 11px; font-weight: bold;">شركة لمسة للدعاية والإعلان والطباعة</p>
                    </div>
                    <div><span class="badge">عرض سعر (Quotation)</span></div>
                    <div style="font-family: monospace; font-size: 11px;">
                        <p style="margin: 0; color: #d97706; font-weight: bold;">كود العرض: ${q.id}</p>
                        <p style="margin: 3px 0 0;">التاريخ: ${q.date}</p>
                    </div>
                </div>
                <div style="padding: 10px; border: 1px solid #e5e7eb; margin-bottom: 15px;">
                    <strong>السيد / العميل:</strong> <span>${q.client}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th><th>المنتج / الخامة</th><th>المقاس (سم)</th><th>العدد</th><th>المساحة/الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div style="text-align: left; font-weight: bold; font-size: 13px;">
                    إجمالي عرض السعر: <span style="color: #2563eb;">${q.total.toLocaleString()} ج.م</span>
                </div>
            </div>
        </body>
        </html>
    `;

    executeWindowPrint(printContent);
}

function downloadQuoteAsPDF() {
    const element = document.getElementById('quotation-export-card');
    if (element && typeof html2pdf !== 'undefined') {
        html2pdf().from(element).save(`${activeQuoteData ? activeQuoteData.id : 'عرض_سعر'}.pdf`);
    } else {
        printQuotationDocument(activeQuoteData);
    }
}

// --- إدارة الخزينة والربط المالي الشامل ---
function openFinanceTransactionForm() {
    editTransactionIndex = null;
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-desc').value = '';
    document.getElementById('trans-type').value = 'in';
    document.getElementById('trans-category').value = 'مبيعات وعملاء';
    document.getElementById('trans-method').value = 'نقداً (كاش)';
    
    populateFinanceDropdowns();
    switchTab('finance-form');
}

// 1. تعبئة قائمة جميع المشاريع في نموذج الحركة المالية (تعرض كل المشاريع المسجلة)
function populateFinanceDropdowns() {
    const projSelect = document.getElementById('trans-project');
    if (projSelect) {
        projSelect.innerHTML = '<option value="">-- اختر المشروع --</option>';
        projectsList.forEach(p => {
            projSelect.innerHTML += `<option value="${p.name}">${p.name} (${p.code})</option>`;
        });
    }

    const orderSelect = document.getElementById('trans-order');
    if (orderSelect) {
        orderSelect.innerHTML = '<option value="">-- اختر أمر الشغل --</option>';
    }
}
// 2. تحديث قائمة أوامر الشغل الخاصة بالمشروع المختار وحساب المجموع تلقائياً
function updateFinanceProjectsDropdown() {
    const projName = document.getElementById('trans-project').value;
    const orderSelect = document.getElementById('trans-order');

    if (!orderSelect) return;
    
    // ربط حدث التغيير لقائمة أوامر الشغل لتحديث الخانة تلقائياً
    orderSelect.onchange = updateFinanceAccountDisplay;
    orderSelect.innerHTML = '<option value="">-- اختر أمر الشغل --</option>';

    const filteredOrders = fullOrdersList.filter(o => o.project === projName);
    filteredOrders.forEach(o => {
        // فحص شامل لكل احتمالات أسماء الإجمالي لضمان عدم ظهور undefined
        let orderTotal = parseFloat(o.totalAmount || o.totalPrice || o.total || 0);
        
        // لو الإجمالي ما زال صفراً، نبحث داخلياً لو فيه تفاصيل منتجات ونحسبها
        if (orderTotal === 0 && o.productsData && Array.isArray(o.productsData)) {
            o.productsData.forEach(item => {
                let pObj = productsList.find(p => p.name === item.name);
                if (pObj) {
                    orderTotal += (pObj.price || 0) * (item.qty || 1);
                }
            });
        }

        orderSelect.innerHTML += `<option value="${o.code}">${o.code} - الإجمالي: ${orderTotal.toLocaleString()} ج.م</option>`;
    });

    // استدعاء دالة تحديث خانة الحساب فوراً عند تغيير المشروع
    updateFinanceAccountDisplay();
}


// دالة مسؤولة عن قراءة القيمة المحددة وضعها في خانة حساب المشروع كامل
function updateFinanceAccountDisplay() {
    const projSelect = document.getElementById('trans-project');
    const orderSelect = document.getElementById('trans-order');
    
    // البحث المباشر عن كل الحقول والباكسات الزرقاء في صفحة الحركة المالية
    const allDisplayBoxes = document.querySelectorAll('#tab-finance-form input, #tab-finance-form span, #tab-finance-form div, #page-finance-form input, #page-finance-form span, #page-finance-form div');
    
    let targetElement = null;
    allDisplayBoxes.forEach(el => {
        // بنبحث عن العنصر اللي جواه "ج.م" أو "0.00" عشان نمسكه بالظبط
        if (el.textContent.includes('ج.م') || el.textContent.includes('0.00') || (el.value && el.value.includes('ج.م'))) {
            targetElement = el;
        }
    });

    if (!targetElement) return;

    let calculatedTotal = 0;

    // 1. حساب إجمالي أمر الشغل لو مختار أمر
    if (orderSelect && orderSelect.value) {
        const selectedOrder = fullOrdersList.find(o => o.code === orderSelect.value);
        if (selectedOrder) {
            calculatedTotal = parseFloat(selectedOrder.totalAmount || selectedOrder.totalPrice || selectedOrder.total || 0);
        }
    } 
    // 2. أو حساب إجمالي المشروع كله لو مختار مشروع فقط
    else if (projSelect && projSelect.value) {
        const projOrders = fullOrdersList.filter(o => o.project === projSelect.value);
        projOrders.forEach(o => {
            calculatedTotal += parseFloat(o.totalAmount || o.totalPrice || o.total || 0);
        });
    }

    const formattedText = calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

    // تحديث العنصر فوراً
    if (targetElement.tagName === 'INPUT') {
        targetElement.value = formattedText;
    } else {
        targetElement.textContent = formattedText;
    }
}
function editTransaction(index) {
    if (!hasPerm('editFinance')) { alert('ليس لديك صلاحية لتعديل الحركات المالية!'); return; }
    const t = financeTransactions[index];
    if (!t) return;

    editTransactionIndex = index;
    populateFinanceDropdowns();

    document.getElementById('trans-type').value = t.type || 'in';
    document.getElementById('trans-category').value = t.category || 'مبيعات وعملاء';
    document.getElementById('trans-amount').value = t.amount || 0;
    document.getElementById('trans-method').value = t.method || 'نقداً (كاش)';
    document.getElementById('trans-desc').value = t.desc || '';

    if (t.project && document.getElementById('trans-project')) {
        document.getElementById('trans-project').value = t.project;
        updateFinanceProjectsDropdown();
        if (t.orderCode && document.getElementById('trans-order')) {
            document.getElementById('trans-order').value = t.orderCode;
        }
    }

    switchTab('finance-form');
}

function saveTransaction(e) {
    if (e) e.preventDefault();

    const type = document.getElementById('trans-type').value;
    const category = document.getElementById('trans-category')?.value || 'عام';
    const amount = parseFloat(document.getElementById('trans-amount').value) || 0;
    const method = document.getElementById('trans-method')?.value || 'نقداً (كاش)';
    const desc = document.getElementById('trans-desc').value.trim();

    const project = document.getElementById('trans-project')?.value || '';
    const orderCode = document.getElementById('trans-order')?.value || '';
    
    let clientName = '';
    if (project) {
        const foundProj = projectsList.find(p => p.name === project);
        if (foundProj) clientName = foundProj.client;
    }

    if (amount <= 0 || !desc) {
        alert('برجاء كتابة المبلغ والبيان بشكل صحيح');
        return;
    }

    const transObj = {
        date: editTransactionIndex !== null ? financeTransactions[editTransactionIndex].date : new Date().toISOString().split('T')[0],
        type: type,
        category: category,
        desc: desc,
        amount: amount,
        method: method,
        user: editTransactionIndex !== null ? financeTransactions[editTransactionIndex].user : getCurrentUserName(),
        client: clientName,
        project: project,
        orderCode: orderCode
    };

    if (editTransactionIndex !== null) {
        financeTransactions[editTransactionIndex] = transObj;
        editTransactionIndex = null;
    } else {
        financeTransactions.unshift(transObj);
    }

    if (orderCode && type === 'in') {
        const linkedOrder = fullOrdersList.find(o => o.code === orderCode);
        if (linkedOrder) {
            linkedOrder.paidAmount = (parseFloat(linkedOrder.paidAmount) || 0) + amount;
            saveData('fullOrdersList', fullOrdersList);
        }
    }

    saveData('financeTransactions', financeTransactions);
    renderAllTables();
    switchTab('finance');
}

function deleteTransaction(index) {
    if (!hasPerm('deleteFinance')) { alert('ليس لديك صلاحية لحذف الحركات المالية!'); return; }
    const t = financeTransactions[index];
    if (!t) return;

    const reason = prompt(`سبب حذف الحركة المالية (${t.desc})؟`);
    if (!reason) return;

    sendToTrash('حركة مالية', t.orderCode || '—', t.client || '—', t.project || '—', reason, getCurrentUserName(), t);
    financeTransactions.splice(index, 1);
    saveData('financeTransactions', financeTransactions);
    renderAllTables();
}

// --- العرض الموحد لجميع الجداول والداتا ---
function renderAllTables() {
const empTbody = document.getElementById('employees-table-body');
    if (empTbody) {
        empTbody.innerHTML = '';
        for (let ph in usersDatabase) {
            const u = usersDatabase[ph];
            if (!u) continue;
            
            const p = u.perms || {};
            let permLabels = [];
            if (p.viewHome) permLabels.push('الرئيسية');
            if (p.viewUsers) permLabels.push('الموظفين');
            if (p.viewClients) permLabels.push('العملاء');
            if (p.viewOrders) permLabels.push('الأوامر');
            if (p.viewFinance) permLabels.push('المالية');

            empTbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-bold text-gray-800 text-right">${u.name || 'بدون اسم'}</td>
                    <td class="p-3 font-mono text-right">${ph}</td>
                    <td class="p-3 text-right"><span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">${u.title || (u.role === 'admin' ? 'مدير نظام' : 'موظف')}</span></td>
                    <td class="p-3 text-gray-500 text-xs text-right">${permLabels.join(' - ') || 'صلاحيات مخصصة'}</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button type="button" onclick="editUser('${ph}')" class="text-blue-600 hover:text-blue-800 px-1 font-bold" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button type="button" onclick="deleteEmployee('${ph}')" class="text-red-600 hover:text-red-800 px-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }
    }    
    renderTrashBinTable();
    if (typeof renderSalesTable === 'function') renderSalesTable();

const clientTbody = document.getElementById('clients-table-body');
    if (clientTbody) {
        clientTbody.innerHTML = '';
        clientsList.forEach((c, idx) => {
            clientTbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-bold text-gray-800">
                        ${c.name}
                        <span class="mr-1 px-1.5 py-0.5 rounded text-[10px] ${c.type === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                            ${c.type === 'B' ? 'عميل B (ورشة)' : 'عميل A (مباشر)'}
                        </span>
                    </td>
                    <td class="p-3 font-mono text-blue-600 font-bold">${c.phone}</td>
                    <td class="p-3 font-mono text-gray-500">${c.email || '—'}</td>
                    <td class="p-3 text-gray-600">${c.address || '—'}</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button onclick="editClient(${idx})" class="text-blue-600 hover:text-blue-800 px-1 font-bold" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteClient(${idx})" class="text-red-600 hover:text-red-800 px-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    const prodTbody = document.getElementById('products-table-body');
    if (prodTbody) {
        prodTbody.innerHTML = '';
        const items = productsList || [];
        
        items.forEach((item, idx) => {
            prodTbody.innerHTML += `
                <tr class="hover:bg-gray-50 text-center border-b">
                    <td class="p-3 font-bold text-gray-800 text-right">${item.name || item.itemName || '—'}</td>
                    <td class="p-3"><span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">${item.category || 'عام'}</span></td>
                    <td class="p-3 font-bold text-amber-600">${item.unit || item.calcType || 'بالقطعة'}</td>
                    <td class="p-3 font-bold text-emerald-600 font-mono">${(parseFloat(item.sellPrice || item.price) || 0).toLocaleString()} ج.م</td>
                    <td class="p-3 font-bold text-red-500 font-mono">${(parseFloat(item.costPrice || item.cost) || 0).toLocaleString()} ج.م</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button onclick="editProduct(${idx})" class="text-blue-600 hover:text-blue-800 px-1 font-bold" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteProduct(${idx})" class="text-red-600 hover:text-red-800 px-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }
    
const invTbody = document.getElementById('inventory-table-body');
    if (invTbody) {
        invTbody.innerHTML = '';
        const items = inventoryList || [];
        
        if (items.length === 0) {
            invTbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">لا توجد خامات مسجلة بالمخزن</td></tr>`;
        } else {
            items.forEach((item, idx) => {
                const qty = parseFloat(item.qty || item.stockQuantity || 0);
                const unitPrice = parseFloat(item.cost || item.costPrice || 0);
                const totalCost = qty * unitPrice;
                const unit = item.unit || 'قطعة';

                invTbody.innerHTML += `
                    <tr class="hover:bg-gray-50 text-center border-b">
                        <td class="p-3 font-bold text-gray-800 text-right">${item.name || '—'}</td>
                        <td class="p-3"><span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">${item.category || 'عام'}</span></td>
                        <td class="p-3 font-bold text-blue-700 font-mono">${qty.toLocaleString()} ${unit}</td>
                        <td class="p-3 font-bold text-red-600 font-mono">${unitPrice.toLocaleString()} ج.م</td>
                        <td class="p-3 font-bold text-emerald-600 font-mono">${totalCost.toLocaleString()} ج.م</td>
                        <td class="p-3 text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button type="button" onclick="depositStock(${idx})" class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold hover:bg-emerald-200 shadow-sm" title="إيداع كمية"><i class="fa-solid fa-plus ml-1"></i>إيداع</button>
                                <button type="button" onclick="withdrawStock(${idx})" class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold hover:bg-amber-200 shadow-sm" title="صرف كمية"><i class="fa-solid fa-minus ml-1"></i>صرف</button>
                                <button type="button" onclick="editInventoryItem(${idx})" class="text-blue-600 hover:text-blue-800 p-1 font-bold" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                                <button type="button" onclick="deleteInventoryItem(${idx})" class="text-red-600 hover:text-red-800 p-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }
    const projTbody = document.getElementById('projects-table-body');
    if (projTbody) {
        projTbody.innerHTML = '';
        projectsList.forEach((prj, idx) => {
            projTbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-mono font-bold text-amber-600">${prj.code}</td>
                    <td class="p-3 font-bold text-gray-800">${prj.client}</td>
                    <td class="p-3 font-bold text-blue-700">${prj.name}</td>
                    <td class="p-3 text-gray-700 font-bold">${prj.engineer}</td>
                    <td class="p-3 font-mono">${prj.ownerPhone}</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button onclick="editProject(${idx})" class="text-blue-600 hover:text-blue-800 px-1 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteProject(${idx})" class="text-red-600 hover:text-red-800 px-1 font-bold"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    const opsTbody = document.getElementById('operations-table-body');
    if (opsTbody) {
        opsTbody.innerHTML = '';
        fullOrdersList.forEach((o, idx) => {
            opsTbody.innerHTML += `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-2 border-l font-mono font-bold text-blue-600">${o.code}</td>
                    <td class="p-2 border-l font-bold text-gray-800">${o.client}</td>
                    <td class="p-2 border-l text-amber-700 font-bold">${o.project}</td>
                    <td class="p-2 border-l text-gray-600 font-bold">${o.engineer || '—'}</td>
                    <td class="p-2 border-l font-mono font-bold text-emerald-600">${o.deliveryDate}</td>
                    <td class="p-2 border-l text-[11px] font-semibold text-gray-700 max-w-xs truncate">${o.products}</td>
                    <td class="p-2 border-l text-center">
                        ${o.image ? `<img src="${o.image}" class="w-10 h-10 object-cover rounded mx-auto border">` : '<span class="text-gray-400 text-[10px]">بدون</span>'}
                    </td>
                    <td class="p-2 text-center space-x-1 space-x-reverse">
                        <button onclick="printWorkshopOrder(${idx})" class="text-gray-700 hover:text-black px-1 font-bold" title="طباعة أمر الشغل (بدون أسعار)"><i class="fa-solid fa-print"></i></button>
                        <button onclick="editOrder(${idx})" class="text-blue-600 px-1 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteOrder(${idx})" class="text-red-600 px-1 font-bold"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    const finTbody = document.getElementById('finance-table-body');
    let totalIn = 0;
    let totalOut = 0;

    if (finTbody) {
        finTbody.innerHTML = '';
        financeTransactions.forEach((t, idx) => {
            if (t.type === 'in') totalIn += t.amount;
            if (t.type === 'out') totalOut += t.amount;

            let detailsText = t.desc;
            if (t.client) detailsText += ` <span class="text-[10px] text-blue-600 font-bold">(${t.client}${t.project ? ' - ' + t.project : ''}${t.orderCode ? ' - ' + t.orderCode : ''})</span>`;

            finTbody.innerHTML += `
                <tr class="hover:bg-gray-50 border-b text-center">
                    <td class="p-3 font-mono">${t.date}</td>
                    <td class="p-3 font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}">
                        ${t.type === 'in' ? 'وارد (+)' : 'منصرف (-)'}
                    </td>
                    <td class="p-3"><span class="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-700">${t.category || 'عام'}</span></td>
                    <td class="p-3 text-right font-semibold text-gray-800">${detailsText}</td>
                    <td class="p-3 font-black font-mono ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}">${t.amount.toLocaleString()} ج.م</td>
                    <td class="p-3 font-bold text-gray-600">${t.method || 'نقداً'}</td>
                    <td class="p-3 text-gray-600">${t.user}</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button onclick="editTransaction(${idx})" class="text-blue-600 hover:text-blue-800 px-1 font-bold" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteTransaction(${idx})" class="text-red-600 hover:text-red-800 px-1 font-bold" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    let totalDues = 0;
    if (typeof clientsList !== 'undefined' && Array.isArray(clientsList)) {
        clientsList.forEach(client => {
            if (typeof calculateClientTotalDues === 'function') {
                totalDues += calculateClientTotalDues(client.name);
            }
        });
    }

    const finInEl = document.getElementById('finance-total-in');
    const finOutEl = document.getElementById('finance-total-out');
    const finNetEl = document.getElementById('finance-net-balance');
    const finDuesEl = document.getElementById('finance-total-dues');
    const statFinEl = document.getElementById('stat-finance-total');
    const homeDuesEl = document.getElementById('stat-home-total-dues');

    if (finInEl) finInEl.textContent = totalIn.toLocaleString() + ' ج.م';
    if (finOutEl) finOutEl.textContent = totalOut.toLocaleString() + ' ج.م';
    if (finNetEl) finNetEl.textContent = (totalIn - totalOut).toLocaleString() + ' ج.م';
    if (finDuesEl) finDuesEl.textContent = totalDues.toLocaleString() + ' ج.م';
    if (statFinEl) statFinEl.textContent = (totalIn - totalOut).toLocaleString() + ' ج.م';
    if (homeDuesEl) homeDuesEl.textContent = totalDues.toLocaleString() + ' ج.م';

    filterProjectsTable();
    filterOrdersTable();

    const opsCount = document.getElementById('stat-operations-count');
    const prjCount = document.getElementById('stat-projects-count');
    const cliCount = document.getElementById('stat-clients-count');

    if (opsCount) opsCount.textContent = fullOrdersList.length + ' أمر';
    if (prjCount) prjCount.textContent = projectsList.length + ' مشروع';
    if (cliCount) cliCount.textContent = clientsList.length + ' عملاء';
}

function populateCategoriesDropdown() {
    const selects = document.querySelectorAll('.product-cat-select');
    selects.forEach(s => {
        s.innerHTML = '';
        categoriesList.forEach(c => {
            s.innerHTML += `<option value="${c}">${c}</option>`;
        });
    });

    const catUi = document.getElementById('categories-list-ui');
    if (catUi) {
        catUi.innerHTML = '';
        categoriesList.forEach((c, idx) => {
            catUi.innerHTML += `
                <li class="flex justify-between items-center bg-gray-50 p-2 rounded border">
                    <span class="font-bold text-gray-800">${c}</span>
                    <button onclick="deleteCategory(${idx})" class="text-red-600 text-xs font-bold"><i class="fa-solid fa-trash"></i></button>
                </li>
            `;
        });
    }
}

function populateOrderDropdowns() {
    const clientSelect = document.getElementById('select-order-client');
    const projClientSelect = document.getElementById('proj-client');

    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">-- اختر العميل --</option>';
        clientsList.forEach(c => {
            clientSelect.innerHTML += `<option value="${c.name}">${c.name} (${c.type === 'B' ? 'عميل B' : 'عميل A'})</option>`;
        });
    }

    if (projClientSelect) {
        projClientSelect.innerHTML = '<option value="">-- اختر العميل --</option>';
        clientsList.forEach(c => {
            projClientSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }
}

function updateProjectsDropdown() {
    const clientName = document.getElementById('select-order-client').value;
    const projSelect = document.getElementById('select-order-project');
    if (!projSelect) return;

    projSelect.innerHTML = '<option value="">-- اختر المشروع --</option>';
    const filteredProjects = projectsList.filter(p => p.client === clientName);
    filteredProjects.forEach(p => {
        projSelect.innerHTML += `<option value="${p.name}">${p.name} (${p.code})</option>`;
    });
}

function applyUserPermissions() {
    const currentPhone = localStorage.getItem('currentUserPhone');
    if (!currentPhone || typeof usersDatabase === 'undefined' || !usersDatabase[currentPhone]) return;

    const user = usersDatabase[currentPhone];

    // لو المستخدم أدمن النظام الرئيسي، تظهر له كل الأقسام بالكامل
    if (user.role === 'admin') {
        const allNavs = ['home', 'users', 'clients', 'client-ledger', 'products', 'inventory', 'projects', 'orders', 'sales', 'finance', 'trash-bin'];
        allNavs.forEach(nav => {
            const el = document.getElementById('nav-' + nav);
            if (el) el.classList.remove('hidden');
        });
        
        const statsContainer = document.querySelector('#tab-home .grid');
        if (statsContainer) statsContainer.classList.remove('hidden');
        return;
    }

    // لو موظف عادي، نقرأ صلاحياته بدقة ونظهر أو نخفي الأقسام بناءً عليها
    const p = user.perms || {};

    // الرئيسية تظهر دائماً للموظف
    toggleNavVisibility('nav-home', true);
    
    // ربط الصلاحيات بأزرار القائمة الجانبية (Sidebar Navs)
    toggleNavVisibility('nav-users', !!p.viewUsers);
    toggleNavVisibility('nav-clients', !!p.viewClients);
    toggleNavVisibility('nav-client-ledger', !!p.viewClientLedger);
    toggleNavVisibility('nav-products', !!p.viewProducts);
    toggleNavVisibility('nav-inventory', !!p.viewProducts); // المخازن مرتبطة بصلاحية المنتجات أو الجرد
    toggleNavVisibility('nav-projects', !!p.viewProjects);
    toggleNavVisibility('nav-orders', !!p.viewOrders);
    toggleNavVisibility('nav-sales', !!p.viewSales);
    toggleNavVisibility('nav-finance', !!p.viewFinance);
    toggleNavVisibility('nav-trash-bin', user.role === 'admin'); // المهملات للأدمن فقط

    applyHomeStatsPermissions();
}

function toggleNavVisibility(navId, isVisible) {
    const el = document.getElementById(navId);
    if (el) {
        if (isVisible) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

function executeWindowPrint(htmlContent) {
    let oldFrame = document.getElementById('print-iframe');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow || iframe.contentDocument.document || iframe.contentDocument;
    frameDoc.document.open();
    frameDoc.document.write(htmlContent);
    frameDoc.document.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 250);
}

document.addEventListener('DOMContentLoaded', function() {
    const loggedUserPhone = localStorage.getItem('currentUserPhone');
    const loginSec = document.getElementById('login-section');
    const dashSec = document.getElementById('dashboard-section');
    usersDatabase = loadData('usersDatabase', {});

    renderAllTables();
    populateOrderDropdowns();
    populateCategoriesDropdown();

    if (loggedUserPhone && usersDatabase[loggedUserPhone]) {
        currentUserPhone = loggedUserPhone;
        currentUserRole = usersDatabase[loggedUserPhone].role || 'engineer';
        if (loginSec) loginSec.classList.add('hidden');
        if (dashSec) dashSec.classList.remove('hidden');
        updateHeaderUserInfo();
        applyUserPermissions();
        switchTab('home');
    } else {
        localStorage.removeItem('currentUserPhone');
        if (loginSec) loginSec.classList.remove('hidden');
        if (dashSec) dashSec.classList.add('hidden');
        // شاشة تسجيل الدخول العادية دائماً؛ إنشاء الحسابات من إدارة الموظفين بعد دخول المدير.
document.addEventListener('DOMContentLoaded', function() {
    const loggedUserPhone = localStorage.getItem('currentUserPhone');
    const loginSec = document.getElementById('login-section');
    const dashSec = document.getElementById('dashboard-section');
    
    usersDatabase = loadData('usersDatabase', {});

    // إضافة الحسابات الأساسية تلقائياً لتظهر على جميع الأجهزة
    const defaultUsers = {
        '01063292810': { name: 'م/ يوسف محمد', role: 'admin', pass: '252503', title: 'مدير النظام' },
        '01125291114': { name: 'م/ خالد السيد', role: 'admin', pass: '123456', title: 'مدير نظام' },
        '01011521619': { name: 'عبد الرحمن صالح', role: 'engineer', pass: '123456', title: 'مهندس تشغيل' }
    };

    let updated = false;
    for (let ph in defaultUsers) {
        if (!usersDatabase[ph]) {
            usersDatabase[ph] = defaultUsers[ph];
            updated = true;
        }
    }
    if (updated) {
        saveData('usersDatabase', usersDatabase);
    }

    renderAllTables();
    populateOrderDropdowns();
    populateCategoriesDropdown();

    if (loggedUserPhone && usersDatabase[loggedUserPhone]) {
        currentUserPhone = loggedUserPhone;
        currentUserRole = usersDatabase[loggedUserPhone].role || 'engineer';
        if (loginSec) loginSec.classList.add('hidden');
        if (dashSec) dashSec.classList.remove('hidden');
        updateHeaderUserInfo();
        applyUserPermissions();
        switchTab('home');
    } else {
        localStorage.removeItem('currentUserPhone');
        if (loginSec) loginSec.classList.remove('hidden');
        if (dashSec) dashSec.classList.add('hidden');
        document.getElementById('login-form')?.classList.remove('hidden');
    }
});
