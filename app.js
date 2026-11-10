/**
 * DailyRoutine Pro - 스케줄러 & 루틴 트래커
 */

// ==========================================
// 1. 상태 변수 및 초기화
// ==========================================
const STORAGE_KEY = 'DAILY_ROUTINE_PRO_DATA_V1';

const state = {
  currentDate: getTodayString(), // 현재 선택된 날짜 (YYYY-MM-DD)
  todayDate: getTodayString(),
  monthlyDate: new Date(),       // 월간 캘린더 기준 월
  activeTab: 'today',           // 'today' | 'plan' | 'stats'
  planSubView: 'weekly',        // 'weekly' | 'monthly'
  todoFilter: 'ALL',            // 'ALL' | '공부' | '운동/건강' | '업무/과제' | '루틴' | '기타'
  statsRange: 7,                // 7 | 14 | 30
  darkMode: false,
  records: {},                  // { [dateStr]: { studyMinutes, workout: {...}, sleep: {...}, note: '' } }
  todos: [],                    // [ { id, date, title, category, estMin, completed, createdAt } ]
  weeklyGoals: [],              // [ { id, weekKey, text, completed } ]
  monthlyGoals: [],             // [ { id, title, category, startDate, endDate, trackType, targetDays, currentDays, memo } ]
  studyTargetHours: 3,          // 일일 목표 공부 시간 (기본 3시간)
  studyWeeklyTargetHours: 21,   // 주간 목표 공부 시간 (기본 21시간)
  sleepTargetHours: 7,          // 기준 수면 시간 (기본 7시간)
  sleepTargetMins: 0,           // 기준 수면 분 (기본 0분)
  workoutTargetMinutes: 40,     // 일일 목표 운동 시간 (기본 40분)
  workoutWeeklyTargetDays: 4,   // 주간 목표 운동 일수 (기본 4일)
  calendarMode: 'study',        // 'study' | 'workout' | 'sleep' | 'all' | 'habit_<id>'
  customHabits: []              // [ { id, title, category, icon, createdAt } ]
};

// ==========================================
// 목표 기준 헬퍼 함수
// ==========================================
function getSleepTargetMinutes() {
  const h = typeof state.sleepTargetHours === 'number' ? state.sleepTargetHours : 7;
  const m = typeof state.sleepTargetMins === 'number' ? state.sleepTargetMins : 0;
  return (h * 60) + m;
}

function getSleepTargetText() {
  const h = typeof state.sleepTargetHours === 'number' ? state.sleepTargetHours : 7;
  const m = typeof state.sleepTargetMins === 'number' ? state.sleepTargetMins : 0;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function getStudyTargetMinutes() {
  const h = typeof state.studyTargetHours === 'number' ? state.studyTargetHours : 3;
  return h * 60;
}

function getWorkoutTargetMinutes() {
  return typeof state.workoutTargetMinutes === 'number' ? state.workoutTargetMinutes : 40;
}

function getWorkoutWeeklyTargetDays() {
  return typeof state.workoutWeeklyTargetDays === 'number' ? state.workoutWeeklyTargetDays : 4;
}

// 스톱워치 상태
let swInterval = null;
let swStartTime = 0;
let swElapsedBefore = 0;
let swIsRunning = false;

// Chart.js 인스턴스
let studyChart = null;
let sleepChart = null;
let categoryChart = null;

// ==========================================
// 2. 유틸리티 함수
// ==========================================
function getTodayString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatMinutes(mins) {
  if (!mins || mins <= 0) return '0시간 0분';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const onejan = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ==========================================
// 3. 로컬 스토리지 입출력
// ==========================================
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.records = parsed.records || {};
      state.todos = parsed.todos || [];
      state.weeklyGoals = parsed.weeklyGoals || [];
      state.monthlyGoals = parsed.monthlyGoals || [];
      state.studyTargetHours = parsed.studyTargetHours ?? 3;
      state.studyWeeklyTargetHours = parsed.studyWeeklyTargetHours ?? 21;
      state.sleepTargetHours = parsed.sleepTargetHours ?? 7;
      state.sleepTargetMins = parsed.sleepTargetMins ?? 0;
      state.workoutTargetMinutes = parsed.workoutTargetMinutes ?? 40;
      state.workoutWeeklyTargetDays = parsed.workoutWeeklyTargetDays ?? 4;
      state.calendarMode = parsed.calendarMode || 'study';
      state.customHabits = parsed.customHabits || [];
    }
  } catch (err) {
    console.error('Failed to load data:', err);
  }

  // 테마 로드
  const isDark = localStorage.getItem('THEME_DARK') === 'true';
  state.darkMode = isDark;
  applyTheme();
}

