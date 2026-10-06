import {
  subscribeAttendees,
  addAttendeeDoc,
  deleteAttendeeDoc,
  resetAllAttendees,
  batchAddAttendees,
  subscribeSettings,
  saveSettingDoc,
  testFirestoreConnection,
  getLatestAttendees,
  getFirestoreConfigInfo
} from './firebase';
import { Attendee, ClassCounts, ClassCapacities, HomeButtonConfig } from './types';
import * as d3 from 'd3';

// Constants: Middle school grade class counts
const DEFAULT_CLASS_COUNTS: ClassCounts = {
  1: 8,
  2: 10,
  3: 9
};

const GRADE_CONFIG: { [grade: number]: { name: string; maxClass: number } } = {
  1: { name: '1학년', maxClass: 8 },
  2: { name: '2학년', maxClass: 10 },
  3: { name: '3학년', maxClass: 9 }
};

const STORAGE_KEY = 'ms_open_class_attendees_v2';
const CAPACITY_STORAGE_KEY = 'ms_open_class_capacities_v2';
const CLASS_COUNT_STORAGE_KEY = 'ms_open_class_counts_v2';
const SCHOOL_NAME_STORAGE_KEY = 'ms_open_school_name_v2';
const HOME_BUTTON_STORAGE_KEY = 'ms_open_class_home_button_v1';
const ADMIN_PASSWORD = '3000';

const DEFAULT_HOME_BUTTON_CONFIG: HomeButtonConfig = {
  enabled: true,
  text: '공개수업 홈으로 이동',
  url: '',
  target: '_self'
};

let homeButtonConfig: HomeButtonConfig = { ...DEFAULT_HOME_BUTTON_CONFIG };

// Default Student Capacities (Middle school 1~3 grades)
const DEFAULT_CAPACITIES: ClassCapacities = {
  1: { 1: 25, 2: 25, 3: 25, 4: 25, 5: 25, 6: 25, 7: 25, 8: 25 },
  2: { 1: 25, 2: 25, 3: 25, 4: 25, 5: 25, 6: 25, 7: 25, 8: 25, 9: 25, 10: 25 },
  3: { 1: 25, 2: 25, 3: 25, 4: 25, 5: 25, 6: 25, 7: 25, 8: 25, 9: 25 }
};

let attendees: Attendee[] = [];
let gradeClassCounts: ClassCounts = { ...DEFAULT_CLASS_COUNTS };
let classCapacities: ClassCapacities = JSON.parse(JSON.stringify(DEFAULT_CAPACITIES));
let schoolName = '';
let selectedGradeInForm: number | null = 1;
let selectedClassInForm: number | null = 1;
let isAdminLoggedIn = false;

// DOM Elements
const appSubtitle = document.getElementById('app-subtitle') as HTMLElement | null;
const appTitleText = document.getElementById('app-title-text') as HTMLElement | null;
const adminSchoolBadge = document.getElementById('admin-school-badge') as HTMLElement | null;
const adminSchoolNameInput = document.getElementById('admin-school-name-input') as HTMLInputElement | null;
const btnAdminSaveSchool = document.getElementById('btn-admin-save-school') as HTMLButtonElement | null;
const adminSchoolSaveIndicator = document.getElementById('admin-school-save-indicator') as HTMLElement | null;
const modalSchoolNameInput = document.getElementById('modal-school-name-input') as HTMLInputElement | null;

// Real-time Cloud Sync Elements
const syncBadge = document.getElementById('sync-badge') as HTMLElement | null;
const syncDot = document.getElementById('sync-dot') as HTMLElement | null;
const syncStatusText = document.getElementById('sync-status-text') as HTMLElement | null;
const adminCloudIndicator = document.getElementById('admin-cloud-indicator') as HTMLElement | null;

// Parent View Elements
const viewParent = document.getElementById('view-parent') as HTMLElement;
const viewAdmin = document.getElementById('view-admin') as HTMLElement;
const btnToggleAdminMode = document.getElementById('btn-toggle-admin-mode') as HTMLButtonElement;
const adminModeText = document.getElementById('admin-mode-text') as HTMLElement;

const parentForm = document.getElementById('parent-attendee-form') as HTMLFormElement;
const classChipContainer = document.getElementById('class-chip-container') as HTMLElement;
const currentGradeClassInfo = document.getElementById('current-grade-class-info') as HTMLElement;
const studentNameInput = document.getElementById('student-name-input') as HTMLInputElement;
const relChkOther = document.getElementById('rel-chk-other') as HTMLInputElement;
const otherInputWrap = document.getElementById('other-input-wrap') as HTMLElement;
const otherDetailText = document.getElementById('other-detail-text') as HTMLInputElement;
const parentFormError = document.getElementById('parent-form-error') as HTMLElement;
const successCompleteCard = document.getElementById('success-complete-card') as HTMLElement;
const completeStudentTitle = document.getElementById('complete-student-title') as HTMLElement;
const completeStudentDesc = document.getElementById('complete-student-desc') as HTMLElement;
const btnContinueRegister = document.getElementById('btn-continue-register') as HTMLButtonElement;

// Admin Elements
const btnExitAdmin = document.getElementById('btn-exit-admin') as HTMLButtonElement;
const statTotalRate = document.getElementById('stat-total-rate') as HTMLElement;
const statRateSub = document.getElementById('stat-rate-sub') as HTMLElement;
const statTotalAttendees = document.getElementById('stat-total-attendees') as HTMLElement;
const statUniqueStudents = document.getElementById('stat-unique-students') as HTMLElement;
const statUniqueStudentsUnit = document.getElementById('stat-unique-students-unit') as HTMLElement;
const statTotalRecords = document.getElementById('stat-total-records') as HTMLElement;
const matrixTotalClassesLabel = document.getElementById('matrix-total-classes-label') as HTMLElement;
const matrixTotalCapLabel = document.getElementById('matrix-total-cap-label') as HTMLElement;
const btnMatrixEditCap = document.getElementById('btn-matrix-edit-cap') as HTMLButtonElement;
const btnOpenCapacityModal = document.getElementById('btn-open-capacity-modal') as HTMLButtonElement;
const allGradeMatrixThead = document.getElementById('all-grade-matrix-thead') as HTMLElement;
const allGradeMatrixTbody = document.getElementById('all-grade-matrix-tbody') as HTMLElement;
const adminAttendeesTbody = document.getElementById('admin-attendees-tbody') as HTMLElement;
const filteredRecordsCount = document.getElementById('filtered-records-count') as HTMLElement;
const adminFilterGrade = document.getElementById('admin-filter-grade') as HTMLSelectElement;
const adminFilterClass = document.getElementById('admin-filter-class') as HTMLSelectElement;
const adminFilterSearch = document.getElementById('admin-filter-search') as HTMLInputElement;
const btnExportGsheet = document.getElementById('btn-export-gsheet') as HTMLButtonElement;
const btnExportCsv = document.getElementById('btn-export-csv') as HTMLButtonElement;
const btnExportStatsCsv = document.getElementById('btn-export-stats-csv') as HTMLButtonElement;
const btnExportPdf = document.getElementById('btn-export-pdf') as HTMLButtonElement | null;
const btnSampleData = document.getElementById('btn-sample-data') as HTMLButtonElement;
const btnAdminResetAll = document.getElementById('btn-admin-reset-all') as HTMLButtonElement;

// D3 Graphical Visualization Elements & State
const chartOverallGauge = document.getElementById('chart-overall-gauge') as HTMLElement | null;
const chartGaugeRateText = document.getElementById('chart-gauge-rate-text') as HTMLElement | null;
const chartGaugeSubText = document.getElementById('chart-gauge-sub-text') as HTMLElement | null;
const chartGradeSummaryCards = document.getElementById('chart-grade-summary-cards') as HTMLElement | null;
const d3TrendChart = document.getElementById('d3-trend-chart') as HTMLElement | null;
const d3ChartTooltip = document.getElementById('d3-chart-tooltip') as HTMLElement | null;
const chartLegendRow = document.getElementById('chart-legend-row') as HTMLElement | null;

let activeChartMode: 'rate' | 'count' | 'grade' = 'rate';
let activeChartGradeFilter: 'all' | 1 | 2 | 3 = 'all';

// Modals
const modalPassword = document.getElementById('modal-password') as HTMLElement;
const adminPasswordInput = document.getElementById('admin-password-input') as HTMLInputElement;
const adminPasswordError = document.getElementById('admin-password-error') as HTMLElement;
const btnCancelPwd = document.getElementById('btn-cancel-pwd') as HTMLButtonElement;
const btnConfirmPwd = document.getElementById('btn-confirm-pwd') as HTMLButtonElement;

const modalCapacity = document.getElementById('modal-capacity') as HTMLElement;
const batchCapacityInput = document.getElementById('batch-capacity-input') as HTMLInputElement;
const btnBatchApplyCapacity = document.getElementById('btn-batch-apply-capacity') as HTMLButtonElement;
const classCountGrade1 = document.getElementById('class-count-grade-1') as HTMLInputElement;
const classCountGrade2 = document.getElementById('class-count-grade-2') as HTMLInputElement;
const classCountGrade3 = document.getElementById('class-count-grade-3') as HTMLInputElement;
const capSumClasses = document.getElementById('cap-sum-classes') as HTMLElement;
const capacityGridGrade1 = document.getElementById('capacity-grid-grade-1') as HTMLElement;
const capacityGridGrade2 = document.getElementById('capacity-grid-grade-2') as HTMLElement;
const capacityGridGrade3 = document.getElementById('capacity-grid-grade-3') as HTMLElement;
const capSumTotal = document.getElementById('cap-sum-total') as HTMLElement;
const btnCancelCapacity = document.getElementById('btn-cancel-capacity') as HTMLButtonElement;
const btnSaveCapacity = document.getElementById('btn-save-capacity') as HTMLButtonElement;

const modalResetConfirm = document.getElementById('modal-reset-confirm') as HTMLElement;
const btnCancelReset = document.getElementById('btn-cancel-reset') as HTMLButtonElement;
const btnDoReset = document.getElementById('btn-do-reset') as HTMLButtonElement;
const resetModalAttendeeCount = document.getElementById('reset-modal-attendee-count') as HTMLElement | null;

const modalGsheetGuide = document.getElementById('modal-gsheet-guide') as HTMLElement;
const btnCloseGsheetModal = document.getElementById('btn-close-gsheet-modal') as HTMLButtonElement;
const btnConfirmGsheetDownload = document.getElementById('btn-confirm-gsheet-download') as HTMLButtonElement;

// Modal Close X Buttons
const btnClosePwdX = document.getElementById('btn-close-pwd-x') as HTMLButtonElement | null;
const btnCloseCapacityX = document.getElementById('btn-close-capacity-x') as HTMLButtonElement | null;
const btnCloseResetX = document.getElementById('btn-close-reset-x') as HTMLButtonElement | null;
const btnCloseGsheetX = document.getElementById('btn-close-gsheet-x') as HTMLButtonElement | null;
const btnCloseHomeLinkX = document.getElementById('btn-close-homelink-x') as HTMLButtonElement | null;

// Home Link Button & Modal DOM Elements
const btnOpenClassHome = document.getElementById('btn-open-class-home') as HTMLAnchorElement | null;
const btnOpenClassHomeText = document.getElementById('btn-open-class-home-text') as HTMLElement | null;
const btnOpenHomeLinkModal = document.getElementById('btn-open-homelink-modal') as HTMLButtonElement | null;
const modalHomeLink = document.getElementById('modal-homelink') as HTMLElement | null;
const btnCancelHomeLink = document.getElementById('btn-cancel-homelink') as HTMLButtonElement | null;
const btnSaveHomeLink = document.getElementById('btn-save-homelink') as HTMLButtonElement | null;
const homelinkEnableCheckbox = document.getElementById('homelink-enable-checkbox') as HTMLInputElement | null;
const homelinkTextInput = document.getElementById('homelink-text-input') as HTMLInputElement | null;
const homelinkUrlInput = document.getElementById('homelink-url-input') as HTMLInputElement | null;
const homelinkPreviewBtn = document.getElementById('homelink-preview-btn') as HTMLElement | null;
const homelinkPreviewText = document.getElementById('homelink-preview-text') as HTMLElement | null;

// Toast
const toastPopup = document.getElementById('toast-popup') as HTMLElement;

function showToast(msg: string) {
  if (!toastPopup) return;
  toastPopup.textContent = msg;
  toastPopup.classList.add('show');
  setTimeout(() => {
    toastPopup.classList.remove('show');
  }, 2400);
}

