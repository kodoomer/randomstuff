// ==UserScript==
// @name         XiM
// @namespace    kodoomer.maxmsg.enc
// @version      v2d
// @author       kodoomer
// @match        https://web.max.ru/*
// @grant        none
// ==/UserScript==

(async function () {
  function error(text, critical = false) {
    alert(text + '. Обновите скрипт если возможно.');
    if (critical) {
      alert("Произошла критическая ошибка. Сайт будет перезагружен. Если ошибка продолжет появляться, отключите скрипт.");
      window.location.reload();
    }
  }

  try {
    // util functions

    // sets async callbacks on WebSocket.prototype.send and WebSocket().onmessage
    function websockCallback(sendCB, recvCB) {
      if (this._origSend) {
        console.error("Only one WebSocket callback is allowed");
        return;
      }
      this._origSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        if (!this._origRecv) {
          this._origRecv = this.onmessage;
          this.onmessage = function(event) {
            recvCB(event, _origSend, this._origRecv).then((data) => {
              if (!data) return;
              this._origRecv({...event, data});
            });
          }
        }
        sendCB(this, data, _origSend, this._origRecv).then((data) => {
          if (!data) return;
          _origSend.call(this, data);
        });
      }
    }

    // convert base64 encoded data into an ArrayBuffer
    function base64ToBuffer(string) {
      let data = atob(string);
      let buffer = new ArrayBuffer(data.length);
      let arr = new Uint8Array(buffer);
      for (let i = 0; i < data.length; i++) {
          arr[i] = data.charCodeAt(i);
      }
      return buffer;
    }

    // dictionary encoding
    // converts a buffer (where buffer.byteLength is even) into a ' '-joined string based on a 65536-item dictionary
    function bufferToWords(buffer, dict) {
      let arr = new Uint16Array(buffer);
      let result = [];
      for (let i of arr) {
        result.push(dict[i]);
      }
      return result.join(' ');;
    }
    // converts words (encoded by bufferToWords) into an ArrayBuffer, using a 65536-item dictionary
    function wordsToBuffer(words, dict) {
      let split = words.split(' ');
      let buf = new ArrayBuffer(split.length * 2);
      let arr = new Uint16Array(buf);
      for (let i = 0; i < split.length; i++) {
        arr[i] = dict.indexOf(split[i]);
      }
      return buf;
    }

    // encrypts messages
    async function encrypt(data) {
      try {
        let encBuf = (new TextEncoder).encode(data).buffer;
        let newBuf = new ArrayBuffer(Math.ceil(encBuf.byteLength / 2) * 2);
        (new Uint8Array(newBuf)).set(new Uint8Array(encBuf));
        return encryptedPrefix + bufferToWords(newBuf, dictionary);
      } catch (err) {
        console.error(err);
        return null;
      }
    }
    // decrypts messages
    async function decrypt(data) {
      if (!data.startsWith(encryptedPrefix)) return data;
      try {
        return (new TextDecoder).decode(wordsToBuffer(data.slice(encryptedPrefix.length), dictionary));
      } catch (err) {
        console.error(err);
        return data;
      }
    }

    // global constants
    const encChunkURI = "https://web.max.ru/_app/immutable/chunks/pZEZLImL.js";
    const encChunkLength = 26162;
    const dictURI = "https://raw.githubusercontent.com/kodoomer/randomstuff/refs/heads/main/65536-ruwords.json";
    const sendIgnoreOpcodes = [1, 5]; // telemetry ids
    const debugLogWS = 1; // 1=log json 2=log text 0=off
    const encryptedPrefix = 'ланиды перси ';

    // load / fetch dictionary data
    let dictionary;
    try {
      dictionary = await fetch(dictURI, { mode: 'cors' });
      if (!dictionary.ok) throw 'Unsucessfull request';
      dictionary = await dictionary.json();
    } catch (err) {
      console.error(err);
      error('Не удалось скачать словарь', true);
    }

    // fetch encoding & decoding code
    let encChunkCode = await (await fetch(encChunkURI)).text();
    encChunkCode = encChunkCode.slice(
      encChunkCode.indexOf('function vne(e)'),
      encChunkCode.indexOf(',Ui=`__one')
    );
    if (encChunkCode.length != encChunkLength) {
      error('Невозможно проверить целостность кода (де)кодирования');
    }

    // run & load encoding & decoding code
    window.XiMglob = {};
    let scriptEl = document.createElement('script');
    scriptEl.innerHTML = `
      (function () {
        ${encChunkCode}
        window.XiMglob.encCode = {
          encode: tre,
          decode: ere
        };
        document.currentScript.remove();
      })();
    `;
    document.body.insertAdjacentElement('beforeend', scriptEl);
    if (!window.XiMglob.encCode) {
      error("Невозможно загрузить / запустить код (де)кодирования", true);
    }
    let {decode: decodeMsg, encode: encodeMsg} = window.XiMglob.encCode;

    // global variables
    let lastText, // last text sent
        lastEncText; // last text sent (encoded)

    async function onSend(ws, data, send, recv) {
      try {
        data = decodeMsg(data);
        if (sendIgnoreOpcodes.includes(data.opcode)) return; // ignore telemetry
        if (data.opcode == 64 && data.payload.message.text) {
          lastText = data.payload.message.text;
          lastEncText = await encrypt(lastText);
          if (lastEncText == null) {
            error("Произошла ошибка шифрования. Последнее сообщение не отправлено");
            return;
          }
          data.payload.message.text = lastEncText;
        }
        if (debugLogWS == 1) console.log('Sent:', data);
        data = encodeMsg(data);
        if (debugLogWS == 2) console.log('Sent:', (new TextDecoder).decode(data))
        return data;
      } catch (err) {
        console.error(err);
        error("Произошла неивестная ошибка при отправке команды.  Если ошибка продолжет появляться, отключите скрипт");
      }
    }

    async function onRecv(event, send, recv) {
      try {
        let data = decodeMsg(event.data);
        if (data.opcode == 64 && data.payload.message.text == lastEncText) {
          data.payload.message.text = lastText;
        }
        if (data.opcode == 48 || data.opcode == 19) {
          for (let i of data.payload.chats) {
            i.lastMessage.text = await decrypt(i.lastMessage.text);
          }
        }
        if (data.opcode == 49) {
          for (let i of data.payload.messages) {
            i.text = await decrypt(i.text);
          }
        }
        if (debugLogWS == 1) console.log("Received:", data);
        data = encodeMsg(data);
        if (debugLogWS == 2) console.log('Received:', (new TextDecoder).decode(data))
        return data;
      } catch (err) {
        console.error(err);
        error("Произошла неивестная ошибка при получении команды. Если ошибка продолжет появляться, отключите скрипт");
      }
    }

    websockCallback(onSend, onRecv);
  } catch (err) {
    console.error(err);
    error("Произошла неивестная ошибка при инициализации", true);
  }
})();
