require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes, Collection } = require('discord.js');
const { commands } = require('./commands');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// -------------------------
// 危険なシェルメタ文字のパターン（コマンドインジェクション対策）
// -------------------------
const DANGEROUS_PATTERN = /[;&|`$()<>\\]/;

/**
 * コマンド文字列にインジェクション用の危険文字が含まれていないか検証する。
 * LLMプロンプト（!gemini / !claude）は別途エスケープするため除外。
 * @param {string} cmd
 * @returns {boolean} 安全なら true
 */
function isSafeCommand(cmd) {
    return !DANGEROUS_PATTERN.test(cmd);
}

/**
 * ANSI エスケープシーケンスをすべて除去する（色・カーソル移動・消去など）。
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
    // ESC[ ... 終端文字 まで、および単独 ESC 系シーケンスを除去
    return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
              .replace(/\u001b[()][0-9A-Z]/g, '')
              .replace(/\u001b[^[]/g, '');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();
for (const command of commands) {
    client.commands.set(command.data.name, command);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('[Antigravity] Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands.map(c => c.data.toJSON()) },
        );
        console.log('[Antigravity] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Antigravity] Logged in as ${readyClient.user.tag}`);
    console.log(`[Antigravity] Terminal interface is ready.`);
    if (process.env.CLIENT_ID) {
        registerCommands();
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

let currentWorkspace = process.cwd();
const shortcutsPath = path.join(__dirname, 'shortcuts.json');
let shortcuts = {};

// ショートカットの非同期読み込み
fs.promises.readFile(shortcutsPath, 'utf8')
    .then(data => { shortcuts = JSON.parse(data); })
    .catch(() => { /* ファイルが存在しない場合は空のまま */ });

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.author.id !== process.env.ALLOWED_USER_ID) return;

    let cmd = message.content.trim();

    // ショートカット登録: !alias [name] [expansion]
    if (cmd.startsWith('!alias ')) {
        const rest = cmd.slice('!alias '.length);
        const spaceIdx = rest.indexOf(' ');
        if (spaceIdx === -1) {
            return message.reply('❌ Usage: `!alias <name> <expansion>`');
        }
        const name = rest.slice(0, spaceIdx).trim();
        const expansion = rest.slice(spaceIdx + 1).trim();
        if (!name || !expansion) {
            return message.reply('❌ Usage: `!alias <name> <expansion>`');
        }
        shortcuts[name] = expansion;
        // 非同期でファイルに書き込む
        await fs.promises.writeFile(shortcutsPath, JSON.stringify(shortcuts, null, 2));
        return message.reply(`✅ Shortcut registered: \`!${name}\` -> \`${expansion}\``);
    }

    // ショートカットの展開
    if (cmd.startsWith('!')) {
        const firstWord = cmd.split(' ')[0].substring(1);
        if (shortcuts[firstWord]) {
            const remaining = cmd.split(' ').slice(1).join(' ');
            cmd = shortcuts[firstWord] + (remaining ? ' ' + remaining : '');
        }
    }

    // WorkSpace 切り替え: !workspace [path]
    if (cmd.startsWith('!workspace ')) {
        const newPath = cmd.slice('!workspace '.length).trim();
        currentWorkspace = newPath;
        return message.reply(`📁 Workspace switched to: \`${currentWorkspace}\``);
    }

    // LLM ショートカット: !gemini [prompt] / !claude [prompt]
    // プロンプト内のダブルクォート・バッククォート・$をエスケープして安全に渡す
    if (cmd.startsWith('!gemini ')) {
        const prompt = cmd.slice('!gemini '.length).trim()
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
        cmd = `gemini --prompt "${prompt}"`;
    } else if (cmd.startsWith('!claude ')) {
        const prompt = cmd.slice('!claude '.length).trim()
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
        cmd = `claude "${prompt}"`;
    } else {
        // LLM コマンド以外はホワイトリスト検証でインジェクションを防ぐ
        if (!isSafeCommand(cmd)) {
            return message.reply('❌ コマンドに禁止文字（`;`, `|`, `&`, `` ` ``, `$`, `(`, `)`, `<`, `>`, `\\`）が含まれています。');
        }
    }

    exec(cmd, { cwd: currentWorkspace, timeout: 60000 }, (error, stdout, stderr) => {
        const raw = stdout || stderr || (error ? error.message : null);
        if (raw) {
            // ANSI エスケープシーケンス（色・カーソル移動など）をすべて除去
            const cleanOutput = stripAnsi(raw);
            const trimmedOutput = cleanOutput.length > 1900 ? cleanOutput.substring(0, 1900) + '...' : cleanOutput;
            message.reply(`\`\`\`\n${trimmedOutput}\n\`\`\``);
        } else if (!error) {
            message.reply('✅ Command executed with no output.');
        }
    });
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('[Antigravity] Login failed. Please check your DISCORD_TOKEN in .env');
});

