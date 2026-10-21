/* LAMSA cloud/auth bridge. Loaded AFTER script.js so it safely replaces legacy local-only auth. */
(() => {
  const supa = () => window.lamsaSupabase;
  const FUNCTION_URL = 'https://lhyfzbdzppcbwipqdzkv.supabase.co/functions/v1/lamsa-admin';
  const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
  let cloudReady = false;
  let applyingRemote = false;
  let realtimeChannel = null;
  const KEY_TO_VAR = {
    projectAutoCounter: 'projectAutoCounter', orderAutoCounter: 'orderAutoCounter', quoteAutoCounter: 'quoteAutoCounter',
    clientsList: 'clientsList', categoriesList: 'categoriesList', productsList: 'productsList', inventoryList: 'inventoryList',
    projectsList: 'projectsList', fullOrdersList: 'fullOrdersList', quotationsList: 'quotationsList',
    financeTransactions: 'financeTransactions', trashBinList: 'trashBinList', payrollList: 'payrollList'
  };
  const phoneEmail = phone => `${String(phone || '').replace(/\D/g, '')}@login.lamsa.example.com`;
  const normalizedPhone = phone => String(phone || '').trim();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function functionCall(payload) {
    const session = (await supa().auth.getSession()).data.session;
    const headers = { 'Content-Type': 'application/json', 'apikey': 'sb_publishable_vpkNzG861kogYQq2bRpAcw_LfbWt316' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const response = await fetch(FUNCTION_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `فشل الاتصال (${response.status})`);
    return result;
  }

  function applyDataKey(key, value) {
    if (key === 'usersDatabase') return;
    const variable = KEY_TO_VAR[key];
    if (variable) {
      try { window.localStorage.setItem('lamsa_' + key, JSON.stringify(value)); } catch (_) {}
      // Top-level let bindings from script.js are accessible to this classic script.
      switch (variable) {
        case 'projectAutoCounter': projectAutoCounter = value; break;
        case 'orderAutoCounter': orderAutoCounter = value; break;
        case 'quoteAutoCounter': quoteAutoCounter = value; break;
        case 'clientsList': clientsList = value; break;
        case 'categoriesList': categoriesList = value; break;
        case 'productsList': productsList = value; break;
        case 'inventoryList': inventoryList = value; break;
        case 'projectsList': projectsList = value; break;
        case 'fullOrdersList': fullOrdersList = value; break;
        case 'quotationsList': quotationsList = value; break;
        case 'financeTransactions': financeTransactions = value; break;
        case 'trashBinList': trashBinList = value; break;
        case 'payrollList': payrollList = value; break;
      }
    }
  }

  async function loadProfiles() {
    const { data, error } = await supa().from('lamsa_profiles').select('id,phone,name,role,title,salary,perms,company_id').eq('company_id', COMPANY_ID);
    if (error) throw error;
    const directory = {};
    (data || []).forEach(p => { directory[p.phone] = { id: p.id, name: p.name, role: p.role, title: p.title, salary: Number(p.salary || 0), perms: p.perms || {} }; });
    usersDatabase = directory;
    try { localStorage.setItem('lamsa_usersDatabase', JSON.stringify(directory)); } catch (_) {}
    return directory;
  }

  async function loadCloudData() {
    const { data, error } = await supa().from('lamsa_data').select('data_key,data_value').eq('company_id', COMPANY_ID);
    if (error) throw error;
    applyingRemote = true;
    const received = new Set();
    (data || []).forEach(row => { applyDataKey(row.data_key, row.data_value); received.add(row.data_key); });
    // The cloud is authoritative. Keep defaults for keys that have never been written.
    const defaults = { projectAutoCounter: 1, orderAutoCounter: 1, quoteAutoCounter: 1, clientsList: [], categoriesList: [], productsList: [], inventoryList: [], projectsList: [], fullOrdersList: [], quotationsList: [], financeTransactions: [], trashBinList: [], payrollList: [] };
    Object.entries(defaults).forEach(([key, value]) => { if (!received.has(key)) applyDataKey(key, value); });
    applyingRemote = false;
    cloudReady = true;
    renderAllTables?.(); populateOrderDropdowns?.(); populateCategoriesDropdown?.();
    subscribeRealtime();
  }

  function subscribeRealtime() {
    if (realtimeChannel) supa().removeChannel(realtimeChannel);
    realtimeChannel = supa().channel('lamsa-data-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lamsa_data', filter: `company_id=eq.${COMPANY_ID}` }, payload => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new;
        if (!row?.data_key) return;
        applyingRemote = true;
        applyDataKey(row.data_key, row.data_value);
        applyingRemote = false;
        renderAllTables?.(); populateOrderDropdowns?.(); populateCategoriesDropdown?.();
      }).subscribe();
  }

  // Preserve local cache for fast loading, then mirror every changed data bucket to the cloud.
  window.saveData = function(key, value) {
    try { localStorage.setItem('lamsa_' + key, JSON.stringify(value)); } catch (e) { console.warn('Local cache unavailable', e); }
    if (key === 'usersDatabase' || !cloudReady || applyingRemote || !supa()) return;
    supa().from('lamsa_data').upsert({ company_id: COMPANY_ID, data_key: key, data_value: value, updated_by: window.lamsaAuthUserId || null }, { onConflict: 'company_id,data_key' })
      .then(({ error }) => { if (error) console.error('LAMSA cloud save failed:', key, error.message); })
      .catch(error => console.error('LAMSA cloud save failed:', key, error));
  };

  function showDashboard(profile) {
    currentUserPhone = profile.phone;
    currentUserRole = profile.role || 'engineer';
    window.lamsaAuthUserId = profile.id;
    localStorage.setItem('currentUserPhone', profile.phone);
    const nameEl = document.getElementById('display-username');
    const roleEl = document.getElementById('display-role');
    if (nameEl) nameEl.textContent = profile.name || 'موظف';
    if (roleEl) roleEl.textContent = profile.title || (profile.role === 'admin' ? 'مدير النظام' : 'موظف');
    document.getElementById('setup-admin-section')?.classList.add('hidden');
    document.getElementById('login-form')?.classList.add('hidden');
    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('dashboard-section')?.classList.remove('hidden');
    applyUserPermissions?.(); switchTab?.('home');
  }

  async function finishLogin(user) {
    const { data: profile, error } = await supa().from('lamsa_profiles').select('id,phone,name,role,title,salary,perms,company_id').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!profile) {
      await supa().auth.signOut();
      throw new Error('الحساب غير مربوط بملف موظف في LAMSA. تواصل مع المدير.');
    }
    await loadProfiles();
    await loadCloudData();
    showDashboard(profile);
  }

  window.handleLogin = async function(event) {
    event?.preventDefault();
    const phone = normalizedPhone(document.getElementById('username')?.value);
    const password = document.getElementById('password')?.value || '';
    if (!phone || !password) return alert('اكتب رقم الهاتف وكلمة المرور.');
    const button = document.querySelector('#login-form button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'جارٍ تسجيل الدخول...'; }
    try {
      const { data, error } = await supa().auth.signInWithPassword({ email: phoneEmail(phone), password });
      if (error) throw error;
      await finishLogin(data.user);
    } catch (error) { alert(error.message || 'تعذر تسجيل الدخول.'); }
    finally { if (button) { button.disabled = false; button.textContent = 'تسجيل الدخول'; } }
  };

  window.createFirstAdmin = async function(event) {
    event?.preventDefault();
    const name = document.getElementById('setup-admin-name')?.value.trim();
    const phone = normalizedPhone(document.getElementById('setup-admin-phone')?.value);
    const password = document.getElementById('setup-admin-pass')?.value || '';
    const confirmPassword = document.getElementById('setup-admin-pass-confirm')?.value || '';
    if (!name || !phone || password.length < 8) return alert('اكتب الاسم والهاتف وكلمة مرور 8 أحرف على الأقل.');
    if (password !== confirmPassword) return alert('كلمتا المرور غير متطابقتين.');
    try {
      await functionCall({ action: 'bootstrap', name, phone, password, role: 'admin', title: 'مدير نظام', salary: 0, perms: {} });
      const { data, error } = await supa().auth.signInWithPassword({ email: phoneEmail(phone), password });
      if (error) throw error;
      await finishLogin(data.user);
      alert('تم إنشاء حساب المدير وربط LAMSA بالسحابة بنجاح.');
    } catch (error) { alert(error.message || 'تعذر إنشاء حساب المدير.'); }
  };

  window.handleLogout = async function() {
    cloudReady = false;
    if (realtimeChannel) { await supa().removeChannel(realtimeChannel); realtimeChannel = null; }
    await supa().auth.signOut();
    localStorage.removeItem('currentUserPhone');
    document.getElementById('dashboard-section')?.classList.add('hidden');
    document.getElementById('login-section')?.classList.remove('hidden');
    document.getElementById('login-form')?.classList.remove('hidden');
    document.getElementById('setup-admin-section')?.classList.add('hidden');
    if (document.getElementById('username')) document.getElementById('username').value = '';
    if (document.getElementById('password')) document.getElementById('password').value = '';
  };

  window.saveEmployee = async function(event) {
    event?.preventDefault();
    const editPhone = document.getElementById('edit-user-ph')?.value || '';
    const name = document.getElementById('new-name')?.value.trim() || '';
    const phone = normalizedPhone(document.getElementById('new-phone')?.value);
    const password = document.getElementById('new-pass')?.value || '';
    const role = document.getElementById('new-role')?.value || 'engineer';
    const salary = Number(document.getElementById('new-salary')?.value || 0);
    if (!name || !phone || (!editPhone && password.length < 6) || (password && password.length < 6)) return alert('اكتب الاسم والهاتف، وكلمة مرور 6 أحرف على الأقل عند إنشاء الحساب أو تغييرها.');
    const perms = {
      viewHome: true,
      viewUsers: !!document.getElementById('perm-view-users')?.checked, editUsers: !!document.getElementById('perm-edit-users')?.checked, deleteUsers: !!document.getElementById('perm-delete-users')?.checked,
      viewClients: !!document.getElementById('perm-view-clients')?.checked, editClient: !!document.getElementById('perm-edit-client')?.checked, deleteClient: !!document.getElementById('perm-delete-client')?.checked,
      viewClientLedger: !!document.getElementById('perm-view-client-ledger')?.checked,
      viewProducts: !!document.getElementById('perm-view-products')?.checked, editProduct: !!document.getElementById('perm-edit-product')?.checked, deleteProduct: !!document.getElementById('perm-delete-product')?.checked,
      viewProjects: !!document.getElementById('perm-view-projects')?.checked, editProject: !!document.getElementById('perm-edit-project')?.checked, deleteProject: !!document.getElementById('perm-delete-project')?.checked,
      viewOrders: !!document.getElementById('perm-view-orders')?.checked, editOrder: !!document.getElementById('perm-edit-order')?.checked, deleteOrder: !!document.getElementById('perm-delete-order')?.checked,
      viewSales: !!document.getElementById('perm-view-sales')?.checked, viewFinance: !!document.getElementById('perm-view-finance')?.checked,
      editFinance: !!document.getElementById('perm-edit-finance')?.checked, deleteFinance: !!document.getElementById('perm-delete-finance')?.checked
    };
    const title = role === 'accountant' ? 'محاسب ماليات' : role === 'admin' ? 'مدير نظام' : 'مهندس تشغيل';
    try {
      const existing = editPhone ? usersDatabase[editPhone] : null;
      await functionCall({ action: editPhone ? 'update' : 'create', userId: existing?.id, name, phone, password, role, title, salary, perms });
      if (editPhone && editPhone !== phone) delete usersDatabase[editPhone];
      await loadProfiles();
      renderAllTables?.(); switchTab?.('users');
      document.getElementById('new-pass').value = '';
      alert(editPhone ? 'تم تحديث بيانات الموظف.' : 'تم إنشاء حساب الموظف بنجاح.');
    } catch (error) { alert(error.message || 'تعذر حفظ الموظف.'); }
  };

  window.editUser = function(phone) {
    const user = usersDatabase[phone]; if (!user) return;
    document.getElementById('edit-user-ph').value = phone;
    document.getElementById('new-name').value = user.name || '';
    document.getElementById('new-phone').value = phone;
    document.getElementById('new-pass').value = '';
    document.getElementById('new-pass').required = false;
    document.getElementById('new-pass').placeholder = 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية';
    document.getElementById('new-role').value = user.role || 'engineer';
    if (document.getElementById('new-salary')) document.getElementById('new-salary').value = user.salary || 0;
    const p = user.perms || {};
    const checkboxMap = {
      'perm-view-users':'viewUsers','perm-edit-users':'editUsers','perm-delete-users':'deleteUsers','perm-view-clients':'viewClients','perm-edit-client':'editClient','perm-delete-client':'deleteClient','perm-view-client-ledger':'viewClientLedger',
      'perm-view-products':'viewProducts','perm-edit-product':'editProduct','perm-delete-product':'deleteProduct','perm-view-projects':'viewProjects','perm-edit-project':'editProject','perm-delete-project':'deleteProject','perm-view-orders':'viewOrders','perm-edit-order':'editOrder','perm-delete-order':'deleteOrder','perm-view-sales':'viewSales','perm-view-finance':'viewFinance','perm-edit-finance':'editFinance','perm-delete-finance':'deleteFinance'
    };
    Object.entries(checkboxMap).forEach(([id,key]) => { const el = document.getElementById(id); if (el) el.checked = !!p[key]; });
    document.getElementById('user-page-title').innerHTML = '<i class="fa-solid fa-user-pen text-amber-500 ml-2"></i> تعديل بيانات الموظف';
    switchTab('user-form');
  };

  window.openUserPage = function() {
    document.getElementById('edit-user-ph').value = '';
    ['new-name','new-phone','new-pass','new-salary'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('new-pass').required = true;
    document.getElementById('new-pass').placeholder = '6 أحرف على الأقل';
    document.getElementById('new-role').value = 'engineer';
    document.querySelectorAll('#page-user-form input[type="checkbox"]').forEach(cb => { if (!cb.disabled) cb.checked = false; });
    document.getElementById('user-page-title').innerHTML = '<i class="fa-solid fa-user-plus text-amber-500 ml-2"></i> إضافة موظف جديد';
    switchTab('user-form');
  };

  window.deleteEmployee = async function(phone) {
    if (phone === currentUserPhone) return alert('لا يمكنك حذف حسابك أثناء تسجيل الدخول.');
    const user = usersDatabase[phone]; if (!user?.id) return alert('لم يتم العثور على حساب الموظف في السحابة.');
    const reason = prompt('يرجى كتابة سبب حذف الموظف:');
    if (!reason?.trim()) return;
    try {
      sendToTrash('موظف', phone, user.name, '—', reason.trim(), getCurrentUserName(), { name: user.name, role: user.role, title: user.title });
      await functionCall({ action: 'delete', userId: user.id });
      await loadProfiles(); renderAllTables?.();
      alert('تم حذف حساب الموظف.');
    } catch (error) { alert(error.message || 'تعذر حذف الموظف.'); }
  };

  async function initialize() {
    const login = document.getElementById('login-section');
    const dash = document.getElementById('dashboard-section');
    if (!supa()) { alert('مكتبة Supabase لم يتم تحميلها. تحقق من الاتصال بالإنترنت.'); return; }
    try {
      const status = await functionCall({ action: 'status' });
      if (status.needsBootstrap) {
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('setup-admin-section')?.classList.remove('hidden');
        login?.classList.remove('hidden'); dash?.classList.add('hidden');
        return;
      }
      const { data: { session } } = await supa().auth.getSession();
      if (session?.user) {
        await finishLogin(session.user);
      } else {
        cloudReady = false;
        localStorage.removeItem('currentUserPhone');
        dash?.classList.add('hidden'); login?.classList.remove('hidden');
        document.getElementById('setup-admin-section')?.classList.add('hidden');
        document.getElementById('login-form')?.classList.remove('hidden');
      }
      supa().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          cloudReady = false;
          if (dash) dash.classList.add('hidden');
          if (login) login.classList.remove('hidden');
        }
      });
    } catch (error) {
      console.error('LAMSA initialization failed:', error);
      login?.classList.remove('hidden'); dash?.classList.add('hidden');
      alert('تعذر الاتصال بالسحابة. راجع إعداد Supabase وEdge Function.\n' + (error.message || ''));
    }
  }
  document.addEventListener('DOMContentLoaded', initialize);
})();
