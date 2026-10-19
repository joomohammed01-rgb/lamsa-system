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
    const loginSec = document.getElementById('login-section');
    const dashSec = document.getElementById('dashboard-section');
    if (loginSec) loginSec.classList.remove('hidden');
    if (dashSec) dashSec.classList.add('hidden');
    const phoneInput = document.getElementById('username');
    const passInput = document.getElementById('password');
    if (phoneInput) phoneInput.value = '';
    if (passInput) passInput.value = '';
}

function getCurrentUserName() {
    const currentPhone = localStorage.getItem('currentUserPhone');
    if (currentPhone && typeof usersDatabase !== 'undefined' && usersDatabase[currentPhone]) {
        return usersDatabase[currentPhone].name;
    }
    return 'مدير النظام';
}

function handleLogin(event) {
    if (event) event.preventDefault();
    
    usersDatabase = loadData('usersDatabase', usersDatabase);

    const phoneInput = document.getElementById('username');
    const passInput = document.getElementById('password');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    // التحقق المباشر من حساب المدير الأساسي المخفي
    if (phone === '01063292810' && pass === '252503') {
        currentUserPhone = phone;
        currentUserRole = 'admin';
        localStorage.setItem('currentUserPhone', phone);
        
        if (!usersDatabase[phone]) {
            usersDatabase[phone] = { name: 'م/ يوسف محمد', role: 'admin', pass: '252503', title: 'مدير النظام' };
            saveData('usersDatabase', usersDatabase);
        }

        document.getElementById('login-section')?.classList.add('hidden');
        document.getElementById('dashboard-section')?.classList.remove('hidden');
        
        renderAllTables();
        populateOrderDropdowns();
        populateCategoriesDropdown();
        applyUserPermissions();
        switchTab('home');
        return;
    }

    if (!usersDatabase[phone]) {
        alert('خطأ: رقم الهاتف غير مسجل بالنظام!');
        return;
    }

    const user = usersDatabase[phone];
    if (user.pass !== pass) {
        alert('خطأ: كلمة المرور غير صحيحة!');
        return;
    }

    currentUserPhone = phone;
    currentUserRole = user.role || 'engineer';
    localStorage.setItem('currentUserPhone', phone);

    const nameEl = document.getElementById('display-username');
    const roleEl = document.getElementById('display-role');
    if (nameEl) nameEl.textContent = user.name || 'موظف';
    if (roleEl) roleEl.textContent = user.title || (user.role === 'admin' ? 'مدير النظام' : 'موظف');

    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('dashboard-section')?.classList.remove('hidden');

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
    const allPages = document.querySelectorAll('.tab-page');
    allPages.forEach(p => p.classList.add('hidden'));

    let target = document.getElementById('tab-' + pageId) || 
                 document.getElementById('page-' + pageId) || 
                 document.getElementById(pageId);

    if (target) {
        target.classList.remove('hidden');
    }

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
    const confirmed = confirm(`هل أنت متأكد من حذف ${trashBinList.length} عنصر نهائياً من المهملات؟`);
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
        viewHome: true,
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
    
    renderAllTables();
    switchTab('users');
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
        alert('يلزم إدخال سبب الحذف!');
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

// --- إدارة العملاء ---
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

function calculateClientTotalDues(clientName) {
    let totalDues = 0;
    const clientOrders = fullOrdersList.filter(o => o.client === clientName);

    clientOrders.forEach(order => {
        let orderCost = parseFloat(order.totalPrice || order.totalAmount) || 0;
        let orderPaid = parseFloat(order.paidAmount) || 0;
        totalDues += (orderCost - orderPaid);
    });

    return Math.max(0, totalDues);
}

// --- حسابات المنتجات والأربعة طرق ---
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
    } else if (prodObj.priceType === 'minute') {
        resultInput.value = `${qty} دقيقة`;
    } else if (prodObj.priceType === 'acrylic_facade') {
        const totalUnits = (width / 50) * (height / 100) * qty;
        resultInput.value = `${totalUnits.toFixed(2)} متر حسابي (حروف)`;
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
        category: document.getElementById('product-category
