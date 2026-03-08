// 初始化 highlight.js
document.addEventListener('DOMContentLoaded', () => {
  if (window.hljs) {
    window.hljs.configure({
      languages: ['javascript', 'python', 'typescript', 'java', 'cpp', 'c', 'go', 'rust', 'html', 'css', 'json', 'markdown', 'bash', 'sql']
    });
  }
});
