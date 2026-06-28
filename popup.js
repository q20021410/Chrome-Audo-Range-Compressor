document.addEventListener('DOMContentLoaded', () => {
  const elements = ['gain', 'threshold', 'knee', 'ratio', 'attack', 'release'];
  const inputs = {};
  const displays = {};
  
  const enableToggle = document.getElementById('enableToggle');
  const presetSelect = document.getElementById('presetSelect');
  
  const warningBanner = document.getElementById('warningBanner');
  const addSiteBtn = document.getElementById('addSiteBtn');
  
  let isProgrammaticChange = false;
  let isInitializing = true; 
  let currentDomain = 'default'; // 현재 사이트 도메인 저장 변수

  const presets = {
    default: { gain: 1.0, threshold: -50, knee: 40, ratio: 12, attack: 0, release: 0.25 },
    broadcast: { gain: 1.0, threshold: -35, knee: 25, ratio: 4, attack: 0.05, release: 0.25 },
    limiter: { gain: 1.3, threshold: -50, knee: 5, ratio: 20, attack: 0, release: 0.1 }
  };

  // 💡 1. 팝업이 열리면 가장 먼저 현재 사이트 주소를 확인합니다.
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) {
      try {
        const urlObj = new URL(tabs[0].url);
        currentDomain = urlObj.hostname.replace('www.', ''); 
      } catch(e) { console.error("URL 파싱 에러:", e); }
    }

    // 💡 2. 현재 사이트 전용 사물함(Key) 이름 생성
    const storageKey = `settings_${currentDomain}`;

    // 💡 3. 등록된 사이트 목록과 현재 사이트의 전용 설정을 동시에 불러옵니다.
    chrome.storage.local.get(['targetUrls', storageKey], (result) => {
      
      // 미등록 사이트 경고 배너 로직
      const urls = result.targetUrls || ['youtube.com'];
      if (currentDomain !== 'default' && !urls.includes(currentDomain)) {
        warningBanner.style.display = 'block';
      }

      // 사이트별 개별 설정 적용
      const savedData = result[storageKey];
      if (savedData) {
        // 기존에 저장해둔 설정이 있으면 불러오기
        presetSelect.value = savedData.activePreset || 'default';
        enableToggle.checked = savedData.settings.enabled;
        
        isProgrammaticChange = true;
        elements.forEach(id => {
          if (savedData.settings[id] !== undefined) {
            inputs[id].value = savedData.settings[id];
            inputs[id].dispatchEvent(new Event('input'));
          }
        });
        isProgrammaticChange = false;
      } else {
        // 처음 방문하는 사이트면 '기본 설정'에 'OFF' 상태로 얌전히 둡니다.
        presetSelect.value = 'default';
        enableToggle.checked = false; 
        
        isProgrammaticChange = true;
        elements.forEach(id => {
          inputs[id].value = presets.default[id];
          inputs[id].dispatchEvent(new Event('input'));
        });
        isProgrammaticChange = false;
      }
      
      // 셋팅이 완벽히 끝났으므로 초기화 방어막 해제
      isInitializing = false;
    });
  });

  // 현재 사이트 즉시 추가 버튼
  addSiteBtn.addEventListener('click', () => {
    if (currentDomain === 'default') return;
    
    // 💡 서브도메인(www 등)이 있는 경우와 없는 경우를 모두 확실하게 요청합니다.
    const originsToRequest = [
      `*://*.${currentDomain}/*`, 
      `*://${currentDomain}/*`
    ];

    chrome.permissions.request({ origins: originsToRequest }, (granted) => {
      // 💡 만약 크롬이 권한 창을 안 띄우고 에러를 뱉었다면 원인을 콘솔창에 찍어줍니다.
      if (chrome.runtime.lastError) {
        console.error("권한 요청 에러:", chrome.runtime.lastError.message);
      }

      if (granted) {
        chrome.storage.local.get(['targetUrls'], (result) => {
          const urls = result.targetUrls || ['youtube.com'];
          if (!urls.includes(currentDomain)) {
            urls.push(currentDomain);
            chrome.storage.local.set({ targetUrls: urls }, () => {
              addSiteBtn.textContent = '추가 완료! (새로고침 필요)';
              addSiteBtn.style.backgroundColor = '#10b981';
              setTimeout(() => warningBanner.style.display = 'none', 1500);
            });
          }
        });
      } else {
        addSiteBtn.textContent = '권한이 거부되었습니다';
        addSiteBtn.style.backgroundColor = '#ef4444';
      }
    });
  });

  // 슬라이더 UI 이벤트 바인딩
  elements.forEach(id => {
    inputs[id] = document.getElementById(id);
    displays[id] = document.getElementById(`${id}Val`);
    
    inputs[id].addEventListener('input', (e) => {
      let val = e.target.value;
      if (id === 'threshold') val += 'dB';
      if (id === 'attack' || id === 'release') val += 's';
      displays[id].textContent = val;
      
      if (!isProgrammaticChange && !isInitializing) {
        presetSelect.value = 'custom';
        sendUpdateToContentScript();
      }
    });
  });

  enableToggle.addEventListener('change', () => {
    if (!isInitializing) sendUpdateToContentScript();
  });

  presetSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (presets[selected]) {
      const p = presets[selected];
      isProgrammaticChange = true;
      elements.forEach(id => {
        inputs[id].value = p[id];
        inputs[id].dispatchEvent(new Event('input')); 
      });
      isProgrammaticChange = false;
      
      if (!isInitializing) sendUpdateToContentScript(); 
    }
  });

  function sendUpdateToContentScript() {
    const settings = { enabled: enableToggle.checked };
    elements.forEach(id => { settings[id] = parseFloat(inputs[id].value); });
    
    // 💡 4. 변경된 값을 현재 사이트 전용 사물함에만 저장합니다!
    const dataToSave = {};
    dataToSave[`settings_${currentDomain}`] = {
      settings: settings,
      activePreset: presetSelect.value
    };
    
    chrome.storage.local.set(dataToSave);

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_COMPRESSOR', settings }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  }
});