// Cloud Sync Status Indicator
function updateSyncStatus(connected: boolean, message?: string) {
  if (syncDot) {
    if (connected) {
      syncDot.classList.remove('offline');
    } else {
      syncDot.classList.add('offline');
    }
  }
  if (syncStatusText) {
    syncStatusText.textContent = message || (connected ? '클라우드 실시간 동기화 중' : '클라우드 재연결 중...');
  }
  if (adminCloudIndicator) {
    adminCloudIndicator.textContent = connected ? '🟢 실시간 다중 기기 자동 동기화 활성' : '🟡 클라우드 재연결 중...';
  }
}

// --- School Name Management (Admin Managed) ---
function loadSchoolName() {
  try {
    const saved = localStorage.getItem(SCHOOL_NAME_STORAGE_KEY);
    schoolName = saved ? saved.trim() : '';
  } catch (e) {
    schoolName = '';
  }
  updateSchoolNameDisplay();
}

function saveSchoolName(name?: string, showToastMsg = false) {
  if (name !== undefined) {
    schoolName = String(name).trim();
  } else if (adminSchoolNameInput) {
    schoolName = adminSchoolNameInput.value.trim();
  }
  try {
    localStorage.setItem(SCHOOL_NAME_STORAGE_KEY, schoolName);
  } catch (e) {
    console.error('Failed to save school name to localStorage', e);
  }
  updateSchoolNameDisplay();

  // Save to Cloud Firestore for other devices
  saveSettingDoc('schoolName', schoolName).catch((err) => {
    console.error('Failed to sync school name to Cloud Firestore', err);
  });

  if (adminSchoolSaveIndicator) {
    adminSchoolSaveIndicator.classList.add('show');
    setTimeout(() => {
      adminSchoolSaveIndicator.classList.remove('show');
    }, 2000);
  }

  if (showToastMsg) {
    if (schoolName) {
      showToast(`학교명이 '${schoolName}'(으)로 등록·반영되었습니다.`);
    } else {
      showToast('학교명이 초기화되었습니다.');
    }
  }
}

function updateSchoolNameDisplay() {
  if (schoolName) {
    document.title = `${schoolName} 학부모 공개수업 등록`;
    if (appTitleText) {
      appTitleText.textContent = `${schoolName} 학부모 공개수업 등록`;
    }
    if (appSubtitle) {
      appSubtitle.textContent = `${schoolName} 공개수업에 참석해주신 학부모님을 환영합니다. 학생 정보를 입력해주세요.`;
    }
    if (adminSchoolBadge) {
      adminSchoolBadge.textContent = schoolName;
      adminSchoolBadge.style.display = 'inline-block';
    }
  } else {
    document.title = '중학교 학부모 공개수업 등록';
    if (appTitleText) {
      appTitleText.textContent = '중학교 학부모 공개수업 등록';
    }
    if (appSubtitle) {
      appSubtitle.textContent = '공개수업에 참석해주신 학부모님을 환영합니다. 학생 정보를 입력해주세요.';
    }
    if (adminSchoolBadge) {
      adminSchoolBadge.textContent = '';
      adminSchoolBadge.style.display = 'none';
    }
  }

  if (adminSchoolNameInput && adminSchoolNameInput !== document.activeElement) {
    adminSchoolNameInput.value = schoolName;
  }
  if (modalSchoolNameInput && modalSchoolNameInput !== document.activeElement) {
    modalSchoolNameInput.value = schoolName;
  }
}

// --- Open Class Home Button & Link Management ---
function normalizeHomeUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function loadHomeButtonConfig() {
  try {
    const raw = localStorage.getItem(HOME_BUTTON_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      homeButtonConfig = {
        enabled: parsed.enabled !== false,
        text: (parsed.text && typeof parsed.text === 'string' && parsed.text.trim()) ? parsed.text.trim() : DEFAULT_HOME_BUTTON_CONFIG.text,
        url: (parsed.url && typeof parsed.url === 'string') ? parsed.url.trim() : '',
        target: parsed.target === '_blank' ? '_blank' : '_self'
      };
    } else {
      homeButtonConfig = { ...DEFAULT_HOME_BUTTON_CONFIG };
    }
  } catch (e) {
    homeButtonConfig = { ...DEFAULT_HOME_BUTTON_CONFIG };
  }
  updateHomeButtonUI();
}

function saveHomeButtonConfigLocally() {
  try {
    localStorage.setItem(HOME_BUTTON_STORAGE_KEY, JSON.stringify(homeButtonConfig));
  } catch (e) {
    console.error('Failed to save home button config to localStorage', e);
  }
}

function updateHomeButtonUI() {
  if (!btnOpenClassHome) return;

  if (homeButtonConfig.enabled === false) {
    btnOpenClassHome.style.display = 'none';
  } else {
    btnOpenClassHome.style.display = 'inline-flex';
  }

  if (btnOpenClassHomeText) {
    btnOpenClassHomeText.textContent = homeButtonConfig.text || DEFAULT_HOME_BUTTON_CONFIG.text;
  }

  const validUrl = normalizeHomeUrl(homeButtonConfig.url);
  if (validUrl) {
    btnOpenClassHome.setAttribute('href', validUrl);
    btnOpenClassHome.setAttribute('target', homeButtonConfig.target || '_self');
    btnOpenClassHome.setAttribute('rel', 'noopener noreferrer');
  } else {
    btnOpenClassHome.setAttribute('href', '#');
    btnOpenClassHome.setAttribute('target', '_self');
  }
}

function updateHomeLinkPreview() {
  const currentText = (homelinkTextInput?.value || '').trim() || DEFAULT_HOME_BUTTON_CONFIG.text;
  if (homelinkPreviewText) {
    homelinkPreviewText.textContent = currentText;
  }
  if (homelinkPreviewBtn) {
    const isEnabled = homelinkEnableCheckbox ? homelinkEnableCheckbox.checked : true;
    homelinkPreviewBtn.style.opacity = isEnabled ? '1' : '0.35';
  }
}

function openHomeLinkModal() {
  if (!modalHomeLink) return;
  if (homelinkEnableCheckbox) {
    homelinkEnableCheckbox.checked = homeButtonConfig.enabled !== false;
  }
  if (homelinkTextInput) {
    homelinkTextInput.value = homeButtonConfig.text || DEFAULT_HOME_BUTTON_CONFIG.text;
  }
  if (homelinkUrlInput) {
    homelinkUrlInput.value = homeButtonConfig.url || '';
  }
  const targetRadios = document.querySelectorAll('input[name="homelink-target"]') as NodeListOf<HTMLInputElement>;
  targetRadios.forEach((r) => {
    r.checked = r.value === (homeButtonConfig.target || '_self');
  });
  updateHomeLinkPreview();
  modalHomeLink.classList.add('show');
}

function closeHomeLinkModal() {
  if (modalHomeLink) {
    modalHomeLink.classList.remove('show');
  }
}

// --- Data Persistence (Local Cache & Cloud Firestore) ---
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        attendees = parsed.filter((item) => item.grade >= 1 && item.grade <= 3);
      } else {
        attendees = [];
      }
    } else {
      attendees = [];
    }
  } catch (e) {
    attendees = [];
  }
}

function saveDataLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attendees));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

// --- Grade Class Counts Persistence & Sync ---
function loadClassCounts() {
  try {
    const raw = localStorage.getItem(CLASS_COUNT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (let g = 1; g <= 3; g++) {
        const val = parseInt(parsed[g], 10);
        gradeClassCounts[g] = val && val >= 1 && val <= 20 ? val : (DEFAULT_CLASS_COUNTS[g] || 8);
      }
    } else {
      gradeClassCounts = { ...DEFAULT_CLASS_COUNTS };
    }
  } catch (e) {
    gradeClassCounts = { ...DEFAULT_CLASS_COUNTS };
  }
  syncGradeConfig();
}

function saveClassCountsLocally() {
  try {
    localStorage.setItem(CLASS_COUNT_STORAGE_KEY, JSON.stringify(gradeClassCounts));
  } catch (e) {
    console.error('Failed to save class counts to localStorage', e);
  }
  syncGradeConfig();
}

function syncGradeConfig() {
  for (let g = 1; g <= 3; g++) {
    if (GRADE_CONFIG[g]) {
      GRADE_CONFIG[g].maxClass = gradeClassCounts[g] || 8;
    }
  }
}

function getTotalClassCount() {
  return (
    (gradeClassCounts[1] || 0) +
    (gradeClassCounts[2] || 0) +
    (gradeClassCounts[3] || 0)
  );
}

function getMaxClassAcrossGrades() {
  return Math.max(
    gradeClassCounts[1] || 8,
    gradeClassCounts[2] || 10,
    gradeClassCounts[3] || 9
  );
}

// --- Student Capacities Persistence & Calculations ---
function loadCapacities() {
  try {
    const raw = localStorage.getItem(CAPACITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (let g = 1; g <= 3; g++) {
        if (!parsed[g]) parsed[g] = {};
        const maxC = gradeClassCounts[g] || 10;
        for (let c = 1; c <= maxC; c++) {
          const n = parseInt(parsed[g][c], 10);
          parsed[g][c] = n && n > 0 ? n : (DEFAULT_CAPACITIES[g] && DEFAULT_CAPACITIES[g][c]) || 25;
        }
      }
      classCapacities = parsed;
    } else {
      classCapacities = JSON.parse(JSON.stringify(DEFAULT_CAPACITIES));
      for (let g = 1; g <= 3; g++) {
        if (!classCapacities[g]) classCapacities[g] = {};
        const maxC = gradeClassCounts[g] || 10;
        for (let c = 1; c <= maxC; c++) {
          if (!classCapacities[g][c]) classCapacities[g][c] = 25;
        }
      }
    }
  } catch (e) {
    classCapacities = JSON.parse(JSON.stringify(DEFAULT_CAPACITIES));
  }
}

function saveCapacitiesLocally() {
  try {
    localStorage.setItem(CAPACITY_STORAGE_KEY, JSON.stringify(classCapacities));
  } catch (e) {
    console.error('Failed to save capacities', e);
  }
}

function getTotalCapacity() {
  let sum = 0;
  for (let g = 1; g <= 3; g++) {
    const maxC = gradeClassCounts[g] || 0;
    for (let c = 1; c <= maxC; c++) {
      sum += (classCapacities[g] && classCapacities[g][c]) || 25;
    }
  }
  return sum;
}

