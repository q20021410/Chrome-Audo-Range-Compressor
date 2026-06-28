chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 페이지 로딩이 완료되었고, http/https 주소일 때만 실행
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      const urlObj = new URL(tab.url);
      const domain = urlObj.hostname.replace('www.', '');

      // 등록된 타겟 사이트 목록 가져오기
      chrome.storage.local.get(['targetUrls'], (result) => {
        const urls = result.targetUrls || ['youtube.com'];
        const isMatch = urls.some(u => domain.includes(u));

        // 💡 등록된 사이트면 복잡한 권한 검사 생략하고 무조건 주입 시도! (권한 없으면 알아서 튕김)
        if (isMatch) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {
            // 주입 성공 시, 해당 사이트의 저장된 설정값을 불러와서 적용하라고 신호 보냄
            const storageKey = `settings_${domain}`;
            chrome.storage.local.get([storageKey], (settingsResult) => {
              const savedData = settingsResult[storageKey];
              if (savedData && savedData.settings) {
                chrome.tabs.sendMessage(tabId, { 
                  type: 'UPDATE_COMPRESSOR', 
                  settings: savedData.settings 
                }).catch(() => {});
              }
            });
          }).catch(err => {
            // 권한이 없거나 주소가 안 맞아서 주입 실패 시 콘솔에만 조용히 기록
            console.log("스크립트 주입 거부됨 (정상적인 권한 차단):", err);
          });
        }
      });
    } catch (e) { console.error("배경 스크립트 에러:", e); }
  }
});