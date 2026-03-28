/**
 * admin.js — Admin Panel Logic
 * Login ตรวจสอบรหัสจาก Google Sheet (ไม่ hardcode)
 */

function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
function openModal(id) { document.getElementById(id)?.classList.add('show'); }

// ====== State ======
let adminToken = sessionStorage.getItem('adminToken') || '';
let yearsData = [];

// ====== Init ======
let adminInitialized = false;
window.initAdmin = async function() {
  if (adminInitialized) return;
  adminInitialized = true;

  // Login
  document.getElementById('btnLogin').addEventListener('click', doLogin);
  document.getElementById('passcodeInput').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

  // Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });

  // Year modal
  document.getElementById('btnAddYear').addEventListener('click', () => {
    document.getElementById('yearModalTitle').textContent = 'เพิ่มปีงบประมาณ';
    document.getElementById('inputYear').value = '';
    document.getElementById('inputInnovation').value = '';
    document.getElementById('inputActive').checked = false;
    document.getElementById('inputYear').removeAttribute('data-edit');
    openModal('yearModal');
  });
  document.getElementById('btnSaveYear').addEventListener('click', saveYear);

  // Question modal
  document.getElementById('btnAddQuestion').addEventListener('click', () => {
    document.getElementById('questionModalTitle').textContent = 'เพิ่มคำถาม';
    document.getElementById('inputQText').value = '';
    document.getElementById('inputQId').value = '';
    document.getElementById('inputQYear').value = document.getElementById('qYearSelect')?.value || '';
    openModal('questionModal');
  });
  document.getElementById('btnSaveQuestion').addEventListener('click', saveQuestion);

  // Settings
  document.getElementById('btnChangePasscode').addEventListener('click', changePasscode);
  document.getElementById('btnLogout').addEventListener('click', () => { appRouter.logout(); });

  // Other buttons
  document.getElementById('btnExportResponses')?.addEventListener('click', exportResponses);
  document.getElementById('btnClearResponses')?.addEventListener('click', clearResponses);

  // Auto-login if token exists
  if (adminToken) {
    showAdminPanel();
  }
};