// --- 1. Dynamic Class Chips Rendering per Grade (Parent Form) ---
function updateClassChipsForGrade(grade: number | null, preselectClass: number | null = null) {
  if (!grade || grade < 1 || grade > 3) {
    if (currentGradeClassInfo) {
      currentGradeClassInfo.textContent = '학년을 먼저 선택해주세요';
    }
    if (!classChipContainer) return;
    classChipContainer.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.88rem; padding: 10px 4px; display: inline-flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--green-600); flex-shrink: 0;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>위에서 <strong>학년</strong>을 먼저 선택하시면 해당 학년의 반 버튼이 나타납니다.</span>
      </div>
    `;
    selectedClassInForm = null;
    return;
  }

  const config = GRADE_CONFIG[grade] || GRADE_CONFIG[1];
  const maxClass = (gradeClassCounts[grade] && gradeClassCounts[grade] >= 1) ? gradeClassCounts[grade] : ((config && config.maxClass) || DEFAULT_CLASS_COUNTS[grade] || 8);
  const gradeName = (config && config.name) || `${grade}학년`;

  if (currentGradeClassInfo) {
    currentGradeClassInfo.textContent = `${gradeName} 1~${maxClass}반`;
  }

  if (preselectClass === null) {
    selectedClassInForm = null;
  } else if (preselectClass !== undefined) {
    selectedClassInForm = preselectClass;
  } else if (selectedClassInForm !== null && (selectedClassInForm > maxClass || selectedClassInForm < 1)) {
    selectedClassInForm = null;
  }

  if (!classChipContainer) return;
  classChipContainer.innerHTML = '';
  for (let c = 1; c <= maxClass; c++) {
    const label = document.createElement('label');
    const isChecked = selectedClassInForm !== null && c === selectedClassInForm;

    label.innerHTML = `
      <input type="radio" name="studentClass" value="${c}" class="choice-hidden" ${isChecked ? 'checked' : ''} />
      <div class="class-chip-label">${c}반</div>
    `;

    classChipContainer.appendChild(label);
  }
}

// Event Delegation for Class Chips (Fast & responsive on mobile)
if (classChipContainer) {
  classChipContainer.addEventListener('change', function (e) {
    const target = e.target as HTMLInputElement;
    if (target && target.name === 'studentClass' && target.checked) {
      selectedClassInForm = parseInt(target.value, 10);
    }
  });
}

// Grade Radios Listener + Delegation
const gradeChipGroup = document.getElementById('grade-chip-group');
if (gradeChipGroup) {
  gradeChipGroup.addEventListener('change', function (e) {
    const target = e.target as HTMLInputElement;
    if (target && target.name === 'studentGrade' && target.checked) {
      selectedGradeInForm = parseInt(target.value, 10);
      selectedClassInForm = null;
      updateClassChipsForGrade(selectedGradeInForm, null);
    }
  });
}

const gradeRadios = document.querySelectorAll('input[name="studentGrade"]');
gradeRadios.forEach((radio) => {
  radio.addEventListener('change', function (this: HTMLInputElement) {
    if (this.checked) {
      selectedGradeInForm = parseInt(this.value, 10);
      selectedClassInForm = null;
      updateClassChipsForGrade(selectedGradeInForm, null);
    }
  });
});

relChkOther.addEventListener('change', function (this: HTMLInputElement) {
  if (this.checked) {
    otherInputWrap.classList.add('show');
    otherDetailText.focus();
  } else {
    otherInputWrap.classList.remove('show');
    otherDetailText.value = '';
  }
});

// --- 2. Registration Form Submission (Real-Time Cloud Synced) ---
parentForm.addEventListener('submit', function (e) {
  e.preventDefault();
  parentFormError.classList.remove('show');

  const checkedGradeRadio = document.querySelector('input[name="studentGrade"]:checked') as HTMLInputElement | null;
  const checkedClassRadio = document.querySelector('input[name="studentClass"]:checked') as HTMLInputElement | null;
  const studentName = studentNameInput.value.trim();
  const checkedRelations = document.querySelectorAll('input[name="relationType"]:checked') as NodeListOf<HTMLInputElement>;

  if (!checkedGradeRadio) {
    showFormError('학년을 선택해주세요.');
    return;
  }
  if (!checkedClassRadio) {
    showFormError('반을 선택해주세요.');
    return;
  }
  if (!studentName) {
    showFormError('학생 이름을 입력해주세요.');
    studentNameInput.focus();
    return;
  }
  if (checkedRelations.length === 0) {
    showFormError('학생과의 관계(부, 모, 기타)를 하나 이상 체크해주세요.');
    return;
  }

  const grade = parseInt(checkedGradeRadio.value, 10);
  const cls = parseInt(checkedClassRadio.value, 10);
  const maxClass = GRADE_CONFIG[grade].maxClass;

  if (cls < 1 || cls > maxClass) {
    showFormError(`${grade}학년은 1반부터 ${maxClass}반까지만 선택 가능합니다.`);
    return;
  }

  const relations: string[] = [];
  checkedRelations.forEach((cb) => {
    if (cb.value === '기타') {
      const detail = otherDetailText.value.trim();
      relations.push(detail ? `기타(${detail})` : '기타');
    } else {
      relations.push(cb.value);
    }
  });

  const now = new Date();
  const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanInputName = studentName.replace(/\s+/g, '');
  const isDuplicate = attendees.some(
    (a) => a.grade === grade && a.classNum === cls && (a.name || '').trim().replace(/\s+/g, '') === cleanInputName
  );

  const targetRecord: Attendee = {
    id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    grade: grade,
    classNum: cls,
    name: studentName,
    relations: relations,
    attendeeCount: relations.length,
    createdAt: timeStr
  };
  attendees.unshift(targetRecord);
  saveDataLocally();
  showCompleteCard(grade, cls, studentName, relations, isDuplicate);

  // Synchronize instantly to Cloud Firestore (Visible across all devices in real-time)
  addAttendeeDoc(targetRecord)
    .then(() => {
      updateSyncStatus(true, `실시간 동기화 완료 (${attendees.length}명)`);
    })
    .catch((err) => {
      console.error('Failed to sync to Cloud Firestore', err);
      updateSyncStatus(false, '클라우드 저장 실패, 재시도 중');
    });

  studentNameInput.value = '';
  checkedRelations.forEach((cb) => {
    cb.checked = false;
  });
  otherInputWrap.classList.remove('show');
  otherDetailText.value = '';
});

function showFormError(msg: string) {
  parentFormError.textContent = msg;
  parentFormError.classList.add('show');
}

function showCompleteCard(grade: number, cls: number, name: string, relations: string[], isDuplicate: boolean) {
  parentForm.style.display = 'none';
  if (isDuplicate) {
    completeStudentTitle.textContent = '참석 등록 완료 (중복데이터 접수)';
    completeStudentDesc.innerHTML = `
      <div class="badge-duplicate" style="font-size:0.85rem; padding: 6px 14px; margin: 0 auto 12px; display: inline-flex; border-radius: 6px;">
        ⚠️ 중복데이터 안내: 동일 학생으로 기존 등록 내역이 있어 추가 등록(중복데이터)으로 처리되었습니다.
      </div><br />
      <strong>${grade}학년 ${cls}반 ${escapeHtml(name)}</strong> 학생 학부모님 (${relations.join(', ')})<br />
      공개수업 방문을 환영합니다.
    `;
    showToast(`${name} 학생 (중복데이터) 등록 완료 (클라우드 실시간 반영)`);
  } else {
    completeStudentTitle.textContent = '참석 등록이 완료되었습니다!';
    completeStudentDesc.innerHTML = `
      <strong>${grade}학년 ${cls}반 ${escapeHtml(name)}</strong> 학생 학부모님 (${relations.join(', ')})<br />
      공개수업 방문을 환영합니다.
    `;
    showToast(`${name} 학생 학부모님 등록 완료 (클라우드 실시간 반영)`);
  }
  successCompleteCard.classList.add('show');
}

btnContinueRegister.addEventListener('click', function () {
  // 1. Hide complete card and display parent form
  successCompleteCard.classList.remove('show');
  parentForm.style.display = 'flex';

  // 2. Reset Grade selection (uncheck 1·2·3학년 radios and reset state)
  const gradeRadiosList = document.querySelectorAll('input[name="studentGrade"]') as NodeListOf<HTMLInputElement>;
  gradeRadiosList.forEach((radio) => {
    radio.checked = false;
  });
  selectedGradeInForm = null;

  // 3. Reset Class selection (clear state and prompt to select grade first)
  selectedClassInForm = null;
  updateClassChipsForGrade(null);

  // 4. Reset Student Name Input
  if (studentNameInput) {
    studentNameInput.value = '';
  }

  // 5. Reset Relationship checkboxes (부, 모, 기타)
  const relationCheckboxes = document.querySelectorAll('input[name="relationType"]') as NodeListOf<HTMLInputElement>;
  relationCheckboxes.forEach((cb) => {
    cb.checked = false;
  });
  if (otherInputWrap) {
    otherInputWrap.classList.remove('show');
  }
  if (otherDetailText) {
    otherDetailText.value = '';
  }

  // 6. Reset any previous error message
  if (parentFormError) {
    parentFormError.classList.remove('show');
    parentFormError.textContent = '';
  }

  // 7. Smoothly scroll up to the very top of the screen
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth'
  });
  const headerElem = document.getElementById('app-header') || document.getElementById('app-wrapper');
  if (headerElem) {
    headerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

if (btnOpenClassHome) {
  btnOpenClassHome.addEventListener('click', function (e) {
    const validUrl = normalizeHomeUrl(homeButtonConfig.url);
    if (!validUrl) {
      e.preventDefault();
      showToast('공개수업 홈 링크가 아직 등록되지 않았습니다. 관리자 페이지에서 이동 URL을 설정해주세요.');
      return;
    }
    // If validUrl is configured, native HTML anchor navigation executes directly!
    // Since this is a native user click on an <a> element with target="_self" (or _blank with rel="noopener noreferrer"),
    // mobile browsers and strict corporate/school security settings will NOT trigger any popup blocker warnings!
  });
}

// --- 3. Direct Admin Access from Header Button ---
const handleToggleAdmin = function (e?: Event) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  if (isAdminLoggedIn) {
    switchToParentView();
  } else {
    openPasswordModal();
  }
};

if (btnToggleAdminMode) {
  btnToggleAdminMode.addEventListener('click', handleToggleAdmin);
}
(window as any).toggleAdminMode = handleToggleAdmin;

btnExitAdmin.addEventListener('click', function () {
  switchToParentView();
});

function openPasswordModal() {
  adminPasswordInput.value = '';
  adminPasswordError.textContent = '';
  adminPasswordError.classList.remove('show');
  modalPassword.classList.add('show');
  setTimeout(() => {
    adminPasswordInput.focus();
  }, 100);
}

btnCancelPwd.addEventListener('click', function () {
  modalPassword.classList.remove('show');
});

if (btnClosePwdX) {
  btnClosePwdX.addEventListener('click', function () {
    modalPassword.classList.remove('show');
  });
}

let isVerifyingPwd = false;
function handleConfirmPwd(e?: Event) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (isVerifyingPwd) return;
  isVerifyingPwd = true;
  setTimeout(() => {
    isVerifyingPwd = false;
  }, 350);
  verifyPasswordAndLogin(e);
}

const adminPasswordForm = document.getElementById('admin-password-form') as HTMLFormElement | null;
if (adminPasswordForm) {
  adminPasswordForm.addEventListener('submit', function (e) {
    e.preventDefault();
    handleConfirmPwd(e);
  });
}

btnConfirmPwd.addEventListener('click', handleConfirmPwd);

adminPasswordInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleConfirmPwd(e);
  }
});

function verifyPasswordAndLogin(e?: Event) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  const raw = adminPasswordInput.value || '';
  // Normalize full-width characters (e.g. ３０００) and trim whitespace
  const entered = raw.trim().replace(/\s+/g, '').normalize('NFKC');

  if (entered === ADMIN_PASSWORD) {
    adminPasswordInput.blur();
    adminPasswordInput.value = '';
    adminPasswordError.textContent = '';
    adminPasswordError.classList.remove('show');
    modalPassword.classList.remove('show');

    switchToAdminView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('관리자 모드로 전환되었습니다.');
  } else {
    adminPasswordError.textContent = '비밀번호가 올바르지 않습니다.';
    adminPasswordError.classList.add('show');
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
  }
}
(window as any).verifyPasswordAndLogin = verifyPasswordAndLogin;
(window as any).switchToAdminView = switchToAdminView;

function switchToAdminView() {
  isAdminLoggedIn = true;
  viewParent.classList.remove('active');
  viewAdmin.classList.add('active');
  document.body.classList.add('is-admin-mode');
  if (btnToggleAdminMode) {
    btnToggleAdminMode.style.display = 'none';
  }

  populateAdminClassFilter();
  renderAdminAll();
  updateSchoolNameDisplay();

  // Instant refresh from Cloud Firestore on mobile / desktop
  refreshDataFromCloud(true);
}

function switchToParentView() {
  isAdminLoggedIn = false;
  viewAdmin.classList.remove('active');
  viewParent.classList.add('active');
  document.body.classList.remove('is-admin-mode');
  if (btnToggleAdminMode) {
    btnToggleAdminMode.style.display = '';
    btnToggleAdminMode.classList.remove('is-admin');
  }
  adminModeText.textContent = '관리자 페이지';
  updateSchoolNameDisplay();
  updateClassChipsForGrade(selectedGradeInForm);
}

// --- 4. Admin View Renderers ---
function renderAdminAll() {
  renderAdminStats();
  renderAdminCharts();
  renderUnifiedMatrixTable();
  renderAdminAttendeesTable();
}

function renderAdminStats() {
  const grouped = groupAttendees(attendees);
  const totalAtt = grouped.reduce((sum, g) => sum + (g.attendeeCount || 1), 0);
  const uniqueCount = grouped.length;
  const totalCap = getTotalCapacity();
  const overallRate = totalCap > 0 ? (uniqueCount / totalCap) * 100 : 0;

  if (statTotalRate) {
    statTotalRate.textContent = overallRate.toFixed(1);
  }
  if (statRateSub) {
    statRateSub.textContent = `참석 ${uniqueCount.toLocaleString()}명 / 전교 정원 ${totalCap.toLocaleString()}명`;
  }
  if (statUniqueStudents) {
    statUniqueStudents.textContent = uniqueCount.toLocaleString();
  }
  if (statUniqueStudentsUnit) {
    statUniqueStudentsUnit.textContent = `/ ${totalCap.toLocaleString()}명`;
  }
  if (statTotalAttendees) {
    statTotalAttendees.textContent = totalAtt.toLocaleString();
  }
  if (statTotalRecords) {
    statTotalRecords.textContent = attendees.length.toLocaleString();
  }
  if (matrixTotalClassesLabel) {
    matrixTotalClassesLabel.textContent = getTotalClassCount().toLocaleString();
  }
  if (matrixTotalCapLabel) {
    matrixTotalCapLabel.textContent = totalCap.toLocaleString();
  }
}

function getRateBadgeClass(rate: number, count: number) {
  if (count === 0) return 'zero';
  if (rate >= 70) return 'high';
  if (rate >= 30) return 'mid';
  return 'low';
}

// --- D3 Graphical Visualization: Attendance Rate & Class Participation Trends ---
interface ClassChartItem {
  grade: number;
  classNum: number;
  label: string; // e.g. "1-1"
  fullLabel: string; // e.g. "1학년 1반"
  uniqueStudents: number;
  capacity: number;
  rate: number;
  parents: number;
}

function renderAdminCharts() {
  if (!d3TrendChart) return;

  const grouped = groupAttendees(attendees);
  const totalAtt = grouped.reduce((sum, g) => sum + (g.attendeeCount || 1), 0);
  const uniqueCount = grouped.length;
  const totalCap = getTotalCapacity();
  const overallRate = totalCap > 0 ? (uniqueCount / totalCap) * 100 : 0;

  // 1. Overall Donut Gauge (실시간 전교 종합 참석률)
  if (chartOverallGauge) {
    chartOverallGauge.innerHTML = '';
    const size = 76;
    const radius = size / 2;
    const strokeWidth = 9;

    const svgGauge = d3.select(chartOverallGauge)
      .append('svg')
      .attr('width', size)
      .attr('height', size)
      .append('g')
      .attr('transform', `translate(${radius}, ${radius})`);

    const bgArc = d3.arc<any>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    svgGauge.append('path')
      .attr('d', bgArc({} as any))
      .attr('fill', '#e2ede6');

    const progressAngle = Math.min(2 * Math.PI, Math.max(0, (overallRate / 100) * 2 * Math.PI));
    const fgArc = d3.arc<any>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(progressAngle)
      .cornerRadius(4);

    svgGauge.append('path')
      .attr('d', fgArc({} as any))
      .attr('fill', overallRate >= 70 ? '#1b5e37' : overallRate >= 30 ? '#2e7d4f' : '#e0823d');

    svgGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#1d2d23')
      .attr('font-size', '12px')
      .attr('font-weight', '800')
      .text(`${overallRate.toFixed(1)}%`);
  }

  if (chartGaugeRateText) {
    chartGaugeRateText.textContent = `${overallRate.toFixed(1)}%`;
  }
  if (chartGaugeSubText) {
    chartGaugeSubText.textContent = `참석 ${uniqueCount.toLocaleString()}명 / 정원 ${totalCap.toLocaleString()}명`;
  }

  // 2. Grade-by-grade Summary Progress Cards
  const gradeStats: { [g: number]: { students: number; capacity: number; rate: number; parents: number } } = {};
  for (let g = 1; g <= 3; g++) {
    const numClasses = gradeClassCounts[g] || 0;
    const gradeGrouped = grouped.filter(a => a.grade === g);
    const students = gradeGrouped.length;
    let capSum = 0;
    for (let c = 1; c <= numClasses; c++) {
      capSum += (classCapacities[g] && classCapacities[g][c]) || 25;
    }
    const rate = capSum > 0 ? (students / capSum) * 100 : 0;
    const parents = gradeGrouped.reduce((sum, a) => sum + (a.attendeeCount || 1), 0);
    gradeStats[g] = { students, capacity: capSum, rate, parents };
  }

  if (chartGradeSummaryCards) {
    let cardsHtml = '';
    for (let g = 1; g <= 3; g++) {
      const stat = gradeStats[g];
      const isSelected = activeChartGradeFilter === g;
      const badgeClass = getRateBadgeClass(stat.rate, stat.students);
      cardsHtml += `
        <div class="chart-grade-card ${isSelected ? 'active' : ''}" data-click-grade="${g}" title="${g}학년 차트 필터링 (클릭하여 선택/해제)">
          <div class="chart-grade-card-header">
            <span class="chart-grade-card-title">${g}학년</span>
            <span class="rate-badge ${badgeClass}">${stat.rate.toFixed(1)}%</span>
          </div>
          <div class="chart-grade-bar-track">
            <div class="chart-grade-bar-fill" style="width:${Math.min(100, stat.rate)}%; background:${stat.rate >= 70 ? 'var(--green-700)' : stat.rate >= 30 ? 'var(--green-500)' : '#f59e0b'};"></div>
          </div>
          <div class="chart-grade-card-sub">
            <span>참석 <strong>${stat.students}</strong>명</span>
            <span>정원 ${stat.capacity}명</span>
          </div>
        </div>
      `;
    }
    chartGradeSummaryCards.innerHTML = cardsHtml;

    chartGradeSummaryCards.querySelectorAll<HTMLElement>('.chart-grade-card').forEach(card => {
      card.addEventListener('click', () => {
        const gStr = card.getAttribute('data-click-grade');
        if (gStr) {
          const g = parseInt(gStr, 10) as 1 | 2 | 3;
          activeChartGradeFilter = activeChartGradeFilter === g ? 'all' : g;
          document.querySelectorAll('.btn-chart-filter').forEach(btn => {
            const f = btn.getAttribute('data-grade-filter');
            btn.classList.toggle('active', f === String(activeChartGradeFilter));
          });
          renderAdminCharts();
        }
      });
    });
  }

  // 3. Prepare Class Data
  const classData: ClassChartItem[] = [];
  for (let g = 1; g <= 3; g++) {
    if (activeChartGradeFilter !== 'all' && activeChartGradeFilter !== g) continue;
    const numClasses = gradeClassCounts[g] || 0;
    const gradeGrouped = grouped.filter(a => a.grade === g);
    for (let c = 1; c <= numClasses; c++) {
      const classGrouped = gradeGrouped.filter(a => a.classNum === c);
      const sCount = classGrouped.length;
      const cap = (classCapacities[g] && classCapacities[g][c]) || 25;
      const rate = cap > 0 ? (sCount / cap) * 100 : 0;
      const pCount = classGrouped.reduce((sum, a) => sum + (a.attendeeCount || 1), 0);
      classData.push({
        grade: g,
        classNum: c,
        label: `${g}-${c}`,
        fullLabel: `${g}학년 ${c}반`,
        uniqueStudents: sCount,
        capacity: cap,
        rate,
        parents: pCount
      });
    }
  }

  // Clear previous SVG
  d3TrendChart.innerHTML = '';

  const containerRect = d3TrendChart.getBoundingClientRect();
  const width = Math.max(380, containerRect.width || 720);
  const height = 310;
  const margin = { top: 32, right: 30, bottom: 44, left: 45 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(d3TrendChart)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible')
    .style('display', 'block');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Tooltip Helper
  const showTooltip = (event: MouseEvent, html: string) => {
    if (!d3ChartTooltip || !d3TrendChart) return;
    d3ChartTooltip.innerHTML = html;
    d3ChartTooltip.style.opacity = '1';

    const parentRect = d3TrendChart.getBoundingClientRect();
    const tooltipWidth = 185;
    let left = event.clientX - parentRect.left + 12;
    if (left + tooltipWidth > parentRect.width) {
      left = event.clientX - parentRect.left - tooltipWidth - 12;
    }
    const top = Math.max(10, event.clientY - parentRect.top - 40);
    d3ChartTooltip.style.left = `${left}px`;
    d3ChartTooltip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    if (d3ChartTooltip) d3ChartTooltip.style.opacity = '0';
  };

  // --- RENDER ACCORDING TO ACTIVE MODE ---
  if (activeChartMode === 'rate') {
    // MODE: Attendance Rate (%) Trends with Bar + Monotone Cubic Spline Line
    const xScale = d3.scaleBand()
      .domain(classData.map(d => d.label))
      .range([0, innerWidth])
      .padding(classData.length > 15 ? 0.22 : 0.35);

    const maxRate = Math.max(100, (d3.max(classData, d => d.rate) || 0) + 10);
    const yScale = d3.scaleLinear()
      .domain([0, maxRate])
      .range([innerHeight, 0])
      .nice();

    // Horizontal grid lines
    const yTicks = [25, 50, 75, 100];
    g.append('g')
      .selectAll('line.grid-line')
      .data(yTicks.filter(t => t <= maxRate))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e4eee6')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // School Average Reference Line
    if (overallRate > 0) {
      const avgY = yScale(overallRate);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', avgY)
        .attr('y2', avgY)
        .attr('stroke', '#d97706')
        .attr('stroke-dasharray', '5 4')
        .attr('stroke-width', 1.8)
        .attr('opacity', 0.9);

      g.append('text')
        .attr('x', innerWidth)
        .attr('y', avgY - 6)
        .attr('text-anchor', 'end')
        .attr('fill', '#b45309')
        .attr('font-size', '10.5px')
        .attr('font-weight', '700')
        .text(`전교 평균 ${overallRate.toFixed(1)}%`);
    }

    // X Axis
    const xAxis = d3.axisBottom(xScale);
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#4b5563')
      .attr('font-size', classData.length > 20 ? '9.5px' : '11px')
      .attr('font-weight', '600');

    // Y Axis
    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d}%`);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#4b5563')
      .attr('font-size', '11px');

    // Attendance Rate Bars
    g.selectAll('rect.rate-bar')
      .data(classData)
      .enter()
      .append('rect')
      .attr('class', 'rate-bar')
      .attr('x', d => xScale(d.label) || 0)
      .attr('y', d => yScale(d.rate))
      .attr('width', xScale.bandwidth())
      .attr('height', d => Math.max(0, innerHeight - yScale(d.rate)))
      .attr('rx', 3)
      .attr('fill', d => {
        if (d.rate === 0) return '#cbd5e1';
        if (d.rate >= 70) return '#24583c';
        if (d.rate >= 40) return '#3b8259';
        return '#78a88a';
      })
      .attr('opacity', 0.88)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#1a3c2a').attr('stroke-width', 1.5);
        showTooltip(event, `
          <div class="tt-title"><span>🏫</span> ${d.fullLabel}</div>
          <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
          <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / ${d.capacity}명</div>
          <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
        `);
      })
      .on('mousemove', function(event, d) {
        showTooltip(event, `
          <div class="tt-title"><span>🏫</span> ${d.fullLabel}</div>
          <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
          <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / ${d.capacity}명</div>
          <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
        `);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.88).attr('stroke', 'none');
        hideTooltip();
      });

    // Trend Curve Line
    if (classData.length > 1) {
      const lineGen = d3.line<ClassChartItem>()
        .x(d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .y(d => yScale(d.rate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(classData)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', '#0f291e')
        .attr('stroke-width', 2.2)
        .attr('opacity', 0.85);

      // Trend Dots
      g.selectAll('circle.trend-dot')
        .data(classData)
        .enter()
        .append('circle')
        .attr('class', 'trend-dot')
        .attr('cx', d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .attr('cy', d => yScale(d.rate))
        .attr('r', classData.length > 15 ? 3.5 : 4.5)
        .attr('fill', '#ffffff')
        .attr('stroke', '#0f291e')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('r', 6).attr('fill', '#34d399');
          showTooltip(event, `
            <div class="tt-title"><span>📈</span> ${d.fullLabel} 참여 추세</div>
            <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
            <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / ${d.capacity}명</div>
            <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
          `);
        })
        .on('mousemove', function(event, d) {
          showTooltip(event, `
            <div class="tt-title"><span>📈</span> ${d.fullLabel} 참여 추세</div>
            <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
            <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / ${d.capacity}명</div>
            <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
          `);
        })
        .on('mouseleave', function() {
          d3.select(this).attr('r', classData.length > 15 ? 3.5 : 4.5).attr('fill', '#ffffff');
          hideTooltip();
        });
    }

    // Value Labels on Top of Bars
    g.selectAll('text.bar-label')
      .data(classData)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.rate) - (classData.length > 1 ? 10 : 6))
      .attr('text-anchor', 'middle')
      .attr('font-size', classData.length > 20 ? '8.5px' : '9.5px')
      .attr('font-weight', '700')
      .attr('fill', d => d.rate > 0 ? '#1d2d23' : '#94a3b8')
      .text(d => d.rate > 0 ? `${Math.round(d.rate)}%` : '0');

    // Update Legend
    if (chartLegendRow) {
      chartLegendRow.innerHTML = `
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#24583c;"></span>고참석률 (70% 이상)</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#3b8259;"></span>중간 (40%~69%)</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#78a88a;"></span>저참석 (40% 미만)</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#cbd5e1;"></span>미등록 (0명)</div>
        <div class="chart-legend-item"><span class="chart-legend-line" style="border-top:2px dashed #d97706;"></span>전교 평균 참석률 (${overallRate.toFixed(1)}%)</div>
        <div class="chart-legend-item"><span class="chart-legend-line" style="border-top:2px solid #0f291e;"></span>참여 추세 곡선</div>
      `;
    }

  } else if (activeChartMode === 'count') {
    // MODE: Attending Students vs Capacity Comparison (Bullet Bars)
    const xScale = d3.scaleBand()
      .domain(classData.map(d => d.label))
      .range([0, innerWidth])
      .padding(classData.length > 15 ? 0.22 : 0.32);

    const maxCap = Math.max(25, (d3.max(classData, d => Math.max(d.capacity, d.uniqueStudents)) || 25) + 5);
    const yScale = d3.scaleLinear()
      .domain([0, maxCap])
      .range([innerHeight, 0])
      .nice();

    // Horizontal grid lines
    g.append('g')
      .selectAll('line.grid-line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e4eee6')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('fill', '#4b5563')
      .attr('font-size', classData.length > 20 ? '9.5px' : '11px')
      .attr('font-weight', '600');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}명`))
      .selectAll('text')
      .attr('fill', '#4b5563')
      .attr('font-size', '11px');

    // 1) Capacity Background Bars (Total student capacity)
    g.selectAll('rect.cap-bar')
      .data(classData)
      .enter()
      .append('rect')
      .attr('class', 'cap-bar')
      .attr('x', d => xScale(d.label) || 0)
      .attr('y', d => yScale(d.capacity))
      .attr('width', xScale.bandwidth())
      .attr('height', d => Math.max(0, innerHeight - yScale(d.capacity)))
      .attr('rx', 4)
      .attr('fill', '#edf5f0')
      .attr('stroke', '#c8e0d2')
      .attr('stroke-width', 1.2);

    // 2) Attended Students Bars (Students currently registered)
    g.selectAll('rect.student-bar')
      .data(classData)
      .enter()
      .append('rect')
      .attr('class', 'student-bar')
      .attr('x', d => xScale(d.label) || 0)
      .attr('y', d => yScale(d.uniqueStudents))
      .attr('width', xScale.bandwidth())
      .attr('height', d => Math.max(0, innerHeight - yScale(d.uniqueStudents)))
      .attr('rx', 4)
      .attr('fill', '#2d6a4f')
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 1).attr('fill', '#1b4332');
        showTooltip(event, `
          <div class="tt-title"><span>👥</span> ${d.fullLabel} 출석 현황</div>
          <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / 정원 ${d.capacity}명</div>
          <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
          <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
        `);
      })
      .on('mousemove', function(event, d) {
        showTooltip(event, `
          <div class="tt-title"><span>👥</span> ${d.fullLabel} 출석 현황</div>
          <div class="tt-row"><span>참석 학생:</span> <strong>${d.uniqueStudents}명</strong> / 정원 ${d.capacity}명</div>
          <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
          <div class="tt-row"><span>학부모 방문:</span> <strong>${d.parents}명</strong></div>
        `);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.9).attr('fill', '#2d6a4f');
        hideTooltip();
      });

    // Top Label: Attendance count over capacity
    g.selectAll('text.count-label')
      .data(classData)
      .enter()
      .append('text')
      .attr('class', 'count-label')
      .attr('x', d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(Math.max(d.capacity, d.uniqueStudents)) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', classData.length > 20 ? '8px' : '9.5px')
      .attr('font-weight', '700')
      .attr('fill', '#1b4332')
      .text(d => `${d.uniqueStudents}/${d.capacity}`);

    // Update Legend
    if (chartLegendRow) {
      chartLegendRow.innerHTML = `
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#2d6a4f;"></span>참석 학생 수 (가구수)</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#edf5f0; border:1px solid #c8e0d2;"></span>학급 학생 정원</div>
        <div class="chart-legend-item" style="color:var(--text-sub);">💡 막대를 마우스로 가리키면 세부 학생 및 학부모 참석 인원이 표시됩니다.</div>
      `;
    }

  } else if (activeChartMode === 'grade') {
    // MODE: Grade-by-grade Comprehensive Comparative Analysis
    const gradeData = [1, 2, 3].map(g => {
      const stat = gradeStats[g];
      return {
        grade: g,
        label: `${g}학년`,
        students: stat.students,
        capacity: stat.capacity,
        rate: stat.rate,
        parents: stat.parents
      };
    });

    const x0 = d3.scaleBand()
      .domain(gradeData.map(d => d.label))
      .range([0, innerWidth])
      .padding(0.3);

    const subKeys = ['capacity', 'students', 'parents'];
    const x1 = d3.scaleBand()
      .domain(subKeys)
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const maxVal = Math.max(100, (d3.max(gradeData, d => Math.max(d.capacity, d.students, d.parents)) || 100) + 20);
    const yScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([innerHeight, 0])
      .nice();

    // Horizontal grid lines
    g.append('g')
      .selectAll('line.grid-line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e4eee6')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .attr('fill', '#1d2d23')
      .attr('font-size', '13px')
      .attr('font-weight', '700');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}명`))
      .selectAll('text')
      .attr('fill', '#4b5563')
      .attr('font-size', '11px');

    const colorMap: { [key: string]: string } = {
      capacity: '#d8e8dc',
      students: '#24583c',
      parents: '#2563eb'
    };

    // Render grouped bars
    const gradeGroups = g.selectAll('g.grade-group')
      .data(gradeData)
      .enter()
      .append('g')
      .attr('class', 'grade-group')
      .attr('transform', d => `translate(${x0(d.label)}, 0)`);

    subKeys.forEach(key => {
      gradeGroups.append('rect')
        .attr('x', x1(key) || 0)
        .attr('y', d => yScale(d[key as keyof typeof d] as number))
        .attr('width', x1.bandwidth())
        .attr('height', d => Math.max(0, innerHeight - yScale(d[key as keyof typeof d] as number)))
        .attr('rx', 4)
        .attr('fill', colorMap[key])
        .attr('opacity', 0.92)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event, d) {
          d3.select(this).attr('opacity', 1);
          showTooltip(event, `
            <div class="tt-title"><span>🎓</span> ${d.label} 통계 상세</div>
            <div class="tt-row"><span>총 학생 정원:</span> <strong>${d.capacity}명</strong></div>
            <div class="tt-row"><span>참석 학생 수:</span> <strong>${d.students}명</strong></div>
            <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
            <div class="tt-row"><span>참석 학부모 수:</span> <strong>${d.parents}명</strong></div>
          `);
        })
        .on('mousemove', function(event, d) {
          showTooltip(event, `
            <div class="tt-title"><span>🎓</span> ${d.label} 통계 상세</div>
            <div class="tt-row"><span>총 학생 정원:</span> <strong>${d.capacity}명</strong></div>
            <div class="tt-row"><span>참석 학생 수:</span> <strong>${d.students}명</strong></div>
            <div class="tt-row"><span>참석률:</span> <strong>${d.rate.toFixed(1)}%</strong></div>
            <div class="tt-row"><span>참석 학부모 수:</span> <strong>${d.parents}명</strong></div>
          `);
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 0.92);
          hideTooltip();
        });

      // Bar Value Labels
      gradeGroups.append('text')
        .attr('x', (x1(key) || 0) + x1.bandwidth() / 2)
        .attr('y', d => yScale(d[key as keyof typeof d] as number) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10.5px')
        .attr('font-weight', '700')
        .attr('fill', key === 'capacity' ? '#4b5563' : colorMap[key])
        .text(d => `${d[key as keyof typeof d]}명`);
    });

    // Rate badge on top of each grade group
    gradeGroups.append('text')
      .attr('x', x0.bandwidth() / 2)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '800')
      .attr('fill', '#1b4332')
      .text(d => `참석률 ${d.rate.toFixed(1)}%`);

    // Update Legend
    if (chartLegendRow) {
      chartLegendRow.innerHTML = `
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#d8e8dc;"></span>총 학생 정원</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#24583c;"></span>참석 학생 수 (가구수)</div>
        <div class="chart-legend-item"><span class="chart-legend-color" style="background:#2563eb;"></span>참석 학부모 수</div>
      `;
    }
  }
}

