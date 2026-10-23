const form = document.getElementById('analyze-form');
const resume = document.getElementById('resume');
const fileInput = document.getElementById('resume-file');
const fileStatus = document.getElementById('file-status');
const errorBox = document.getElementById('error');
const submitBtn = document.getElementById('submit-btn');
let latestReport = null;

fetch('/api/health').then(r => r.json()).then(data => {
  const label = document.getElementById('mode-label');
  if (label) label.textContent = data.ai_enabled ? `Gemini AI · ${data.model}` : 'Demo mode · Gemini not configured';
}).catch(() => {});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    fileStatus.textContent = 'File exceeds 5 MB limit';
    fileInput.value = '';
    showError('Please choose a file smaller than 5 MB.');
    return;
  }
  errorBox.hidden = true;
  fileStatus.textContent = `Reading ${file.name}…`;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const data = new FormData();
    data.append('file', file);
    try {
      const response = await fetch('/api/extract-resume', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not extract text from this PDF.');
      resume.value = result.text;
      fileStatus.textContent = `${file.name} loaded (${result.characters.toLocaleString()} characters)`;
      showError('');
    } catch (err) {
      fileStatus.textContent = 'PDF upload failed';
      showError(err.message || 'Could not upload the PDF.');
    }
    return;
  }
  try {
    resume.value = await file.text();
    fileStatus.textContent = `${file.name} loaded`;
    showError('');
  } catch {
    fileStatus.textContent = 'Could not read file';
    showError('Could not read this file. Save it as UTF-8 and try again.');
  }
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderTags(id, values, isGap=false) {
  const el = document.getElementById(id);
  el.innerHTML = values.length ? values.map(v => `<span class="tag ${isGap?'gap':''}">${escapeHtml(v)}</span>`).join('') : '<span class="muted">No skills identified in this category.</span>';
}
function renderReport(data) {
  latestReport = data;
  document.getElementById('empty-state').hidden = true;
  const summary = document.getElementById('summary-text');
  if (summary) summary.textContent = `${data.ai_used ? 'Gemini AI analysis' : 'Deterministic prototype analysis'}: ${data.summary || 'Review the skill overlap and recommended next steps below.'}`;
  document.getElementById('results').hidden = false;
  document.getElementById('result-title').textContent = `${data.role} report`;
  document.getElementById('score').textContent = data.match_score;
  document.getElementById('score-note').textContent = 'Keyword overlap only; this is not a hiring probability.';
  document.getElementById('meter-fill').style.width = `${data.match_score}%`;
  document.getElementById('matched-count').textContent = data.matched_skills.length;
  document.getElementById('gap-count').textContent = data.skill_gaps.length;
  document.getElementById('required-count').textContent = data.required_skills.length;
  renderTags('matched-skills', data.matched_skills);
  renderTags('gap-skills', data.skill_gaps, true);
  document.getElementById('analysis-note').textContent = data.note;
  document.getElementById('roadmap').innerHTML = data.roadmap.map(item => `<div class="road-item"><div class="road-number">${item.week}</div><div><h3>${escapeHtml(item.title)}</h3><ul>${item.tasks.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul></div></div>`).join('');
  document.getElementById('questions').innerHTML = data.interview_questions.map((q,i)=>`<div class="question"><h3>${i+1}. ${escapeHtml(q.question)}</h3><p><strong>What to cover:</strong> ${q.what_to_cover.map(escapeHtml).join(' · ')}</p></div>`).join('');
  document.getElementById('trace').innerHTML = data.agent_trace.map(t=>`<div class="trace-item"><div class="trace-check">✓</div><div><strong>${escapeHtml(t.name)}</strong><p>${escapeHtml(t.detail)}</p></div></div>`).join('');
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const payload = {
    role: document.getElementById('role').value.trim(),
    resume: resume.value.trim(),
    job_description: document.getElementById('job').value.trim(),
  };
  if (payload.resume.length < 20 || payload.job_description.length < 20) {
    showError('Please enter at least 20 characters for both resume and job description.');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Agent analyzing inputs…</span><span>↻</span>';
  try {
    const response = await fetch('/api/analyze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Analysis failed. Please review your inputs.');
    renderReport(data);
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch (err) {
    showError(err.message || 'Could not connect to the backend. Make sure the server is running.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Analyze my career fit</span><span>→</span>';
  }
});
document.getElementById('download-btn').addEventListener('click', () => {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'careerpilot-report.json'; a.click();
  URL.revokeObjectURL(url);
});
