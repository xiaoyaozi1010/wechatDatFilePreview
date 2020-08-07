(function () {
  function getSettings() {
    const settingElement = document.getElementById('image-preview-settings');
    if (settingElement) {
      const data = settingElement.getAttribute('data-settings');
      if (data) {
        return JSON.parse(data);
      }
    }

    throw new Error('数据解析出错');
  }
  const settings = getSettings();
  const isMac = settings.isMac;
  const vscode = acquireVsCodeApi();
  let hasLoadedImage = false;
  const isActive = false;
  const container = document.getElementById('imageWrapper');
  const image = document.createElement('img');
  const nextBtn = document.getElementById('next');
  const preBtn = document.getElementById('previous');
  const exportBtn = document.getElementById('export');
  const errorContainer = document.getElementsByClassName('image-error__container')[0];
  const openBtn = document.getElementById('openFile');
  image.src = settings.src;
  image.classList.add('image-previewer');
  image.addEventListener('load', () => {
    if (hasLoadedImage) {
      return;
    }
    hasLoadedImage = true;
    vscode.postMessage({
      type: 'size',
      value: `${image.naturalWidth}x${image.naturalHeight}`,
    });
    container.append(image);
  });
  // 下一张
  nextBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'next',
      value: '',
    });
  });
  // 上一张
  preBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'previous',
      value: '',
    });
  });
  // 导出
  exportBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'export',
      value: '',
    });
  });
  openBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'reopen-as-text',
      value: '',
    });
  });
  image.addEventListener('error', (e) => {
    errorContainer.style.display = 'block';
  });
})();