function initChartControls() {
  const modeTabs = document.querySelectorAll<HTMLButtonElement>('.btn-chart-tab');
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-chart-mode') as 'rate' | 'count' | 'grade';
      if (mode) {
        activeChartMode = mode;
        modeTabs.forEach(t => t.classList.toggle('active', t === tab));
        renderAdminCharts();
      }
    });
  });

  const filterBtns = document.querySelectorAll<HTMLButtonElement>('.btn-chart-filter');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-grade-filter');
      if (filter === 'all') {
        activeChartGradeFilter = 'all';
      } else if (filter) {
        activeChartGradeFilter = parseInt(filter, 10) as 1 | 2 | 3;
      }
      filterBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderAdminCharts();
    });
  });

  if (d3TrendChart) {
    let resizeTimer: number | null = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (isAdminLoggedIn) renderAdminCharts();
      }, 150);
    });
  }
}

// --- All-in-One 1, 2, 3 Grade Unified Matrix Table with Capacities & Attendance Rates ---
function renderUnifiedMatrixTable() {
  allGradeMatrixTbody.innerHTML = '';
  const maxCols = getMaxClassAcrossGrades();

  if (allGradeMatrixThead) {
    let theadHtml = '<tr><th style="width: 110px;">학년 구분</th>';
    for (let c = 1; c <= maxCols; c++) {
      theadHtml += `<th>${c}반</th>`;
    }
    theadHtml += '<th style="background:var(--green-100); color:var(--green-700); width:95px;">학년 합계</th></tr>';
    allGradeMatrixThead.innerHTML = theadHtml;
  }

  let grandTotalParents = 0;
  let grandTotalStudents = 0;
  let grandTotalCap = 0;

  // Deduplicate attendees by student (grade-classNum-name)
  const groupedAttendees = groupAttendees(attendees);

  for (let g = 1; g <= 3; g++) {
    const config = GRADE_CONFIG[g];
    const gradeName = config?.name || `${g}학년`;
    const numClasses = gradeClassCounts[g] || 0;
    const gradeGrouped = groupedAttendees.filter((a) => a.grade === g);

    let gradeParentsSum = 0;
    let gradeStudentsSum = 0;
    let gradeCapSum = 0;

    let trParents = `<td><strong>${gradeName} (학부모)</strong></td>`;
    let trStudents = `<td style="color:var(--text-muted); font-size:0.82rem;"><strong>${gradeName} (학생 / 정원)</strong></td>`;
    let trRate = `<td style="color:var(--green-700); font-size:0.82rem; background:#fafdfb;"><strong>${gradeName} (참석률)</strong></td>`;

    for (let c = 1; c <= maxCols; c++) {
      if (c <= numClasses) {
        const classGrouped = gradeGrouped.filter((a) => a.classNum === c);
        const pCount = classGrouped.reduce((sum, a) => sum + (a.attendeeCount || 1), 0);
        const sCount = classGrouped.length;
        const cap = (classCapacities[g] && classCapacities[g][c]) || 25;
        const rate = cap > 0 ? (sCount / cap) * 100 : 0;
        const badgeClass = getRateBadgeClass(rate, sCount);

        gradeParentsSum += pCount;
        gradeStudentsSum += sCount;
        gradeCapSum += cap;

        trParents += `<td>${pCount > 0 ? `<strong>${pCount}</strong>` : '<span style="color:#b2c3b8;">0</span>'}</td>`;
        trStudents += `<td><span style="font-weight:600; color:${sCount > 0 ? 'var(--text-main)' : '#9eb3a5'}">${sCount}</span><span style="font-size:0.75rem; color:#8fa196;">/${cap}</span></td>`;
        trRate += `<td style="background:#fafdfb;"><span class="rate-badge ${badgeClass}">${rate.toFixed(1)}%</span></td>`;
      } else {
        // Nonexistent class: completely blank cell, no text or characters
        trParents += `<td class="td-nonexistent"></td>`;
        trStudents += `<td class="td-nonexistent"></td>`;
        trRate += `<td class="td-nonexistent"></td>`;
      }
    }

    grandTotalParents += gradeParentsSum;
    grandTotalStudents += gradeStudentsSum;
    grandTotalCap += gradeCapSum;

    const gradeOverallRate = gradeCapSum > 0 ? (gradeStudentsSum / gradeCapSum) * 100 : 0;
    const gradeBadgeClass = getRateBadgeClass(gradeOverallRate, gradeStudentsSum);

    trParents += `<td style="background:#eaf4ed; font-weight:800; color:var(--green-700);">${gradeParentsSum}명</td>`;
    trStudents += `<td style="background:#eaf4ed; font-weight:700; color:var(--text-muted); font-size:0.83rem;">${gradeStudentsSum} / ${gradeCapSum}명</td>`;
    trRate += `<td style="background:#e0efe5; font-weight:800;"><span class="rate-badge ${gradeBadgeClass}">${gradeOverallRate.toFixed(1)}%</span></td>`;

    const tr1 = document.createElement('tr');
    tr1.innerHTML = trParents;

    const tr2 = document.createElement('tr');
    tr2.innerHTML = trStudents;

    const tr3 = document.createElement('tr');
    tr3.style.borderBottom = '2px solid var(--border-color)';
    tr3.innerHTML = trRate;

    allGradeMatrixTbody.appendChild(tr1);
    allGradeMatrixTbody.appendChild(tr2);
    allGradeMatrixTbody.appendChild(tr3);
  }

  // Grand Total Summary Row (3줄 -> 1줄 통합: 1개의 셀에 전교 총 학부모수, 학생 출석/정원, 종합 참석률 배분)
  const trTotal = document.createElement('tr');
  trTotal.className = 'total-tr';
  const grandRate = grandTotalCap > 0 ? (grandTotalStudents / grandTotalCap) * 100 : 0;
  trTotal.innerHTML = `
    <td style="white-space:nowrap; text-align:center;"><strong style="color:var(--green-700); font-size:0.92rem; font-weight:800;">전교 총합계</strong></td>
    <td colspan="${maxCols + 1}" style="background:#eaf4ed; padding:10px 16px;">
      <div style="display:flex; align-items:center; justify-content:space-evenly; flex-wrap:wrap; gap:12px 20px; text-align:center;">
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:0.88rem; font-weight:600;">전교 총 학부모 수:</span>
          <strong style="color:var(--green-700); font-size:1.02rem; font-weight:800;">${grandTotalParents.toLocaleString()}명</strong>
        </div>
        <span style="color:#bddbc8; font-weight:300;" class="total-metric-divider">|</span>
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:0.88rem; font-weight:600;">전교 학생 출석 / 정원:</span>
          <strong style="color:var(--green-700); font-size:0.96rem; font-weight:700;">${grandTotalStudents.toLocaleString()} / ${grandTotalCap.toLocaleString()}명</strong>
        </div>
        <span style="color:#bddbc8; font-weight:300;" class="total-metric-divider">|</span>
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:0.88rem; font-weight:600;">전교 종합 참석률:</span>
          <span class="rate-badge featured" style="font-size:0.92rem; padding:4px 18px; font-weight:800;">${grandRate.toFixed(1)}%</span>
        </div>
      </div>
    </td>
  `;

  allGradeMatrixTbody.appendChild(trTotal);
}

