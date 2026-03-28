/**
 * dashboard.js — สรุปผลแบบสอบถาม
 */

const chartInstances = {};
function destroyChart(id) { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } }

let currentSummary = null;
let dashboardInitialized = false;
window.initDashboard = async function() {
  if (dashboardInitialized) {
    // รีเฟรชข้อมูลเมื่อเข้ามาหน้า dashboard ใหม่
    const sel = document.getElementById('yearSelect');
    if (sel && sel.value) loadDashboard(sel.value);
    return;
  }
  dashboardInitialized = true;
  try {
    showLoading(true);
    const cfg = await callAPI('getConfig');
    if (!cfg.success) throw new Error(cfg.error);
    const years = cfg.data.years || [];
    const sel = document.getElementById('yearSelect');
    sel.innerHTML = '';
    years.forEach(y => {
      const o = document.createElement('option');
      o.value = y.id; o.textContent = `ปี ${y.year} — ${y.innovationName}`;
      if (y.isActive) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => loadDashboard(sel.value));
    document.getElementById('btnRefresh')?.addEventListener('click', () => loadDashboard(sel.value));
    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
    if (sel.value) await loadDashboard(sel.value);
    else showLoading(false);
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
};

async function loadDashboard(year) {
  showLoading(true);
  try {
    const r = await callAPI('getSummary', { year });
    if (!r.success) throw new Error(r.error);
    currentSummary = r.data;
    renderStats(r.data);
    renderDemoCharts(r.data.demographics);
    renderSectionTables(r.data.sections);
    renderSectionAvgChart(r.data.sections);
    renderOpenEnded(r.data.openEnded);
    showLoading(false);
  } catch (e) { showLoading(false); showToast(e.message, 'error'); }
}

function renderStats(d) {
  document.getElementById('totalResponses').textContent = d.totalResponses.toLocaleString();
  document.getElementById('avgScore').textContent = d.overallAvg.toFixed(2);
  document.getElementById('satisfactionPct').textContent = ((d.overallAvg / 5) * 100).toFixed(1) + '%';
  const nameEl = document.getElementById('dashInnovationName') || document.getElementById('innovationName');
  if (nameEl) nameEl.textContent = d.innovationName || '-';
}

function renderDemoCharts(demo) {
  if (!demo) return;
  [
    { id: 'chartGender', data: demo.gender, label: 'เพศ' },
    { id: 'chartAge', data: demo.age, label: 'ช่วงอายุ' },
    { id: 'chartEducation', data: demo.education, label: 'วุฒิการศึกษา' },
    { id: 'chartExperience', data: demo.experience, label: 'อายุราชการ' }
  ].forEach(cfg => {
    destroyChart(cfg.id);
    const ctx = document.getElementById(cfg.id)?.getContext('2d');
    if (!ctx || !cfg.data) return;
    const labels = Object.keys(cfg.data), values = Object.values(cfg.data);
    const total = values.reduce((a,b) => a+b, 0);
    chartInstances[cfg.id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.map((l,i) => `${l} (${total>0?((values[i]/total)*100).toFixed(1):'0'}%)`),
        datasets: [{ data: values, backgroundColor: APP_CONFIG.COLORS.chartPalette.slice(0,labels.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Sarabun', size: 12 } } }, title: { display: true, text: cfg.label, font: { family: 'Sarabun', size: 16, weight: 'bold' }, color: '#1a2d4d' } } }
    });
  });
}

function renderSectionTables(sections) {
  if (!sections) return;
  ['2.1','2.2','2.3','2.4'].forEach((k, idx) => {
    const ids = ['table21Container','table22Container','table23Container','table24Container'];
    const sec = sections[k], el = document.getElementById(ids[idx]);
    if (!el || !sec?.questions?.length) { if(el) el.innerHTML='<div class="empty-state"><p>ยังไม่มีข้อมูล</p></div>'; return; }
    let h = '<table class="summary-table"><thead><tr><th>ข้อคำถาม</th><th>5 มากที่สุด</th><th>4 มาก</th><th>3 ปานกลาง</th><th>2 น้อย</th><th>1 น้อยที่สุด</th><th>ค่าเฉลี่ย</th></tr></thead><tbody>';
    sec.questions.forEach((q,i) => {
      const tot = q.counts.reduce((a,b)=>a+b,0);
      const p = q.counts.map(c => tot>0?((c/tot)*100).toFixed(1):'0.0');
      const a = q.avg||0, cls = a>=4.5?'avg-excellent':a>=3.5?'avg-good':a>=2.5?'avg-fair':'avg-poor';
      h += `<tr><td>${i+1}. ${q.text}</td>${p.map(v=>`<td>${v}%</td>`).join('')}<td><span class="avg-badge ${cls}">${a.toFixed(2)}</span></td></tr>`;
    });
    const sa = sec.avg||0, sc = sa>=4.5?'avg-excellent':sa>=3.5?'avg-good':sa>=2.5?'avg-fair':'avg-poor';
    h += `<tr style="font-weight:700;background:var(--navy-50);"><td>ค่าเฉลี่ยรวม</td><td colspan="5"></td><td><span class="avg-badge ${sc}">${sa.toFixed(2)}</span></td></tr></tbody></table>`;
    el.innerHTML = h;
  });
}

function renderSectionAvgChart(sections) {
  if (!sections) return;
  destroyChart('chartSectionAvg');
  const names = {'2.1':'ด้านการรับรู้','2.2':'ด้านการใช้ประโยชน์','2.3':'ด้านรูปแบบ','2.4':'ด้านผลสัมฤทธิ์'};
  const labels=[], vals=[], colors=['#3b82f6','#8b5cf6','#10b981','#f59e0b'], bg=[];
  Object.keys(names).forEach((k,i) => { if(sections[k]){ labels.push(names[k]); vals.push(sections[k].avg||0); bg.push(colors[i]); }});
  const ctx = document.getElementById('chartSectionAvg')?.getContext('2d');
  if (!ctx) return;
  chartInstances['chartSectionAvg'] = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'ค่าเฉลี่ย', data:vals, backgroundColor:bg.map(c=>c+'cc'), borderColor:bg, borderWidth:2, borderRadius:8, barPercentage:0.6 }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:5, ticks:{stepSize:1} }, x:{grid:{display:false}} }, plugins:{ legend:{display:false} } } });
}

