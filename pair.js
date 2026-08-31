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
    generateWAMessageFromContent,
    downloadContentFromMessage
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

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

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
    return (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") + s + "s";
}

async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) return { status: 'failed', error: 'Invalid group invite link' };
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) return { status: 'success', gid: response.gid };
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            if (retries === 0) return { status: 'failed', error: error.message };
            await delay(2000);
        }
    }
}

async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const caption = formatMessage(
        '*ʜɪ ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜ𝗟✅*',
        ` *☎️Number :*  ${number}\n  *ꜱᴛᴀᴛᴜꜱ : ᴏɴʟɪɴᴇ 🔄*`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(`${admin}@s.whatsapp.net`, { image: { url: config.IMAGE_PATH }, caption });
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;
        try {
            const messageId = message.newsletterServerId;
            if (!messageId) return;
            await socket.newsletterReactMessage(config.NEWSLETTER_JID, messageId.toString(), '❤️');
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}

async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;

        try {
            if (autoReact === 'on') {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }
            if (config.AUTO_VIEW_STATUS === 'true') {
                await socket.readMessages([message.key]);
            }
            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;
        
        // Helper reply function
        const reply = async (text) => {
            return await socket.sendMessage(sender, { text }, { quoted: msg });
        };

        const textMessage = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.imageMessage?.caption || 
                            msg.message.videoMessage?.caption || '';

        if (textMessage.trim().startsWith(config.PREFIX)) {
            const parts = textMessage.slice(config.PREFIX.length).trim().split(/\s+/);
            command = parts[0].toLowerCase();
            args = parts.slice(1);
        } else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
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

                    const title = '*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥*';
                    const content = `*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*\n` + 
                                   `*ʙᴏᴛ ᴏᴡɴᴇʀ :- ʟᴏᴋᴜ ɴɪᴍᴀ*\n` +
                                   `*ᴏᴡᴇɴʀ ɴᴜᴍʙᴇʀ :- 94760743488*\n` +
                                   `*ᴅɪᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ 👇*\n` +
                                   `> https://nima-family-bot-web.vercel.app/`;

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: formatMessage(title, content, config.BOT_FOOTER),
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'PING' }, type: 1 }
                        ]
                    }, { quoted: msg });
                    break;   
                 }
                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);

                    const menuCaption = `
╔═══〔 ACCESS GRANTED 〕══════════════╗
║ < N I M A . F A M I L Y . B O T >  
╚═══════════════════════════════════╝

╭━━━❰ ⚙️ S Y S T E M  S T A T S ❱━━━
│ ⎆  BOT Name : *NIMA FAMILY FREE BOT*
│ ⎆  Bot Type : *FAMILY BOT*
│ ⎆  Owners : *LOKU NIMAH*
│ ⏱️ Uptime : *${runtime(uptime)}*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      [ 🔑 USE BUTTONS TO NAVIGATE ]
      *© NIMA FAMILY FREE BOT*
`;
                    await socket.sendMessage(sender, { react: { text: "🌟", key: msg.key } });
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU }, 
                        caption: menuCaption,
                        buttons: [
                            { buttonId: `${config.PREFIX}amenu`, buttonText: { displayText: 'FULL COMMANDS LIST 🧩' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'CHECK LATENCY (PING) ⚡' }, type: 1 },
                            { buttonId: `${config.PREFIX}system`, buttonText: { displayText: 'VIEW SYSTEM DATA ⚙️' }, type: 1 },
                            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'VERIFY STATUS 🟢' }, type: 1 }
                        ]
                    }, { quoted: msg });
                    break;
                }
                case 'amenu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);

                    await socket.sendMessage(sender, { react: { text: "⚡", key: msg.key } });

                    const kariyane = `
╔═════════════════════════════════╗
║   [ N I M A  F A M I L Y  B O T ]   ║
╚═════════════════════════════════╝
*│ 🟢 .alive* : BOT Online Check
*│ 📶 .ping* : Speed Test
*│ ⚙️ .system* : BOT System Info
*│ 👑 .owner* : Show BOT Owners
*│ 🎼 .song <name>* : Download Song
*│ 📘 .fb <url>* : Facebook Video Down
*│ 🎵 .tiktok <url>* : TikTok DL
*│ 📥 .save* : Status Save
*│ 🤖 .ai <prompt>* : Chat with AI
`;
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU },
                        caption: kariyane
                    }, { quoted: msg });
                    break;
                }
                case 'ping': {
                    let inital = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { text: '*_Pinging to Module..._* ❗' }, { quoted: msg });
                    let final = new Date().getTime();
                    await socket.sendMessage(sender, { text: `❗ *Pong ${final - inital} Ms*`, edit: ping.key });
                    break;
                }
                case 'owner': {
                    await socket.sendMessage(sender, {
                        contacts: {
                            displayName: 'Owner Contacts',
                            contacts: [{ vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ɴɪᴍᴀ\nTEL;TYPE=Coder,VOICE:94760743488\nEND:VCARD' }]
                        }
                    });
                    break;
                }
                case 'system': {
                    let totalStorage = Math.floor(os.totalmem() / 1024 / 1024) + 'MB';
                    let cpuSpeed = (os.cpus()[0].speed / 1000).toFixed(2);
                    let content = `  ◦ *Runtime*: ${runtime(process.uptime())}\n  ◦ *Total Ram*: ${totalStorage}\n  ◦ *CPU Speed*: ${cpuSpeed} GHz`;
                    await socket.sendMessage(sender, { image: { url: config.IMAGE_PATH }, caption: formatMessage("*⚙️ ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ ⚙️*", content, config.BOT_FOOTER) }, { quoted: msg });
                    break;
                }
                case 'song': {
                    const q = args.join(" ");
                    if (!q) return await reply("*ඔයාලා ගීත නමක් හෝ YouTube ලින්ක් එකක් දෙන්න...!*");
                    
                    const search = await yts(q);
                    if (!search.videos.length) return await reply("*ගීතය හමුනොවුණා... ❌*");

                    const data = search.videos[0];
                    const api = `https://sadiya-tech-apis.vercel.app/download/ytdl?url=${data.url}&format=mp3&apikey=dinesh-api-key`;
                    const { data: apiRes } = await axios.get(api).catch(() => ({}));

                    if (!apiRes?.status || !apiRes?.result?.download) {
                        return await reply("❌ ගීතය බාගත කළ නොහැක. වෙනත් එකක් උත්සහ කරන්න!");
                    }

                    await socket.sendMessage(sender, {
                        image: { url: data.thumbnail },
                        caption: `*ℹ️ Title:* \`${data.title}\`\n*⏱️ Duration:* ${data.timestamp}`
                    }, { quoted: msg });

                    await socket.sendMessage(sender, {
                        audio: { url: apiRes.result.download },
                        mimetype: "audio/mpeg",
                        ptt: false
                    }, { quoted: msg });
                    break;
                }
                case 'ai': {
                    const q = args.join(" ");
                    if (!q) return await reply("Hy i am Freedom ai ❗");

                    const GEMINI_API_KEY = 'AIzaSyBdBivCo6jWSchTb8meP7VyxbHpoNY_qfQ';
                    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

                    try {
                        const response = await axios.post(GEMINI_API_URL, {
                            contents: [{ parts: [{ text: q }] }]
                        });
                        const aiResponse = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "❌ Error.";
                        await reply(aiResponse);
                    } catch (err) {
                        await reply("❌ Error connecting to AI.");
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await reply('❌ An error occurred while processing your command.');
        }
    });
}

function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
            } catch (error) {}
        }
    });
}

async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
    await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: 'fatal' });

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
        setupNewsletterHandlers(socket);

        if (!socket.authState.creds.registered) {
            let code = await socket.requestPairingCode(sanitizedNumber);
            if (!res.headersSent) res.send({ code });
        } else {
            if (!res.headersSent) res.send({ status: 'already_paired', message: 'Session restored and connecting' });
        }

        socket.ev.on('creds.update', saveCreds);

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                activeSockets.set(sanitizedNumber, socket);
                console.log(`Bot connected successfully for ${sanitizedNumber}`);
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).send({ error: 'Number parameter is required' });
    await EmpirePair(number, res);
});

module.exports = router;