// --- 5. Sort Function: Grade -> Class -> Student Name Korean Alphabetical ---
interface GroupedAttendee {
  key: string;
  ids: string[];
  grade: number;
  classNum: number;
  name: string;
  relations: string[];
  attendeeCount: number;
  createdTimes: string[];
  isDuplicate: boolean;
  duplicateCount: number;
}

function groupAttendees(list: Attendee[]): GroupedAttendee[] {
  const map = new Map<string, GroupedAttendee>();

  list.forEach((item) => {
    const cleanName = (item.name || '').trim().replace(/\s+/g, '');
    const key = `${item.grade}-${item.classNum}-${cleanName}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        ids: [item.id],
        grade: item.grade,
        classNum: item.classNum,
        name: (item.name || '').trim(),
        relations: [...item.relations],
        attendeeCount: item.attendeeCount || item.relations.length,
        createdTimes: item.createdAt ? [item.createdAt] : [],
        isDuplicate: false,
        duplicateCount: 1
      });
    } else {
      existing.ids.push(item.id);
      existing.isDuplicate = true;
      existing.duplicateCount += 1;
      item.relations.forEach((r) => {
        if (!existing.relations.includes(r)) {
          existing.relations.push(r);
        }
      });
      existing.attendeeCount = existing.relations.length;
      if (item.createdAt && !existing.createdTimes.includes(item.createdAt)) {
        existing.createdTimes.push(item.createdAt);
      }
    }
  });

  return Array.from(map.values());
}

function getSortedGroupedAttendees(groups: GroupedAttendee[]): GroupedAttendee[] {
  return groups.slice().sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.classNum !== b.classNum) return a.classNum - b.classNum;
    return a.name.localeCompare(b.name, 'ko', { sensitivity: 'base' });
  });
}

function populateAdminClassFilter() {
  const currentGrade = adminFilterGrade.value;
  adminFilterClass.innerHTML = '<option value="all">전체 반</option>';

  let maxC = getMaxClassAcrossGrades();
  if (currentGrade !== 'all') {
    maxC = GRADE_CONFIG[parseInt(currentGrade, 10)]?.maxClass || 10;
  }

  for (let c = 1; c <= maxC; c++) {
    const opt = document.createElement('option');
    opt.value = String(c);
    opt.textContent = `${c}반`;
    adminFilterClass.appendChild(opt);
  }
}

adminFilterGrade.addEventListener('change', () => {
  populateAdminClassFilter();
  renderAdminAttendeesTable();
});
adminFilterClass.addEventListener('change', renderAdminAttendeesTable);
adminFilterSearch.addEventListener('input', renderAdminAttendeesTable);

function renderAdminAttendeesTable() {
  const gFilter = adminFilterGrade.value;
  const cFilter = adminFilterClass.value;
  const q = adminFilterSearch.value.trim().toLowerCase();

  const filtered = attendees.filter((a) => {
    if (gFilter !== 'all' && a.grade !== parseInt(gFilter, 10)) return false;
    if (cFilter !== 'all' && a.classNum !== parseInt(cFilter, 10)) return false;
    if (q && !a.name.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group duplicate records for the same student into 1 entry
  const grouped = groupAttendees(filtered);
  const sorted = getSortedGroupedAttendees(grouped);

  const duplicateCountTotal = filtered.length - sorted.length;
  if (duplicateCountTotal > 0) {
    filteredRecordsCount.textContent = `${sorted.length} (중복 접수 ${duplicateCountTotal}건)`;
  } else {
    filteredRecordsCount.textContent = String(sorted.length);
  }

  adminAttendeesTbody.innerHTML = '';

  if (sorted.length === 0) {
    adminAttendeesTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:var(--text-sub);">
          등록된 참석자 내역이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  sorted.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const badges = item.relations.map((r) => `<span class="badge-rel">${escapeHtml(r)}</span>`).join('');

    const dupBadge = item.isDuplicate
      ? `<span class="badge-duplicate" title="동일 학생으로 ${item.duplicateCount}회 등록되어 1건으로 통합되었습니다.">중복데이터 (${item.duplicateCount}건)</span>`
      : '';

    let timeHtml = '';
    if (item.createdTimes.length <= 1) {
      timeHtml = `<span style="font-size:0.8rem; color:var(--text-muted);">${item.createdTimes[0] || '-'}</span>`;
    } else {
      timeHtml =
        `<div class="time-multi-wrap">` +
        item.createdTimes.map((t, tIdx) => `<span class="time-sub-item tag-dup">${tIdx + 1}차: ${escapeHtml(t)}</span>`).join('') +
        `</div>`;
    }

    tr.innerHTML = `
      <td style="color:var(--text-sub);">${idx + 1}</td>
      <td><strong>${item.grade}학년 ${item.classNum}반</strong></td>
      <td><strong>${escapeHtml(item.name)}</strong>${dupBadge}</td>
      <td>${badges}</td>
      <td style="text-align:center;"><strong>${item.attendeeCount}</strong>명</td>
      <td>${timeHtml}</td>
      <td style="text-align:center;">
        <button type="button" class="btn-row-del" data-key="${item.key}">삭제</button>
      </td>
    `;

    const delBtn = tr.querySelector('.btn-row-del') as HTMLButtonElement;
    delBtn.addEventListener('click', () => {
      deleteAttendeeGroup(item);
    });

    adminAttendeesTbody.appendChild(tr);
  });
}

function deleteAttendeeGroup(group: GroupedAttendee) {
  const msg = group.isDuplicate
    ? `[${group.name}] 학생의 등록 내역 (중복 ${group.duplicateCount}건 포함)을 모두 삭제하시겠습니까?`
    : `[${group.name}] 학생의 참석 등록 내역을 삭제하시겠습니까?`;

  if (confirm(msg)) {
    const idSet = new Set(group.ids);
    attendees = attendees.filter((a) => !idSet.has(a.id));
    saveDataLocally();
    renderAdminAll();

    // Synchronize deletion to Cloud Firestore for all IDs of this student
    Promise.all(group.ids.map((id) => deleteAttendeeDoc(id)))
      .then(() => {
        showToast(`${group.name} 학생 정보가 삭제되었습니다.`);
      })
      .catch((err) => {
        console.error('Failed to delete from Cloud Firestore', err);
      });
  }
}

function escapeHtml(str: string) {
  return String(str).replace(/[&<>"']/g, (m) => {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[m];
  });
}

// --- 6. Google Sheets, CSV & PDF Download ---
function generateSortedCsvContent() {
  const groupedList = getSortedGroupedAttendees(groupAttendees(attendees));
  let csv = '\uFEFF';
  csv += '번호,학년,반,학생이름,중복여부,참석관계,학부모인원수,등록시간\n';

  groupedList.forEach((a, i) => {
    const relText = a.relations.join(' / ');
    const dupText = a.isDuplicate ? `중복(${a.duplicateCount}건)` : '정상(1건)';
    const timesText =
      a.createdTimes.length > 1
        ? a.createdTimes.map((t, idx) => `${idx + 1}차: ${t}`).join(' | ')
        : a.createdTimes[0] || '';
    csv += `${i + 1},${a.grade}학년,${a.classNum}반,"${a.name}","${dupText}","${relText}",${a.attendeeCount},"${timesText}"\n`;
  });

  return csv;
}

function triggerDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

btnExportGsheet.addEventListener('click', () => {
  if (attendees.length === 0) {
    alert('다운로드할 참석자 명단이 없습니다.');
    return;
  }
  modalGsheetGuide.classList.add('show');
});

btnCloseGsheetModal.addEventListener('click', () => {
  modalGsheetGuide.classList.remove('show');
});

btnConfirmGsheetDownload.addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = schoolName ? `${schoolName}_` : '중학교_';
  const csv = generateSortedCsvContent();
  triggerDownload(csv, `${prefix}학부모공개수업_명단_구글시트용_${today}.csv`);
  modalGsheetGuide.classList.remove('show');
  showToast('구글시트용 파일이 다운로드되었습니다.');
});

btnExportCsv.addEventListener('click', () => {
  if (attendees.length === 0) {
    alert('다운로드할 참석자 명단이 없습니다.');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const prefix = schoolName ? `${schoolName}_` : '중학교_';
  const csv = generateSortedCsvContent();
  triggerDownload(csv, `${prefix}학부모공개수업_명단_${today}.csv`);
  showToast('엑셀 명단이 정렬되어 다운로드되었습니다.');
});

function generateStatsCsvContent() {
  let csv = '\uFEFF';
  csv += '학년,반,학생 정원(명),참석 학생 수(명),참석율(%),참석 학부모 수(명)\n';

  const grouped = groupAttendees(attendees);

  for (let g = 1; g <= 3; g++) {
    const numClasses = gradeClassCounts[g] || 0;
    const gradeGrouped = grouped.filter((a) => a.grade === g);
    for (let c = 1; c <= numClasses; c++) {
      const classGrouped = gradeGrouped.filter((a) => a.classNum === c);
      const pCount = classGrouped.reduce((sum, a) => sum + (a.attendeeCount || 1), 0);
      const sCount = classGrouped.length;
      const cap = (classCapacities[g] && classCapacities[g][c]) || 25;
      const rate = cap > 0 ? ((sCount / cap) * 100).toFixed(1) : '0.0';
      csv += `${g}학년,${c}반,${cap},${sCount},${rate}%,${pCount}\n`;
    }
  }

  const totalCap = getTotalCapacity();
  const totalStudents = grouped.length;
  const totalParents = grouped.reduce((sum, a) => sum + (a.attendeeCount || 1), 0);
  const totalRate = totalCap > 0 ? ((totalStudents / totalCap) * 100).toFixed(1) : '0.0';
  csv += `전교 총합계,-,${totalCap},${totalStudents},${totalRate}%,${totalParents}\n`;

  return csv;
}

btnExportStatsCsv.addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = schoolName ? `${schoolName}_` : '중학교_';
  const csv = generateStatsCsvContent();
  triggerDownload(csv, `${prefix}학부모공개수업_반별통계_참석율_${today}.csv`);
  showToast('반별 통계 및 참석률 표가 다운로드되었습니다.');
});

// PDF Export Function (Exports only statistics cards and matrix table as seen on screen, omitting attendee list)
async function exportStatsAsPdf() {
  const target = document.getElementById('admin-stats-report-area');
  if (!target) return;

  const schoolTitle = schoolName ? `${schoolName} ` : '';
  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const printTitle = document.getElementById('print-report-title');
  const printTime = document.getElementById('print-report-time');
  const printSchool = document.getElementById('print-report-school-badge');
  if (printTitle) printTitle.textContent = `${schoolTitle}학부모 공개수업 종합 집계 및 반별 통계 보고서`;
  if (printTime) printTime.textContent = `출력 일시: ${dateStr}`;
  if (printSchool) printSchool.textContent = schoolName || '중학교';

  showToast('통계 현황 PDF 문서를 생성하는 중입니다...');

  const printHeader = document.getElementById('print-report-header');
  const editBtn = document.getElementById('btn-matrix-edit-cap');

  try {
    if (printHeader) printHeader.style.display = 'block';
    if (editBtn) editBtn.style.display = 'none';

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1280
    });

    if (printHeader) printHeader.style.display = '';
    if (editBtn) editBtn.style.display = '';

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 10;
    const maxContentWidth = pageWidth - margin * 2;
    const maxContentHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(maxContentWidth / imgWidth, maxContentHeight / imgHeight);

    const printWidth = imgWidth * ratio;
    const printHeight = imgHeight * ratio;

    const x = (pageWidth - printWidth) / 2;
    const y = margin;

    pdf.addImage(imgData, 'PNG', x, y, printWidth, printHeight);

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `${schoolName ? schoolName + '_' : ''}학부모공개수업_통계현황_${todayStr}.pdf`;

    pdf.save(filename);
    showToast('통계현황 PDF가 성공적으로 저장되었습니다.');
  } catch (err) {
    if (printHeader) printHeader.style.display = '';
    if (editBtn) editBtn.style.display = '';
    console.error('Failed to generate PDF via html2canvas', err);
    showToast('PDF 인쇄 창을 실행합니다...');
    window.print();
  }
}

if (btnExportPdf) {
  btnExportPdf.addEventListener('click', exportStatsAsPdf);
}

// --- 7. Grade Class Counts & Student Capacity Modal Handlers ---
let tempClassCounts: ClassCounts = { 1: 8, 2: 10, 3: 9 };
let tempCapacities: ClassCapacities = {};

function openCapacityModal() {
  if (modalSchoolNameInput) {
    modalSchoolNameInput.value = schoolName;
  }

  tempClassCounts = {
    1: gradeClassCounts[1] || 8,
    2: gradeClassCounts[2] || 10,
    3: gradeClassCounts[3] || 9
  };
  tempCapacities = JSON.parse(JSON.stringify(classCapacities));

  if (classCountGrade1) classCountGrade1.value = String(tempClassCounts[1]);
  if (classCountGrade2) classCountGrade2.value = String(tempClassCounts[2]);
  if (classCountGrade3) classCountGrade3.value = String(tempClassCounts[3]);

  for (let g = 1; g <= 3; g++) {
    renderGradeCapacityGrid(g);
  }
  updateCapacityModalSums();
  modalCapacity.classList.add('show');
}

function closeCapacityModal() {
  modalCapacity.classList.remove('show');
}

function renderGradeCapacityGrid(g: number) {
  const grids: { [key: number]: HTMLElement | null } = {
    1: capacityGridGrade1,
    2: capacityGridGrade2,
    3: capacityGridGrade3
  };
  const grid = grids[g];
  if (!grid) return;

  const titleEl = document.getElementById(`cap-section-title-grade-${g}`);
  if (titleEl) {
    titleEl.textContent = `${g}학년 (1~${tempClassCounts[g]}반)`;
  }

  grid.innerHTML = '';
  const maxC = tempClassCounts[g];
  if (!tempCapacities[g]) tempCapacities[g] = {};

  for (let c = 1; c <= maxC; c++) {
    const currentVal =
      (tempCapacities[g] && tempCapacities[g][c]) ||
      (classCapacities[g] && classCapacities[g][c]) ||
      25;
    tempCapacities[g][c] = currentVal;

    const box = document.createElement('div');
    box.className = 'capacity-input-box';
    box.innerHTML = `
      <label for="cap-input-${g}-${c}">${c}반</label>
      <input type="number" id="cap-input-${g}-${c}" data-grade="${g}" data-class="${c}" min="1" max="60" value="${currentVal}" />
      <span style="font-size:0.75rem; color:var(--text-muted);">명</span>
    `;
    const inp = box.querySelector('input') as HTMLInputElement;
    inp.addEventListener('input', function () {
      const val = parseInt(this.value, 10);
      tempCapacities[g][c] = val && val > 0 ? val : 0;
      updateCapacityModalSums();
    });
    grid.appendChild(box);
  }
}

function onClassCountChanged(g: number, newCount: number) {
  newCount = Math.max(1, Math.min(20, parseInt(String(newCount), 10) || 1));
  tempClassCounts[g] = newCount;
  const inputEl = document.getElementById(`class-count-grade-${g}`) as HTMLInputElement | null;
  if (inputEl) inputEl.value = String(newCount);

  renderGradeCapacityGrid(g);
  updateCapacityModalSums();
}

function updateCapacityModalSums() {
  let grandSum = 0;
  let totalClasses = 0;

  for (let g = 1; g <= 3; g++) {
    let gSum = 0;
    const maxC = tempClassCounts[g];
    totalClasses += maxC;
    for (let c = 1; c <= maxC; c++) {
      const inp = document.getElementById(`cap-input-${g}-${c}`) as HTMLInputElement | null;
      const val = inp
        ? parseInt(inp.value, 10) || 0
        : (tempCapacities[g] && tempCapacities[g][c]) || 25;
      gSum += val;
    }
    grandSum += gSum;
    const sumEl = document.getElementById(`cap-sum-grade-${g}`);
    if (sumEl) sumEl.textContent = `총 ${gSum.toLocaleString()}명`;
  }

  if (capSumClasses) capSumClasses.textContent = String(totalClasses);
  if (capSumTotal) capSumTotal.textContent = grandSum.toLocaleString();
}

function saveCapacityModalValues() {
  if (modalSchoolNameInput) {
    saveSchoolName(modalSchoolNameInput.value, false);
  }

  gradeClassCounts = {
    1: Math.max(1, Math.min(20, parseInt(String(tempClassCounts[1]), 10) || 8)),
    2: Math.max(1, Math.min(20, parseInt(String(tempClassCounts[2]), 10) || 10)),
    3: Math.max(1, Math.min(20, parseInt(String(tempClassCounts[3]), 10) || 9))
  };
  saveClassCountsLocally();

  const newCaps: ClassCapacities = {};
  for (let g = 1; g <= 3; g++) {
    newCaps[g] = {};
    const maxC = gradeClassCounts[g];
    for (let c = 1; c <= maxC; c++) {
      const inp = document.getElementById(`cap-input-${g}-${c}`) as HTMLInputElement | null;
      let val = inp ? parseInt(inp.value, 10) : (tempCapacities[g] && tempCapacities[g][c]) || 25;
      if (isNaN(val) || val <= 0) val = 25;
      newCaps[g][c] = val;
    }
  }
  classCapacities = newCaps;
  saveCapacitiesLocally();

  // Sync to Cloud Firestore
  saveSettingDoc('classCounts', gradeClassCounts).catch(console.error);
  saveSettingDoc('capacities', classCapacities).catch(console.error);

  closeCapacityModal();

  updateSchoolNameDisplay();
  updateClassChipsForGrade(selectedGradeInForm);
  populateAdminClassFilter();
  renderAdminAll();

  showToast('학년별 학급 수 및 학생 정원이 저장되어 통계에 즉시 반영되었습니다.');
}

function batchApplyCapacity() {
  const val = parseInt(batchCapacityInput.value, 10);
  if (!val || val < 1 || val > 100) {
    alert('올바른 학생 정원 인원수(1~100)를 입력해주세요.');
    return;
  }

  for (let g = 1; g <= 3; g++) {
    const maxC = tempClassCounts[g];
    for (let c = 1; c <= maxC; c++) {
      if (!tempCapacities[g]) tempCapacities[g] = {};
      tempCapacities[g][c] = val;
      const inp = document.getElementById(`cap-input-${g}-${c}`) as HTMLInputElement | null;
      if (inp) inp.value = String(val);
    }
  }
  updateCapacityModalSums();
  showToast(`모든 반의 정원이 ${val}명으로 일괄 변경되었습니다.`);
}

modalCapacity.addEventListener('click', function (e) {
  const target = e.target as HTMLElement | null;
  const stepperBtn = target?.closest('.btn-stepper') as HTMLElement | null;
  if (!stepperBtn) return;
  const action = stepperBtn.dataset.action;
  const grade = parseInt(stepperBtn.dataset.grade || '0', 10);
  if (!grade || !GRADE_CONFIG[grade]) return;

  let current = tempClassCounts[grade] || 8;
  if (action === 'plus' || action === 'inc') {
    if (current < 20) current++;
  } else if (action === 'minus' || action === 'dec') {
    if (current > 1) current--;
  }

  onClassCountChanged(grade, current);
});

[classCountGrade1, classCountGrade2, classCountGrade3].forEach((input) => {
  if (!input) return;
  const handleCountChange = function (this: HTMLInputElement) {
    const grade = parseInt(this.dataset.grade || '0', 10);
    let val = parseInt(this.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 20) val = 20;
    this.value = String(val);
    onClassCountChanged(grade, val);
  };
  input.addEventListener('change', handleCountChange);
  input.addEventListener('input', handleCountChange);
});

btnOpenCapacityModal.addEventListener('click', openCapacityModal);
btnMatrixEditCap.addEventListener('click', openCapacityModal);
btnCancelCapacity.addEventListener('click', closeCapacityModal);
btnSaveCapacity.addEventListener('click', saveCapacityModalValues);
btnBatchApplyCapacity.addEventListener('click', batchApplyCapacity);

// Admin School Name Event Listeners
if (btnAdminSaveSchool) {
  btnAdminSaveSchool.addEventListener('click', () => {
    saveSchoolName(undefined, true);
  });
}

if (adminSchoolNameInput) {
  adminSchoolNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSchoolName(undefined, true);
      this.blur();
    }
  });

  adminSchoolNameInput.addEventListener('blur', function () {
    saveSchoolName(undefined, false);
  });
}

if (modalSchoolNameInput) {
  modalSchoolNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSchoolName(this.value, true);
      this.blur();
    }
  });
}

// Modal Close Buttons
if (btnClosePwdX) {
  btnClosePwdX.addEventListener('click', () => {
    modalPassword.classList.remove('show');
  });
}

if (btnCloseCapacityX) {
  btnCloseCapacityX.addEventListener('click', () => {
    closeCapacityModal();
  });
}

if (btnCloseResetX) {
  btnCloseResetX.addEventListener('click', () => {
    modalResetConfirm.classList.remove('show');
  });
}

if (btnCloseGsheetX) {
  btnCloseGsheetX.addEventListener('click', () => {
    modalGsheetGuide.classList.remove('show');
  });
}

if (btnCloseHomeLinkX) {
  btnCloseHomeLinkX.addEventListener('click', closeHomeLinkModal);
}

if (btnCancelHomeLink) {
  btnCancelHomeLink.addEventListener('click', closeHomeLinkModal);
}

if (btnOpenHomeLinkModal) {
  btnOpenHomeLinkModal.addEventListener('click', openHomeLinkModal);
}

const btnQuickOpenHomeLink = document.getElementById('btn-quick-open-homelink') as HTMLButtonElement | null;
if (btnQuickOpenHomeLink) {
  btnQuickOpenHomeLink.addEventListener('click', () => {
    closeCapacityModal();
    openHomeLinkModal();
  });
}

if (homelinkTextInput) {
  homelinkTextInput.addEventListener('input', updateHomeLinkPreview);
}

if (homelinkEnableCheckbox) {
  homelinkEnableCheckbox.addEventListener('change', updateHomeLinkPreview);
}

if (btnSaveHomeLink) {
  btnSaveHomeLink.addEventListener('click', async function () {
    const isEnabled = homelinkEnableCheckbox ? homelinkEnableCheckbox.checked : true;
    const text = (homelinkTextInput?.value || '').trim() || DEFAULT_HOME_BUTTON_CONFIG.text;
    let url = (homelinkUrlInput?.value || '').trim();
    if (url) {
      url = normalizeHomeUrl(url);
    }
    let target: '_self' | '_blank' = '_self';
    const checkedRadio = document.querySelector('input[name="homelink-target"]:checked') as HTMLInputElement | null;
    if (checkedRadio && checkedRadio.value === '_blank') {
      target = '_blank';
    }

    homeButtonConfig = {
      enabled: isEnabled,
      text: text,
      url: url,
      target: target
    };

    saveHomeButtonConfigLocally();
    updateHomeButtonUI();
    closeHomeLinkModal();

    showToast('공개수업 홈 링크 설정 저장 중...');

    try {
      await saveSettingDoc('homeButton', homeButtonConfig);
      showToast('공개수업 홈 링크 설정이 클라우드에 실시간 동기화되었습니다!');
    } catch (err) {
      console.warn('Failed to sync homeButton to Firestore', err);
      showToast('클라우드 저장 실패, 로컬에 임시 저장되었습니다.');
    }
  });
}

// --- 8. Reset All Modal (Single-Step Warning & Direct Deletion) ---
btnAdminResetAll.addEventListener('click', () => {
  if (resetModalAttendeeCount) {
    resetModalAttendeeCount.textContent = String(attendees.length);
  }
  modalResetConfirm.classList.add('show');
});

btnCancelReset.addEventListener('click', () => {
  modalResetConfirm.classList.remove('show');
});

btnDoReset.addEventListener('click', () => {
  attendees = [];
  saveDataLocally();
  modalResetConfirm.classList.remove('show');
  renderAdminAll();

  // Reset Cloud Firestore
  resetAllAttendees()
    .then(() => {
      showToast('모든 데이터가 삭제되었습니다.');
    })
    .catch((err) => {
      console.error('Failed to reset Cloud Firestore', err);
      showToast('클라우드 데이터 초기화 중 오류가 발생했습니다.');
    });
});

// --- 9. Sample Data Generator (Cloud Firestore Integrated) ---
btnSampleData.addEventListener('click', () => {
  const sampleList = [
    { grade: 1, classNum: 1, name: '김민준', relations: ['부', '모'], attendeeCount: 2 },
    { grade: 1, classNum: 3, name: '이서연', relations: ['모'], attendeeCount: 1 },
    { grade: 1, classNum: 5, name: '박도윤', relations: ['부'], attendeeCount: 1 },
    { grade: 1, classNum: 8, name: '정시우', relations: ['부', '모'], attendeeCount: 2 },
    { grade: 2, classNum: 2, name: '최지우', relations: ['모'], attendeeCount: 1 },
    { grade: 2, classNum: 4, name: '한예준', relations: ['부', '모'], attendeeCount: 2 },
    { grade: 2, classNum: 7, name: '오하은', relations: ['모', '기타(조모)'], attendeeCount: 2 },
    { grade: 2, classNum: 10, name: '윤지후', relations: ['부'], attendeeCount: 1 },
    { grade: 3, classNum: 1, name: '송채원', relations: ['모'], attendeeCount: 1 },
    { grade: 3, classNum: 3, name: '임서진', relations: ['부', '모'], attendeeCount: 2 },
    { grade: 3, classNum: 6, name: '강유찬', relations: ['부'], attendeeCount: 1 },
    { grade: 3, classNum: 9, name: '배지민', relations: ['모'], attendeeCount: 1 }
  ];

  const now = new Date();
  const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const formatted: Attendee[] = sampleList.map((item, idx) => ({
    id: 'att_sample_' + idx + '_' + Date.now(),
    grade: item.grade,
    classNum: item.classNum,
    name: item.name,
    relations: item.relations,
    attendeeCount: item.attendeeCount,
    createdAt: timeStr
  }));

  attendees = formatted;
  saveDataLocally();
  renderAdminAll();

  // Save to Cloud Firestore
  batchAddAttendees(formatted)
    .then(() => {
      showToast('중학교 예시 데이터 12건이 클라우드에 등록되었습니다.');
    })
    .catch((err) => {
      console.error('Failed to sync sample data', err);
    });
});

// Real-time synchronization across local browser tabs
window.addEventListener('storage', (e) => {
  if (e.key === SCHOOL_NAME_STORAGE_KEY) {
    loadSchoolName();
  } else if (e.key === CLASS_COUNT_STORAGE_KEY) {
    loadClassCounts();
    updateClassChipsForGrade(selectedGradeInForm);
    populateAdminClassFilter();
    renderAdminAll();
  } else if (e.key === CAPACITY_STORAGE_KEY) {
    loadCapacities();
    renderAdminAll();
  } else if (e.key === HOME_BUTTON_STORAGE_KEY) {
    loadHomeButtonConfig();
  } else if (e.key === STORAGE_KEY) {
    loadData();
    renderAdminAll();
  }
});

// --- Boot Initialization & Real-Time Cloud Listeners ---
// 1. Initial fast local load
loadSchoolName();
loadClassCounts();
loadData();
loadCapacities();
loadHomeButtonConfig();
initChartControls();
updateClassChipsForGrade(1);
updateSyncStatus(true, '클라우드 동기화 연결 중...');

// 2. Test Cloud Firestore connection
testFirestoreConnection().then((connected) => {
  if (connected) {
    updateSyncStatus(true, '클라우드 실시간 동기화 활성');
  } else {
    updateSyncStatus(false, '오프라인 캐시 모드 (재연결 시도 중)');
  }
});

// 3. Subscribe to Real-Time Cloud Attendees Collection
// THIS IS THE CORE OF MULTI-DEVICE REAL-TIME SYNC:
// When a phone submits attendance, onSnapshot automatically fires on the laptop!
subscribeAttendees(
  (cloudAttendees) => {
    // If cloud has data, update attendees list and refresh UI
    attendees = cloudAttendees;
    saveDataLocally();
    if (isAdminLoggedIn) {
      renderAdminAll();
    }
    updateSyncStatus(true, `실시간 동기화 완료 (${attendees.length}명)`);
  },
  (err) => {
    console.warn('Real-time attendees subscription warning:', err);
    updateSyncStatus(false, '클라우드 재연결 중...');
  }
);

// 4. Subscribe to Real-Time Cloud Settings
subscribeSettings((cloudSettings) => {
  let changed = false;

  if (cloudSettings.schoolName !== undefined && cloudSettings.schoolName !== schoolName) {
    schoolName = cloudSettings.schoolName;
    try {
      localStorage.setItem(SCHOOL_NAME_STORAGE_KEY, schoolName);
    } catch (e) {}
    updateSchoolNameDisplay();
  }

  if (cloudSettings.classCounts) {
    gradeClassCounts = {
      1: Number(cloudSettings.classCounts[1]) || DEFAULT_CLASS_COUNTS[1],
      2: Number(cloudSettings.classCounts[2]) || DEFAULT_CLASS_COUNTS[2],
      3: Number(cloudSettings.classCounts[3]) || DEFAULT_CLASS_COUNTS[3]
    };
    saveClassCountsLocally();
    changed = true;
  }

  if (cloudSettings.capacities) {
    const cleanCaps: ClassCapacities = {};
    for (let g = 1; g <= 3; g++) {
      cleanCaps[g] = {};
      const maxC = gradeClassCounts[g] || 10;
      for (let c = 1; c <= maxC; c++) {
        const val = (cloudSettings.capacities[g] && cloudSettings.capacities[g][c]) || 25;
        cleanCaps[g][c] = Number(val) || 25;
      }
    }
    classCapacities = cleanCaps;
    saveCapacitiesLocally();
    changed = true;
  }

  if (cloudSettings.homeButton) {
    homeButtonConfig = {
      enabled: cloudSettings.homeButton.enabled !== false,
      text: (cloudSettings.homeButton.text && typeof cloudSettings.homeButton.text === 'string' && cloudSettings.homeButton.text.trim()) ? cloudSettings.homeButton.text.trim() : DEFAULT_HOME_BUTTON_CONFIG.text,
      url: (cloudSettings.homeButton.url && typeof cloudSettings.homeButton.url === 'string') ? cloudSettings.homeButton.url.trim() : '',
      target: cloudSettings.homeButton.target === '_blank' ? '_blank' : '_self'
    };
    saveHomeButtonConfigLocally();
    updateHomeButtonUI();
  }

  if (changed) {
    updateClassChipsForGrade(selectedGradeInForm);
    populateAdminClassFilter();
    if (isAdminLoggedIn) {
      renderAdminAll();
    }
  }
});

// 5. Mobile & Multi-Device Auto-Sync and Manual Refresh
async function refreshDataFromCloud(silent = true) {
  try {
    const list = await getLatestAttendees();
    if (Array.isArray(list)) {
      attendees = list;
      saveDataLocally();
      if (isAdminLoggedIn) {
        renderAdminAll();
      }
      updateSyncStatus(true, `실시간 동기화 완료 (${attendees.length}명)`);
      if (!silent) {
        showToast(`최신 데이터가 동기화되었습니다. (총 ${attendees.length}명)`);
      }
    }
  } catch (err) {
    console.warn('Manual cloud sync failed', err);
    if (!silent) {
      showToast('클라우드 동기화 재시도 중...');
    }
  }
}

// When returning from background or unlocking phone, pull fresh data immediately
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshDataFromCloud(true);
  }
});

window.addEventListener('focus', () => {
  refreshDataFromCloud(true);
});

window.addEventListener('online', () => {
  updateSyncStatus(true, '네트워크 연결 복구, 실시간 동기화 중...');
  refreshDataFromCloud(true);
});

// Cloud Database Info & Multi-Device Sync Modal Handlers
const modalCloudInfo = document.getElementById('modal-cloud-info') as HTMLElement | null;
const btnCloseCloudInfo = document.getElementById('btn-close-cloud-info') as HTMLButtonElement | null;
const btnCloseCloudInfoBack = document.getElementById('btn-close-cloud-info-back') as HTMLButtonElement | null;
const btnForceRefreshCloud = document.getElementById('btn-force-refresh-cloud') as HTMLButtonElement | null;
const infoCloudProject = document.getElementById('info-cloud-project') as HTMLElement | null;
const infoCloudDatabase = document.getElementById('info-cloud-database') as HTMLElement | null;
const infoCloudCount = document.getElementById('info-cloud-count') as HTMLElement | null;

function openCloudInfoModal() {
  const info = getFirestoreConfigInfo();
  if (infoCloudProject) infoCloudProject.textContent = info.projectId;
  if (infoCloudDatabase) infoCloudDatabase.textContent = info.databaseId;
  if (infoCloudCount) infoCloudCount.textContent = `${attendees.length}명`;
  if (modalCloudInfo) {
    modalCloudInfo.classList.add('show');
  }
}

function closeCloudInfoModal() {
  if (modalCloudInfo) {
    modalCloudInfo.classList.remove('show');
  }
}

if (syncBadge) {
  syncBadge.style.cursor = 'pointer';
  syncBadge.addEventListener('click', () => {
    openCloudInfoModal();
    refreshDataFromCloud(true);
  });
}

if (adminCloudIndicator) {
  adminCloudIndicator.addEventListener('click', () => {
    openCloudInfoModal();
    refreshDataFromCloud(true);
  });
}

if (btnCloseCloudInfo) {
  btnCloseCloudInfo.addEventListener('click', closeCloudInfoModal);
}
if (btnCloseCloudInfoBack) {
  btnCloseCloudInfoBack.addEventListener('click', closeCloudInfoModal);
}
if (modalCloudInfo) {
  modalCloudInfo.addEventListener('click', (e) => {
    if (e.target === modalCloudInfo) {
      closeCloudInfoModal();
    }
  });
}

if (btnForceRefreshCloud) {
  btnForceRefreshCloud.addEventListener('click', async () => {
    btnForceRefreshCloud.textContent = '동기화 중...';
    await refreshDataFromCloud(false);
    btnForceRefreshCloud.textContent = '🔄 지금 클라우드 데이터 새로고침';
    if (infoCloudCount) infoCloudCount.textContent = `${attendees.length}명`;
  });
}