function renderOpenEnded(data) {
  const el = document.getElementById('openEndedContainer');
  if (!data?.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-comments"></i><p>ยังไม่มีข้อเสนอแนะ</p></div>'; return; }
  let h='';
  data.forEach(g => {
    h += `<h3 class="section-title" style="margin-top:16px;">${g.question}</h3><div style="margin-bottom:16px;">`;
    g.responses.forEach(r => { const d=document.createElement('div'); d.textContent=r; h+=`<div style="padding:10px 14px;background:var(--surface-50);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--navy-300);font-size:0.9rem;">${d.innerHTML}</div>`; });
    h+='</div>';
  });
  el.innerHTML=h;
}

function exportCSV() {
  if (!currentSummary?.sections) { showToast('ไม่มีข้อมูล','warning'); return; }
  let csv='\uFEFF'+'ส่วน,ข้อคำถาม,5-มากที่สุด(%),4-มาก(%),3-ปานกลาง(%),2-น้อย(%),1-น้อยที่สุด(%),ค่าเฉลี่ย\n';
  const nm={'2.1':'การรับรู้','2.2':'การใช้ประโยชน์','2.3':'รูปแบบ','2.4':'ผลสัมฤทธิ์'};
  Object.keys(nm).forEach(k => { const s=currentSummary.sections[k]; if(!s?.questions) return; s.questions.forEach(q => {
    const t=q.counts.reduce((a,b)=>a+b,0), p=q.counts.map(c=>t>0?((c/t)*100).toFixed(1):'0.0');
    csv+=`"${nm[k]}","${q.text}",${p.join(',')},${(q.avg||0).toFixed(2)}\n`;
  }); });
  const b=new Blob([csv],{type:'text/csv;charset=utf-8;'}), l=document.createElement('a');
  l.href=URL.createObjectURL(b); l.download=`survey_${document.getElementById('yearSelect')?.value||''}.csv`; l.click();
  showToast('Export สำเร็จ','success');
}