function saveData() {
  try {
    const payload = {
      records: state.records,
      todos: state.todos,
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      studyTargetHours: state.studyTargetHours || 3,
      studyWeeklyTargetHours: state.studyWeeklyTargetHours || 21,
      sleepTargetHours: state.sleepTargetHours ?? 7,
      sleepTargetMins: state.sleepTargetMins ?? 0,
      workoutTargetMinutes: state.workoutTargetMinutes ?? 40,
      workoutWeeklyTargetDays: state.workoutWeeklyTargetDays ?? 4,
      calendarMode: state.calendarMode || 'study',
      customHabits: state.customHabits || []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

function getRecord(dateStr) {
  if (!state.records[dateStr]) {
    state.records[dateStr] = {
      studyMinutes: 0,
      workout: { done: false, type: '', duration: 0, intensity: '보통', note: '' },
      sleep: { bedtime: '', waketime: '', durationMinutes: 0, quality: 3 },
      note: ''
    };
  }
  return state.records[dateStr];
}

// ==========================================
// 4. 테마 및 네비게이션 제어
// ==========================================
function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('THEME_DARK', state.darkMode);
  applyTheme();
}

function applyTheme() {
  const root = document.documentElement;
  const icon = document.getElementById('theme-icon');
  if (state.darkMode) {
    root.classList.add('dark');
    if (icon) icon.setAttribute('data-lucide', 'sun');
  } else {
    root.classList.remove('dark');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  }
  if (window.lucide) lucide.createIcons();
  
  // 차트가 있으면 테마 컬러 재적용
  if (state.activeTab === 'stats') {
    renderAllCharts();
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  
  ['today', 'plan', 'stats'].forEach(t => {
    const sec = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-${t}-btn`);
    const btmBtn = document.getElementById(`bottom-tab-${t}`);

    if (t === tabId) {
      if (sec) sec.classList.remove('hidden');
      if (btn) {
        btn.classList.add('active', 'text-indigo-600', 'dark:text-indigo-400');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400');
      }
      if (btmBtn) {
        btmBtn.className = 'bottom-nav-btn flex flex-col items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold transition';
      }
    } else {
      if (sec) sec.classList.add('hidden');
      if (btn) {
        btn.classList.remove('active', 'text-indigo-600', 'dark:text-indigo-400');
        btn.classList.add('text-slate-600', 'dark:text-slate-400');
      }
      if (btmBtn) {
        btmBtn.className = 'bottom-nav-btn flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 font-medium hover:text-slate-600 transition';
      }
    }
  });

  if (tabId === 'today') {
    renderTodayView();
  } else if (tabId === 'plan') {
    renderPlanView();
  } else if (tabId === 'stats') {
    renderStatsView();
  }
  if (window.lucide) lucide.createIcons();
}

function switchToCalendarTab() {
  switchTab('plan');
  switchPlanSubView('monthly');
}

function switchPlanSubView(view) {
  state.planSubView = view;
  const weeklySec = document.getElementById('plan-subview-weekly');
  const monthlySec = document.getElementById('plan-subview-monthly');
  const weeklyBtn = document.getElementById('plan-view-weekly-btn');
  const monthlyBtn = document.getElementById('plan-view-monthly-btn');

  if (view === 'weekly') {
    weeklySec.classList.remove('hidden');
    monthlySec.classList.add('hidden');
    weeklyBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
    weeklyBtn.classList.remove('text-slate-600', 'dark:text-slate-400');
    monthlyBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
    monthlyBtn.classList.add('text-slate-600', 'dark:text-slate-400');
    renderWeeklyView();
  } else {
    weeklySec.classList.add('hidden');
    monthlySec.classList.remove('hidden');
    monthlyBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
    monthlyBtn.classList.remove('text-slate-600', 'dark:text-slate-400');
    weeklyBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
    weeklyBtn.classList.add('text-slate-600', 'dark:text-slate-400');
    renderMonthlyCalendar();
  }
  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 5. 날짜 변경 로직
// ==========================================
function changeCurrentDate(offsetDays) {
  const cur = new Date(state.currentDate + 'T00:00:00');
  cur.setDate(cur.getDate() + offsetDays);
  state.currentDate = getTodayString(cur);
  updateDateUI();
  renderTodayView();
}

function onDatePickChange(val) {
  if (!val) return;
  state.currentDate = val;
  updateDateUI();
  renderTodayView();
}

function goToToday() {
  state.currentDate = state.todayDate;
  updateDateUI();
  renderTodayView();
}

// ==========================================
// 토스트 알림 헬퍼 (모바일 친화적 피드백)
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let bgClass = 'bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 border-slate-700';
  if (type === 'success') bgClass = 'bg-emerald-600 text-white shadow-emerald-500/30';
  else if (type === 'warn') bgClass = 'bg-amber-600 text-white shadow-amber-500/30';
  else if (type === 'error') bgClass = 'bg-rose-600 text-white shadow-rose-500/30';

  toast.className = `toast-popup px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-md text-xs sm:text-sm font-bold flex items-center gap-2 pointer-events-auto transition-all ${bgClass}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2400);
}

function updateDateUI() {
  const picker = document.getElementById('selected-date-picker');
  if (picker) picker.value = state.currentDate;

  // 등록 날짜 바에 요일(월~일) 선명하게 표시
  const formattedTextEl = document.getElementById('selected-date-formatted-text');
  if (formattedTextEl) {
    const d = new Date(state.currentDate + 'T00:00:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayIdx = d.getDay();
    const dayName = dayNames[dayIdx];

    // 주말 강조 색상 (토: 파랑, 일: 빨강, 평일: 인디고)
    let dayBadgeClass = 'text-indigo-600 dark:text-indigo-400 font-extrabold';
    if (dayIdx === 0) dayBadgeClass = 'text-rose-500 font-extrabold';
    else if (dayIdx === 6) dayBadgeClass = 'text-blue-500 font-extrabold';

    formattedTextEl.innerHTML = `<span>${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}</span> <span class="${dayBadgeClass}">(${dayName}요일)</span>`;
  }

  const todayBtn = document.getElementById('btn-go-to-today');
  if (todayBtn) {
    if (state.currentDate === state.todayDate) {
      todayBtn.className = 'text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-xl shadow-xs whitespace-nowrap';
      todayBtn.textContent = '오늘';
    } else {
      todayBtn.className = 'text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 transition whitespace-nowrap border border-indigo-200/60 dark:border-indigo-800';
      todayBtn.textContent = '오늘로';
    }
  }

  const topDisplay = document.getElementById('current-date-display');
  if (topDisplay) {
    topDisplay.textContent = formatDateDisplay(state.currentDate);
  }
}

function openDatePicker() {
  const picker = document.getElementById('selected-date-picker');
  if (!picker) return;
  if (typeof picker.showPicker === 'function') {
    try {
      picker.showPicker();
      return;
    } catch (e) {}
  }
  picker.focus();
  picker.click();
}

// ==========================================
// 6. 오늘 기록 (TAB 1) 렌더링 & 제어
// ==========================================
function renderTodayView() {
  updateDateUI();
  const rec = getRecord(state.currentDate);

  // 상단 요약 카드 갱신 (자기점검 & 태만 체크)
  renderSummaryCards(rec);

  // 1. 공부 시간 카드 갱신
  const totalStudyMins = rec.studyMinutes || 0;
  const targetH = state.studyTargetHours || 3;
  const targetMins = targetH * 60;
  const studyTargetInput = document.getElementById('study-target-hours');
  if (studyTargetInput) studyTargetInput.value = targetH;

  const cardStudyTotal = document.getElementById('card-total-study');
  if (cardStudyTotal) cardStudyTotal.textContent = formatMinutes(totalStudyMins);

  const studyHoursInput = document.getElementById('study-input-hours');
  const studyMinutesInput = document.getElementById('study-input-minutes');
  if (studyHoursInput && studyMinutesInput) {
    studyHoursInput.value = Math.floor(totalStudyMins / 60) || '';
    studyMinutesInput.value = (totalStudyMins % 60) || '';
  }

  // 공부 달성 여부 & 태만 체크
  const studyEvalTag = document.getElementById('study-eval-tag');
  const studyDiffText = document.getElementById('study-target-diff-text');
  if (totalStudyMins >= targetMins) {
    const overMins = totalStudyMins - targetMins;
    if (studyEvalTag) {
      studyEvalTag.textContent = '목표 달성 🎉';
      studyEvalTag.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
    }
    if (studyDiffText) {
      studyDiffText.textContent = `목표(${targetH}시간)를 ${overMins > 0 ? formatMinutes(overMins) + ' 초과 ' : ''}달성했습니다! 성실 실천 👍`;
      studyDiffText.className = 'mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400';
    }
  } else {
    const remainMins = targetMins - totalStudyMins;
    if (studyEvalTag) {
      studyEvalTag.textContent = totalStudyMins === 0 ? '미시작' : '미달';
      studyEvalTag.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
    }
    if (studyDiffText) {
      studyDiffText.textContent = `목표까지 ${formatMinutes(remainMins)} 부족합니다 (태만 주의 ⚠️)`;
      studyDiffText.className = 'mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400';
    }
  }

  // 2. 운동 카드 갱신
  const wo = rec.workout || {};
  const woToggle = document.getElementById('workout-toggle');
  if (woToggle) woToggle.checked = !!wo.done;

  const woLabel = document.getElementById('workout-toggle-label');
  if (woLabel) {
    woLabel.textContent = wo.done ? '운동 완료! 💪' : '미실천';
    woLabel.className = wo.done ? 'ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400' : 'ml-2 text-xs font-semibold text-slate-500';
  }

  const woSummaryBadge = document.getElementById('workout-summary-badge');
  if (woSummaryBadge) {
    if (wo.done) {
      woSummaryBadge.textContent = `${wo.type || '운동'} ${wo.duration || 0}분 완료! 🔥`;
    } else {
      woSummaryBadge.textContent = '운동 쉰 날';
    }
  }

  const currentWoType = wo.type || '헬스';
  selectWorkoutType(currentWoType);

  const woDur = document.getElementById('workout-duration-input');
  if (woDur) woDur.value = (wo.duration && wo.duration > 0) ? wo.duration : '';

  // 3. 수면 카드 갱신 (7시간 기준)
  const sl = rec.sleep || {};
  const slHoursInput = document.getElementById('sleep-direct-hours');
  const slMinsInput = document.getElementById('sleep-direct-mins');
  const durationMins = sl.durationMinutes || 0;
  if (slHoursInput && slMinsInput) {
    slHoursInput.value = durationMins > 0 ? Math.floor(durationMins / 60) : '';
    slMinsInput.value = durationMins > 0 ? (durationMins % 60) : '';
  }

  updateSleep7hUI(durationMins);

  // 일기 메모
  const noteInput = document.getElementById('daily-note-input');
  if (noteInput) noteInput.value = rec.note || '';

  // 할 일 목록 렌더링
  renderTodoList();

  // 이달의 실천 중인 루틴 목표 미니 배너 렌더링
  renderTodayActiveGoals();

  if (window.lucide) lucide.createIcons();
}

function updateSleep7hUI(durationMins) {
  const calcDisplay = document.getElementById('calc-sleep-display');
  const statusText = document.getElementById('sleep-7h-status-text');
  const evalTag = document.getElementById('sleep-eval-tag');
  const targetSleepM = getSleepTargetMinutes();
  const sleepTargetText = getSleepTargetText();

  const sleepHeader = document.getElementById('sleep-card-header-title');
  if (sleepHeader) sleepHeader.textContent = `수면 시간 (기준 ${sleepTargetText})`;

  if (!calcDisplay || !statusText || !evalTag) return;

  if (durationMins <= 0) {
    calcDisplay.textContent = '0시간 0분';
    statusText.textContent = `${sleepTargetText} 기준: 수면 시간을 입력해주세요.`;
    statusText.className = 'mt-1.5 text-xs font-medium text-slate-500';
    evalTag.textContent = '기록대기';
    evalTag.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500';
    return;
  }

  calcDisplay.textContent = formatMinutes(durationMins);
  const diff = durationMins - targetSleepM;

  if (diff >= 0 && diff <= 120) {
    // 기준 이상 ~ 2시간 초과 이하: 최적 수면
    evalTag.textContent = `${sleepTargetText} 충족 ✅`;
    evalTag.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
    statusText.textContent = `${sleepTargetText} 기준: +${formatMinutes(diff)} 충분 (적정 수면 달성 👍)`;
    statusText.className = 'mt-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400';
  } else if (diff > 120) {
    // 2시간 초과: 과수면
    evalTag.textContent = '과수면 😴';
    evalTag.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300';
    statusText.textContent = `${sleepTargetText} 기준: +${formatMinutes(diff)} 초과 (과수면 주의 😴)`;
    statusText.className = 'mt-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400';
  } else {
    // 미달
    const lackMins = Math.abs(diff);
    evalTag.textContent = `${sleepTargetText} 미달 ⚠️`;
    evalTag.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
    statusText.textContent = `${sleepTargetText} 기준: ${formatMinutes(lackMins)} 부족 ⚠️ (컨디션/피로 주의)`;
    statusText.className = 'mt-1.5 text-xs font-bold text-amber-600 dark:text-amber-400';
  }
}

function renderSummaryCards(rec) {
  // 1. 할 일 달성률 & 자기점검 판정
  const todayTodos = state.todos.filter(t => t.date === state.currentDate);
  const totalCount = todayTodos.length;
  const completedCount = todayTodos.filter(t => t.completed).length;
  const todoRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  document.getElementById('stat-rate-text').textContent = `${todoRate}%`;
  document.getElementById('stat-count-text').textContent = `${completedCount} / ${totalCount}개 완료`;
  
  const circle = document.getElementById('stat-progress-circle');
  if (circle) {
    circle.setAttribute('stroke-dasharray', `${todoRate}, 100`);
    if (todoRate === 100 && totalCount > 0) {
      circle.setAttribute('class', 'text-emerald-500 transition-all duration-500 stroke-current');
    } else {
      circle.setAttribute('class', 'text-indigo-600 transition-all duration-500 stroke-current');
    }
  }

  // 2. 공부 시간 요약 & 달성 여부
  const studyMins = rec.studyMinutes || 0;
  const targetH = state.studyTargetHours || 3;
  const targetMins = targetH * 60;
  const isStudyPassed = studyMins >= targetMins;

  document.getElementById('summary-study-time').textContent = formatMinutes(studyMins);
  document.getElementById('summary-study-target').textContent = `목표: ${targetH}시간 (${isStudyPassed ? '달성' : '미달'}) ✏️`;
  const studyBadge = document.getElementById('study-status-badge');
  if (studyBadge) {
    if (isStudyPassed) {
      studyBadge.textContent = '달성 🎉';
      studyBadge.className = 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else {
      studyBadge.textContent = '미달 ⚠️';
      studyBadge.className = 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
    }
  }

  // 3. 운동 요약 & 목표
  const wo = rec.workout || {};
  const workoutTargetM = getWorkoutTargetMinutes();
  const workoutWeeklyDays = getWorkoutWeeklyTargetDays();
  const workoutTargetBadge = document.getElementById('workout-target-badge');
  if (workoutTargetBadge) {
    workoutTargetBadge.textContent = `목표: ${workoutTargetM}m`;
  }
  const cardWorkoutTargetText = document.getElementById('card-workout-target-text');
  if (cardWorkoutTargetText) {
    cardWorkoutTargetText.textContent = `목표: ${workoutTargetM}분 실천 (주 ${workoutWeeklyDays}일)`;
  }

  if (wo.done) {
    const isWorkoutTimePass = (wo.duration || 0) >= workoutTargetM;
    document.getElementById('summary-workout-status').textContent = `${wo.type || '운동'} 완료 ${isWorkoutTimePass ? '🔥' : '👍'}`;
    document.getElementById('summary-workout-detail').textContent = `${wo.duration || 0}분 (${isWorkoutTimePass ? '목표 달성' : `${workoutTargetM}분 목표`})`;
  } else {
    document.getElementById('summary-workout-status').textContent = '미실천';
    document.getElementById('summary-workout-detail').textContent = `오늘 목표: ${workoutTargetM}분`;
  }

  // 4. 수면 요약 (사용자 지정 기준)
  const sl = rec.sleep || {};
  const sleepM = sl.durationMinutes || 0;
  const targetSleepM = getSleepTargetMinutes();
  const sleepTargetText = getSleepTargetText();
  const sleepDiffBadge = document.getElementById('sleep-diff-badge');

  const sleepLabel = document.getElementById('summary-sleep-label');
  if (sleepLabel) sleepLabel.textContent = `수면(${sleepTargetText})`;

  if (sleepM > 0) {
    document.getElementById('summary-sleep-time').textContent = formatMinutes(sleepM);
    const diff = sleepM - targetSleepM;
    if (diff >= 0) {
      document.getElementById('summary-sleep-range').textContent = `${sleepTargetText} 기준 +${formatMinutes(diff)} (충족) ✏️`;
      if (sleepDiffBadge) {
        sleepDiffBadge.textContent = '충족 ✅';
        sleepDiffBadge.className = 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
      }
    } else {
      document.getElementById('summary-sleep-range').textContent = `${sleepTargetText} 기준 ${formatMinutes(Math.abs(diff))} 미달 ✏️`;
      if (sleepDiffBadge) {
        sleepDiffBadge.textContent = '미달 ⚠️';
        sleepDiffBadge.className = 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
      }
    }
  } else {
    document.getElementById('summary-sleep-time').textContent = '0시간 0분';
    document.getElementById('summary-sleep-range').textContent = `기준: ${sleepTargetText} ✏️`;
    if (sleepDiffBadge) {
      sleepDiffBadge.textContent = '미기록';
      sleepDiffBadge.className = 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 dark:bg-slate-700';
    }
  }

  // 종합 태만 / 성실 판정 뱃지
  const disciplineBadge = document.getElementById('discipline-badge');
  if (disciplineBadge) {
    let score = 0;
    if (isStudyPassed) score += 35;
    else if (studyMins > 0) score += 15;

    if (wo.done && (wo.duration || 0) >= workoutTargetM) score += 30;
    else if (wo.done) score += 20;

    if (sleepM >= targetSleepM) score += 15;
    if (totalCount > 0 && todoRate >= 70) score += 20;

    if (score >= 80) {
      disciplineBadge.textContent = '성실 달성 🔥';
      disciplineBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else if (score >= 50) {
      disciplineBadge.textContent = '보통 실천 ⚡';
      disciplineBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    } else {
      disciplineBadge.textContent = '태만 주의 🚨';
      disciplineBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse';
    }
  }
}

// ==========================================
// 7. 공부 시간 직접 입력 & 달성 로직
// ==========================================
function updateStudyTargetHours(val) {
  const h = parseInt(val, 10);
  if (isNaN(h) || h <= 0) return;
  state.studyTargetHours = h;
  saveData();
  renderTodayView();
}

function saveStudyTimeDirect() {
  const hInput = document.getElementById('study-input-hours');
  const mInput = document.getElementById('study-input-minutes');

  const h = parseInt(hInput ? hInput.value : 0, 10) || 0;
  const m = parseInt(mInput ? mInput.value : 0, 10) || 0;

  const totalMinutes = h * 60 + m;
  const rec = getRecord(state.currentDate);
  rec.studyMinutes = totalMinutes;

  saveData();
  renderTodayView();

  const targetMins = (state.studyTargetHours || 3) * 60;
  if (totalMinutes >= targetMins && totalMinutes > 0) {
    triggerCelebration('study');
    showToast(`🎉 오늘 목표(${state.studyTargetHours}시간) 달성! 총 ${formatMinutes(totalMinutes)} 저장됨`, 'success');
  } else {
    showToast(`📖 공부 시간(${formatMinutes(totalMinutes)}) 저장 완료`, 'success');
  }
}

function quickAddStudy(addMins) {
  const rec = getRecord(state.currentDate);
  rec.studyMinutes = (rec.studyMinutes || 0) + addMins;
  saveData();
  renderTodayView();
  showToast(`+${formatMinutes(addMins)} 추가됨 (총 ${formatMinutes(rec.studyMinutes)})`, 'info');
}

function clearStudyTime() {
  if (confirm(`${state.currentDate}의 공부 시간을 0분으로 초기화하시겠습니까?`)) {
    const rec = getRecord(state.currentDate);
    rec.studyMinutes = 0;
    saveData();
    renderTodayView();
    showToast('공부 시간이 0분으로 초기화되었습니다.', 'warn');
  }
}

// ==========================================
// 8. 운동 트래커 (어떤 운동을 얼만큼 했는지 - 4종목 선택)
// ==========================================
function toggleWorkoutDone(isDone) {
  const rec = getRecord(state.currentDate);
  rec.workout.done = isDone;
  if (!isDone) {
    // 미실천 처리
  } else if (!rec.workout.duration || rec.workout.duration <= 0) {
    const durInput = document.getElementById('workout-duration-input');
    const val = parseInt(durInput ? durInput.value : 0, 10);
    rec.workout.duration = val > 0 ? val : 50;
  }
  saveData();
  renderTodayView();
  if (isDone) triggerCelebration('workout');
}

function selectWorkoutType(type) {
  const hiddenInput = document.getElementById('workout-selected-type');
  if (hiddenInput) hiddenInput.value = type;

  const buttons = document.querySelectorAll('.workout-choice-btn');
  buttons.forEach(btn => {
    const val = btn.getAttribute('data-val');
    if (val === type) {
      btn.className = 'workout-choice-btn py-2 px-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold flex items-center justify-center gap-1.5 shadow-sm transition';
    } else {
      btn.className = 'workout-choice-btn py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-emerald-500 transition';
    }
  });
}

function quickSetWorkoutDuration(mins) {
  const durInput = document.getElementById('workout-duration-input');
  if (durInput) {
    durInput.value = mins;
  }
}

function saveWorkoutRecordSimple() {
  const rec = getRecord(state.currentDate);
  const hiddenInput = document.getElementById('workout-selected-type');
  const durInput = document.getElementById('workout-duration-input');

  const type = (hiddenInput && hiddenInput.value) ? hiddenInput.value : '헬스';
  let duration = durInput ? parseInt(durInput.value, 10) : 0;
  if (isNaN(duration) || duration <= 0) {
    duration = 50;
    if (durInput) durInput.value = 50;
  }

  rec.workout = {
    done: true,
    type: type,
    duration: duration,
    note: ''
  };

  saveData();
  renderTodayView();
  triggerCelebration('workout');
  showToast(`🏃 운동 기록 저장: ${type} ${duration}분 완료!`, 'success');
}

function saveWorkoutRecord() {
  saveWorkoutRecordSimple();
}

// ==========================================
// 9. 수면 트래커 (기준 미달/충족 체크)
// ==========================================
function onDirectSleepInput() {
  const h = parseInt(document.getElementById('sleep-direct-hours')?.value, 10) || 0;
  const m = parseInt(document.getElementById('sleep-direct-mins')?.value, 10) || 0;
  const totalMins = h * 60 + m;
  updateSleep7hUI(totalMins);
}

function quickSetSleep(h, m) {
  const slHoursInput = document.getElementById('sleep-direct-hours');
  const slMinsInput = document.getElementById('sleep-direct-mins');
  if (slHoursInput) slHoursInput.value = h;
  if (slMinsInput) slMinsInput.value = m;
  onDirectSleepInput();
  showToast(`수면 시간 ${h}시간 ${m}분 설정됨`, 'info');
}

function saveSleepRecordSimple() {
  const h = parseInt(document.getElementById('sleep-direct-hours')?.value, 10) || 0;
  const m = parseInt(document.getElementById('sleep-direct-mins')?.value, 10) || 0;
  const diffMins = h * 60 + m;

  if (diffMins <= 0) {
    showToast('수면 시간을 0시간 이상 입력해주세요.', 'warn');
    return;
  }

  const rec = getRecord(state.currentDate);
  rec.sleep = {
    bedtime: '',
    waketime: '',
    durationMinutes: diffMins
  };

  saveData();
  renderTodayView();

  const targetSleepM = getSleepTargetMinutes();
  const sleepTargetText = getSleepTargetText();
  const diff = diffMins - targetSleepM;
  if (diff >= 0) {
    showToast(`🛌 수면 ${formatMinutes(diffMins)} 저장! 기준(${sleepTargetText}) 충족 (+${formatMinutes(diff)}) 👍`, 'success');
  } else {
    showToast(`🛌 수면 ${formatMinutes(diffMins)} 저장! 기준(${sleepTargetText}) -${formatMinutes(Math.abs(diff))} 미달 ⚠️`, 'warn');
  }
}

function saveSleepRecord() {
  saveSleepRecordSimple();
}

function calcSleepDuration() {
  const h = parseInt(document.getElementById('sleep-direct-hours')?.value, 10) || 0;
  const m = parseInt(document.getElementById('sleep-direct-mins')?.value, 10) || 0;
  return h * 60 + m;
}

function saveDailyNote() {
  const text = document.getElementById('daily-note-input').value.trim();
  const rec = getRecord(state.currentDate);
  rec.note = text;
  saveData();
  alert('오늘의 회고가 저장되었습니다.');
}

// ==========================================
// 10. 할 일 (Todo) CRUD & 렌더링
// ==========================================
function handleCreateTodo(e) {
  e.preventDefault();
  const titleInput = document.getElementById('new-todo-title');
  const catInput = document.getElementById('new-todo-category');
  const estInput = document.getElementById('new-todo-est-min');

  const title = titleInput.value.trim();
  if (!title) return;

  const newTodo = {
    id: 'td_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: state.currentDate,
    title: title,
    category: catInput.value,
    estMin: parseInt(estInput.value, 10) || 0,
    completed: false,
    createdAt: Date.now()
  };

  state.todos.unshift(newTodo);
  saveData();

  titleInput.value = '';
  estInput.value = '';
  renderTodayView();
}

function toggleTodo(todoId) {
  const todo = state.todos.find(t => t.id === todoId);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveData();
  renderTodayView();

  if (todo.completed) {
    triggerCelebration('todo');
  }
}

function deleteTodo(todoId) {
  state.todos = state.todos.filter(t => t.id !== todoId);
  saveData();
  renderTodayView();
}

function setTodoFilter(cat) {
  state.todoFilter = cat;
  const btns = document.querySelectorAll('.todo-filter-btn');
  btns.forEach(btn => {
    if (btn.textContent.trim().includes(cat) || (cat === 'ALL' && btn.textContent.trim() === '전체')) {
      btn.className = 'todo-filter-btn active px-3 py-1 rounded-full font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition';
    } else {
      btn.className = 'todo-filter-btn px-3 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition';
    }
  });
  renderTodoList();
}

function ensureDailyHabitsExist() {
  if (!state.customHabits || state.customHabits.length === 0) return;
  const currentTodos = state.todos.filter(t => t.date === state.currentDate);

  state.customHabits.forEach(h => {
    const exists = currentTodos.some(t => t.title.includes(h.title) || t.habitId === h.id);
    if (!exists) {
      state.todos.push({
        id: 'habittodo_' + state.currentDate + '_' + h.id,
        habitId: h.id,
        date: state.currentDate,
        title: `${h.icon} ${h.title}`,
        category: '루틴',
        estMin: 30,
        completed: false,
        createdAt: Date.now()
      });
    }
  });
}

function renderTodoList() {
  ensureDailyHabitsExist();
  const container = document.getElementById('todo-list-container');
  let list = state.todos.filter(t => t.date === state.currentDate);

  if (state.todoFilter !== 'ALL') {
    list = list.filter(t => t.category === state.todoFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <i data-lucide="check-check" class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2"></i>
        ${state.todoFilter === 'ALL' ? '등록된 할 일이 없습니다. 오늘 할 일을 추가해보세요!' : `${state.todoFilter} 카테고리의 할 일이 없습니다.`}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const categoryBadgeColors = {
    '공부': 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    '운동/건강': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    '업무/과제': 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    '루틴': 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    '기타': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  };

  container.innerHTML = list.map(item => {
    const badgeColor = categoryBadgeColors[item.category] || categoryBadgeColors['기타'];
    return `
      <div class="flex items-center justify-between p-3.5 rounded-xl border ${item.completed ? 'bg-slate-50/70 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800' : 'bg-white border-slate-200/90 dark:bg-slate-800 dark:border-slate-700'} shadow-sm hover:border-indigo-200 transition">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <button onclick="toggleTodo('${item.id}')" class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${item.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'}">
            ${item.completed ? '<i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>' : ''}
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded-md font-semibold ${badgeColor}">
                ${item.category}
              </span>
              <span class="text-sm font-medium ${item.completed ? 'todo-completed-text text-slate-400' : 'text-slate-800 dark:text-slate-200'} truncate">
                ${escapeHtml(item.title)}
              </span>
            </div>
          </div>
          ${item.estMin ? `<span class="text-xs text-slate-400 font-mono flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i>${item.estMin}분</span>` : ''}
        </div>
        <button onclick="deleteTodo('${item.id}')" class="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition" title="삭제">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 11. 주간 & 월간 계획 (TAB 2)
// ==========================================
function renderPlanView() {
  if (state.planSubView === 'weekly') {
    renderWeeklyView();
  } else {
    renderMonthlyCalendar();
  }
}

function renderWeeklyView() {
  const current = new Date(state.currentDate + 'T00:00:00');
  const monday = getMonday(current);
  const weekKey = getWeekKey(state.currentDate);

  const titleEl = document.getElementById('weekly-audit-title');
  if (titleEl) titleEl.textContent = `이번 주 자기점검 리포트 (${weekKey})`;
  const topGoalsTitle = document.getElementById('weekly-title-display');
  if (topGoalsTitle) topGoalsTitle.textContent = `이번 주 핵심 목표 (${weekKey})`;

  // 주간 핵심 목표 렌더링
  const goalsContainer = document.getElementById('weekly-goals-container');
  const weekGoals = state.weeklyGoals.filter(g => g.weekKey === weekKey);

  if (weekGoals.length === 0) {
    goalsContainer.innerHTML = `
      <div class="col-span-3 text-center py-6 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        이번 주 목표가 없습니다. 우측 상단의 '+ 목표 추가'를 눌러 등록해보세요!
      </div>
    `;
  } else {
    goalsContainer.innerHTML = weekGoals.map(g => `
      <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 ${g.completed ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'bg-slate-50 dark:bg-slate-900/50'}">
        <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
          <input type="checkbox" onchange="toggleWeeklyGoal('${g.id}')" ${g.completed ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500">
          <span class="text-sm font-medium ${g.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'} truncate">${escapeHtml(g.text)}</span>
        </label>
        <button onclick="deleteWeeklyGoal('${g.id}')" class="text-slate-300 hover:text-rose-500 ml-2">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
  }

  // 이번 주 7일 데이터 집계 변수
  let weekTotalStudyMins = 0;
  let weekStudyPassDays = 0;
  let weekWorkoutCount = 0;
  let weekWorkoutTotalMins = 0;
  const weekWorkoutTypes = [];
  let weekTotalSleepMins = 0;
  let weekSleepDays = 0;
  let weekSleepPassDays = 0;
  let weekSleepFailDays = 0;

  const targetDailyStudyMins = (state.studyTargetHours || 3) * 60;
  const weekTargetStudyMins = targetDailyStudyMins * 7;

  // 7일간의 요일별 요약 카드 렌더링
  const daysGrid = document.getElementById('weekly-days-grid');
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

  daysGrid.innerHTML = dayNames.map((dName, idx) => {
    const dayDate = addDays(monday, idx);
    const dayDateStr = getTodayString(dayDate);
    const isSelected = dayDateStr === state.currentDate;
    const isToday = dayDateStr === state.todayDate;

    const dayRec = state.records[dayDateStr] || {};
    const dayTodos = state.todos.filter(t => t.date === dayDateStr);
    const completedTodos = dayTodos.filter(t => t.completed).length;
    const rate = dayTodos.length > 0 ? Math.round((completedTodos / dayTodos.length) * 100) : 0;

    // 공부 통계 집계
    const sM = dayRec.studyMinutes || 0;
    weekTotalStudyMins += sM;
    const studyPassed = sM >= targetDailyStudyMins;
    if (studyPassed) weekStudyPassDays++;

    // 운동 통계 집계
    const wo = dayRec.workout || {};
    if (wo.done) {
      weekWorkoutCount++;
      weekWorkoutTotalMins += (wo.duration || 0);
      if (wo.type && !weekWorkoutTypes.includes(wo.type)) {
        weekWorkoutTypes.push(wo.type);
      }
    }

    // 수면 기준 집계
    const slM = dayRec.sleep?.durationMinutes || 0;
    const targetSleepM = getSleepTargetMinutes();
    const sleepTargetText = getSleepTargetText();
    let sleepPassed = false;
    if (slM > 0) {
      weekSleepDays++;
      weekTotalSleepMins += slM;
      if (slM >= targetSleepM) {
        weekSleepPassDays++;
        sleepPassed = true;
      } else {
        weekSleepFailDays++;
      }
    }

    return `
      <div onclick="selectDateFromPlan('${dayDateStr}')" class="cursor-pointer calendar-tile p-3.5 rounded-xl border transition-all ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold ${idx === 5 ? 'text-blue-500' : idx === 6 ? 'text-rose-500' : 'text-slate-500'}">${dName}</span>
          <span class="text-xs font-semibold ${isToday ? 'px-1.5 py-0.5 rounded bg-indigo-600 text-white' : 'text-slate-400'}">${dayDate.getDate()}일</span>
        </div>
        <div class="space-y-1.5 text-xs">
          <!-- 공부 시간 & 달성 여부 -->
          <div class="flex items-center justify-between">
            <span class="text-slate-500">📖 공부</span>
            <span class="font-bold ${studyPassed ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}">${formatMinutes(sM)}</span>
          </div>

          <!-- 운동 실천 여부 & 종류 -->
          <div class="flex items-center justify-between">
            <span class="text-slate-500">🏃 운동</span>
            <span class="font-semibold truncate max-w-[80px] ${wo.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
              ${wo.done ? (wo.type || '완료') : '휴식'}
            </span>
          </div>

          <!-- 수면 기준 -->
          <div class="flex items-center justify-between">
            <span class="text-slate-500">🛌 수면</span>
            <span class="font-semibold ${slM >= targetSleepM ? 'text-purple-600 dark:text-purple-400 font-bold' : slM > 0 ? 'text-amber-500' : 'text-slate-400'}">
              ${slM > 0 ? (slM >= targetSleepM ? '충족' : '미달') : '-'}
            </span>
          </div>

          <!-- 할 일 완료율 바 -->
          <div class="pt-1 border-t border-slate-100 dark:border-slate-700/50">
            <div class="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>할일 완료</span>
              <span>${rate}%</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div class="bg-indigo-500 h-full rounded-full" style="width: ${rate}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 1. 주간 공부 UI 반영
  document.getElementById('weekly-study-total').textContent = formatMinutes(weekTotalStudyMins);
  const avgStudy = Math.round((weekTotalStudyMins / 7 / 60) * 10) / 10;
  document.getElementById('weekly-study-avg').textContent = `${avgStudy}시간`;
  document.getElementById('weekly-study-days-count').textContent = `${weekStudyPassDays}/7일 목표달성`;
  const studyPassBadge = document.getElementById('weekly-study-pass-badge');
  if (studyPassBadge) {
    if (weekTotalStudyMins >= weekTargetStudyMins) {
      studyPassBadge.textContent = '주간목표 달성 🎉';
      studyPassBadge.className = 'font-bold text-emerald-400';
    } else {
      const lackH = Math.round((weekTargetStudyMins - weekTotalStudyMins) / 60 * 10) / 10;
      studyPassBadge.textContent = `${lackH}h 부족`;
      studyPassBadge.className = 'font-bold text-amber-400';
    }
  }

  // 2. 주간 운동 UI 반영
  const workoutTargetDays = getWorkoutWeeklyTargetDays();
  const isWorkoutWeekPassed = weekWorkoutCount >= workoutTargetDays;
  document.getElementById('weekly-workout-pass-badge').textContent = `${weekWorkoutCount}/${workoutTargetDays}일 실천 (${isWorkoutWeekPassed ? '달성' : '진행중'})`;
  document.getElementById('weekly-workout-duration').textContent = `총 ${weekWorkoutTotalMins}분`;
  document.getElementById('weekly-workout-types-summary').textContent = weekWorkoutTypes.length > 0 
    ? `실천 종목: ${weekWorkoutTypes.join(', ')}` 
    : '운동 쉰 주간';

  // 3. 주간 수면 (사용자 지정 기준) UI 반영
  const targetSleepMWeekly = getSleepTargetMinutes();
  const sleepTargetTextWeekly = getSleepTargetText();
  const avgSleep = weekSleepDays > 0 ? Math.round(weekTotalSleepMins / weekSleepDays) : 0;
  document.getElementById('weekly-sleep-avg').textContent = `평균 ${formatMinutes(avgSleep)}`;
  document.getElementById('weekly-sleep-pass-count').textContent = `${sleepTargetTextWeekly} 이상: ${weekSleepPassDays}일`;
  document.getElementById('weekly-sleep-fail-count').textContent = `${sleepTargetTextWeekly} 미달: ${weekSleepFailDays}일`;
  const sleepEvalBadge = document.getElementById('weekly-sleep-eval-badge');
  if (sleepEvalBadge) {
    if (avgSleep >= targetSleepMWeekly) {
      sleepEvalBadge.textContent = '수면 양호 ✅';
      sleepEvalBadge.className = 'font-bold text-emerald-300';
    } else {
      sleepEvalBadge.textContent = '수면 부족 ⚠️';
      sleepEvalBadge.className = 'font-bold text-amber-300';
    }
  }

  // 4. 주간 종합 자기점검 점수
  let disciplineScore = 0;
  disciplineScore += Math.min(40, Math.round((weekTotalStudyMins / weekTargetStudyMins) * 40));
  disciplineScore += Math.min(30, Math.round((weekWorkoutCount / workoutTargetDays) * 30));
  disciplineScore += Math.min(30, Math.round((weekSleepPassDays / Math.max(1, weekSleepDays)) * 30));
  disciplineScore = Math.min(100, disciplineScore);

  document.getElementById('weekly-score-text').textContent = `${disciplineScore}점`;
  const discBadge = document.getElementById('weekly-discipline-badge');
  if (discBadge) {
    if (disciplineScore >= 80) {
      discBadge.textContent = '성실 실천 순항 중 🚀';
      discBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-600 text-white';
    } else if (disciplineScore >= 50) {
      discBadge.textContent = '보통 (일부 태만 주의 ⚡)';
      discBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-600 text-white';
    } else {
      discBadge.textContent = '태만 경고! 자극 필요 🚨';
      discBadge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-600 text-white animate-pulse';
    }
  }

  if (window.lucide) lucide.createIcons();
}

function addWeeklyGoalPrompt() {
  const text = prompt('이번 주의 핵심 목표를 입력하세요:');
  if (!text || !text.trim()) return;

  const weekKey = getWeekKey(state.currentDate);
  state.weeklyGoals.push({
    id: 'wg_' + Date.now(),
    weekKey: weekKey,
    text: text.trim(),
    completed: false
  });
  saveData();
  renderWeeklyView();
}

function toggleWeeklyGoal(id) {
  const g = state.weeklyGoals.find(item => item.id === id);
  if (g) {
    g.completed = !g.completed;
    saveData();
    renderWeeklyView();
  }
}

function deleteWeeklyGoal(id) {
  state.weeklyGoals = state.weeklyGoals.filter(g => g.id !== id);
  saveData();
  renderWeeklyView();
}

function selectDateFromPlan(dateStr) {
  state.currentDate = dateStr;
  switchTab('today');
}

// ==========================================
// 12. 월간 캘린더 렌더링
// ==========================================
// ==========================================
// 12. 대형 달력 (Big Calendar) & 항목별 뷰 엔진
// ==========================================
function setCalendarMode(mode) {
  state.calendarMode = mode;
  saveData();
  renderCalendarModeButtons();
  renderMonthlyCalendar();
}

function renderCalendarModeButtons() {
  const btns = document.querySelectorAll('.cal-mode-btn');
  btns.forEach(btn => {
    const btnId = btn.id.replace('cal-mode-', '');
    if (btnId === state.calendarMode || (state.calendarMode.startsWith('habit_') && btnId === state.calendarMode)) {
      btn.className = 'cal-mode-btn active px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition flex items-center gap-1.5 shrink-0 shadow-sm';
    } else {
      btn.className = 'cal-mode-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0';
    }
  });

  renderHabitChips();
}

function renderHabitChips() {
  const container = document.getElementById('dynamic-habit-chips');
  if (!container) return;

  container.innerHTML = state.customHabits.map(h => {
    const isActive = state.calendarMode === `habit_${h.id}`;
    return `
      <button onclick="setCalendarMode('habit_${h.id}')" id="cal-mode-habit_${h.id}" class="cal-mode-btn px-3.5 py-1.5 rounded-xl text-xs font-bold ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'} transition flex items-center gap-1.5 shrink-0">
        <span>${h.icon || '⭐'}</span>
        <span>${escapeHtml(h.title)}</span>
      </button>
    `;
  }).join('');
}

function changeMonthlyMonth(offset) {
  state.monthlyDate.setMonth(state.monthlyDate.getMonth() + offset);
  renderMonthlyCalendar();
}

function renderMonthlyCalendar() {
  const year = state.monthlyDate.getFullYear();
  const month = state.monthlyDate.getMonth();

  const titleEl = document.getElementById('monthly-calendar-month-title');
  if (titleEl) titleEl.textContent = `${year}년 ${month + 1}월`;

  const routineSectionTitle = document.getElementById('monthly-routine-section-title');
  if (routineSectionTitle) routineSectionTitle.textContent = `${year}년 ${month + 1}월 루틴 목표`;

  renderMonthlyGoals();
  renderCalendarModeButtons();

  // 이번 달 1일과 말일 계산
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0(일) ~ 6(토)

  // 달력 전체 날짜 채우기 (주 단위 배열 생성)
  const weeks = [];
  let currentWeek = [];

  // 1일 이전 빈칸 채우기
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  // 1일부터 말일까지 채우기
  for (let d = 1; d <= totalDays; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 마지막 주 남은 빈칸 채우기
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // 월간 전체 집계용 변수
  let monthTotalStudyMins = 0;
  let monthStudyTargetPassDays = 0;
  let monthWorkoutDays = 0;
  let monthWorkoutTotalMins = 0;
  let monthSleepPassDays = 0;
  let monthSleepFailDays = 0;
  let monthSleepTotalMins = 0;
  let monthSleepRecordedDays = 0;

  // 현재 모드
  const mode = state.calendarMode;
  const isStudyMode = mode === 'study';
  const isWorkoutMode = mode === 'workout';
  const isSleepMode = mode === 'sleep';
  const isHabitMode = mode.startsWith('habit_');
  const targetHabitId = isHabitMode ? mode.replace('habit_', '') : null;
  const currentHabit = isHabitMode ? state.customHabits.find(h => h.id === targetHabitId) : null;

  let habitMonthlyCount = 0;

  // 주차별 통계 계산 및 HTML 생성
  const container = document.getElementById('monthly-calendar-cells');
  let gridHtml = '';

  weeks.forEach((week, weekIdx) => {
    let weekStudyMins = 0;
    let weekWorkoutDays = 0;
    let weekWorkoutMins = 0;
    let weekSleepMins = 0;
    let weekSleepDays = 0;
    let weekSleepPass = 0;
    let weekHabitCount = 0;

    let weekHtml = '';

    week.forEach(d => {
      if (d === null) {
        weekHtml += `<div class="min-h-[58px] sm:min-h-[95px] p-1 sm:p-2 bg-slate-50/30 dark:bg-slate-900/10 rounded-lg sm:rounded-xl border border-transparent"></div>`;
        return;
      }

      const curDateObj = new Date(year, month, d);
      const dateStr = getTodayString(curDateObj);
      const isToday = dateStr === state.todayDate;
      const isSelected = dateStr === state.currentDate;
      const rec = state.records[dateStr] || {};

      // 공부 데이터 집계
      const sM = rec.studyMinutes || 0;
      weekStudyMins += sM;
      monthTotalStudyMins += sM;
      const targetDailyStudyMins = (state.studyTargetHours || 3) * 60;
      const studyPassed = sM >= targetDailyStudyMins;
      if (studyPassed) monthStudyTargetPassDays++;

      // 운동 데이터 집계
      const wo = rec.workout || {};
      if (wo.done) {
        weekWorkoutDays++;
        weekWorkoutMins += (wo.duration || 0);
        monthWorkoutDays++;
        monthWorkoutTotalMins += (wo.duration || 0);
      }

      // 수면 데이터 집계 (사용자 지정 기준)
      const slM = rec.sleep?.durationMinutes || 0;
      const targetSleepM = getSleepTargetMinutes();
      const sleepTargetText = getSleepTargetText();
      if (slM > 0) {
        weekSleepDays++;
        weekSleepMins += slM;
        monthSleepRecordedDays++;
        monthSleepTotalMins += slM;
        if (slM >= targetSleepM) {
          weekSleepPass++;
          monthSleepPassDays++;
        } else {
          monthSleepFailDays++;
        }
      }

      // 커스텀 루틴 체크 여부
      const dayTodos = state.todos.filter(t => t.date === dateStr);
      let isHabitDone = false;
      if (isHabitMode && currentHabit) {
        const found = dayTodos.find(t => t.title.includes(currentHabit.title) && t.completed);
        if (found) {
          isHabitDone = true;
          weekHabitCount++;
          habitMonthlyCount++;
        }
      }

      // 모드별 날짜 셀 내용 렌더링
      let cellBodyHtml = '';
      let cellBorderClass = isSelected ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-400' : 'border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800';

      if (isStudyMode) {
        // [공부 시간 전용 달력 모드]
        if (sM > 0) {
          cellBodyHtml = `
            <div class="mt-1">
              <div class="text-sm font-extrabold ${studyPassed ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}">
                ${formatMinutes(sM)}
              </div>
              <span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded ${studyPassed ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}">
                ${studyPassed ? '목표 달성 ✅' : '미달'}
              </span>
            </div>
          `;
          if (studyPassed) cellBorderClass += ' bg-blue-50/20';
        } else {
          cellBodyHtml = `<div class="mt-2 text-xs text-slate-300 dark:text-slate-600 font-medium">0시간</div>`;
        }
      } else if (isWorkoutMode) {
        // [운동 전용 달력 모드]
        if (wo.done) {
          const isWorkoutPass = (wo.duration || 0) >= getWorkoutTargetMinutes();
          cellBodyHtml = `
            <div class="mt-1 space-y-0.5">
              <span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 truncate w-full">
                🏃 ${escapeHtml(wo.type || '운동')}
              </span>
              <div class="text-[11px] font-bold ${isWorkoutPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">
                ${wo.duration ? wo.duration + '분' : '완료'} ${isWorkoutPass ? '🔥' : ''}
              </div>
            </div>
          `;
          cellBorderClass += ' bg-emerald-50/20';
        } else {
          cellBodyHtml = `<div class="mt-2 text-xs text-slate-300 dark:text-slate-600">휴식 (X)</div>`;
        }
      } else if (isSleepMode) {
        // [수면 전용 달력 모드]
        if (slM > 0) {
          const diff = slM - targetSleepM;
          const isPass = diff >= 0;
          cellBodyHtml = `
            <div class="mt-1">
              <div class="text-xs font-extrabold text-purple-700 dark:text-purple-300">
                ${formatMinutes(slM)}
              </div>
              <span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${isPass ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'}">
                ${isPass ? `+${formatMinutes(diff)}` : `-${formatMinutes(Math.abs(diff))} 미달`}
              </span>
            </div>
          `;
        } else {
          cellBodyHtml = `<div class="mt-2 text-[11px] text-slate-300 dark:text-slate-600">미기록</div>`;
        }
      } else if (isHabitMode) {
        // [추가 루틴 전용 달력 모드]
        if (isHabitDone) {
          cellBodyHtml = `
            <div class="mt-1 text-center py-1 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
              <div class="text-base">${currentHabit?.icon || '✅'}</div>
              <span class="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">실천완료</span>
            </div>
          `;
        } else {
          cellBodyHtml = `<div class="mt-3 text-center text-xs text-slate-300 dark:text-slate-600">-</div>`;
        }
      } else {
        // [통합 뷰 모드]
        cellBodyHtml = `
          <div class="text-[10px] space-y-0.5 mt-1 text-slate-500 dark:text-slate-400">
            ${sM > 0 ? `<div class="truncate ${studyPassed ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500'}">📚 ${formatMinutes(sM)}</div>` : ''}
            ${wo.done ? `<div class="truncate text-emerald-600 dark:text-emerald-400 font-medium">🏃 ${wo.type || '운동'}</div>` : ''}
            ${slM > 0 ? `<div class="truncate ${slM >= targetSleepM ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-amber-500'}">🛌 ${slM >= targetSleepM ? '충족' : '미달'}</div>` : ''}
          </div>
        `;
      }

      weekHtml += `
        <div onclick="selectDateFromPlan('${dateStr}')" class="min-h-[58px] sm:min-h-[95px] p-1 sm:p-2 rounded-lg sm:rounded-xl border cursor-pointer calendar-tile flex flex-col justify-between transition ${cellBorderClass}">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold ${isToday ? 'px-1.5 py-0.2 rounded-full bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300'}">${d}</span>
            ${studyPassed && isStudyMode ? '<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500"></span>' : ''}
            ${wo.done && isWorkoutMode ? '<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></span>' : ''}
            ${slM >= targetSleepM && isSleepMode ? '<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500"></span>' : ''}
          </div>
          ${cellBodyHtml}
        </div>
      `;
    });

    // 8번째 칸 / 모바일 주간 합산 행 (col-span-7 sm:col-span-1)
    let weekSummaryHtml = '';
    const weekTargetStudyMins = (state.studyWeeklyTargetHours || 21) * 60;
    const isWeekStudyPassed = weekStudyMins >= weekTargetStudyMins;

    if (isStudyMode) {
      weekSummaryHtml = `
        <div class="col-span-7 sm:col-span-1 p-2 sm:p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r sm:bg-gradient-to-br from-indigo-50/90 to-blue-50/90 dark:from-slate-800 dark:to-indigo-950/40 flex items-center justify-between sm:flex-col sm:justify-between my-1 sm:my-0 shadow-sm">
          <div class="flex items-center gap-2 sm:block sm:w-full">
            <div class="flex items-center justify-between sm:w-full">
              <span class="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">📊 ${weekIdx + 1}주차 합산</span>
              <span class="hidden sm:inline text-[10px] font-extrabold px-1.5 py-0.2 rounded ${isWeekStudyPassed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}">
                ${isWeekStudyPassed ? '달성' : '미달'}
              </span>
            </div>
            <div class="text-sm sm:text-base font-extrabold text-indigo-900 dark:text-indigo-200 sm:mt-1">
              ${formatMinutes(weekStudyMins)}
            </div>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-right sm:text-left sm:w-full sm:mt-1">
            <span class="text-[10px] text-slate-500 hidden sm:block">목표: ${state.studyWeeklyTargetHours || 21}h</span>
            <span class="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded ${isWeekStudyPassed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}">
              ${isWeekStudyPassed ? '주간 목표 달성 🎉' : `${formatMinutes(weekTargetStudyMins - weekStudyMins)} 부족 ⚠️`}
            </span>
          </div>
        </div>
      `;
    } else if (isWorkoutMode) {
      weekSummaryHtml = `
        <div class="col-span-7 sm:col-span-1 p-2 sm:p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-slate-800 flex items-center justify-between sm:flex-col sm:justify-between my-1 sm:my-0 shadow-sm">
          <div class="flex items-center gap-2 sm:block sm:w-full">
            <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">🏃 ${weekIdx + 1}주차 운동</span>
            <div class="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200 sm:mt-1">${weekWorkoutDays}일 실천</div>
          </div>
          <div class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            총 ${weekWorkoutMins}분 운동
          </div>
        </div>
      `;
    } else if (isSleepMode) {
      const avgSleepW = weekSleepDays > 0 ? Math.round(weekSleepMins / weekSleepDays) : 0;
      weekSummaryHtml = `
        <div class="col-span-7 sm:col-span-1 p-2 sm:p-2.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-slate-800 flex items-center justify-between sm:flex-col sm:justify-between my-1 sm:my-0 shadow-sm">
          <div class="flex items-center gap-2 sm:block sm:w-full">
            <span class="text-[11px] font-bold text-purple-700 dark:text-purple-300">🛌 ${weekIdx + 1}주차 수면</span>
            <div class="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-200 sm:mt-1">평균 ${formatMinutes(avgSleepW)}</div>
          </div>
          <div class="text-xs font-semibold text-purple-700 dark:text-purple-300">
            충족: ${weekSleepPass}일
          </div>
        </div>
      `;
    } else if (isHabitMode) {
      weekSummaryHtml = `
        <div class="col-span-7 sm:col-span-1 p-2 sm:p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-slate-800 flex items-center justify-between sm:flex-col sm:justify-between my-1 sm:my-0 shadow-sm">
          <span class="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">🎯 ${weekIdx + 1}주차 실천</span>
          <div class="text-sm font-black text-indigo-600 dark:text-indigo-400">${weekHabitCount}/7일 완료</div>
        </div>
      `;
    } else {
      weekSummaryHtml = `
        <div class="col-span-7 sm:col-span-1 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800 flex items-center justify-between sm:flex-col sm:justify-between my-1 sm:my-0 text-xs shadow-sm">
          <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">📅 ${weekIdx + 1}주차 요약</span>
          <div class="flex items-center gap-2 sm:block text-[11px] text-slate-600 dark:text-slate-400">
            <span>📖 ${formatMinutes(weekStudyMins)}</span>
            <span class="sm:block">🏃 ${weekWorkoutDays}일</span>
          </div>
        </div>
      `;
    }

    gridHtml += weekHtml + weekSummaryHtml;
  });

  container.innerHTML = gridHtml;

  // 상단 요약 배너 및 범례 동적 업데이트
  renderCalendarModeSummaryBanner(mode, {
    monthTotalStudyMins,
    monthStudyTargetPassDays,
    monthWorkoutDays,
    monthWorkoutTotalMins,
    monthSleepPassDays,
    monthSleepFailDays,
    monthSleepTotalMins,
    monthSleepRecordedDays,
    habitMonthlyCount,
    currentHabit,
    totalDays
  });

  if (window.lucide) lucide.createIcons();
}

function renderCalendarModeSummaryBanner(mode, stats) {
  const banner = document.getElementById('cal-mode-summary-banner');
  const legend = document.getElementById('calendar-legend-container');
  if (!banner) return;

  if (mode === 'study') {
    const avgH = Math.round((stats.monthTotalStudyMins / stats.totalDays / 60) * 10) / 10;
    const weeklyTargetH = state.studyWeeklyTargetHours || 21;
    banner.className = 'p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm flex flex-wrap items-center justify-between gap-3';
    banner.innerHTML = `
      <div>
        <div class="text-xs text-blue-100 font-semibold uppercase">📚 이번 달 공부 관리 (주단위 합산 모드)</div>
        <div class="text-2xl font-black mt-1">총 ${formatMinutes(stats.monthTotalStudyMins)} 공부</div>
        <div class="text-xs text-blue-100 mt-1">
          일 평균: <strong>${avgH}시간</strong> | 일일목표(${state.studyTargetHours || 3}h) 달성: <strong>${stats.monthStudyTargetPassDays}일</strong> / ${stats.totalDays}일
        </div>
      </div>
      <div class="flex items-center gap-2 bg-white/15 px-3.5 py-2 rounded-xl backdrop-blur-xs">
        <div class="text-right">
          <span class="text-[11px] text-blue-100 block">주간 목표 설정:</span>
          <span class="text-sm font-extrabold text-white">주 ${weeklyTargetH}시간</span>
        </div>
        <button onclick="openGoalSettingsModal()" class="px-2 py-1 rounded bg-white text-indigo-600 text-xs font-bold hover:bg-blue-50 transition">
          변경
        </button>
      </div>
    `;
    if (legend) {
      legend.innerHTML = `
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span> 목표 달성</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> 미달</div>
        <div class="flex items-center gap-1"><span class="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">주간 합산</span> 우측 8번째 열</div>
      `;
    }
  } else if (mode === 'workout') {
    const woTargetM = getWorkoutTargetMinutes();
    banner.className = 'p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm flex flex-wrap items-center justify-between gap-3';
    banner.innerHTML = `
      <div>
        <div class="text-xs text-emerald-100 font-semibold uppercase">🏃 이번 달 운동 실천 달력 (하루 ${woTargetM}분 목표)</div>
        <div class="text-2xl font-black mt-1">${stats.monthWorkoutDays}일 실천 / 총 ${stats.monthWorkoutTotalMins}분 운동</div>
        <div class="text-xs text-emerald-100 mt-1">어떤 운동을 몇 분간 했는지 달력에서 확인하세요.</div>
      </div>
      <button onclick="openGoalSettingsModal()" class="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1">
        <i data-lucide="settings" class="w-3.5 h-3.5"></i>
        <span>목표 변경</span>
      </button>
    `;
    if (legend) {
      legend.innerHTML = `
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 운동 완료</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> 휴식 (X)</div>
      `;
    }
  } else if (mode === 'sleep') {
    const avgSleep = stats.monthSleepRecordedDays > 0 ? Math.round(stats.monthSleepTotalMins / stats.monthSleepRecordedDays) : 0;
    const sleepTargetText = getSleepTargetText();
    banner.className = 'p-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-sm flex flex-wrap items-center justify-between gap-3';
    banner.innerHTML = `
      <div>
        <div class="text-xs text-purple-100 font-semibold uppercase">🛌 이번 달 수면 패턴 (${sleepTargetText} 기준)</div>
        <div class="text-2xl font-black mt-1">평균 ${formatMinutes(avgSleep)}</div>
        <div class="text-xs text-purple-100 mt-1">
          ${sleepTargetText} 충족: <strong>${stats.monthSleepPassDays}일</strong> | 미달: <strong>${stats.monthSleepFailDays}일</strong>
        </div>
      </div>
      <button onclick="openGoalSettingsModal()" class="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1">
        <i data-lucide="settings" class="w-3.5 h-3.5"></i>
        <span>기준 변경</span>
      </button>
    `;
    if (legend) {
      legend.innerHTML = `
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ${sleepTargetText} 충족</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> ${sleepTargetText} 미달</div>
      `;
    }
  } else if (mode.startsWith('habit_') && stats.currentHabit) {
    const h = stats.currentHabit;
    const rate = Math.round((stats.habitMonthlyCount / stats.totalDays) * 100);
    banner.className = 'p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-sm flex flex-wrap items-center justify-between gap-3';
    banner.innerHTML = `
      <div>
        <div class="text-xs text-indigo-200 font-semibold uppercase">${h.icon} [${escapeHtml(h.title)}] 전용 실천 달력</div>
        <div class="text-2xl font-black mt-1">이번 달 ${stats.habitMonthlyCount}일 실천 (${rate}%)</div>
        <div class="text-xs text-indigo-200 mt-1">한 달 동안 꾸준히 실천한 날짜에 스탬프가 표시됩니다.</div>
      </div>
    `;
    if (legend) {
      legend.innerHTML = `
        <div class="flex items-center gap-1"><span class="text-sm">${h.icon}</span> 실천 완료 스탬프</div>
      `;
    }
  } else {
    banner.className = 'p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-slate-800 dark:text-slate-100';
    banner.innerHTML = `
      <div>
        <div class="text-xs text-slate-500 uppercase font-semibold">🔘 전체 통합 캘린더</div>
        <div class="text-sm font-bold mt-1">공부 시간, 운동, 7시간 수면을 날짜별로 함께 확인합니다. 상단 칩을 눌러 개별 항목 전용 달력으로 전환해보세요!</div>
      </div>
    `;
    if (legend) {
      legend.innerHTML = `
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 올킬 성실</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 부분 달성</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 미달/태만 주의</div>
      `;
    }
  }
}

function changeWeeklyStudyTargetPrompt() {
  const current = state.studyWeeklyTargetHours || 21;
  const input = prompt('주간 목표 공부 시간(시간 단위)을 입력하세요:', current);
  if (!input) return;
  const val = parseInt(input, 10);
  if (isNaN(val) || val <= 0) return;
  state.studyWeeklyTargetHours = val;
  saveData();
  renderMonthlyCalendar();
  renderWeeklyView();
}

// ==========================================
// 12-2. 커스텀 루틴/할 일 관리 모달 로직
// ==========================================
function openHabitManagerModal() {
  renderHabitManagerList();
  document.getElementById('habit-manager-modal').classList.add('modal-open');
}

function closeHabitManagerModal() {
  document.getElementById('habit-manager-modal').classList.remove('modal-open');
}

function handleCreateHabit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('new-habit-title');
  const catInput = document.getElementById('new-habit-category');
  const iconInput = document.getElementById('new-habit-icon');

  const title = titleInput.value.trim();
  if (!title) return;

  const newHabit = {
    id: 'hb_' + Date.now(),
    title: title,
    category: catInput.value,
    icon: iconInput.value,
    createdAt: Date.now()
  };

  state.customHabits.push(newHabit);
  saveData();

  titleInput.value = '';
  renderHabitManagerList();
  renderHabitChips();
  renderTodayView();
  alert(`'${title}' 루틴이 추가되었습니다! 오늘 할 일과 대형 달력에서 관리됩니다.`);
}

function deleteHabit(id) {
  if (confirm('이 루틴을 삭제하시겠습니까?')) {
    state.customHabits = state.customHabits.filter(h => h.id !== id);
    if (state.calendarMode === `habit_${id}`) {
      state.calendarMode = 'study';
    }
    saveData();
    renderHabitManagerList();
    renderHabitChips();
    renderMonthlyCalendar();
    renderTodayView();
  }
}

function renderHabitManagerList() {
  const container = document.getElementById('habit-manager-list');
  if (!container) return;

  if (state.customHabits.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
        등록된 추가 루틴이 없습니다. 위의 폼에서 추가해보세요!
      </div>
    `;
    return;
  }

  container.innerHTML = state.customHabits.map(h => `
    <div class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
      <div class="flex items-center gap-2">
        <span class="text-base">${h.icon}</span>
        <div>
          <span class="font-bold text-slate-800 dark:text-white">${escapeHtml(h.title)}</span>
          <span class="text-[10px] text-slate-400 block">${h.category}</span>
        </div>
      </div>
      <button onclick="deleteHabit('${h.id}')" class="text-slate-300 hover:text-rose-500 p-1">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}


// ==========================================
// 12-1. 월별 루틴 목표 (기간별 설정) 로직
// ==========================================
function openMonthlyGoalModal(goalId = null) {
  const modal = document.getElementById('monthly-goal-modal');
  const form = document.getElementById('monthly-goal-form');
  form.reset();

  const idInput = document.getElementById('monthly-goal-id');
  const titleInput = document.getElementById('monthly-goal-title');
  const catInput = document.getElementById('monthly-goal-cat');
  const startInput = document.getElementById('monthly-goal-start');
  const endInput = document.getElementById('monthly-goal-end');
  const trackInput = document.getElementById('monthly-goal-track-type');
  const targetDaysInput = document.getElementById('monthly-goal-target-days');

  // 현재 월간 뷰 기준 기본 시작일/종료일 계산
  const year = state.monthlyDate.getFullYear();
  const month = state.monthlyDate.getMonth();
  const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

  if (goalId) {
    const goal = state.monthlyGoals.find(g => g.id === goalId);
    if (goal) {
      idInput.value = goal.id;
      titleInput.value = goal.title || '';
      catInput.value = goal.category || '운동/건강';
      startInput.value = goal.startDate || firstDayStr;
      endInput.value = goal.endDate || lastDayStr;
      trackInput.value = goal.trackType || 'workout';
      targetDaysInput.value = goal.targetDays || 15;
    }
  } else {
    idInput.value = '';
    startInput.value = firstDayStr;
    endInput.value = lastDayStr;
    targetDaysInput.value = 15;
  }

  onTrackTypeChange(trackInput.value);
  modal.classList.add('modal-open');
}

function closeMonthlyGoalModal() {
  document.getElementById('monthly-goal-modal').classList.remove('modal-open');
}

function setGoalPeriodPreset(type) {
  const year = state.monthlyDate.getFullYear();
  const month = state.monthlyDate.getMonth();
  const mStr = String(month + 1).padStart(2, '0');
  const lastDayNum = new Date(year, month + 1, 0).getDate();

  const startInput = document.getElementById('monthly-goal-start');
  const endInput = document.getElementById('monthly-goal-end');

  if (type === 'full') {
    startInput.value = `${year}-${mStr}-01`;
    endInput.value = `${year}-${mStr}-${String(lastDayNum).padStart(2, '0')}`;
  } else if (type === 'firstHalf') {
    startInput.value = `${year}-${mStr}-01`;
    endInput.value = `${year}-${mStr}-15`;
  } else if (type === 'secondHalf') {
    startInput.value = `${year}-${mStr}-16`;
    endInput.value = `${year}-${mStr}-${String(lastDayNum).padStart(2, '0')}`;
  }
}

function onTrackTypeChange(val) {
  const hint = document.getElementById('monthly-goal-hint-text');
  if (val === 'workout') {
    hint.innerHTML = '💡 <strong>운동 기록 연동:</strong> 설정한 기간 중 매일 운동을 완료 체크할 때마다 자동으로 실천 일수가 카운트됩니다.';
  } else if (val === 'study') {
    hint.innerHTML = '💡 <strong>공부 기록 연동:</strong> 설정한 기간 중 공부 시간을 30분 이상 기록한 날이 자동으로 실천 일수로 카운트됩니다.';
  } else {
    hint.innerHTML = '💡 <strong>수동 스탬프 체크:</strong> 목표 카드에서 <strong>+1 실천</strong> 버튼을 직접 눌러 목표를 달성해 나갑니다.';
  }
}

function handleSaveMonthlyGoal(e) {
  e.preventDefault();
  const id = document.getElementById('monthly-goal-id').value;
  const title = document.getElementById('monthly-goal-title').value.trim();
  const category = document.getElementById('monthly-goal-cat').value;
  const startDate = document.getElementById('monthly-goal-start').value;
  const endDate = document.getElementById('monthly-goal-end').value;
  const trackType = document.getElementById('monthly-goal-track-type').value;
  const targetDays = parseInt(document.getElementById('monthly-goal-target-days').value, 10) || 1;

  if (startDate > endDate) {
    alert('시작일은 종료일보다 이전이어야 합니다.');
    return;
  }

  if (id) {
    // 수정
    const goal = state.monthlyGoals.find(g => g.id === id);
    if (goal) {
      goal.title = title;
      goal.category = category;
      goal.startDate = startDate;
      goal.endDate = endDate;
      goal.trackType = trackType;
      goal.targetDays = targetDays;
    }
  } else {
    // 신규 등록
    state.monthlyGoals.push({
      id: 'mg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: title,
      category: category,
      startDate: startDate,
      endDate: endDate,
      trackType: trackType,
      targetDays: targetDays,
      currentDays: 0,
      createdAt: Date.now()
    });
  }

  saveData();
  closeMonthlyGoalModal();
  renderMonthlyGoals();
  renderTodayActiveGoals();
  alert('월별 루틴 목표가 성공적으로 저장되었습니다!');
}

function deleteMonthlyGoal(id) {
  if (confirm('이 루틴 목표를 삭제하시겠습니까?')) {
    state.monthlyGoals = state.monthlyGoals.filter(g => g.id !== id);
    saveData();
    renderMonthlyGoals();
    renderTodayActiveGoals();
  }
}

function incrementManualGoal(id, amount = 1) {
  const goal = state.monthlyGoals.find(g => g.id === id);
  if (!goal) return;
  goal.currentDays = Math.max(0, (goal.currentDays || 0) + amount);
  saveData();
  renderMonthlyGoals();
  renderTodayActiveGoals();

  if (goal.currentDays >= goal.targetDays) {
    triggerCelebration('goal');
  }
}

function calcMonthlyGoalProgress(goal) {
  let count = 0;
  const start = new Date(goal.startDate + 'T00:00:00');
  const end = new Date(goal.endDate + 'T00:00:00');

  if (goal.trackType === 'workout') {
    // 운동 기록 연동: 기간 중 workout.done 인 날짜 수
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dtStr = getTodayString(d);
      if (state.records[dtStr]?.workout?.done) {
        count++;
      }
    }
  } else if (goal.trackType === 'study') {
    // 공부 기록 연동: 기간 중 30분 이상 공부한 날짜 수
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dtStr = getTodayString(d);
      if ((state.records[dtStr]?.studyMinutes || 0) >= 30) {
        count++;
      }
    }
  } else {
    // 수동 스탬프
    count = goal.currentDays || 0;
  }

  const target = Math.max(1, goal.targetDays || 1);
  const rate = Math.min(100, Math.round((count / target) * 100));
  const isCompleted = count >= target;

  return { count, target, rate, isCompleted };
}

function renderMonthlyGoals() {
  const container = document.getElementById('monthly-goals-container');
  if (!container) return;

  const year = state.monthlyDate.getFullYear();
  const month = state.monthlyDate.getMonth();
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // 해당 월에 걸쳐 있는 루틴 목표 필터링
  const list = state.monthlyGoals.filter(g => {
    return g.startDate.startsWith(currentMonthPrefix) || g.endDate.startsWith(currentMonthPrefix);
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700/80 rounded-2xl">
        <i data-lucide="compass" class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600"></i>
        <p class="text-xs">등록된 ${year}년 ${month + 1}월 루틴 목표가 없습니다.</p>
        <button onclick="openMonthlyGoalModal()" class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          + 이번 달 루틴 목표 첫 등록하기
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const catColors = {
    '운동/건강': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    '공부': 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    '수면/생활': 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    '루틴': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    '업무/자기계발': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
  };

  const trackLabels = {
    workout: '🏃 운동 자동 연동',
    study: '📚 공부 자동 연동',
    manual: '✋ 수동 스탬프'
  };

  container.innerHTML = list.map(goal => {
    const { count, target, rate, isCompleted } = calcMonthlyGoalProgress(goal);
    const catClass = catColors[goal.category] || catColors['루틴'];
    const trackLabel = trackLabels[goal.trackType] || '수동';

    return `
      <div class="p-4 rounded-xl border ${isCompleted ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/80'} flex flex-col justify-between shadow-sm hover:shadow transition">
        <div>
          <!-- 상단 뱃지 및 액션 -->
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border ${catClass}">
              ${goal.category}
            </span>
            <div class="flex items-center gap-1">
              <button onclick="openMonthlyGoalModal('${goal.id}')" class="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="수정">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteMonthlyGoal('${goal.id}')" class="p-1 text-slate-400 hover:text-rose-500 transition" title="삭제">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- 목표 제목 -->
          <h4 class="font-bold text-sm text-slate-800 dark:text-white mb-1.5 flex items-center gap-1.5">
            ${isCompleted ? '🎉 ' : ''}${escapeHtml(goal.title)}
          </h4>

          <!-- 기간 표시 -->
          <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-3">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>${goal.startDate} ~ ${goal.endDate}</span>
          </div>

          <!-- 프로그레스 바 -->
          <div class="space-y-1 mb-3">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-slate-600 dark:text-slate-300">${count} / ${target}일 실천</span>
              <span class="${isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-indigo-600 dark:text-indigo-400'}">${rate}%</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div class="${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'} h-full rounded-full transition-all duration-500" style="width: ${rate}%"></div>
            </div>
          </div>
        </div>

        <!-- 하단 연동 상태 / 조작 버튼 -->
        <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 flex items-center gap-1">
            ${trackLabel}
          </span>
          ${goal.trackType === 'manual' ? `
            <div class="flex items-center gap-1">
              <button onclick="incrementManualGoal('${goal.id}', -1)" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200">-1</button>
              <button onclick="incrementManualGoal('${goal.id}', 1)" class="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">+1 실천</button>
            </div>
          ` : `
            <span class="text-slate-400">${isCompleted ? '목표 달성완료!' : '기록 시 자동반영'}</span>
          `}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderTodayActiveGoals() {
  const container = document.getElementById('today-active-goals-list');
  const banner = document.getElementById('today-monthly-goals-banner');
  if (!container || !banner) return;

  const todayStr = state.currentDate;

  // 오늘 날짜가 기간(startDate ~ endDate)에 포함되는 목표들 필터링
  const activeGoals = state.monthlyGoals.filter(g => {
    return todayStr >= g.startDate && todayStr <= g.endDate;
  });

  if (activeGoals.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');

  container.innerHTML = activeGoals.map(goal => {
    const { count, target, rate, isCompleted } = calcMonthlyGoalProgress(goal);
    return `
      <div class="bg-white/90 dark:bg-slate-800/90 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-xs flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              ${goal.category}
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              ${escapeHtml(goal.title)}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div class="${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'} h-full rounded-full" style="width: ${rate}%"></div>
            </div>
            <span class="text-[10px] font-bold ${isCompleted ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'}">${count}/${target}일 (${rate}%)</span>
          </div>
        </div>
        ${goal.trackType === 'manual' ? `
          <button onclick="incrementManualGoal('${goal.id}', 1)" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition whitespace-nowrap">
            +1 체크
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}


// ==========================================
// 13. 통계 & 리포트 (TAB 3)
// ==========================================
function setStatsRange(days) {
  state.statsRange = days;
  [7, 14, 30].forEach(d => {
    const btn = document.getElementById(`stats-range-${d}`);
    if (d === days) {
      btn.className = 'px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-semibold';
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 font-semibold';
    }
  });
  renderStatsView();
}

function renderStatsView() {
  const range = state.statsRange;
  const dates = [];
  const today = new Date(state.todayDate + 'T00:00:00');

  for (let i = range - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    dates.push(getTodayString(d));
  }

  let totalStudyMins = 0;
  let studyTargetDaysCount = 0;
  let workoutDaysCount = 0;
  let workoutTotalMins = 0;
  let totalSleepMins = 0;
  let sleepRecordedDays = 0;
  let sleepPassDaysCount = 0;
  let sleepFailDaysCount = 0;

  const targetDailyStudyMins = (state.studyTargetHours || 3) * 60;
  const studyData = [];
  const sleepData = [];
  const labels = [];

  dates.forEach(dt => {
    const rec = state.records[dt] || {};
    const studyM = rec.studyMinutes || 0;
    totalStudyMins += studyM;
    if (studyM >= targetDailyStudyMins) {
      studyTargetDaysCount++;
    }
    studyData.push(Math.round((studyM / 60) * 10) / 10); // 시간 단위

    if (rec.workout && rec.workout.done) {
      workoutDaysCount++;
      workoutTotalMins += (rec.workout.duration || 0);
    }

    const sl = rec.sleep || {};
    const slM = sl.durationMinutes || 0;
    const targetSleepM = getSleepTargetMinutes();
    if (slM > 0) {
      totalSleepMins += slM;
      sleepRecordedDays++;
      if (slM >= targetSleepM) {
        sleepPassDaysCount++;
      } else {
        sleepFailDaysCount++;
      }
      sleepData.push(Math.round((slM / 60) * 10) / 10);
    } else {
      sleepData.push(0);
    }

    const dObj = new Date(dt + 'T00:00:00');
    labels.push(`${dObj.getMonth() + 1}/${dObj.getDate()}`);
  });

  // 1. 공부 지표 카드
  document.getElementById('stat-highlight-study').textContent = formatMinutes(totalStudyMins);
  const avgStudy = Math.round((totalStudyMins / range / 60) * 10) / 10;
  document.getElementById('stat-highlight-study-avg').textContent = `일 평균 ${avgStudy}시간 (목표 ${studyTargetDaysCount}/${range}일 달성)`;

  // 2. 운동 지표 카드
  document.getElementById('stat-highlight-workout').textContent = `${workoutDaysCount}일 / ${range}일 실천`;
  document.getElementById('stat-highlight-workout-rate').textContent = `총 ${workoutTotalMins}분 실천 (${Math.round((workoutDaysCount / range) * 100)}%)`;

  // 3. 수면 지표 카드 (사용자 지정 기준)
  const avgSleep = sleepRecordedDays > 0 ? Math.round(totalSleepMins / sleepRecordedDays) : 0;
  const sleepTargetText = getSleepTargetText();
  document.getElementById('stat-highlight-sleep').textContent = `평균 ${formatMinutes(avgSleep)}`;
  document.getElementById('stat-highlight-sleep-eval').textContent = `${sleepTargetText} 충족: ${sleepPassDaysCount}일 | 미달: ${sleepFailDaysCount}일`;

  // 4. 태만 방지 & 자기점검 지수
  const studyFailDays = range - studyTargetDaysCount;
  const workoutRestDays = range - workoutDaysCount;
  const slackingEl = document.getElementById('stat-highlight-slacking');
  const slackingDesc = document.getElementById('stat-highlight-slacking-desc');

  if (slackingEl && slackingDesc) {
    if (studyTargetDaysCount >= Math.floor(range * 0.7) && workoutDaysCount >= Math.floor(range * 0.5)) {
      slackingEl.textContent = '성실 실천 🔥';
      slackingEl.className = 'text-2xl font-bold mt-2 text-emerald-400';
      slackingDesc.textContent = `목표달성 ${studyTargetDaysCount}일 / 운동 ${workoutDaysCount}일 순항 중`;
    } else if (studyTargetDaysCount >= Math.floor(range * 0.4)) {
      slackingEl.textContent = '보통 실천 ⚡';
      slackingEl.className = 'text-2xl font-bold mt-2 text-amber-400';
      slackingDesc.textContent = `공부 미달 ${studyFailDays}일 / 운동 쉼 ${workoutRestDays}일`;
    } else {
      slackingEl.textContent = '태만 경고! 🚨';
      slackingEl.className = 'text-2xl font-bold mt-2 text-rose-400 animate-pulse';
      slackingDesc.textContent = `공부 미달 ${studyFailDays}일 / 운동 쉼 ${workoutRestDays}일 (자극 필요)`;
    }
  }

  // 차트 렌더링
  renderStudyChart(labels, studyData);
  renderSleepChart(labels, sleepData);
  renderCategoryChart(dates);
  renderStreakHeatmap();
  renderWorkoutHistory(dates);

  if (window.lucide) lucide.createIcons();
}

function renderWorkoutHistory(dates) {
  const container = document.getElementById('workout-history-container');
  const countEl = document.getElementById('workout-history-count');
  if (!container) return;

  const history = [];
  // 최신 날짜부터 역순 조회
  for (let i = dates.length - 1; i >= 0; i--) {
    const dtStr = dates[i];
    const rec = state.records[dtStr];
    if (rec && rec.workout && rec.workout.done) {
      history.push({
        date: dtStr,
        ...rec.workout
      });
    }
  }

  if (countEl) countEl.textContent = `총 ${history.length}회 실천`;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        <i data-lucide="dumbbell" class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600"></i>
        <p class="text-xs">선택한 기간 동안 기록된 운동 내역이 없습니다. 오늘부터 운동을 시작해보세요!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    return `
      <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between hover:border-emerald-300 transition">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${item.date}</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              ${item.duration || 0}분 실천
            </span>
          </div>
          <div class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5 mb-1">
            <i data-lucide="dumbbell" class="w-4 h-4 text-emerald-500"></i>
            <span>${escapeHtml(item.type || '운동')}</span>
          </div>
          ${item.note ? `
            <p class="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700/60 mt-1 line-clamp-2">
              ${escapeHtml(item.note)}
            </p>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderStudyChart(labels, data) {
  const ctx = document.getElementById('studyTimeChart').getContext('2d');
  if (studyChart) studyChart.destroy();

  const isDark = state.darkMode;
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  studyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '공부 시간 (시간)',
        data: data,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        hoverBackgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => v + 'h' }
        }
      }
    }
  });
}

function renderSleepChart(labels, data) {
  const ctx = document.getElementById('sleepPatternChart').getContext('2d');
  if (sleepChart) sleepChart.destroy();

  const isDark = state.darkMode;
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  sleepChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '수면 시간 (시간)',
          data: data,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#a855f7',
          pointRadius: 4
        },
        {
          label: '7시간 기준선',
          data: labels.map(() => 7),
          borderColor: '#ef4444',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, font: { size: 10 }, boxWidth: 12 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => v + 'h' }
        }
      }
    }
  });
}

function renderCategoryChart(dates) {
  const ctx = document.getElementById('todoCategoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();

  const counts = { '공부': 0, '운동/건강': 0, '업무/과제': 0, '루틴': 0, '기타': 0 };
  state.todos.forEach(t => {
    if (dates.includes(t.date) && t.completed) {
      if (counts[t.category] !== undefined) counts[t.category]++;
      else counts['기타']++;
    }
  });

  const isDark = state.darkMode;
  const textColor = isDark ? '#cbd5e1' : '#475569';

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
        borderWidth: 2,
        borderColor: isDark ? '#1e293b' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
        }
      }
    }
  });
}

function renderStreakHeatmap() {
  const container = document.getElementById('streak-heatmap-container');
  const today = new Date(state.todayDate + 'T00:00:00');
  let html = '';

  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const dateStr = getTodayString(d);
    const dayRec = state.records[dateStr] || {};
    const dayTodos = state.todos.filter(t => t.date === dateStr);
    const completed = dayTodos.filter(t => t.completed).length;

    let score = 0;
    if (dayTodos.length > 0) score += (completed / dayTodos.length) * 50;
    if (dayRec.studyMinutes >= 60) score += 30;
    if (dayRec.workout && dayRec.workout.done) score += 20;

    let bgClass = 'bg-slate-100 dark:bg-slate-800 text-slate-400';
    if (score >= 80) bgClass = 'bg-emerald-500 text-white font-bold';
    else if (score >= 50) bgClass = 'bg-emerald-400 text-white font-bold';
    else if (score >= 20) bgClass = 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-semibold';

    html += `
      <div onclick="selectDateFromPlan('${dateStr}')" title="${dateStr} (달성점수: ${Math.round(score)}점)" class="streak-cell h-10 rounded-lg ${bgClass} flex flex-col items-center justify-center cursor-pointer text-[10px]">
        <span>${d.getDate()}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderAllCharts() {
  if (state.activeTab === 'stats') {
    renderStatsView();
  }
}

// ==========================================
// 14. 축하 애니메이션 (Confetti)
// ==========================================
function triggerCelebration(type) {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 }
    });
  }
}

// ==========================================
// 14.5. 루틴별 목표 달성 기준 설정 모달 제어
// ==========================================
function openGoalSettingsModal() {
  const modal = document.getElementById('goal-settings-modal');
  if (!modal) return;

  const studyDailyInput = document.getElementById('setting-study-daily-hours');
  const studyWeeklyInput = document.getElementById('setting-study-weekly-hours');
  const sleepHoursInput = document.getElementById('setting-sleep-target-hours');
  const sleepMinsInput = document.getElementById('setting-sleep-target-mins');
  const workoutMinsInput = document.getElementById('setting-workout-target-mins');
  const workoutDaysInput = document.getElementById('setting-workout-target-days');

  if (studyDailyInput) studyDailyInput.value = state.studyTargetHours || 3;
  if (studyWeeklyInput) studyWeeklyInput.value = state.studyWeeklyTargetHours || 21;
  if (sleepHoursInput) sleepHoursInput.value = state.sleepTargetHours ?? 7;
  if (sleepMinsInput) sleepMinsInput.value = state.sleepTargetMins ?? 0;
  if (workoutMinsInput) workoutMinsInput.value = state.workoutTargetMinutes ?? 40;
  if (workoutDaysInput) workoutDaysInput.value = state.workoutWeeklyTargetDays ?? 4;

  modal.classList.add('modal-open');
  if (window.lucide) lucide.createIcons();
}

function closeGoalSettingsModal() {
  const modal = document.getElementById('goal-settings-modal');
  if (modal) modal.classList.remove('modal-open');
}

function setGoalStudyPreset(dailyH, weeklyH) {
  const dailyEl = document.getElementById('setting-study-daily-hours');
  const weeklyEl = document.getElementById('setting-study-weekly-hours');
  if (dailyEl) dailyEl.value = dailyH;
  if (weeklyEl) weeklyEl.value = weeklyH;
}

function setGoalSleepPreset(h, m) {
  const hEl = document.getElementById('setting-sleep-target-hours');
  const mEl = document.getElementById('setting-sleep-target-mins');
  if (hEl) hEl.value = h;
  if (mEl) mEl.value = m;
}

function setGoalWorkoutPreset(mins, days) {
  const minsEl = document.getElementById('setting-workout-target-mins');
  const daysEl = document.getElementById('setting-workout-target-days');
  if (minsEl) minsEl.value = mins;
  if (daysEl) daysEl.value = days;
}

function handleSaveGoalSettings(e) {
  if (e) e.preventDefault();

  const studyH = parseInt(document.getElementById('setting-study-daily-hours')?.value, 10);
  const studyWH = parseInt(document.getElementById('setting-study-weekly-hours')?.value, 10);
  const sleepH = parseInt(document.getElementById('setting-sleep-target-hours')?.value, 10);
  const sleepM = parseInt(document.getElementById('setting-sleep-target-mins')?.value, 10) || 0;
  const workoutMins = parseInt(document.getElementById('setting-workout-target-mins')?.value, 10);
  const workoutDays = parseInt(document.getElementById('setting-workout-target-days')?.value, 10);

  if (!isNaN(studyH) && studyH > 0) state.studyTargetHours = studyH;
  if (!isNaN(studyWH) && studyWH > 0) state.studyWeeklyTargetHours = studyWH;
  if (!isNaN(sleepH) && sleepH >= 0) state.sleepTargetHours = sleepH;
  if (!isNaN(sleepM) && sleepM >= 0) state.sleepTargetMins = sleepM;
  if (!isNaN(workoutMins) && workoutMins > 0) state.workoutTargetMinutes = workoutMins;
  if (!isNaN(workoutDays) && workoutDays > 0) state.workoutWeeklyTargetDays = workoutDays;

  saveData();
  closeGoalSettingsModal();

  // 모든 뷰 동기화 갱신
  if (state.activeTab === 'today') {
    renderTodayView();
  } else if (state.activeTab === 'plan') {
    renderPlanView();
  } else if (state.activeTab === 'stats') {
    renderStatsView();
  }

  triggerCelebration('discipline');
  showToast(`🎯 목표 기준 저장 완료! (공부 ${state.studyTargetHours}h / 수면 ${getSleepTargetText()} / 운동 ${state.workoutTargetMinutes}m)`, 'success');
}

// ==========================================
// 15. 데이터 백업 / 복원 / 샘플 로드
// ==========================================
function openDataModal() {
  document.getElementById('data-modal').classList.add('modal-open');
}

function closeDataModal() {
  document.getElementById('data-modal').classList.remove('modal-open');
}

function loadSampleData() {
  if (!confirm('최근 7일간의 예시 데이터(공부, 운동, 수면, 할 일)를 생성하시겠습니까? 기존 기록에 추가됩니다.')) return;

  const today = new Date(state.todayDate + 'T00:00:00');
  const sampleTasks = [
    { cat: '공부', titles: ['알고리즘 문제 2개 풀기', '영어 회화 30분', '기술 블로그 포스팅 작성'] },
    { cat: '운동/건강', titles: ['하체 웨이트 트레이닝 50분', '공원 런닝 3km', '폼롤러 스트레칭'] },
    { cat: '업무/과제', titles: ['프로젝트 기획안 작성', '주간 업무 미팅', '코드 리뷰'] },
    { cat: '루틴', titles: ['비타민 & 영양제 챙겨먹기', '물 2L 마시기', '독서 20페이지'] }
  ];

  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const dateStr = getTodayString(d);

    // 공부 시간 (60 ~ 240분)
    const studyMins = [90, 120, 180, 60, 210, 150, 180][i];
    // 운동 샘플 (어떤 운동을 얼만큼 했는지 상세)
    const workoutSamples = [
      { type: '헬스 (하체 웨이트)', duration: 60, note: '스쿼트 5세트, 레그프레스 4세트, 런지' },
      { type: '야외 러닝', duration: 40, note: '공원 트랙 5.2km 완주 (페이스 5분30초)' },
      { type: '휴식 (운동 쉼)', duration: 0, note: '' },
      { type: '헬스 (가슴 & 삼두)', duration: 55, note: '벤치프레스 5세트, 덤벨 인클라인, 딥스' },
      { type: '맨몸 홈트레이닝', duration: 35, note: '풀업 5세트, 푸쉬업 100개, 복근 크런치' },
      { type: '휴식 (운동 쉼)', duration: 0, note: '' },
      { type: '헬스 (등 & 이두)', duration: 65, note: '데드리프트 5세트, 랫풀다운, 바벨로우' }
    ];

    const currentWorkout = workoutSamples[i % workoutSamples.length];
    const woDone = currentWorkout.duration > 0;

    // 수면 시간 (7시간 = 420분 기준 충족 및 미달)
    const sleepMins = [450, 480, 380, 420, 510, 360, 440][i];

    state.records[dateStr] = {
      studyMinutes: studyMins,
      workout: {
        done: woDone,
        type: woDone ? currentWorkout.type : '',
        duration: currentWorkout.duration,
        note: currentWorkout.note
      },
      sleep: {
        bedtime: '23:30',
        waketime: '07:00',
        durationMinutes: sleepMins
      },
      note: `${dateStr} 목표 실천 완료`
    };

    // 할 일 샘플 3개 생성
    sampleTasks.forEach((grp, idx) => {
      const taskTitle = grp.titles[i % grp.titles.length];
      state.todos.push({
        id: 'sample_' + dateStr + '_' + idx,
        date: dateStr,
        title: taskTitle,
        category: grp.cat,
        estMin: 30,
        completed: (i + idx) % 2 === 0,
        createdAt: Date.now() - i * 86400000
      });
    });
  }

  // 주간 목표 추가
  const weekKey = getWeekKey(state.todayDate);
  if (!state.weeklyGoals.some(g => g.weekKey === weekKey)) {
    state.weeklyGoals.push(
      { id: 'wg_sample_1', weekKey: weekKey, text: '주 4회 이상 운동하기 (헬스/런닝)', completed: true },
      { id: 'wg_sample_2', weekKey: weekKey, text: '총 공부 시간 15시간 달성', completed: false },
      { id: 'wg_sample_3', weekKey: weekKey, text: '하루 7시간 이상 규칙적인 수면', completed: true }
    );
  }

  // 월별 루틴 목표 샘플 추가
  const year = today.getFullYear();
  const month = today.getMonth();
  const mStr = String(month + 1).padStart(2, '0');
  const lastDayNum = new Date(year, month + 1, 0).getDate();

  if (state.monthlyGoals.length === 0) {
    state.monthlyGoals.push(
      {
        id: 'mg_sample_1',
        title: '이번 달 운동 15일 이상 출석하기',
        category: '운동/건강',
        startDate: `${year}-${mStr}-01`,
        endDate: `${year}-${mStr}-${lastDayNum}`,
        trackType: 'workout',
        targetDays: 15,
        currentDays: 0,
        createdAt: Date.now()
      },
      {
        id: 'mg_sample_2',
        title: '월간 자격증/코딩 공부 12일 달성',
        category: '공부',
        startDate: `${year}-${mStr}-01`,
        endDate: `${year}-${mStr}-${lastDayNum}`,
        trackType: 'study',
        targetDays: 12,
        currentDays: 0,
        createdAt: Date.now()
      },
      {
        id: 'mg_sample_3',
        title: '아침 기상 후 물 한잔 & 스트레칭',
        category: '루틴',
        startDate: `${year}-${mStr}-01`,
        endDate: `${year}-${mStr}-15`,
        trackType: 'manual',
        targetDays: 10,
        currentDays: 6,
        createdAt: Date.now()
      }
    );
  }

  // 커스텀 루틴 샘플 추가
  if (state.customHabits.length === 0) {
    state.customHabits.push(
      { id: 'hb_sample_1', title: '매일 독서 30분', category: '독서/자기계발', icon: '📖', createdAt: Date.now() },
      { id: 'hb_sample_2', title: '비타민 & 영양제 복용', category: '건강/식습관', icon: '💊', createdAt: Date.now() },
      { id: 'hb_sample_3', title: '물 2L 마시기', category: '생활습관', icon: '💧', createdAt: Date.now() }
    );
  }

  saveData();
  closeDataModal();
  renderTodayView();
  renderPlanView();
  alert('샘플 데이터가 성공적으로 생성되었습니다! 주간·월간 계획 및 통계 탭에서 확인해보세요.');
}

function exportDataJson() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(localStorage.getItem(STORAGE_KEY) || '{}');
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `DailyRoutine_Backup_${state.todayDate}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function importDataJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed.records || parsed.todos) {
        state.records = parsed.records || {};
        state.todos = parsed.todos || [];
        state.weeklyGoals = parsed.weeklyGoals || [];
        state.monthlyGoals = parsed.monthlyGoals || [];
        state.customHabits = parsed.customHabits || [];
        state.studyWeeklyTargetHours = parsed.studyWeeklyTargetHours || 21;
        saveData();
        closeDataModal();
        renderTodayView();
        renderPlanView();
        alert('백업 파일로부터 데이터가 성공적으로 복원되었습니다.');
      } else {
        alert('올바르지 않은 백업 파일 형식입니다.');
      }
    } catch (err) {
      alert('파일을 파싱하는 중 오류가 발생했습니다.');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm('정말로 모든 기록(할일, 공부, 운동, 수면 등)을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    localStorage.removeItem(STORAGE_KEY);
    state.records = {};
    state.todos = [];
    state.weeklyGoals = [];
    state.monthlyGoals = [];
    state.customHabits = [];
    closeDataModal();
    renderTodayView();
    renderPlanView();
    alert('모든 데이터가 초기화되었습니다.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// ==========================================
// 16. 페이지 로드 초기화
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  goToToday();
  if (window.lucide) lucide.createIcons();
});
