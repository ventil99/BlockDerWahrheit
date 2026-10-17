window.downloadCollection = (fileName, json) => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};
