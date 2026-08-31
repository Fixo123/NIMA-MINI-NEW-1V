const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');
const fetch = require('node-fetch');
const os = require('os');
const apikey = `edbcfabbca5a9750`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');
//=======================================
const autoReact = getSetting('AUTO_REACT') || 'on';

const FileType = require('file-type');
//=======================================
async function downloadQuotedMedia(quotedMsg) {
  try {
    const type = Object.keys(quotedMsg)[0]; 
    const stream = await downloadContentFromMessage(quotedMsg[type], type.replace('Message', ''));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return { buffer };
  } catch (err) {
    console.error('📥 Media download error:', err);
    return null;
  }
}
//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🍁', '🙈', '💜', '🌸', '❤️‍🩹', '⭕', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '🔵'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/BQWRYxmmMRp9JJMSb5Ifoy?mode=ems_copy_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://files.catbox.moe/b4zntx.jpg',
    NEWSLETTER_JID: '120363421796655176@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: 'https://whatsapp.com/channel/0029VbBFUeiJf05ZyjCjCR36',
    BOT_NAME: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
    OWNER_NAME: 'ʟᴏᴋᴜ ɴɪᴍᴀ',
    OWNER_NUMBER: '94760743488',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '> © ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbBFUeiJf05ZyjCjCR36',
    BUTTON_IMAGES: {
        ALIVE: 'https://files.catbox.moe/mnzw8n.jpg',
        MENU: 'https://files.catbox.moe/jz6p40.jpg',
        OWNER: 'https://files.catbox.moe/5yxf29.jpg',
        SONG: 'https://files.catbox.moe/gtfxvg.jpg',
        VIDEO: 'https://files.catbox.moe/4hhbq9.jpg'
    }
};

// MongoDB Setup
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const mongoUri = 'mongodb+srv://nimatest:nimatest@nimatest.bdf6c2a.mongodb.net/';
const client = new MongoClient(mongoUri);
let db;

