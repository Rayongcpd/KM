/**
 * main.js — SPA Router, Common Utility, and Admin Trigger
 */

// ====== Common Functions (ย้ายมาจาก survey, dashboard, admin) ======
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon"><i class="fas ${icons[type]}"></i></span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoading(show = true, text = 'กำลังดำเนินการ...') {
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  if (!overlay) return;
  if (loadingText) loadingText.textContent = text;
  if (show) overlay.classList.add('show');
  else overlay.classList.remove('show');
}

async function callAPI(action, params = {}, method = 'GET') {
  const url = APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || url === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    throw new Error('กรุณาตั้งค่า APPS_SCRIPT_URL ใน config.js');
  }

  if (method === 'GET') {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const resp = await fetch(`${url}?${qs}`);
    return resp.json();
  } else {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...params })
    });
    return resp.json();
  }
}

// ====== SPA Router ======
const appRouter = {
  currentView: '',
  
  navigate: function(viewId) {
    if (this.currentView === viewId) return;

    // ตรวจสอบสิทธิ์การเข้าถึงหน้า Dashboard
    if (viewId === 'dashboard') {
      const token = sessionStorage.getItem('adminToken');
      if (!token) {
        showToast('หน้านี้สำหรับ Admin เท่านั้น กรุณาเข้าสู่ระบบ', 'warning');
        if (this.currentView === '') this.navigate('survey');
        return;
      }
    }

    this.currentView = viewId;

    // ซ่อนทุก view
    document.querySelectorAll('.app-view').forEach(v => {
      v.style.display = 'none';
      v.classList.remove('active');
    });

    // แสดง view ที่ระบุ
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.style.display = 'block';
      setTimeout(() => target.classList.add('active'), 50); // fade in effect trigger
    }

    // จัดการเมนู Active State
    document.querySelectorAll('.header-nav a').forEach(a => {
      if (a.id === `nav-${viewId}`) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });

    // ปิดเมนูมือถือ
    document.getElementById('headerNav')?.classList.remove('show');

    // เรียก Init Function ของหน้านั้นๆ (ถ้ามี และยังไม่เคยเรียก หรือเรียกใหม่)
    if (viewId === 'survey' && window.initSurvey) window.initSurvey();
    if (viewId === 'dashboard' && window.initDashboard) window.initDashboard();
    if (viewId === 'admin' && window.initAdmin) window.initAdmin();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  logout: function() {
    sessionStorage.removeItem('adminToken');
    if (window.adminToken !== undefined) window.adminToken = '';
    
    // ซ่อนเมนู Admin และสรุปผล
    document.getElementById('nav-admin-link').style.display = 'none';
    document.getElementById('nav-dashboard').style.display = 'none';
    document.getElementById('btn-thankyou-dashboard').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'none';
    
    this.navigate('survey');
    showToast('ออกจากระบบ Admin เรียบร้อย', 'success');
  }
};

// ====== Global Initialization ======
document.addEventListener('DOMContentLoaded', () => {
  // ตั้งค่าปีที่ Footer
  document.getElementById('footerYear').textContent = new Date().getFullYear() + 543;

  // เมนูแฮมเบอร์เกอร์
  const menuToggleBtn = document.getElementById('menuToggle');
  const headerNav = document.getElementById('headerNav');

  menuToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    headerNav?.classList.toggle('show');
  });

  // ปิดเมนูเมื่อคลิกลิงก์
  headerNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      headerNav.classList.remove('show');
    });
  });

  // ปิดเมนูเมื่อคลิกข้างนอก
  document.addEventListener('click', (e) => {
    if (headerNav?.classList.contains('show') && !headerNav.contains(e.target) && e.target !== menuToggleBtn) {
      headerNav.classList.remove('show');
    }
  });

  // ====== 3-Click Admin Trigger ======
  let clickCount = 0;
  let clickTimer = null;
  const trigger = document.getElementById('secretAdminTrigger');
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation(); // กัน event รั่ว
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0; // reset ถ้ากดไม่ครบใน 1 วิ
        }, 1000);
      } else if (clickCount >= 3) {
        clearTimeout(clickTimer);
        clickCount = 0;
        // โชว์ปุ่ม Admin ในเมนูชั่วคราวเพื่อให้กลับมาได้
        document.getElementById('nav-admin-link').style.display = 'inline-flex';
        appRouter.navigate('admin');
        showToast('🔓 ปลดล็อกหน้าต่างเข้าสู่ระบบ Admin', 'info');
      }
    });
  }

  // Check init admin status
  const token = sessionStorage.getItem('adminToken');
  if (token) {
    document.getElementById('nav-admin-link').style.display = 'inline-flex';
    document.getElementById('nav-dashboard').style.display = 'inline-flex';
    document.getElementById('btn-thankyou-dashboard').style.display = 'inline-flex';
  }

  // เริ่มต้นที่หน้า Survey
  appRouter.navigate('survey');
});
