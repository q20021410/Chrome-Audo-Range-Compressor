(() => {
  if (window.isAudioCompressorInjected) return;
  window.isAudioCompressorInjected = true;

  let audioCtx = null;
  let sourceNode = null;
  let compressorNode = null;
  let gainNode = null;
  let isAudioHooked = false;
  let hookedVideoElement = null; 
  
  let activeSettings = null; // 💡 현재 페이지에 적용할 설정을 기억해둡니다.

  function initWebAudioAPI() {
    const videoElements = document.getElementsByTagName('video');
    if (videoElements.length === 0) return false;

    const video = videoElements[0];
    
    if (isAudioHooked && hookedVideoElement === video) return true;

    if (video.dataset.isAudioHooked === 'true' || video.dataset.isAudioHooked === 'failed') {
      hookedVideoElement = video; 
      return false; 
    }

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      video.crossOrigin = "anonymous";
      
      sourceNode = audioCtx.createMediaElementSource(video);
      compressorNode = audioCtx.createDynamicsCompressor();
      gainNode = audioCtx.createGain();

      video.dataset.isAudioHooked = 'true';
      isAudioHooked = true;
      hookedVideoElement = video;

      sourceNode.connect(audioCtx.destination);
      return true;
    } catch (error) {
      video.dataset.isAudioHooked = 'failed';
      hookedVideoElement = video; 
      console.warn("사운드 압축기: 다른 사운드 제어 확장 프로그램과 충돌했거나 F5가 필요합니다.");
      return false;
    }
  }

  function applyCompressorSettings(settings) {
    activeSettings = settings; // 실시간 변경된 설정을 갱신해서 기억합니다.
    
    if (!initWebAudioAPI()) return; 
    if (!audioCtx || !sourceNode) return;

    try {
      sourceNode.disconnect();
      compressorNode.disconnect();
      gainNode.disconnect();

      if (settings.enabled) {
        sourceNode.connect(compressorNode);
        compressorNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        gainNode.gain.value = settings.gain || 1.0;
        compressorNode.threshold.value = settings.threshold || -50;
        compressorNode.knee.value = settings.knee || 40;
        compressorNode.ratio.value = settings.ratio || 12;
        compressorNode.attack.value = settings.attack || 0;
        compressorNode.release.value = settings.release || 0.25;
      } else {
        sourceNode.connect(audioCtx.destination);
      }
    } catch (e) {
      console.error("사운드 압축기 설정 적용 중 오류:", e);
    }
  }

  // 팝업에서 보내는 실시간 변경 신호 수신
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_COMPRESSOR') {
      applyCompressorSettings(request.settings);
    }
    sendResponse({ status: 'ok' }); 
  });

  // 💡 1. 현재 접속 중인 도메인 파악
  const currentDomain = window.location.hostname.replace('www.', '');
  const storageKey = `settings_${currentDomain}`;

  // 💡 2. 내 도메인 전용 설정을 불러옵니다.
  chrome.storage.local.get([storageKey], (result) => {
    const data = result[storageKey];
    if (data && data.settings && data.settings.enabled) {
      activeSettings = data.settings;
    }

    // 새 비디오 요소가 등장했거나 비디오가 변경되었다면 기억해둔 세팅 다시 적용
    setInterval(() => {
      if (activeSettings && activeSettings.enabled) {
        const vids = document.getElementsByTagName('video');
        if (vids.length > 0 && hookedVideoElement !== vids[0]) {
          applyCompressorSettings(activeSettings);
        }
      }
    }, 1000);
  });

})();