async function initMongo() {
    if (!db) {
        await client.connect();
        db = client.db('Dinuz');
        await db.collection('sessions').createIndex({ number: 1 });
    }
    return db;
}
//=======================================
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}
function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}
function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '*ʜɪ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ✅*',
        ` *☎️Number :*  ${number}\n  *ꜱᴛᴀᴛᴜꜱ : ᴏɴʟɪɴᴇ 🔄*`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['❤️'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

const myquoted = {
    key: {
        remoteJid: 'status@broadcast',
        participant: '13135550002@s.whatsapp.net',
        fromMe: false,
        id: createSerial(16).toUpperCase()
    },
    message: {
        contactMessage: {
            displayName: "ANDY MRLIT",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:THE VOID V2\nORG:THE VOID V2;\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
            contextInfo: {
                stanzaId: createSerial(16).toUpperCase(),
                participant: "0@s.whatsapp.net",
                quotedMessage: {
                    conversation: "ANDY MRLIT"
                }
            }
        }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    status: 1,
    verifiedBizName: "Meta"
};
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`D E L E T E\`\n│ *⦁ From :* ${messageKey.remoteJid}\n│ *⦁ Time:* ${deletionTime}\n│ *⦁ Type: Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Setup command handlers without buttons
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;
        
        // Helper function for replying (defined locally inside setupCommandHandlers for easy use)
        const reply = async (text) => {
            return await socket.sendMessage(sender, { text }, { quoted: msg });
        };

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        try {
            switch (command) {
                 case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥*';
                    const content = `*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*\n` + 
                                   `*ʙᴏᴛ ᴏᴡɴᴇʀ :- ʟᴏᴋᴜ ɴɪᴍᴀ*\n` +
                                   `*ᴏᴡᴇɴʀ ɴᴜᴍʙᴇʀ :- 94760743488*\n` +
                                   `*ᴅɪᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ 👇*\n` +
                                   `> https://nima-family-bot-web.vercel.app/\n\n` +
                                   `Type *.menu* to view command list.`;
                    const footer = config.BOT_FOOTER;

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: formatMessage(title, content, footer)
                    }, { quoted: msg });
                    break;   
                 }
                 case 'seaart': {
                    try {
                        if (!args[0]) {
                          return await socket.sendMessage(sender, {
                            text: '❌ කරුණාකර *prompt* එකක් දාන්න!\n\nඋදාහරණය:\n.imagegen gangster boy with car'
                          }, { quoted: myquoted });
                        }

                        const prompt = args.join(" ");
                        const api = `https://text-to-img.apis-bj-devs.workers.dev/?prompt=${encodeURIComponent(prompt)}`;
                        const res = await axios.get(api);
                        const data = res.data;

                        if (!data || !data.result || data.result.length === 0) {
                          return await socket.sendMessage(sender, {
                            text: '❌ Image එක generate වෙන්න බැරි වුණා. තවත් උත්සාහ කරන්න!'
                          }, { quoted: myquoted });
                        }

                        for (let img of data.result) {
                          await socket.sendMessage(sender, { image: { url: img }, caption: `🖼️ *Prompt:* ${prompt}\n\n✅ ${data.message}` }, { quoted: myquoted });
                        }

                    } catch (err) {
                        console.log(err);
                        await socket.sendMessage(sender, { text: '⚠️ Error generating image. Try again later!' }, { quoted: myquoted });
                    }
                    break;
                }
                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const menuCaption = `
╔═══〔 ACCESS GRANTED 〕══════════════╗
║ < N I M A . F A M I L Y . B O T >  
╚═══════════════════════════════════╝

╭━━━❰ ⚙️ S Y S T E M  S T A T S ❱━━━
│
│ ⎆  BOT Name : *NIMA FAMILY FREE BOT*
│ ⎆  Bot Type : *FAMILY BOT*
│ ⎆  Owners : *LOKU NIMAH*
│ 
│ ⏱️ Uptime : *${hours}h ${minutes}m ${seconds}s*
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭━━━❰ 🌐 N E T W O R K  I N F O ❱━━━
│
│ > The best Multi Device WA Minu Bot.
│ 
│ 💾 ACCESS DEPLOY LINK:
│ > *https://nima-family-bot-web.vercel.app/*
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      *Type .amenu for Full Commands List*
      *© NIMA FAMILY FREE BOT*
`;

                    await socket.sendMessage(sender, { react: { text: "🌟", key: msg.key } });

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU }, 
                        caption: menuCaption
                    }, { quoted: msg });
                    break;
                }
                case 'දාපන්':
                case 'send':
                case 'vv':
                case 'save': {
                  try {
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quotedMsg) {
                      return await socket.sendMessage(sender, { text: '*❌ Please reply to a message (status/media) to save it.*' }, { quoted: msg });
                    }

                    try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

                    const saveChat = sender;

                    if (quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.documentMessage || quotedMsg.stickerMessage) {
                      const media = await downloadQuotedMedia(quotedMsg);
                      if (!media || !media.buffer) {
                        return await socket.sendMessage(sender, { text: '❌ Failed to download media.' }, { quoted: msg });
                      }

                      if (quotedMsg.imageMessage) {
                        await socket.sendMessage(saveChat, { image: media.buffer, caption: media.caption || '*✅ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*' });
                      } else if (quotedMsg.videoMessage) {
                        await socket.sendMessage(saveChat, { video: media.buffer, caption: media.caption || '*✅ ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*', mimetype: media.mime || 'video/mp4' });
                      } else if (quotedMsg.audioMessage) {
                        await socket.sendMessage(saveChat, { audio: media.buffer, mimetype: media.mime || 'audio/mp4', ptt: media.ptt || false });
                      } else if (quotedMsg.documentMessage) {
                        const fname = media.fileName || `saved_document.${(await FileType.fromBuffer(media.buffer))?.ext || 'bin'}`;
                        await socket.sendMessage(saveChat, { document: media.buffer, fileName: fname, mimetype: media.mime || 'application/octet-stream' });
                      } else if (quotedMsg.stickerMessage) {
                        await socket.sendMessage(saveChat, { image: media.buffer, caption: media.caption || '*✅ꜱᴛɪᴄᴋᴇʀ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*' });
                      }

                      await socket.sendMessage(sender, { text: '*ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*' }, { quoted: msg });

                    } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
                      const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
                      await socket.sendMessage(saveChat, { text: `*ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*\n\n${text}` });
                      await socket.sendMessage(sender, { text: '*ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*' }, { quoted: msg });
                    } else {
                      if (typeof socket.copyNForward === 'function') {
                        try {
                          await socket.copyNForward(saveChat, msg.key, true);
                          await socket.sendMessage(sender, { text: '*ꜱᴛᴀᴛᴜꜱ ꜱᴀᴠᴇ ʙʏ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ 🍁*' }, { quoted: msg });
                        } catch (e) {
                          await socket.sendMessage(sender, { text: '❌ Could not forward the quoted message.' }, { quoted: msg });
                        }
                      } else {
                        await socket.sendMessage(sender, { text: '❌ Unsupported quoted message type.' }, { quoted: msg });
                      }
                    }

                  } catch (error) {
                    console.error('❌ Save error:', error);
                    await socket.sendMessage(sender, { text: '*❌ Failed to save status*' }, { quoted: msg });
                  }
                  break;
                }
                case 'logo': {
                  try {
                    if (!args[0]) {
                      return await socket.sendMessage(sender, {
                        text: '❌ කරුණාකර *Prompt* එකක් දාන්න!\n\nඋදාහරණය:\n.seaart a cute anime boy'
                      }, { quoted: myquoted });
                    }

                    const prompt = args.join(" ");
                    const api = `https://seaart-ai.apis-bj-devs.workers.dev/?Prompt=${encodeURIComponent(prompt)}`;
                    const res = await axios.get(api);
                    const data = res.data;

                    if (!data || !data.result || data.result.length === 0) {
                      return await socket.sendMessage(sender, {
                        text: '❌ Image එක generate වෙන්න බැරි වුණා. පසුව උත්සාහ කරන්න!'
                      }, { quoted: myquoted });
                    }

                    for (let img of data.result) {
                      await socket.sendMessage(sender, {
                        image: { url: img.url },
                        caption: `🎨 *Prompt:* ${data.prompt}\n✅ ${data.message}`
                      }, { quoted: myquoted });
                    }

                  } catch (err) {
                    console.error(err);
                    await socket.sendMessage(sender, {
                      text: '⚠️ Error generating image. Try again later!'
                    }, { quoted: myquoted });
                  }
                  break;
                }
                case 'amenu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    await socket.sendMessage(sender, { react: { text: "⚡", key: msg.key } });

                    const kariyane = `
╔═════════════════════════════════╗
║   [ N I M A  F A M I L Y  B O T ]   ║
╚═════════════════════════════════╝

╭─┈───────────
│ 💎 S Y S T E M  I N F O
│ ━━━━━━━━━━━━━━━━━━━━━━━━━
│ ⎆  BOT NAME  : *Nima Family Free Bot*
│ ⎆  PLATFORM : *RENDER DEPLOY 🔥*
│ ⎆  UPTIME   : *${hours}h ${minutes}m ${seconds}s*
╰─┈───────────

╭───────────·🛡️·───────────╮
│  I. C O R E  &  S Y S T E M
╰───────────·🛡️·───────────╯
*│ 🟢 .alive* :  BOT Online Check
*│ 📶 .ping* :  Speed Test
*│ ⚙️ .system* :  BOT System Info
*│ 👑 .owner* :  Show BOT Owners
┠─────────────────────────────────

╭───────────·🎬·───────────╮
│  II. M E D I A  &  D L
╰───────────·🎬·───────────╯
*│ 🎼 .song <name>* : Download Song
*│ 📘 .fb <url>* : Facebook Video Down
*│ 🎶 .tiktoksearch <name>* : Search TikTok
*│ 🎵 .tiktok <url>* : TikTok DL
*│ 📲 .apk <name>* : APK Download
*│ 📥 (.save,send,දාපන්)* : Status Save
┠─────────────────────────────────

╭───────────·🔧·───────────╮
│  III. T O O L S  &  A I
╰───────────·🔧·───────────╯
*│ 📦 .npm <package>* : Get NPM Info
*│ 🔍 .google <query>* : Google Search
*│ 🤖 .ai <prompt>* : Chat with AI
*│ 🖼️ .getdp <jid>* : Get Profile Pic
*│ 💥 .boom <num|count>* : Boom Number
*│ 🤤 .ᴠᴠ* : View Once Handler
┠─────────────────────────────────

╭───────────·🌐·───────────╮
│  IV. W H A T S A P P
╰───────────·🌐·───────────╯
*│ 🔗 .pair <code>* : Pair Session
*│ 🆔 .jid* : Get Chat JID
*│ 📡 .cid <link>* : Get Channel Info
┠─────────────────────────────────
     < E N D  O F  M E N U >
`;

                    await socket.sendMessage(sender, {
                        image: { url: "https://files.catbox.moe/jz6p40.jpg"},
                        caption: kariyane, 
                        contextInfo: {
                            mentionedJid: ['94760743488@s.whatsapp.net'],
                            groupMentions: [],
                            forwardingScore: 999,
                            isForwarded: false,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421796655176@newsletter',
                                newsletterName: "ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ",
                                serverMessageId: 999
                            },
                            externalAdReply: {
                                title: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ᴍᴜʟᴛɪ ᴅᴇᴠɪᴄᴇ ꜰʀᴇᴇ ʙᴏᴛ',
                                body: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
                                mediaType: 1,
                                sourceUrl: "https://nima-family-bot-web.vercel.app/",
                                thumbnailUrl: 'https://files.catbox.moe/jz6p40.jpg',
                                renderLargerThumbnail: false,
                                showAdAttribution: false
                            }
                        }
                    }, { quoted: msg });
                    break;
                }
                case 'play': {
                    try {
                        const q = args.join(" ");
                        if (!q) {
                            return await socket.sendMessage(sender, { text: "*ඔයාලා ගීත නමක් හෝ YouTube ලින්ක් එකක් දෙන්න...!*" }, { quoted: msg });
                        }

                        const search = await yts(q);
                        if (!search.videos.length) {
                            return await socket.sendMessage(sender, { text: "*ගීතය හමුනොවුණා... ❌*" }, { quoted: msg });
                        }

                        const data = search.videos[0];
                        const ytUrl = data.url;

                        const api = `https://sadiya-tech-apis.vercel.app/download/ytdl?url=${ytUrl}&format=mp3&apikey=sadiya`;
                        const { data: apiRes } = await axios.get(api);

                        if (!apiRes?.status || !apiRes.result?.download) {
                            return await socket.sendMessage(sender, { text: "❌ ගීතය බාගත කළ නොහැක. වෙනත් එකක් උත්සහ කරන්න!" }, { quoted: msg });
                        }

                        const result = apiRes.result;
                        const caption = `╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸\n\n*ℹ️ Title :* \`${data.title}\`\n*⏱️ Duration :* ${data.timestamp} \n*🧬 Views :* ${data.views}\n*📅 Released Date :* ${data.ago}\n \n╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸╸`;

                        await socket.sendMessage(sender, { image: { url: result.thumbnail }, caption: caption }, { quoted: msg });
                        await socket.sendMessage(sender, { audio: { url: result.download }, mimetype: "audio/mpeg", ptt: true }, { quoted: msg });

                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, { text: "*ඇතැම් දෝෂයකි! පසුව නැවත උත්සහ කරන්න.*" }, { quoted: msg });
                    }
                    break;
                }
                case 'ping': {
                    var inital = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { text: '*_Pinging to Module..._* ❗' }, { quoted: msg });
                    var final = new Date().getTime();
                    await socket.sendMessage(sender, { text: '《 █▒▒▒▒▒▒▒▒▒▒▒》10%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████▒▒▒▒▒▒▒▒》30%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ███████▒▒▒▒▒》50%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ██████████▒▒》80%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████████████》100%', edit: ping.key });

                    return await socket.sendMessage(sender, { text: '❗ *Pong '+ (final - inital) + ' Ms*', edit: ping.key });
                }
                case 'owner': {
                    await socket.sendMessage(sender, { react: { text: "👤", key: msg.key } });
                    
                    const ownerContact = {
                        contacts: {
                            displayName: 'My Contacts',
                            contacts: [
                                { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ɴɪᴍᱟ\nTEL;TYPE=Coder,VOICE:94760743488\nEND:VCARD' },
                                { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ᴅɪɴᴇꜱʜ\nTEL;TYPE=Coder,VOICE:94729119643\nEND:VCARD' },
                            ],
                        },
                    };

                    const ownerLocation = {
                        location: {
                            degreesLatitude: 6.9271,
                            degreesLongitude: 80.5550,
                            name: 'ɴɪᴍᱟ ᴀᴅᴅʀᴇꜱꜱ',
                            address: 'ᴀᴠɪꜱꜱᴀᴡᴇʟʟᴀ, ꜱʀɪ ʟᴀɴᴋᴀ',
                        },
                    };

                    await socket.sendMessage(sender, ownerContact);
                    await socket.sendMessage(sender, ownerLocation);
                    break;
                }
                case 'tagall': {
                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
                    }
                    try {
                        const metadata = await socket.groupMetadata(sender);
                        const participants = metadata.participants;
                        let tagMsg = '*📍 TAGGING ALL MEMBERS*\n\n';
                        const mentions = [];

                        for (const p of participants) {
                            const num = p.id.split('@')[0];
                            tagMsg += `@${num}\n`;
                            mentions.push(p.id);
                        }

                        await socket.sendMessage(sender, { text: tagMsg, mentions }, { quoted: msg });
                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, { text: '❌ Error in tagall command.' }, { quoted: msg });
                    }
                    break;
                }
                case 'fb':
                case 'fbdl':
                case 'facebook': {
                    try {
                        const fbUrl = args.join(" ");
                        if (!fbUrl) {
                            return await socket.sendMessage(sender, { text: '*𝐏ℓєαʂє 𝐏ɼ๏νιɖє 𝐀 fb҇ 𝐕ιɖє๏ ๏ɼ ɼєєℓ 𝐔ɼℓ..*' }, { quoted: msg });
                        }

                        const apiKey = 'e276311658d835109c';
                        const apiUrl = `https://api.nexoracle.com/downloader/facebook?apikey=${apiKey}&url=${encodeURIComponent(fbUrl)}`;
                        const response = await axios.get(apiUrl);

                        if (!response.data || !response.data.result || !response.data.result.sd) {
                            return await socket.sendMessage(sender, { text: '*❌ Invalid or unsupported Facebook video URL.*' }, { quoted: msg });
                        }

                        const { sd } = response.data.result;
                        await socket.sendMessage(sender, {
                            video: { url: sd },
                            caption: `*❒📥 ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ ꜰʙ ᴠɪᴅᴇᴏ 📥❒*`,
                        }, { quoted: msg });

                    } catch (error) {
                        console.error('Error downloading Facebook video:', error);
                        await socket.sendMessage(sender, { text: '❌ Unable to download the Facebook video. Please try again later.' }, { quoted: msg });
                    }
                    break;
                }
                case 'system': {
                    const title = "*⚙️ ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ ⚙️*";
                    let totalStorage = Math.floor(os.totalmem() / 1024 / 1024) + 'MB';
                    let cpuSpeed = os.cpus()[0].speed / 1000;
                    let cpuCount = os.cpus().length;

                    let content = `
  ◦ *Runtime*: ${runtime(process.uptime())}
  ◦ *Total Ram*: ${totalStorage}
  ◦ *CPU Speed*: ${cpuSpeed} GHz
  ◦ *Number of CPU Cores*: ${cpuCount} 
`;
                    const footer = config.BOT_FOOTER;

                    await socket.sendMessage(sender, {
                        image: { url: `https://files.catbox.moe/xlqa3o.jpg` },
                        caption: formatMessage(title, content, footer)
                    }, { quoted: msg });
                    break;
                }
                case 'song': {
                    const q = args.join(" ");
                    if (!q) return await reply("*ඔයාලා ගීත නමක් හෝ YouTube ලින්ක් එකක් දෙන්න...!*\nඋදාහරණ: `.song Manike Mage Hithe`");

                    // Loading reactions
                    const loadEmojis = ['📥', '⏳', '🎵'];
                    for (const emoji of loadEmojis) {
                        await socket.sendMessage(sender, { react: { text: emoji, key: msg.key } });
                    }

                    let video;
                    if (q.includes('youtube.com') || q.includes('youtu.be')) {
                        video = { url: q, title: 'YouTube Audio', thumbnail: 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' };
                    } else {
                        const search = await yts(q);
                        if (!search || !search.videos.length) {
                            return await reply("*ගීතය හමුනොවුණා... ❌*");
                        }
                        video = search.videos[0];
                    }

                    // Inform user
                    await socket.sendMessage(sender, {
                        image: { url: video.thumbnail },
                        caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp || 'N/A'}`
                    }, { quoted: msg });

                    // API Helper functions
                    const AXIOS_DEFAULTS = {
                        timeout: 60000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*'
                        }
                    };

                    async function tryRequest(getter, attempts = 3) {
                        let lastError;
                        for (let attempt = 1; attempt <= attempts; attempt++) {
                            try {
                                return await getter();
                            } catch (err) {
                                lastError = err;
                                if (attempt < attempts) {
                                    await new Promise(r => setTimeout(r, 1000 * attempt));
                                }
                            }
                        }
                        throw lastError;
                    }

                    async function getEliteProTechDownloadByUrl(youtubeUrl) {
                        const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
                        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
                        if (res?.data?.success && res?.data?.downloadURL) {
                            return { download: res.data.downloadURL, title: res.data.title };
                        }
                        throw new Error('EliteProTech returned no download');
                    }

                    async function getYupraDownloadByUrl(youtubeUrl) {
                        const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
                        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
                        if (res?.data?.success && res?.data?.data?.download_url) {
                            return { download: res.data.data.download_url, title: res.data.data.title };
                        }
                        throw new Error('Yupra returned no download');
                    }

                    async function getOkatsuDownloadByUrl(youtubeUrl) {
                        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
                        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
                        if (res?.data?.dl) {
                            return { download: res.data.dl, title: res.data.title };
                        }
                        throw new Error('Okatsu returned no download');
                    }

                    let audioBuffer;
                    let downloadSuccess = false;
                    let finalTitle = video.title;

                    const apiMethods = [
                        { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
                        { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
                        { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) },
                        { name: 'Alya', method: async () => {
                            const res = await axios.get(`https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(video.url)}&apikey=G7I6X7`, AXIOS_DEFAULTS);
                            if (res.data.status && res.data.data.url) return { download: res.data.data.url, title: res.data.data.title };
                            throw new Error('Alya failed');
                        }},
                        { name: 'Vreden', method: async () => {
                            const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(video.url)}`, AXIOS_DEFAULTS);
                            if (res.data.status && res.data.result.download.url) return { download: res.data.result.download.url, title: res.data.result.metadata.title };
                            throw new Error('Vreden failed');
                        }}
                    ];

                    for (const apiMethod of apiMethods) {
                        try {
                            const audioData = await apiMethod.method();
                            const audioUrl = audioData.download;
                            finalTitle = audioData.title || video.title;
                            
                            if (!audioUrl) continue;
                            
                            const audioResponse = await axios.get(audioUrl, {
                                responseType: 'arraybuffer',
                                timeout: 120000,
                                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
                            });
                            audioBuffer = Buffer.from(audioResponse.data);
                            
                            if (audioBuffer && audioBuffer.length > 0) {
                                downloadSuccess = true;
                                break;
                            }
                        } catch (err) {
                            console.log(`${apiMethod.name} failed:`, err.message);
                        }
                    }

                    if (!downloadSuccess) {
                        return await reply("❌ ගීතය බාගත කළ නොහැක. සියලුම API අසාර්ථක විය!");
                    }

                    // Send Audio File
                    await socket.sendMessage(sender, {
                        audio: audioBuffer,
                        mimetype: 'audio/mpeg',
                        fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp3`,
                        ptt: false
                    }, { quoted: msg });
                    break;
                }
                case 'npm': {
                    const packageName = args.join(" ").trim();
                    if (!packageName) {
                        return await socket.sendMessage(sender, { text: '📦 *Usage:* .npm <package-name>\n\nExample: .npm express' }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, { text: `🔎 Searching npm for: *${packageName}*` }, { quoted: msg });

                        const apiUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
                        const { data, status } = await axios.get(apiUrl);

                        if (status !== 200) {
                            return await socket.sendMessage(sender, { text: '🚫 Package not found. Please check the package name and try again.' }, { quoted: msg });
                        }

                        const latestVersion = data["dist-tags"]?.latest || 'N/A';
                        const description = data.description || 'No description available.';
                        const npmUrl = `https://www.npmjs.com/package/${packageName}`;
                        const license = data.license || 'Unknown';
                        const repository = data.repository ? data.repository.url.replace('git+', '').replace('.git', '') : 'Not available';

                        const caption = `\n📦 *NPM Package Search*\n\n🔰 *Package:* ${packageName}\n📄 *Description:* ${description}\n⏸️ *Latest Version:* ${latestVersion}\n🪪 *License:* ${license}\n🪩 *Repository:* ${repository}\n🔗 *NPM URL:* ${npmUrl}\n`;

                        await socket.sendMessage(sender, { text: caption }, { quoted: msg });
                    } catch (err) {
                        console.error("NPM command error:", err);
                        await socket.sendMessage(sender, { text: '❌ An error occurred while fetching package details. Please try again later.' }, { quoted: msg });
                    }
                    break;
                }    
                case 'tiktoksearch': {
                    const query = args.join(" ").trim();
                    if (!query) {
                        return await socket.sendMessage(sender, { text: '🌸 *Usage:* .tiktoksearch <query>\n\nExample: .tiktoksearch funny dance' }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, { text: `🔎 Searching TikTok for: *${query}*` }, { quoted: msg });
                        const apiUrl = `https://apis-starlights-team.koyeb.app/starlight/tiktoksearch?text=${encodeURIComponent(query)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data?.status || !data?.data || data.data.length === 0) {
                            return await socket.sendMessage(sender, { text: '❌ No results found for your query. Please try with a different keyword.' }, { quoted: msg });
                        }

                        const results = data.data.slice(0, 3);
                        for (const video of results) {
                            const caption = `🌸 *TikTok Video Result*\n\n📖 *Title:* ${video.title || 'Unknown'}\n👤 *Author:* ${video.author?.nickname || video.author || 'Unknown'}\n`;
                            if (video.nowm) {
                                await socket.sendMessage(sender, { video: { url: video.nowm }, caption: caption }, { quoted: msg });
                            }
                        }
                    } catch (err) {
                        console.error("TikTokSearch command error:", err);
                        await socket.sendMessage(sender, { text: '❌ An error occurred while searching TikTok. Please try again later.' }, { quoted: msg });
                    }
                    break;
                }
                case 'pssearch': {
                    try {
                        if (!args[0]) return await socket.sendMessage(sender, { text: '❌ *Please provide a search term!*\n\n_Example:_ .psdlsearch Sinhala' }, { quoted: myquoted });

                        const query = args.join(" ");
                        const api = `https://chathuradigital.netlify.app/scrape?search=${encodeURIComponent(query)}`;
                        const res = await axios.get(api);
                        const data = res.data;

                        if (!data || !data.results || data.results.length === 0) {
                            return await socket.sendMessage(sender, { text: `⚠️ *No results found for "${query}"!*` }, { quoted: myquoted });
                        }

                        for (let item of data.results.slice(0, 3)) {
                            let text = `*${item.title}*\n\n📝 ${item.details.description || 'No description'}\n\n`;
                            if (item.download_links && item.download_links.length > 0) {
                                item.download_links.slice(0, 2).forEach((dl, idx) => {
                                    text += `🔗 Link ${idx + 1}: ${dl.url}\n`;
                                });
                            }
                            await socket.sendMessage(sender, { text: text }, { quoted: myquoted });
                        }
                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, { text: '⚠️ *Error fetching search results!*' }, { quoted: myquoted });
                    }
                    break;
                }
                case 'apk': {
                    const query = args.join(" ").trim();
                    if (!query) {
                        await socket.sendMessage(sender, { text: "*🔍 Please provide an app name to search.*\n\n_Usage:_\n.apk Instagram" }, { quoted: msg });
                        break;
                    }

                    try {
                        await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });

                        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`;
                        const response = await axios.get(apiUrl);
                        const data = response.data;

                        if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
                            await socket.sendMessage(sender, { text: "❌ *No APK found for your query.*" }, { quoted: msg });
                            break;
                        }

                        const app = data.datalist.list[0];
                        const sizeMB = (app.size / (1024 * 1024)).toFixed(2);
                        const caption = `🎮 *App Name:* ${app.name}\n📦 *Package:* ${app.package}\n📁 *Size:* ${sizeMB} MB`;

                        await socket.sendMessage(sender, { react: { text: "⬆️", key: msg.key } });

                        await socket.sendMessage(sender, {
                            document: { url: app.file.path_alt },
                            fileName: `${app.name}.apk`,
                            mimetype: 'application/vnd.android.package-archive',
                            caption,
                            quoted: msg
                        });

                        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, { text: "❌ *Error occurred while downloading the APK.*" }, { quoted: msg });
                    }
                    break;
                }
                case 'boom': {
                    const q = args.join(" ");
                    const [target, textMsg, countRaw] = q.split(',').map(x => x?.trim());
                    const count = parseInt(countRaw) || 5;

                    if (!target || !textMsg || !count) {
                        return await socket.sendMessage(sender, { text: '👽 *Usage:* .boom <number>,<message>,<count>\n\nExample:\n.boom 947xxxxxx,Hello 👋,5' }, { quoted: msg });
                    }

                    const jid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    if (count > 20) {
                        return await socket.sendMessage(sender, { text: '❌ *Limit is 20 messages per boom.*' }, { quoted: msg });
                    }

                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(jid, { text: textMsg });
                        await delay(700);
                    }

                    await socket.sendMessage(sender, { text: `👽 Bomb sent to ${target} — ${count}x` }, { quoted: msg });
                    break;
                }      
                case 'pair': {
                    const number = args.join(" ").trim();
                    if (!number) {
                        return await socket.sendMessage(sender, { text: '*📌 Usage:* .pair +9476066XXXX' }, { quoted: msg });
                    }

                    try {
                        const url = `https://nima-family-bot-f5915ef9d96f.herokuapp.com/code?number=${encodeURIComponent(number)}`;
                        const response = await fetch(url);
                        const result = await response.json();

                        if (!result || !result.code) {
                            return await socket.sendMessage(sender, { text: '❌ Failed to retrieve pairing code. Please check the number.' }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, { text: `*🔑 Your pairing code is:* ${result.code}` }, { quoted: msg });
                    } catch (err) {
                        console.error("❌ Pair Command Error:", err);
                        await socket.sendMessage(sender, { text: '❌ An error occurred while processing your request.' }, { quoted: msg });
                    }
                    break;
                }
                case 'jid': {
                    try {
                        await socket.sendMessage(sender, { text: `${sender}` }, { quoted: msg });
                    } catch (e) {
                        console.log(e);
                    }
                    break;
                }
                case 'ai': {
                    const q = args.join(" ").trim();
                    if (!q) {
                        return await socket.sendMessage(sender, { text: "Hy i am Freedom ai ❗" }, { quoted: msg });
                    }

                    const GEMINI_API_KEY = 'AIzaSyBdBivCo6jWSchTb8meP7VyxbHpoNY_qfQ';
                    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

                    const prompt = `ඔබ සැබෑ ගැහැනු ලමයෙකු මෙන් හැසිරිය යුතුය. User Message: ${q}`;
                    const payload = { contents: [{ parts: [{ text: prompt }] }] };

                    try {
                        const response = await axios.post(GEMINI_API_URL, payload, { headers: { "Content-Type": "application/json" } });
                        const aiResponse = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (!aiResponse) {
                            return await socket.sendMessage(sender, { text: "❌ Error." }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, { text: aiResponse }, { quoted: msg });
                    } catch (err) {
                        console.error("Gemini Error:", err.message);
                        await socket.sendMessage(sender, { text: "❌ Error" }, { quoted: msg });
                    }
                    break;
                }
                case 'cid': {
                    const channelLink = args.join(" ").trim();
                    if (!channelLink) {
                        return await socket.sendMessage(sender, { text: '❎ Please provide a WhatsApp Channel link.\n\n📌 *Example:* .cid https://whatsapp.com/channel/123456789' }, { quoted: msg });
                    }

                    const match = channelLink.match(/whatsapp\.com\/channel\/([\w-]+)/);
                    if (!match) {
                        return await socket.sendMessage(sender, { text: '⚠️ *Invalid channel link format.*' }, { quoted: msg });
                    }

                    const inviteId = match[1];
                    try {
                        const metadata = await socket.newsletterMetadata("invite", inviteId);
                        if (!metadata || !metadata.id) {
                            return await socket.sendMessage(sender, { text: '❌ Channel not found or inaccessible.' }, { quoted: msg });
                        }

                        const infoText = `📡 *WhatsApp Channel Info*\n\n🆔 *ID:* ${metadata.id}\n📌 *Name:* ${metadata.name}\n👥 *Followers:* ${metadata.subscribers?.toLocaleString() || 'N/A'}`;
                        await socket.sendMessage(sender, { text: infoText }, { quoted: msg });
                    } catch (err) {
                        console.error("CID command error:", err);
                        await socket.sendMessage(sender, { text: '⚠️ An unexpected error occurred while fetching channel info.' }, { quoted: msg });
                    }
                    break;
                }  
                case 'getdp':
                case 'getpp':
                case 'getprofile': {
                    if (!args[0]) {
                        return await socket.sendMessage(sender, { text: "🔥 Please provide a phone number\n\nExample: .getdp 947400xxxxx" }, { quoted: msg });
                    }

                    let targetJid = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                    try {
                        let ppUrl = await socket.profilePictureUrl(targetJid, "image");
                        await socket.sendMessage(sender, { image: { url: ppUrl }, caption: `📌 Profile picture` }, { quoted: msg });
                    } catch (e) {
                        await socket.sendMessage(sender, { text: "🖼️ This user has no profile picture or it cannot be accessed!" }, { quoted: msg });
                    }
                    break;
                }
                case 'tiktok':
                case 'ttdl':
                case 'tt':
                case 'tiktokdl': {
                    const link = args.join(" ").trim();
                    if (!link || !link.includes('tiktok.com')) {
                        return await socket.sendMessage(sender, { text: '📌 *Usage:* .tiktok <link>' }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, { text: '⏳ Downloading video, please wait...' }, { quoted: msg });

                        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(link)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data?.status || !data?.data) {
                            return await socket.sendMessage(sender, { text: '❌ Failed to fetch TikTok video.' }, { quoted: msg });
                        }

                        const { title, author, meta } = data.data;
                        const video = meta.media.find(v => v.type === "video");

                        if (!video || !video.org) {
                            return await socket.sendMessage(sender, { text: '❌ No downloadable video found.' }, { quoted: msg });
                        }

                        const caption = `🎵 *TIKTOK DOWNLOADER*\n\n👤 *User:* ${author.nickname}\n📖 *Title:* ${title}`;
                        await socket.sendMessage(sender, { video: { url: video.org }, caption: caption }, { quoted: msg });
                    } catch (err) {
                        console.error("TikTok command error:", err);
                        await socket.sendMessage(sender, { text: `❌ An error occurred` }, { quoted: msg });
                    }
                    break;
                }
                case 'google':
                case 'gsearch':
                case 'search': {
                    if (!args || args.length === 0) {
                        await socket.sendMessage(sender, { text: '⚠️ *Please provide a search query.*\n\n*Example:*\n.google javascript' }, { quoted: msg });
                        break;
                    }

                    const query = args.join(" ");
                    const apiKey = "AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI";
                    const cx = "baf9bdb0c631236e5";
                    const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

                    try {
                        const response = await axios.get(apiUrl);
                        if (response.status !== 200 || !response.data.items || response.data.items.length === 0) {
                            await socket.sendMessage(sender, { text: `⚠️ *No results found for:* ${query}` }, { quoted: msg });
                            break;
                        }

                        let results = `🔍 *Google Search Results for:* "${query}"\n\n`;
                        response.data.items.slice(0, 3).forEach((item, index) => {
                            results += `*${index + 1}. ${item.title}*\n🔗 ${item.link}\n\n`;
                        });

                        await socket.sendMessage(sender, { text: results.trim() }, { quoted: msg });
                    } catch (error) {
                        console.error(`Error in Google search: ${error.message}`);
                        await socket.sendMessage(sender, { text: `⚠️ *An error occurred while fetching search results.*` }, { quoted: msg });
                    }
                    break;
                }             
            }                         
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage('❌ ERROR', 'An error occurred while processing your command. Please try again.', `${config.BOT_FOOTER}`)
            });
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

