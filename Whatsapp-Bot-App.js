const express = require('express');
const app = express();
const port = 3000;

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const deneme = require('qrcode-terminal');

// Global client ve bağlantı durumu değişkenleri
let clients = {}; // taskId ile client'ı eşleştireceğiz

// Middleware
app.use(express.json()); // JSON body'leri okumak için

// Basit bir GET endpoint
app.get('/WhatsApp/ConnectionApp', (req, res) => {
    const taskId = req.query.id;
    console.log(`${taskId} Siteme Bağlanmak için İstek attı.`);

    // Eğer taskId için client zaten varsa, yeniden başlatmıyoruz
    if (clients[taskId]) {
        return res.json({ message: 'Client zaten başlatıldı. QR kodunu bekliyor...' });
    }

    // Yeni Client oluşturuluyor
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: taskId })
    });
    clients[taskId] = client;  // TaskId ile client'ı eşleştiriyoruz
    console.log("Client oluşturuldu, QR kodu bekleniyor...");

    // Bağlantı durumu kontrolü
    client.on('ready', () => {
        console.log('Client başarıyla bağlandı!');
        return res.json({ message: 'Client başarıyla bağlandı. Otomatik bağlantı sağlandı.' });
    });

    client.on('qr', async qr => {
        console.log("QR Kodunu tarayın:");
        await deneme.generate(qr, { small: true });

        // QR kodunu yanıt olarak döndür
        res.json({ message: 'Client oluşturuldu, QR kodunuz:', qrCode: qr });
    });

    client.on('disconnected', (reason) => {
        console.log(clients[taskId]);
        console.log('Client bağlantısı kesildi:', reason);

        // Bağlantı kesildiğinde client'ı silmeden önce kontrol et
        if (clients[taskId]) {
            console.log('Client destroyed:', clients[taskId].destroyed);

            // Eğer destroyed metodu varsa, onu çağırın
            if (typeof clients[taskId].destroy === 'function') {
                clients[taskId].destroy(); // client'ı yok et
                console.log('Client başarıyla yok edildi.');
            }

            delete clients[taskId]; // Bağlantı kesildiğinde client'ı sil
        } else {
            console.log('Client zaten silinmiş.');
        }
    });

    client.initialize(); // Client'i başlatmayı unutmayın
});

// Bağlantı durumunu sorgulamak için GET endpoint
app.get('/WhatsApp/IsConnect', (req, res) => {
    const taskId = req.query.id;

    if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
    }

    console.log(`${taskId} Bağlantı durumunu sorgulamak için İstek attı.`);

    // TaskId'ye karşılık gelen client varsa bağlantı durumu kontrol edilir
    const client = clients[taskId];

    if (!client) {
        return res.status(400).json({ error: "Client bulunamadı. Lütfen önce bağlanın." });
    }
    // Bağlantı durumu kontrolü
    const isConnected = client.lastLoggedOut; // Bağlantı durumunu kontrol et
    if (!isConnected) {
        res.json({ message: 'Bağlı' });
    } else {
        res.json({ message: 'Bağlı değil' });
    }
});


// Mesaj gönderme endpoint
app.post('/WhatsApp/SendMessage', async (req, res) => {
    const taskId = req.body.taskId;
    if (!taskId || !clients[taskId]) {
        return res.status(400).json({ error: "Sisteme bağlı değilsiniz veya geçersiz taskId" });
    }

    const { number, message } = req.body;
    const client = clients[taskId];

    if (!number || !message) {
        return res.status(400).json({ error: "Number and message are required" });
    }

    const numberList = number.split(",").map(num => num.trim());
    console.log(numberList);

    let responses = [];
    for (const item of numberList) {
        try {
            let number = "90" + item + "@c.us";
            console.log(`Mesaj Gönderiliyor: ${number}`);
            const time = Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000;

            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    client.sendMessage(number, message)
                        .then(() => {
                            responses.push({ number, statusId: 1, status: 'Başarılı', message });
                            resolve();
                        })
                        .catch((error) => {
                            responses.push({ number, statusId: 0, status: 'Başarısız', message: error.message });
                            reject();
                        });
                }, time);
            });
        } catch (error) {
            responses.push({ number: item, status: 'Error', message: error.message });
        }
    }

    res.status(200).json({
        success: true,
        responses: responses
    });

    console.log("Mesaj Gönderme işlemi tamamlandı.");
});

// Döküman gönderme endpoint
app.post('/WhatsApp/SendDocument', async (req, res) => {
    const taskId = req.body.taskId;
    if (!taskId || !clients[taskId]) {
        return res.status(400).json({ error: "Sisteme bağlı değilsiniz veya geçersiz taskId" });
    }

    const { number, documentUrl } = req.body;
    const client = clients[taskId];

    if (!number || !documentUrl) {
        return res.status(400).json({ error: "Number and documentUrl are required" });
    }

    const numberList = number.split(",").map(num => num.trim());
    console.log(numberList);

    const response = await fetch(documentUrl);
    const contentType = response.headers.get('Content-Type');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const fileName = 'DosyaBasligiAyarlancak.' + contentType.split("/")[1];

    const documentMedia = new MessageMedia(contentType, base64Data, fileName);

    let responses = [];
    for (const item of numberList) {
        try {
            let number = "90" + item + "@c.us";
            console.log(`Döküman Gönderiliyor: ${number}`);
            const time = Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000;

            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    client.sendMessage(number, documentMedia, { sendMediaAsDocument: true })
                        .then(() => {
                            responses.push({ number, statusId: 1, status: 'Başarılı', message: fileName });
                            resolve();
                        })
                        .catch((error) => {
                            responses.push({ number, statusId: 0, status: 'Başarısız', message: fileName });
                            reject();
                        });
                }, time);
            });
        } catch (error) {
            responses.push({ number: item, status: 'Error', message: error.message });
        }
    }

    res.status(200).json({
        success: true,
        responses: responses
    });

    console.log("Döküman Gönderme işlemi tamamlandı.");
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} üzerinde çalışıyor.`);
});
