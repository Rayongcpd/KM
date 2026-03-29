/**
 * survey.js — แบบสอบถามความพึงพอใจ
 * โหลดคำถามจาก Backend แล้ว render form แบบ dynamic
 */

// ====== Utility Functions ======

// ====== State ======
let currentConfig = null;
let currentQuestions = [];
let currentSection = 0;
const totalSections = 6; // info + 2.1 + 2.2 + 2.3 + 2.4 + confirm

// ====== Initialize ======
let surveyInitialized = false;
window.initSurvey = async function() {
  if (surveyInitialized) {
    // โหลดใหม่หรือแสดงหน้าแรก
    showSection(0);
    return;
  }
  surveyInitialized = true;
  document.getElementById('footerYear').textContent = new Date().getFullYear() + 543;

  try {
    // ดึง config (ปีที่ active)
    const configResp = await callAPI('getConfig');
    if (!configResp.success) throw new Error(configResp.error || 'ไม่สามารถโหลด config');

    currentConfig = configResp.data;
    const activeYear = currentConfig.activeYear;
    if (!activeYear) {
      renderNoActiveSurvey();
      return;
    }

    // หาข้อมูลปีที่ตรงกับ ID
    const activeYearInfo = currentConfig.years.find(y => y.id === activeYear);
    const displayYear = activeYearInfo ? activeYearInfo.year : activeYear;

    // อัพเดท header
    document.getElementById('header-title').textContent =
      `แบบสอบถามความพึงพอใจ — ${currentConfig.innovationName || 'นวัตกรรม'}`;
    document.getElementById('header-subtitle').textContent =
      `ปีงบประมาณ ${displayYear}`;

    // ดึงคำถาม
    const qResp = await callAPI('getQuestions', { year: activeYear });
    if (!qResp.success) throw new Error(qResp.error || 'ไม่สามารถโหลดคำถาม');

    currentQuestions = qResp.data;
    renderSurvey();
  } catch (err) {
    console.error('Init error:', err);
    document.getElementById('surveyContainer').innerHTML = `
      <div class="card" style="text-align:center; padding:40px;">
        <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:var(--warning); margin-bottom:16px;"></i>
        <h2 style="margin-bottom:8px;">ไม่สามารถโหลดแบบสอบถามได้</h2>
        <p style="color:var(--surface-500);">${err.message}</p>
        <button class="btn btn-primary" style="margin-top:20px;" onclick="location.reload()">
          <i class="fas fa-redo"></i> ลองใหม่
        </button>
      </div>
    `;
  }
}

/** แสดงข้อความว่ายังไม่เปิดรับคำตอบ */
function renderNoActiveSurvey() {
  document.getElementById('surveyContainer').innerHTML = `
    <div class="card" style="text-align:center; padding:60px 20px;">
      <i class="fas fa-calendar-times" style="font-size:3rem; color:var(--surface-400); margin-bottom:16px;"></i>
      <h2 style="margin-bottom:8px; color:var(--navy-700);">ยังไม่เปิดรับแบบสอบถาม</h2>
      <p style="color:var(--surface-500);">ขณะนี้ยังไม่มีปีงบประมาณที่เปิดรับคำตอบ<br>กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>
  `;
  document.getElementById('progressContainer').style.display = 'none';
}