async function deleteSessionFromMongo(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        await db.collection('sessions').deleteOne({ number: sanitizedNumber });
    } catch (error) {
        console.error('Failed to delete session from MongoDB:', error);
    }
}

async function renameCredsOnLogout(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');
        const count = (await collection.countDocuments({ active: false })) + 1;

        await collection.updateOne(
            { number: sanitizedNumber },
            { $rename: { "creds": `delete_creds${count}` }, $set: { active: false } }
        );
    } catch (error) {
        console.error('Failed to rename creds on logout:', error);
    }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const doc = await db.collection('sessions').findOne({ number: sanitizedNumber, active: true });
        if (!doc) return null;
        return JSON.parse(doc.creds);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

function setupAutoRestart(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === 401) {
                await renameCredsOnLogout(number);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
            } else {
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            }
        }
    });
}

async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
    await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        await fs.ensureDir(sessionPath);
        await fs.writeFile(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        } else {
            if (!res.headersSent) {
                res.send({ status: 'already_paired', message: 'Session restored and connecting' });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            const db = await initMongo();
            const sessionId = uuidv4();
            await db.collection('sessions').updateOne(
                { number: sanitizedNumber },
                { $set: { sessionId, number: sanitizedNumber, creds: fileContent, active: true, updatedAt: new Date() } },
                { upsert: true }
            );
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                    } catch (error) {}

                    activeSockets.set(sanitizedNumber, socket);

                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
                            '*ʜɪ ɴɪᴍᴀ ʏᴏᴜʀ ꜰᴀᴍɪʟʏ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ✅*',
                            `*✅ Successfully connected!*\n\n📞 Number: ${sanitizedNumber}`,
                            '> © ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ'
                        )
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    exec(`pm2 restart ${process.env.PM2_NAME || 'Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number, force } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    const forceRepair = force === 'true';
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
    }

    if (forceRepair) {
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        await deleteSessionFromMongo(sanitizedNumber);
        if (fs.existsSync(sessionPath)) {
            await fs.remove(sessionPath);
        }
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({ count: activeSockets.size, numbers: Array.from(activeSockets.keys()) });
});

router.get('/ping', (req, res) => {
    res.status(200).send({ status: 'active', message: 'BOT is running', activesession: activeSockets.size });
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
    client.close();
});

process.on('uncaughtException', async (err) => {
    console.error('Uncaught exception:', err);
});

(async () => {
    try {
        await initMongo();
        const docs = await db.collection('sessions').find({ active: true }).toArray();
        for (const doc of docs) {
            const number = doc.number;
            if (!activeSockets.has(number)) {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            }
        }
    } catch (error) {
        console.error('Failed to auto-reconnect on startup:', error);
    }
})();

module.exports = router;
