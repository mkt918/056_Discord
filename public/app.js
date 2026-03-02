const form = document.getElementById('command-form');
const input = document.getElementById('command-input');
const container = document.getElementById('chat-container');

// セッション中のみ保持（ブラウザを閉じると消去される。XSS対策）
let webhookUrl = sessionStorage.getItem('ag_webhook_url');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cmd = input.value.trim();
    if (!cmd) return;

    if (!webhookUrl) {
        const url = prompt('Please enter your Discord Webhook URL for communication:');
        if (url) {
            webhookUrl = url;
            sessionStorage.setItem('ag_webhook_url', url);
        } else return;
    }

    addMessage(cmd, 'user');
    input.value = '';

    // ローディング表示（このWebUIは送信専用。Bot応答はDiscord側で確認）
    const loadingId = addLoading();

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: cmd })
        });
        // 送信成功したらローディングを「送信完了」メッセージに差し替える
        removeLoading(loadingId);
        addMessage('✅ コマンドを Discord Bot に送信しました。実行結果は Discord チャンネルで確認してください。', 'system');
    } catch (err) {
        removeLoading(loadingId);
        addMessage('❌ Error sending command: ' + err.message, 'system');
    }
});

function addMessage(text, role) {
    const div = document.createElement('div');
    const isUser = role === 'user';
    div.className = `flex flex-col ${isUser ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-[85%]`;

    const inner = document.createElement('div');
    inner.className = isUser
        ? 'bg-black text-white p-5 rounded-3xl rounded-tr-none shadow-lg'
        : 'bg-white/40 p-5 rounded-3xl rounded-tl-none border border-white/60 shadow-sm';

    if (text.startsWith('```')) {
        const pre = document.createElement('pre');
        pre.className = 'mono text-xs overflow-x-auto bg-black/10 p-4 rounded-xl mt-2';
        pre.textContent = text.replace(/```/g, '');
        inner.appendChild(pre);
    } else {
        // XSS対策: innerHTML ではなく textContent で挿入する
        const p = document.createElement('p');
        p.className = 'text-sm leading-relaxed';
        p.textContent = text;
        inner.appendChild(p);
    }

    div.appendChild(inner);
    const meta = document.createElement('span');
    meta.className = 'text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-widest';
    meta.textContent = `${role === 'user' ? 'YOU' : 'ANTIGRAVITY'} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    div.appendChild(meta);

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addLoading() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex flex-col items-start max-w-[85%]';
    div.innerHTML = `
        <div class="bg-white/40 p-5 rounded-3xl rounded-tl-none border border-white/60 shadow-sm loading-dots flex space-x-1">
            <div class="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <div class="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <div class="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
