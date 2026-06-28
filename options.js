document.addEventListener('DOMContentLoaded', () => {
  const newUrlInput = document.getElementById('newUrlInput');
  const addUrlBtn = document.getElementById('addUrlBtn');
  const urlList = document.getElementById('urlList');
  const saveOptionsBtn = document.getElementById('saveOptionsBtn');

  let currentUrls = [];

  // 1. 스토리지에서 기존 URL 설정 불러오기
  chrome.storage.local.get(['targetUrls'], (result) => {
    currentUrls = result.targetUrls || ['youtube.com'];
    renderUrlList();
  });

  // 2. URL 리스트 렌더링 함수
  function renderUrlList() {
    urlList.innerHTML = '';
    if (currentUrls.length === 0) {
      urlList.innerHTML = '<li style="color:#6b7280; background:none; border:none; justify-content:center;">등록된 사이트가 없습니다.</li>';
      return;
    }

    currentUrls.forEach((url, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span style="color:#e5e7eb;">${url}</span>
        <button data-index="${index}" class="delete-btn">삭제</button>
      `;
      urlList.appendChild(li);
    });

    // 삭제 버튼 이벤트
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.getAttribute('data-index');
        currentUrls.splice(index, 1);
        renderUrlList();
      });
    });
  }

  // 3. URL 추가 이벤트
  addUrlBtn.addEventListener('click', () => {
    const newUrl = newUrlInput.value.trim();
    if (newUrl && !currentUrls.includes(newUrl)) {
      currentUrls.push(newUrl);
      newUrlInput.value = '';
      renderUrlList();
    }
  });

  newUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addUrlBtn.click();
  });

  // 4. 전체 저장 버튼 이벤트
  saveOptionsBtn.addEventListener('click', () => {
    chrome.storage.local.set({ targetUrls: currentUrls }, () => {
      const originalText = saveOptionsBtn.textContent;
      saveOptionsBtn.textContent = '저장되었습니다!';
      saveOptionsBtn.style.backgroundColor = '#059669'; // 초록색으로 변경
      
      setTimeout(() => {
        saveOptionsBtn.textContent = originalText;
        saveOptionsBtn.style.backgroundColor = '#2563eb'; // 원래 파란색 복구
      }, 1500);
    });
  });
});