/* ============================================================
   MD Viewer — app.js
   ============================================================ */

; (function () {
  'use strict';

  /* ---- DOM refs ---- */
  const sidebar = document.getElementById('sidebar');
  const btnSidebar = document.getElementById('btn-sidebar');
  const btnOpen = document.getElementById('btn-open');
  const btnOpenWelcome = document.getElementById('btn-open-welcome');
  const btnSave = document.getElementById('btn-save');
  const btnNew = document.getElementById('btn-new');
  const btnEditToggle = document.getElementById('btn-edit-toggle');
  const btnTheme = document.getElementById('btn-theme');
  const iconMoon = document.getElementById('icon-moon');
  const iconSun = document.getElementById('icon-sun');
  const fileInput = document.getElementById('file-input');
  const fileNameEl = document.getElementById('file-name');
  const welcome = document.getElementById('welcome');
  const preview = document.getElementById('preview');
  const tocEl = document.getElementById('toc');
  const recentList = document.getElementById('recent-list');
  const dropOverlay = document.getElementById('drop-overlay');
  const contentWrapper = document.getElementById('content-wrapper');
  const editorPane = document.getElementById('editor-pane');
  const mdInput = document.getElementById('md-input');

  /* ---- Toast ---- */
  const toast = document.createElement('div');
  toast.id = 'toast';
  document.body.appendChild(toast);
  let toastTimer;
  function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = 'show ' + type;
    toastTimer = setTimeout(() => { toast.className = ''; }, 2800);
  }

  /* ---- State ---- */
  let currentRaw = '';   // raw markdown text
  let currentName = '';   // current filename (without extension)
  let editMode = false;
  let isDirty = false;   // unsaved changes flag

  /** Returns true if it's safe to proceed (no unsaved changes, or user confirmed). */
  function confirmDiscard() {
    if (!isDirty) return true;
    return window.confirm(
      '저장되지 않은 변경 내용이 있습니다.\n\n계속하면 변경 내용이 사라집니다. 계속하시겠습니까?'
    );
  }

  /* ================================================================
     MD Guide Panel
     ================================================================ */
  const GUIDE_DATA = [
    {
      cat: '제목 (Heading)',
      items: [
        { syntax: '# 제목', desc: 'H1 — 가장 큰 제목', insert: '# 제목\n' },
        { syntax: '## 제목', desc: 'H2 — 섹션 제목', insert: '## 제목\n' },
        { syntax: '### 제목', desc: 'H3 — 소제목', insert: '### 제목\n' },
        { syntax: '#### 제목', desc: 'H4', insert: '#### 제목\n' },
      ],
    },
    {
      cat: '텍스트 서식',
      items: [
        { syntax: '**굵게**', desc: '굵은 글씨', insert: '**굵게**' },
        { syntax: '*기울임*', desc: '이탤릭체', insert: '*기울임*' },
        { syntax: '~~취소선~~', desc: '취소선', insert: '~~취소선~~' },
        { syntax: '`인라인 코드`', desc: '인라인 코드', insert: '`코드`' },
        { syntax: '**_굵은기울임_**', desc: '굵은 이탤릭', insert: '**_굵은 기울임_**' },
      ],
    },
    {
      cat: '목록 (List)',
      items: [
        { syntax: '- 항목', desc: '순서 없는 목록', insert: '- 항목\n- 항목\n' },
        { syntax: '1. 항목', desc: '번호 있는 목록', insert: '1. 첫 번째\n2. 두 번째\n' },
        { syntax: '  - 중첩', desc: '들여쓰기 중첩', insert: '- 항목\n  - 중첩 항목\n' },
        { syntax: '- [x] 완료', desc: '체크리스트', insert: '- [x] 완료\n- [ ] 미완료\n' },
      ],
    },
    {
      cat: '링크 · 이미지',
      items: [
        { syntax: '[텍스트](url)', desc: '하이퍼링크', insert: '[링크 텍스트](https://example.com)' },
        { syntax: '![alt](url)', desc: '이미지 삽입', insert: '![설명](이미지_경로.png)' },
        { syntax: '[텍스트][ref]', desc: '참조 링크', insert: '[텍스트][ref]\n\n[ref]: https://example.com' },
      ],
    },
    {
      cat: '코드 블록',
      items: [
        { syntax: '```언어', desc: '펜스드 코드블록', insert: '```javascript\n코드를 입력하세요\n```\n' },
        { syntax: '    코드', desc: '들여쓰기 코드블록', insert: '    코드 (스페이스 4칸)\n' },
      ],
    },
    {
      cat: '표 (Table)',
      items: [
        { syntax: '| 열1 | 열2 |', desc: '기본 표', insert: '| 열1 | 열2 | 열3 |\n|---|---|---|\n| 내용 | 내용 | 내용 |\n' },
        { syntax: '|:---|---:|', desc: '정렬 (왼쪽/오른쪽)', insert: '| 왼쪽 | 가운데 | 오른쪽 |\n|:---|:---:|---:|\n| L | C | R |\n' },
      ],
    },
    {
      cat: '기타',
      items: [
        { syntax: '> 인용', desc: '인용 블록', insert: '> 인용문을 입력하세요\n' },
        { syntax: '---', desc: '수평 구분선', insert: '\n---\n' },
        { syntax: '<!-- -->', desc: 'HTML 주석', insert: '<!-- 주석 -->' },
      ],
    },
  ];

  function buildGuide() {
    const guideList = document.getElementById('guide-list');
    if (!guideList) return;
    guideList.innerHTML = '';

    GUIDE_DATA.forEach(group => {
      const catEl = document.createElement('div');
      catEl.className = 'guide-category';
      catEl.textContent = group.cat;
      guideList.appendChild(catEl);

      group.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'guide-item';
        row.title = item.desc;
        row.innerHTML = `
          <span class="guide-syntax">${escapeHtml(item.syntax)}</span>
          <span class="guide-desc">${item.desc}</span>
          <span class="guide-hint" id="guide-hint-${Math.random().toString(36).slice(2)}"></span>`;

        row.addEventListener('click', () => {
          if (editMode) {
            insertAtCursor(mdInput, item.insert);
            showToast('✏️  삽입됨', '');
          } else {
            navigator.clipboard.writeText(item.insert).then(() => {
              showToast('📋  복사됨: ' + item.syntax, '');
            }).catch(() => {
              showToast('⚠️  복사 실패', 'error');
            });
          }
        });

        // Update hint text based on edit mode dynamically
        row.addEventListener('mouseenter', () => {
          const hint = row.querySelector('.guide-hint');
          if (hint) hint.textContent = editMode ? '삽입' : '복사';
        });

        guideList.appendChild(row);
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Insert text at textarea cursor position */
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
    // Trigger live preview update
    textarea.dispatchEvent(new Event('input'));
  }

  /* Guide toggle */
  const guideToggle = document.getElementById('guide-toggle');
  const guidePanel = document.getElementById('guide-panel');
  if (guideToggle && guidePanel) {
    guideToggle.addEventListener('click', () => {
      const open = guidePanel.classList.toggle('hidden') === false;
      guideToggle.setAttribute('aria-expanded', String(open));
      if (open && !guidePanel.dataset.built) {
        buildGuide();
        guidePanel.dataset.built = '1';
      }
    });
  }


  /* ---- Configure marked.js (v4 compatible) ---- */
  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/<[^>]+>/g, '')       // strip HTML tags
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/--+/g, '-');
  }

  marked.use({
    gfm: true,
    breaks: true,
    renderer: {
      // marked v4: heading(text, level, raw, slugger)
      heading(text, level) {
        const id = slugify(text);
        return `<h${level} id="${id}">${text}</h${level}>`;
      }
    }
  });

  /* ---- Render ---- */
  function renderMarkdown(raw) {
    const html = marked.parse(raw);
    preview.innerHTML = html;

    // Syntax highlighting + copy buttons
    preview.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
      const pre = block.parentElement;
      if (!pre.parentElement.classList.contains('code-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = '복사';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(block.textContent).then(() => {
            copyBtn.textContent = '복사됨 ✓';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = '복사';
              copyBtn.classList.remove('copied');
            }, 1800);
          });
        });
        wrapper.appendChild(copyBtn);
      }
    });

    buildTOC();
  }

  function render(raw, name) {
    currentRaw = raw;
    currentName = name || 'untitled';
    isDirty = false;  // freshly loaded → clean

    // Sync textarea in edit mode
    if (editMode) mdInput.value = raw;

    renderMarkdown(raw);

    // Show preview
    welcome.classList.add('hidden');
    preview.classList.remove('hidden');

    // Update toolbar
    fileNameEl.textContent = currentName + '.md';
    btnSave.disabled = false;

    addRecent(currentName, raw);
  }

  /* ---- TOC ---- */
  function buildTOC() {
    const headings = preview.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) {
      tocEl.innerHTML = '<p class="toc-placeholder">헤딩이 없습니다.</p>';
      return;
    }

    tocEl.innerHTML = '';
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = `toc-item toc-h${level}`;
      a.textContent = h.textContent;
      a.addEventListener('click', e => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tocEl.appendChild(a);
    });

    // Intersection Observer for active TOC item
    setupTocObserver(headings);
  }

  let tocObserver = null;
  function setupTocObserver(headings) {
    if (tocObserver) tocObserver.disconnect();

    const options = {
      root: document.getElementById('content-wrapper'),
      rootMargin: '-60px 0px -70% 0px',
      threshold: 0,
    };

    tocObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocEl.querySelectorAll('.toc-item').forEach(a => a.classList.remove('active'));
          const active = tocEl.querySelector(`a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, options);

    headings.forEach(h => tocObserver.observe(h));
  }

  /* ---- Recent Files (localStorage) ---- */
  const RECENT_KEY = 'mdviewer-recent';
  const MAX_RECENT = 10;

  // localStorage helpers — safe under file:// (SecurityError in some browsers)
  function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  function getRecent() { return storageGet(RECENT_KEY); }

  function addRecent(name, raw) {
    let list = getRecent().filter(r => r.name !== name);
    list.unshift({ name, raw, ts: Date.now() });
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    storageSet(RECENT_KEY, list);
    renderRecent();
  }

  function renderRecent() {
    const list = getRecent();
    recentList.innerHTML = '';
    if (list.length === 0) {
      const li = document.createElement('li');
      li.className = 'recent-item';
      li.style.color = 'var(--text-faint)';
      li.textContent = '최근 파일 없음';
      recentList.appendChild(li);
      return;
    }
    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'recent-item';
      li.title = item.name + '.md';
      li.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8L14 2zm-1 1.5V8H8.5v1H13v1H8.5v1H13v1H8.5v1H17V8.5z"/>
        </svg>
        <span>${item.name}.md</span>`;
      li.addEventListener('click', () => {
        if (!confirmDiscard()) return;
        render(item.raw, item.name);
      });
      recentList.appendChild(li);
    });
  }

  /* ---- File Open ---- */
  function openFile(file) {
    if (!file) return;
    if (!confirmDiscard()) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      showToast('⚠️  .md 또는 .markdown 파일만 지원합니다.', 'error');
      return;
    }
    const name = file.name.replace(/\.(md|markdown|txt)$/i, '');
    const reader = new FileReader();
    reader.onload = e => render(e.target.result, name);
    reader.onerror = () => showToast('파일 읽기 실패', 'error');
    reader.readAsText(file, 'UTF-8');
  }

  btnOpen.addEventListener('click', () => fileInput.click());
  btnOpenWelcome.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    openFile(e.target.files[0]);
    e.target.value = '';   // reset so same file can be re-opened
  });



  /* ---- Edit Mode Toggle ---- */
  function setEditMode(on) {
    editMode = on;
    if (on) {
      editorPane.classList.remove('hidden');
      contentWrapper.classList.add('editing');
      btnEditToggle.classList.add('active');
      btnEditToggle.lastChild.textContent = ' 미리보기';
      // populate textarea with current content
      mdInput.value = currentRaw;
      mdInput.focus();
    } else {
      editorPane.classList.add('hidden');
      contentWrapper.classList.remove('editing');
      btnEditToggle.classList.remove('active');
      btnEditToggle.lastChild.textContent = ' 편집';
    }
  }

  btnEditToggle.addEventListener('click', () => setEditMode(!editMode));

  // Live preview: update on every keystroke
  let previewTimer;
  mdInput.addEventListener('input', () => {
    isDirty = true;  // mark as modified
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      currentRaw = mdInput.value;
      if (currentRaw.trim()) {
        renderMarkdown(currentRaw);
        welcome.classList.add('hidden');
        preview.classList.remove('hidden');
        btnSave.disabled = false;
      } else {
        preview.innerHTML = '';
        preview.classList.add('hidden');
        welcome.classList.remove('hidden');
        btnSave.disabled = true;
      }
    }, 120);
  });

  /* ---- New File ---- */
  btnNew.addEventListener('click', () => {
    if (!confirmDiscard()) return;
    currentName = 'untitled';
    currentRaw = '';
    isDirty = false;
    preview.innerHTML = '';
    preview.classList.add('hidden');
    welcome.classList.add('hidden');
    fileNameEl.textContent = 'untitled.md';
    btnSave.disabled = false;
    setEditMode(true);
    mdInput.value = '';
    mdInput.focus();
    preview.classList.remove('hidden');
    preview.innerHTML = '<p style="color:var(--text-faint);padding:32px 40px;">왼쪽에 마크다운을 작성하면 여기에 실시간으로 렌더링됩니다.</p>';
    showToast('📄  새 파일 — 왼쪽에 작성하세요.');
  });

  /* ---- Sidebar Toggle ---- */
  btnSidebar.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  /* ---- Drag & Drop ---- */
  let dragCounter = 0;

  document.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add('active');
  });
  document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove('active');
    }
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove('active');
    const file = e.dataTransfer.files[0];
    openFile(file);
  });

  /* ---- Keyboard Shortcuts ---- */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); fileInput.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); setEditMode(!editMode); }
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); sidebar.classList.toggle('collapsed'); }
  });

  /* ---- Save as .md (edit-mode aware) ---- */
  async function saveFile() {
    // Read directly from textarea if editing
    if (editMode) currentRaw = mdInput.value;
    if (!currentRaw) return;

    const content = currentRaw;
    const filename = (currentName || 'untitled') + '.md';

    // ── 1) File System Access API (Chrome/Edge: 저장 위치 선택 다이얼로그)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Markdown 파일',
            accept: { 'text/markdown': ['.md'] },
          }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        isDirty = false;
        showToast('✅  저장 완료: ' + fileHandle.name, 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // 사용자가 취소
        // 다른 오류(보안 제한 등)는 폴백으로 계속 진행
      }
    }

    // ── 2) Fallback: 브라우저 기본 다운로드 폴더로 저장
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    isDirty = false;
    showToast('✅  저장 완료: ' + filename, 'success');
  }
  btnSave.addEventListener('click', saveFile);

  /* ---- Theme Toggle ---- */
  function applyTheme(isLight) {
    document.body.classList.toggle('light', isLight);
    iconMoon.classList.toggle('hidden', !isLight);  // 달: 라이트 모드에서 표시 (→다크로 전환)
    iconSun.classList.toggle('hidden', isLight);    // 해: 다크 모드에서 표시 (→라이트로 전환)
    storageSet('mdviewer-theme', isLight ? 'light' : 'dark');
  }

  btnTheme.addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('light'));
  });

  /* ---- Keyboard Shortcuts (extended) ---- */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      applyTheme(!document.body.classList.contains('light'));
    }
  });

  /* ---- Init ---- */
  renderRecent();
  // Restore saved theme (simple string value, not JSON array)
  try {
    if (localStorage.getItem('mdviewer-theme') === 'light') applyTheme(true);
  } catch { /* ignore SecurityError under file:// */ }

})();