// ====== Render Survey ======
function renderSurvey() {
  // จัดกลุ่มคำถามตาม section
  const sections = {};
  currentQuestions.forEach(q => {
    if (!sections[q.section]) sections[q.section] = [];
    sections[q.section].push(q);
  });

  const container = document.getElementById('surveyContainer');
  container.innerHTML = '';

  // Section 1: ข้อมูลทั่วไป (คงที่)
  container.innerHTML += renderDemographicSection();

  // Section 2.x: Rating tables (Dynamic)
  const dynamicKeys = Object.keys(sections).filter(k => k !== 'open').sort();
  const icons = ['fa-eye', 'fa-cogs', 'fa-shapes', 'fa-bullseye', 'fa-star', 'fa-check-circle', 'fa-flag'];
  
  const sectionMeta = dynamicKeys.map((key, idx) => {
    let title = key;
    if (!title.includes('ส่วนที่')) {
      // ถ้าไม่มีคำว่าส่วนที่ ให้เติมให้
      title = `ส่วนที่ ${key}`;
    }
    return { 
      key: key, 
      title: title, 
      icon: icons[idx % icons.length], 
      scaleLabel: 'ระดับความพึงพอใจ/คุณภาพ' 
    };
  });

  sectionMeta.forEach(sm => {
    const qs = sections[sm.key] || [];
    if (qs.length === 0) return;

    const ratingQs = qs.filter(q => q.type === 'rating5' || q.type === 'rating5_quality');
    const openQs = qs.filter(q => q.type === 'text');

    let html = `
      <div class="card survey-section" id="section-${sm.key}" style="display:none;">
        <div class="card-header">
          <div class="icon icon-navy"><i class="fas ${sm.icon}"></i></div>
          <div>
            <h2>${sm.title}</h2>
            <p>${sm.scaleLabel}: 5=มากที่สุด, 4=มาก, 3=ปานกลาง, 2=น้อย, 1=น้อยที่สุด</p>
          </div>
        </div>
    `;

    // Rating table
    if (ratingQs.length > 0) {
      html += `
        <table class="rating-table">
          <thead>
            <tr>
              <th>ข้อคำถาม</th>
              <th>5<br>มากที่สุด</th>
              <th>4<br>มาก</th>
              <th>3<br>ปานกลาง</th>
              <th>2<br>น้อย</th>
              <th>1<br>น้อยที่สุด</th>
            </tr>
          </thead>
          <tbody>
      `;
      ratingQs.forEach((q, idx) => {
        html += `<tr>
          <td>${idx + 1}. ${q.text}</td>
          ${[5,4,3,2,1].map(v => `
            <td><input type="radio" name="${q.id}" value="${v}" required></td>
          `).join('')}
        </tr>`;
      });
      html += '</tbody></table>';
    }

    // Open-ended questions
    if (openQs.length > 0) {
      openQs.forEach((q, idx) => {
        html += `
          <div class="form-group" style="margin-top:20px;">
            <label>${ratingQs.length + idx + 1}. ${q.text}</label>
            <textarea class="form-textarea" name="${q.id}" placeholder="กรุณาพิมพ์ความคิดเห็น..."></textarea>
          </div>
        `;
      });
    }

    html += '</div>';
    container.innerHTML += html;
  });

  // Section: Open-ended (standalone)
  const openQs = sections['open'] || [];
  if (openQs.length > 0) {
    let html = `
      <div class="card survey-section" id="section-open" style="display:none;">
        <div class="card-header">
          <div class="icon icon-green"><i class="fas fa-comment-dots"></i></div>
          <div><h2>ข้อเสนอแนะเพิ่มเติม</h2></div>
        </div>
    `;
    openQs.forEach((q, idx) => {
      html += `
        <div class="form-group">
          <label>${idx + 1}. ${q.text}</label>
          <textarea class="form-textarea" name="${q.id}" placeholder="กรุณาพิมพ์ความคิดเห็น..."></textarea>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML += html;
  }

  // Navigation buttons
  container.innerHTML += `
    <div class="btn-group" style="justify-content:space-between;">
      <button class="btn btn-outline" id="btnPrev" style="display:none;" onclick="navigateSection(-1)">
        <i class="fas fa-arrow-left"></i> ย้อนกลับ
      </button>
      <button class="btn btn-primary" id="btnNext" onclick="navigateSection(1)">
        ถัดไป <i class="fas fa-arrow-right"></i>
      </button>
      <button class="btn btn-gold btn-lg" id="btnSubmit" style="display:none;" onclick="submitSurvey()">
        <i class="fas fa-paper-plane"></i> ส่งแบบสอบถาม
      </button>
    </div>
  `;

  // Show first section
  showSection(0);
}

/** Render ส่วนที่ 1: ข้อมูลทั่วไป */
function renderDemographicSection() {
  return `
    <div class="card survey-section" id="section-demographic">
      <div class="card-header">
        <div class="icon icon-gold"><i class="fas fa-user"></i></div>
        <div>
          <h2>ส่วนที่ 1 — ข้อมูลทั่วไป</h2>
          <p>กรุณาเลือกข้อมูลที่ตรงกับความเป็นจริง</p>
        </div>
      </div>

      <!-- 1. เพศ -->
      <div class="form-group">
        <label>1. เพศ <span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="gender" value="ชาย" required><span>ชาย</span></label>
          <label><input type="radio" name="gender" value="หญิง"><span>หญิง</span></label>
        </div>
      </div>

      <!-- 2. อายุ -->
      <div class="form-group">
        <label>2. อายุ <span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="age" value="ต่ำกว่า 31 ปี" required><span>ต่ำกว่า 31 ปี</span></label>
          <label><input type="radio" name="age" value="31-35 ปี"><span>31-35 ปี</span></label>
          <label><input type="radio" name="age" value="36-40 ปี"><span>36-40 ปี</span></label>
          <label><input type="radio" name="age" value="41-45 ปี"><span>41-45 ปี</span></label>
          <label><input type="radio" name="age" value="46-50 ปี"><span>46-50 ปี</span></label>
          <label><input type="radio" name="age" value="51-55 ปี"><span>51-55 ปี</span></label>
          <label><input type="radio" name="age" value="56-60 ปี"><span>56-60 ปี</span></label>
        </div>
      </div>

      <!-- 3. อายุราชการ -->
      <div class="form-group">
        <label>3. อายุราชการ <span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="experience" value="ต่ำกว่า 6 ปี" required><span>ต่ำกว่า 6 ปี</span></label>
          <label><input type="radio" name="experience" value="6-10 ปี"><span>6-10 ปี</span></label>
          <label><input type="radio" name="experience" value="11-15 ปี"><span>11-15 ปี</span></label>
          <label><input type="radio" name="experience" value="16-20 ปี"><span>16-20 ปี</span></label>
          <label><input type="radio" name="experience" value="21-25 ปี"><span>21-25 ปี</span></label>
          <label><input type="radio" name="experience" value="มากกว่า 25 ปีขึ้นไป"><span>มากกว่า 25 ปีขึ้นไป</span></label>
        </div>
      </div>

      <!-- 4. วุฒิการศึกษา -->
      <div class="form-group">
        <label>4. วุฒิการศึกษาขั้นสูงสุด <span class="required">*</span></label>
        <div class="radio-group">
          <label><input type="radio" name="education" value="ต่ำกว่าปริญญาตรี" required><span>ต่ำกว่าปริญญาตรี</span></label>
          <label><input type="radio" name="education" value="ปริญญาตรี"><span>ปริญญาตรี</span></label>
          <label><input type="radio" name="education" value="ปริญญาโท"><span>ปริญญาโท</span></label>
          <label><input type="radio" name="education" value="ปริญญาเอก"><span>ปริญญาเอก</span></label>
        </div>
      </div>

      <!-- 5. หน่วยงาน -->
      <div class="form-group">
        <label>5. หน่วยงาน <span class="required">*</span></label>
        <input type="text" name="department" class="form-input" placeholder="ระบุหน่วยงาน" required>
      </div>

      <!-- 6. ตำแหน่ง / อื่นๆ -->
      <div class="form-group">
        <label>6. ตำแหน่ง</label>
        <input type="text" name="position" class="form-input" placeholder="ระบุตำแหน่ง (ถ้ามี)">
      </div>
    </div>
  `;
}

// ====== Navigation ======

function showSection(index) {
  const allSections = document.querySelectorAll('.survey-section');
  allSections.forEach((s, i) => {
    s.style.display = i === index ? 'block' : 'none';
  });

  currentSection = index;
  const total = allSections.length;

  // Update button visibility
  document.getElementById('btnPrev').style.display = index === 0 ? 'none' : 'inline-flex';
  document.getElementById('btnNext').style.display = index === total - 1 ? 'none' : 'inline-flex';
  document.getElementById('btnSubmit').style.display = index === total - 1 ? 'inline-flex' : 'none';

  // Update progress
  const pct = Math.round(((index) / total) * 100);
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';

  const h2 = allSections[index].querySelector('h2');
  document.getElementById('progressSection').textContent = h2 ? h2.textContent : `ส่วนที่ ${index + 1}`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateSection(dir) {
  const allSections = document.querySelectorAll('.survey-section');
  const nextIndex = currentSection + dir;

  // Validate current section before going forward
  if (dir > 0) {
    const currentSect = allSections[currentSection];
    // Check required radio groups
    const requiredRadios = currentSect.querySelectorAll('input[type="radio"][required]');
    const checkedNames = new Set();
    currentSect.querySelectorAll('input[type="radio"]:checked').forEach(r => checkedNames.add(r.name));

    const requiredNames = new Set();
    requiredRadios.forEach(r => requiredNames.add(r.name));

    for (const name of requiredNames) {
      if (!checkedNames.has(name)) {
        showToast('กรุณาตอบคำถามให้ครบทุกข้อ', 'warning');
        return;
      }
    }

    // Check required text inputs
    const requiredTexts = currentSect.querySelectorAll('input[type="text"][required]');
    for (const inp of requiredTexts) {
      if (!inp.value.trim()) {
        showToast('กรุณากรอกข้อมูลให้ครบ', 'warning');
        inp.focus();
        return;
      }
    }

    // Check rating tables (all radios must be answered)
    const rateTables = currentSect.querySelectorAll('.rating-table');
    for (const table of rateTables) {
      const radioNames = new Set();
      table.querySelectorAll('input[type="radio"]').forEach(r => radioNames.add(r.name));
      for (const name of radioNames) {
        if (!checkedNames.has(name)) {
          showToast('กรุณาให้คะแนนทุกข้อในตาราง', 'warning');
          return;
        }
      }
    }
  }

  if (nextIndex >= 0 && nextIndex < allSections.length) {
    showSection(nextIndex);
  }
}

// ====== Submit ======

async function submitSurvey() {
  showLoading(true, 'กำลังส่งแบบสอบถาม...');

  try {
    // Collect all form data
    const data = {};

    // Demographics
    const demoFields = ['gender', 'age', 'experience', 'education'];
    demoFields.forEach(field => {
      const checked = document.querySelector(`input[name="${field}"]:checked`);
      data[field] = checked ? checked.value : '';
    });
    data.department = document.querySelector('input[name="department"]')?.value || '';
    data.position = document.querySelector('input[name="position"]')?.value || '';

    // Rating & text questions
    currentQuestions.forEach(q => {
      if (q.type === 'text') {
        const ta = document.querySelector(`textarea[name="${q.id}"]`);
        data[q.id] = ta ? ta.value.trim() : '';
      } else {
        const checked = document.querySelector(`input[name="${q.id}"]:checked`);
        data[q.id] = checked ? parseInt(checked.value) : '';
      }
    });

    const result = await callAPI('submit', {
      year: currentConfig.activeYear,
      data: data
    }, 'POST');

    showLoading(false);

    if (result.success) {
      // รีเซ็ตสถานะเพื่อให้การเข้าหน้า Survey ครั้งต่อไปเป็นการเริ่มใหม่ (Clear DOM)
      surveyInitialized = false;
      currentSection = 0;
      appRouter.navigate('thankyou');
    } else {
      showToast(result.error || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}
