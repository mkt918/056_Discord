const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('run')
            .setDescription('PC 上でコマンドを遠隔実行します (管理者専用)')
            .addStringOption(option =>
                option.setName('command')
                    .setDescription('実行するシェルコマンド')
                    .setRequired(true)),
        async execute(interaction) {
            // セキュリティチェック: 許可されたユーザーのみ
            if (interaction.user.id !== process.env.ALLOWED_USER_ID) {
                return interaction.reply({ content: '❌ 権限がありません。この操作は許可された管理者のみ実行可能です。', ephemeral: true });
            }

            const cmd = interaction.options.getString('command');
            await interaction.deferReply();

            exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
                const embed = new EmbedBuilder()
                    .setColor(0xFFFFFF)
                    .setTitle(`> ${cmd}`)
                    .setTimestamp();

                if (error) {
                    embed.setColor(0xFF0000)
                        .setDescription(`\`\`\`\n${stderr || error.message}\n\`\`\``)
                        .setFooter({ text: 'Command failed' });
                } else {
                    const output = stdout || '(No output)';
                    // Discord の埋め込み制限に合わせてトリム
                    const trimmedOutput = output.length > 3000 ? output.substring(0, 3000) + '...' : output;
                    embed.setDescription(`\`\`\`\n${trimmedOutput}\n\`\`\``)
                        .setFooter({ text: 'Command executed successfully' });
                }

                interaction.editReply({ embeds: [embed] });
            });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('terminal')
            .setDescription('Antigravity ターミナル情報を表示します')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('照会内容 (help, status)')
                    .setRequired(true)),
        async execute(interaction) {
            const query = interaction.options.getString('query');
            const embed = new EmbedBuilder()
                .setColor(0xFFFFFF)
                .setTitle('AG-Terminal v1.0.0')
                .setTimestamp();

            if (query === 'help') {
                embed.setDescription('利用可能なコマンド:\n`/run` - シェルコマンドの実行 (要権限)\n`/terminal query:status` - システム状態の確認\n`/mermaid` - 図解コードの生成');
            } else if (query === 'status') {
                embed.addFields(
                    { name: 'System', value: 'ONLINE', inline: true },
                    { name: 'Core', value: 'Antigravity-Engine', inline: true },
                    { name: 'Remote Access', value: 'ENABLED', inline: true }
                );
            } else {
                embed.setDescription(`Unknown query: \`${query}\``);
            }

            await interaction.reply({ embeds: [embed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('mermaid')
            .setDescription('Mermaid 記法のコードブロックを生成します')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Mermaid 記法のコード')
                    .setRequired(true)),
        async execute(interaction) {
            const code = interaction.options.getString('code');
            const response = "```mermaid\n" + code + "\n```";
            await interaction.reply(`Antigravity が図解コードを生成しました:\n${response}`);
        }
    }
];

module.exports = { commands };