// ====== Login ======
async function doLogin() {
  const code = document.getElementById('passcodeInput').value.trim();
  if (!code) { showToast('กรุณากรอกรหัสผ่าน', 'warning'); return; }

  showLoading(true);
  try {
    const r = await callAPI('adminLogin', { passcode: code }, 'POST');
    showLoading(false);
    if (r.success) {
      adminToken = r.data.token || code;
      sessionStorage.setItem('adminToken', adminToken);
      document.getElementById('loginError').style.display = 'none';
      showAdminPanel();
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
    } else {
      document.getElementById('loginError').style.display = 'block';
      showToast('รหัสผ่านไม่ถูกต้อง', 'error');
    }
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

async function showAdminPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  document.getElementById('btnLogout').style.display = 'inline-flex';
  await loadYears();
}

// ====== Years ======
async function loadYears() {
  try {
    const r = await callAPI('getConfig');
    if (!r.success) throw new Error(r.error);
    yearsData = r.data.years || [];
    renderYearsList();
    populateYearSelects();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderYearsList() {
  const el = document.getElementById('yearsListContainer');
  if (!yearsData.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>ยังไม่มีปีงบประมาณ</p></div>'; return; }
  let h = '';
  yearsData.forEach(y => {
    h += `<div class="question-item">
      <div class="q-number">${y.year.toString().slice(-2)}</div>
      <div class="q-text"><strong>ปี ${y.year}</strong> — ${y.innovationName} <span class="badge ${y.isActive?'badge-active':'badge-inactive'}">${y.isActive?'Active':'Inactive'}</span></div>
      <div class="q-actions">
        <button title="แก้ไข" onclick="editYear('${y.year}')"><i class="fas fa-edit"></i></button>
        <button title="ลบ" onclick="deleteYear('${y.year}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  });
  el.innerHTML = h;
}

function populateYearSelects() {
  ['qYearSelect','rYearSelect'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    yearsData.forEach(y => {
      const o = document.createElement('option');
      o.value = y.year; o.textContent = `ปี ${y.year}`;
      if (y.isActive) o.selected = true;
      sel.appendChild(o);
    });
  });
  document.getElementById('qYearSelect')?.addEventListener('change', () => loadQuestions());
  document.getElementById('rYearSelect')?.addEventListener('change', () => loadResponseStats());
  if (document.getElementById('qYearSelect')?.value) loadQuestions();
  if (document.getElementById('rYearSelect')?.value) loadResponseStats();
}

function editYear(year) {
  const y = yearsData.find(v => v.year == year);
  if (!y) return;
  document.getElementById('yearModalTitle').textContent = 'แก้ไขปีงบประมาณ';
  document.getElementById('inputYear').value = y.year;
  document.getElementById('inputYear').setAttribute('data-edit', y.year);
  document.getElementById('inputInnovation').value = y.innovationName;
  document.getElementById('inputActive').checked = y.isActive;
  openModal('yearModal');
}

async function saveYear() {
  const year = document.getElementById('inputYear').value;
  const name = document.getElementById('inputInnovation').value.trim();
  const active = document.getElementById('inputActive').checked;
  const editYear = document.getElementById('inputYear').getAttribute('data-edit');
  if (!year || !name) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return; }

  showLoading(true);
  try {
    const r = await callAPI('saveConfig', { year, innovationName: name, isActive: active, editYear: editYear || '', token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) { closeModal('yearModal'); await loadYears(); showToast('บันทึกสำเร็จ', 'success'); }
    else showToast(r.error || 'เกิดข้อผิดพลาด', 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

async function deleteYear(year) {
  if (!confirm(`ต้องการลบปี ${year} หรือไม่?`)) return;
  showLoading(true);
  try {
    const r = await callAPI('deleteConfig', { year, token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) { await loadYears(); showToast('ลบสำเร็จ', 'success'); }
    else showToast(r.error, 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

// ====== Questions ======
let questionsData = [];

async function loadQuestions() {
  const year = document.getElementById('qYearSelect')?.value;
  if (!year) return;
  try {
    const r = await callAPI('getQuestions', { year });
    if (!r.success) throw new Error(r.error);
    questionsData = r.data || [];
    renderQuestions();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderQuestions() {
  const section = document.getElementById('qSectionSelect')?.value || 'all';
  const filtered = section === 'all' ? questionsData : questionsData.filter(q => q.section === section);
  const el = document.getElementById('questionsListContainer');
  if (!filtered.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-list"></i><p>ไม่มีคำถาม</p></div>'; return; }

  let h = '';
  filtered.forEach((q, i) => {
    h += `<div class="question-item">
      <div class="q-number">${i+1}</div>
      <div class="q-text">${q.text}</div>
      <div class="q-type">${q.section} / ${q.type}</div>
      <div class="q-actions">
        <button title="แก้ไข" onclick="editQuestion('${q.id}')"><i class="fas fa-edit"></i></button>
        <button title="ลบ" onclick="deleteQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  });
  el.innerHTML = h;
}

document.getElementById('qSectionSelect')?.addEventListener('change', renderQuestions);

function editQuestion(id) {
  const q = questionsData.find(v => v.id === id);
  if (!q) return;
  document.getElementById('questionModalTitle').textContent = 'แก้ไขคำถาม';
  document.getElementById('inputQId').value = q.id;
  document.getElementById('inputQYear').value = document.getElementById('qYearSelect')?.value || '';
  document.getElementById('inputQSection').value = q.section;
  document.getElementById('inputQText').value = q.text;
  document.getElementById('inputQType').value = q.type;
  openModal('questionModal');
}

async function saveQuestion() {
  const year = document.getElementById('inputQYear').value || document.getElementById('qYearSelect')?.value;
  const section = document.getElementById('inputQSection').value;
  const text = document.getElementById('inputQText').value.trim();
  const type = document.getElementById('inputQType').value;
  const editId = document.getElementById('inputQId').value;
  if (!text) { showToast('กรุณากรอกคำถาม', 'warning'); return; }

  showLoading(true);
  try {
    const r = await callAPI('saveQuestion', { year, section, text, type, editId, token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) { closeModal('questionModal'); await loadQuestions(); showToast('บันทึกสำเร็จ', 'success'); }
    else showToast(r.error, 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

async function deleteQuestion(id) {
  if (!confirm('ต้องการลบคำถามนี้?')) return;
  const year = document.getElementById('qYearSelect')?.value;
  showLoading(true);
  try {
    const r = await callAPI('deleteQuestion', { year, questionId: id, token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) { await loadQuestions(); showToast('ลบสำเร็จ', 'success'); }
    else showToast(r.error, 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

// ====== Responses ======
async function loadResponseStats() {
  const year = document.getElementById('rYearSelect')?.value;
  if (!year) return;
  try {
    const r = await callAPI('getResponseStats', { year, token: adminToken });
    if (r.success) {
      document.getElementById('rTotalCount').textContent = r.data.total || 0;
      document.getElementById('rTodayCount').textContent = r.data.today || 0;
    }
  } catch (e) { /* silent */ }
}

async function exportResponses() {
  const year = document.getElementById('rYearSelect')?.value;
  if (!year) return;
  showLoading(true);
  try {
    const r = await callAPI('getResponses', { year, token: adminToken });
    showLoading(false);
    if (!r.success) { showToast(r.error, 'error'); return; }
    if (!r.data?.length) { showToast('ไม่มีข้อมูล', 'warning'); return; }
    const headers = Object.keys(r.data[0]);
    let csv = '\uFEFF' + headers.join(',') + '\n';
    r.data.forEach(row => { csv += headers.map(h => `"${(row[h]||'').toString().replace(/"/g,'""')}"`).join(',') + '\n'; });
    const b = new Blob([csv], {type:'text/csv;charset=utf-8;'}), l = document.createElement('a');
    l.href = URL.createObjectURL(b); l.download = `responses_${year}.csv`; l.click();
    showToast('Export สำเร็จ', 'success');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

async function clearResponses() {
  const year = document.getElementById('rYearSelect')?.value;
  if (!year) return;
  if (!confirm(`⚠️ ต้องการล้างข้อมูลตอบกลับปี ${year} ทั้งหมด?\nข้อมูลจะไม่สามารถกู้คืนได้!`)) return;
  showLoading(true);
  try {
    const r = await callAPI('clearResponses', { year, token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) { loadResponseStats(); showToast('ล้างข้อมูลสำเร็จ', 'success'); }
    else showToast(r.error, 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

// ====== Settings ======
async function changePasscode() {
  const cur = document.getElementById('currentPasscode').value;
  const np = document.getElementById('newPasscode').value;
  const cp = document.getElementById('confirmPasscode').value;
  if (!cur || !np) { showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }
  if (np !== cp) { showToast('รหัสผ่านใหม่ไม่ตรงกัน', 'error'); return; }
  if (np.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'warning'); return; }

  showLoading(true);
  try {
    const r = await callAPI('changePasscode', { currentPasscode: cur, newPasscode: np, token: adminToken }, 'POST');
    showLoading(false);
    if (r.success) {
      adminToken = np; sessionStorage.setItem('adminToken', adminToken);
      document.getElementById('currentPasscode').value = '';
      document.getElementById('newPasscode').value = '';
      document.getElementById('confirmPasscode').value = '';
      showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
    } else showToast(r.error, 'error');
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}
